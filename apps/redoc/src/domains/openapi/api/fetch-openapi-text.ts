/** Fetch OpenAPI source text via the configured HTTP client (byte-capped). */

import { http } from "@/api/http-client";
import { HttpAbortError, HttpError } from "@/utilities/http";

import { FETCH_TIMEOUT_MS, MAX_INPUT_BYTES } from "./openapi-limits";
import { networkErrorMessage } from "./network-error-message";
import { specLoadError, type SpecLoadError } from "./spec-load-error";
import { validateSpecSourceUrl } from "./validate-spec-source-url";

/** Successful URL body read before parse. */
export type FetchOpenApiTextSuccess = {
  text: string;
  /** Final response URL after redirects. */
  href: string;
  /** Redirect chain length (0 = no redirect; ≥1 when final URL differs). */
  redirectCount: number;
};

/** Result of {@link fetchOpenApiText}. */
export type FetchOpenApiTextResult =
  | { ok: true; value: FetchOpenApiTextSuccess }
  | { ok: false; error: SpecLoadError };

/** Options for a single OpenAPI URL fetch. */
export type FetchOpenApiTextOptions = {
  readonly signal?: AbortSignal;
  /** Override fetch budget; defaults to {@link FETCH_TIMEOUT_MS}. */
  readonly timeoutMs?: number;
};

/**
 * Validate `href`, GET via `http` with credentials omit, byte-cap the body,
 * and HTML-sniff before parse. Never uses bare `fetch` in this module.
 * Timeout covers headers **and** body read.
 */
export async function fetchOpenApiText(
  href: string,
  options?: FetchOpenApiTextOptions,
): Promise<FetchOpenApiTextResult> {
  const validated = validateSpecSourceUrl(href);
  if (!validated.ok) {
    return {
      ok: false,
      error: specLoadError("disallowed_url", validated.error.message, { recovery: "paste" }),
    };
  }

  if (options?.signal?.aborted === true) {
    return cancelledResult();
  }

  const timeoutMs = options?.timeoutMs ?? FETCH_TIMEOUT_MS;
  const gate = openLoadAbortGate(timeoutMs, options?.signal);

  try {
    const httpOptions = {
      timeoutMs,
      headers: { accept: "application/json, text/plain, */*" },
      signal: gate.signal,
    };
    const { response, requestUrl } = await http.getResponse(validated.href, httpOptions);
    return await readOkResponse(response, requestUrl, gate.signal);
  } catch (cause) {
    if (gate.timedOut) {
      return {
        ok: false,
        error: specLoadError("timeout", "The request timed out. Try again.", {
          recovery: "retry",
        }),
      };
    }
    return mapFetchFailure(cause, validated.href);
  } finally {
    closeLoadAbortGate(gate);
  }
}

/** Read a 2xx body with {@link MAX_INPUT_BYTES}, then HTML-sniff. */
async function readOkResponse(
  response: Response,
  requestUrl: string,
  signal: AbortSignal | undefined,
): Promise<FetchOpenApiTextResult> {
  const body = await readBodyBounded(response, MAX_INPUT_BYTES, signal);
  if (!body.ok) {
    return { ok: false, error: body.error };
  }

  if (looksLikeHtml(body.text)) {
    return {
      ok: false,
      error: specLoadError(
        "html_body",
        "The URL returned an HTML page (for example a login form), not an OpenAPI document.",
        { recovery: "paste" },
      ),
    };
  }

  const finalHref = responseUrlOr(requestUrl, response);
  const finalValidated = validateSpecSourceUrl(finalHref);
  if (!finalValidated.ok) {
    return {
      ok: false,
      error: specLoadError("disallowed_url", finalValidated.error.message, { recovery: "paste" }),
    };
  }

  return {
    ok: true,
    value: {
      text: body.text,
      href: finalValidated.href,
      redirectCount: finalValidated.href === requestUrl ? 0 : 1,
    },
  };
}

