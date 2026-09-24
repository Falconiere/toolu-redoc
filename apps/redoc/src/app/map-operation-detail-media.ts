/** Schema summary + media example unwrap helpers for mapOperationDetail. */
import type {
  OperationMediaModel,
  OperationNamedExample,
  SchemaFocus,
} from "@/domains/docs/api/operation-detail-model";

/** Media Type Object fields used by the mapper. */
export type MediaTypeFields = {
  schema?: unknown;
  example?: unknown;
  examples?: Record<string, unknown>;
};

/** True for non-null plain objects (not arrays). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** True when value is an OAS Reference Object (`$ref` string present). */
export function hasRef(value: unknown): value is { $ref: string } {
  return isRecord(value) && typeof value.$ref === "string";
}

/** Summarize a schema / reference into typeSummary + optional ref pointer. */
export function summarizeSchema(schema: unknown): { typeSummary: string; ref: string | null } {
  if (schema === true) {
    return { typeSummary: "true", ref: null };
  }
  if (schema === false) {
    return { typeSummary: "false", ref: null };
  }
  if (!isRecord(schema)) {
    return { typeSummary: "—", ref: null };
  }
  const ref = typeof schema.$ref === "string" ? schema.$ref : null;
  if (typeof schema.type === "string") {
    return { typeSummary: schema.type, ref };
  }
  if (Array.isArray(schema.type) && schema.type.every((entry) => typeof entry === "string")) {
    return { typeSummary: schema.type.join(", "), ref };
  }
  if (ref !== null) {
    return { typeSummary: `$ref ${ref}`, ref };
  }
  if (Object.hasOwn(schema, "allOf")) {
    return { typeSummary: "allOf", ref: null };
  }
  if (Object.hasOwn(schema, "oneOf")) {
    return { typeSummary: "oneOf", ref: null };
  }
  if (Object.hasOwn(schema, "anyOf")) {
    return { typeSummary: "anyOf", ref: null };
  }
  return { typeSummary: "—", ref: null };
}

/** Pull MediaTypeFields from an unknown media-type object. */
export function mediaFieldsFromUnknown(media: unknown): MediaTypeFields | null {
  if (!isRecord(media)) {
    return null;
  }
  const fields: MediaTypeFields = {};
  if ("schema" in media) {
    fields.schema = media.schema;
  }
  if (Object.hasOwn(media, "example")) {
    fields.example = media.example;
  }
  if (isRecord(media.examples)) {
    fields.examples = media.examples;
  }
  return fields;
}

/** Build a media-type map from an unknown content record. */
export function mediaContentFromUnknown(
  content: unknown,
): Record<string, MediaTypeFields> | undefined {
  if (!isRecord(content)) {
    return undefined;
  }
  const contents: Record<string, MediaTypeFields> = {};
  for (const [mediaType, media] of Object.entries(content)) {
    const fields = mediaFieldsFromUnknown(media);
    if (fields === null) {
      continue;
    }
    contents[mediaType] = fields;
  }
  return contents;
}

/** Unwrap one named media example entry per spec rules. */
function unwrapNamedExample(key: string, entry: unknown): OperationNamedExample {
  if (isRecord(entry)) {
    const named: OperationNamedExample = {
      key,
      summary: typeof entry.summary === "string" ? entry.summary : null,
      externalValue: typeof entry.externalValue === "string" ? entry.externalValue : null,
    };
    if (Object.hasOwn(entry, "value")) {
      named.value = entry.value;
    }
    return named;
  }
  return { key, summary: null, value: entry, externalValue: null };
}

/** Build request or response SchemaFocus for a media type + example selection. */
function mediaSchemaHandle(
  mediaType: string,
  typeSummary: string,
  ref: string | null,
  focusBase: { kind: "request" } | { kind: "response"; status: string; headerName: string | null },
  exampleKey: string | null,
  exampleValue: unknown,
  externalValue: string | null,
  includeExampleValue: boolean,
): SchemaFocus {
  if (focusBase.kind === "request") {
    const handle: Extract<SchemaFocus, { kind: "request" }> = {
      kind: "request",
      mediaType,
      typeSummary,
      ref,
      exampleKey,
      externalValue,
    };
    if (includeExampleValue) {
      handle.exampleValue = exampleValue;
    }
    return handle;
  }
  const handle: Extract<SchemaFocus, { kind: "response" }> = {
    kind: "response",
    status: focusBase.status,
    mediaType,
    headerName: focusBase.headerName,
    typeSummary,
    ref,
    exampleKey,
    externalValue,
  };
  if (includeExampleValue) {
    handle.exampleValue = exampleValue;
  }
  return handle;
}

/** Build OperationMediaModel from a Media Type Object + request/response focus kind. */
export function mapMedia(
  mediaType: string,
  media: MediaTypeFields,
  focusBase: { kind: "request" } | { kind: "response"; status: string; headerName: string | null },
): OperationMediaModel {
  const { typeSummary, ref } = summarizeSchema(media.schema);
  const singularPresent = Object.hasOwn(media, "example");
  const singularExample = {
    present: singularPresent,
    value: singularPresent ? media.example : undefined,
  };
  const namedExamples: OperationNamedExample[] = [];
  if (media.examples !== undefined) {
    for (const [key, entry] of Object.entries(media.examples)) {
      namedExamples.push(unwrapNamedExample(key, entry));
    }
  }
  const defaultExampleKey = singularPresent ? null : (namedExamples[0]?.key ?? null);
  const exampleKey = singularPresent ? null : defaultExampleKey;
  const named = namedExamples.find((item) => item.key === exampleKey);
  const includeExampleValue =
    singularPresent || (named !== undefined && Object.hasOwn(named, "value"));
  const exampleValue = singularPresent ? singularExample.value : named?.value;
  const externalValue = singularPresent ? null : (named?.externalValue ?? null);
  return {
    typeSummary,
    schemaHandle: mediaSchemaHandle(
      mediaType,
      typeSummary,
      ref,
      focusBase,
      exampleKey,
      exampleValue ?? null,
      externalValue,
      includeExampleValue,
    ),
    defaultExampleKey,
    singularExample,
    namedExamples,
  };
}
