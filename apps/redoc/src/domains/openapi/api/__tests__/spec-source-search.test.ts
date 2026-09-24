import { describe, expect, it } from "vitest";

import {
  optionalSearchString,
  SPEC_LOAD_SEARCH_OP_MAX,
  SPEC_LOAD_SEARCH_URL_MAX,
  validateSpecLoadSearch,
} from "@/domains/openapi/api/spec-source-search";

describe("optionalSearchString", () => {
  it("returns the string when within bounds", () => {
    expect(optionalSearchString(10, "abc")).toBe("abc");
  });

  it("rejects non-string, empty, and oversize without throwing", () => {
    expect(optionalSearchString(10, 42)).toBeUndefined();
    expect(optionalSearchString(10, null)).toBeUndefined();
    expect(optionalSearchString(10, undefined)).toBeUndefined();
    expect(optionalSearchString(10, "")).toBeUndefined();
    expect(optionalSearchString(3, "abcd")).toBeUndefined();
  });
});

describe("validateSpecLoadSearch", () => {
  it("round-trips a valid url+op pair (AC-8 encoding)", () => {
    const url = "https://example.com/openapi.json?x=1";
    const op = encodeURIComponent(JSON.stringify(["get", "/pets"]));
    expect(validateSpecLoadSearch({ url, op })).toEqual({ url, op });
  });

  it("drops non-string and oversize url/op as undefined (never throws)", () => {
    expect(() =>
      validateSpecLoadSearch({
        url: 1,
        op: { nested: true },
        extra: "ignored",
      }),
    ).not.toThrow();
    expect(validateSpecLoadSearch({ url: 1, op: true })).toEqual({});

    const longUrl = "u".repeat(SPEC_LOAD_SEARCH_URL_MAX + 1);
    const longOp = "o".repeat(SPEC_LOAD_SEARCH_OP_MAX + 1);
    expect(validateSpecLoadSearch({ url: longUrl, op: longOp })).toEqual({});

    expect(
      validateSpecLoadSearch({
        url: "https://ok.example/a.json",
        op: longOp,
      }),
    ).toEqual({ url: "https://ok.example/a.json" });
  });

  it("rejects empty strings", () => {
    expect(validateSpecLoadSearch({ url: "", op: "" })).toEqual({});
  });
});
