/** Main-column operation detail panel (null → empty selection state). */
import { useEffect, useRef } from "react";

import { OperationDetailHeader } from "@/domains/docs/components/operation-detail-header";
import { OperationDetailParameters } from "@/domains/docs/components/operation-detail-parameters";
import { OperationDetailRequest } from "@/domains/docs/components/operation-detail-request";
import { OperationDetailResponses } from "@/domains/docs/components/operation-detail-responses";
import { OperationDetailServers } from "@/domains/docs/components/operation-detail-servers";
import type {
  OperationDetailModel,
  OperationDetailProps,
  SchemaFocus,
} from "@/domains/docs/api/operation-detail-model";

/** Default SchemaFocus after selecting an operation (first response, else request). */
function defaultFocus(operation: OperationDetailModel): SchemaFocus | null {
  const firstResponse = operation.responses[0];
  if (firstResponse !== undefined) {
    if (firstResponse.emptyContent) {
      return {
        kind: "response",
        status: firstResponse.status,
        mediaType: null,
        headerName: null,
        typeSummary: "—",
        ref: null,
        exampleKey: null,
        externalValue: null,
      };
    }
    const mediaType = firstResponse.mediaTypes[0] ?? null;
    const media = mediaType !== null ? firstResponse.contents[mediaType] : undefined;
    if (media !== undefined && mediaType !== null) {
      const exampleKey = media.defaultExampleKey;
      const named = media.namedExamples.find((entry) => entry.key === exampleKey);
      const exampleValue = media.singularExample.present
        ? media.singularExample.value
        : named?.value;
      return {
        kind: "response",
        status: firstResponse.status,
        mediaType,
        headerName: null,
        typeSummary: media.typeSummary,
        ref: media.schemaHandle.kind === "response" ? media.schemaHandle.ref : null,
        exampleKey: media.singularExample.present ? null : exampleKey,
        ...(exampleValue !== undefined ? { exampleValue } : {}),
        externalValue: media.singularExample.present ? null : (named?.externalValue ?? null),
      };
    }
  }
  const body = operation.requestBody;
  if (body !== null) {
    const mediaType = body.mediaTypes[0];
    if (mediaType !== undefined) {
      const media = body.contents[mediaType];
      if (media !== undefined) {
        return media.schemaHandle;
      }
    }
  }
  return null;
}

/** Operation detail root: empty copy or full regions with focus bridge. */
export function OperationDetail({ operation, onFocusChange }: OperationDetailProps) {
  const onFocusChangeRef = useRef(onFocusChange);
  onFocusChangeRef.current = onFocusChange;
  const operationRef = useRef(operation);
  operationRef.current = operation;
  const identity = operation?.identity ?? null;

  useEffect(() => {
    const current = operationRef.current;
    onFocusChangeRef.current?.(current ? defaultFocus(current) : null);
  }, [identity]);

  if (operation === null) {
    return (
      <div className="min-w-0 border border-border bg-background p-4">
        <p className="type-meta text-text-faint">Select an operation.</p>
      </div>
    );
  }

  return (
    <article className="flex min-w-0 flex-col gap-6 border border-border bg-background p-4">
      <OperationDetailHeader operation={operation} />
      <OperationDetailServers servers={operation.servers} />
      <OperationDetailParameters
        parameters={operation.parameters}
        pathParameterIssues={operation.pathParameterIssues}
        onFocusChange={onFocusChange}
      />
      <OperationDetailRequest requestBody={operation.requestBody} onFocusChange={onFocusChange} />
      <OperationDetailResponses responses={operation.responses} onFocusChange={onFocusChange} />
    </article>
  );
}
