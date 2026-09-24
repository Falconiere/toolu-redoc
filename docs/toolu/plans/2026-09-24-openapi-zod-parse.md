# OpenAPI 3.x Zod parse — Plan

**Date:** 2026-09-24   **Status:** Approved   **Spec:** docs/toolu/specs/2026-09-24-openapi-zod-parse-design.md   **Topic:** Implement domains/openapi parse + fixtures + real-data tests

## Evidence and approach

Inspected approved spec, `apps/redoc/AGENTS.md`, `guardrails.config.json` (`domains/*` → `api`/`__tests__`), existing Zod style in `packages/types` and `apps/redoc/src/constants/env.ts`, and empty `domains/home` shape. No OpenAPI parser exists yet.

**Outcome:** `parseOpenApiDocument(text)` returns a structured Result with a normalized 3.0/3.1 model; Petstore + scenario fixtures prove every AC with colocated Vitest; docs/AGENTS updated; `bun run check` green.

**Approach:** decode-first (eemeli `yaml` for JSON+YAML with `uniqueKeys` + alias bound) → Zod boundary schemas (split files) → normalize (ops, param merge, identity, notices) → lazy local `$ref` → public parse API → fixtures/tests → docs/gate.

**Constraints:** max-lines 300; no barrels; `z.infer` only; no mocks as substitute for document bytes; T23 HTTP/stream/cancel left to #3; security-requirement display out of scope.

**T02 prior-document retention:** out of scope for #2. `parseOpenApiDocument` is a pure function with no document store. AC-4 proves structured errors only. #3 owns “invalid load must not replace a prior successful document.” Do not invent a parser-side cache to satisfy T02’s retention clause.

**Zod recursion:** implement `SchemaObject` with Zod 4 `z.lazy` (and boolean schema union for 3.1) in `openapi-schema-object.ts`; keep the file under 300 lines by moving media/parameter schemas out.

**Knip:** tests under `src/**/__tests__` import the public API; do not add knip ignores. If knip still flags an export, delete it or use it from a test — never a production stub solely for knip.

**Petstore / fixture sources (pinned in `provenance.md`):**
- Primary Petstore: official OAS 3 Petstore JSON from `https://petstore3.swagger.io/api/v3/openapi.json` (retrieve during fixtures-e2e; commit bytes + SHA-256). Derive YAML twin with eemeli `stringify` of the parsed document (or an official YAML if available) so AC-2 compares equivalent models.
- F30/F31: minimal hand-authored 3.0.3 and 3.1.0 documents exercising nullable vs null-union and boolean schema (not full Petstore clones).
- FBAD/FEDGE/FREF/examples/size/alias: hand-authored under `__tests__/fixtures/` per scenario tables; size boundary fixtures generated in-test with `TextEncoder` rather than committing a 5 MiB blob (assert encode length === MAX and MAX+1).

**AC coverage:** every spec `AC-1`…`AC-14` and `AC-3b` appears in at least one ledger `ac_refs` (verified by script during plan-review).

## Workstream summary

limits/errors → text decode → Zod schemas → normalize + identity + params → ref resolve → public parse → real fixtures/tests by AC → domain docs → full quality gate.

## Steps (machine-readable)

