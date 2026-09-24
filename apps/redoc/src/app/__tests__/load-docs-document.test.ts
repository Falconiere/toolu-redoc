/** Real-fixture coverage for loadDocsDocument (Petstore twin + failure cases). */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { loadDocsDocument } from "@/app/load-docs-document";

/** Provenance SHA-256 for the docs Petstore twin. */
const PETSTORE_SHA256 = "246cfe6eaa556e39a38fe6be1bb5c29573dbde34ddb13313b3054afc0a7e3413";

const petstorePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../domains/docs/api/dev-petstore-3.0.json",
);

describe("loadDocsDocument", () => {
  it("loads Petstore twin into chrome and normalized document", () => {
    const text = readFileSync(petstorePath, "utf8");
    expect(createHash("sha256").update(text).digest("hex")).toBe(PETSTORE_SHA256);

    const loaded = loadDocsDocument(text);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) {
      throw new Error(loaded.message);
    }
    expect(loaded.title).toBe("Swagger Petstore - OpenAPI 3.0");
    expect(loaded.version).toBe("1.0.27");
    expect(loaded.document.operations.length).toBeGreaterThan(0);
    const putPet = loaded.document.operations.find(
      (operation) => operation.method === "put" && operation.path === "/pet",
    );
    expect(putPet?.requestBody).toBeDefined();
  });

  it("returns ok:false for whitespace-only and Swagger 2 input", () => {
    const empty = loadDocsDocument("   \n\t  ");
    expect(empty.ok).toBe(false);
    if (empty.ok) {
      throw new Error("expected failure for whitespace");
    }
    expect(empty.message.toLowerCase()).toContain("empty");

    const swagger = loadDocsDocument(
      JSON.stringify({
        swagger: "2.0",
        info: { title: "Legacy", version: "1.0.0" },
        paths: {},
      }),
    );
    expect(swagger.ok).toBe(false);
    if (swagger.ok) {
      throw new Error("expected failure for Swagger 2");
    }
    expect(swagger.message.toLowerCase()).toContain("swagger");
  });

  it("falls back for blank title and version", () => {
    const loaded = loadDocsDocument(
      JSON.stringify({
        openapi: "3.0.3",
        info: { title: "  ", version: "" },
        paths: {},
      }),
    );
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) {
      throw new Error(loaded.message);
    }
    expect(loaded.title).toBe("Untitled document");
    expect(loaded.version).toBe("—");
    expect(loaded.document.operations).toEqual([]);
  });
});
