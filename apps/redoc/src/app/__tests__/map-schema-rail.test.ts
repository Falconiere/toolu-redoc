/** Real-fixture coverage for mapSchemaRail / mapSchemaNode (AC-1,3–8). */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { mapOperationDetail } from "@/app/map-operation-detail";
import { mapSchemaNode } from "@/app/map-schema-node";
import { mapSchemaRail } from "@/app/map-schema-rail";
import type { SchemaFocus } from "@/domains/docs/api/operation-detail-model";
import type { SchemaNode } from "@/domains/docs/api/schema-rail-model";
import type { NormalizedOpenApiDocument } from "@/domains/openapi/api/normalize-openapi-document";
import { parseOpenApiDocument } from "@/domains/openapi/api/parse-openapi-document";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../domains/openapi/__tests__/fixtures",
);
const petstorePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../domains/docs/api/dev-petstore-3.0.json",
);

/** Read a committed OpenAPI fixture as UTF-8 text. */
function fixtureText(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf8");
}

/** Parse a fixture; throw on failure. */
function parseFixture(name: string): NormalizedOpenApiDocument {
  const parsed = parseOpenApiDocument(fixtureText(name));
  if (!parsed.ok) {
    throw new Error(`${name}: ${parsed.error.message}`);
  }
  return parsed.document;
}

/** First response media SchemaFocus from mapOperationDetail. */
function firstResponseFocus(
  document: NormalizedOpenApiDocument,
  path: string,
  method = "get",
): { operation: (typeof document.operations)[number]; focus: SchemaFocus } {
  const operation = document.operations.find(
    (entry) => entry.path === path && entry.method === method,
  );
  if (operation === undefined) {
    throw new Error(`missing ${method.toUpperCase()} ${path}`);
  }
  const model = mapOperationDetail(operation, document.servers);
  const response = model.responses[0];
  if (response === undefined) {
    throw new Error(`no responses on ${path}`);
  }
  if (response.emptyContent) {
    return {
      operation,
      focus: {
        kind: "response",
        status: response.status,
        mediaType: null,
        headerName: null,
        typeSummary: "—",
        ref: null,
        exampleKey: null,
        externalValue: null,
      },
    };
  }
  const mediaType = response.mediaTypes[0];
  if (mediaType === undefined) {
    throw new Error(`no media on ${path}`);
  }
  const media = response.contents[mediaType];
  if (media?.schemaHandle.kind !== "response") {
    throw new Error(`missing media model for ${path}`);
  }
  return { operation, focus: media.schemaHandle };
}

/** Property names under a schema node. */
function propertyNames(node: SchemaNode | null): string[] {
  if (node?.kind !== "schema") {
    return [];
  }
  return node.properties.map((row) => row.name);
}