```json
[
  {
    "id": "deps-limits",
    "title": "Add yaml dependency and openapi-limits + OpenApiParseError modules",
    "ac_refs": ["AC-13", "AC-14"],
    "paths": [
      "apps/redoc/package.json",
      "apps/redoc/src/domains/openapi/README.md",
      "apps/redoc/src/domains/openapi/api/openapi-limits.ts",
      "apps/redoc/src/domains/openapi/api/openapi-parse-error.ts",
      "apps/redoc/src/domains/openapi/api/__tests__/openapi-limits.test.ts"
    ],
    "input": "Constant values 5MiB / alias 100 / depth 25 / fetch 15000 exported and asserted; domain README stub present for guardrails",
    "check": "bun run --filter @toolu-redoc/redoc test && test -f apps/redoc/src/domains/openapi/api/openapi-limits.ts && test -f apps/redoc/src/domains/openapi/README.md",
    "model": "haiku"
  },
  {
    "id": "decode",
    "title": "Implement decode-openapi-text (size gate + parseAllDocuments uniqueKeys/alias)",
    "depends_on": ["deps-limits"],
    "ac_refs": ["AC-4", "AC-6", "AC-13"],
    "paths": [
      "apps/redoc/src/domains/openapi/api/decode-openapi-text.ts",
      "apps/redoc/src/domains/openapi/api/__tests__/decode-openapi-text.test.ts",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/fbad-empty.txt",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/fbad-dup-key.yaml",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/fbad-multi-doc.yaml",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/fbad-alias-bomb.yaml"
    ],
    "input": "FBAD empty/oversize/dup-key/multi-doc/alias fixtures as real bytes",
    "check": "bun run --filter @toolu-redoc/redoc test",
    "model": "sonnet"
  },
  {
    "id": "zod-schemas",
    "title": "Add split Zod OpenAPI document/path/operation/parameter/media/schema schemas",
    "depends_on": ["decode"],
    "ac_refs": ["AC-3", "AC-3b", "AC-14"],
    "paths": [
      "apps/redoc/src/domains/openapi/api/schemas/openapi-info-schema.ts",
      "apps/redoc/src/domains/openapi/api/schemas/openapi-parameter-schema.ts",
      "apps/redoc/src/domains/openapi/api/schemas/openapi-media-schema.ts",
      "apps/redoc/src/domains/openapi/api/schemas/openapi-schema-object.ts",
      "apps/redoc/src/domains/openapi/api/schemas/openapi-path-item-schema.ts",
      "apps/redoc/src/domains/openapi/api/schemas/openapi-document-schema.ts",
      "apps/redoc/src/domains/openapi/api/__tests__/openapi-document-schema.test.ts"
    ],
    "input": "Minimal valid 3.0/3.1 objects and swagger-2 / 3.2 rejects as plain objects before normalize",
    "check": "bun run --filter @toolu-redoc/redoc test",
    "model": "sonnet"
  },
  {
    "id": "normalize",
    "title": "Normalize document: operations, identity, param merge, notices",
    "depends_on": ["zod-schemas"],
    "ac_refs": ["AC-5", "AC-7", "AC-8", "AC-9", "AC-11"],
    "paths": [
      "apps/redoc/src/domains/openapi/api/operation-identity.ts",
      "apps/redoc/src/domains/openapi/api/merge-parameters.ts",
      "apps/redoc/src/domains/openapi/api/normalize-openapi-document.ts",
      "apps/redoc/src/domains/openapi/api/__tests__/normalize-openapi-document.test.ts",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/fedge.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/empty-paths.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/webhook-only-3.1.yaml"
    ],
    "input": "FEDGE, empty-paths, webhook-only, param-merge, identity path fixtures",
    "check": "bun run --filter @toolu-redoc/redoc test",
    "model": "sonnet"
  },
  {
    "id": "refs",
    "title": "Implement resolve-local-ref with depth/cycle/external notices",
    "depends_on": ["normalize"],
    "ac_refs": ["AC-10", "AC-11"],
    "paths": [
      "apps/redoc/src/domains/openapi/api/resolve-local-ref.ts",
      "apps/redoc/src/domains/openapi/api/__tests__/resolve-local-ref.test.ts",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/fref.json"
    ],
    "input": "FREF fixture bytes (shared local, escaped keys, recursion, dangling, wrong kind, external)",
    "check": "bun run --filter @toolu-redoc/redoc test",
    "model": "sonnet"
  },
  {
    "id": "parse-api",
    "title": "Wire parseOpenApiDocument public Result API",
    "depends_on": ["refs"],
    "ac_refs": ["AC-1", "AC-2", "AC-4", "AC-14"],
    "paths": [
      "apps/redoc/src/domains/openapi/api/parse-openapi-document.ts",
      "apps/redoc/src/domains/openapi/api/__tests__/parse-openapi-document.test.ts"
    ],
    "input": "Petstore JSON/YAML + FBAD version cases through public API",
    "check": "bun run --filter @toolu-redoc/redoc test",
    "model": "sonnet"
  },
  {
    "id": "fixtures-e2e",
    "title": "Commit Petstore + scenario fixtures with provenance checksums and AC suites",
    "depends_on": ["parse-api"],
    "ac_refs": ["AC-1", "AC-2", "AC-3", "AC-3b", "AC-5", "AC-7", "AC-8", "AC-9", "AC-10", "AC-11", "AC-12", "AC-13"],
    "paths": [
      "apps/redoc/src/domains/openapi/__tests__/fixtures/provenance.md",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/petstore-3.0.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/petstore-3.0.yaml",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/f30.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/f31.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/schema-distinctions.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/examples.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/composition.json",
      "apps/redoc/src/domains/openapi/__tests__/parse-acceptance.test.ts"
    ],
    "input": "Pinned Petstore and F30/F31/examples/composition/size-boundary fixture bytes; SHA-256 in provenance.md",
    "check": "bun run --filter @toolu-redoc/redoc test",
    "model": "sonnet"
  },
  {
    "id": "docs",
    "title": "Update domain README, domains inventory, AGENTS map",
    "depends_on": ["fixtures-e2e"],
    "ac_refs": ["AC-14"],
    "paths": [
      "apps/redoc/src/domains/openapi/README.md",
      "apps/redoc/src/domains/README.md",
      "apps/redoc/AGENTS.md"
    ],
    "input": "Doc text naming parseOpenApiDocument and fixture location",
    "check": "rg -n \"openapi|parseOpenApiDocument\" apps/redoc/src/domains/README.md apps/redoc/src/domains/openapi/README.md apps/redoc/AGENTS.md",
    "model": "haiku"
  },
  {
    "id": "gate",
    "title": "Full quality gate green on the branch",
    "depends_on": ["docs"],
    "ac_refs": ["AC-14"],
    "paths": [
      "apps/redoc/src/domains/openapi/**",
      "docs/toolu/specs/2026-09-24-openapi-zod-parse-design.md",
      "docs/toolu/plans/2026-09-24-openapi-zod-parse.md"
    ],
    "input": "Entire branch after implementation",
    "check": "bun run check",
    "model": "sonnet"
  },
  {
    "id": "deliver",
    "title": "Rebase on origin/main, push branch, open PR, babysit to ready",
    "depends_on": ["gate"],
    "ac_refs": ["AC-14"],
    "paths": [
      "apps/redoc/src/domains/openapi/**",
      "docs/toolu/**"
    ],
    "input": "Green gate + PR body Closes #2 / Part of #1 with verification evidence",
    "check": "git status -sb && gh pr view --json number,url,statusCheckRollup",
    "model": "sonnet"
  }
]
```

