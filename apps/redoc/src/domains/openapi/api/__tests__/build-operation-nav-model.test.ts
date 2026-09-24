/** AC-2 / AC-4 / AC-8: buildOperationNavModel from real fixture bytes. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  buildOperationNavModel,
  UNTAGGED_SECTION_KEY,
  UNTAGGED_SECTION_LABEL,
} from "@/domains/openapi/api/build-operation-nav-model";
import {
  decodeOperationIdentity,
  encodeOperationIdentity,
  OPENAPI_HTTP_METHODS,
} from "@/domains/openapi/api/operation-identity";
import { parseOpenApiDocument } from "@/domains/openapi/api/parse-openapi-document";

/** Provenance SHA-256 for fedge.json (see fixtures/provenance.md). */
const FEDGE_SHA256 = "6d73dc4d51bf6fab48ca27ef4211d2b44d8fb57fb3c7329b5544beec7dffdc8a";

/** Provenance SHA-256 for identity-paths.json (see fixtures/provenance.md). */
const IDENTITY_PATHS_SHA256 = "83d1b134bfded771fd29761932e0305a2f029558ab9bb32f1a4f51155e3de078";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../../__tests__/fixtures");

/** Load committed fixture bytes as UTF-8. */
function fixtureText(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf8");
}

/** Assert SHA-256 of fixture bytes matches provenance. */
function assertFixtureSha(name: string, expected: string): string {
  const text = fixtureText(name);
  const digest = createHash("sha256").update(text).digest("hex");
  expect(digest).toBe(expected);
  return text;
}

/** Parse fixture through production parseOpenApiDocument. */
function parseOk(name: string) {
  const result = parseOpenApiDocument(fixtureText(name));
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`${name}: ${result.error.code} ${result.error.message}`);
  }
  return result.document;
}

describe("buildOperationNavModel", () => {
  it("returns empty model for empty-paths fixture (AC-8)", () => {
    const document = parseOk("empty-paths.json");
    const model = buildOperationNavModel(document);
    expect(model).toEqual({ sections: [], operationCount: 0 });
  });

  it("groups FEDGE into declared → undeclared → tagless with sentinel Untagged (AC-2)", () => {
    assertFixtureSha("fedge.json", FEDGE_SHA256);
    const document = parseOk("fedge.json");
    const model = buildOperationNavModel(document);

    expect(model.operationCount).toBe(8);
    expect(model.sections.map((section) => section.key)).toEqual([
      "alpha",
      "beta",
      "undeclared",
      "ghost",
      UNTAGGED_SECTION_KEY,
    ]);
    expect(model.sections.map((section) => section.label)).toEqual([
      "alpha",
      "beta",
      "undeclared",
      "ghost",
      UNTAGGED_SECTION_LABEL,
    ]);

    const byKey = Object.fromEntries(model.sections.map((section) => [section.key, section]));
    expect(byKey.alpha?.items.map((item) => item.method)).toEqual(["get", "post", "trace"]);
    expect(byKey.beta?.items.map((item) => item.method)).toEqual(["put", "options"]);
    expect(byKey.undeclared?.items.map((item) => item.method)).toEqual(["put"]);
    expect(byKey.ghost?.items.map((item) => item.method)).toEqual(["patch"]);
    expect(byKey[UNTAGGED_SECTION_KEY]?.items.map((item) => item.method)).toEqual([
      "delete",
      "head",
    ]);

    // Duplicate tags on post → one row under alpha; item.tags are distinct.
    const post = byKey.alpha?.items.find((item) => item.method === "post");
    expect(post?.tags).toEqual(["alpha"]);
    expect(byKey.alpha?.items.filter((item) => item.method === "post")).toHaveLength(1);

    // Multi-tag put appears under beta and undeclared with shared identity.
    const putIdentity = encodeOperationIdentity("put", "/verbs");
    expect(byKey.beta?.items.find((item) => item.method === "put")?.identity).toBe(putIdentity);
    expect(byKey.undeclared?.items[0]?.identity).toBe(putIdentity);
    expect(byKey.undeclared?.items[0]?.tags).toEqual(["beta", "undeclared"]);

    // Flat section rows = 9 (eight ops + put under a second tag); unique identities = 8.
    const allPaths = model.sections.flatMap((section) => section.items.map((item) => item.path));
    expect(allPaths.every((path) => path === "/verbs")).toBe(true);
    expect(allPaths).toHaveLength(9);
    expect(
      model.sections
        .flatMap((section) => section.items)
        .filter((item) => item.identity === putIdentity),
    ).toHaveLength(2);

    // Untagged-collision: tagless bucket uses sentinel key, not label as key.
    const tagless = byKey[UNTAGGED_SECTION_KEY];
    expect(tagless?.key).toBe(UNTAGGED_SECTION_KEY);
    expect(tagless?.label).toBe("Untagged");
    expect(model.sections.some((section) => section.key === "Untagged")).toBe(false);

    const identities = new Set(
      model.sections.flatMap((section) => section.items.map((item) => item.identity)),
    );
    expect(identities.size).toBe(8);
    for (const method of OPENAPI_HTTP_METHODS) {
      expect(identities.has(encodeOperationIdentity(method, "/verbs"))).toBe(true);
    }
  });

  it("round-trips identity-paths identities without operationId collisions (AC-4)", () => {
    assertFixtureSha("identity-paths.json", IDENTITY_PATHS_SHA256);
    const document = parseOk("identity-paths.json");
    const model = buildOperationNavModel(document);

    expect(model.operationCount).toBe(document.operations.length);
    expect(model.operationCount).toBeGreaterThan(0);

    // All ops are tagless → single Untagged section with sentinel key.
    expect(model.sections).toHaveLength(1);
    expect(model.sections[0]?.key).toBe(UNTAGGED_SECTION_KEY);
    expect(model.sections[0]?.label).toBe(UNTAGGED_SECTION_LABEL);
    expect(model.sections[0]?.items).toHaveLength(document.operations.length);

    const sameId = model.sections[0]?.items.filter((item) => item.operationId === "sameId") ?? [];
    expect(sameId).toHaveLength(2);
    expect(sameId[0]?.identity).not.toBe(sameId[1]?.identity);

    for (const item of model.sections[0]?.items ?? []) {
      const decoded = decodeOperationIdentity(item.identity);
      expect(decoded).toEqual({ method: item.method, path: item.path });
      expect(item.identity).toBe(encodeOperationIdentity(decoded.method, decoded.path));
    }
  });
});
