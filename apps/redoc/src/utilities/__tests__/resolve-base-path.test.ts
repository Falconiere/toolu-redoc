import { describe, expect, it } from "vitest";

import { resolveBasePath } from "@/utilities/resolve-base-path";

describe("resolveBasePath", () => {
  it("defaults an unset or empty REDOC_BASE_PATH to the site root", () => {
    expect(resolveBasePath(undefined)).toBe("/");
    expect(resolveBasePath("")).toBe("/");
  });

  it("accepts the root and slash-wrapped subpaths unchanged", () => {
    expect(resolveBasePath("/")).toBe("/");
    expect(resolveBasePath("/toolu-redoc/")).toBe("/toolu-redoc/");
    expect(resolveBasePath("/a/b.c_d-e/")).toBe("/a/b.c_d-e/");
  });

  it.each([
    ["toolu-redoc"],
    ["/toolu-redoc"],
    ["toolu-redoc/"],
    ["/../x/"],
    ["/a/../"],
    ["/a b/"],
    ["//"],
    ["https://example.com/x/"],
  ])("rejects %j and names the bad value", (raw) => {
    expect(() => resolveBasePath(raw)).toThrow(
      `[vite] invalid REDOC_BASE_PATH: ${JSON.stringify(raw)}`,
    );
  });
});
