/** The house HTTP client — GET/POST/PUT/PATCH/DELETE over the Web `fetch` API. */

// No axios. Cross-cutting behaviour (auth, base URL, timeout, credentials) is
// configured once in `createHttpClient`. Responses are `unknown` unless `parse`
// is passed (typically a Zod schema via an arrow: `(b) => Schema.parse(b)`).
// Prefer `getText` / `getResponse` for raw OpenAPI URL bodies.

/** Query values accepted on a request; `undefined` entries are dropped. */
export type HttpQuery = Readonly<Record<string, string | number | boolean | undefined>>;

/**
 * Turns an unknown response body into `T` — throws if the shape is wrong.
 * A Zod schema's `.parse` has exactly this signature; call it from an arrow
 * function so the method keeps its `this`.
 */
export type HttpParser<T> = (body: unknown) => T;

/** Per-request options. */
export type HttpOptions = {
  readonly query?: HttpQuery;
  readonly headers?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
};

/** Per-request options carrying a parser — the typed-response variant. */
export type ParsedHttpOptions<T> = HttpOptions & {
  readonly parse: HttpParser<T>;
};

/** How a client is built: where it points and what it sends on every request. */
export type HttpClientConfig = {
  /** Absolute base URL every path is resolved against. */
  readonly baseUrl: string;
  /** Abort budget for a single request. Default: 8000ms. */
  readonly timeoutMs?: number;
  /** Fetch credentials mode. Default: `"omit"`. */
  readonly credentials?: RequestCredentials;
  /** Resolved before each request — the place for auth/tracing headers. */
  readonly headers?: () => Promise<Record<string, string>> | Record<string, string>;
};

/** One method per verb. Pass `parse` to get a typed body instead of `unknown`. */
export type HttpClient = {
  get(path: string, options?: HttpOptions): Promise<unknown>;
  get<T>(path: string, options: ParsedHttpOptions<T>): Promise<T>;
  /** GET returning raw response text (no content-type JSON parse). */
  getText(path: string, options?: HttpOptions): Promise<string>;
  /**
   * GET returning an ok {@link Response} with the body unread.
   * Use when the caller must stream or byte-cap the body (OpenAPI URL load).
   */
  getResponse(
    path: string,
    options?: HttpOptions,
  ): Promise<{ response: Response; requestUrl: string }>;
  delete(path: string, options?: HttpOptions): Promise<unknown>;
  delete<T>(path: string, options: ParsedHttpOptions<T>): Promise<T>;
  post(path: string, body?: unknown, options?: HttpOptions): Promise<unknown>;
  post<T>(path: string, body: unknown, options: ParsedHttpOptions<T>): Promise<T>;
  put(path: string, body?: unknown, options?: HttpOptions): Promise<unknown>;
  put<T>(path: string, body: unknown, options: ParsedHttpOptions<T>): Promise<T>;
  patch(path: string, body?: unknown, options?: HttpOptions): Promise<unknown>;
  patch<T>(path: string, body: unknown, options: ParsedHttpOptions<T>): Promise<T>;
};

/** Thrown for every non-2xx response; carries the status and the decoded body. */
export class HttpError extends Error {
  readonly status: number;
  readonly url: string;
  readonly body: unknown;

