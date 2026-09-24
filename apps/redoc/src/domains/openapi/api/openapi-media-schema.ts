/** OpenAPI Media Type, Request Body, and Response boundary schemas. */
import * as z from "zod";

import { OpenApiReferenceSchema, OpenApiSchemaObjectSchema } from "./openapi-schema-object";

/** OAS Media Type Object — examples and opaque encoding preserved. */
export const OpenApiMediaTypeSchema = z.looseObject({
  schema: OpenApiSchemaObjectSchema.optional(),
  example: z.unknown().optional(),
  examples: z.record(z.string(), z.unknown()).optional(),
  encoding: z.record(z.string(), z.unknown()).optional(),
});

/** OAS Request Body Object — `content` required. */
export const OpenApiRequestBodySchema = z.looseObject({
  description: z.string().optional(),
  required: z.boolean().optional(),
  content: z.record(z.string(), OpenApiMediaTypeSchema),
});

/** Request Body or Reference. */
export const OpenApiRequestBodyOrRefSchema = z.union([
  OpenApiReferenceSchema,
  OpenApiRequestBodySchema,
]);

/** Inferred Request Body or Reference. */
export type OpenApiRequestBodyOrRef = z.infer<typeof OpenApiRequestBodyOrRefSchema>;

/** OAS Response Object — description may be empty. */
export const OpenApiResponseSchema = z.looseObject({
  description: z.string(),
  headers: z.record(z.string(), z.unknown()).optional(),
  content: z.record(z.string(), OpenApiMediaTypeSchema).optional(),
});

/** Response or Reference. */
export const OpenApiResponseOrRefSchema = z.union([OpenApiReferenceSchema, OpenApiResponseSchema]);

/** Inferred Response or Reference. */
export type OpenApiResponseOrRef = z.infer<typeof OpenApiResponseOrRefSchema>;
