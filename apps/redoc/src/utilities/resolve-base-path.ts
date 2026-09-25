/** Validate the `REDOC_BASE_PATH` build variable into a Vite `base`. */

/** Slash-wrapped path segments: `/`, `/toolu-redoc/`, `/a/b/`. */
const BASE_PATH_PATTERN = /^\/([A-Za-z0-9._-]+\/)*$/;

/**
 * Resolve the public base path the bundle is served from (GitHub Pages serves
 * this repo under `/<repo>/`; Cloudflare serves it at `/`). Unset or empty →
 * `/`. Anything else must start and end with `/`, use URL-safe segment
 * characters, and contain no `.` / `..` segment — a bad value fails the build
 * at config load instead of shipping broken asset URLs.
 */
export function resolveBasePath(raw: string | undefined): string {
  if (raw === undefined || raw.length === 0) {
    return "/";
  }
  const segments = raw.split("/");
  const hasDotSegment = segments.some((segment) => segment === "." || segment === "..");
  if (!BASE_PATH_PATTERN.test(raw) || hasDotSegment) {
    throw new Error(
      `[vite] invalid REDOC_BASE_PATH: ${JSON.stringify(raw)} — expected "/" or a slash-wrapped path such as "/toolu-redoc/"`,
    );
  }
  return raw;
}
