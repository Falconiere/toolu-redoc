import { createServer, type IncomingMessage, type Server } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import { http } from "@/api/http-client";
import { createHttpClient, HttpAbortError, HttpError } from "@/utilities/http";

type ListeningServer = {
  baseUrl: string;
  close: () => Promise<void>;
  sawCookieHeader: boolean;
};

let active: ListeningServer | undefined;

afterEach(async () => {
  if (active !== undefined) {
    await active.close();
    active = undefined;
  }
});

/** Start a tiny ephemeral server for http-client integration checks. */
async function listen(
  handler: (req: IncomingMessage) => { status: number; body: string; contentType?: string },
): Promise<ListeningServer> {
  const state = {
    sawCookieHeader: false,
  };

  const server: Server = createServer((req, res) => {
    state.sawCookieHeader = req.headers.cookie !== undefined;
    const result = handler(req);
    const body = Buffer.from(result.body, "utf8");
    res.writeHead(result.status, {
      "Content-Type": result.contentType ?? "application/json; charset=utf-8",
      "Content-Length": body.byteLength,
      "Set-Cookie": "session=fixture-secret; Path=/",
    });
    res.end(body);
  });

  const listening = await new Promise<ListeningServer>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("test server failed to bind"));
        return;
      }
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        sawCookieHeader: false,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => {
              if (error !== undefined) {
                closeReject(error);
                return;
              }
              closeResolve();
            });
          }),
      });
    });
  });

  Object.defineProperty(listening, "sawCookieHeader", {
    get: () => state.sawCookieHeader,
  });

  active = listening;
  return listening;
}

describe("utilities/http + api/http-client", () => {
  it("GETs JSON from a real local server with credentials omit", async () => {
    const server = await listen(() => ({
      status: 200,
      body: JSON.stringify({ ok: true }),
    }));

    const originalFetch = globalThis.fetch;
    let seenCredentials: RequestCredentials | undefined;
    globalThis.fetch = (input, init) => {
      seenCredentials = init?.credentials;
      return originalFetch(input, init);
    };

    try {
      const client = createHttpClient({
        baseUrl: server.baseUrl,
        credentials: "omit",
      });
      const body = await client.get("/", {
        parse: (value) => {
          if (value !== null && typeof value === "object" && "ok" in value && value.ok === true) {
            return value;
          }
          throw new Error("unexpected body");
        },
      });
      expect(body).toEqual({ ok: true });
      expect(seenCredentials).toBe("omit");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("configured http export omits credentials and returns getText", async () => {
    const server = await listen(() => ({
      status: 200,
      body: "openapi: 3.0.3\n",
      contentType: "text/plain; charset=utf-8",
    }));

    const originalFetch = globalThis.fetch;
    let seenCredentials: RequestCredentials | undefined;
    globalThis.fetch = (input, init) => {
      seenCredentials = init?.credentials;
      return originalFetch(input, init);
    };

    try {
      // Absolute URL so BASE_API_URL does not matter for resolution.
      const text = await http.getText(`${server.baseUrl}/spec.yaml`);
      expect(text).toBe("openapi: 3.0.3\n");
      expect(seenCredentials).toBe("omit");
      expect(server.sawCookieHeader).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("does not send cookies on a follow-up request (credentials omit)", async () => {
    const server = await listen(() => ({
      status: 200,
      body: JSON.stringify({ ok: true }),
    }));
    const client = createHttpClient({ baseUrl: server.baseUrl, credentials: "omit" });
    await client.get("/");
    await client.get("/");
    expect(server.sawCookieHeader).toBe(false);
  });

  it("throws HttpError on non-2xx", async () => {
    const server = await listen(() => ({ status: 404, body: "missing" }));
    const client = createHttpClient({ baseUrl: server.baseUrl });
    await expect(client.getText("/missing")).rejects.toBeInstanceOf(HttpError);
  });

  it("throws HttpAbortError when the caller aborts", async () => {
    const server = await listen(() => ({ status: 200, body: "{}" }));
    const client = createHttpClient({ baseUrl: server.baseUrl, timeoutMs: 5_000 });
    const controller = new AbortController();
    controller.abort();
    await expect(client.get("/", { signal: controller.signal })).rejects.toBeInstanceOf(
      HttpAbortError,
    );
  });

  it("rejects a closed port with a network error (not HttpError)", async () => {
    const client = createHttpClient({
      baseUrl: "http://127.0.0.1:1",
      timeoutMs: 1_000,
    });
    try {
      await client.getText("/");
      expect.fail("expected network failure");
    } catch (error) {
      expect(error).not.toBeInstanceOf(HttpError);
      expect(error).not.toBeInstanceOf(HttpAbortError);
    }
  });
});
