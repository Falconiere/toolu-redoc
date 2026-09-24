/** Structured OpenAPI load failure for paste and URL paths. */

import type { OpenApiParseErrorCode } from "./openapi-parse-error";

/** Machine-stable load failure codes (parse codes plus URL-fetch failures). */
export type SpecLoadErrorCode =
  | OpenApiParseErrorCode
  | "disallowed_url"
  | "http_status"
  | "network"
  | "timeout"
  | "cancelled"
  | "oversize"
  | "html_body";

/** Suggested UI recovery action for a load failure. */
export type SpecLoadRecovery = "paste" | "retry";

/** User-facing load error — safe to show; never claims "CORS confirmed". */
export type SpecLoadError = {
  code: SpecLoadErrorCode;
  message: string;
  httpStatus?: number;
  recovery?: SpecLoadRecovery;
  path?: string;
};

/** Build a structured {@link SpecLoadError}. */
export function specLoadError(
  code: SpecLoadErrorCode,
  message: string,
  extras?: {
    httpStatus?: number;
    recovery?: SpecLoadRecovery;
    path?: string;
  },
): SpecLoadError {
  return {
    code,
    message,
    ...(extras?.httpStatus === undefined ? {} : { httpStatus: extras.httpStatus }),
    ...(extras?.recovery === undefined ? {} : { recovery: extras.recovery }),
    ...(extras?.path === undefined ? {} : { path: extras.path }),
  };
}
