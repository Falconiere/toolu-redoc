# OpenAPI 3.x Zod parse domain — Design

**Date:** 2026-09-24   **Status:** Approved   **Author:** epic-worker (issue #2)   **Topic:** Parse OpenAPI 3.0/3.1 JSON/YAML into a normalized Zod-backed in-memory model

## Problem

Every UI slice of the docs viewer needs a real OpenAPI model. Today `@toolu-redoc/redoc` has no parser: paste/URL loaders and operation/schema screens have nothing typed to consume. Without a Zod-validated 3.0/3.1 subset and a committed Petstore fixture, downstream issues cannot demonstrate real-data acceptance.

## Non-Goals

1. URL/HTTP loading, fetch timeout, streaming byte reads, cancellation of network responses, or CORS diagnosis (#3).
2. Swagger 2 conversion or acceptance of OpenAPI ≥3.2 / unknown version families.
3. Comprehensive OAS or JSON Schema conformance validation; only the viewer input/model boundary.
4. External `$ref` fetch, 3.1 `$id`/`$dynamicRef` resolution, or remote example URL fetch.
5. Flattening or evaluating `allOf`/`oneOf`/`anyOf` / discriminator semantics.
6. Request execution, credentials, auth flows, editing, linting, Turso, or hosted documents.
7. Effective security-requirement display (optional epic feature; **not accepted** for this issue).
8. UI screens, routing, filtering, or share-link encoding (#4–#8).

## Architecture

**Chosen approach:** a new `apps/redoc/src/domains/openapi` domain that owns (1) YAML/JSON decode of raw text, (2) Zod document schemas at the boundary, (3) normalization into a UI-ready model, (4) lazy same-document `$ref` expansion with depth/cycle guards, and (5) committed real fixtures under `__tests__/fixtures/`.

**Decisive trade-off:** keep the OpenAPI model client-local in the redoc domain (not `packages/types`) so only the viewer depends on it and domain isolation stays intact. Cost: other apps cannot import it without a later extraction.

**Reuse / add:**
- Zod 4 already in `@toolu-redoc/redoc` — schemas + `z.infer` only; no hand-written interfaces beside schemas.
- Add dependency `yaml` (eemeli). **One decode path for JSON and YAML paste text:** `parseAllDocuments` with `uniqueKeys: true`, `maxAliasCount: MAX_ALIAS_COUNT`, core schema (JSON-compatible scalars). Exactly one document required (`multi_document` if more; empty stream → `empty`/`yaml`). Document errors (duplicate keys, alias limit, tag resolve failures) map to structured `OpenApiParseError`. No second JSON parser — avoids silent `JSON.parse` duplicate-key last-wins. Format detection is unnecessary for decode; optional `sourceLanguage` hint may appear only in error messages.
- Shared parse limits live in `domains/openapi/api/openapi-limits.ts` so #3 can import the same byte/depth/alias constants (fetch timeout constant documented there for #3; unused by #2 parse path).
- Keep every production file ≤300 lines and functions within guardrails (`functionSize.max` 50 / 80 for tsx); split schema files by concern (`info`, `parameter`, `media-type`, `schema-object`, `path-item`, `document`).

**Module layout** (guardrails: `domains/*` → `api`, `__tests__`, …):

```
apps/redoc/src/domains/openapi/
  README.md
  api/
    openapi-limits.ts          # MAX_INPUT_BYTES, MAX_ALIAS_COUNT, MAX_SCHEMA_DEPTH, FETCH_TIMEOUT_MS
    openapi-parse-error.ts     # structured error codes + user-facing messages
    decode-openapi-text.ts     # JSON/YAML → unknown root (size + YAML policy)
    openapi-document-schema.ts # Zod OAS 3.0/3.1 subset (split files if >300 lines)
    normalize-openapi-document.ts
    resolve-local-ref.ts       # JSON Pointer + cycle/depth
    merge-parameters.ts        # path+operation by (name,in); operation wins
    operation-identity.ts      # method+path key encode/decode
    parse-openapi-document.ts  # public: text → Result<NormalizedOpenApi, OpenApiParseError>
  __tests__/
    fixtures/                  # Petstore + scenario fixtures + provenance.md
    parse-openapi-document.test.ts
    …scenario suites…
```

No barrel `index.ts`. Callers import concrete files. Domain map updates: `src/domains/README.md`, `domains/openapi/README.md`, and `AGENTS.md` repo map line. Until #3 wires a loader/UI, colocated `__tests__` are the intentional consumers of the public parse API and must keep knip green without ignore patterns or dead exports.

## Interfaces / Schema

### Public parse API

```ts
parseOpenApiDocument(input: string): ParseOpenApiResult

type ParseOpenApiResult =
  | { ok: true; document: NormalizedOpenApiDocument }
  | { ok: false; error: OpenApiParseError }

type OpenApiParseError = {
  code:
    | "empty"
    | "oversize"
    | "json"
    | "yaml"
    | "version"
    | "schema"
    | "multi_document"
    | "alias_limit"
  message: string // user-facing, no stack
  path?: string // JSON Pointer or dotted path when available
}
```

Input is UTF-16 JS string length measured as UTF-8 byte length via `TextEncoder` before decode. Empty/whitespace → `empty`. Bytes > `MAX_INPUT_BYTES` → `oversize` without parsing.

### Agreed limits (shared with #3)

| Constant | Value | Owner of enforcement |
| --- | --- | --- |
| `MAX_INPUT_BYTES` | `5 * 1024 * 1024` (5 MiB UTF-8) | #2 on paste/parse; #3 while reading URL bodies |
| `MAX_ALIAS_COUNT` | `100` | #2 YAML `toJS` / parse |
| `MAX_SCHEMA_DEPTH` | `25` | #2 lazy `$ref` expand |
| `FETCH_TIMEOUT_MS` | `15_000` | #3 only (exported for agreement) |

### Version gate

Accept `openapi` string matching `/^3\.0\.\d+$/` or `/^3\.1\.\d+$/`. Reject absent version, `swagger: "2.0"`, `3.2.x`, and unknown families with `code: "version"`. Detect Swagger 2 via top-level `swagger` before or during version check so the message names the unsupported family.

### Zod boundary field inventory (practical subset)

Root document (`OpenApiDocumentSchema`) — object with:

| Field | Rule |
| --- | --- |
| `openapi` | string; refined to 3.0.x / 3.1.x |
| `info` | `{ title: string, version: string, description?: string }` (+ passthrough ignored extras) |
| `servers?` | array of `{ url: string, description?: string, variables?: Record<string, { default: string, enum?: string[], description?: string }> }` |
| `tags?` | array of `{ name: string, description?: string }` |
| `paths?` | `Record<path, PathItem>`; default `{}` |
| `webhooks?` | retained as opaque `Record` for notices only (3.1); not turned into operations |
| `components?` | `{ schemas?, parameters?, requestBodies?, responses?, headers?, examples? }` each map of named objects / refs |
| `jsonSchemaDialect?` | optional string (3.1); stored, not evaluated |

`PathItem`: optional `$ref`; optional `summary`/`description`/`servers`; `parameters?`; per-method Operation for the eight verbs only; any other keys ignored as non-operations (including `trace` handled as verb).

`Operation`: `tags?`, `summary?`, `description?`, `operationId?`, `deprecated?` (bool), `parameters?`, `requestBody?` (RequestBody \| Reference), `responses` (map keyed by status/`default`/range), `servers?`, `callbacks?` (opaque → notice), vendor extensions preserved under a catch-all passthrough collected into `unsupportedKeywords` where needed.

`Parameter`: `name`, `in` ∈ path\|query\|header\|cookie, `required?`, `deprecated?`, `description?`, `schema?`, `content?`, `example?`, `examples?`. Path params: normalize flags when template `{name}` missing or `required` not true.

`RequestBody`: `description?`, `required?`, `content` map of media type → `MediaType`.

`MediaType`: `schema?`, `example?`, `examples?` (named map), `encoding?` (opaque/raw). Precedence for display helpers: media `example`/`examples` over schema examples.

`Response`: `description` (string; allow empty), `headers?`, `content?`, `$ref?`.

`SchemaObject` (recursive, lazy Zod): boolean schema allowed when `openapi` is 3.1.x; object form supports `type`, `format`, `description`, `properties`, `required` (string[]), `items`, `enum`, `default`, `nullable` (3.0), `readOnly`, `writeOnly`, `additionalProperties` (bool \| schema), numeric/string constraints (`minimum`, `maximum`, `minLength`, `maxLength`, `pattern`, `minItems`, `maxItems`, `uniqueItems`), composition `allOf`/`oneOf`/`anyOf`/`not`, `discriminator` `{ propertyName, mapping? }`, `$ref`, 3.1 `$id`/`$dynamicRef`/`$dynamicAnchor` (flag unsupported, keep raw), and a passthrough bag for other keywords listed in `unsupportedKeywords`. Do not invent `type` or `required` when absent. Preserve literal `enum`/`default` values including `false`/`0`/`""`/`null`.

`Reference`: `{ $ref: string }` only at positions the contract resolves (schema, parameter, requestBody, response, header, example).

Unknown top-level keys: ignored for normalization except `swagger` (version error) and `webhooks` (notice). Zod should use targeted objects + `.catchall(z.unknown())` or strip-unknown consistently; normalization only reads the inventory above.

### Normalized model (inferred from Zod + normalize)

- `info`: title, version, description?
- `servers[]`: url, description?, variables?
- `tags[]`: name, description? (document order)
- `operations[]`: each `{ method, path, operationId?, summary?, description?, deprecated, tags[], parameters[], requestBody?, responses, servers?, unsupported: { callbacks?, links? } }`
  - Methods: GET PUT POST DELETE OPTIONS HEAD PATCH TRACE only; Path Item metadata keys never become operations.
  - Identity key: exact `method` + `path` (reversible encode helper); `operationId` never defines identity.
- `parameters` on an operation: path-item + operation parameters merged by `(name, in)`; operation overrides; missing/non-required path-template params flagged on the operation without dropping siblings.
- `requestBody` / `responses`: requiredness, media types, status/default/range keys, headers, examples as authored (preserve `false`/`0`/`""`/`null`).
- `components.schemas` (and other supported component maps needed for local refs): preserve 3.0 `nullable` vs 3.1 null unions; accept 3.1 boolean schemas; keep `allOf`/`oneOf`/`anyOf`/discriminator as authored; unsupported keywords retained under `raw`/`unsupportedKeywords`.
- `notices[]`: e.g. webhooks-present, external-ref, dynamic-ref, callbacks/links-on-operation — local, non-fatal.
- Empty `paths` or webhook-only 3.1 docs: `operations: []` plus notice; not a version/schema failure.

### Ref resolution helper

`resolveLocalRef(doc, pointer, { depth })` — decode `~0`/`~1`; expand lazily; on cycle or depth > 25 return a visible unresolved node; dangling/wrong-kind → local notice; external URI refs → unsupported notice, no fetch.

### Fixture provenance

`__tests__/fixtures/provenance.md` records source URL, retrieved date, SHA-256 for Petstore and each scenario fixture id (F30, F31, FBAD*, FEDGE, FREF, …).

## Failure modes and edge cases

| Input | Observable behavior |
| --- | --- |
| Empty / whitespace | `{ ok:false, code:"empty" }`; no throw of raw Error stack to UI |
| >5 MiB UTF-8 | `oversize`; no YAML/JSON parse attempted |
| Truncated JSON/YAML, scalar/array root | `json`/`yaml`/`schema` with actionable message |
| Duplicate mapping keys (JSON or YAML via eemeli `uniqueKeys`) | reject deterministically (`yaml` or mapped `schema` code) |
| JSON paste that is not YAML-1.2-compatible | `yaml`/`json` actionable error (rare; still structured) |
| Multiple YAML documents | `multi_document` |
| Alias expansion above `MAX_ALIAS_COUNT` | `alias_limit` without hang |
| Non-JSON custom tags | `yaml` reject |
| Swagger 2 / 3.2 / missing openapi | `version` |
| Valid empty paths / webhook-only | success; `operations: []`; webhook notice when present |
| External `$ref` / `$dynamicRef` | success with local unsupported notice; no network |
| Recursive local `$ref` | stop at depth/cycle with visible boundary node |
| Invalid path-template params | flagged on operation; other ops retained |
| Prior successful document | parse API is pure; replacement/retention policy belongs to #3 loader state |

## Acceptance criteria

- **AC-1:** Given Petstore OpenAPI 3.x JSON bytes committed under `domains/openapi/__tests__/fixtures/`, `parseOpenApiDocument` returns `ok:true` with expected info title/version and a non-empty `operations` set matching the fixture’s path verbs (T01 / Petstore).
- **AC-2:** Given the same logical document as YAML, parse yields the same operation identity set and version-specific schema distinctions as the JSON form (T01).
- **AC-3:** Given F30 and F31 fixtures (3.0 and 3.1) in JSON and YAML, both succeed and retain version-specific schema values (nullable vs null union / boolean schemas as authored) (T01, T16).
- **AC-3b:** Given paired 3.0-nullable vs 3.1-null-union schemas plus enum/default/required/array/readOnly/writeOnly/additionalProperties fixtures, the normalized schema nodes preserve authored distinctions including falsy literals — no invented `type` or `required` (T16).
- **AC-4:** Given FBAD cases (empty/whitespace, truncated, scalar/array root, absent version, Swagger 2, 3.2, unknown version), each returns `ok:false` with a structured `code` + user-facing `message` and never a raw stack string as the primary error (T02).
- **AC-5:** Given a valid document with empty `paths`, and a 3.1 webhook-only document, both return `ok:true`, `operations: []`, and the webhook-only case includes a webhooks unsupported notice rather than `version`/`schema` failure (T03).
- **AC-6:** Given duplicate keys, multi-doc YAML, non-JSON tags, and aliases at/above `MAX_ALIAS_COUNT`, parse rejects deterministically; alias case completes without hanging; JSON-compatible YAML scalars keep types (T04).
- **AC-7:** Given FEDGE (eight verbs, Path Item metadata, multi/duplicate/undeclared tags, untagged ops), the operation set and tag grouping match the contract; metadata keys are not operations (T10).
- **AC-8:** Given ops with missing/duplicate `operationId` and paths containing braces, slashes, tilde, spaces, Unicode, `operation-identity` round-trips method/path without collision; identity ignores `operationId` (T11).
- **AC-9:** Given path-level and operation-level parameters, merge by `(name,in)` with operation wins; distinct `in` preserved; missing/optional path-template params flagged without dropping other operations (T13).
- **AC-10:** Given FREF (shared local refs, `~0`/`~1`, recursion, dangling, wrong kind, external), supported pointers resolve; recursion stops at visible boundary; failures are local notices (T17).
- **AC-11:** Given composition fixtures (allOf/oneOf/anyOf, discriminator, unsupported keywords, callbacks/webhooks/links, 3.1 `$id`/`$dynamicRef`), branches remain inspectable; unsupported semantics disclosed; no flatten/fetch (T18).
- **AC-12:** Given media-type and schema examples including `false`/`0`/`""`/`null`, and external example URL, model preserves values and labels external URL without fetching; media-type example(s) take precedence fields as authored for UI (T19 model surface).
- **AC-13:** Given inputs at exactly `MAX_INPUT_BYTES` and one byte over, and alias/depth at and one over limits, boundary accepted / excess rejected; depth-bounded tree remains usable (T23 parse-owned subset). Fetch/stream/cancel evidence deferred to #3.
- **AC-14:** Zod schemas define the boundary; exported types are `z.infer` only; colocated real-data tests cover AC-1–AC-13; domain README + AGENTS/domains inventory updated.

## Acceptance evidence

| AC | Real input / fixture | Expected | Boundary | Check |
| --- | --- | --- | --- | --- |
| AC-1 | Petstore JSON (pinned SHA in provenance.md) | `ok`, ops nonempty, info matches | — | `bun run --filter @toolu-redoc/redoc test` |
| AC-2 | Petstore YAML twin | Same op identity set as JSON | — | same |
| AC-3 | F30/F31 JSON+YAML | Version-specific schema fields retained | 3.0 nullable vs 3.1 null | same |
| AC-3b | schema-distinctions fixture | authored distinctions + falsy literals | no invented type/required | same |
| AC-4 | FBAD set | Structured errors per case | each bad class | same |
| AC-5 | empty-paths.json; webhook-only-3.1.yaml | ops=[]; webhook notice | — | same |
| AC-6 | dup-key, multi-doc, bad-tag, alias bomb | reject; no hang | alias at/above 100 | same |
| AC-7 | FEDGE | exact op set + tags | Path Item metadata | same |
| AC-8 | identity paths fixture | round-trip keys | Unicode/tilde/space | same |
| AC-9 | param-merge fixture | merge + flags | override/(name,in) | same |
| AC-10 | FREF | resolve + notices | cycle/depth/external | same |
| AC-11 | composition fixture | inspectable branches | no fetch | same |
| AC-12 | examples fixture | preserve falsy; external labeled | precedence fields | same |
| AC-13 | generated size/alias/depth fixtures | accept boundary; reject +1 | 5 MiB / 100 / 25 | same |
| AC-14 | source review + gate | z.infer only; docs updated | — | `bun run check` + file review |

## Documentation impact

- `apps/redoc/src/domains/openapi/README.md` — new domain inventory and public parse entry.
- `apps/redoc/src/domains/README.md` — list `openapi`.
- `apps/redoc/AGENTS.md` — note `domains/openapi` in the repo map.
- `docs/toolu/specs/2026-09-24-openapi-zod-parse-design.md` — this contract.
- Fixture `provenance.md` under the domain tests.
- No product README user-journey change until a loader UI lands (#3/#5).

## Open Questions

1. **Security-requirement display** — Deferred (not accepted). Owner: epic. Non-blocking for #2.
2. **Fetch/stream/cancel T23 remainder** — Owned by #3; #2 exports `FETCH_TIMEOUT_MS` and `MAX_INPUT_BYTES` for shared agreement. Non-blocking.
3. **YAML alias default 100 vs higher** — **Decided:** `MAX_ALIAS_COUNT = 100` (eemeli default, explicit constant). Reason: prevents alias bombs while allowing normal anchors; issue asked for an agreed bound, not a raise.
4. **Module home / YAML lib / fixture path** — **Decided:** `domains/openapi`; `yaml` (eemeli); fixtures under `__tests__/fixtures/`. Reason: Jev + guardrails allowlist + domain isolation.
5. **JSON duplicate keys** — **Decided:** decode JSON and YAML through the same eemeli `parseAllDocuments` path with `uniqueKeys: true`. Reason: one policy for both serializations; avoids silent `JSON.parse` last-wins.

All previously blocking limit confirmations for #2 are decided above; #3 must reuse the same byte/timeout constants when implementing load.
