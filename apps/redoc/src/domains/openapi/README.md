# src/domains/openapi

Owns OpenAPI 3.0/3.1 paste/parse **and** URL/paste load UX: decode JSON/YAML,
Zod-validate a practical subset, normalize an in-memory model, fetch remote
specs via `@/api/http-client`, present the Signal load screen on `/`, and after
success hand off to the docs viewer (selection via search `op`, share copy UI).

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
| `api/resolve-operation-selection.ts` | Resolve `op` → none \| selected \| unknown |
| `api/build-share-href.ts` | Compose public `<base>?url=&op=` share href (`basePath` = Vite `BASE_URL`) |
| `api/example-specs.ts` | Gallery manifest `EXAMPLE_SPECS` + `exampleSpecHref` (bytes in `public/examples/`) |
| `api/write-operation-search.ts` | Merge `op` into search while preserving `url` |
| `api/network-error-message.ts` | Honest network / mixed-content guidance |
| `api/spec-load-error.ts` | Structured load failure codes |
| `api/openapi-*-schema*.ts` | Zod boundary schemas (`z.infer` types only) — the domain models |
| `api/normalize-openapi-document.ts` | Operations, notices, parameter merge |
| `api/merge-parameters.ts` | Path + operation parameter merge by `(name,in)` |
| `api/operation-identity.ts` | Reversible method+path identity keys |
| `api/build-operation-nav-model.ts` | Tag-grouped `OperationNavModel` for the docs sidebar |
| `api/filter-operation-nav-model.ts` | Case-insensitive nav filter + `selectionVisible` |
| `api/resolve-local-ref.ts` | Same-document JSON Pointer expansion |
| `hooks/use-spec-load.ts` | Latest-wins load state (cancel, retain, reset) |
| `screens/spec-load-screen.tsx` | Signal paste + URL load UI (+ `renderLoaded` handoff) |
| `components/loaded-docs-toolbar.tsx` | Post-load title/version/share/reset chrome |
| `components/share-operation-link.tsx` | Copy link + query/paste disclosure |
| `components/spec-example-gallery.tsx` | "Try an example" index rows; plain click loads in place, modified click opens the share link |
| `components/` | Load banner / form pieces |
| `__tests__/fixtures/` | Petstore + scenario fixtures + `provenance.md` |
| `__tests__/fixture-http-server.ts` | Real Node fixture HTTP server for load tests + preview smoke (also `/examples/<manifest file>`) |
| `__tests__/preview-smoke.ts` | T27 Playwright smoke against production `dist/` (root build, or the gallery journey when `REDOC_BASE_PATH` is set) |
| `__tests__/parse-acceptance.test.ts` | Parse AC real-fixture suites |

Public entries:

- `@/domains/openapi/api/parse-openapi-document` → `parseOpenApiDocument`
- `@/domains/openapi/api/load-openapi-document` → `loadOpenApiDocument`
- `@/domains/openapi/api/build-operation-nav-model` → `buildOperationNavModel`
- `@/domains/openapi/api/filter-operation-nav-model` → `filterOperationNavModel`
- `@/domains/openapi/screens/spec-load-screen` → `SpecLoadScreen` (via `src/app/index.tsx`)

Only `src/app/**` routes may import this domain.

## Models, parse, and screens

| Concern | Where |
| --- | --- |
| Zod models / schemas | `api/openapi-*-schema*.ts` (`z.infer` types; no parallel interfaces) |
| Parse | `parseOpenApiDocument` ← decode → Zod → normalize |
| Load | `loadOpenApiDocument` (paste \| URL) + `useSpecLoad` + `SpecLoadScreen` |
| Screens | `screens/spec-load-screen.tsx` on `/`; post-load viewer composed in `src/app/` |

## Share URL contract (`/` search)

| Param | Meaning | Owner |
| --- | --- | --- |
| `url` | Absolute http(s) source URL (one search value) | loads on `/` (under the deploy base path, e.g. `/toolu-redoc/` on GitHub Pages) |
| `op` | `encodeOperationIdentity(method, path)` | selects operation after load |

## Fixture HTTP server lifecycle

```ts
const server = await startFixtureHttpServer();
try {
  // server.baseUrl + "/fixtures/petstore.json"
} finally {
  await server.close();
}
```

Used by Vitest URL-load suites and `__tests__/preview-smoke.ts`. Serves permissive
CORS for localhost Chromium smoke only — not a production CORS product claim.
Full distinct-origin browser CORS matrix (epic T06) remains documentation-only:
opaque fetch errors show paste recovery without diagnosing CORS.

## Explicitly not this domain

Try it out, credentials, hosted platform, Swagger 2, remote `$ref` fetch — see
`apps/redoc/README.md` Out of scope.
