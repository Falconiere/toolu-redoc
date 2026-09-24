/** App-configured HTTP client — credentials omitted; use for all non-oRPC fetches. */

import { BASE_API_URL, REQUEST_TIMEOUT_MS } from "@/constants/env";
import { createHttpClient } from "@/utilities/http";

/**
 * Shared `http` instance for third-party / absolute URL loads.
 * Domains import this module — never bare `fetch`.
 */
export const http = createHttpClient({
  baseUrl: BASE_API_URL,
  timeoutMs: REQUEST_TIMEOUT_MS,
  credentials: "omit",
});
