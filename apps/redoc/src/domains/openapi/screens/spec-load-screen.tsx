/** Signal SpecLoadScreen — paste / URL load form, loading skeleton, success handoff. */

import { useEffect, useRef, useState, type RefObject } from "react";

import type { SpecLoadSearch } from "../api/spec-source-search";
import { SpecLoadBanner, SpecLoadErrorBanner } from "../components/spec-load-banner";
import { SpecLoadForm, SpecLoadSkeleton, SpecLoadSuccessPanel } from "../components/spec-load-form";
import { useSpecLoad, type SpecLoadHook } from "../hooks/use-spec-load";

/** Missing-source copy when the share link has no `url` (AC-9). */
export const MISSING_SOURCE_MESSAGE =
  "A pasted OpenAPI document is not in this link. Paste the document to continue.";

/** Props for {@link SpecLoadScreen}. Search comes from the thin `/` route. */
export type SpecLoadScreenProps = {
  search: SpecLoadSearch;
  /** Sync `url` into the location while preserving `op` (parent owns navigate). */
  onSourceUrlChange?: (href: string) => void;
};

/** Paste + URL load UI with Signal loading / banner / success states. */
export function SpecLoadScreen({ search, onSourceUrlChange }: SpecLoadScreenProps) {
  const hook = useSpecLoad();
  const [pasteText, setPasteText] = useState("");
  const [urlField, setUrlField] = useState(search.url ?? "");
  const [phase, setPhase] = useState<"fetching" | "parsing" | null>(null);
  const pasteRef = useRef<HTMLTextAreaElement>(null);
  const loadRef = useRef(hook.load);
  loadRef.current = hook.load;

  useAutoLoadUrl(search.url, loadRef, setPhase);
  useSyncUrlField(search.url, setUrlField);

  const focusPaste = (): void => {
    pasteRef.current?.focus();
  };
  const showReset = hook.success !== null || hook.error !== null;

  return (
    <main className="band min-h-screen px-(--spacing-gutter-md) py-(--spacing-section-y)">
      <div className="mx-auto flex max-w-container-page flex-col gap-6">
        <SpecLoadHeader />
        <SpecLoadNotices
          search={search}
          error={hook.error}
          urlField={urlField}
          loadRef={loadRef}
          setPhase={setPhase}
          onPaste={focusPaste}
          {...(onSourceUrlChange === undefined ? {} : { onSourceUrlChange })}
        />
        <SpecLoadForm
          pasteRef={pasteRef}
          pasteText={pasteText}
          urlField={urlField}
          loading={hook.status === "loading"}
          showReset={showReset}
          onPasteTextChange={setPasteText}
          onUrlFieldChange={setUrlField}
          onParsePaste={() => {
            setPhase("parsing");
            void loadRef.current({ kind: "paste", text: pasteText }).finally(() => {
              setPhase(null);
            });
          }}
          onLoadUrl={() => {
            void runUrlLoad(urlField, {
              load: loadRef.current,
              setPhase,
              ...(onSourceUrlChange === undefined ? {} : { onSourceUrlChange }),
            });
          }}
          onCancel={hook.cancel}
          onReset={hook.reset}
        />
        {hook.status === "loading" ? <SpecLoadSkeleton phase={phase ?? "fetching"} /> : null}
        {hook.success !== null ? <SpecLoadSuccessPanel success={hook.success} /> : null}
      </div>
    </main>
  );
}

function SpecLoadHeader() {
  return (
    <header>
      <h1 className="type-display text-text">
        Spec <span className="text-accent">load</span>
      </h1>
      <p className="type-body-sm mt-2 text-text-muted">
        Paste OpenAPI text or load from an http(s) URL.
      </p>
    </header>
  );
}

function SpecLoadNotices({
  search,
  error,
  urlField,
  loadRef,
  setPhase,
  onSourceUrlChange,
  onPaste,
}: {
  search: SpecLoadSearch;
  error: SpecLoadHook["error"];
  urlField: string;
  loadRef: RefObject<SpecLoadHook["load"]>;
  setPhase: (phase: "fetching" | "parsing" | null) => void;
  onSourceUrlChange?: (href: string) => void;
  onPaste: () => void;
}) {
  return (
    <>
      {search.url === undefined ? (
        <SpecLoadBanner
          message={MISSING_SOURCE_MESSAGE}
          tone="idle"
          recovery="paste"
          onPaste={onPaste}
        />
      ) : null}
      {error !== null ? (
        <SpecLoadErrorBanner
          error={error}
          onPaste={onPaste}
          onRetry={() => {
            void runUrlLoad(urlField, {
              load: loadRef.current,
              setPhase,
              ...(onSourceUrlChange === undefined ? {} : { onSourceUrlChange }),
            });
          }}
        />
      ) : null}
    </>
  );
}

function useSyncUrlField(
  searchUrl: string | undefined,
  setUrlField: (value: string) => void,
): void {
  useEffect(() => {
    if (searchUrl !== undefined) {
      setUrlField(searchUrl);
    }
  }, [searchUrl, setUrlField]);
}

function useAutoLoadUrl(
  searchUrl: string | undefined,
  loadRef: RefObject<SpecLoadHook["load"]>,
  setPhase: (phase: "fetching" | "parsing" | null) => void,
): void {
  const autoKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (searchUrl === undefined || autoKeyRef.current === searchUrl) {
      return;
    }
    autoKeyRef.current = searchUrl;
    setPhase("fetching");
    void loadRef.current({ kind: "url", href: searchUrl }).finally(() => {
      setPhase(null);
    });
  }, [searchUrl, loadRef, setPhase]);
}

async function runUrlLoad(
  rawHref: string,
  options: {
    load: SpecLoadHook["load"];
    setPhase: (phase: "fetching" | "parsing" | null) => void;
    onSourceUrlChange?: (href: string) => void;
  },
): Promise<void> {
  const href = rawHref.trim();
  if (href.length === 0) {
    return;
  }
  options.onSourceUrlChange?.(href);
  options.setPhase("fetching");
  try {
    await options.load({ kind: "url", href });
  } finally {
    options.setPhase(null);
  }
}
