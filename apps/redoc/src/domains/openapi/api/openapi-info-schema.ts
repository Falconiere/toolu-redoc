/** OpenAPI Info, Server, and Tag boundary schemas. */
import * as z from "zod";

/** OAS Info Object — title and version required; extras preserved. */
export const OpenApiInfoSchema = z.looseObject({
  title: z.string(),
  version: z.string(),
  description: z.string().optional(),
});

/** Inferred Info Object. */
export type OpenApiInfo = z.infer<typeof OpenApiInfoSchema>;

/** Server variable substitution (default required). */
export const OpenApiServerVariableSchema = z.looseObject({
  default: z.string(),
  enum: z.array(z.string()).optional(),
  description: z.string().optional(),
});

/** OAS Server Object. */
export const OpenApiServerSchema = z.looseObject({
  url: z.string(),
  description: z.string().optional(),
  variables: z.record(z.string(), OpenApiServerVariableSchema).optional(),
});

/** Inferred Server Object. */
export type OpenApiServer = z.infer<typeof OpenApiServerSchema>;

/** OAS Tag Object — document-order tags. */
export const OpenApiTagSchema = z.looseObject({
  name: z.string(),
  description: z.string().optional(),
});

/** Inferred Tag Object. */
export type OpenApiTag = z.infer<typeof OpenApiTagSchema>;
