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

import React, { useMemo } from "react";
import { AxiosError, AxiosRequestConfig } from "axios";
import { useAsyncState } from "@/hooks/common";
import browser from "webextension-polyfill";
import { Col, Row } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import JsonTree from "@/components/jsonTree/JsonTree";
import urljoin from "url-join";
import { getReasonPhrase } from "http-status-codes";
import { isAbsoluteUrl } from "@/utils";

function getAbsoluteUrl({ url, baseURL }: AxiosRequestConfig): string {
  return isAbsoluteUrl(url) ? url : urljoin(baseURL, url);
}

function tryParse(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      // If payload is JSON, parse it for easier reading
      return JSON.parse(value);
    } catch {
      // NOP
    }
  }

  return value;
}

function getHumanReadableStatus(code: string | number): string {
  try {
    return getReasonPhrase(code);
  } catch {
    return "Unknown error code";
  }
}

const NetworkErrorDetail: React.FunctionComponent<{ error: AxiosError }> = ({
  error,
}) => {
  const absoluteUrl = useMemo(() => getAbsoluteUrl(error.config), [
    error.config,
  ]);

  const [hasPermissions, permissionsPending, permissionsError] = useAsyncState<
    boolean | undefined
  >(async () => {
    if (browser.permissions?.contains) {
      return browser.permissions.contains({
        origins: [absoluteUrl],
      });
    }
  }, [absoluteUrl]);

  const cleanConfig = useMemo(() => {
    const { data, ...rest } = error.config;
    return {
      ...rest,
      data: tryParse(data),
    };
  }, [error.config]);

  const cleanResponse = useMemo(() => {
    if (error.response) {
      const { request, config, data, ...rest } = error.response;
      // Don't include request, since we're showing it the other column
      return {
        ...rest,
        data: tryParse(data),
      };
    }
  }, [error.response]);

  const status = error.response?.status;
  const permissionsReady = !permissionsError && !permissionsPending;

  return (
    <Row>
      <Col>
        <span>Response</span>
        {permissionsReady && !hasPermissions && (
          <div className="text-warning">
            <FontAwesomeIcon icon={faExclamationTriangle} /> PixieBrix does not
            have permission to access {absoluteUrl}
          </div>
        )}
        {permissionsReady && hasPermissions && (
          <div className="text-info">
            <FontAwesomeIcon icon={faCheck} /> PixieBrix has permission to
            access {absoluteUrl}
          </div>
        )}
        {status && (
          <div>
            Status: {status} &mdash; {getHumanReadableStatus(status)}
          </div>
        )}
        {cleanResponse == null ? (
          <div>
            <div>PixieBrix did not receive a response. Possible causes:</div>
            <ul>
              <li>
                Your browser or another extension blocked the request. Check
                that PixieBrix has permission to the access the host. If
                PixieBrix is not showing a Grant Permissions button, ensure that
                the integration has an{" "}
                <code className="px-0 mx-0">isAvailable</code> section defined
              </li>
              <li>The remote server did not respond. Try the request again</li>
            </ul>
          </div>
        ) : (
          <JsonTree data={cleanResponse} />
        )}
      </Col>
      <Col>
        <span>Request Config</span>
        <JsonTree data={cleanConfig} />
      </Col>
    </Row>
  );
};

export default NetworkErrorDetail;
