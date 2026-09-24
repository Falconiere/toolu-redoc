/** Structured OpenAPI parse/validation failure for UI consumption. */

/** Machine-stable parse failure codes (never a raw stack). */
export type OpenApiParseErrorCode =
  | "empty"
  | "oversize"
  | "json"
  | "yaml"
  | "version"
  | "schema"
  | "multi_document"
  | "alias_limit";

/** User-facing parse error — `message` is safe to show; no stack traces. */
export type OpenApiParseError = {
  code: OpenApiParseErrorCode;
  message: string;
  path?: string;
};

/** Build a structured parse error. */
export function openApiParseError(
  code: OpenApiParseErrorCode,
  message: string,
  path?: string,
): OpenApiParseError {
  return path === undefined ? { code, message } : { code, message, path };
}
