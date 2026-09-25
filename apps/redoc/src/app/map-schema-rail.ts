/** Map SchemaFocus + operation into a Samples SchemaRailModel. */
import { isSchemaRecord, mapSchemaNode } from "@/app/map-schema-node";
import type { SchemaFocus } from "@/domains/docs/api/operation-detail-model";
import type {
  SchemaRailExample,
  SchemaRailModel,
  SchemaRailNotice,
} from "@/domains/docs/api/schema-rail-model";
import type {
  NormalizedOpenApiDocument,
  NormalizedOpenApiOperation,
} from "@/domains/openapi/api/normalize-openapi-document";
import { resolveLocalRef } from "@/domains/openapi/api/resolve-local-ref";

/**
 * Build a Samples rail model for the current focus, or null when unfocused.
 * Rewalks the selected operation; never embeds schema graphs on the focus handle.
 */
export function mapSchemaRail(
  document: NormalizedOpenApiDocument,
  operation: NormalizedOpenApiOperation | null,
  focus: SchemaFocus | null,
): SchemaRailModel | null {
  if (focus === null || operation === null) {
    return null;
  }
  const notices: SchemaRailNotice[] = [];
  const located = locateSchema(document, operation, focus, notices);
  const root =
    located === undefined ? null : mapSchemaNode(document, located, 0, new Set(), notices);
  return {
    heading: headingFor(focus),
    notices,
    root,
    example: exampleFor(focus, located),
  };
}

/** Human heading matching focus kind + keys. */
function headingFor(focus: SchemaFocus): string {
  if (focus.kind === "parameter") {
    return `Parameter · ${focus.name} (${focus.in})`;
  }
  if (focus.kind === "request") {
    return `Request · ${focus.mediaType}`;
  }
  if (focus.headerName !== null) {
    return `Response ${focus.status} · header ${focus.headerName}`;
  }
  if (focus.mediaType === null) {
    return `Response ${focus.status}`;
  }
  return `Response ${focus.status} · ${focus.mediaType}`;
}

/** Media-over-schema example panel rules (T19). */
function exampleFor(focus: SchemaFocus, schema: unknown): SchemaRailExample {
  if (focus.kind === "request" || focus.kind === "response") {
    if ("exampleValue" in focus) {
      return {
        kind: "value",
        value: focus.exampleValue,
        source: "media",
        name: focus.exampleKey,
      };
    }
    if (focus.externalValue !== null) {
      return { kind: "external", url: focus.externalValue, name: focus.exampleKey };
    }
  }
  return schemaExample(schema);
}

/** Schema-level example when media examples are absent. */
function schemaExample(schema: unknown): SchemaRailExample {
  if (!isSchemaRecord(schema)) {
    return { kind: "empty" };
  }
  if (Object.hasOwn(schema, "example")) {
    return { kind: "value", value: schema.example, source: "schema", name: null };
  }
  if (isSchemaRecord(schema.examples)) {
    const firstKey = Object.keys(schema.examples)[0];
    if (firstKey === undefined) {
      return { kind: "empty" };
    }
    const entry = schema.examples[firstKey];
    if (isSchemaRecord(entry) && Object.hasOwn(entry, "value")) {
      return { kind: "value", value: entry.value, source: "schema", name: firstKey };
    }
    if (isSchemaRecord(entry) && typeof entry.externalValue === "string") {
      return { kind: "external", url: entry.externalValue, name: firstKey };
    }
    if (!isSchemaRecord(entry)) {
      return { kind: "value", value: entry, source: "schema", name: firstKey };
    }
  }
  return { kind: "empty" };
}

/** Locate the authored schema for a focus handle; undefined when bodyless. */
function locateSchema(
  document: NormalizedOpenApiDocument,
  operation: NormalizedOpenApiOperation,
  focus: SchemaFocus,
  notices: SchemaRailNotice[],
): unknown {
  if (focus.kind === "parameter") {
    return locateParameterSchema(document, operation, focus, notices);
  }
  if (focus.kind === "request") {
    return locateRequestSchema(document, operation, focus.mediaType, notices);
  }
  if (focus.headerName !== null) {
    return locateHeaderSchema(document, operation, focus, notices);
  }
  if (focus.mediaType === null) {
    return undefined;
  }
  return locateResponseSchema(document, operation, focus.status, focus.mediaType, notices);
}

