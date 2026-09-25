/** Map NormalizedOpenApiOperation (+ document servers) → docs OperationDetailModel. */
import { mapParameter, mapRequestBody } from "@/app/map-operation-detail-params";
import { mapResponse, mapServers } from "@/app/map-operation-detail-responses";
import type { OperationDetailModel } from "@/domains/docs/api/operation-detail-model";
import type { NormalizedOpenApiOperation } from "@/domains/openapi/api/normalize-openapi-document";
import type { OpenApiServer } from "@/domains/openapi/api/openapi-info-schema";

/**
 * Map a normalized operation plus document servers into the docs view-model.
 * Effective servers: non-empty operation.servers, else document servers.
 */
export function mapOperationDetail(
  operation: NormalizedOpenApiOperation,
  documentServers: OpenApiServer[],
): OperationDetailModel {
  const opServers = operation.servers;
  const effectiveServers =
    opServers !== undefined && opServers.length > 0 ? opServers : documentServers;
  return {
    identity: operation.identity,
    method: operation.method,
    path: operation.path,
    operationId: operation.operationId ?? null,
    summary: operation.summary ?? null,
    description: operation.description ?? null,
    deprecated: operation.deprecated,
    tags: [...operation.tags],
    parameters: operation.parameters.map(mapParameter),
    pathParameterIssues: operation.pathParameterIssues.map((issue) => ({
      name: issue.name,
      issue: issue.issue,
    })),
    requestBody: mapRequestBody(operation.requestBody),
    responses: Object.entries(operation.responses).map(([status, response]) =>
      mapResponse(status, response),
    ),
    servers: mapServers(effectiveServers),
  };
}
