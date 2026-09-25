/** AC-9: buildShareHref round-trips url query + op. */
import { describe, expect, it } from "vitest";

import { buildShareHref } from "@/domains/openapi/api/build-share-href";
import { encodeOperationIdentity } from "@/domains/openapi/api/operation-identity";

describe("buildShareHref", () => {
  it("embeds a source URL that itself contains query parameters (AC-9)", () => {
    const op = encodeOperationIdentity("get", "/pet/findByStatus");
    const source = "https://example.com/openapi.json?a=1&b=2";
    const href = buildShareHref("http://localhost:5173", { url: source, op });
    const parsed = new URL(href);
    expect(parsed.origin).toBe("http://localhost:5173");
    expect(parsed.pathname).toBe("/");
    expect(parsed.searchParams.get("url")).toBe(source);
    expect(parsed.searchParams.get("op")).toBe(op);
  });

  it("omits url for paste-only shares and still carries op", () => {
    const op = encodeOperationIdentity("get", "/pet/findByStatus");
    const href = buildShareHref("http://localhost:5173/", { op });
    const parsed = new URL(href);
    expect(parsed.searchParams.get("url")).toBeNull();
    expect(parsed.searchParams.get("op")).toBe(op);
  });

  it("returns bare origin slash when search is empty", () => {
    expect(buildShareHref("http://localhost:5173", {})).toBe("http://localhost:5173/");
  });

  it("keeps the GitHub Pages subpath in front of the query (base path)", () => {
    const op = encodeOperationIdentity("get", "/pet/findByStatus");
    const source = "https://falconiere.github.io/toolu-redoc/examples/petstore-3.0.json";
    const expected =
      "https://falconiere.github.io/toolu-redoc/?" +
      new URLSearchParams({ url: source, op }).toString();
    expect(
      buildShareHref("https://falconiere.github.io", { url: source, op }, "/toolu-redoc/"),
    ).toBe(expected);
    expect(
      buildShareHref("https://falconiere.github.io/", { url: source, op }, "toolu-redoc"),
    ).toBe(expected);
  });

  it("returns the base path itself when search is empty", () => {
    expect(buildShareHref("https://falconiere.github.io", {}, "/toolu-redoc")).toBe(
      "https://falconiere.github.io/toolu-redoc/",
    );
    expect(buildShareHref("http://localhost:5173", {}, "/")).toBe("http://localhost:5173/");
  });
});
