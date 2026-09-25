/** Map an OpenAPI schema value into a plain SchemaNode tree. */
import { isSchemaRecord, mapObjectSchemaFields } from "@/app/map-schema-object-fields";
import type { SchemaNode, SchemaRailNotice } from "@/domains/docs/api/schema-rail-model";
import type { NormalizedOpenApiDocument } from "@/domains/openapi/api/normalize-openapi-document";
import { MAX_SCHEMA_DEPTH } from "@/domains/openapi/api/openapi-limits";
import { resolveLocalRef, type UnresolvedRef } from "@/domains/openapi/api/resolve-local-ref";

export { isSchemaRecord };

/** True when value is an OAS Reference Object. */
function isRefObject(value: unknown): value is { $ref: string } {
  return isSchemaRecord(value) && typeof value.$ref === "string";
}

/** True when value is an UnresolvedRef boundary from resolveLocalRef. */
function isUnresolved(value: unknown): value is UnresolvedRef {
  return (
    isSchemaRecord(value) &&
    value.unresolved === true &&
    typeof value.$ref === "string" &&
    typeof value.reason === "string"
  );
}

/** Map resolveLocalRef notices into rail notices. */
function toRailNotices(notices: { code: string; message: string }[]): SchemaRailNotice[] {
  return notices.map((notice) => ({ code: notice.code, message: notice.message }));
}

/** Build a boundary SchemaNode from an UnresolvedRef. */
function boundaryNode(marker: UnresolvedRef, message: string): SchemaNode {
  return {
    kind: "boundary",
    $ref: marker.$ref,
    reason: marker.reason,
    message,
  };
}

/** Default message for an unresolved reason. */
function messageForReason(reason: UnresolvedRef["reason"]): string {
  if (reason === "external") {
    return "External $ref URIs are not fetched.";
  }
  if (reason === "dangling") {
    return "Local $ref target was not found in the document.";
  }
  if (reason === "cycle") {
    return "Local $ref cycle stopped at a visible boundary.";
  }
  if (reason === "depth") {
    return `Local $ref expansion exceeded depth ${MAX_SCHEMA_DEPTH}.`;
  }
  return "Local $ref does not point at a schema component.";
}

/**
 * Expand a schema value (inline or `$ref`) into a SchemaNode.
 * Collects resolve notices into `noticesOut`.
 */
export function mapSchemaNode(
  document: NormalizedOpenApiDocument,
  schema: unknown,
  depth: number,
  stack: ReadonlySet<string>,
  noticesOut: SchemaRailNotice[],
  viaRef: string | null = null,
): SchemaNode {
  if (schema === true || schema === false) {
    return { kind: "boolean", value: schema, description: null };
  }
  if (isUnresolved(schema)) {
    return boundaryNode(schema, messageForReason(schema.reason));
  }
  if (isRefObject(schema)) {
    return expandRef(document, schema.$ref, depth, stack, noticesOut);
  }
  if (!isSchemaRecord(schema)) {
    return emptySchemaNode(viaRef);
  }
  if (depth > MAX_SCHEMA_DEPTH) {
    return {
      kind: "boundary",
      $ref: viaRef ?? "(inline)",
      reason: "depth",
      message: `Local $ref expansion exceeded depth ${MAX_SCHEMA_DEPTH}.`,
    };
  }
  return mapObjectSchemaFields(document, schema, depth, stack, noticesOut, viaRef, mapSchemaNode);
}

/** Empty schema shell when the value is not an object. */
function emptySchemaNode(viaRef: string | null): SchemaNode {
  return {
    kind: "schema",
    viaRef,
    typeLabel: "—",
    format: null,
    description: null,
    nullable30: false,
    nullInType: false,
    requiredNames: [],
    enumValues: null,
    defaultPresent: false,
    defaultValue: undefined,
    readOnly: false,
    writeOnly: false,
    properties: [],
    additionalProperties: null,
    items: null,
    composition: null,
    discriminator: null,
    unsupportedKeywords: [],
    constraints: [],
  };
}

/** Resolve a `$ref` string and map the target. */
function expandRef(
  document: NormalizedOpenApiDocument,
  pointer: string,
  depth: number,
  stack: ReadonlySet<string>,
  noticesOut: SchemaRailNotice[],
): SchemaNode {
  if (stack.has(pointer)) {
    return {
      kind: "boundary",
      $ref: pointer,
      reason: "cycle",
      message: "Local $ref cycle stopped at a visible boundary.",
    };
  }
  const resolved = resolveLocalRef(document, pointer, {
    expectedKind: "schema",
    depth,
  });
  noticesOut.push(...toRailNotices(resolved.notices));
  if (isUnresolved(resolved.value)) {
    const message = resolved.notices[0]?.message ?? messageForReason(resolved.value.reason);
    return boundaryNode(resolved.value, message);
  }
  const nextStack = new Set(stack);
  nextStack.add(pointer);
  return mapSchemaNode(document, resolved.value, depth + 1, nextStack, noticesOut, pointer);
}
