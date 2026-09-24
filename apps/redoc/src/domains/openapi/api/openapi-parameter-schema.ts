/** OpenAPI Parameter (+ Reference) boundary schemas. */
import * as z from "zod";

import { OpenApiMediaTypeSchema } from "./openapi-media-schema";
import { OpenApiReferenceSchema, OpenApiSchemaObjectSchema } from "./openapi-schema-object";

/** Parameter location values. */
export const OpenApiParameterInSchema = z.enum(["path", "query", "header", "cookie"]);

/** OAS Parameter Object — name and in required. */
export const OpenApiParameterSchema = z.looseObject({
  name: z.string(),
  in: OpenApiParameterInSchema,
  required: z.boolean().optional(),
  deprecated: z.boolean().optional(),
  description: z.string().optional(),
  schema: OpenApiSchemaObjectSchema.optional(),
  content: z.record(z.string(), OpenApiMediaTypeSchema).optional(),
  example: z.unknown().optional(),
  examples: z.record(z.string(), z.unknown()).optional(),
});

/** Inferred Parameter Object. */
export type OpenApiParameter = z.infer<typeof OpenApiParameterSchema>;

/** Parameter or Reference. */
export const OpenApiParameterOrRefSchema = z.union([
  OpenApiReferenceSchema,
  OpenApiParameterSchema,
]);

/** Inferred Parameter or Reference. */
export type OpenApiParameterOrRef = z.infer<typeof OpenApiParameterOrRefSchema>;
