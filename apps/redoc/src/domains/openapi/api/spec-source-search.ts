/** Per-field coerce for `/` share search params (`url`, `op`). Never throws. */

/** Max length for the `url` search value (source href as one param). */
export const SPEC_LOAD_SEARCH_URL_MAX = 8192;

/** Max length for the opaque `op` search value (operation identity). */
export const SPEC_LOAD_SEARCH_OP_MAX = 4096;

/** Validated `/` search — invalid fields become `undefined`. */
export type SpecLoadSearch = {
  url?: string;
  op?: string;
};

/**
 * Coerce a single search field: non-string, empty, or oversize → `undefined`.
 * Does not throw; used by {@link validateSpecLoadSearch}.
 */
export function optionalSearchString(max: number, value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  if (value.length === 0 || value.length > max) {
    return undefined;
  }
  return value;
}

/**
 * Per-field `validateSearch` for the SpecLoadScreen route.
 * Malformed/`url`/`op` values become `undefined` without rejecting the route.
 */
export function validateSpecLoadSearch(raw: Record<string, unknown>): SpecLoadSearch {
  const url = optionalSearchString(SPEC_LOAD_SEARCH_URL_MAX, raw.url);
  const op = optionalSearchString(SPEC_LOAD_SEARCH_OP_MAX, raw.op);
  return {
    ...(url === undefined ? {} : { url }),
    ...(op === undefined ? {} : { op }),
  };
}
