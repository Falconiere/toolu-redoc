/** Decode paste text into a single JSON-compatible root value. */
import { parseAllDocuments, type Document } from "yaml";

import { MAX_ALIAS_COUNT, MAX_INPUT_BYTES } from "./openapi-limits";
import { openApiParseError, type OpenApiParseError } from "./openapi-parse-error";

/** Result of decoding OpenAPI source text before Zod validation. */
export type DecodeOpenApiTextResult =
  | { ok: true; value: unknown }
  | { ok: false; error: OpenApiParseError };

/**
 * UTF-8 size-gate and eemeli decode for JSON or YAML paste text.
 * Enforces one document, unique keys, and `MAX_ALIAS_COUNT`.
 */
export function decodeOpenApiText(input: string): DecodeOpenApiTextResult {
  if (input.trim().length === 0) {
    return {
      ok: false,
      error: openApiParseError("empty", "Paste an OpenAPI 3.0 or 3.1 document."),
    };
  }

  const byteLength = new TextEncoder().encode(input).byteLength;
  if (byteLength > MAX_INPUT_BYTES) {
    return {
      ok: false,
      error: openApiParseError(
        "oversize",
        `Document is ${byteLength} bytes; the limit is ${MAX_INPUT_BYTES} UTF-8 bytes.`,
      ),
    };
  }

  return decodeYamlDocuments(input);
}

/** Parse with eemeli and map document errors to structured codes. */
function decodeYamlDocuments(input: string): DecodeOpenApiTextResult {
  const parsed = parseYamlStream(input);
  if (!parsed.ok) {
    return parsed;
  }
  return selectSingleDocument(parsed.documents);
}

/** Run `parseAllDocuments` and catch synchronous throws. */
function parseYamlStream(
  input: string,
): { ok: true; documents: Document[] } | { ok: false; error: OpenApiParseError } {
  try {
    const documents = parseAllDocuments(input, {
      uniqueKeys: true,
      prettyErrors: true,
      strict: true,
      schema: "core",
      resolveKnownTags: false,
    });
    return { ok: true, documents };
  } catch (cause) {
    return {
      ok: false,
      error: openApiParseError("yaml", formatUnknownCause(cause)),
    };
  }
}

/** Require exactly one non-empty document, then materialize JS. */
function selectSingleDocument(documents: Document[]): DecodeOpenApiTextResult {
  const meaningful = documents.filter((document) => !documentIsEmpty(document));
  if (meaningful.length === 0) {
    return {
      ok: false,
      error: openApiParseError("empty", "Paste an OpenAPI 3.0 or 3.1 document."),
    };
  }
  if (meaningful.length > 1) {
    return {
      ok: false,
      error: openApiParseError(
        "multi_document",
        "Only one YAML or JSON document is allowed per paste.",
      ),
    };
  }

  const document = meaningful[0];
  if (document === undefined) {
    return {
      ok: false,
      error: openApiParseError("yaml", "Failed to parse the document."),
    };
  }

  const mapped = mapDocumentErrors(document.errors);
  if (mapped !== undefined) {
    return { ok: false, error: mapped };
  }

  return materializeDocumentJs(document);
}

/** Convert a YAML document to a JSON-compatible value with alias limits. */
function materializeDocumentJs(document: Document): DecodeOpenApiTextResult {
  const tagError = rejectUnsafeYamlTags(document);
  if (tagError !== undefined) {
    return { ok: false, error: tagError };
  }
  try {
    const value = readDocumentJs(document);
    const jsonError = rejectNonJsonValues(value);
    if (jsonError !== undefined) {
      return { ok: false, error: jsonError };
    }
    return { ok: true, value };
  } catch (cause) {
    const aliasError = mapThrownAlias(cause);
    if (aliasError !== undefined) {
      return { ok: false, error: aliasError };
    }
    return {
      ok: false,
      error: openApiParseError("yaml", formatUnknownCause(cause)),
    };
  }
}

/** Treat unresolved / non-core YAML tags as hard failures. */
function rejectUnsafeYamlTags(document: Document): OpenApiParseError | undefined {
  for (const warning of document.warnings) {
    const text = `${warning.code} ${warning.message}`.toLowerCase();
    if (text.includes("tag") || text.includes("unresolved")) {
      return openApiParseError("yaml", "Unsupported or unsafe YAML tags are not allowed.");
    }
  }
  return undefined;
}

