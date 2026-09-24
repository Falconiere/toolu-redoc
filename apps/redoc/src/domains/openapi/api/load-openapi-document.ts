/** Paste or URL load → parse → structured SpecLoadResult. */

import { fetchOpenApiText } from "./fetch-openapi-text";
import type { NormalizedOpenApiDocument } from "./normalize-openapi-document";
import { parseOpenApiDocument } from "./parse-openapi-document";
import { specLoadError, type SpecLoadError } from "./spec-load-error";

/** Where the OpenAPI bytes came from. */
export type SpecSource = { kind: "paste"; text: string } | { kind: "url"; href: string };

/** Successful load with retained document and source identity. */
export type SpecLoadSuccess = {
  document: NormalizedOpenApiDocument;
  source: {
    kind: "paste" | "url";
    /** Final request URL after redirects for url loads; omitted for paste. */
    href?: string;
    /** Redirect chain length (0 = no redirect). */
    redirectCount: number;
  };
};

/** Result of {@link loadOpenApiDocument}. */
export type SpecLoadResult =
  | { ok: true; value: SpecLoadSuccess }
  | { ok: false; error: SpecLoadError };

/** Options for a single load attempt. */
export type LoadOpenApiDocumentOptions = {
  readonly signal?: AbortSignal;
  /** Override URL fetch budget; defaults to FETCH_TIMEOUT_MS inside fetch. */
  readonly timeoutMs?: number;
};

/**
 * Load an OpenAPI document from paste text or a remote http(s) URL.
 * Paste never hits the network; URL loads only request the source href.
 */
export async function loadOpenApiDocument(
  source: SpecSource,
  options?: LoadOpenApiDocumentOptions,
): Promise<SpecLoadResult> {
  if (source.kind === "paste") {
    return loadFromPaste(source.text);
  }
  return loadFromUrl(source.href, options);
}

function loadFromPaste(text: string): SpecLoadResult {
  return resultFromParse(text, { kind: "paste", redirectCount: 0 });
}

async function loadFromUrl(
  href: string,
  options: LoadOpenApiDocumentOptions | undefined,
): Promise<SpecLoadResult> {
  const fetched = await fetchOpenApiText(href, {
    ...(options?.signal === undefined ? {} : { signal: options.signal }),
    ...(options?.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
  });
  if (!fetched.ok) {
    return fetched;
  }

  return resultFromParse(fetched.value.text, {
    kind: "url",
    href: fetched.value.href,
    redirectCount: fetched.value.redirectCount,
  });
}

/** Parse text and attach source identity on success. */
function resultFromParse(text: string, source: SpecLoadSuccess["source"]): SpecLoadResult {
  const parsed = parseOpenApiDocument(text);
  if (!parsed.ok) {
    return {
      ok: false,
      error: specLoadError(parsed.error.code, parsed.error.message, {
        recovery: "paste",
        ...(parsed.error.path === undefined ? {} : { path: parsed.error.path }),
      }),
    };
  }
  return { ok: true, value: { document: parsed.document, source } };
}
