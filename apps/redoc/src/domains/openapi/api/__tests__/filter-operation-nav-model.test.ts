/** AC-5 / AC-8: filterOperationNavModel matching, clear, and selectionVisible. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  buildOperationNavModel,
  UNTAGGED_SECTION_KEY,
} from "@/domains/openapi/api/build-operation-nav-model";
import { filterOperationNavModel } from "@/domains/openapi/api/filter-operation-nav-model";
import { encodeOperationIdentity } from "@/domains/openapi/api/operation-identity";
import { parseOpenApiDocument } from "@/domains/openapi/api/parse-openapi-document";

/** Provenance SHA-256 for fedge.json (see fixtures/provenance.md). */
const FEDGE_SHA256 = "6d73dc4d51bf6fab48ca27ef4211d2b44d8fb57fb3c7329b5544beec7dffdc8a";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../../__tests__/fixtures");

/** Load committed fixture bytes as UTF-8. */
function fixtureText(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf8");
}

/** Parse fixture through production parseOpenApiDocument. */
function parseOk(name: string) {
  const text = fixtureText(name);
  if (name === "fedge.json") {
    const digest = createHash("sha256").update(text).digest("hex");
    expect(digest).toBe(FEDGE_SHA256);
  }
  const result = parseOpenApiDocument(text);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`${name}: ${result.error.code} ${result.error.message}`);
  }
  return result.document;
}

/** Flat identities present in a nav model. */
function identitiesIn(model: ReturnType<typeof buildOperationNavModel>): Set<string> {
  return new Set(model.sections.flatMap((section) => section.items.map((item) => item.identity)));
}

describe("filterOperationNavModel", () => {
  it("matches path, mixed-case method, tag, and operationId on FEDGE (AC-5)", () => {
    const nav = buildOperationNavModel(parseOk("fedge.json"));
    const getId = encodeOperationIdentity("get", "/verbs");
    const putId = encodeOperationIdentity("put", "/verbs");

    const byPath = filterOperationNavModel(nav, "  /verbs  ", null);
    expect(identitiesIn(byPath.model).size).toBe(8);
    expect(byPath.selectionVisible).toBe(true);

    const byMethod = filterOperationNavModel(nav, "GeT", getId);
    expect(identitiesIn(byMethod.model)).toEqual(new Set([getId]));
    expect(byMethod.selectionVisible).toBe(true);
    expect(byMethod.model.sections).toHaveLength(1);
    expect(byMethod.model.sections[0]?.key).toBe("alpha");

    const byTag = filterOperationNavModel(nav, "ghost", null);
    expect(identitiesIn(byTag.model)).toEqual(
      new Set([encodeOperationIdentity("patch", "/verbs")]),
    );

    const byOpId = filterOperationNavModel(nav, "listVerbs", null);
    expect(identitiesIn(byOpId.model)).toEqual(new Set([getId]));

    // Tag match keeps every section row for that identity (put under beta + undeclared).
    const byUndeclared = filterOperationNavModel(nav, "undeclared", putId);
    expect(identitiesIn(byUndeclared.model)).toEqual(new Set([putId]));
    expect(byUndeclared.model.sections.map((section) => section.key)).toEqual([
      "beta",
      "undeclared",
    ]);
    expect(byUndeclared.selectionVisible).toBe(true);
  });

  it("matches summary and section label Untagged; ignores sentinel key (AC-5)", () => {
    const petstore = buildOperationNavModel(parseOk("petstore-3.0.json"));
    const bySummary = filterOperationNavModel(petstore, "inventories", null);
    expect(bySummary.model.sections.length).toBeGreaterThan(0);
    expect(
      bySummary.model.sections.some((section) =>
        section.items.some((item) => item.summary?.toLowerCase().includes("inventories")),
      ),
    ).toBe(true);

    const fedge = buildOperationNavModel(parseOk("fedge.json"));
    const byUntaggedLabel = filterOperationNavModel(fedge, "untagged", null);
    expect(byUntaggedLabel.model.sections.map((section) => section.key)).toEqual([
      UNTAGGED_SECTION_KEY,
    ]);
    expect(identitiesIn(byUntaggedLabel.model)).toEqual(
      new Set([
        encodeOperationIdentity("delete", "/verbs"),
        encodeOperationIdentity("head", "/verbs"),
      ]),
    );

    // Sentinel key must not match a query of the sentinel via section key.
    const bySentinelKey = filterOperationNavModel(fedge, UNTAGGED_SECTION_KEY, null);
    expect(bySentinelKey.model.sections).toEqual([]);

    const inventoryId = encodeOperationIdentity("get", "/store/inventory");
    expect(
      bySummary.model.sections.some((section) =>
        section.items.some(
          (item) =>
            item.identity === inventoryId &&
            item.method === "get" &&
            item.path === "/store/inventory" &&
            item.summary === "Returns pet inventories by status.",
        ),
      ),
    ).toBe(true);
  });

  it("treats whitespace-only as empty, restores all, and does not clear selection (AC-5)", () => {
    const nav = buildOperationNavModel(parseOk("fedge.json"));
    const selected = encodeOperationIdentity("patch", "/verbs");

    const whitespace = filterOperationNavModel(nav, "   \t  ", selected);
    expect(whitespace.model.sections.map((section) => section.key)).toEqual(
      nav.sections.map((section) => section.key),
    );
    expect(whitespace.model.operationCount).toBe(8);
    expect(whitespace.selectionVisible).toBe(true);

    const noMatch = filterOperationNavModel(nav, "zzz-no-such-operation", selected);
    expect(noMatch.model.sections).toEqual([]);
    expect(noMatch.model.operationCount).toBe(8);
    expect(noMatch.selectionVisible).toBe(false);

    const cleared = filterOperationNavModel(nav, "", selected);
    expect(cleared.selectionVisible).toBe(true);
    expect(identitiesIn(cleared.model).has(selected)).toBe(true);
  });

  it("marks selectionVisible false when selected identity is filtered out (AC-5)", () => {
    const nav = buildOperationNavModel(parseOk("fedge.json"));
    const selected = encodeOperationIdentity("get", "/verbs");
    const filtered = filterOperationNavModel(nav, "ghost", selected);
    expect(identitiesIn(filtered.model)).toEqual(
      new Set([encodeOperationIdentity("patch", "/verbs")]),
    );
    expect(filtered.selectionVisible).toBe(false);
  });
});
