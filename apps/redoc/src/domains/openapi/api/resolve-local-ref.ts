/** Same-document JSON Pointer `$ref` expansion with depth and cycle guards. */
import { MAX_SCHEMA_DEPTH } from "./openapi-limits";
import type { OpenApiNotice } from "./normalize-openapi-document";

/** Visible boundary node when a `$ref` cannot be fully expanded. */
export type UnresolvedRef = {
  unresolved: true;
  $ref: string;
  reason: "cycle" | "depth" | "dangling" | "external" | "wrong-kind";
};

/** Result of lazy local `$ref` resolution (never throws to UI). */
export type ResolveLocalRefResult = {
  value: unknown;
  notices: OpenApiNotice[];
};

/** Options for {@link resolveLocalRef}. */
export type ResolveLocalRefOptions = {
  depth?: number;
  /** When set, pointer must live under the matching components map. */
  expectedKind?: "schema" | "parameter" | "requestBody" | "response" | "header" | "example";
};

const KIND_PREFIX: Record<NonNullable<ResolveLocalRefOptions["expectedKind"]>, string> = {
  schema: "/components/schemas/",
  parameter: "/components/parameters/",
  requestBody: "/components/requestBodies/",
  response: "/components/responses/",
  header: "/components/headers/",
  example: "/components/examples/",
};

/**
 * Resolve a same-document JSON Pointer / `$ref` string against `doc`.
 * External URIs, cycles, depth > {@link MAX_SCHEMA_DEPTH}, dangling, and
 * wrong-kind targets become notices plus an {@link UnresolvedRef} value.
 */
export function resolveLocalRef(
  doc: unknown,
  pointer: string,
  options: ResolveLocalRefOptions = {},
): ResolveLocalRefResult {
  const notices: OpenApiNotice[] = [];
  const depth = options.depth ?? 0;
  if (isExternalRef(pointer)) {
    return externalResult(pointer, notices);
  }
  const path = normalizePointer(pointer);
  if (path === undefined) {
    return danglingResult(pointer, notices);
  }
  if (options.expectedKind !== undefined) {
    const wrong = wrongKindResult(pointer, path, options.expectedKind, notices);
    if (wrong !== undefined) {
      return wrong;
    }
  }
  return expandPointer(doc, pointer, path, depth, new Set<string>(), notices);
}

/** True when `$ref` is an absolute URI or non-document-relative pointer. */
export function isExternalRef(pointer: string): boolean {
  if (pointer.startsWith("#")) {
    return false;
  }
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(pointer);
}

/** Strip `#` and ensure a leading `/`; undefined when not a local pointer. */
function normalizePointer(pointer: string): string | undefined {
  if (pointer.startsWith("#")) {
    const rest = pointer.slice(1);
    if (rest.length === 0) {
      return "";
    }
    return rest.startsWith("/") ? rest : undefined;
  }
  if (pointer.startsWith("/")) {
    return pointer;
  }
  return undefined;
}

/** Decode one JSON Pointer token (`~1` → `/`, `~0` → `~`). */
export function decodePointerToken(token: string): string {
  return token.replaceAll("~1", "/").replaceAll("~0", "~");
}

/** Walk `doc` at `path`, following nested `$ref` until depth/cycle/missing. */
function expandPointer(
  doc: unknown,
  originalRef: string,
  path: string,
  depth: number,
  stack: Set<string>,
  notices: OpenApiNotice[],
): ResolveLocalRefResult {
  if (depth > MAX_SCHEMA_DEPTH) {
    return depthResult(originalRef, notices);
  }
  if (stack.has(path)) {
    return cycleResult(originalRef, path, notices);
  }
  stack.add(path);
  const target = readPointer(doc, path);
  if (target === undefined) {
    return danglingResult(originalRef, notices);
  }
  return followNestedRef(doc, originalRef, target, depth, stack, notices);
}

/** If `target` is a `$ref` object, expand it; otherwise return it. */
function followNestedRef(
  doc: unknown,
  originalRef: string,
  target: unknown,
  depth: number,
  stack: Set<string>,
  notices: OpenApiNotice[],
): ResolveLocalRefResult {
  if (!isRefObject(target)) {
    return { value: target, notices };
  }
  const nested = target.$ref;
  if (isExternalRef(nested)) {
    return externalResult(nested, notices);
  }
  const nestedPath = normalizePointer(nested);
  if (nestedPath === undefined) {
    return danglingResult(nested, notices);
  }
  return expandPointer(doc, originalRef, nestedPath, depth + 1, stack, notices);
}

/** Read a JSON Pointer path from `doc`; undefined when any segment is missing. */
export function readPointer(doc: unknown, path: string): unknown {
  if (path === "" || path === "/") {
    return doc;
  }
  const tokens = path.split("/").slice(1).map(decodePointerToken);
  let current: unknown = doc;
  for (const token of tokens) {
    if (!isIndexable(current) || !Object.hasOwn(current, token)) {
      return undefined;
    }
    current = current[token];
  }
  return current;
}

/** True when value can be indexed by object keys. */
function isIndexable(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

/** True when value is a plain `$ref` object with a string pointer. */
function isRefObject(value: unknown): value is { $ref: string } {
  return isIndexable(value) && Object.hasOwn(value, "$ref") && typeof value.$ref === "string";
}

/** External URI `$ref` — no network fetch. */
function externalResult(pointer: string, notices: OpenApiNotice[]): ResolveLocalRefResult {
  notices.push({
    code: "external-ref",
    message: "External $ref URIs are not fetched.",
    path: pointer,
  });
  return {
    value: unresolved(pointer, "external"),
    notices,
  };
}

/** Missing local pointer target. */
function danglingResult(pointer: string, notices: OpenApiNotice[]): ResolveLocalRefResult {
  notices.push({
    code: "dangling-ref",
    message: "Local $ref target was not found in the document.",
    path: pointer,
  });
  return { value: unresolved(pointer, "dangling"), notices };
}

/** Cycle detected while expanding local `$ref`s. */
function cycleResult(
  pointer: string,
  path: string,
  notices: OpenApiNotice[],
): ResolveLocalRefResult {
  notices.push({
    code: "ref-cycle",
    message: "Local $ref cycle stopped at a visible boundary.",
    path,
  });
  return { value: unresolved(pointer, "cycle"), notices };
}

/** Expansion exceeded {@link MAX_SCHEMA_DEPTH}. */
function depthResult(pointer: string, notices: OpenApiNotice[]): ResolveLocalRefResult {
  notices.push({
    code: "ref-depth",
    message: `Local $ref expansion exceeded depth ${MAX_SCHEMA_DEPTH}.`,
    path: pointer,
  });
  return { value: unresolved(pointer, "depth"), notices };
}

/** Pointer exists but does not match the expected components kind. */
function wrongKindResult(
  pointer: string,
  path: string,
  expectedKind: NonNullable<ResolveLocalRefOptions["expectedKind"]>,
  notices: OpenApiNotice[],
): ResolveLocalRefResult | undefined {
  const prefix = KIND_PREFIX[expectedKind];
  if (path === prefix.slice(0, -1) || path.startsWith(prefix)) {
    return undefined;
  }
  notices.push({
    code: "wrong-kind-ref",
    message: `Local $ref does not point at a ${expectedKind} component.`,
    path: pointer,
  });
  return { value: unresolved(pointer, "wrong-kind"), notices };
}

/** Build an {@link UnresolvedRef} marker node. */
function unresolved(pointer: string, reason: UnresolvedRef["reason"]): UnresolvedRef {
  return { unresolved: true, $ref: pointer, reason };
}
