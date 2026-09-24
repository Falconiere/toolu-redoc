import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import { MAX_INPUT_BYTES } from "@/domains/openapi/api/openapi-limits";
import { loadOpenApiDocument } from "@/domains/openapi/api/load-openapi-document";
import {
  startFixtureHttpServer,
  type FixtureHttpServer,
} from "@/domains/openapi/__tests__/fixture-http-server";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../../__tests__/fixtures");

/** Load committed Petstore fixture bytes as UTF-8 text. */
function petstoreText(): string {
  return readFileSync(join(fixturesDir, "petstore-3.0.json"), "utf8");
}

let server: FixtureHttpServer | undefined;

afterEach(async () => {
  if (server !== undefined) {
    await server.close();
    server = undefined;
  }
  vi.unstubAllGlobals();
});

async function start(): Promise<FixtureHttpServer> {
  server = await startFixtureHttpServer();
  return server;
}

describe("loadOpenApiDocument", () => {
  it("pastes Petstore successfully with nonempty operations (AC-1)", async () => {
    const result = await loadOpenApiDocument({ kind: "paste", text: petstoreText() });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.info.title).toContain("Petstore");
      expect(result.value.document.info.version).toBe("1.0.27");
      expect(result.value.document.operations.length).toBeGreaterThan(0);
      expect(result.value.source.kind).toBe("paste");
      expect(result.value.source.redirectCount).toBe(0);
    }
  });

  it("returns empty for blank paste and oversize for oversized paste", async () => {
    const empty = await loadOpenApiDocument({ kind: "paste", text: "   " });
    expect(empty.ok).toBe(false);
    if (!empty.ok) {
      expect(empty.error.code).toBe("empty");
    }

    const oversized = "x".repeat(MAX_INPUT_BYTES + 1);
    const over = await loadOpenApiDocument({ kind: "paste", text: oversized });
    expect(over.ok).toBe(false);
    if (!over.ok) {
      expect(over.error.code).toBe("oversize");
    }
  });

  it("loads Petstore from fixture server JSON, text/plain, and redirect (AC-2)", async () => {
    const fixture = await start();
    const paste = await loadOpenApiDocument({ kind: "paste", text: petstoreText() });
    expect(paste.ok).toBe(true);
    if (!paste.ok) {
      return;
    }
    const pasteIds = new Set(paste.value.document.operations.map((op) => op.identity));

    const json = await loadOpenApiDocument({
      kind: "url",
      href: `${fixture.baseUrl}/fixtures/petstore.json`,
    });
    const plain = await loadOpenApiDocument({
      kind: "url",
      href: `${fixture.baseUrl}/fixtures/petstore.txt`,
    });
    const redirected = await loadOpenApiDocument({
      kind: "url",
      href: `${fixture.baseUrl}/fixtures/redirect`,
    });

    for (const result of [json, plain, redirected]) {
      expect(result.ok).toBe(true);
      if (!result.ok) {
        continue;
      }
      expect(new Set(result.value.document.operations.map((op) => op.identity))).toEqual(pasteIds);
      expect(result.value.source.kind).toBe("url");
    }

    if (json.ok) {
      expect(json.value.source.href).toBe(`${fixture.baseUrl}/fixtures/petstore.json`);
    }
    if (plain.ok) {
      expect(plain.value.source.href).toBe(`${fixture.baseUrl}/fixtures/petstore.txt`);
    }
    if (redirected.ok) {
      expect(redirected.value.source.href).toBe(`${fixture.baseUrl}/fixtures/petstore.json`);
      expect(redirected.value.source.redirectCount).toBeGreaterThanOrEqual(1);
    }
  });

  it("maps 404/500/HTML URL failures without parse codes for HTML (AC-3)", async () => {
    const fixture = await start();

    const missing = await loadOpenApiDocument({
      kind: "url",
      href: `${fixture.baseUrl}/fixtures/missing`,
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error.code).toBe("http_status");
      expect(missing.error.httpStatus).toBe(404);
    }

    const error = await loadOpenApiDocument({
      kind: "url",
      href: `${fixture.baseUrl}/fixtures/error`,
    });
    expect(error.ok).toBe(false);
    if (!error.ok) {
      expect(error.error.code).toBe("http_status");
    }

    const html = await loadOpenApiDocument({
      kind: "url",
      href: `${fixture.baseUrl}/fixtures/login.html`,
    });
    expect(html.ok).toBe(false);
    if (!html.ok) {
      expect(html.error.code).toBe("html_body");
      expect(["json", "yaml", "schema", "version", "empty"]).not.toContain(html.error.code);
    }
  });

  it("maps injected network TypeError to honest network copy with paste recovery (AC-4)", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new TypeError("Failed to fetch"));

    try {
      const result = await loadOpenApiDocument({
        kind: "url",
        href: "https://example.com/openapi.json",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("network");
        expect(result.error.recovery).toBe("paste");
        expect(result.error.message.toLowerCase()).not.toContain("cors confirmed");
        expect(result.error.message.toLowerCase()).toMatch(/connectivity|blocking|cors/);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("requests only the source URL (no ref/example/API op fetches) (AC-7)", async () => {
    const fixture = await start();
    const href = `${fixture.baseUrl}/fixtures/petstore.json`;
    const result = await loadOpenApiDocument({ kind: "url", href });
    expect(result.ok).toBe(true);
    const paths = fixture.requestLog.map((entry) => entry.url.split("?")[0]);
    expect(paths.every((path) => path === "/fixtures/petstore.json")).toBe(true);
    expect(paths.length).toBe(1);
  });
});
