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

import { Read } from "@/blocks/readers/factory";
import { Framework } from "@/messaging/constants";
import { ReaderOutput, ReaderRoot } from "@/core";
import { castArray, compact } from "lodash";
import { getComponentData, ReadPayload } from "@/pageScript/protocol";

export type FrameworkConfig = ReadPayload & {
  /**
   * @deprecated Legacy emberjs reader config. Use pathSpec instead
   */
  attrs?: string | string[];
};

export function isHTMLElement(root: ReaderRoot): root is HTMLElement {
  return root && root !== document;
}

async function asyncFastCssSelector(element: HTMLElement): Promise<string> {
  // Load async because css-selector-generator references the window variable which fails when
  // generating headers
  const getCssSelector = (await import("css-selector-generator")).default;
  return getCssSelector(element, {
    // Prefer speed over robust/readable selectors
    combineWithinSelector: false,
    combineBetweenSelectors: false,
  });
}

export function frameworkReadFactory(
  framework: Framework
): Read<FrameworkConfig> {
  async function read(
    reader: FrameworkConfig,
    root: ReaderRoot
  ): Promise<ReaderOutput> {
    const {
      selector,
      rootProp,
      waitMillis,
      traverseUp,
      optional,
      attrs,
      pathSpec,
    } = reader;

    const rootSelector = isHTMLElement(root)
      ? await asyncFastCssSelector(root)
      : null;

    return getComponentData({
      framework,
      selector: compact([rootSelector, selector]).join(" "),
      rootProp,
      waitMillis,
      optional,
      traverseUp,
      pathSpec: attrs
        ? Object.fromEntries(
            castArray(attrs).map((attr) => [attr, `attrs.${attr}`])
          )
        : pathSpec,
    });
  }

  return read;
}
