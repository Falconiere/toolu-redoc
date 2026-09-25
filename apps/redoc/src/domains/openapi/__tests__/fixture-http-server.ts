/** Ephemeral Node HTTP server serving OpenAPI load fixtures for Vitest. */

import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { EXAMPLE_SPECS } from "@/domains/openapi/api/example-specs";
import { MAX_INPUT_BYTES } from "@/domains/openapi/api/openapi-limits";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
/** The app's `public/examples/` — the same bytes the gallery ships. */
const examplesDir = join(dirname(fileURLToPath(import.meta.url)), "../../../../public/examples");

/** One observed request against the fixture server. */
export type FixtureRequestLogEntry = {
  method: string;
  url: string;
};

/** Handle returned by {@link startFixtureHttpServer}. */
export type FixtureHttpServer = {
  /** Origin including ephemeral port, e.g. `http://127.0.0.1:54321`. */
  baseUrl: string;
  /** Stop listening and close idle connections. */
  close: () => Promise<void>;
  /** Chronological request log (method + url path). */
  requestLog: FixtureRequestLogEntry[];
};

const petstoreJson = (): Buffer => readFileSync(join(fixturesDir, "petstore-3.0.json"));
const loginHtml = (): Buffer => readFileSync(join(fixturesDir, "fbad-html-login.html"));

/** CORS headers so Chromium preview-smoke can URL-load across localhost ports. */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
} as const;

/** Write a body larger than {@link MAX_INPUT_BYTES} without Content-Length. */
function writeOversizeStream(res: ServerResponse): void {
  res.writeHead(200, {
    "Content-Type": "application/octet-stream",
    "Transfer-Encoding": "chunked",
    ...CORS_HEADERS,
  });
  const chunk = Buffer.alloc(64 * 1024, 0x61);
  let sent = 0;
  const target = MAX_INPUT_BYTES + 1;
  const pump = (): void => {
    while (sent < target) {
      const next = Math.min(chunk.length, target - sent);
      const ok = res.write(chunk.subarray(0, next));
      sent += next;
      if (!ok) {
        res.once("drain", pump);
        return;
      }
    }
    res.end();
  };
  pump();
}

function sendBuffer(res: ServerResponse, status: number, contentType: string, body: Buffer): void {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": body.byteLength,
    ...CORS_HEADERS,
  });
  res.end(body);
}

function pathnameOf(req: IncomingMessage): string {
  const raw = req.url ?? "/";
  const q = raw.indexOf("?");
  return q === -1 ? raw : raw.slice(0, q);
}

function delayMs(req: IncomingMessage): number {
  try {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const raw = url.searchParams.get("ms");
    if (raw === null || raw.length === 0) {
      return 50;
    }
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 50;
  } catch {
    return 50;
  }
}

/** Serve `/examples/<file>` for gallery manifest files only; false when not an example route. */
function sendExample(path: string, res: ServerResponse): boolean {
  if (!path.startsWith("/examples/")) {
    return false;
  }
  const spec = EXAMPLE_SPECS.find((entry) => `/examples/${entry.file}` === path);
  if (spec === undefined) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...CORS_HEADERS });
    res.end("not a gallery example");
    return true;
  }
  const contentType =
    spec.format === "json" ? "application/json; charset=utf-8" : "application/yaml; charset=utf-8";
  sendBuffer(res, 200, contentType, readFileSync(join(examplesDir, spec.file)));
  return true;
}

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const method = req.method ?? "GET";
  const path = pathnameOf(req);

  if (method === "OPTIONS") {
    res.writeHead(204, { ...CORS_HEADERS });
    res.end();
    return;
  }

  if (method !== "GET" && method !== "HEAD") {
    res.writeHead(405, { ...CORS_HEADERS }).end();
    return;
  }

  if (sendExample(path, res)) {
    return;
  }

  switch (path) {
    case "/fixtures/petstore.json": {
      sendBuffer(res, 200, "application/json; charset=utf-8", petstoreJson());
      return;
    }
    case "/fixtures/petstore.txt": {
      sendBuffer(res, 200, "text/plain; charset=utf-8", petstoreJson());
      return;
    }
    case "/fixtures/redirect": {
      res.writeHead(302, { Location: "/fixtures/petstore.json", ...CORS_HEADERS });
      res.end();
      return;
    }
    case "/fixtures/missing": {
      res.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8",
        ...CORS_HEADERS,
      });
      res.end("not found");
      return;
    }
    case "/fixtures/error": {
      res.writeHead(500, {
        "Content-Type": "text/plain; charset=utf-8",
        ...CORS_HEADERS,
      });
      res.end("internal error");
      return;
    }
    case "/fixtures/login.html": {
      sendBuffer(res, 200, "text/html; charset=utf-8", loginHtml());
      return;
    }
    case "/fixtures/delayed": {
      const wait = delayMs(req);
      const body = petstoreJson();
      setTimeout(() => {
        sendBuffer(res, 200, "application/json; charset=utf-8", body);
      }, wait);
      return;
    }
    case "/fixtures/oversize": {
      writeOversizeStream(res);
      return;
    }
    default: {
      res.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8",
        ...CORS_HEADERS,
      });
      res.end("unknown fixture route");
    }
  }
}

/**
 * Bind an ephemeral local HTTP server for OpenAPI URL-load tests.
 * Routes: petstore JSON/plain, redirect, 404/500, HTML login, delayed, oversize stream,
 * and `/examples/<file>` for gallery manifest files (404 for anything else there).
 */
export function startFixtureHttpServer(): Promise<FixtureHttpServer> {
  const requestLog: FixtureRequestLogEntry[] = [];

  const server: Server = createServer((req, res) => {
    requestLog.push({ method: req.method ?? "GET", url: req.url ?? "/" });
    handleRequest(req, res);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("fixture HTTP server failed to bind an ephemeral port"));
        return;
      }
      const baseUrl = `http://127.0.0.1:${address.port}`;
      resolve({
        baseUrl,
        requestLog,
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
}
