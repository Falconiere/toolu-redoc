import { describe, expect, it } from "vitest";

import { OpenApiDocumentSchema } from "@/domains/openapi/api/openapi-document-schema";

describe("OpenApiDocumentSchema", () => {
  it("accepts a minimal OpenAPI 3.0 document", () => {
    const input = {
      openapi: "3.0.3",
      info: { title: "Pets", version: "1.0.0" },
      paths: {
        "/pets": {
          get: {
            responses: {
              "200": { description: "ok" },
            },
          },
        },
      },
    };
    const result = OpenApiDocumentSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.openapi).toBe("3.0.3");
      expect(result.data.info.title).toBe("Pets");
      expect(result.data.paths["/pets"]?.get?.responses["200"]).toEqual({
        description: "ok",
      });
    }
  });

  it("accepts a minimal OpenAPI 3.1 document with boolean schema and webhooks", () => {
    const input = {
      openapi: "3.1.0",
      info: { title: "Hooks", version: "2.0.0", description: "3.1 sample" },
      paths: {},
      webhooks: {
        newPet: {
          post: {
            responses: {
              "200": { description: "accepted" },
            },
          },
        },
      },
      components: {
        schemas: {
          Always: true,
          Never: false,
          NullableLegacy: { type: "string", nullable: true },
        },
      },
    };
    const result = OpenApiDocumentSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.openapi).toBe("3.1.0");
      expect(result.data.webhooks).toBeDefined();
      expect(result.data.components?.schemas?.Always).toBe(true);
      expect(result.data.components?.schemas?.Never).toBe(false);
    }
  });

  it("rejects Swagger 2 documents naming the unsupported family", () => {
    const input = {
      swagger: "2.0",
      info: { title: "Legacy", version: "1.0.0" },
      paths: {},
    };
    const result = OpenApiDocumentSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      const message = result.error.issues.map((issue) => issue.message).join(" ");
      expect(message.toLowerCase()).toContain("swagger");
    }
  });

  it("rejects OpenAPI 3.2 and other unknown versions", () => {
    const input = {
      openapi: "3.2.0",
      info: { title: "Future", version: "1.0.0" },
      paths: {},
    };
    const result = OpenApiDocumentSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      const message = result.error.issues.map((issue) => issue.message).join(" ");
      expect(message).toMatch(/3\.0|3\.1/);
    }
  });

  it("defaults missing paths to an empty object", () => {
    const input = {
      openapi: "3.0.3",
      info: { title: "Empty", version: "0.0.1" },
    };
    const result = OpenApiDocumentSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.paths).toEqual({});
    }
  });

  it("preserves 3.0 nullable and composition on schema objects", () => {
    const input = {
      openapi: "3.0.3",
      info: { title: "Schema", version: "1" },
      paths: {},
      components: {
        schemas: {
          Pet: {
            type: "object",
            nullable: true,
            required: ["id"],
            properties: {
              id: { type: "integer", default: 0 },
              tag: { type: "string", enum: ["", "a", null] },
            },
            allOf: [{ $ref: "#/components/schemas/Named" }],
            oneOf: [{ type: "string" }, { type: "number" }],
            anyOf: [{ type: "boolean" }],
            additionalProperties: false,
            "x-internal": true,
          },
        },
      },
    };
    const result = OpenApiDocumentSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      const pet = result.data.components?.schemas?.Pet;
      expect(pet).toMatchObject({
        type: "object",
        nullable: true,
        required: ["id"],
        "x-internal": true,
      });
      if (pet && typeof pet === "object") {
        expect(pet.properties?.tag).toMatchObject({
          type: "string",
          enum: ["", "a", null],
        });
        expect(pet.properties?.id).toMatchObject({ default: 0 });
      }
    }
  });
});
