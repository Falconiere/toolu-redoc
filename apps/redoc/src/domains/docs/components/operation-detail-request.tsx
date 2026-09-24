/** Request body region: requiredness, media/example pickers, inert example text. */
import { useEffect, useState } from "react";

import { DetailOptionGroup } from "@/domains/docs/components/detail-option-group";
import { ExampleValuePanel } from "@/domains/docs/components/example-value-panel";
import type {
  OperationMediaModel,
  OperationRequestBodyModel,
  SchemaFocus,
} from "@/domains/docs/api/operation-detail-model";

/** Props for the request body region. */
export type OperationDetailRequestProps = {
  requestBody: OperationRequestBodyModel | null;
  onFocusChange?: ((focus: SchemaFocus) => void) | undefined;
};

/** Build a request SchemaFocus for the selected media + example. */
function requestFocus(
  mediaType: string,
  media: OperationMediaModel,
  exampleKey: string | null,
): SchemaFocus {
  const ref = media.schemaHandle.kind === "request" ? media.schemaHandle.ref : null;
  if (exampleKey === null && media.singularExample.present) {
    return {
      kind: "request",
      mediaType,
      typeSummary: media.typeSummary,
      ref,
      exampleKey: null,
      exampleValue: media.singularExample.value,
      externalValue: null,
    };
  }
  const named = media.namedExamples.find((entry) => entry.key === exampleKey);
  const handle: SchemaFocus = {
    kind: "request",
    mediaType,
    typeSummary: media.typeSummary,
    ref,
    exampleKey,
    externalValue: named?.externalValue ?? null,
  };
  if (named !== undefined && Object.hasOwn(named, "value")) {
    handle.exampleValue = named.value;
  }
  return handle;
}

/** Request body panel or explicit empty state. */
export function OperationDetailRequest({
  requestBody,
  onFocusChange,
}: OperationDetailRequestProps) {
  const [mediaType, setMediaType] = useState<string | null>(requestBody?.mediaTypes[0] ?? null);
  const media =
    requestBody !== null && mediaType !== null ? requestBody.contents[mediaType] : undefined;
  const [exampleKey, setExampleKey] = useState<string | null>(media?.defaultExampleKey ?? null);

  useEffect(() => {
    const nextMedia = requestBody?.mediaTypes[0] ?? null;
    setMediaType(nextMedia);
    const next =
      requestBody !== null && nextMedia !== null ? requestBody.contents[nextMedia] : undefined;
    setExampleKey(next?.defaultExampleKey ?? null);
  }, [requestBody]);

  if (requestBody === null) {
    return (
      <section className="flex min-w-0 flex-col gap-2" aria-label="Request body">
        <h3 className="type-label text-text">Request body</h3>
        <p className="type-meta text-text-faint">No request body.</p>
      </section>
    );
  }

  return (
    <RequestBodyContent
      requestBody={requestBody}
      mediaType={mediaType}
      exampleKey={exampleKey}
      onMediaType={(type) => {
        setMediaType(type);
        const next = requestBody.contents[type];
        const nextKey = next?.defaultExampleKey ?? null;
        setExampleKey(nextKey);
        if (next !== undefined) {
          onFocusChange?.(requestFocus(type, next, nextKey));
        }
      }}
      onExampleKey={(key) => {
        setExampleKey(key);
        if (mediaType !== null && media !== undefined) {
          onFocusChange?.(requestFocus(mediaType, media, key));
        }
      }}
    />
  );
}

/** Inner request body controls (keeps the parent under max-lines-per-function). */
function RequestBodyContent({
  requestBody,
  mediaType,
  exampleKey,
  onMediaType,
  onExampleKey,
}: {
  requestBody: OperationRequestBodyModel;
  mediaType: string | null;
  exampleKey: string | null;
  onMediaType: (type: string) => void;
  onExampleKey: (key: string | null) => void;
}) {
  const media = mediaType !== null ? requestBody.contents[mediaType] : undefined;
  const exampleOptions = [
    ...(media?.singularExample.present ? [{ value: "__singular__", label: "default" }] : []),
    ...(media?.namedExamples.map((example) => ({
      value: example.key,
      label: example.summary ?? example.key,
    })) ?? []),
  ];
  return (
    <section className="flex min-w-0 flex-col gap-2" aria-label="Request body">
      <h3 className="type-label text-text">Request body</h3>
      <p className="type-meta text-text-muted">{requestBody.required ? "Required" : "Optional"}</p>
      {requestBody.description !== null ? (
        <p className="type-body text-text">{requestBody.description}</p>
      ) : null}
      <DetailOptionGroup
        name="request-media-type"
        label="Request media type"
        value={mediaType}
        options={requestBody.mediaTypes.map((type) => ({ value: type, label: type }))}
        onChange={onMediaType}
      />
      {exampleOptions.length > 0 ? (
        <DetailOptionGroup
          name="request-example"
          label="Request example"
          value={
            exampleKey === null && media?.singularExample.present ? "__singular__" : exampleKey
          }
          options={exampleOptions}
          onChange={(value) => {
            onExampleKey(value === "__singular__" ? null : value);
          }}
        />
      ) : null}
      <ExampleValuePanel media={media} exampleKey={exampleKey} />
    </section>
  );
}