/**
 * Reject binary / bigint / function values that are not JSON-compatible.
 * Walks only plain arrays and plain objects; cycles are skipped via WeakSet.
 */
function rejectNonJsonValues(value: unknown): OpenApiParseError | undefined {
  const seen = new WeakSet<object>();
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === null || current === undefined) {
      continue;
    }
    const type = typeof current;
    if (type === "string" || type === "boolean" || type === "number") {
      continue;
    }
    if (type === "bigint" || type === "function" || type === "symbol") {
      return openApiParseError("yaml", "Document contains non-JSON values.");
    }
    if (type !== "object") {
      continue;
    }
    if (isBinaryBufferLike(current)) {
      return openApiParseError("yaml", "Unsupported or unsafe YAML tags are not allowed.");
    }
    if (seen.has(current)) {
      continue;
    }
    seen.add(current);
    if (Array.isArray(current)) {
      for (let index = 0; index < current.length; index += 1) {
        stack.push(current[index]);
      }
      continue;
    }
    if (!isPlainJsonObject(current)) {
      return openApiParseError("yaml", "Document contains non-JSON values.");
    }
    for (const key of Object.keys(current)) {
      stack.push(current[key]);
    }
  }
  return undefined;
}

/** True for ArrayBuffer, Uint8Array, or a Node Buffer without naming the Buffer global. */
function isBinaryBufferLike(value: object): boolean {
  if (value instanceof ArrayBuffer || value instanceof Uint8Array) {
    return true;
  }
  return readConstructorName(value) === "Buffer";
}

/** Read `constructor.name` when present, without assuming a typed constructor. */
function readConstructorName(value: object): string | undefined {
  const ctor: unknown = Reflect.get(value, "constructor");
  if (typeof ctor !== "function") {
    return undefined;
  }
  const name: unknown = Reflect.get(ctor, "name");
  return typeof name === "string" ? name : undefined;
}

/** True for `{}`-style objects (including null-prototype maps). */
function isPlainJsonObject(value: object): value is Record<string, unknown> {
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** `toJS` is typed `any` by eemeli — annotate the boundary as `unknown`. */
function readDocumentJs(document: Document): unknown {
  const raw: unknown = document.toJS({ maxAliasCount: MAX_ALIAS_COUNT });
  return raw;
}

/** True when a YAML document has no contents worth validating. */
function documentIsEmpty(document: { contents: unknown; errors: readonly unknown[] }): boolean {
  return document.contents === null || document.contents === undefined;
}

/** Map eemeli parse errors onto stable OpenAPI parse codes. */
function mapDocumentErrors(
  errors: ReadonlyArray<{ code?: string; message: string }>,
): OpenApiParseError | undefined {
  if (errors.length === 0) {
    return undefined;
  }
  for (const error of errors) {
    const text = `${error.code ?? ""} ${error.message}`.toLowerCase();
    if (text.includes("unique") || text.includes("duplicate")) {
      return openApiParseError("yaml", "Duplicate mapping keys are not allowed.");
    }
    if (text.includes("alias") || text.includes("excessive")) {
      return openApiParseError(
        "alias_limit",
        `YAML alias expansion exceeds the limit of ${MAX_ALIAS_COUNT}.`,
      );
    }
    if (text.includes("tag") || text.includes("unresolved")) {
      return openApiParseError("yaml", "Unsupported or unsafe YAML tags are not allowed.");
    }
  }
  return openApiParseError("yaml", errors[0]?.message ?? "Invalid YAML or JSON.");
}

/** Detect alias-limit failures thrown from `toJS`. */
function mapThrownAlias(cause: unknown): OpenApiParseError | undefined {
  const message = formatUnknownCause(cause).toLowerCase();
  if (message.includes("alias") || message.includes("excessive")) {
    return openApiParseError(
      "alias_limit",
      `YAML alias expansion exceeds the limit of ${MAX_ALIAS_COUNT}.`,
    );
  }
  return undefined;
}

/** Stringify an unknown thrown value for a user-facing message. */
function formatUnknownCause(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }
  return "Invalid YAML or JSON.";
}
