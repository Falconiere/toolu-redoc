/** Parameter and request-body mappers for mapOperationDetail. */
import {
  hasRef,
  isRecord,
  mapMedia,
  mediaContentFromUnknown,
  summarizeSchema,
  type MediaTypeFields,
} from "@/app/map-operation-detail-media";
import type {
  OperationMediaModel,
  OperationParameterRow,
  OperationRequestBodyModel,
  SchemaFocus,
} from "@/domains/docs/api/operation-detail-model";
import type { NormalizedOpenApiOperation } from "@/domains/openapi/api/normalize-openapi-document";
import type {
  OpenApiParameter,
  OpenApiParameterOrRef,
} from "@/domains/openapi/api/openapi-parameter-schema";

/** True when the value is an inline Parameter Object (`$ref` absent, name + in present). */
function isParameterObject(parameter: OpenApiParameterOrRef): parameter is OpenApiParameter {
  return !hasRef(parameter) && "name" in parameter && "in" in parameter;
}

/** Map an inline Parameter Object into a table row. */
function mapInlineParameter(parameter: OpenApiParameter): OperationParameterRow {
  let typeSummary: string;
  let ref: string | null = null;
  if (parameter.schema !== undefined) {
    const summarized = summarizeSchema(parameter.schema);
    typeSummary = summarized.typeSummary;
    ref = summarized.ref;
  } else if (parameter.content !== undefined) {
    typeSummary = "content";
  } else {
    typeSummary = "—";
  }
  return {
    name: parameter.name,
    in: parameter.in,
    required: parameter.required === true,
    deprecated: parameter.deprecated === true,
    description: parameter.description ?? null,
    typeSummary,
    schemaHandle: {
      kind: "parameter",
      name: parameter.name,
      in: parameter.in,
      typeSummary,
      ref,
    },
  };
}

/** Map one parameter or parameter `$ref` into a table row. */
export function mapParameter(parameter: OpenApiParameterOrRef): OperationParameterRow {
  if (hasRef(parameter)) {
    const ref = parameter.$ref;
    const typeSummary = `$ref ${ref}`;
    return {
      name: ref,
      in: "$ref",
      required: false,
      deprecated: false,
      description: null,
      typeSummary,
      schemaHandle: { kind: "parameter", name: ref, in: "$ref", typeSummary, ref },
    };
  }
  if (!isParameterObject(parameter)) {
    return {
      name: "—",
      in: "$ref",
      required: false,
      deprecated: false,
      description: null,
      typeSummary: "—",
      schemaHandle: {
        kind: "parameter",
        name: "—",
        in: "$ref",
        typeSummary: "—",
        ref: null,
      },
    };
  }
  return mapInlineParameter(parameter);
}

/** Map a `$ref` request body into a synthetic media entry. */
function mapRequestBodyRef(ref: string): OperationRequestBodyModel {
  const typeSummary = `$ref ${ref}`;
  const mediaType = "$ref";
  const schemaHandle: SchemaFocus = {
    kind: "request",
    mediaType,
    typeSummary,
    ref,
    exampleKey: null,
    externalValue: null,
  };
  return {
    description: null,
    required: false,
    mediaTypes: [mediaType],
    contents: {
      [mediaType]: {
        typeSummary,
        schemaHandle,
        defaultExampleKey: null,
        singularExample: { present: false, value: undefined },
        namedExamples: [],
      },
    },
  };
}

/** Map inline request body content map. */
function mapRequestBodyContent(body: {
  description?: string | undefined;
  required?: boolean | undefined;
  content: Record<string, MediaTypeFields>;
}): OperationRequestBodyModel {
  const mediaTypes = Object.keys(body.content);
  const contents: Record<string, OperationMediaModel> = {};
  for (const mediaType of mediaTypes) {
    const media = body.content[mediaType];
    if (media === undefined) {
      continue;
    }
    contents[mediaType] = mapMedia(mediaType, media, { kind: "request" });
  }
  return {
    description: body.description ?? null,
    required: body.required === true,
    mediaTypes,
    contents,
  };
}

/** Map request body or body `$ref`; null when absent. */
export function mapRequestBody(
  requestBody: NormalizedOpenApiOperation["requestBody"],
): OperationRequestBodyModel | null {
  if (requestBody === undefined) {
    return null;
  }
  if (hasRef(requestBody) && !("content" in requestBody)) {
    return mapRequestBodyRef(requestBody.$ref);
  }
  const raw: unknown = requestBody;
  if (!isRecord(raw) || !isRecord(raw.content)) {
    return null;
  }
  const description = typeof raw.description === "string" ? raw.description : undefined;
  const required = typeof raw.required === "boolean" ? raw.required : undefined;
  const content = mediaContentFromUnknown(raw.content);
  if (content === undefined) {
    return null;
  }
  return mapRequestBodyContent({ description, required, content });
}
