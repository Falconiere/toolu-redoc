/** OpenAPI Path Item and Operation boundary schemas (eight HTTP verbs). */
import * as z from "zod";

import { OpenApiServerSchema } from "./openapi-info-schema";
import { OpenApiRequestBodyOrRefSchema, OpenApiResponseOrRefSchema } from "./openapi-media-schema";
import { OpenApiParameterOrRefSchema } from "./openapi-parameter-schema";

/** OAS Operation Object — responses required; callbacks opaque. */
export const OpenApiOperationSchema = z.looseObject({
  tags: z.array(z.string()).optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  operationId: z.string().optional(),
  deprecated: z.boolean().optional(),
  parameters: z.array(OpenApiParameterOrRefSchema).optional(),
  requestBody: OpenApiRequestBodyOrRefSchema.optional(),
  responses: z.record(z.string(), OpenApiResponseOrRefSchema),
  servers: z.array(OpenApiServerSchema).optional(),
  callbacks: z.record(z.string(), z.unknown()).optional(),
});

/** Inferred Operation Object. */
export type OpenApiOperation = z.infer<typeof OpenApiOperationSchema>;

/**
 * OAS Path Item — only get/put/post/delete/options/head/patch/trace are
 * operations; other keys (summary, parameters, servers, vendor) stay metadata.
 */
export const OpenApiPathItemSchema = z.looseObject({
  $ref: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  servers: z.array(OpenApiServerSchema).optional(),
  parameters: z.array(OpenApiParameterOrRefSchema).optional(),
  get: OpenApiOperationSchema.optional(),
  put: OpenApiOperationSchema.optional(),
  post: OpenApiOperationSchema.optional(),
  delete: OpenApiOperationSchema.optional(),
  options: OpenApiOperationSchema.optional(),
  head: OpenApiOperationSchema.optional(),
  patch: OpenApiOperationSchema.optional(),
  trace: OpenApiOperationSchema.optional(),
});

/** Inferred Path Item Object. */
export type OpenApiPathItem = z.infer<typeof OpenApiPathItemSchema>;
