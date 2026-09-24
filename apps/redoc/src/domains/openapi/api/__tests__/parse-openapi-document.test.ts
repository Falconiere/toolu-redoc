import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { parseOpenApiDocument } from "@/domains/openapi/api/parse-openapi-document";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../../__tests__/fixtures");

/** Load a committed fixture as UTF-8 text. */
function fixtureText(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf8");
}

describe("parseOpenApiDocument", () => {
  it("returns version for Swagger 2 documents (AC-4)", () => {
    const result = parseOpenApiDocument(
      JSON.stringify({
        swagger: "2.0",
        info: { title: "Legacy", version: "1.0.0" },
        paths: {},
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("version");
      expect(result.error.message.toLowerCase()).toContain("swagger");
      expect(result.error.message).not.toMatch(/^\s*Error:/);
    }
  });

  it("returns version for OpenAPI 3.2 (AC-4)", () => {
    const result = parseOpenApiDocument(
      JSON.stringify({
        openapi: "3.2.0",
        info: { title: "Future", version: "1.0.0" },
        paths: {},
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("version");
      expect(result.error.message).toMatch(/3\.0|3\.1/);
    }
  });

  it("returns version when openapi is missing (AC-4)", () => {
    const result = parseOpenApiDocument(
      JSON.stringify({
        info: { title: "No version", version: "1.0.0" },
        paths: {},
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("version");
    }
  });

  it("returns empty for whitespace-only input (AC-4)", () => {
    const result = parseOpenApiDocument("   \n\t  ");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("empty");
      expect(typeof result.error.message).toBe("string");
      expect(result.error.message.length).toBeGreaterThan(0);
    }
  });

  it("parses a minimal valid document (smoke)", () => {
    const result = parseOpenApiDocument(
      JSON.stringify({
        openapi: "3.0.3",
        info: { title: "Smoke", version: "0.0.1" },
        paths: {
          "/ping": {
            get: { responses: { "200": { description: "ok" } } },
          },
        },
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.info.title).toBe("Smoke");
      expect(result.document.operations).toHaveLength(1);
      expect(result.document.operations[0]?.method).toBe("get");
      expect(result.document.operations[0]?.path).toBe("/ping");
    }
  });

  it("parses committed Petstore JSON (smoke)", () => {
    const result = parseOpenApiDocument(fixtureText("petstore-3.0.json"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.info.title).toContain("Petstore");
      expect(result.document.operations.length).toBeGreaterThan(0);
    }
  });
});
