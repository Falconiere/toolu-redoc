/** AC-5 / AC-8: resolveOperationSelection against real fixture identities. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { encodeOperationIdentity } from "@/domains/openapi/api/operation-identity";
import { parseOpenApiDocument } from "@/domains/openapi/api/parse-openapi-document";
import { resolveOperationSelection } from "@/domains/openapi/api/resolve-operation-selection";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../../__tests__/fixtures");

/** Load committed fixture bytes as UTF-8. */
function fixtureText(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf8");
}

/** Parse a fixture and return its operation identity list. */
function parseIdentities(name: string): Array<{ identity: string }> {
  const result = parseOpenApiDocument(fixtureText(name));
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.document.operations.map((operation) => ({ identity: operation.identity }));
}

describe("resolveOperationSelection", () => {
  it("returns none for missing or empty op", () => {
    const identities = parseIdentities("petstore-3.0.json");
    expect(resolveOperationSelection(undefined, identities)).toEqual({ kind: "none" });
    expect(resolveOperationSelection("", identities)).toEqual({ kind: "none" });
  });

  it("selects get /pet/findByStatus from Petstore twin identities (AC-1 key)", () => {
    const identities = parseIdentities("petstore-3.0.json");
    const op = encodeOperationIdentity("get", "/pet/findByStatus");
    const selection = resolveOperationSelection(op, identities);
    expect(selection).toEqual({ kind: "selected", identity: op });
  });

  it("returns unknown/malformed for non-JSON and bad method (AC-5)", () => {
    const identities = parseIdentities("petstore-3.0.json");
    expect(resolveOperationSelection("not-json", identities)).toEqual({
      kind: "unknown",
      rawOp: "not-json",
      reason: "malformed",
    });
    expect(resolveOperationSelection(JSON.stringify(["fly", "/x"]), identities)).toEqual({
      kind: "unknown",
      rawOp: JSON.stringify(["fly", "/x"]),
      reason: "malformed",
    });
  });

  it("returns unknown/missing when identity is absent (empty-paths)", () => {
    const identities = parseIdentities("empty-paths.json");
    const op = encodeOperationIdentity("get", "/pet/findByStatus");
    expect(resolveOperationSelection(op, identities)).toEqual({
      kind: "unknown",
      rawOp: op,
      reason: "missing",
    });
  });

  it("round-trips identity-paths Unicode/tilde/space keys without collision (AC-8)", () => {
    const identities = parseIdentities("identity-paths.json");
    expect(identities.length).toBeGreaterThan(0);
    for (const { identity } of identities) {
      const selection = resolveOperationSelection(identity, identities);
      expect(selection).toEqual({ kind: "selected", identity });
    }
  });
});
