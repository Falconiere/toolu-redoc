/** Spec load form fields, actions, loading skeleton, and success placeholder. */

import type { RefObject } from "react";

import type { SpecLoadSuccess } from "../api/load-openapi-document";

const fieldClass =
  "w-full border border-border bg-background px-3 py-2 type-body text-text " +
  "focus:border-accent focus:outline-none focus:ring-(--spacing-focus-ring) focus:ring-focus-ring";

const buttonClass =
  "type-button border border-border-strong px-3 py-2 text-text " +
  "hover:border-accent active:translate-y-px duration-(--duration-hover) " +
  "disabled:border-border disabled:bg-disabled-fill disabled:text-disabled-text";

/** Props for {@link SpecLoadForm}. */
export type SpecLoadFormProps = {
  pasteRef: RefObject<HTMLTextAreaElement | null>;
  pasteText: string;
  urlField: string;
  loading: boolean;
  showReset: boolean;
  onPasteTextChange: (value: string) => void;
  onUrlFieldChange: (value: string) => void;
  onParsePaste: () => void;
  onLoadUrl: () => void;
  onCancel: () => void;
  onReset: () => void;
};

/** Paste textarea, URL field, and Load / Parse / Cancel / Reset actions. */
export function SpecLoadForm(props: SpecLoadFormProps) {
  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="type-label text-text-faint">Paste</span>
        <textarea
          ref={props.pasteRef}
          name="paste"
          rows={8}
          className={fieldClass}
          value={props.pasteText}
          onChange={(event) => {
            props.onPasteTextChange(event.target.value);
          }}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="type-label text-text-faint">URL</span>
        <input
          type="url"
          name="url"
          className={fieldClass}
          value={props.urlField}
          onChange={(event) => {
            props.onUrlFieldChange(event.target.value);
          }}
        />
      </label>
      <SpecLoadActions
        loading={props.loading}
        showReset={props.showReset}
        onLoadUrl={props.onLoadUrl}
        onParsePaste={props.onParsePaste}
        onCancel={props.onCancel}
        onReset={props.onReset}
      />
    </form>
  );
}

function SpecLoadActions({
  loading,
  showReset,
  onLoadUrl,
  onParsePaste,
  onCancel,
  onReset,
}: {
  loading: boolean;
  showReset: boolean;
  onLoadUrl: () => void;
  onParsePaste: () => void;
  onCancel: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <button type="button" className={buttonClass} disabled={loading} onClick={onLoadUrl}>
        Load URL
      </button>
      <button type="button" className={buttonClass} disabled={loading} onClick={onParsePaste}>
        Parse paste
      </button>
      {loading ? (
        <button type="button" className={buttonClass} onClick={onCancel}>
          Cancel
        </button>
      ) : null}
      {showReset ? (
        <button type="button" className={buttonClass} disabled={loading} onClick={onReset}>
          Reset
        </button>
      ) : null}
    </div>
  );
}

/** Still skeleton of the result panel — mono progress copy, never a spinner. */
export function SpecLoadSkeleton({ phase }: { phase: "fetching" | "parsing" }) {
  const label = phase === "parsing" ? "loading · parsing" : "loading · fetching";
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="border border-border bg-surface px-4 py-6"
      data-testid="spec-load-skeleton"
    >
      <p className="type-label text-text-faint">{label}</p>
      <div className="mt-4 h-16 border border-dashed border-border-inner bg-surface-inset" />
      <div className="mt-3 h-8 w-1/2 border border-dashed border-border-inner bg-surface-inset" />
    </div>
  );
}

/** Ruled success placeholder until docs chrome lands. */
export function SpecLoadSuccessPanel({ success }: { success: SpecLoadSuccess }) {
  const { document, source } = success;
  const sourceLabel = source.kind === "url" ? `url · ${source.href ?? "(unknown)"}` : "paste";
  return (
    <section
      aria-label="Loaded document"
      className="border border-border bg-surface px-4 py-6"
      data-testid="spec-load-success"
    >
      <h2 className="type-subhead text-text">{document.info.title}</h2>
      <p className="type-data mt-2 text-text-muted">version · {document.info.version}</p>
      <p className="type-meta mt-1 text-text-faint">source · {sourceLabel}</p>
      <p className="type-data mt-3 text-text">operations · {document.operations.length}</p>
      <div
        aria-hidden
        className="mt-6 min-h-40 border border-dashed border-border-inner bg-surface-inset"
      />
    </section>
  );
}
