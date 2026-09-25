/** Compose a public share href from origin + base path + SpecLoadSearch (`url`, `op`). */
import type { SpecLoadSearch } from "@/domains/openapi/api/spec-source-search";

/** Wrap a base path in exactly one leading and one trailing slash (`"a"` → `"/a/"`). */
export function normalizeBasePath(basePath: string): string {
  const trimmed = basePath.replace(/^\/+/, "").replace(/\/+$/, "");
  return trimmed.length === 0 ? "/" : `/${trimmed}/`;
}

/**
 * Build `origin<basePath>?url=…&op=…` from defined search fields only.
 * Callers pass a browser origin (no path); a trailing slash is normalized away.
 * `basePath` is the deploy base (`import.meta.env.BASE_URL`: `/` on Cloudflare,
 * `/<repo>/` on GitHub Pages) and is normalized to leading + trailing `/`.
 * `url` values that themselves contain `?` round-trip as one search value.
 */
export function buildShareHref(origin: string, search: SpecLoadSearch, basePath = "/"): string {
  const base = `${origin.endsWith("/") ? origin.slice(0, -1) : origin}${normalizeBasePath(basePath)}`;
  const params = new URLSearchParams();
  if (search.url !== undefined) {
    params.set("url", search.url);
  }
  if (search.op !== undefined) {
    params.set("op", search.op);
  }
  const query = params.toString();
  return query.length === 0 ? base : `${base}?${query}`;
}
