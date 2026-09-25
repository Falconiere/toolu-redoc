/** Object-schema field mapping helpers for mapSchemaNode. */
import type {
  SchemaComposition,
  SchemaNode,
  SchemaPropertyRow,
  SchemaRailNotice,
} from "@/domains/docs/api/schema-rail-model";
import type { NormalizedOpenApiDocument } from "@/domains/openapi/api/normalize-openapi-document";

/** Keywords rendered as first-class rail fields (not "unsupported"). */
const KNOWN_KEYWORDS = new Set([
  "$ref",
  "type",
  "format",
  "description",
  "properties",
  "required",
  "items",
  "enum",
  "default",
  "nullable",
  "readOnly",
  "writeOnly",
  "additionalProperties",
  "allOf",
  "oneOf",
  "anyOf",
  "discriminator",
  "example",
  "examples",
  "title",
  "minItems",
  "maxItems",
  "uniqueItems",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "minProperties",
  "maxProperties",
  "pattern",
  "multipleOf",
]);

const CONSTRAINT_KEYS = [
  "minItems",
  "maxItems",
  "uniqueItems",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "minProperties",
  "maxProperties",
  "pattern",
  "multipleOf",
] as const;

/** Child mapper callback (avoids circular imports with map-schema-node). */
export type MapSchemaChild = (
  document: NormalizedOpenApiDocument,
  schema: unknown,
  depth: number,
  stack: ReadonlySet<string>,
  noticesOut: SchemaRailNotice[],
  viaRef?: string | null,
) => SchemaNode;

/** True for non-null plain objects (not arrays). */
export function isSchemaRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Map a plain schema object into a `kind: "schema"` node. */
export function mapObjectSchemaFields(
  document: NormalizedOpenApiDocument,
  schema: Record<string, unknown>,
  depth: number,
  stack: ReadonlySet<string>,
  noticesOut: SchemaRailNotice[],
  viaRef: string | null,
  mapChild: MapSchemaChild,
): Extract<SchemaNode, { kind: "schema" }> {
  const childDepth = depth + 1;
  return {
    kind: "schema",
    viaRef,
    typeLabel: typeLabelOf(schema),
    format: typeof schema.format === "string" ? schema.format : null,
    description: typeof schema.description === "string" ? schema.description : null,
    nullable30: schema.nullable === true,
    nullInType: typeIncludesNull(schema.type),
    requiredNames: stringArray(schema.required),
    enumValues: Array.isArray(schema.enum) ? schema.enum : null,
    defaultPresent: Object.hasOwn(schema, "default"),
    defaultValue: schema.default,
    readOnly: schema.readOnly === true,
    writeOnly: schema.writeOnly === true,
    properties: mapProperties(document, schema, childDepth, stack, noticesOut, mapChild),
    additionalProperties: mapAdditional(document, schema, childDepth, stack, noticesOut, mapChild),
    items: Object.hasOwn(schema, "items")
      ? mapChild(document, schema.items, childDepth, stack, noticesOut)
      : null,
    composition: mapComposition(document, schema, childDepth, stack, noticesOut, mapChild),
    discriminator: mapDiscriminator(schema),
    unsupportedKeywords: unsupportedOf(schema),
    constraints: constraintsOf(schema),
  };
}

/** Map `properties` into ordered rows. */
function mapProperties(
  document: NormalizedOpenApiDocument,
  schema: Record<string, unknown>,
  depth: number,
  stack: ReadonlySet<string>,
  noticesOut: SchemaRailNotice[],
  mapChild: MapSchemaChild,
): SchemaPropertyRow[] {
  if (!isSchemaRecord(schema.properties)) {
    return [];
  }
  const required = new Set(stringArray(schema.required));
  const rows: SchemaPropertyRow[] = [];
  for (const [name, value] of Object.entries(schema.properties)) {
    rows.push({
      name,
      required: required.has(name),
      node: mapChild(document, value, depth, stack, noticesOut),
    });
  }
  return rows;
}

/** Map additionalProperties: true | false | schema. */
function mapAdditional(
  document: NormalizedOpenApiDocument,
  schema: Record<string, unknown>,
  depth: number,
  stack: ReadonlySet<string>,
  noticesOut: SchemaRailNotice[],
  mapChild: MapSchemaChild,
): "allowed" | "forbidden" | SchemaNode | null {
  if (!Object.hasOwn(schema, "additionalProperties")) {
    return null;
  }
  const value = schema.additionalProperties;
  if (value === true) {
    return "allowed";
  }
  if (value === false) {
    return "forbidden";
  }
  return mapChild(document, value, depth, stack, noticesOut);
}

/** Map the first present composition keyword. */
function mapComposition(
  document: NormalizedOpenApiDocument,
  schema: Record<string, unknown>,
  depth: number,
  stack: ReadonlySet<string>,
  noticesOut: SchemaRailNotice[],
  mapChild: MapSchemaChild,
): SchemaComposition | null {
  for (const keyword of ["allOf", "oneOf", "anyOf"] as const) {
    const branches = schema[keyword];
    if (!Array.isArray(branches)) {
      continue;
    }
    return {
      keyword,
      branches: branches.map((branch) => mapChild(document, branch, depth, stack, noticesOut)),
    };
  }
  return null;
}

/** Map discriminator metadata when present. */
function mapDiscriminator(
  schema: Record<string, unknown>,
): Extract<SchemaNode, { kind: "schema" }>["discriminator"] {
  if (!isSchemaRecord(schema.discriminator)) {
    return null;
  }
  const propertyName =
    typeof schema.discriminator.propertyName === "string"
      ? schema.discriminator.propertyName
      : null;
  if (propertyName === null) {
    return null;
  }
  const mapping: { name: string; $ref: string }[] = [];
  if (isSchemaRecord(schema.discriminator.mapping)) {
    for (const [name, ref] of Object.entries(schema.discriminator.mapping)) {
      if (typeof ref === "string") {
        mapping.push({ name, $ref: ref });
      }
    }
  }
  return { propertyName, mapping };
}

/** Human type label from authored `type`. */
function typeLabelOf(schema: Record<string, unknown>): string {
  if (typeof schema.type === "string") {
    return schema.type;
  }
  if (Array.isArray(schema.type) && schema.type.every((entry) => typeof entry === "string")) {
    return schema.type.join(", ");
  }
  if (Object.hasOwn(schema, "allOf")) {
    return "allOf";
  }
  if (Object.hasOwn(schema, "oneOf")) {
    return "oneOf";
  }
  if (Object.hasOwn(schema, "anyOf")) {
    return "anyOf";
  }
  return "—";
}

/** True when 3.1 type array includes null. */
function typeIncludesNull(type: unknown): boolean {
  return Array.isArray(type) && type.includes("null");
}

/** Coerce unknown to string[]. */
function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

/** Constraint rows as authored string values. */
function constraintsOf(schema: Record<string, unknown>): { name: string; value: string }[] {
  const rows: { name: string; value: string }[] = [];
  for (const key of CONSTRAINT_KEYS) {
    if (!Object.hasOwn(schema, key)) {
      continue;
    }
    rows.push({ name: key, value: JSON.stringify(schema[key]) });
  }
  return rows;
}

/** Keyword names present but not first-class in the rail. */
function unsupportedOf(schema: Record<string, unknown>): string[] {
  return Object.keys(schema).filter((key) => !KNOWN_KEYWORDS.has(key));
}
