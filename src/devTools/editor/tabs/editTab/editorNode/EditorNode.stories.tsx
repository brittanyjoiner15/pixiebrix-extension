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

import React from "react";
import { ComponentMeta, ComponentStory } from "@storybook/react";
import { faBook } from "@fortawesome/free-solid-svg-icons";
import EditorNode from "@/devTools/editor/tabs/editTab/editorNode/EditorNode";

export default {
  title: "PageEditor/Node",
  component: EditorNode
} as ComponentMeta<typeof EditorNode>;

const Story: ComponentStory<typeof EditorNode> = (args) => (
  <EditorNode {...args} />
);

export const Reader = Story.bind({});
Reader.args = {
  title: "Read",
  icon: faBook
};
