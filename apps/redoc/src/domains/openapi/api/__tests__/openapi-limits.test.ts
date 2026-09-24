import { describe, expect, it } from "vitest";

import {
  FETCH_TIMEOUT_MS,
  MAX_ALIAS_COUNT,
  MAX_INPUT_BYTES,
  MAX_SCHEMA_DEPTH,
} from "@/domains/openapi/api/openapi-limits";

describe("openapi-limits", () => {
  it("exports the agreed epic defaults", () => {
    expect(MAX_INPUT_BYTES).toBe(5 * 1024 * 1024);
    expect(MAX_ALIAS_COUNT).toBe(100);
    expect(MAX_SCHEMA_DEPTH).toBe(25);
    expect(FETCH_TIMEOUT_MS).toBe(15_000);
  });
});
