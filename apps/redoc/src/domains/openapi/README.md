# src/domains/openapi

Owns OpenAPI 3.0/3.1 paste/parse **and** URL/paste load UX: decode JSON/YAML,
Zod-validate a practical subset, normalize an in-memory model, fetch remote
specs via `@/api/http-client`, and present the Signal load screen on `/`.

| Path | Holds |
| --- | --- |
| `api/openapi-limits.ts` | Shared byte/alias/depth/fetch-timeout constants |
| `api/openapi-parse-error.ts` | Structured user-facing parse error shape |
| `api/decode-openapi-text.ts` | Size gate + eemeli YAML decode (JSON+YAML) |
| `api/parse-openapi-document.ts` | Public `parseOpenApiDocument` Result API |
| `api/load-openapi-document.ts` | Public `loadOpenApiDocument` paste \| URL → parse |
| `api/fetch-openapi-text.ts` | URL fetch with byte cap, timeout, HTML sniff |
| `api/validate-spec-source-url.ts` | http(s)-only source URL gate (no userinfo) |
| `api/spec-source-search.ts` | `/` search coerce for `url` + `op` params |
| `api/network-error-message.ts` | Honest network / mixed-content guidance |
| `api/spec-load-error.ts` | Structured load failure codes |
| `api/openapi-*-schema*.ts` | Zod boundary schemas (`z.infer` types only) |
| `api/normalize-openapi-document.ts` | Operations, notices, parameter merge |
| `api/merge-parameters.ts` | Path + operation parameter merge by `(name,in)` |
| `api/operation-identity.ts` | Reversible method+path identity keys |
| `api/resolve-local-ref.ts` | Same-document JSON Pointer expansion |
| `hooks/use-spec-load.ts` | Latest-wins load state (cancel, retain, reset) |
| `screens/spec-load-screen.tsx` | Signal paste + URL load UI |
| `components/` | Load banner / form pieces |
| `__tests__/fixtures/` | Petstore + scenario fixtures + `provenance.md` |
| `__tests__/fixture-http-server.ts` | Real Node fixture HTTP server for load tests |
| `__tests__/parse-acceptance.test.ts` | Parse AC real-fixture suites |

Public entries:

- `@/domains/openapi/api/parse-openapi-document` → `parseOpenApiDocument`
- `@/domains/openapi/api/load-openapi-document` → `loadOpenApiDocument`
- `@/domains/openapi/screens/spec-load-screen` → `SpecLoadScreen` (via `src/app/index.tsx`)

Only `src/app/**` routes may import this domain.

## Share URL contract (`/` search)

| Param | Meaning | Owner |
| --- | --- | --- |
| `url` | Absolute http(s) source URL (one search value) | #3 loads |
| `op` | percent-encoded `encodeOperationIdentity(method, path)` | #8 selects; #3 preserves |

## Blocked (not claimed pass on this issue)

- T06 full distinct-origin browser CORS matrix → #9 browser harness
- T20 operation restore / history; T21 pending-`op` after paste; T22 filter/selection/copy chrome → #8
