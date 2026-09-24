/** Client-side OpenAPI load orchestration: latest-wins, cancel, retain-last-success. */

import { useRef, useState, type Dispatch, type SetStateAction } from "react";

import {
  loadOpenApiDocument,
  type LoadOpenApiDocumentOptions,
  type SpecLoadSuccess,
  type SpecSource,
} from "@/domains/openapi/api/load-openapi-document";
import type { SpecLoadError } from "@/domains/openapi/api/spec-load-error";

/** Observable load lifecycle for the SpecLoadScreen. */
export type SpecLoadStatus = "idle" | "loading" | "success" | "failure";

/** Hook state: success retained across replacement failures; no Web Storage. */
export type SpecLoadHookState = {
  status: SpecLoadStatus;
  /** Last successful load; kept when a later attempt fails. */
  success: SpecLoadSuccess | null;
  error: SpecLoadError | null;
};

/** Actions returned by {@link useSpecLoad}. */
export type SpecLoadHook = SpecLoadHookState & {
  load: (source: SpecSource, options?: LoadOpenApiDocumentOptions) => Promise<void>;
  cancel: () => void;
  reset: () => void;
};

const INITIAL: SpecLoadHookState = {
  status: "idle",
  success: null,
  error: null,
};

/**
 * Latest load wins: starting B aborts A; late A cannot replace B.
 * Cancel clears loading and keeps prior success; cancelled is not sticky.
 * Reset clears document, source identity, and error (no Web Storage writes).
 */
export function useSpecLoad(): SpecLoadHook {
  const [state, setState] = useState<SpecLoadHookState>(INITIAL);
  const generationRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  return {
    ...state,
    load: (source, options) => runLoad(source, options, { setState, generationRef, abortRef }),
    cancel: () => runCancel({ setState, generationRef, abortRef }),
    reset: () => runReset({ setState, generationRef, abortRef }),
  };
}

type LoadRefs = {
  setState: Dispatch<SetStateAction<SpecLoadHookState>>;
  generationRef: { current: number };
  abortRef: { current: AbortController | null };
};

async function runLoad(
  source: SpecSource,
  options: LoadOpenApiDocumentOptions | undefined,
  refs: LoadRefs,
): Promise<void> {
  refs.abortRef.current?.abort();
  const controller = new AbortController();
  refs.abortRef.current = controller;
  const generation = refs.generationRef.current + 1;
  refs.generationRef.current = generation;

  refs.setState((prev) => ({
    status: "loading",
    success: prev.success,
    error: null,
  }));

  const result = await loadOpenApiDocument(source, {
    ...options,
    signal: mergeSignals(controller.signal, options?.signal),
  });

  if (generation !== refs.generationRef.current) {
    return;
  }
  applyLoadResult(result, refs.setState);
}

function applyLoadResult(
  result: Awaited<ReturnType<typeof loadOpenApiDocument>>,
  setState: Dispatch<SetStateAction<SpecLoadHookState>>,
): void {
  if (result.ok) {
    setState({ status: "success", success: result.value, error: null });
    return;
  }
  if (result.error.code === "cancelled") {
    setState((prev) => ({
      status: prev.success === null ? "idle" : "success",
      success: prev.success,
      error: null,
    }));
    return;
  }
  setState((prev) => ({
    status: "failure",
    success: prev.success,
    error: result.error,
  }));
}

function runCancel(refs: LoadRefs): void {
  refs.abortRef.current?.abort();
  refs.abortRef.current = null;
  refs.generationRef.current += 1;
  refs.setState((prev) => ({
    status: prev.success === null ? "idle" : "success",
    success: prev.success,
    error: null,
  }));
}

function runReset(refs: LoadRefs): void {
  refs.abortRef.current?.abort();
  refs.abortRef.current = null;
  refs.generationRef.current += 1;
  refs.setState(INITIAL);
}

/** Abort when either the hook controller or an external signal fires. */
function mergeSignals(internal: AbortSignal, external: AbortSignal | undefined): AbortSignal {
  if (external === undefined) {
    return internal;
  }
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([internal, external]);
  }
  return mergeSignalsManual(internal, external);
}

function mergeSignalsManual(internal: AbortSignal, external: AbortSignal): AbortSignal {
  const merged = new AbortController();
  const forward = (): void => {
    merged.abort();
  };
  if (internal.aborted || external.aborted) {
    merged.abort();
    return merged.signal;
  }
  internal.addEventListener("abort", forward, { once: true });
  external.addEventListener("abort", forward, { once: true });
  return merged.signal;
}
