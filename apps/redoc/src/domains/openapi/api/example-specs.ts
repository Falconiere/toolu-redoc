/** Gallery manifest: example OpenAPI documents shipped under `public/examples/`. */
import { normalizeBasePath } from "@/domains/openapi/api/build-share-href";

/** One bundled example document (bytes live in `public/examples/<file>`). */
export type ExampleSpec = {
  /** Stable kebab-case id. */
  id: string;
  /** Must equal the parsed `info.title`. */
  title: string;
  /** Basename under `public/examples/`. */
  file: string;
  format: "json" | "yaml";
  /** Must equal the parsed `openapi` major.minor. */
  openapi: "3.0" | "3.1";
  /** One line: what this example shows off. */
  blurb: string;
};

/**
 * Display order for the load-screen gallery. Provenance, licences, and SHA-256
 * hashes for every file are in `public/examples/NOTICE.md` (tests enforce it).
 */
export const EXAMPLE_SPECS: readonly ExampleSpec[] = [
  {
    id: "petstore-3.0-json",
    title: "Swagger Petstore - OpenAPI 3.0",
    file: "petstore-3.0.json",
    format: "json",
    openapi: "3.0",
    blurb: "The canonical OpenAPI 3.0 sample — 19 operations across pet, store, and user.",
  },
  {
    id: "petstore-3.0-yaml",
    title: "Swagger Petstore - OpenAPI 3.0",
    file: "petstore-3.0.yaml",
    format: "yaml",
    openapi: "3.0",
    blurb: "The same Petstore document, loaded from YAML.",
  },
  {
    id: "museum-3.1",
    title: "Redocly Museum API",
    file: "museum-3.1.yaml",
    format: "yaml",
    openapi: "3.1",
    blurb: "A real OpenAPI 3.1 API by Redocly — webhooks, named examples, and tags.",
  },
  {
    id: "feature-tour-3.1",
    title: "Toolu Redoc Feature Tour",
    file: "feature-tour-3.1.yaml",
    format: "yaml",
    openapi: "3.1",
    blurb:
      "oneOf + discriminator, allOf, a $ref cycle, null unions, falsy examples, a deprecated operation, and a webhook.",
  },
];

/** Absolute same-origin href of an example: `origin<basePath>examples/<file>`. */
export function exampleSpecHref(spec: ExampleSpec, origin: string, basePath: string): string {
  const trimmedOrigin = origin.endsWith("/") ? origin.slice(0, -1) : origin;
  return `${trimmedOrigin}${normalizeBasePath(basePath)}examples/${spec.file}`;
}
