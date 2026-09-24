import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { decodeOpenApiText } from "@/domains/openapi/api/decode-openapi-text";
import { MAX_INPUT_BYTES } from "@/domains/openapi/api/openapi-limits";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../../__tests__/fixtures");

function fixture(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf8");
}

describe("decodeOpenApiText", () => {
  it("rejects empty or whitespace input", () => {
    const result = decodeOpenApiText(fixture("fbad-empty.txt"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("empty");
      expect(result.error.message.length).toBeGreaterThan(0);
    }
  });

  it("rejects input over MAX_INPUT_BYTES without hanging", () => {
    const over = "x".repeat(MAX_INPUT_BYTES + 1);
    const result = decodeOpenApiText(over);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("oversize");
    }
  });

  it("accepts exactly MAX_INPUT_BYTES when the document is otherwise valid", () => {
    const base = `openapi: 3.0.3\ninfo:\n  title: T\n  version: "1"\npaths: {}\n`;
    const baseBytes = new TextEncoder().encode(base).byteLength;
    const padded = `${base}${" ".repeat(MAX_INPUT_BYTES - baseBytes)}`;
    expect(new TextEncoder().encode(padded).byteLength).toBe(MAX_INPUT_BYTES);
    const result = decodeOpenApiText(padded);
    expect(result.ok).toBe(true);
  });

  it("rejects duplicate mapping keys", () => {
    const result = decodeOpenApiText(fixture("fbad-dup-key.yaml"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("yaml");
      expect(result.error.message.toLowerCase()).toContain("duplicate");
    }
  });

  it("rejects multiple YAML documents", () => {
    const result = decodeOpenApiText(fixture("fbad-multi-doc.yaml"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("multi_document");
    }
  });

  it("rejects alias expansion above MAX_ALIAS_COUNT", () => {
    const result = decodeOpenApiText(fixture("fbad-alias-bomb.yaml"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(["alias_limit", "yaml"]).toContain(result.error.code);
    }
  });

  it("preserves JSON-compatible YAML scalar types", () => {
    const result = decodeOpenApiText(`
openapi: 3.0.3
info:
  title: Scalars
  version: "1.0.0"
paths: {}
x-flag: true
x-count: 0
x-empty: ""
x-null: null
`);
    expect(result.ok).toBe(true);
    if (result.ok && isPlainObject(result.value)) {
      expect(result.value["x-flag"]).toBe(true);
      expect(result.value["x-count"]).toBe(0);
      expect(result.value["x-empty"]).toBe("");
      expect(result.value["x-null"]).toBeNull();
    }
  });

  it("decodes a JSON object the same way as YAML", () => {
    const json = JSON.stringify({
      openapi: "3.0.3",
      info: { title: "J", version: "1" },
      paths: {},
    });
    const result = decodeOpenApiText(json);
    expect(result.ok).toBe(true);
    if (result.ok && isPlainObject(result.value)) {
      expect(result.value.openapi).toBe("3.0.3");
    }
  });
});

/** Narrow decoded roots without unsafe assertions. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
