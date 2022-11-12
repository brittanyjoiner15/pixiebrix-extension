/*
 * Copyright (C) 2022 PixieBrix, Inc.
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

import { createContext, useContext } from "react";

export type FormErrorContextProps = {
  shouldUseAnalysis: boolean;
  showUntouchedErrors: boolean;
};

const defaultValue: FormErrorContextProps = {
  shouldUseAnalysis: false,
  showUntouchedErrors: false,
};

export const FormErrorContext =
  createContext<FormErrorContextProps>(defaultValue);

export function useFormErrorSettings(): FormErrorContextProps {
  const errorContext = useContext(FormErrorContext);
  return errorContext ?? defaultValue;
}