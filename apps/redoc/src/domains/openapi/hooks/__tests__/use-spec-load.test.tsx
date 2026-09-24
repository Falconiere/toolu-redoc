import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSpecLoad } from "@/domains/openapi/hooks/use-spec-load";
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

describe("useSpecLoad latest-wins and cancel", () => {
  it("latest load wins: delayed A does not replace fast B (AC-5)", async () => {
    const fixture = await start();
    const { result } = renderHook(() => useSpecLoad());

    act(() => {
      void result.current.load({
        kind: "url",
        href: `${fixture.baseUrl}/fixtures/delayed?ms=300`,
      });
      void result.current.load({
        kind: "url",
        href: `${fixture.baseUrl}/fixtures/petstore.json`,
      });
    });

    await waitFor(() => {
      expect(result.current.status).toBe("success");
    });

    expect(result.current.success?.source.href).toBe(`${fixture.baseUrl}/fixtures/petstore.json`);
    expect(result.current.error).toBeNull();
  });

  it("cancel clears loading and keeps prior success (AC-5)", async () => {
    const fixture = await start();
    const { result } = renderHook(() => useSpecLoad());

    await act(async () => {
      await result.current.load({
        kind: "url",
        href: `${fixture.baseUrl}/fixtures/petstore.json`,
      });
    });
    expect(result.current.status).toBe("success");
    const kept = result.current.success;

    act(() => {
      void result.current.load({
        kind: "url",
        href: `${fixture.baseUrl}/fixtures/delayed?ms=400`,
      });
    });
    expect(result.current.status).toBe("loading");

    act(() => {
      result.current.cancel();
    });

    expect(result.current.status).toBe("success");
    expect(result.current.success).toEqual(kept);
    expect(result.current.error).toBeNull();
  });

  it("timeout yields timeout with retry recovery (AC-5)", async () => {
    const fixture = await start();
    const { result } = renderHook(() => useSpecLoad());

    await act(async () => {
      await result.current.load(
        { kind: "url", href: `${fixture.baseUrl}/fixtures/delayed?ms=400` },
        { timeoutMs: 50 },
      );
    });

    expect(result.current.status).toBe("failure");
    expect(result.current.error?.code).toBe("timeout");
    expect(result.current.error?.recovery).toBe("retry");
  });
});

describe("useSpecLoad retain / reset / storage", () => {
  it("retains last success through replacement failure, then replaces, then reset (AC-6)", async () => {
    const fixture = await start();
    const { result } = renderHook(() => useSpecLoad());

    await act(async () => {
      await result.current.load({
        kind: "url",
        href: `${fixture.baseUrl}/fixtures/petstore.json`,
      });
    });
    const first = result.current.success;
    expect(first).not.toBeNull();

    await act(async () => {
      await result.current.load({
        kind: "url",
        href: `${fixture.baseUrl}/fixtures/missing`,
      });
    });
    expect(result.current.status).toBe("failure");
    expect(result.current.success).toEqual(first);
    expect(result.current.error?.code).toBe("http_status");

    await act(async () => {
      await result.current.load({
        kind: "url",
        href: `${fixture.baseUrl}/fixtures/petstore.txt`,
      });
    });
    expect(result.current.status).toBe("success");
    expect(result.current.success?.source.href).toBe(`${fixture.baseUrl}/fixtures/petstore.txt`);
    expect(result.current.error).toBeNull();

    act(() => {
      result.current.reset();
    });
    expect(result.current.status).toBe("idle");
    expect(result.current.success).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("does not write paste or query strings to Web Storage (AC-7)", async () => {
    const fixture = await start();
    const localSet = vi.spyOn(Storage.prototype, "setItem");
    const sessionSet = vi.spyOn(globalThis.sessionStorage, "setItem");

    const { result } = renderHook(() => useSpecLoad());
    await act(async () => {
      await result.current.load({
        kind: "url",
        href: `${fixture.baseUrl}/fixtures/petstore.json`,
      });
    });

    expect(localSet).not.toHaveBeenCalled();
    expect(sessionSet).not.toHaveBeenCalled();
    localSet.mockRestore();
    sessionSet.mockRestore();
  });
});
