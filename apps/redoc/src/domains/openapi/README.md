# src/domains/openapi

Owns OpenAPI 3.0/3.1 paste/parse: decode JSON/YAML text, Zod-validate a practical
subset, and normalize an in-memory model for the docs viewer.

| Path | Holds |
| --- | --- |
| `api/openapi-limits.ts` | Shared byte/alias/depth/fetch-timeout constants |
| `api/openapi-parse-error.ts` | Structured user-facing parse error shape |
| `api/decode-openapi-text.ts` | Size gate + eemeli YAML decode (JSON+YAML) |
| `api/parse-openapi-document.ts` | Public `parseOpenApiDocument` Result API |
| `api/openapi-*-schema*.ts` | Zod boundary schemas (`z.infer` types only) |
| `api/normalize-openapi-document.ts` | Operations, notices, parameter merge |
| `api/merge-parameters.ts` | Path + operation parameter merge by `(name,in)` |
| `api/operation-identity.ts` | Reversible method+path identity keys |
| `api/resolve-local-ref.ts` | Same-document JSON Pointer expansion |
| `__tests__/fixtures/` | Petstore + scenario fixtures + `provenance.md` |
| `__tests__/parse-acceptance.test.ts` | AC-1…AC-13 real-fixture suites |

Public entry: `@/domains/openapi/api/parse-openapi-document` → `parseOpenApiDocument`.
Only `src/app/**` routes may import this domain.
