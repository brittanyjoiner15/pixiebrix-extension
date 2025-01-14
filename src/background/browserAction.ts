/*
 * Copyright (C) 2021 PixieBrix, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { isBackgroundPage } from "webext-detect-page";
import { reportError } from "@/telemetry/logging";
import { ensureContentScript, showErrorInOptions } from "@/background/util";
import browser, { Tabs } from "webextension-polyfill";
import { safeParseUrl, sleep } from "@/utils";
import { JsonObject, JsonValue } from "type-fest";
import { getErrorMessage } from "@/errors";
import { emitDevtools } from "@/background/devtools/internal";
import {
  hideActionPanel,
  showActionPanel,
  toggleActionPanel,
} from "@/contentScript/messenger/api";
import { MessengerMeta } from "webext-messenger";
import { UUID } from "@/core";

const MESSAGE_PREFIX = "@@pixiebrix/background/browserAction/";
export const FORWARD_FRAME_NOTIFICATION = `${MESSAGE_PREFIX}/FORWARD_ACTION_FRAME_NOTIFICATION`;

// The sidebar is always injected to into the top level frame
const TOP_LEVEL_FRAME_ID = 0;

/**
 * Mapping from tabId to the message sequence number for forwarding. Reset/delete whenever the panel is shown/hidden.
 * Messages with a sequence number lower than the value are dropped/skipped.
 */
const tabSeqNumber = new Map<number, number>();

/**
 * Mapping from tabId to the nonce for the browser action iframe
 */
const tabNonces = new Map<number, string | void>();

/**
 * Mapping from tabId to the browser frame id for the browser action iframe
 */
const tabFrames = new Map<number, number>();

const webstores = ["chrome.google.com", "addons.mozilla.org"];
async function handleBrowserAction(tab: Tabs.Tab): Promise<void> {
  const { protocol, hostname } = safeParseUrl(tab.url);
  if (webstores.includes(hostname)) {
    void showErrorInOptions("ERR_BROWSER_ACTION_TOGGLE_WEBSTORE", tab.index);
    return;
  }

  if (!protocol.startsWith("http")) {
    // Page not supported. Open the options page instead
    void browser.runtime.openOptionsPage();
    return;
  }

  // We're either getting a new frame, or getting rid of the existing one. Forget the old frame
  // id so we're not sending messages to a dead frame
  tabFrames.delete(tab.id);
  tabSeqNumber.delete(tab.id);

  try {
    await ensureContentScript({ tabId: tab.id, frameId: TOP_LEVEL_FRAME_ID });
    const nonce = await toggleActionPanel({
      tabId: tab.id,
      frameId: TOP_LEVEL_FRAME_ID,
    });
    tabNonces.set(tab.id, nonce);

    // Inform editor that it now has the ActiveTab permission, if it's open
    emitDevtools("HistoryStateUpdate", {
      tabId: tab.id,
      frameId: TOP_LEVEL_FRAME_ID,
    });
  } catch (error: unknown) {
    await showErrorInOptions("ERR_BROWSER_ACTION_TOGGLE", tab.index);
    console.error(error);
    reportError(error);
  }
}

const FORWARD_RETRY_INTERVAL_MILLIS = 50;

const FORWARD_RETRY_MAX_WAIT_MILLIS = 3000;

/**
 * Wait for the frame to register itself with the background page
 */
async function waitFrameId(tabId: number): Promise<number> {
  const start = Date.now();
  let frameId: number;
  do {
    frameId = tabFrames.get(tabId);
    if (frameId == null) {
      if (Date.now() - start > FORWARD_RETRY_MAX_WAIT_MILLIS) {
        throw new Error(
          `Action frame not ready for tab ${tabId} after ${FORWARD_RETRY_MAX_WAIT_MILLIS}ms`
        );
      }

      await sleep(FORWARD_RETRY_INTERVAL_MILLIS);
    }
  } while (frameId == null);

  return frameId;
}

/**
 * Send a message to the action frame (sidebar) for a page when it's ready
 * @param tabId the tab containing the action frame
 * @param seqNum sequence number of the message, to ensure they're sent in the correct order despite non-determinism
 * in when waitFrameId and content script ready are resolved
 * @param message the serializable message
 */
