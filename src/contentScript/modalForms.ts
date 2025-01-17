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

import { FormDefinition } from "@/blocks/transformers/modalForm/formTypes";
import { UUID } from "@/core";
import { expectContext } from "@/utils/expectContext";
import { CancelError } from "@/errors";
import pDefer, { DeferredPromise } from "p-defer";

type RegisteredForm = {
  definition: FormDefinition;
  registration: DeferredPromise<unknown>;
};

const forms = new Map<UUID, RegisteredForm>();

/**
 * Register a form with the content script.
 * @param nonce the form nonce
 * @param definition the form definition
 */
export async function registerForm(
  nonce: UUID,
  definition: FormDefinition
): Promise<unknown> {
  expectContext("contentScript");

  const registration = pDefer();

  forms.set(nonce, {
    definition,
    registration,
  });

  return registration.promise;
}

function unregisterForm(nonce: UUID) {
  forms.delete(nonce);
}

export async function getFormDefinition(nonce: UUID): Promise<FormDefinition> {
  return forms.get(nonce).definition;
}

export async function resolveForm(nonce: UUID, values: unknown): Promise<void> {
  forms.get(nonce).registration.resolve(values);
  unregisterForm(nonce);
}

export async function cancelForm(nonce: UUID) {
  forms
    .get(nonce)
    .registration.reject(new CancelError("User cancelled the action"));
  unregisterForm(nonce);
}