/** Accumulate response bytes until done, oversize, or abort. */
async function readBodyBounded(
  response: Response,
  maxBytes: number,
  signal: AbortSignal | undefined,
): Promise<{ ok: true; text: string } | { ok: false; error: SpecLoadError }> {
  const reader = response.body?.getReader();
  if (reader === undefined) {
    return { ok: true, text: "" };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  const pump = async (): Promise<
    { ok: true; text: string } | { ok: false; error: SpecLoadError }
  > => {
    if (signal?.aborted === true) {
      await reader.cancel();
      return { ok: false, error: cancelledError() };
    }
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch (cause) {
      if (isAbortCause(cause)) {
        return { ok: false, error: cancelledError() };
      }
      throw cause;
    }
    if (chunk.done) {
      return { ok: true, text: new TextDecoder("utf-8").decode(concatChunks(chunks, total)) };
    }
    total += chunk.value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return {
        ok: false,
        error: specLoadError(
          "oversize",
          `Document exceeds the ${maxBytes} UTF-8 byte limit while downloading.`,
          { recovery: "paste" },
        ),
      };
    }
    chunks.push(chunk.value);
    return pump();
  };

  return pump();
}

/** Map http-client / network failures onto {@link SpecLoadError}. */
function mapFetchFailure(cause: unknown, sourceHref: string): FetchOpenApiTextResult {
  if (cause instanceof HttpError) {
    return {
      ok: false,
      error: specLoadError("http_status", `The server returned HTTP ${cause.status}.`, {
        httpStatus: cause.status,
        recovery: "retry",
      }),
    };
  }
  if (cause instanceof HttpAbortError) {
    if (cause.timedOut) {
      return {
        ok: false,
        error: specLoadError("timeout", "The request timed out. Try again.", {
          recovery: "retry",
        }),
      };
    }
    return cancelledResult();
  }
  if (isAbortCause(cause)) {
    return cancelledResult();
  }
  return {
    ok: false,
    error: specLoadError("network", networkErrorMessage(sourceHref), { recovery: "paste" }),
  };
}

function cancelledResult(): FetchOpenApiTextResult {
  return { ok: false, error: cancelledError() };
}

function cancelledError(): SpecLoadError {
  return specLoadError("cancelled", "The request was cancelled.");
}

/** True when trimmed body looks like an HTML document (case-insensitive). */
function looksLikeHtml(text: string): boolean {
  const trimmed = text.trimStart().toLowerCase();
  return trimmed.startsWith("<!doctype html") || trimmed.startsWith("<html");
}

function responseUrlOr(requestUrl: string, response: Response): string {
  return response.url.length > 0 ? response.url : requestUrl;
}

function isAbortCause(cause: unknown): boolean {
  return cause instanceof Error && cause.name === "AbortError";
}

function concatChunks(chunks: readonly Uint8Array[], total: number): Uint8Array {
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

type LoadAbortGate = {
  signal: AbortSignal;
  timedOut: boolean;
  timer: ReturnType<typeof setTimeout>;
  forwardAbort: () => void;
  outer: AbortSignal | undefined;
};

/** Abort covering the whole URL load (headers + body). */
function openLoadAbortGate(timeoutMs: number, outer: AbortSignal | undefined): LoadAbortGate {
  const controller = new AbortController();
  const gate: LoadAbortGate = {
    signal: controller.signal,
    timedOut: false,
    timer: setTimeout(() => {
      gate.timedOut = true;
      controller.abort();
    }, timeoutMs),
    forwardAbort: () => {
      controller.abort();
    },
    outer,
  };
  if (outer?.aborted === true) {
    controller.abort();
  } else {
    outer?.addEventListener("abort", gate.forwardAbort);
  }
  return gate;
}

function closeLoadAbortGate(gate: LoadAbortGate): void {
  clearTimeout(gate.timer);
  gate.outer?.removeEventListener("abort", gate.forwardAbort);
}
