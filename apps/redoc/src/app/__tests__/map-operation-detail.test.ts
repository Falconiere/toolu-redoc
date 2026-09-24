/** Real-fixture coverage for mapOperationDetail (param-merge, bodies, meta, examples). */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { mapOperationDetail } from "@/app/map-operation-detail";
import { parseOpenApiDocument } from "@/domains/openapi/api/parse-openapi-document";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../domains/openapi/__tests__/fixtures",
);

/** Read a committed OpenAPI fixture as UTF-8 text. */
function fixtureText(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf8");
}

/** Parse + map every operation; throw on parse failure. */
function mapAll(name: string) {
  const parsed = parseOpenApiDocument(fixtureText(name));
  if (!parsed.ok) {
    throw new Error(`${name}: ${parsed.error.message}`);
  }
  return {
    document: parsed.document,
    models: parsed.document.operations.map((operation) =>
      mapOperationDetail(operation, parsed.document.servers),
    ),
  };
}

describe("mapOperationDetail", () => {
  it("merges parameters and surfaces path-param issues from param-merge.json", () => {
    const { models } = mapAll("param-merge.json");
    const pets = models.find((model) => model.path === "/pets/{petId}");
    expect(pets).toBeDefined();
    if (pets === undefined) {
      throw new Error("missing GET /pets/{petId}");
    }
    const limitQuery = pets.parameters.find((row) => row.name === "limit" && row.in === "query");
    const limitHeader = pets.parameters.find((row) => row.name === "limit" && row.in === "header");
    expect(limitQuery?.description).toBe("operation limit wins");
    expect(limitHeader).toBeDefined();

    const items = models.find((model) => model.path === "/items/{itemId}");
    expect(items).toBeDefined();
    if (items === undefined) {
      throw new Error("missing GET /items/{itemId}");
    }
    expect(items.pathParameterIssues).toContainEqual({
      name: "itemId",
      issue: "missing",
    });
    expect(items.parameters.some((row) => row.name === "verbose" && row.in === "query")).toBe(true);
  });

  it("maps multi-media request and mixed responses from operation-detail-bodies.json", () => {
    const { models } = mapAll("operation-detail-bodies.json");
    expect(models).toHaveLength(1);
    const upload = models[0];
    if (upload === undefined) {
      throw new Error("missing upload operation");
    }
    expect(upload.requestBody?.mediaTypes).toEqual([
      "application/json",
      "application/x-www-form-urlencoded",
      "multipart/form-data",
    ]);
    const statuses = upload.responses.map((row) => row.status);
    expect(statuses).toEqual(expect.arrayContaining(["200", "default", "2XX", "204"]));
    const ok = upload.responses.find((row) => row.status === "200");
    expect(ok?.headers.some((header) => header.name === "X-RateLimit")).toBe(true);
    const noContent = upload.responses.find((row) => row.status === "204");
    expect(noContent?.emptyContent).toBe(true);
  });

  it("applies meta fallbacks, deprecated, and operation servers from operation-detail-meta.json", () => {
    const { models, document } = mapAll("operation-detail-meta.json");
    const bare = models.find((model) => model.path === "/bare");
    const legacy = models.find((model) => model.path === "/legacy");
    expect(bare?.summary).toBeNull();
    expect(bare?.operationId).toBeNull();
    expect(bare?.description).toBeNull();
    expect(bare?.servers).toEqual(
      document.servers.map((server) => ({
        url: server.url,
        description: server.description ?? null,
        variables: Object.entries(server.variables ?? {}).map(([name, variable]) => ({
          name,
          defaultValue: variable.default,
          enumValues: variable.enum ?? [],
        })),
      })),
    );
    expect(legacy?.deprecated).toBe(true);
    expect(legacy?.servers[0]?.url).toBe("https://op.example/{tenant}");
    expect(legacy?.servers[0]?.variables[0]).toEqual({
      name: "tenant",
      defaultValue: "acme",
      enumValues: ["acme", "other"],
    });
  });

  it("unwraps media examples with falsy values and externalValue from examples.json", () => {
    const { models } = mapAll("examples.json");
    const demo = models[0];
    if (demo?.requestBody === null || demo === undefined) {
      throw new Error("missing POST /demo request body");
    }
    const json = demo.requestBody.contents["application/json"];
    expect(json?.singularExample).toEqual({ present: true, value: false });
    expect(json?.defaultExampleKey).toBeNull();
    const zero = json?.namedExamples.find((example) => example.key === "zero");
    const empty = json?.namedExamples.find((example) => example.key === "empty");
    const nil = json?.namedExamples.find((example) => example.key === "nil");
    const remote = json?.namedExamples.find((example) => example.key === "remote");
    expect(zero?.value).toBe(0);
    expect(empty?.value).toBe("");
    expect(nil?.value).toBeNull();
    expect(remote?.value).toBeUndefined();
    expect(remote?.externalValue).toBe("https://example.com/examples/payload.json");
    expect(json?.typeSummary).toMatch(/^\$ref /);
    expect(json?.schemaHandle.kind).toBe("request");
    if (json?.schemaHandle.kind === "request") {
      expect(json.schemaHandle.ref).toBe("#/components/schemas/Payload");
    }
  });
});
