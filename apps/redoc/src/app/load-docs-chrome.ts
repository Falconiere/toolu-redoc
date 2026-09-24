/** Route-layer helper: paste text → docs chrome title/version via OpenAPI parse. */
import { loadDocsDocument } from "@/app/load-docs-document";

/** Success or failure chrome extracted for the docs shell route. */
export type DocsChromeResult =
  | { ok: true; title: string; version: string }
  | { ok: false; message: string };

/**
 * Parse OpenAPI paste text and map `info` into shell chrome strings.
 * Thin wrapper over `loadDocsDocument` — chrome fields only.
 */
export function loadDocsChrome(input: string): DocsChromeResult {
  const result = loadDocsDocument(input);
  if (!result.ok) {
    return result;
  }
  return { ok: true, title: result.title, version: result.version };
}
