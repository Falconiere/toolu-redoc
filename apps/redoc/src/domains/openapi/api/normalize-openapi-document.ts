/** Normalize a Zod-parsed OpenAPI document into a UI-ready model. */
import { mergeParametersForPath, type PathParameterIssue } from "./merge-parameters";
import type { OpenApiComponents, OpenApiDocument } from "./openapi-document-schema";
import type { OpenApiInfo, OpenApiServer, OpenApiTag } from "./openapi-info-schema";
import type { OpenApiRequestBodyOrRef, OpenApiResponseOrRef } from "./openapi-media-schema";
import type { OpenApiParameterOrRef } from "./openapi-parameter-schema";
import type { OpenApiOperation, OpenApiPathItem } from "./openapi-path-item-schema";
import {
  encodeOperationIdentity,
  OPENAPI_HTTP_METHODS,
  type OpenApiHttpMethod,
} from "./operation-identity";

/** Non-fatal local notice emitted during normalize or ref resolve. */
export type OpenApiNotice = {
  code: string;
  message: string;
  path?: string;
};

/** One HTTP operation after path/operation merge and unsupported flags. */
export type NormalizedOpenApiOperation = {
  method: OpenApiHttpMethod;
  path: string;
  identity: string;
  operationId?: string;
  summary?: string;
  description?: string;
  deprecated: boolean;
  tags: string[];
  parameters: OpenApiParameterOrRef[];
  requestBody?: OpenApiRequestBodyOrRef;
  responses: Record<string, OpenApiResponseOrRef>;
  servers?: OpenApiServer[];
  unsupported: {
    callbacks?: true;
    links?: true;
  };
  pathParameterIssues: PathParameterIssue[];
};

/** UI-ready OpenAPI model produced from a Zod-validated document. */
export type NormalizedOpenApiDocument = {
  openapi: string;
  info: OpenApiInfo;
  servers: OpenApiServer[];
  tags: OpenApiTag[];
  operations: NormalizedOpenApiOperation[];
  components?: OpenApiComponents;
  notices: OpenApiNotice[];
  jsonSchemaDialect?: string;
};

/**
 * Walk a Zod-parsed document into operations, notices, and components.
 * Empty paths yield `operations: []`; webhooks become a notice only.
 */
export function normalizeOpenApiDocument(document: OpenApiDocument): NormalizedOpenApiDocument {
  const notices: OpenApiNotice[] = [];
  collectDocumentNotices(document, notices);
  const operations = collectOperations(document, notices);
  const normalized: NormalizedOpenApiDocument = {
    openapi: document.openapi,
    info: document.info,
    servers: document.servers ?? [],
    tags: document.tags ?? [],
    operations,
    notices,
  };
  if (document.components !== undefined) {
    normalized.components = document.components;
  }
  if (document.jsonSchemaDialect !== undefined) {
    normalized.jsonSchemaDialect = document.jsonSchemaDialect;
  }
  return normalized;
}

/** Document-level notices (webhooks, 3.1 dynamic keywords in components). */
function collectDocumentNotices(document: OpenApiDocument, notices: OpenApiNotice[]): void {
  if (document.webhooks !== undefined && Object.keys(document.webhooks).length > 0) {
    notices.push({
      code: "webhooks-present",
      message: "Document webhooks are retained but not expanded into operations.",
      path: "#/webhooks",
    });
  }
  collectComponentKeywordNotices(document.components, notices);
}

/** Flag `$dynamicRef` / `$id` under components.schemas without evaluating them. */
function collectComponentKeywordNotices(
  components: OpenApiComponents | undefined,
  notices: OpenApiNotice[],
): void {
  if (components?.schemas === undefined) {
    return;
  }
  for (const [name, schema] of Object.entries(components.schemas)) {
    if (!isRecordObject(schema)) {
      continue;
    }
    pushDynamicKeywordNotices(schema, `#/components/schemas/${name}`, notices);
  }
}

/** True for non-null object values (excludes booleans / arrays handled elsewhere). */
function isRecordObject(value: unknown): value is object {
  return value !== null && typeof value === "object";
}