/** Parameter schema by (name,in), resolving parameter `$ref` when needed. */
function locateParameterSchema(
  document: NormalizedOpenApiDocument,
  operation: NormalizedOpenApiOperation,
  focus: Extract<SchemaFocus, { kind: "parameter" }>,
  notices: SchemaRailNotice[],
): unknown {
  for (const parameter of operation.parameters) {
    if (isSchemaRecord(parameter) && typeof parameter.$ref === "string") {
      if (focus.in === "$ref" && (focus.ref === parameter.$ref || focus.name === parameter.$ref)) {
        const resolved = resolveLocalRef(document, parameter.$ref, {
          expectedKind: "parameter",
        });
        notices.push(
          ...resolved.notices.map((notice) => ({
            code: notice.code,
            message: notice.message,
          })),
        );
        return schemaFromParameterObject(resolved.value);
      }
      continue;
    }
    if (isSchemaRecord(parameter) && parameter.name === focus.name && parameter.in === focus.in) {
      return schemaFromParameterObject(parameter);
    }
  }
  return undefined;
}

/** Prefer `.schema`, else first content media schema. */
function schemaFromParameterObject(parameter: unknown): unknown {
  if (!isSchemaRecord(parameter)) {
    return undefined;
  }
  if (Object.hasOwn(parameter, "schema")) {
    return parameter.schema;
  }
  if (isSchemaRecord(parameter.content)) {
    const first = Object.values(parameter.content)[0];
    if (isSchemaRecord(first) && Object.hasOwn(first, "schema")) {
      return first.schema;
    }
  }
  return undefined;
}

/** Request body media schema. */
function locateRequestSchema(
  document: NormalizedOpenApiDocument,
  operation: NormalizedOpenApiOperation,
  mediaType: string,
  notices: SchemaRailNotice[],
): unknown {
  const body = resolveMaybeRef(document, operation.requestBody, "requestBody", notices);
  if (!isSchemaRecord(body) || !isSchemaRecord(body.content)) {
    return undefined;
  }
  const media = body.content[mediaType];
  if (!isSchemaRecord(media)) {
    return undefined;
  }
  return media.schema;
}

/** Response media schema. */
function locateResponseSchema(
  document: NormalizedOpenApiDocument,
  operation: NormalizedOpenApiOperation,
  status: string,
  mediaType: string,
  notices: SchemaRailNotice[],
): unknown {
  const response = resolveMaybeRef(document, operation.responses[status], "response", notices);
  if (!isSchemaRecord(response) || !isSchemaRecord(response.content)) {
    return undefined;
  }
  const media = response.content[mediaType];
  if (!isSchemaRecord(media)) {
    return undefined;
  }
  return media.schema;
}

/** Response header schema. */
function locateHeaderSchema(
  document: NormalizedOpenApiDocument,
  operation: NormalizedOpenApiOperation,
  focus: Extract<SchemaFocus, { kind: "response" }>,
  notices: SchemaRailNotice[],
): unknown {
  const response = resolveMaybeRef(
    document,
    operation.responses[focus.status],
    "response",
    notices,
  );
  if (!isSchemaRecord(response) || !isSchemaRecord(response.headers) || focus.headerName === null) {
    return undefined;
  }
  const header = resolveMaybeRef(document, response.headers[focus.headerName], "header", notices);
  if (!isSchemaRecord(header)) {
    return undefined;
  }
  return header.schema;
}

/** Resolve a value that may be a `$ref` object for the given kind. */
function resolveMaybeRef(
  document: NormalizedOpenApiDocument,
  value: unknown,
  expectedKind: "parameter" | "requestBody" | "response" | "header",
  notices: SchemaRailNotice[],
): unknown {
  if (!isSchemaRecord(value) || typeof value.$ref !== "string") {
    return value;
  }
  const resolved = resolveLocalRef(document, value.$ref, { expectedKind });
  notices.push(
    ...resolved.notices.map((notice) => ({
      code: notice.code,
      message: notice.message,
    })),
  );
  return resolved.value;
}