  constructor(status: number, url: string, body: unknown) {
    super(`HTTP ${status} for ${url}`);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

/** Thrown when a request exceeds its timeout budget or its signal aborts. */
export class HttpAbortError extends Error {
  readonly url: string;
  readonly timedOut: boolean;

  constructor(url: string, timedOut: boolean) {
    super(timedOut ? `HTTP request timed out: ${url}` : `HTTP request aborted: ${url}`);
    this.name = "HttpAbortError";
    this.url = url;
    this.timedOut = timedOut;
  }
}

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_CREDENTIALS: RequestCredentials = "omit";

// `error.name` rather than `instanceof DOMException`: Hermes (React Native) does
// not expose DOMException, and every runtime we target names the abort rejection
// 'AbortError'.
function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

// `JSON.parse` retyped to hand back `unknown`. Assigning the *function* (not its
// result) keeps `any` from ever entering the module.
const parseJson: (text: string) => unknown = JSON.parse;

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

function buildUrl(baseUrl: string, path: string, query: HttpQuery | undefined): string {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const url = new URL(path.replace(/^\/+/, ""), base);
  if (query !== undefined) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function decode(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return undefined;
  }
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("json") ? parseJson(text) : text;
}

type AbortGate = {
  controller: AbortController;
  readonly timedOut: boolean;
  forwardAbort: () => void;
  timer: ReturnType<typeof setTimeout>;
  signal: AbortSignal | undefined;
};

/** Wire timeout + caller signal into one AbortController. */
function openAbortGate(timeoutMs: number, signal: AbortSignal | undefined): AbortGate {
  const controller = new AbortController();
  let timedOut = false;
  const forwardAbort = (): void => {
    controller.abort();
  };
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  // A signal that is ALREADY aborted never fires 'abort' again, so adding a
  // listener to one would let the request run to completion after the caller
  // had cancelled it. Check the current state first.
  if (signal?.aborted === true) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", forwardAbort);
  }
  return {
    controller,
    get timedOut() {
      return timedOut;
    },
    forwardAbort,
    timer,
    signal,
  };
}

function closeAbortGate(gate: AbortGate): void {
  clearTimeout(gate.timer);
  gate.signal?.removeEventListener("abort", gate.forwardAbort);
}

/** Builds a client bound to one base URL. Export one instance per API, not per call. */
export function createHttpClient(config: HttpClientConfig): HttpClient {
  const credentials = config.credentials ?? DEFAULT_CREDENTIALS;

  async function request(
    method: HttpMethod,
    path: string,
    body: unknown,
    options: HttpOptions | undefined,
  ): Promise<{ response: Response; url: string; timedOut: boolean }> {
    const url = buildUrl(config.baseUrl, path, options?.query);
    const timeoutMs = options?.timeoutMs ?? config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const gate = openAbortGate(timeoutMs, options?.signal);

    const headers: Record<string, string> = { accept: "application/json" };
    const configured = await config.headers?.();
    if (configured !== undefined) {
      Object.assign(headers, configured);
    }
    if (options?.headers !== undefined) {
      Object.assign(headers, options.headers);
    }

    let payload: string | undefined;
    if (body !== undefined) {
      payload = typeof body === "string" ? body : JSON.stringify(body);
      headers["content-type"] ??= "application/json";
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        credentials,
        signal: gate.controller.signal,
        ...(payload === undefined ? {} : { body: payload }),
      });
      return { response, url, timedOut: gate.timedOut };
    } catch (error) {
      // Test the error, not `controller.signal.aborted`: once the timeout has
      // fired, the signal reads aborted for the rest of this scope, so a genuine
      // network or parse failure arriving afterwards would be relabelled a
      // timeout and the real cause lost.
      if (isAbortError(error)) {
        throw new HttpAbortError(url, gate.timedOut);
      }
      throw error;
    } finally {
      closeAbortGate(gate);
    }
  }

  async function send(
    method: HttpMethod,
    path: string,
    body: unknown,
    options: HttpOptions | undefined,
  ): Promise<unknown> {
    const { response, url } = await request(method, path, body, options);
    const decoded = await decode(response);
    if (!response.ok) {
      throw new HttpError(response.status, url, decoded);
    }
    return decoded;
  }

  async function run(
    method: HttpMethod,
    path: string,
    body: unknown,
    options: HttpOptions | undefined,
  ): Promise<unknown> {
    const decoded = await send(method, path, body, options);
    const parse = options === undefined ? undefined : readParser(options);
    return parse === undefined ? decoded : parse(decoded);
  }

  function get(path: string, options?: HttpOptions): Promise<unknown>;
  function get<T>(path: string, options: ParsedHttpOptions<T>): Promise<T>;
  function get(path: string, options?: HttpOptions): Promise<unknown> {
    return run("GET", path, undefined, options);
  }

  async function getText(path: string, options?: HttpOptions): Promise<string> {
    const { response, url } = await request("GET", path, undefined, options);
    const text = await response.text();
    if (!response.ok) {
      throw new HttpError(response.status, url, text);
    }
    return text;
  }

  async function getResponse(
    path: string,
    options?: HttpOptions,
  ): Promise<{ response: Response; requestUrl: string }> {
    const { response, url } = await request("GET", path, undefined, options);
    if (!response.ok) {
      // Cap error body reads so a huge 4xx/5xx payload cannot blow memory.
      const text = await response.text();
      const capped = text.length > 64 * 1024 ? `${text.slice(0, 64 * 1024)}…` : text;
      throw new HttpError(response.status, url, capped);
    }
    return { response, requestUrl: url };
  }

  function del(path: string, options?: HttpOptions): Promise<unknown>;
  function del<T>(path: string, options: ParsedHttpOptions<T>): Promise<T>;
  function del(path: string, options?: HttpOptions): Promise<unknown> {
    return run("DELETE", path, undefined, options);
  }

  function post(path: string, body?: unknown, options?: HttpOptions): Promise<unknown>;
  function post<T>(path: string, body: unknown, options: ParsedHttpOptions<T>): Promise<T>;
  function post(path: string, body?: unknown, options?: HttpOptions): Promise<unknown> {
    return run("POST", path, body, options);
  }

  function put(path: string, body?: unknown, options?: HttpOptions): Promise<unknown>;
  function put<T>(path: string, body: unknown, options: ParsedHttpOptions<T>): Promise<T>;
  function put(path: string, body?: unknown, options?: HttpOptions): Promise<unknown> {
    return run("PUT", path, body, options);
  }

  function patch(path: string, body?: unknown, options?: HttpOptions): Promise<unknown>;
  function patch<T>(path: string, body: unknown, options: ParsedHttpOptions<T>): Promise<T>;
  function patch(path: string, body?: unknown, options?: HttpOptions): Promise<unknown> {
    return run("PATCH", path, body, options);
  }

  return { get, getText, getResponse, delete: del, post, put, patch };
}

/** Reads the optional `parse` guard off an options bag without asserting a type. */
function readParser(
  options: HttpOptions | ParsedHttpOptions<unknown>,
): HttpParser<unknown> | undefined {
  return "parse" in options ? options.parse : undefined;
}
