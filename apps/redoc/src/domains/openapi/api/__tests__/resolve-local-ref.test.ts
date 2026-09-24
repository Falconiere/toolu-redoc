import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { decodeOpenApiText } from "@/domains/openapi/api/decode-openapi-text";
import { MAX_SCHEMA_DEPTH } from "@/domains/openapi/api/openapi-limits";
import { OpenApiDocumentSchema } from "@/domains/openapi/api/openapi-document-schema";
import {
  decodePointerToken,
  isExternalRef,
  readPointer,
  resolveLocalRef,
  type UnresolvedRef,
} from "@/domains/openapi/api/resolve-local-ref";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../../__tests__/fixtures");

/** Decode + Zod-parse FREF fixture bytes. */
function loadFref() {
  const text = readFileSync(join(fixturesDir, "fref.json"), "utf8");
  const decoded = decodeOpenApiText(text);
  expect(decoded.ok).toBe(true);
  if (!decoded.ok) {
    throw new Error(decoded.error.message);
  }
  const parsed = OpenApiDocumentSchema.safeParse(decoded.value);
  expect(parsed.success).toBe(true);
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }
  return parsed.data;
}

/** Narrow an unresolved marker for assertions. */
function isUnresolvedRef(value: unknown): value is UnresolvedRef {
  if (value === null || typeof value !== "object") {
    return false;
  }
  if (!("unresolved" in value) || value.unresolved !== true) {
    return false;
  }
  if (!("$ref" in value) || typeof value.$ref !== "string") {
    return false;
  }
  if (!("reason" in value) || typeof value.reason !== "string") {
    return false;
  }
  return (
    value.reason === "cycle" ||
    value.reason === "depth" ||
    value.reason === "dangling" ||
    value.reason === "external" ||
    value.reason === "wrong-kind"
  );
}

/** Assert and return an unresolved marker. */
function asUnresolved(value: unknown): UnresolvedRef {
  expect(isUnresolvedRef(value)).toBe(true);
  if (!isUnresolvedRef(value)) {
    throw new Error("expected UnresolvedRef marker");
  }
  return value;
}

describe("resolveLocalRef", () => {
  it("resolves a shared local schema pointer (AC-10)", () => {
    const doc = loadFref();
    const result = resolveLocalRef(doc, "#/components/schemas/Pet");
    expect(result.notices).toEqual([]);
    expect(result.value).toMatchObject({
      type: "object",
      properties: { id: { type: "integer" }, name: { type: "string" } },
    });
  });

  it("decodes ~0 and ~1 escaped component keys (AC-10)", () => {
    expect(decodePointerToken("tilde~0key")).toBe("tilde~key");
    expect(decodePointerToken("slash~1key")).toBe("slash/key");
    const doc = loadFref();
    const tilde = resolveLocalRef(doc, "#/components/schemas/tilde~0key");
    expect(tilde.notices).toEqual([]);
    expect(tilde.value).toMatchObject({ type: "string" });
    const slash = resolveLocalRef(doc, "#/components/schemas/slash~1key");
    expect(slash.notices).toEqual([]);
    expect(slash.value).toMatchObject({ type: "string" });
    const viaEscaped = resolveLocalRef(doc, "#/components/schemas/Escaped");
    expect(viaEscaped.notices).toEqual([]);
    expect(readPointer(doc, "/components/schemas/tilde~0key")).toMatchObject({
      type: "string",
    });
  });

  it("stops recursive local refs at a visible cycle boundary (AC-10)", () => {
    const doc = loadFref();
    const result = resolveLocalRef(doc, "#/components/schemas/LoopA");
    const unresolved = asUnresolved(result.value);
    expect(unresolved.reason).toBe("cycle");
    expect(result.notices.some((n) => n.code === "ref-cycle")).toBe(true);
  });

  it("resolves a self-recursive property $ref to the schema object once", () => {
    const doc = loadFref();
    const result = resolveLocalRef(doc, "#/components/schemas/Node/properties/next");
    expect(result.notices).toEqual([]);
    expect(result.value).toMatchObject({ type: "object" });
  });

  it("returns dangling and wrong-kind notices for bad local targets (AC-10)", () => {
    const doc = loadFref();
    const dangling = resolveLocalRef(doc, "#/components/schemas/Missing");
    expect(asUnresolved(dangling.value).reason).toBe("dangling");
    expect(dangling.notices.some((n) => n.code === "dangling-ref")).toBe(true);

    const wrong = resolveLocalRef(doc, "#/components/parameters/Limit", {
      expectedKind: "schema",
    });
    expect(asUnresolved(wrong.value).reason).toBe("wrong-kind");
    expect(wrong.notices.some((n) => n.code === "wrong-kind-ref")).toBe(true);
  });

  it("labels external URI refs without fetching (AC-10)", () => {
    expect(isExternalRef("https://example.com/schemas/Pet.json")).toBe(true);
    expect(isExternalRef("./schemas/Pet.json")).toBe(true);
    expect(isExternalRef("Pet.yaml#/components/schemas/Pet")).toBe(true);
    expect(isExternalRef("#/components/schemas/Pet")).toBe(false);
    const doc = loadFref();
    const result = resolveLocalRef(doc, "https://example.com/schemas/Pet.json");
    expect(asUnresolved(result.value).reason).toBe("external");
    expect(result.notices.some((n) => n.code === "external-ref")).toBe(true);
    const relative = resolveLocalRef(doc, "./schemas/Pet.json");
    expect(asUnresolved(relative.value).reason).toBe("external");
  });

  it("stops expansion when depth exceeds MAX_SCHEMA_DEPTH (AC-10)", () => {
    const schemas: Record<string, unknown> = {};
    for (let index = 0; index <= MAX_SCHEMA_DEPTH + 2; index += 1) {
      schemas[`D${index}`] = {
        $ref: `#/components/schemas/D${index + 1}`,
      };
    }
    const doc = {
      openapi: "3.0.3",
      info: { title: "depth", version: "1" },
      paths: {},
      components: { schemas },
    };
    const result = resolveLocalRef(doc, "#/components/schemas/D0", {
      depth: 0,
    });
    expect(asUnresolved(result.value).reason).toBe("depth");
    expect(result.notices.some((n) => n.code === "ref-depth")).toBe(true);
  });
});
