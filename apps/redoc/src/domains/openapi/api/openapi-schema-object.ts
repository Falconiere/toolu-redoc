/** Recursive OpenAPI Schema Object (+ 3.1 boolean) boundary schema. */
import * as z from "zod";

/** OAS Reference Object — `$ref` only at resolve sites. */
export const OpenApiReferenceSchema = z.object({
  $ref: z.string(),
});

/** Discriminator for composition mapping. */
export const OpenApiDiscriminatorSchema = z.looseObject({
  propertyName: z.string(),
  mapping: z.record(z.string(), z.string()).optional(),
});

/**
 * Object-form Schema Object. Recursive fields use getters; extras kept via
 * looseObject for later `unsupportedKeywords` collection in normalize.
 */
export const OpenApiSchemaObjectFormSchema = z.looseObject({
  type: z.union([z.string(), z.array(z.string())]).optional(),
  format: z.string().optional(),
  description: z.string().optional(),
  get properties() {
    return z.record(z.string(), OpenApiSchemaObjectSchema).optional();
  },
  required: z.array(z.string()).optional(),
  get items() {
    return OpenApiSchemaObjectSchema.optional();
  },
  enum: z.array(z.unknown()).optional(),
  default: z.unknown().optional(),
  nullable: z.boolean().optional(),
  readOnly: z.boolean().optional(),
  writeOnly: z.boolean().optional(),
  get additionalProperties() {
    return z.union([z.boolean(), OpenApiSchemaObjectSchema]).optional();
  },
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  pattern: z.string().optional(),
  minItems: z.number().optional(),
  maxItems: z.number().optional(),
  uniqueItems: z.boolean().optional(),
  get allOf() {
    return z.array(OpenApiSchemaObjectSchema).optional();
  },
  get oneOf() {
    return z.array(OpenApiSchemaObjectSchema).optional();
  },
  get anyOf() {
    return z.array(OpenApiSchemaObjectSchema).optional();
  },
  get not() {
    return OpenApiSchemaObjectSchema.optional();
  },
  discriminator: OpenApiDiscriminatorSchema.optional(),
  $ref: z.string().optional(),
  $id: z.string().optional(),
  $dynamicRef: z.string().optional(),
  $dynamicAnchor: z.string().optional(),
});

/**
 * Schema Object or 3.1 boolean schema. Boolean accepted at the boundary for
 * every version; normalize may notice boolean schemas under 3.0.
 */
export const OpenApiSchemaObjectSchema = z.union([z.boolean(), OpenApiSchemaObjectFormSchema]);