/** Emit notices for unsupported 3.1 dynamic keywords on a schema object. */
function pushDynamicKeywordNotices(
  schema: object,
  pointer: string,
  notices: OpenApiNotice[],
): void {
  if (Object.hasOwn(schema, "$dynamicRef")) {
    notices.push({
      code: "dynamic-ref",
      message: "$dynamicRef is not evaluated; value is kept as authored.",
      path: pointer,
    });
  }
  if (Object.hasOwn(schema, "$id")) {
    notices.push({
      code: "unsupported-keyword",
      message: "Schema $id is retained but not used for resolution.",
      path: pointer,
    });
  }
}

/** Build the flat operations list from Path Items (eight verbs only). */
function collectOperations(
  document: OpenApiDocument,
  notices: OpenApiNotice[],
): NormalizedOpenApiOperation[] {
  const operations: NormalizedOpenApiOperation[] = [];
  for (const [path, pathItem] of Object.entries(document.paths)) {
    if (pathItem.$ref !== undefined) {
      notices.push({
        code: "path-item-ref",
        message: "Path Item $ref is not expanded in MVP; operations on this path are omitted.",
        path: `#/paths/${path}`,
      });
      continue;
    }
    for (const method of OPENAPI_HTTP_METHODS) {
      const operation = pathItem[method];
      if (operation === undefined) {
        continue;
      }
      operations.push(normalizeOperation(method, path, pathItem, operation, notices));
    }
  }
  return operations;
}

/** Normalize one verb on a path, merging parameters and unsupported flags. */
function normalizeOperation(
  method: OpenApiHttpMethod,
  path: string,
  pathItem: OpenApiPathItem,
  operation: OpenApiOperation,
  notices: OpenApiNotice[],
): NormalizedOpenApiOperation {
  const identity = encodeOperationIdentity(method, path);
  const merged = mergeParametersForPath(path, pathItem.parameters, operation.parameters);
  const unsupported = collectUnsupported(operation, identity, notices);
  const normalized: NormalizedOpenApiOperation = {
    method,
    path,
    identity,
    deprecated: operation.deprecated === true,
    tags: operation.tags ?? [],
    parameters: merged.parameters,
    responses: operation.responses,
    unsupported,
    pathParameterIssues: merged.pathParameterIssues,
  };
  assignOptionalOperationFields(normalized, operation, pathItem);
  return normalized;
}

/** Copy optional operation fields only when present (exactOptionalPropertyTypes). */
function assignOptionalOperationFields(
  normalized: NormalizedOpenApiOperation,
  operation: OpenApiOperation,
  pathItem: OpenApiPathItem,
): void {
  if (operation.operationId !== undefined) {
    normalized.operationId = operation.operationId;
  }
  if (operation.summary !== undefined) {
    normalized.summary = operation.summary;
  }
  if (operation.description !== undefined) {
    normalized.description = operation.description;
  }
  if (operation.requestBody !== undefined) {
    normalized.requestBody = operation.requestBody;
  }
  const servers = operation.servers ?? pathItem.servers;
  if (servers !== undefined) {
    normalized.servers = servers;
  }
}

/** Mark callbacks/links unsupported and push matching notices. */
function collectUnsupported(
  operation: OpenApiOperation,
  identity: string,
  notices: OpenApiNotice[],
): NormalizedOpenApiOperation["unsupported"] {
  const unsupported: NormalizedOpenApiOperation["unsupported"] = {};
  if (operation.callbacks !== undefined) {
    unsupported.callbacks = true;
    notices.push({
      code: "callbacks-on-operation",
      message: "Operation callbacks are not expanded into operations.",
      path: identity,
    });
  }
  if (operationHasLinks(operation)) {
    unsupported.links = true;
    notices.push({
      code: "links-on-operation",
      message: "Links on this operation or its responses are not evaluated.",
      path: identity,
    });
  }
  return unsupported;
}

/** True when the operation or any inline response declares `links`. */
function operationHasLinks(operation: OpenApiOperation): boolean {
  if (Object.hasOwn(operation, "links")) {
    return true;
  }
  for (const response of Object.values(operation.responses)) {
    if (Object.hasOwn(response, "links")) {
      return true;
    }
  }
  return false;
}
