/** Responses region: status list, headers, media/example pickers, empty body. */
import { useEffect, useState } from "react";

import { CONTROL_FOCUS } from "@/domains/docs/components/docs-shell-focus";
import { DetailOptionGroup } from "@/domains/docs/components/detail-option-group";
import { ExampleValuePanel } from "@/domains/docs/components/example-value-panel";
import type {
  OperationMediaModel,
  OperationResponseRow,
  SchemaFocus,
} from "@/domains/docs/api/operation-detail-model";

/** Props for the responses region. */
export type OperationDetailResponsesProps = {
  responses: OperationResponseRow[];
  onFocusChange?: ((focus: SchemaFocus) => void) | undefined;
};

/** Build a response SchemaFocus for status + media + example. */
function responseFocus(
  row: OperationResponseRow,
  mediaType: string | null,
  media: OperationMediaModel | undefined,
  exampleKey: string | null,
): SchemaFocus {
  if (media === undefined || mediaType === null) {
    return {
      kind: "response",
      status: row.status,
      mediaType: null,
      headerName: null,
      typeSummary: "—",
      ref: null,
      exampleKey: null,
      externalValue: null,
    };
  }
  const ref = media.schemaHandle.kind === "response" ? media.schemaHandle.ref : null;
  if (exampleKey === null && media.singularExample.present) {
    return {
      kind: "response",
      status: row.status,
      mediaType,
      headerName: null,
      typeSummary: media.typeSummary,
      ref,
      exampleKey: null,
      exampleValue: media.singularExample.value,
      externalValue: null,
    };
  }
  const named = media.namedExamples.find((entry) => entry.key === exampleKey);
  const handle: SchemaFocus = {
    kind: "response",
    status: row.status,
    mediaType,
    headerName: null,
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

/** Ordered status keys with description, headers, and body/example controls. */
export function OperationDetailResponses({
  responses,
  onFocusChange,
}: OperationDetailResponsesProps) {
  const [status, setStatus] = useState<string | null>(responses[0]?.status ?? null);
  const selected = responses.find((row) => row.status === status) ?? null;
  const [mediaType, setMediaType] = useState<string | null>(
    selected?.emptyContent ? null : (selected?.mediaTypes[0] ?? null),
  );
  const media = selected !== null && mediaType !== null ? selected.contents[mediaType] : undefined;
  const [exampleKey, setExampleKey] = useState<string | null>(media?.defaultExampleKey ?? null);

  useEffect(() => {
    const next = responses[0] ?? null;
    setStatus(next?.status ?? null);
    const nextMedia = next?.emptyContent ? null : (next?.mediaTypes[0] ?? null);
    setMediaType(nextMedia);
    const nextModel = next !== null && nextMedia !== null ? next.contents[nextMedia] : undefined;
    setExampleKey(nextModel?.defaultExampleKey ?? null);
  }, [responses]);

  return (
    <section className="flex min-w-0 flex-col gap-2" aria-label="Responses">
      <h3 className="type-label text-text">Responses</h3>
      {responses.length === 0 ? (
        <p className="type-meta text-text-faint">No responses.</p>
      ) : (
        <>
          <DetailOptionGroup
            name="response-status"
            label="Response status"
            value={status}
            options={responses.map((row) => ({ value: row.status, label: row.status }))}
            onChange={(nextStatus) => {
              const row = responses.find((entry) => entry.status === nextStatus);
              if (row === undefined) {
                return;
              }
              setStatus(row.status);
              const nextMedia = row.emptyContent ? null : (row.mediaTypes[0] ?? null);
              setMediaType(nextMedia);
              const nextModel = nextMedia !== null ? row.contents[nextMedia] : undefined;
              const nextKey = nextModel?.defaultExampleKey ?? null;
              setExampleKey(nextKey);
              onFocusChange?.(responseFocus(row, nextMedia, nextModel, nextKey));
            }}
          />
          {selected !== null ? (
            <ResponseDetail
              row={selected}
              mediaType={mediaType}
              exampleKey={exampleKey}
              onMediaType={(type) => {
                setMediaType(type);
                const nextModel = selected.contents[type];
                const nextKey = nextModel?.defaultExampleKey ?? null;
                setExampleKey(nextKey);
                if (nextModel !== undefined) {
                  onFocusChange?.(responseFocus(selected, type, nextModel, nextKey));
                }
              }}
              onExampleKey={(key) => {
                setExampleKey(key);
                if (mediaType !== null && media !== undefined) {
                  onFocusChange?.(responseFocus(selected, mediaType, media, key));
                }
              }}
              onHeaderFocus={(focus) => {
                onFocusChange?.(focus);
              }}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

/** Detail for one selected status: description, headers, media/example. */
function ResponseDetail({
  row,
  mediaType,
  exampleKey,
  onMediaType,
  onExampleKey,
  onHeaderFocus,
}: {
  row: OperationResponseRow;
  mediaType: string | null;
  exampleKey: string | null;
  onMediaType: (type: string) => void;
  onExampleKey: (key: string | null) => void;
  onHeaderFocus: (focus: SchemaFocus) => void;
}) {
  const media = mediaType !== null ? row.contents[mediaType] : undefined;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="type-body text-text">{row.description || "—"}</p>
      <ResponseHeaders row={row} onHeaderFocus={onHeaderFocus} />
      {row.emptyContent ? (
        <p className="type-meta text-text-faint">No response body.</p>
      ) : (
        <ResponseBodyControls
          row={row}
          media={media}
          mediaType={mediaType}
          exampleKey={exampleKey}
          onMediaType={onMediaType}
          onExampleKey={onExampleKey}
        />
      )}
    </div>
  );
}

/** Header name/type buttons that emit response SchemaFocus. */
function ResponseHeaders({
  row,
  onHeaderFocus,
}: {
  row: OperationResponseRow;
  onHeaderFocus: (focus: SchemaFocus) => void;
}) {
  if (row.headers.length === 0) {
    return null;
  }
  return (
    <ul className="flex flex-col gap-1" aria-label="Response headers">
      {row.headers.map((header) => (
        <li key={header.name} className="type-data text-text">
          <button
            type="button"
            className={`underline-offset-2 hover:underline ${CONTROL_FOCUS}`}
            onClick={() => {
              onHeaderFocus(header.schemaHandle);
            }}
          >
            {header.name}: {header.typeSummary}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Media/example pickers for a response that has content. */
function ResponseBodyControls({
  row,
  media,
  mediaType,
  exampleKey,
  onMediaType,
  onExampleKey,
}: {
  row: OperationResponseRow;
  media: OperationMediaModel | undefined;
  mediaType: string | null;
  exampleKey: string | null;
  onMediaType: (type: string) => void;
  onExampleKey: (key: string | null) => void;
}) {
  return (
    <>
      <DetailOptionGroup
        name="response-media-type"
        label="Response media type"
        value={mediaType}
        options={row.mediaTypes.map((type) => ({ value: type, label: type }))}
        onChange={onMediaType}
      />
      {media !== undefined && media.namedExamples.length > 0 ? (
        <DetailOptionGroup
          name="response-example"
          label="Response example"
          value={exampleKey}
          options={media.namedExamples.map((example) => ({
            value: example.key,
            label: example.summary ?? example.key,
          }))}
          onChange={onExampleKey}
        />
      ) : null}
      <ExampleValuePanel media={media} exampleKey={exampleKey} />
    </>
  );
}
