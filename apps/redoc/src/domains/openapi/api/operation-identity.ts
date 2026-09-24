/** Reversible method+path operation identity (never keyed by operationId). */

/** The eight OAS Path Item HTTP verbs that become operations. */
export const OPENAPI_HTTP_METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
] as const;

/** One of the eight HTTP methods accepted as an operation. */
export type OpenApiHttpMethod = (typeof OPENAPI_HTTP_METHODS)[number];

/** Decoded method+path pair used as operation identity. */
export type OperationIdentity = {
  method: OpenApiHttpMethod;
  path: string;
};

/** True when value is one of the eight Path Item verbs. */
export function isOpenApiHttpMethod(value: string): value is OpenApiHttpMethod {
  return OPENAPI_HTTP_METHODS.some((method) => method === value);
}

/**
 * Encode method+path into a reversible identity key.
 * Uses JSON so spaces, tilde, Unicode, and braces cannot collide.
 */
export function encodeOperationIdentity(method: OpenApiHttpMethod, path: string): string {
  return JSON.stringify([method, path]);
}

/**
 * Decode an identity key produced by {@link encodeOperationIdentity}.
 * Throws when the key is not a valid JSON pair of method+path.
 */
export function decodeOperationIdentity(key: string): OperationIdentity {
  let parsed: unknown;
  try {
    parsed = parseJsonUnknown(key);
  } catch (cause) {
    throw new Error(`Invalid operation identity key: ${formatCause(cause)}`, {
      cause,
    });
  }
  return parseIdentityPair(parsed);
}

/** `JSON.parse` boundary — result typed as `unknown`. */
function parseJsonUnknown(text: string): unknown {
  return JSON.parse(text);
}

/** Validate a JSON-decoded [method, path] pair. */
function parseIdentityPair(parsed: unknown): OperationIdentity {
  if (!Array.isArray(parsed) || parsed.length !== 2) {
    throw new Error("Operation identity must be a [method, path] pair.");
  }
  const method: unknown = parsed[0];
  const path: unknown = parsed[1];
  if (typeof method !== "string" || !isOpenApiHttpMethod(method)) {
    throw new Error(`Unknown HTTP method in operation identity: ${String(method)}`);
  }
  if (typeof path !== "string") {
    throw new Error("Operation identity path must be a string.");
  }
  return { method, path };
}

/** Stringify an unknown thrown value for identity decode errors. */
function formatCause(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }
  return "invalid JSON";
}