describe("mapSchemaRail", () => {
  it("resolves Petstore Pet $ref properties for GET /pet/{petId}", () => {
    const document = parseOpenApiDocument(readFileSync(petstorePath, "utf8"));
    if (!document.ok) {
      throw new Error(document.error.message);
    }
    const { operation, focus } = firstResponseFocus(document.document, "/pet/{petId}");
    const rail = mapSchemaRail(document.document, operation, focus);
    expect(rail).not.toBeNull();
    expect(rail?.root?.kind).toBe("schema");
    expect(propertyNames(rail?.root ?? null)).toEqual(
      expect.arrayContaining(["id", "name", "photoUrls"]),
    );
    expect(rail?.root && rail.root.kind === "schema" ? rail.root.viaRef : null).toBe(
      "#/components/schemas/Pet",
    );
  });

  it("preserves media example false/0/empty/null and labels externalValue", () => {
    const document = parseFixture("examples.json");
    const operation = document.operations[0];
    if (operation === undefined) {
      throw new Error("missing demo op");
    }
    const model = mapOperationDetail(operation, document.servers);
    const media = model.requestBody?.contents["application/json"];
    if (media?.schemaHandle.kind !== "request") {
      throw new Error("missing request media");
    }
    const singular = mapSchemaRail(document, operation, media.schemaHandle);
    expect(singular?.example).toEqual({
      kind: "value",
      value: false,
      source: "media",
      name: null,
    });

    const nilFocus: SchemaFocus = {
      kind: "request",
      mediaType: "application/json",
      typeSummary: media.typeSummary,
      ref: media.schemaHandle.ref,
      exampleKey: "nil",
      exampleValue: null,
      externalValue: null,
    };
    expect(mapSchemaRail(document, operation, nilFocus)?.example).toEqual({
      kind: "value",
      value: null,
      source: "media",
      name: "nil",
    });

    const remoteFocus: SchemaFocus = {
      kind: "request",
      mediaType: "application/json",
      typeSummary: media.typeSummary,
      ref: media.schemaHandle.ref,
      exampleKey: "remote",
      externalValue: "https://example.com/examples/payload.json",
    };
    expect(mapSchemaRail(document, operation, remoteFocus)?.example).toEqual({
      kind: "external",
      url: "https://example.com/examples/payload.json",
      name: "remote",
    });
  });

  it("surfaces external/dangling/wrong-kind/cycle boundaries from fixtures", () => {
    const externalDoc = parseFixture("schema-rail-ops.json");
    const { operation: extOp, focus: extFocus } = firstResponseFocus(externalDoc, "/external");
    const externalRail = mapSchemaRail(externalDoc, extOp, extFocus);
    expect(externalRail?.root?.kind).toBe("boundary");
    if (externalRail?.root?.kind === "boundary") {
      expect(externalRail.root.reason).toBe("external");
    }
    expect(externalRail?.notices.some((notice) => notice.code === "external-ref")).toBe(true);

    const fref = parseFixture("fref.json");
    const notices: { code: string; message: string }[] = [];
    const cycle = mapSchemaNode(fref, { $ref: "#/components/schemas/Node" }, 0, new Set(), notices);
    expect(cycle.kind).toBe("schema");
    if (cycle.kind === "schema") {
      const next = cycle.properties.find((row) => row.name === "next")?.node;
      expect(next?.kind).toBe("boundary");
      if (next?.kind === "boundary") {
        expect(next.reason).toBe("cycle");
      }
    }

    const wrongNotices: { code: string; message: string }[] = [];
    const wrong = mapSchemaNode(
      fref,
      { $ref: "#/components/parameters/Limit" },
      0,
      new Set(),
      wrongNotices,
    );
    expect(wrong.kind).toBe("boundary");
    if (wrong.kind === "boundary") {
      expect(wrong.reason).toBe("wrong-kind");
    }

    const danglingNotices: { code: string; message: string }[] = [];
    const dangling = mapSchemaNode(
      fref,
      { $ref: "#/components/schemas/Missing" },
      0,
      new Set(),
      danglingNotices,
    );
    expect(dangling.kind).toBe("boundary");
    if (dangling.kind === "boundary") {
      expect(dangling.reason).toBe("dangling");
    }
  });

  it("resolves escaped ~0/~1 schema names from fref Escaped", () => {
    const fref = parseFixture("fref.json");
    const notices: { code: string; message: string }[] = [];
    const node = mapSchemaNode(
      fref,
      { $ref: "#/components/schemas/Escaped" },
      0,
      new Set(),
      notices,
    );
    expect(node.kind).toBe("schema");
    if (node.kind !== "schema") {
      return;
    }
    const a = node.properties.find((row) => row.name === "a")?.node;
    const b = node.properties.find((row) => row.name === "b")?.node;
    expect(a?.kind).toBe("schema");
    expect(b?.kind).toBe("schema");
    if (a?.kind === "schema") {
      expect(a.description).toContain("tilde");
    }
    if (b?.kind === "schema") {
      expect(b.description).toContain("slash");
    }
  });

  it("clears schema root for bodyless 204 focus", () => {
    const document = parseFixture("schema-rail-ops.json");
    const { operation, focus } = firstResponseFocus(document, "/empty", "delete");
    expect(focus.kind === "response" && focus.mediaType === null).toBe(true);
    const rail = mapSchemaRail(document, operation, focus);
    expect(rail?.root).toBeNull();
    expect(rail?.example.kind).toBe("empty");
  });

  it("preserves 3.0 nullable and 3.1 null-union / boolean distinctions", () => {
    const doc30 = parseFixture("schema-rail-ops.json");
    const { operation: nullableOp, focus: nullableFocus } = firstResponseFocus(doc30, "/nullable");
    const nullableRail = mapSchemaRail(doc30, nullableOp, nullableFocus);
    expect(nullableRail?.root?.kind).toBe("schema");
    if (nullableRail?.root?.kind === "schema") {
      expect(nullableRail.root.nullable30).toBe(true);
      expect(nullableRail.root.nullInType).toBe(false);
      expect(nullableRail.root.typeLabel).toBe("string");
    }

    const falsy = firstResponseFocus(doc30, "/falsy");
    const falsyRail = mapSchemaRail(doc30, falsy.operation, falsy.focus);
    expect(falsyRail?.root?.kind).toBe("schema");
    if (falsyRail?.root?.kind === "schema") {
      expect(falsyRail.root.additionalProperties).toBe("forbidden");
      const flag = falsyRail.root.properties.find((row) => row.name === "flag")?.node;
      expect(flag?.kind).toBe("schema");
      if (flag?.kind === "schema") {
        expect(flag.defaultPresent).toBe(true);
        expect(flag.defaultValue).toBe(false);
        expect(flag.enumValues).toEqual([false, true]);
      }
    }

    const doc31 = parseFixture("schema-rail-ops-3.1.json");
    const items = firstResponseFocus(doc31, "/items");
    const itemsRail = mapSchemaRail(doc31, items.operation, items.focus);
    expect(itemsRail?.root?.kind).toBe("schema");
    if (itemsRail?.root?.kind === "schema") {
      expect(itemsRail.root.items?.kind).toBe("schema");
      if (itemsRail.root.items?.kind === "schema") {
        expect(itemsRail.root.items.nullInType).toBe(true);
        expect(itemsRail.root.items.nullable30).toBe(false);
      }
    }
    const always = firstResponseFocus(doc31, "/always");
    const alwaysRail = mapSchemaRail(doc31, always.operation, always.focus);
    expect(alwaysRail?.root).toEqual({
      kind: "boolean",
      value: true,
      description: null,
    });

    const dynamic = firstResponseFocus(doc31, "/dynamic");
    const dynamicRail = mapSchemaRail(doc31, dynamic.operation, dynamic.focus);
    expect(dynamicRail?.root?.kind).toBe("schema");
    if (dynamicRail?.root?.kind === "schema") {
      expect(dynamicRail.root.unsupportedKeywords).toEqual(
        expect.arrayContaining(["$id", "$dynamicRef", "x-unsupported-vendor"]),
      );
    }
  });

  it("keeps composition branches and discriminator without flattening", () => {
    const document = parseFixture("composition.json");
    const { operation } = firstResponseFocus(document, "/pets", "post");
    // Response 200 Pet is oneOf — use response focus from mapped model
    const model = mapOperationDetail(operation, document.servers);
    const ok = model.responses.find((row) => row.status === "200");
    const media = ok?.contents["application/json"];
    if (media?.schemaHandle.kind !== "response") {
      throw new Error("missing Pet response");
    }
    const rail = mapSchemaRail(document, operation, media.schemaHandle);
    expect(rail?.root?.kind).toBe("schema");
    if (rail?.root?.kind === "schema") {
      expect(rail.root.composition?.keyword).toBe("oneOf");
      expect(rail.root.composition?.branches).toHaveLength(2);
      expect(rail.root.discriminator?.propertyName).toBe("petType");
      expect(rail.root.discriminator?.mapping.map((row) => row.name)).toEqual(["cat", "dog"]);
    }
    // Request PetInput carries unsupported keywords
    const requestMedia = model.requestBody?.contents["application/json"];
    if (requestMedia?.schemaHandle.kind !== "request") {
      throw new Error("missing PetInput");
    }
    const requestRail = mapSchemaRail(document, operation, requestMedia.schemaHandle);
    expect(requestRail?.root?.kind).toBe("schema");
    if (requestRail?.root?.kind === "schema") {
      expect(requestRail.root.unsupportedKeywords).toEqual(
        expect.arrayContaining(["$id", "$dynamicRef", "x-unsupported-vendor"]),
      );
    }
  });

  it("returns null when focus or operation is null", () => {
    const document = parseFixture("fref.json");
    expect(mapSchemaRail(document, null, null)).toBeNull();
    expect(mapSchemaRail(document, document.operations[0] ?? null, null)).toBeNull();
  });
});
