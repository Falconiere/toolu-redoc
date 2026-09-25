/** mergeOperationSearch preserves url and sets/clears op. */
import { describe, expect, it } from "vitest";

import { mergeOperationSearch } from "@/domains/openapi/api/write-operation-search";

describe("mergeOperationSearch", () => {
  it("sets op while preserving url", () => {
    expect(mergeOperationSearch({ url: "https://ex.com/a.json?x=1", op: "old" }, "new")).toEqual({
      url: "https://ex.com/a.json?x=1",
      op: "new",
    });
  });

  it("clears op when undefined while keeping url", () => {
    expect(mergeOperationSearch({ url: "https://ex.com/a.json", op: "x" }, undefined)).toEqual({
      url: "https://ex.com/a.json",
    });
  });

  it("clears op when empty string", () => {
    expect(mergeOperationSearch({ op: "x" }, "")).toEqual({});
  });
});
