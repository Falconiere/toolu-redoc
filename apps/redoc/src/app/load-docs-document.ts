/** Route-layer helper: paste text → chrome + normalized OpenAPI document. */
import type { NormalizedOpenApiDocument } from "@/domains/openapi/api/normalize-openapi-document";
import { parseOpenApiDocument } from "@/domains/openapi/api/parse-openapi-document";

/** Success or failure payload for the docs route composition. */
export type DocsDocumentResult =
  | { ok: true; title: string; version: string; document: NormalizedOpenApiDocument }
  | { ok: false; message: string };

/** Trim a chrome field; blank or missing → fallback. */
function chromeField(value: string | null | undefined, fallback: string): string {
  return (value ?? "").trim() || fallback;
}

/**
 * Parse OpenAPI paste text into shell chrome strings plus the normalized document.
 * Empty title/version after trim use `"Untitled document"` / `"—"`.
 */
export function loadDocsDocument(input: string): DocsDocumentResult {
  const result = parseOpenApiDocument(input);
  if (!result.ok) {
    return { ok: false, message: result.error.message };
  }
  return {
    ok: true,
    title: chromeField(result.document.info.title, "Untitled document"),
    version: chromeField(result.document.info.version, "—"),
    document: result.document,
  };
}
