/* eslint-disable filenames/match-exported */
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

import { IExtension, Metadata } from "@/core";
import { FrameworkMeta } from "@/messaging/constants";
import {
  baseSelectExtensionPoint,
  excludeInstanceIds,
  lookupExtensionPoint,
  makeBaseState,
  makeExtensionReaders,
  makeIsAvailable,
  makeReaderFormState,
  selectIsAvailable,
  withInstanceIds,
  WizardStep,
} from "@/devTools/editor/extensionPoints/base";
import { uuidv4 } from "@/types/helpers";
import { DynamicDefinition } from "@/nativeEditor/dynamic";
import { ExtensionPointConfig } from "@/extensionPoints/types";
import { castArray, identity, pickBy } from "lodash";
import LogsTab from "@/devTools/editor/tabs/LogsTab";
import {
  ContextMenuConfig,
  ContextMenuExtensionPoint,
  MenuDefaultOptions as ContextMenuDefaultOptions,
  MenuDefinition,
} from "@/extensionPoints/contextMenu";
import { getDomain } from "@/permissions/patterns";
import { faBars } from "@fortawesome/free-solid-svg-icons";
import {
  BaseFormState,
  ElementConfig,
} from "@/devTools/editor/extensionPoints/elementConfig";
import { Menus } from "webextension-polyfill-ts";
import { BlockPipeline } from "@/blocks/types";
import React from "react";
import EditTab from "@/devTools/editor/tabs/editTab/EditTab";
import ContextMenuConfiguration from "@/devTools/editor/tabs/contextMenu/ContextMenuConfiguration";

const wizard: WizardStep[] = [
  {
    step: "Edit",
    Component: EditTab,
    extraProps: { pipelineFieldName: "extension.action" },
  },
  { step: "Logs", Component: LogsTab },
];

export interface ContextMenuFormState extends BaseFormState {
  type: "contextMenu";

  extensionPoint: {
    metadata: Metadata;
    definition: {
      defaultOptions: ContextMenuDefaultOptions;
      documentUrlPatterns: string[];
      contexts: Menus.ContextType[];
      isAvailable: {
        matchPatterns: string;
        selectors: string;
      };
    };
  };

  extension: {
    title: string;
    action: BlockPipeline;
  };
}

function fromNativeElement(
  url: string,
  metadata: Metadata,
  element: null,
  frameworks: FrameworkMeta[]
): ContextMenuFormState {
  const base = makeBaseState(uuidv4(), null, metadata, frameworks);
  // Don't include a reader since in most cases can't use a selection reader
  base.readers = [];

  const isAvailable = makeIsAvailable(url);

  const title = "Context menu item";

  return {
    type: "contextMenu",
    // To simplify the interface, this is kept in sync with the caption
    label: title,
    ...base,
    extensionPoint: {
      metadata,
      definition: {
        documentUrlPatterns: [isAvailable.matchPatterns],
        contexts: ["all"],
        defaultOptions: {},
        isAvailable,
      },
    },
    extension: {
      title,
      action: [],
    },
  };
}

function selectExtensionPoint(
  formState: ContextMenuFormState
): ExtensionPointConfig<MenuDefinition> {
  const { extensionPoint, readers } = formState;
  const {
    definition: { isAvailable, documentUrlPatterns, contexts = ["all"] },
  } = extensionPoint;
  return {
    ...baseSelectExtensionPoint(formState),
    definition: {
      type: "contextMenu",
      documentUrlPatterns,
      contexts,
      reader: readers.map((x) => x.metadata.id),
      isAvailable: pickBy(isAvailable, identity),
    },
  };
}

function selectExtension(
  { uuid, label, extensionPoint, extension, services }: ContextMenuFormState,
  options: { includeInstanceIds?: boolean } = {}
): IExtension<ContextMenuConfig> {
  return {
    id: uuid,
    extensionPointId: extensionPoint.metadata.id,
    _recipe: null,
    label,
    services,
    config: options.includeInstanceIds
      ? extension
      : excludeInstanceIds(extension, "action"),
  };
}

async function fromExtension(
  config: IExtension<ContextMenuConfig>
): Promise<ContextMenuFormState> {
  const extensionPoint = await lookupExtensionPoint<
    MenuDefinition,
    ContextMenuConfig,
    "contextMenu"
  >(config, "contextMenu");
  const extensionConfig = config.config;

  const {
    documentUrlPatterns,
    defaultOptions,
    contexts,
  } = extensionPoint.definition;

  return {
    uuid: config.id,
    installed: true,
    type: "contextMenu",
    label: config.label,

    readers: await makeReaderFormState(extensionPoint),
    services: config.services,

    extension: {
      ...extensionConfig,
      action: withInstanceIds(castArray(extensionConfig.action)),
    },

    extensionPoint: {
      metadata: extensionPoint.metadata,
      definition: {
        documentUrlPatterns,
        defaultOptions,
        contexts,
        isAvailable: selectIsAvailable(extensionPoint),
      },
    },
  };
}

async function fromExtensionPoint(
  url: string,
  extensionPoint: ExtensionPointConfig<MenuDefinition>
): Promise<ContextMenuFormState> {
  if (extensionPoint.definition.type !== "contextMenu") {
    throw new Error("Expected contextMenu extension point type");
  }

  const {
    defaultOptions = {},
    documentUrlPatterns = [],
    type,
  } = extensionPoint.definition;

  return {
    uuid: uuidv4(),
    installed: true,
    type,
    label: `My ${getDomain(url)} context menu`,

    readers: await makeReaderFormState(extensionPoint),
    services: [],

    extension: {
      title: defaultOptions.title ?? "Custom Action",
      action: [],
    },

    extensionPoint: {
      metadata: extensionPoint.metadata,
      definition: {
        ...extensionPoint.definition,
        defaultOptions,
        documentUrlPatterns,
        isAvailable: selectIsAvailable(extensionPoint),
      },
    },
  };
}

function asDynamicElement(element: ContextMenuFormState): DynamicDefinition {
  return {
    type: "contextMenu",
    extension: selectExtension(element, { includeInstanceIds: true }),
    extensionPoint: selectExtensionPoint(element),
    readers: makeExtensionReaders(element),
  };
}

const config: ElementConfig<undefined, ContextMenuFormState> = {
  displayOrder: 1,
  elementType: "contextMenu",
  label: "Context Menu",
  baseClass: ContextMenuExtensionPoint,
  EditorNode: ContextMenuConfiguration,
  selectNativeElement: undefined,
  icon: faBars,
  fromNativeElement,
  fromExtensionPoint,
  asDynamicElement,
  selectExtensionPoint,
  selectExtension,
  fromExtension,
  wizard,
  insertModeHelp: (
    <div>
      <p>
        A context menu (also called a right-click menu) can be configured to
        appear when you right click on a page, text selection, or other content
      </p>

      <p>
        Use an existing foundation, or start from scratch to have full control
        over where the the menu item appears
      </p>
    </div>
  ),
};

export default config;
