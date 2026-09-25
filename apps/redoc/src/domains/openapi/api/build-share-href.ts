/** Compose a public share href from origin + SpecLoadSearch (`url`, `op`). */
import type { SpecLoadSearch } from "@/domains/openapi/api/spec-source-search";

/**
 * Build `origin/?url=…&op=…` from defined search fields only.
 * Callers pass a browser origin (no path); a trailing slash is normalized away
 * before appending `/`. `url` values that themselves contain `?` round-trip as
 * one search value.
 */
export function buildShareHref(origin: string, search: SpecLoadSearch): string {
  const base = origin.endsWith("/") ? origin.slice(0, -1) : origin;
  const params = new URLSearchParams();
  if (search.url !== undefined) {
    params.set("url", search.url);
  }
  if (search.op !== undefined) {
    params.set("op", search.op);
  }
  const query = params.toString();
  return query.length === 0 ? `${base}/` : `${base}/?${query}`;
}