## Critical files

- Create: `apps/redoc/src/domains/openapi/**` (api modules, schemas, fixtures, tests, README)
- Modify: `apps/redoc/package.json` (+ `yaml`), `bun.lock`, `apps/redoc/src/domains/README.md`, `apps/redoc/AGENTS.md`
- Design artifacts: `docs/toolu/specs/2026-09-24-openapi-zod-parse-design.md`, `docs/toolu/plans/2026-09-24-openapi-zod-parse.md`

## Verification

- Every AC mapped above has a real fixture or generated boundary input and a Vitest assertion on `parseOpenApiDocument` (or a lower layer for decode-only cases).
- Failure cases assert structured `code` + `message` (no primary raw stack).
- `bun run check` at repo root must pass (typecheck, lint, fmt, structure, knip, jscpd, tests).
- Docs list the new domain and public entry in the same change.
- PR targets `main`, conventional title, body starts with `Closes Falconiere/toolu-redoc#2` and `Part of Falconiere/toolu-redoc#1`.
- Guardrails: no `schemas/` under `domains/openapi/api/` if nested allowlist blocks it — **use flat `api/*-schema.ts` files** if `api/schemas` is disallowed.

### Nested-folder note

`guardrails.config.json` constrains children of `domains/*` only (`api`, `__tests__`, …). Children of `api/` are unconstrained, so `api/schemas/` is allowed. Prefer that split to stay under 300 lines; if a check disagrees, flatten to `api/openapi-*-schema.ts`.
