/** Agreed OpenAPI parse/load bounds shared with the URL loader (#3). */

/** Maximum UTF-8 byte length of paste/parse input (5 MiB). */
export const MAX_INPUT_BYTES = 5 * 1024 * 1024;

/** eemeli `maxAliasCount` — reject alias bombs without hanging. */
export const MAX_ALIAS_COUNT = 100;

/** Maximum lazy `$ref` expansion depth before a visible boundary node. */
export const MAX_SCHEMA_DEPTH = 25;

/** Fetch timeout for URL loads — enforced by #3, exported for agreement. */
export const FETCH_TIMEOUT_MS = 15_000;
