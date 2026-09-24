import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { decodeOpenApiText } from "@/domains/openapi/api/decode-openapi-text";
import { normalizeOpenApiDocument } from "@/domains/openapi/api/normalize-openapi-document";
import { OpenApiDocumentSchema } from "@/domains/openapi/api/openapi-document-schema";
import {
  decodeOperationIdentity,
  encodeOperationIdentity,
  OPENAPI_HTTP_METHODS,
} from "@/domains/openapi/api/operation-identity";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../../__tests__/fixtures");

/** Load a committed fixture as UTF-8 text. */
function fixtureText(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf8");
}

/** Decode + Zod-parse a fixture into a document for normalize. */
function parseFixture(name: string) {
  const decoded = decodeOpenApiText(fixtureText(name));
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

describe("normalizeOpenApiDocument", () => {
  it("returns empty operations for empty paths (AC-5)", () => {
    const normalized = normalizeOpenApiDocument(parseFixture("empty-paths.json"));
    expect(normalized.operations).toEqual([]);
    expect(normalized.info.title).toBe("Empty paths");
    expect(normalized.notices).toEqual([]);
  });

  it("returns empty operations and webhook notice for webhook-only 3.1 (AC-5)", () => {
    const normalized = normalizeOpenApiDocument(parseFixture("webhook-only-3.1.yaml"));
    expect(normalized.operations).toEqual([]);
    expect(normalized.openapi).toBe("3.1.0");
    expect(normalized.notices.some((n) => n.code === "webhooks-present")).toBe(true);
  });

  it("collects exactly the eight verbs and ignores Path Item metadata (AC-7)", () => {
    const normalized = normalizeOpenApiDocument(parseFixture("fedge.json"));
    const identities = normalized.operations.map((op) => op.identity).toSorted();
    const expected = OPENAPI_HTTP_METHODS.map((method) =>
      encodeOperationIdentity(method, "/verbs"),
    ).toSorted();
    expect(identities).toEqual(expected);
    expect(normalized.operations.some((op) => op.path === "/meta")).toBe(false);
    const get = normalized.operations.find((op) => op.method === "get");
    expect(get?.tags).toEqual(["alpha"]);
    const post = normalized.operations.find((op) => op.method === "post");
    expect(post?.tags).toEqual(["alpha", "alpha"]);
    const del = normalized.operations.find((op) => op.method === "delete");
    expect(del?.tags).toEqual([]);
    expect(normalized.tags.map((tag) => tag.name)).toEqual(["alpha", "beta", "alpha"]);
  });

  it("round-trips identity keys and ignores duplicate operationId (AC-8)", () => {
    const normalized = normalizeOpenApiDocument(parseFixture("identity-paths.json"));
    expect(normalized.operations.length).toBeGreaterThan(0);
    for (const operation of normalized.operations) {
      const decoded = decodeOperationIdentity(operation.identity);
      expect(decoded).toEqual({ method: operation.method, path: operation.path });
      expect(operation.identity).toBe(encodeOperationIdentity(operation.method, operation.path));
    }
    const withSameId = normalized.operations.filter((op) => op.operationId === "sameId");
    expect(withSameId).toHaveLength(2);
    expect(withSameId[0]?.identity).not.toBe(withSameId[1]?.identity);
    const noId = normalized.operations.find((op) => op.path === "/a/b/c");
    expect(noId?.operationId).toBeUndefined();
    const space = normalized.operations.find((op) => op.path === "/space path/here");
    expect(space).toBeDefined();
    const unicode = normalized.operations.find((op) => op.path === "/unicodé/路径");
    expect(unicode).toBeDefined();
  });

  it("merges parameters by (name,in) with operation wins and flags path issues (AC-9)", () => {
    const normalized = normalizeOpenApiDocument(parseFixture("param-merge.json"));
    const getPet = normalized.operations.find((op) => op.operationId === "getPet");
    expect(getPet).toBeDefined();
    const names = getPet?.parameters.map((parameter) => {
      if ("$ref" in parameter) {
        return parameter.$ref;
      }
      return `${parameter.name}:${parameter.in}:${parameter.description ?? ""}`;
    });
    expect(names).toEqual([
      "petId:path:path-item petId",
      "limit:query:operation limit wins",
      "X-Trace:header:",
      "limit:header:distinct in keeps both limits",
    ]);
    const missing = normalized.operations.find(
      (op) => op.operationId === "getItemMissingPathParam",
    );
    expect(missing?.pathParameterIssues).toEqual([{ name: "itemId", issue: "missing" }]);
    expect(missing?.parameters).toHaveLength(1);
    const optional = normalized.operations.find((op) => op.operationId === "getOptionalPathParam");
    expect(optional?.pathParameterIssues).toEqual([{ name: "optId", issue: "not_required" }]);
  });

  it("keeps composition branches and notices callbacks/links/webhooks (AC-11)", () => {
    const normalized = normalizeOpenApiDocument(parseFixture("composition.json"));
    expect(normalized.operations).toHaveLength(1);
    const op = normalized.operations[0];
    expect(op?.unsupported).toEqual({ callbacks: true, links: true });
    expect(normalized.notices.some((n) => n.code === "webhooks-present")).toBe(true);
    expect(normalized.notices.some((n) => n.code === "callbacks-on-operation")).toBe(true);
    expect(normalized.notices.some((n) => n.code === "links-on-operation")).toBe(true);
    expect(normalized.notices.some((n) => n.code === "dynamic-ref")).toBe(true);
    const pet = normalized.components?.schemas?.Pet;
    expect(pet).toBeDefined();
    if (typeof pet === "object") {
      expect(pet.oneOf).toHaveLength(2);
      expect(pet.discriminator?.propertyName).toBe("petType");
    }
    const cat = normalized.components?.schemas?.Cat;
    if (typeof cat === "object") {
      expect(cat.allOf).toHaveLength(1);
    }
  });
});
