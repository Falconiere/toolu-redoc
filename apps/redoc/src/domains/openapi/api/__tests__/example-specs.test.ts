/** Gallery manifest vs the committed public/examples bytes (AC-5, AC-6). */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { EXAMPLE_SPECS, exampleSpecHref } from "@/domains/openapi/api/example-specs";
import type { NormalizedOpenApiDocument } from "@/domains/openapi/api/normalize-openapi-document";
import { MAX_INPUT_BYTES } from "@/domains/openapi/api/openapi-limits";
import { parseOpenApiDocument } from "@/domains/openapi/api/parse-openapi-document";

const examplesDir = join(dirname(fileURLToPath(import.meta.url)), "../../../../../public/examples");

function exampleBytes(file: string): Buffer {
  return readFileSync(join(examplesDir, file));
}

function parseExample(file: string): NormalizedOpenApiDocument {
  const result = parseOpenApiDocument(exampleBytes(file).toString("utf8"));
  if (!result.ok) {
    throw new Error(`${file} failed to parse: ${result.error.message}`);
  }
  return result.document;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** `| \`file\` | … | <sha256> |` rows of NOTICE.md → file → last cell. */
function noticeHashes(): Map<string, string> {
  const rows = new Map<string, string>();
  for (const line of readFileSync(join(examplesDir, "NOTICE.md"), "utf8").split("\n")) {
    const cells = line.split("|").map((cell) => cell.trim());
    const file = /^`([^`]+)`$/.exec(cells[1] ?? "")?.[1];
    const hash = cells.at(-2);
    if (file !== undefined && hash !== undefined) {
      rows.set(file, hash.replaceAll("`", ""));
    }
  }
  return rows;
}

/** Walk every sub-schema reachable through properties / items / composition. */
function* walkSchema(schema: unknown): Generator<Record<string, unknown>> {
  if (schema === null || typeof schema !== "object") {
    return;
  }
  const node = schema as Record<string, unknown>;
  yield node;
  for (const key of ["properties"]) {
    const map = node[key];
    if (map !== null && typeof map === "object") {
      for (const child of Object.values(map)) {
        yield* walkSchema(child);
      }
    }
  }
  yield* walkSchema(node["items"]);
  for (const key of ["oneOf", "anyOf", "allOf"]) {
    const list = node[key];
    if (Array.isArray(list)) {
      for (const child of list) {
        yield* walkSchema(child);
      }
    }
  }
}

describe("EXAMPLE_SPECS", () => {
  it("lists four unique entries whose format matches the file extension", () => {
    expect(EXAMPLE_SPECS.map((spec) => spec.id)).toEqual([
      "petstore-3.0-json",
      "petstore-3.0-yaml",
      "museum-3.1",
      "feature-tour-3.1",
    ]);
    expect(new Set(EXAMPLE_SPECS.map((spec) => spec.file)).size).toBe(EXAMPLE_SPECS.length);
    for (const spec of EXAMPLE_SPECS) {
      expect(spec.file.endsWith(`.${spec.format}`)).toBe(true);
    }
  });

  it.each(EXAMPLE_SPECS)(
    "$id exists, fits the load limit, parses, and matches its manifest title and version",
    (spec) => {
      expect(existsSync(join(examplesDir, spec.file))).toBe(true);
      expect(exampleBytes(spec.file).byteLength).toBeLessThanOrEqual(MAX_INPUT_BYTES);
      const document = parseExample(spec.file);
      expect(document.info.title).toBe(spec.title);
      expect(document.openapi.split(".").slice(0, 2).join(".")).toBe(spec.openapi);
      expect(document.operations.length).toBeGreaterThan(0);
    },
  );

  it("feature tour exercises deprecated ops, discriminator, self $ref, webhooks, and null unions", () => {
    const document = parseExample("feature-tour-3.1.yaml");
    const schemas = Object.entries(document.components?.schemas ?? {});

    expect(document.operations.some((operation) => operation.deprecated)).toBe(true);
    expect(document.notices.map((notice) => notice.code)).toContain("webhooks-present");

    const mappings = schemas.flatMap(([, schema]) =>
      typeof schema === "object" && schema.discriminator?.mapping !== undefined
        ? [Object.keys(schema.discriminator.mapping)]
        : [],
    );
    expect(mappings.some((keys) => keys.length >= 2)).toBe(true);

    const selfReferencing = schemas.filter(([name, schema]) =>
      [...walkSchema(schema)].some((node) => node["$ref"] === `#/components/schemas/${name}`),
    );
    expect(selfReferencing.map(([name]) => name)).toContain("Category");

    const nullUnion = schemas.some(([, schema]) =>
      [...walkSchema(schema)].some(
        (node) => Array.isArray(node["type"]) && node["type"].includes("null"),
      ),
    );
    expect(nullUnion).toBe(true);
  });
});

describe("public/examples/NOTICE.md", () => {
  it("records the SHA-256 of every committed example file and nothing else", () => {
    const hashes = noticeHashes();
    expect([...hashes.keys()].toSorted()).toEqual(
      EXAMPLE_SPECS.map((spec) => spec.file).toSorted(),
    );
    for (const spec of EXAMPLE_SPECS) {
      expect(hashes.get(spec.file), spec.file).toBe(sha256(exampleBytes(spec.file)));
    }
  });
});

describe("exampleSpecHref", () => {
  const museum = EXAMPLE_SPECS.find((spec) => spec.id === "museum-3.1");

  it("builds an absolute same-origin href under the deploy base path", () => {
    expect(museum).toBeDefined();
    if (museum === undefined) {
      return;
    }
    expect(exampleSpecHref(museum, "https://falconiere.github.io", "/toolu-redoc/")).toBe(
      "https://falconiere.github.io/toolu-redoc/examples/museum-3.1.yaml",
    );
    expect(exampleSpecHref(museum, "http://127.0.0.1:4173/", "/")).toBe(
      "http://127.0.0.1:4173/examples/museum-3.1.yaml",
    );
    expect(exampleSpecHref(museum, "https://falconiere.github.io", "toolu-redoc")).toBe(
      "https://falconiere.github.io/toolu-redoc/examples/museum-3.1.yaml",
    );
  });
});
