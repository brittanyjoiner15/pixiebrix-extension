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

import { useDispatch } from "react-redux";
import { useCallback, useContext } from "react";
import { DevToolsContext } from "@/devTools/context";
import AuthContext from "@/auth/AuthContext";
import { useToasts } from "react-toast-notifications";
import { actions, FormState } from "@/devTools/editor/slices/editorSlice";
import { internalExtensionPointMetaFactory } from "@/devTools/editor/extensionPoints/base";
import { reportError } from "@/telemetry/logging";
import { ElementConfig } from "@/devTools/editor/extensionPoints/elementConfig";
import { getErrorMessage } from "@/errors";
import { getCurrentURL, thisTab } from "@/devTools/utils";
import { updateDynamicElement } from "@/contentScript/messenger/api";

type AddElement = (config: ElementConfig) => void;

function useAddElement(): AddElement {
  const dispatch = useDispatch();
  const { tabState } = useContext(DevToolsContext);
  const { scope, flags = [] } = useContext(AuthContext);
  const { addToast } = useToasts();

  return useCallback(
    async (config: ElementConfig) => {
      if (config.flag && !flags.includes(config.flag)) {
        dispatch(
          actions.betaError({ error: "This feature is in private beta" })
        );
        return;
      }

      dispatch(actions.toggleInsert(config.elementType));

      if (!config.selectNativeElement) {
        // If the foundation is not for a native element, stop after toggling insertion mode
        return;
      }

      try {
        const element = await config.selectNativeElement(thisTab);
        const url = await getCurrentURL();

        const metadata = internalExtensionPointMetaFactory();

        const initialState = config.fromNativeElement(
          url,
          metadata,
          element,
          tabState.meta.frameworks ?? []
        );

        await updateDynamicElement(
          thisTab,
          config.asDynamicElement(initialState)
        );

        dispatch(actions.addElement(initialState as FormState));
      } catch (error: unknown) {
        if (getErrorMessage(error) === "Selection cancelled") {
          return;
        }

        reportError(error);
        addToast(
          `Error adding ${config.label.toLowerCase()}: ${getErrorMessage(
            error
          )}`,
          {
            appearance: "error",
            autoDismiss: true,
          }
        );
      } finally {
        dispatch(actions.toggleInsert(null));
      }
    },
    [dispatch, tabState.meta?.frameworks, scope, addToast, flags]
  );
}

export default useAddElement;
