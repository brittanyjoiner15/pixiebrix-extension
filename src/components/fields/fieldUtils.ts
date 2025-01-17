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

import { Schema, SchemaDefinition } from "@/core";

export function fieldLabel(name: string): string {
  const parts = name.split(".");
  return parts[parts.length - 1];
}

type TypePredicate = (fieldDefinition: Schema) => boolean;

export function createTypePredicate(predicate: TypePredicate): TypePredicate {
  return (fieldDefinition: Schema) => {
    if (predicate(fieldDefinition)) {
      return true;
    }

    const matches = (x: SchemaDefinition) =>
      typeof x !== "boolean" && predicate(x);

    if ((fieldDefinition.oneOf ?? []).some((x) => matches(x))) {
      return true;
    }

    if ((fieldDefinition.anyOf ?? []).some((x) => matches(x))) {
      return true;
    }

    if ((fieldDefinition.allOf ?? []).some((x) => matches(x))) {
      return true;
    }

    return false;
  };
}
