/** Gate OpenAPI source URLs to absolute http(s) without userinfo. */

/** Structured rejection for a disallowed source URL. */
export type SpecSourceUrlError = {
  code: "disallowed_url";
  message: string;
};

/** Result of {@link validateSpecSourceUrl}. */
export type ValidateSpecSourceUrlResult =
  | { ok: true; href: string }
  | { ok: false; error: SpecSourceUrlError };

/**
 * Accept only absolute `http:` / `https:` URLs with no userinfo.
 * Rejects empty, relative, `file:`, `data:`, and `user:pass@host` forms.
 */
export function validateSpecSourceUrl(raw: string): ValidateSpecSourceUrlResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return disallowed("Source URL is empty.");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return disallowed("Source URL must be an absolute http(s) URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return disallowed(`Source URL scheme "${url.protocol}" is not allowed; use http or https.`);
  }

  if (url.username.length > 0 || url.password.length > 0) {
    return disallowed("Source URL must not include userinfo (username or password).");
  }

  return { ok: true, href: url.href };
}

function disallowed(message: string): ValidateSpecSourceUrlResult {
  return { ok: false, error: { code: "disallowed_url", message } };
}
