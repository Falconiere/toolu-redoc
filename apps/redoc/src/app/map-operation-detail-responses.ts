/** Response and server mappers for mapOperationDetail. */
import {
  hasRef,
  isRecord,
  mapMedia,
  mediaContentFromUnknown,
  summarizeSchema,
} from "@/app/map-operation-detail-media";
import type {
  OperationMediaModel,
  OperationResponseRow,
  OperationServerModel,
} from "@/domains/docs/api/operation-detail-model";
import type { OpenApiServer } from "@/domains/openapi/api/openapi-info-schema";

/** Map response headers (unknown values) into typed rows. */
function mapResponseHeaders(
  status: string,
  headers: Record<string, unknown> | undefined,
): OperationResponseRow["headers"] {
  if (headers === undefined) {
    return [];
  }
  const rows: OperationResponseRow["headers"] = [];
  for (const [name, value] of Object.entries(headers)) {
    let typeSummary: string;
    let ref: string | null = null;
    if (hasRef(value)) {
      ref = value.$ref;
      typeSummary = `$ref ${ref}`;
    } else if (isRecord(value) && "schema" in value) {
      const summarized = summarizeSchema(value.schema);
      typeSummary = summarized.typeSummary;
      ref = summarized.ref;
    } else {
      typeSummary = "—";
    }
    rows.push({
      name,
      typeSummary,
      schemaHandle: {
        kind: "response",
        status,
        mediaType: null,
        headerName: name,
        typeSummary,
        ref,
        exampleKey: null,
        externalValue: null,
      },
    });
  }
  return rows;
}

/** Map one response status entry (inline or `$ref`). */
export function mapResponse(status: string, response: unknown): OperationResponseRow {
  if (hasRef(response)) {
    return {
      status,
      description: `$ref ${response.$ref}`,
      headers: [],
      mediaTypes: [],
      contents: {},
      emptyContent: true,
    };
  }
  if (!isRecord(response)) {
    return {
      status,
      description: "",
      headers: [],
      mediaTypes: [],
      contents: {},
      emptyContent: true,
    };
  }
  const description = typeof response.description === "string" ? response.description : "";
  const headers = isRecord(response.headers) ? response.headers : undefined;
  const content = mediaContentFromUnknown(response.content);
  const mediaTypes = content === undefined ? [] : Object.keys(content);
  const emptyContent = mediaTypes.length === 0;
  const contents: Record<string, OperationMediaModel> = {};
  for (const mediaType of mediaTypes) {
    const media = content === undefined ? undefined : content[mediaType];
    if (media === undefined) {
      continue;
    }
    contents[mediaType] = mapMedia(mediaType, media, {
      kind: "response",
      status,
      headerName: null,
    });
  }
  return {
    status,
    description,
    headers: mapResponseHeaders(status, headers),
    mediaTypes,
    contents,
    emptyContent,
  };
}

/** Map document/operation servers into read-only view-model rows. */
export function mapServers(servers: readonly OpenApiServer[]): OperationServerModel[] {
  return servers.map((server) => {
    const variables: OperationServerModel["variables"] = [];
    if (server.variables !== undefined) {
      for (const [name, variable] of Object.entries(server.variables)) {
        variables.push({
          name,
          defaultValue: variable.default,
          enumValues: variable.enum ?? [],
        });
      }
    }
    return {
      url: server.url,
      description: server.description ?? null,
      variables,
    };
  });
}
