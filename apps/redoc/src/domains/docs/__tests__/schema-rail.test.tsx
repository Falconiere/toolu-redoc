/** SchemaRail disclosure UI + AC-2/3/6/9 real-fixture tests. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { mapOperationDetail } from "@/app/map-operation-detail";
import { mapSchemaRail } from "@/app/map-schema-rail";
import type { SchemaFocus } from "@/domains/docs/api/operation-detail-model";
import { schemaRailHasContent, type SchemaRailModel } from "@/domains/docs/api/schema-rail-model";
import { SchemaRail } from "@/domains/docs/components/schema-rail";
import { parseOpenApiDocument } from "@/domains/openapi/api/parse-openapi-document";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../openapi/__tests__/fixtures",
);
const petstorePath = join(dirname(fileURLToPath(import.meta.url)), "../api/dev-petstore-3.0.json");

/** Exact FSAFE corpus from the shell spec (T26 rail slice). */
const FSAFE_CORPUS = [
  '<script>alert("xss")</script>',
  "<img src=x onerror=alert(1)>",
  "javascript:alert(1)",
];

/** Parse fixture text; throw on failure. */
function parseFixture(name: string) {
  const parsed = parseOpenApiDocument(readFileSync(join(fixturesDir, name), "utf8"));
  if (!parsed.ok) {
    throw new Error(`${name}: ${parsed.error.message}`);
  }
  return parsed.document;
}

/** Map first response focus for a path. */
function railForPath(fixture: string, path: string, method = "get"): SchemaRailModel {
  const document = parseFixture(fixture);
  const operation = document.operations.find(
    (entry) => entry.path === path && entry.method === method,
  );
  if (operation === undefined) {
    throw new Error(`missing ${method} ${path}`);
  }
  const model = mapOperationDetail(operation, document.servers);
  const response = model.responses[0];
  if (response === undefined) {
    throw new Error("no response");
  }
  let focus: SchemaFocus;
  if (response.emptyContent) {
    focus = {
      kind: "response",
      status: response.status,
      mediaType: null,
      headerName: null,
      typeSummary: "—",
      ref: null,
      exampleKey: null,
      externalValue: null,
    };
  } else {
    const mediaType = response.mediaTypes[0];
    const media = mediaType !== undefined ? response.contents[mediaType] : undefined;
    if (media?.schemaHandle.kind !== "response") {
      throw new Error("missing media");
    }
    focus = media.schemaHandle;
  }
  const rail = mapSchemaRail(document, operation, focus);
  if (rail === null) {
    throw new Error("expected rail model");
  }
  return rail;
}

describe("SchemaRail", () => {
  it("AC-2: renders a disclosure tree for Petstore Pet, not JSON-only dump", () => {
    const document = parseOpenApiDocument(readFileSync(petstorePath, "utf8"));
    if (!document.ok) {
      throw new Error(document.error.message);
    }
    const operation = document.document.operations.find(
      (entry) => entry.path === "/pet/{petId}" && entry.method === "get",
    );
    if (operation === undefined) {
      throw new Error("missing GET /pet/{petId}");
    }
    const model = mapOperationDetail(operation, document.document.servers);
    const media = model.responses[0]?.contents["application/json"];
    if (media?.schemaHandle.kind !== "response") {
      throw new Error("missing response media");
    }
    const rail = mapSchemaRail(document.document, operation, media.schemaHandle);
    expect(rail).not.toBeNull();
    if (rail === null) {
      return;
    }
    render(<SchemaRail model={rail} />);
    const schemaRegion = screen.getByRole("region", { name: "Schema" });
    expect(within(schemaRegion).getByText(/via #\/components\/schemas\/Pet/)).toBeInTheDocument();
    const nameDetails = Array.from(schemaRegion.querySelectorAll("details")).find((el) => {
      const summary = el.querySelector(":scope > summary .type-data");
      return summary?.textContent === "name";
    });
    expect(nameDetails).toBeDefined();
    expect(schemaRegion.textContent).toContain("photoUrls");
    expect(schemaRegion.querySelectorAll("details").length).toBeGreaterThan(1);
  });

  it("AC-3: shows media example values including false", () => {
    const document = parseFixture("examples.json");
    const operation = document.operations[0];
    if (operation === undefined) {
      throw new Error("missing op");
    }
    const model = mapOperationDetail(operation, document.servers);
    const media = model.requestBody?.contents["application/json"];
    if (media?.schemaHandle.kind !== "request") {
      throw new Error("missing request");
    }
    const rail = mapSchemaRail(document, operation, media.schemaHandle);
    expect(rail).not.toBeNull();
    if (rail === null) {
      return;
    }
    render(<SchemaRail model={rail} />);
    expect(screen.getByLabelText("Example value")).toHaveTextContent("false");
  });

  it("AC-6: 204 model shows No schema after a prior body tree", () => {
    const withBody = railForPath("operation-detail-bodies.json", "/upload", "post");
    const { rerender } = render(<SchemaRail model={withBody} />);
    expect(screen.getByRole("region", { name: "Schema" }).textContent).not.toMatch(/^No schema/);

    const empty = railForPath("schema-rail-ops.json", "/empty", "delete");
    rerender(<SchemaRail model={empty} />);
    expect(screen.getByText("No schema.")).toBeInTheDocument();
  });

  it("AC-9: FSAFE description and example stay inert with zero fetch", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const model: SchemaRailModel = {
      heading: "Request · application/json",
      notices: [],
      root: {
        kind: "schema",
        viaRef: null,
        typeLabel: "object",
        format: null,
        description: FSAFE_CORPUS[0] ?? null,
        nullable30: false,
        nullInType: false,
        requiredNames: [],
        enumValues: null,
        defaultPresent: false,
        defaultValue: undefined,
        readOnly: false,
        writeOnly: false,
        properties: [],
        additionalProperties: null,
        items: null,
        composition: null,
        discriminator: null,
        unsupportedKeywords: [],
        constraints: [],
      },
      example: {
        kind: "value",
        value: FSAFE_CORPUS.join("\n"),
        source: "media",
        name: null,
      },
    };
    const { container } = render(<SchemaRail model={model} />);
    for (const sample of FSAFE_CORPUS) {
      expect(container).toHaveTextContent(sample);
    }
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(0);
    fetchSpy.mockRestore();
  });

  it("shows the empty placeholder when model is null", () => {
    render(<SchemaRail model={null} />);
    expect(screen.getByText("Schemas and examples appear here.")).toBeInTheDocument();
  });
});

describe("schemaRailHasContent", () => {
  it("is false for null and empty example+schema without notices", () => {
    expect(schemaRailHasContent(null)).toBe(false);
    expect(
      schemaRailHasContent({
        heading: "Response 200",
        notices: [],
        root: null,
        example: { kind: "empty" },
      }),
    ).toBe(false);
  });

  it("is true when schema, example, or notices are present", () => {
    expect(
      schemaRailHasContent({
        heading: "Response 200",
        notices: [{ code: "depth", message: "bounded" }],
        root: null,
        example: { kind: "empty" },
      }),
    ).toBe(true);
    expect(
      schemaRailHasContent({
        heading: "Response 200",
        notices: [],
        root: { kind: "boolean", value: true, description: null },
        example: { kind: "empty" },
      }),
    ).toBe(true);
    expect(
      schemaRailHasContent({
        heading: "Response 200",
        notices: [],
        root: null,
        example: { kind: "value", value: 1, source: "media", name: null },
      }),
    ).toBe(true);
  });
});
