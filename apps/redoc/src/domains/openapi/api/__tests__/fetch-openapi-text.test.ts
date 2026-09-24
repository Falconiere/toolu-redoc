import { afterEach, describe, expect, it } from "vitest";

import { FETCH_TIMEOUT_MS } from "@/domains/openapi/api/openapi-limits";
import { fetchOpenApiText } from "@/domains/openapi/api/fetch-openapi-text";
import {
  startFixtureHttpServer,
  type FixtureHttpServer,
} from "@/domains/openapi/__tests__/fixture-http-server";

let server: FixtureHttpServer | undefined;

afterEach(async () => {
  if (server !== undefined) {
    await server.close();
    server = undefined;
  }
});

async function start(): Promise<FixtureHttpServer> {
  server = await startFixtureHttpServer();
  return server;
}

describe("fetchOpenApiText", () => {
  it("fetches Petstore JSON and text/plain; records final URL after redirect", async () => {
    const fixture = await start();

    const json = await fetchOpenApiText(`${fixture.baseUrl}/fixtures/petstore.json`);
    expect(json.ok).toBe(true);
    if (json.ok) {
      expect(json.value.text).toContain("Swagger Petstore");
      expect(json.value.href).toBe(`${fixture.baseUrl}/fixtures/petstore.json`);
      expect(json.value.redirectCount).toBe(0);
    }

    const plain = await fetchOpenApiText(`${fixture.baseUrl}/fixtures/petstore.txt`);
    expect(plain.ok).toBe(true);
    if (plain.ok) {
      expect(plain.value.text).toContain("Swagger Petstore");
    }

    const redirected = await fetchOpenApiText(`${fixture.baseUrl}/fixtures/redirect`);
    expect(redirected.ok).toBe(true);
    if (redirected.ok) {
      expect(redirected.value.href).toBe(`${fixture.baseUrl}/fixtures/petstore.json`);
      expect(redirected.value.redirectCount).toBeGreaterThanOrEqual(1);
      expect(redirected.value.text).toContain("Swagger Petstore");
    }
  });

  it("maps 404/500 to http_status and HTML 200 to html_body", async () => {
    const fixture = await start();

    const missing = await fetchOpenApiText(`${fixture.baseUrl}/fixtures/missing`);
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error.code).toBe("http_status");
      expect(missing.error.httpStatus).toBe(404);
    }

    const error = await fetchOpenApiText(`${fixture.baseUrl}/fixtures/error`);
    expect(error.ok).toBe(false);
    if (!error.ok) {
      expect(error.error.code).toBe("http_status");
      expect(error.error.httpStatus).toBe(500);
    }

    const html = await fetchOpenApiText(`${fixture.baseUrl}/fixtures/login.html`);
    expect(html.ok).toBe(false);
    if (!html.ok) {
      expect(html.error.code).toBe("html_body");
      expect(html.error.recovery).toBe("paste");
    }
  });

  it("rejects disallowed URLs without hitting the network", async () => {
    const fixture = await start();
    const before = fixture.requestLog.length;

    const result = await fetchOpenApiText("file:///etc/passwd");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("disallowed_url");
    }
    expect(fixture.requestLog.length).toBe(before);
  });

  it("rejects oversize streamed bodies without Content-Length", async () => {
    const fixture = await start();
    const result = await fetchOpenApiText(`${fixture.baseUrl}/fixtures/oversize`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("oversize");
    }
  });

  it("returns cancelled when aborted mid-flight and leaves no success text", async () => {
    const fixture = await start();
    const controller = new AbortController();
    const pending = fetchOpenApiText(`${fixture.baseUrl}/fixtures/delayed?ms=500`, {
      signal: controller.signal,
    });
    controller.abort();
    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("cancelled");
    }
  });

  it("returns timeout when the request exceeds the timeout budget", async () => {
    const fixture = await start();
    const result = await fetchOpenApiText(`${fixture.baseUrl}/fixtures/delayed?ms=400`, {
      timeoutMs: 50,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("timeout");
      expect(result.error.recovery).toBe("retry");
    }
  });

  it("defaults timeout to FETCH_TIMEOUT_MS (15s)", () => {
    expect(FETCH_TIMEOUT_MS).toBe(15_000);
  });
});
