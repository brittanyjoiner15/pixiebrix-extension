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

import { castArray } from "lodash";
import { useCallback } from "react";
import { useHistory } from "react-router";
import { push } from "connected-react-router";
import { useDispatch } from "react-redux";
import { EditorValues } from "./Editor";
import { BrickValidationResult, validateSchema } from "./validate";
import useRefresh from "@/hooks/useRefresh";
import { reactivate } from "@/background/navigation";
import { Definition, RecipeDefinition } from "@/types/definitions";
import useReinstall from "@/pages/marketplace/useReinstall";
import useNotifications from "@/hooks/useNotifications";
import { getLinkedApiClient } from "@/services/apiClient";
import { getErrorMessage, isAxiosError } from "@/errors";
import { UUID } from "@/core";
import { clearServiceCache } from "@/background/requests";
import { loadBrickYaml } from "@/runtime/brickYaml";

type SubmitOptions = {
  create: boolean;
  url: string;
};

type SubmitCallbacks = {
  validate: (values: EditorValues) => Promise<BrickValidationResult>;
  remove: () => Promise<void>;
  submit: (
    values: EditorValues,
    helpers: { setErrors: (errors: unknown) => void }
  ) => Promise<void>;
};

function useSubmitBrick({
  create = false,
  url,
}: SubmitOptions): SubmitCallbacks {
  const [, refresh] = useRefresh({ refreshOnMount: false });
  const reinstall = useReinstall();
  const history = useHistory();
  const notify = useNotifications();
  const dispatch = useDispatch();

  const validate = useCallback(
    async (values: EditorValues) => validateSchema(values.config),
    []
  );

  const remove = useCallback(async () => {
    try {
      await (await getLinkedApiClient()).delete(url);
    } catch (error: unknown) {
      notify.error("Error deleting brick", {
        error,
      });
      return;
    }

    notify.success("Deleted brick", {
      event: "BrickDelete",
    });

    dispatch(push("/workshop"));
  }, [notify, url, dispatch]);

  const submit = useCallback(
    async (values, { setErrors, resetForm }) => {
      const { config, reactivate: reinstallBlueprint } = values;

      const json = loadBrickYaml(config) as Definition | RecipeDefinition;
      const { kind, metadata } = json;

      try {
        const client = await getLinkedApiClient();
        const { data } = await client[create ? "post" : "put"]<{ id: UUID }>(
          url,
          {
            ...values,
            kind,
          }
        );

        // We attach the handler below, and don't want it to block the save
        let refreshPromise: Promise<void>;
        if (kind === "recipe" && reinstallBlueprint) {
          refreshPromise = reinstall(json as RecipeDefinition);
        } else if (kind === "service") {
          // Fetch the remote definitions, then clear the background page's service cache so it's forced to read the
          // updated service definition.
          refreshPromise = refresh().then(async () => clearServiceCache());
        } else {
          refreshPromise = refresh();
        }

        notify.success(`${create ? "Created" : "Updated"} ${metadata.name}`);

        refreshPromise
          .then(async () => reactivate())
          .catch((error: unknown) => {
            notify.warning(
              `Error re-activating bricks: ${getErrorMessage(error)}`,
              {
                error,
              }
            );
          });

        // Reset initial values of the form so dirty=false
        resetForm({ values });

        if (create) {
          history.push(`/workshop/bricks/${data.id}/`);
        }
      } catch (error: unknown) {
        console.debug("Got validation error", error);

        if (isAxiosError(error)) {
          for (const message of castArray(error.response.data.__all__ ?? [])) {
            notify.error(message);
          }

          setErrors(error.response.data);
        } else {
          notify.error(error);
        }
      }
    },
    [history, refresh, reinstall, url, create, notify]
  );

  return { submit, validate, remove: create ? null : remove };
}

export default useSubmitBrick;
