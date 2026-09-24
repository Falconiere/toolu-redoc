/** OpenAPI 3.0/3.1 document root boundary schema. */
import * as z from "zod";

import { OpenApiInfoSchema, OpenApiServerSchema, OpenApiTagSchema } from "./openapi-info-schema";
import { OpenApiRequestBodyOrRefSchema, OpenApiResponseOrRefSchema } from "./openapi-media-schema";
import { OpenApiParameterOrRefSchema } from "./openapi-parameter-schema";
import { OpenApiPathItemSchema } from "./openapi-path-item-schema";
import { OpenApiSchemaObjectSchema } from "./openapi-schema-object";

/** True when value is a non-null plain object. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** OAS Components Object — supported maps only; extras preserved. */
export const OpenApiComponentsSchema = z.looseObject({
  schemas: z.record(z.string(), OpenApiSchemaObjectSchema).optional(),
  parameters: z.record(z.string(), OpenApiParameterOrRefSchema).optional(),
  requestBodies: z.record(z.string(), OpenApiRequestBodyOrRefSchema).optional(),
  responses: z.record(z.string(), OpenApiResponseOrRefSchema).optional(),
  headers: z.record(z.string(), z.unknown()).optional(),
  examples: z.record(z.string(), z.unknown()).optional(),
});

/** Inferred Components Object. */
export type OpenApiComponents = z.infer<typeof OpenApiComponentsSchema>;

/** Document body after Swagger family rejection. */
const OpenApiDocumentBodySchema = z.looseObject({
  openapi: z.string().refine((value) => /^3\.0\.\d+$/.test(value) || /^3\.1\.\d+$/.test(value), {
    message: "openapi must be 3.0.x or 3.1.x",
  }),
  info: OpenApiInfoSchema,
  servers: z.array(OpenApiServerSchema).optional(),
  tags: z.array(OpenApiTagSchema).optional(),
  paths: z.record(z.string(), OpenApiPathItemSchema).default({}),
  webhooks: z.record(z.string(), z.unknown()).optional(),
  components: OpenApiComponentsSchema.optional(),
  jsonSchemaDialect: z.string().optional(),
});

/**
 * Reject Swagger 2 / non-object roots before version refine so the message
 * names the unsupported family.
 */
const OpenApiDocumentRootSchema = z.unknown().superRefine((input, ctx) => {
  if (!isPlainObject(input)) {
    ctx.addIssue({
      code: "custom",
      message: "OpenAPI document must be a JSON object",
    });
    return;
  }
  if (Object.hasOwn(input, "swagger")) {
    ctx.addIssue({
      code: "custom",
      message: "Swagger 2.0 is not supported; use OpenAPI 3.0 or 3.1",
      path: ["swagger"],
    });
  }
});

/** OAS 3.0.x / 3.1.x document — paths default to `{}`; webhooks opaque. */
export const OpenApiDocumentSchema = OpenApiDocumentRootSchema.pipe(OpenApiDocumentBodySchema);

/** Inferred OpenAPI document. */
export type OpenApiDocument = z.infer<typeof OpenApiDocumentSchema>;
