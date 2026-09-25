/** Plain view-model types for operation detail (docs-owned; no openapi imports). */

/** One path-template parameter problem surfaced above the parameters table. */
export type OperationPathParameterIssue = {
  name: string;
  issue: "missing" | "not_required";
};

/** Schema focus handle for the samples rail (#7) — keys and scalars only. */
export type SchemaFocus =
  | {
      kind: "parameter";
      name: string;
      in: string;
      typeSummary: string;
      /** Present when the parameter is/was a `$ref`; otherwise null. */
      ref: string | null;
    }
  | {
      kind: "request";
      mediaType: string;
      typeSummary: string;
      ref: string | null;
      exampleKey: string | null;
      exampleValue?: unknown;
      externalValue: string | null;
    }
  | {
      kind: "response";
      status: string;
      mediaType: string | null;
      headerName: string | null;
      typeSummary: string;
      ref: string | null;
      exampleKey: string | null;
      exampleValue?: unknown;
      externalValue: string | null;
    };

/** One parameter row in the operation detail table. */
export type OperationParameterRow = {
  name: string;
  in: "path" | "query" | "header" | "cookie" | "$ref";
  required: boolean;
  deprecated: boolean;
  description: string | null;
  typeSummary: string;
  schemaHandle: SchemaFocus;
};

/** Named media example after unwrap (omit value when only externalValue). */
export type OperationNamedExample = {
  key: string;
  summary: string | null;
  value?: unknown;
  externalValue: string | null;
};

/** One media type under a request body or response. */
export type OperationMediaModel = {
  typeSummary: string;
  schemaHandle: SchemaFocus;
  /** Singular `example` present → null (UI uses singular); else first named key. */
  defaultExampleKey: string | null;
  singularExample: { present: boolean; value: unknown };
  namedExamples: OperationNamedExample[];
};

/** Request body view-model; null on the parent means no body authored. */
export type OperationRequestBodyModel = {
  description: string | null;
  required: boolean;
  mediaTypes: string[];
  contents: Record<string, OperationMediaModel>;
};

/** One response status row (authored key order as preserved by parse). */
export type OperationResponseRow = {
  status: string;
  description: string;
  headers: { name: string; typeSummary: string; schemaHandle: SchemaFocus }[];
  mediaTypes: string[];
  contents: Record<string, OperationMediaModel>;
  emptyContent: boolean;
};

/** Effective server entry (operation override or document root). */
export type OperationServerModel = {
  url: string;
  description: string | null;
  variables: { name: string; defaultValue: string; enumValues: string[] }[];
};

/** Full operation detail view-model for the main column. */
export type OperationDetailModel = {
  identity: string;
  method: string;
  path: string;
  operationId: string | null;
  summary: string | null;
  description: string | null;
  deprecated: boolean;
  tags: string[];
  parameters: OperationParameterRow[];
  pathParameterIssues: OperationPathParameterIssue[];
  requestBody: OperationRequestBodyModel | null;
  responses: OperationResponseRow[];
  servers: OperationServerModel[];
};
