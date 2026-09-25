/** Signal SpecLoadScreen — paste / URL load form, loading skeleton, success handoff. */

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import type { SpecLoadSuccess } from "@/domains/openapi/api/load-openapi-document";
import type { SpecLoadSearch } from "@/domains/openapi/api/spec-source-search";
import { SpecLoadBanner, SpecLoadErrorBanner } from "@/domains/openapi/components/spec-load-banner";
import {
  SpecLoadForm,
  SpecLoadSkeleton,
  SpecLoadSuccessPanel,
} from "@/domains/openapi/components/spec-load-form";
import { useSpecLoad, type SpecLoadHook } from "@/domains/openapi/hooks/use-spec-load";

/** Missing-source copy when the share link has no `url` (AC-9). */
export const MISSING_SOURCE_MESSAGE =
  "A pasted OpenAPI document is not in this link. Paste the document to continue.";

/** Args passed to {@link SpecLoadScreenProps.renderLoaded}. */
export type SpecLoadRenderLoadedArgs = {
  success: SpecLoadSuccess;
  reset: () => void;
};

/** Props for {@link SpecLoadScreen}. Search comes from the thin `/` route. */
export type SpecLoadScreenProps = {
  search: SpecLoadSearch;
  /** Sync `url` into the location while preserving `op` (parent owns navigate). */
  onSourceUrlChange?: (href: string) => void;
  /**
   * When set, replaces the entire load chrome after success (docs viewer).
   * When omitted, keeps the legacy success panel (tests / fallback).
   */
  renderLoaded?: (args: SpecLoadRenderLoadedArgs) => ReactNode;
};

/** Paste + URL load UI with Signal loading / banner / success states. */
export function SpecLoadScreen({ search, onSourceUrlChange, renderLoaded }: SpecLoadScreenProps) {
  const hook = useSpecLoad();
  const [pasteText, setPasteText] = useState("");
  const [urlField, setUrlField] = useState(search.url ?? "");
  const pasteRef = useRef<HTMLTextAreaElement>(null);
  const loadRef = useRef(hook.load);
  loadRef.current = hook.load;
  /** URLs already claimed by a manual load so auto-load does not double-fetch. */
  const claimedUrlRef = useRef<string | null>(null);

  useAutoLoadUrl(search.url, loadRef, claimedUrlRef);
  useSyncUrlField(search.url, setUrlField);

  if (hook.success !== null && renderLoaded !== undefined) {
    return (
      <div className="band min-h-screen" data-testid="loaded-with-optional-error">
        {hook.error !== null ? (
          <div className="border-b border-border px-4 py-3">
            <SpecLoadErrorBanner
              error={hook.error}
              onPaste={() => {
                pasteRef.current?.focus();
              }}
              onRetry={() => {
                void runUrlLoad(urlField, {
                  load: loadRef.current,
                  claimedUrlRef,
                  ...(onSourceUrlChange === undefined ? {} : { onSourceUrlChange }),
                });
              }}
            />
          </div>
        ) : null}
        {renderLoaded({ success: hook.success, reset: hook.reset })}
      </div>
    );
  }

  const focusPaste = (): void => {
    pasteRef.current?.focus();
  };
  const showReset = hook.success !== null || hook.error !== null;
  const sourceUrlChangeProps = onSourceUrlChange === undefined ? {} : { onSourceUrlChange };

  return (
    <main className="band min-h-screen px-(--spacing-gutter-md) py-(--spacing-section-y)">
      <div className="mx-auto flex max-w-container-page flex-col gap-6">
        <SpecLoadHeader />
        <SpecLoadNotices
          search={search}
          error={hook.error}
          urlField={urlField}
          loadRef={loadRef}
          onPaste={focusPaste}
          claimedUrlRef={claimedUrlRef}
          {...sourceUrlChangeProps}
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
            void loadRef.current({ kind: "paste", text: pasteText });
          }}
          onLoadUrl={() => {
            void runUrlLoad(urlField, {
              load: loadRef.current,
              claimedUrlRef,
              ...sourceUrlChangeProps,
            });
          }}
          onCancel={hook.cancel}
          onReset={hook.reset}
        />
        {hook.status === "loading" ? <SpecLoadSkeleton /> : null}
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
  onSourceUrlChange,
  onPaste,
  claimedUrlRef,
}: {
  search: SpecLoadSearch;
  error: SpecLoadHook["error"];
  urlField: string;
  loadRef: RefObject<SpecLoadHook["load"]>;
  onSourceUrlChange?: (href: string) => void;
  onPaste: () => void;
  claimedUrlRef: RefObject<string | null>;
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
              claimedUrlRef,
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
  claimedUrlRef: RefObject<string | null>,
): void {
  const autoKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (searchUrl === undefined || autoKeyRef.current === searchUrl) {
      return;
    }
    if (claimedUrlRef.current === searchUrl) {
      autoKeyRef.current = searchUrl;
      return;
    }
    autoKeyRef.current = searchUrl;
    void loadRef.current({ kind: "url", href: searchUrl });
  }, [searchUrl, loadRef, claimedUrlRef]);
}

async function runUrlLoad(
  rawHref: string,
  options: {
    load: SpecLoadHook["load"];
    claimedUrlRef: RefObject<string | null>;
    onSourceUrlChange?: (href: string) => void;
  },
): Promise<void> {
  const href = rawHref.trim();
  if (href.length === 0) {
    return;
  }
  // Claim before navigate so useAutoLoadUrl skips the duplicate fetch.
  options.claimedUrlRef.current = href;
  options.onSourceUrlChange?.(href);
  await options.load({ kind: "url", href });
}
