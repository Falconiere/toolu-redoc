import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  MAX_ALIAS_COUNT,
  MAX_INPUT_BYTES,
  MAX_SCHEMA_DEPTH,
} from "@/domains/openapi/api/openapi-limits";
import {
  decodeOperationIdentity,
  encodeOperationIdentity,
  OPENAPI_HTTP_METHODS,
} from "@/domains/openapi/api/operation-identity";
import { parseOpenApiDocument } from "@/domains/openapi/api/parse-openapi-document";
import { resolveLocalRef, type UnresolvedRef } from "@/domains/openapi/api/resolve-local-ref";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

/** Load committed fixture bytes as UTF-8. */
function fixtureText(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf8");
}

/** Assert ok parse and return the normalized document. */
function parseOk(name: string) {
  const result = parseOpenApiDocument(fixtureText(name));
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`${name}: ${result.error.code} ${result.error.message}`);
  }
  return result.document;
}

/** Operation identity set for comparing JSON/YAML twins. */
function identitySet(document: { operations: Array<{ identity: string }> }) {
  return new Set(document.operations.map((op) => op.identity));
}

/** Narrow unresolved ref markers from resolveLocalRef. */
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

describe("parseOpenApiDocument acceptance", () => {
  it("AC-1: Petstore JSON yields info and non-empty operations", () => {
    const document = parseOk("petstore-3.0.json");
    expect(document.openapi).toMatch(/^3\.0\.\d+$/);
    expect(document.info.title).toBe("Swagger Petstore - OpenAPI 3.0");
    expect(document.info.version.length).toBeGreaterThan(0);
    expect(document.operations.length).toBeGreaterThan(0);
    for (const operation of document.operations) {
      expect(OPENAPI_HTTP_METHODS).toContain(operation.method);
      expect(operation.path.startsWith("/")).toBe(true);
    }
  });

  it("AC-2: Petstore YAML matches JSON operation identities", () => {
    const jsonDoc = parseOk("petstore-3.0.json");
    const yamlDoc = parseOk("petstore-3.0.yaml");
    expect(yamlDoc.openapi).toBe(jsonDoc.openapi);
    expect(yamlDoc.info.title).toBe(jsonDoc.info.title);
    expect(identitySet(yamlDoc)).toEqual(identitySet(jsonDoc));
  });

  it("AC-3: F30/F31 JSON+YAML retain version-specific schema values", () => {
    const f30Json = parseOk("f30.json");
    const f30Yaml = parseOk("f30.yaml");
    expect(f30Json.openapi).toBe("3.0.3");
    expect(identitySet(f30Yaml)).toEqual(identitySet(f30Json));
    const item30 = f30Json.components?.schemas?.Item;
    expect(item30).toMatchObject({ type: "object", nullable: true });

    const f31Json = parseOk("f31.json");
    const f31Yaml = parseOk("f31.yaml");
    expect(f31Json.openapi).toBe("3.1.0");
    expect(identitySet(f31Yaml)).toEqual(identitySet(f31Json));
    expect(f31Json.components?.schemas?.Always).toBe(true);
    expect(f31Json.components?.schemas?.Never).toBe(false);
    const item31 = f31Json.components?.schemas?.Item;
    expect(item31).toMatchObject({ type: ["object", "null"] });
    expect(item31 && typeof item31 === "object" && "nullable" in item31).toBe(false);
  });

  it("AC-3b: schema distinctions preserve authored fields and falsy literals", () => {
    const document = parseOk("schema-distinctions.json");
    const schemas = document.components?.schemas;
    expect(schemas?.NullableString30).toMatchObject({
      type: "string",
      nullable: true,
    });
    const bare = schemas?.NoTypeInvented;
    expect(bare).toMatchObject({ description: "no type or required invented" });
    expect(bare && typeof bare === "object" && "type" in bare).toBe(false);
    expect(bare && typeof bare === "object" && "required" in bare).toBe(false);

    const falsy = schemas?.FalsyLiterals;
    expect(falsy && typeof falsy === "object").toBe(true);
    if (falsy && typeof falsy === "object") {
      expect(falsy.properties?.flag).toMatchObject({
        default: false,
        enum: [false, true],
      });
      expect(falsy.properties?.count).toMatchObject({ default: 0, enum: [0, 1] });
      expect(falsy.properties?.name).toMatchObject({ default: "", enum: ["", "x"] });
      expect(falsy.properties?.maybe).toMatchObject({
        default: null,
        enum: [null, "y"],
      });
      expect(falsy.additionalProperties).toBe(false);
    }
    expect(schemas?.ArrayConstraints).toMatchObject({
      type: "array",
      minItems: 0,
      default: [],
    });
    expect(schemas?.ReadWrite).toMatchObject({
      properties: {
        createdAt: { readOnly: true },
        secret: { writeOnly: true },
      },
    });
    expect(schemas?.AdditionalPropsSchema).toMatchObject({
      additionalProperties: { type: "number" },
    });
  });

  it("AC-4: FBAD cases return structured codes without raw stacks", () => {
    const empty = parseOpenApiDocument(fixtureText("fbad-empty.txt"));
    expect(empty.ok).toBe(false);
    if (!empty.ok) {
      expect(empty.error.code).toBe("empty");
      expect(empty.error.message).not.toMatch(/\n\s+at /);
    }

    const truncated = parseOpenApiDocument("{");
    expect(truncated.ok).toBe(false);
    if (!truncated.ok) {
      expect(["yaml", "json", "schema"]).toContain(truncated.error.code);
    }

    const scalar = parseOpenApiDocument('"just-a-string"');
    expect(scalar.ok).toBe(false);
    if (!scalar.ok) {
      expect(["schema", "version"]).toContain(scalar.error.code);
    }

    const arrayRoot = parseOpenApiDocument("[]");
    expect(arrayRoot.ok).toBe(false);
    if (!arrayRoot.ok) {
      expect(arrayRoot.error.code).toBe("schema");
    }

    const missingVersion = parseOpenApiDocument(
      JSON.stringify({ info: { title: "x", version: "1" }, paths: {} }),
    );
    expect(missingVersion.ok).toBe(false);
    if (!missingVersion.ok) {
      expect(missingVersion.error.code).toBe("version");
    }

    const swagger = parseOpenApiDocument(
      JSON.stringify({
        swagger: "2.0",
        info: { title: "x", version: "1" },
        paths: {},
      }),
    );
    expect(swagger.ok).toBe(false);
    if (!swagger.ok) {
      expect(swagger.error.code).toBe("version");
    }

    const future = parseOpenApiDocument(
      JSON.stringify({
        openapi: "3.2.0",
        info: { title: "x", version: "1" },
        paths: {},
      }),
    );
    expect(future.ok).toBe(false);
    if (!future.ok) {
      expect(future.error.code).toBe("version");
    }
  });

  it("AC-5: empty paths and webhook-only succeed with empty operations", () => {
    const empty = parseOk("empty-paths.json");
    expect(empty.operations).toEqual([]);
    expect(empty.notices).toEqual([]);

    const webhooks = parseOk("webhook-only-3.1.yaml");
    expect(webhooks.operations).toEqual([]);
    expect(webhooks.notices.some((n) => n.code === "webhooks-present")).toBe(true);
  });

  it("AC-6: duplicate keys, multi-doc, and alias bomb reject deterministically", () => {
    const dup = parseOpenApiDocument(fixtureText("fbad-dup-key.yaml"));
    expect(dup.ok).toBe(false);
    if (!dup.ok) {
      expect(dup.error.code).toBe("yaml");
    }

    const multi = parseOpenApiDocument(fixtureText("fbad-multi-doc.yaml"));
    expect(multi.ok).toBe(false);
    if (!multi.ok) {
      expect(multi.error.code).toBe("multi_document");
    }

    const started = Date.now();
    const alias = parseOpenApiDocument(fixtureText("fbad-alias-bomb.yaml"));
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(alias.ok).toBe(false);
    if (!alias.ok) {
      expect(alias.error.code).toBe("alias_limit");
    }
  });

  it("AC-7: FEDGE operation set ignores Path Item metadata", () => {
    const document = parseOk("fedge.json");
    const identities = document.operations.map((op) => op.identity).toSorted();
    const expected = OPENAPI_HTTP_METHODS.map((method) =>
      encodeOperationIdentity(method, "/verbs"),
    ).toSorted();
    expect(identities).toEqual(expected);
    expect(document.operations.some((op) => op.path === "/meta")).toBe(false);
  });

  it("AC-8: identity round-trips through public parse", () => {
    const document = parseOk("identity-paths.json");
    for (const operation of document.operations) {
      expect(decodeOperationIdentity(operation.identity)).toEqual({
        method: operation.method,
        path: operation.path,
      });
    }
  });

  it("AC-9: param-merge operation wins and flags path-template issues", () => {
    const document = parseOk("param-merge.json");
    expect(document.operations.length).toBeGreaterThan(0);
    const flagged = document.operations.filter((op) => op.pathParameterIssues.length > 0);
    expect(flagged.length).toBeGreaterThan(0);
    const overridden = document.operations.find(
      (op) => op.path === "/pets/{petId}" && op.method === "get",
    );
    expect(overridden).toBeDefined();
  });

  it("AC-10: FREF resolves local refs and bounds recursion via public parse", () => {
    const document = parseOk("fref.json");
    const pet = resolveLocalRef(document, "#/components/schemas/Pet");
    expect(pet.notices).toEqual([]);
    expect(pet.value).toMatchObject({ type: "object" });

    const external = resolveLocalRef(document, "https://example.com/schemas/Remote");
    expect(isUnresolvedRef(external.value)).toBe(true);
    if (isUnresolvedRef(external.value)) {
      expect(external.value.reason).toBe("external");
    }

    const cycle = resolveLocalRef(document, "#/components/schemas/LoopA");
    expect(isUnresolvedRef(cycle.value)).toBe(true);
    if (isUnresolvedRef(cycle.value)) {
      expect(["cycle", "depth"]).toContain(cycle.value.reason);
    }
  });

  it("AC-11: composition branches stay inspectable with unsupported notices", () => {
    const document = parseOk("composition.json");
    const pet = document.components?.schemas?.Pet;
    expect(pet && typeof pet === "object").toBe(true);
    if (pet && typeof pet === "object") {
      expect(pet.oneOf?.length).toBe(2);
      expect(pet.discriminator?.propertyName).toBe("petType");
    }
    expect(document.notices.some((n) => n.code === "webhooks-present")).toBe(true);
    expect(
      document.notices.some(
        (n) => n.code === "callbacks-on-operation" || n.code === "links-on-operation",
      ),
    ).toBe(true);
    expect(
      document.notices.some((n) => n.code === "dynamic-ref" || n.code === "unsupported-keyword"),
    ).toBe(true);
  });

  it("AC-12: examples preserve falsy literals and label externalValue", () => {
    const document = parseOk("examples.json");
    const post = document.operations.find((op) => op.method === "post" && op.path === "/demo");
    expect(post?.requestBody).toBeDefined();
    const body = post?.requestBody;
    expect(body && typeof body === "object" && "content" in body).toBe(true);
    if (body && typeof body === "object" && "content" in body) {
      const media = body.content["application/json"];
      expect(media?.example).toBe(false);
      const examples = media?.examples;
      expect(examples?.zero).toMatchObject({ value: 0 });
      expect(examples?.empty).toMatchObject({ value: "" });
      expect(examples?.nil).toMatchObject({ value: null });
      expect(examples?.remote).toMatchObject({
        externalValue: "https://example.com/examples/payload.json",
      });
    }
    expect(document.components?.examples?.componentRemote).toMatchObject({
      externalValue: "https://example.com/examples/component.json",
    });
  });

  it("AC-13: size, alias, and depth boundaries", () => {
    const exactText = buildExactMaxInputDocument();
    expect(new TextEncoder().encode(exactText).byteLength).toBe(MAX_INPUT_BYTES);
    const atLimit = parseOpenApiDocument(exactText);
    expect(atLimit.ok).toBe(true);

    const oversize = parseOpenApiDocument(`${exactText}x`);
    expect(oversize.ok).toBe(false);
    if (!oversize.ok) {
      expect(oversize.error.code).toBe("oversize");
    }

    const alias = parseOpenApiDocument(fixtureText("fbad-alias-bomb.yaml"));
    expect(alias.ok).toBe(false);
    if (!alias.ok) {
      expect(alias.error.code).toBe("alias_limit");
      expect(MAX_ALIAS_COUNT).toBe(100);
    }

    const depthDoc = buildDepthChainDocument(MAX_SCHEMA_DEPTH + 2);
    const deep = resolveLocalRef(depthDoc, "#/components/schemas/D0", {
      depth: 0,
    });
    expect(isUnresolvedRef(deep.value)).toBe(true);
    if (isUnresolvedRef(deep.value)) {
      expect(deep.value.reason).toBe("depth");
    }
    const usable = resolveLocalRef(parseOk("fref.json"), "#/components/schemas/Pet");
    expect(usable.notices).toEqual([]);
    expect(usable.value).toMatchObject({ type: "object" });
  });
});

/** UTF-8 document whose encode length is exactly {@link MAX_INPUT_BYTES}. */
function buildExactMaxInputDocument(): string {
  const prefix = '{"openapi":"3.0.3","info":{"title":"T","version":"1"},"paths":{},"x-pad":"';
  const suffix = '"}';
  const overhead = new TextEncoder().encode(prefix + suffix).byteLength;
  const fill = MAX_INPUT_BYTES - overhead;
  if (fill < 0) {
    throw new Error("MAX_INPUT_BYTES too small for boundary fixture");
  }
  return `${prefix}${"p".repeat(fill)}${suffix}`;
}

/** Synthetic local `$ref` chain for depth-boundary checks (AC-13). */
function buildDepthChainDocument(length: number): unknown {
  const schemas: Record<string, unknown> = {};
  for (let index = 0; index <= length; index += 1) {
    schemas[`D${index}`] = {
      $ref: `#/components/schemas/D${index + 1}`,
    };
  }
  return {
    openapi: "3.0.3",
    info: { title: "depth", version: "1" },
    paths: {},
    components: { schemas },
  };
}
