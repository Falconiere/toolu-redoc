/** Honest network / mixed-content guidance for OpenAPI URL load failures. */

/**
 * User-facing copy for opaque fetch failures.
 * Names connectivity and browser blocking (CORS possible); never "CORS confirmed".
 * When the page is HTTPS and the source is `http:`, also mentions mixed content.
 */
export function networkErrorMessage(
  sourceHref: string,
  options?: { pageProtocol?: string },
): string {
  const pageProtocol = options?.pageProtocol ?? readPageProtocol();
  const mixed =
    pageProtocol === "https:" && isHttpSource(sourceHref)
      ? " Loading an http:// URL from an https:// page can also fail due to mixed content."
      : "";

  return (
    "Could not reach the OpenAPI URL. This may be a connectivity problem or the browser " +
    "blocking the request (for example CORS)." +
    mixed +
    " You can paste the document instead."
  );
}

/** True when `href` parses as an `http:` URL. */
function isHttpSource(href: string): boolean {
  try {
    return new URL(href).protocol === "http:";
  } catch {
    return false;
  }
}

/** Current page protocol when `location` exists; otherwise `http:`. */
function readPageProtocol(): string {
  try {
    const protocol = globalThis.location.protocol;
    return typeof protocol === "string" ? protocol : "http:";
  } catch {
    return "http:";
  }
}
