/*
 * Copyright (C) 2023 PixieBrix, Inc.
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

import * as redux from "react-redux";
import { recipeDefinitionFactory } from "@/testUtils/factories";
import useWizard from "@/activation/useWizard";
import { renderHook } from "@testing-library/react-hooks";
import { propertiesToSchema } from "@/validators/generic";

jest.mock("@/components/auth/AuthWidget", () => {});
jest.mock("react-redux");
jest.mock("connected-react-router");

describe("useWizard", () => {
  test("show personalized tab", () => {
    const spy = jest.spyOn(redux, "useSelector");
    spy.mockReturnValue([]);

    const { result } = renderHook(() =>
      useWizard(
        recipeDefinitionFactory({
          // Page Editor produces normalized form
          options: {
            schema: propertiesToSchema({
              foo: { type: "string" },
            }),
          },
        })
      )
    );

    const [steps] = result.current;
    expect(steps).toHaveLength(2);
  });

  test("hide personalized tab for empty schema", () => {
    const spy = jest.spyOn(redux, "useSelector");
    spy.mockReturnValue([]);

    const { result } = renderHook(() => useWizard(recipeDefinitionFactory()));

    const [steps] = result.current;
    expect(steps).toHaveLength(1);
  });

  test("hide personalized tab for empty shorthand schema", () => {
    const spy = jest.spyOn(redux, "useSelector");
    spy.mockReturnValue([]);

    const { result } = renderHook(() => useWizard(recipeDefinitionFactory()));

    const [steps] = result.current;
    expect(steps).toHaveLength(1);
  });
});