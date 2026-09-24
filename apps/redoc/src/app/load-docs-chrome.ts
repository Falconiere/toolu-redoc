/** Route-layer helper: paste text → docs chrome title/version via OpenAPI parse. */
import { parseOpenApiDocument } from "@/domains/openapi/api/parse-openapi-document";

/** Success or failure chrome extracted for the docs shell route. */
export type DocsChromeResult =
  | { ok: true; title: string; version: string }
  | { ok: false; message: string };

/**
 * Parse OpenAPI paste text and map `info` into shell chrome strings.
 * Empty title/version after trim use `"Untitled document"` / `"—"`.
 */
export function loadDocsChrome(input: string): DocsChromeResult {
  const result = parseOpenApiDocument(input);
  if (!result.ok) {
    return { ok: false, message: result.error.message };
  }
  const title = result.document.info.title.trim() || "Untitled document";
  const version = result.document.info.version.trim() || "—";
  return { ok: true, title, version };
}