async function forwardWhenReady(
  tabId: number,
  seqNum: number,
  message: { type: string; meta?: JsonObject }
): Promise<void> {
  // `waitFrameId` and the `browser.tabs.sendMessage` loop cause non-determinism is what order the promises are
  // resolved. Therefore, we need to use a sequence number to ensure the messages get sent in the correct order.

  // Key assumption we're making: we're just forwarding render panel messages, which are safe to drop because the panel
  // should always just be showing the values of the latest message

  // We _might_ be able to have forwardWhenReady handle the seqNum itself instead of passing an internal value. However
  // I'm worried there would still some non-determinism because the source method calling forward from the content
  // script uses `void browser.runtime.sendMessage`, so the messages are not guaranteed to be ordered

  const frameId = await waitFrameId(tabId);

  const curSeqNum = tabSeqNumber.get(tabId);
  if (curSeqNum != null && curSeqNum > seqNum) {
    console.warn(
      "Skipping stale message (current: %d, message: %d)",
      curSeqNum,
      seqNum
    );
    return;
  }

  const messageWithSequenceNumber = {
    ...message,
    meta: { ...message.meta, $seq: seqNum },
  };

  console.debug(
    "Forwarding message %s to action frame for tab: %d (seq: %d)",
    message.type,
    tabId,
    seqNum
  );

  const start = Date.now();
  while (Date.now() - start < FORWARD_RETRY_MAX_WAIT_MILLIS) {
    const curSeqNum = tabSeqNumber.get(tabId);
    if (curSeqNum != null && curSeqNum > seqNum) {
      console.warn(
        "Skipping stale message (current: %d, message: %d)",
        curSeqNum,
        seqNum
      );
      return;
    }

    try {
      await browser.tabs.sendMessage(tabId, messageWithSequenceNumber, {
        frameId,
      });
      console.debug(
        "Forwarded message %s to action frame for tab: %d (seq: %d)",
        message.type,
        tabId,
        seqNum
      );
      // Message successfully received, so record latest sequence number for tab
      tabSeqNumber.set(tabId, seqNum);
      return;
    } catch (error: unknown) {
      if (getErrorMessage(error).includes("Could not establish connection")) {
        await sleep(FORWARD_RETRY_INTERVAL_MILLIS);
      } else {
        throw error;
      }
    }
  }

  throw new Error(
    `Action frame for tab ${tabId} not ready in ${FORWARD_RETRY_MAX_WAIT_MILLIS}ms`
  );
}

export async function registerActionFrame(
  this: MessengerMeta,
  nonce: UUID
): Promise<void> {
  const sender = this.trace[0];
  const tabId = sender.tab.id;
  const expected = tabNonces.get(tabId);
  if (expected != null && expected !== nonce) {
    console.warn("Action frame nonce mismatch", {
      expected,
      actual: nonce,
    });
  }

  console.debug("Setting action frame metadata", {
    tabId,
    frameId: sender.frameId,
  });
  tabFrames.set(tabId, sender.frameId);
  tabSeqNumber.delete(tabId);
}

export async function forwardFrameNotification(
  this: MessengerMeta,
  sequence: number,
  payload: {
    type: string;
    meta?: JsonObject;
    payload: JsonValue;
  }
) {
  const tabId = this.trace[0].tab.id;
  return forwardWhenReady(tabId, sequence, payload).catch(reportError);
}

export async function showActionFrame(this: MessengerMeta): Promise<void> {
  const sender = this.trace[0];
  const tabId = sender.tab.id;
  tabFrames.delete(tabId);
  const nonce = await showActionPanel({
    tabId,
    frameId: TOP_LEVEL_FRAME_ID,
  });
  console.debug("Setting action frame nonce", { sender, nonce });
  tabNonces.set(tabId, nonce);
  tabSeqNumber.delete(tabId);
}

export async function hideActionFrame(this: MessengerMeta): Promise<void> {
  const sender = this.trace[0];
  const tabId = sender.tab.id;
  tabFrames.delete(tabId);
  await hideActionPanel({ tabId, frameId: TOP_LEVEL_FRAME_ID });
  console.debug("Clearing action frame nonce", { sender });
  tabNonces.delete(tabId);
  tabSeqNumber.delete(tabId);
}

if (isBackgroundPage()) {
  browser.browserAction.onClicked.addListener(handleBrowserAction);
  console.debug("Installed browserAction click listener");
}
