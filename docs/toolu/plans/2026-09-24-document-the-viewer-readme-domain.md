# Document the viewer (README, domain map, load journey) — Plan

**Date:** 2026-09-24   **Status:** Approved   **Spec:** docs/toolu/specs/2026-09-24-document-the-viewer-readme-domain-design.md   **Topic:** Docs + CI redoc build + Playwright preview smoke (T27 / AC-8)

## Evidence and approach

Inspected approved #9 spec; current `apps/redoc/README.md` / domain READMEs / AGENTS.md (partial load docs from #3/#8, no Out of scope, openapi README still lists T06/Workers as blocked-on-#9); `.github/workflows/ci.yml` (api wrangler dry-run only — no redoc `vite build`); `fixture-http-server.ts` route `/fixtures/petstore.json` + Petstore SHA `246cfe…`; share UI label `Copy link`; filter `aria-label="Filter operations"`; `encodeOperationIdentity("get","/pet/findByStatus")`.

**Outcome:** README + domain maps + Out of scope + fixture-server lifecycle; CI builds redoc and runs pinned Playwright preview smoke against `dist/` + real Petstore fixture; `Hello from Toolu Redoc` remains absent; full gate green.

**Approach:** docs first (README/domain/AGENTS/root) → add `playwright` + `preview-smoke.ts` + package script → wire CI build/install/smoke → run gate + smoke.

**Constraints:** no product behavior change beyond harness; no full T06 CORS matrix; no Workers wrangler smoke; domain isolation unchanged; max-lines 300; no barrels.

**AC coverage:** every spec `AC-1`…`AC-7` appears in at least one ledger `ac_refs`.

## Workstream summary

docs surfaces → preview smoke harness → CI wiring → verification gate.

## Steps (machine-readable)

```json
[
  {
    "id": "readme-journey",
    "title": "Expand apps/redoc/README.md: Out of scope, limits/CORS/paste lifetime, fixture-server lifecycle, T27 command journey, / vs /docs, url+op",
    "ac_refs": ["AC-1", "AC-2"],
    "paths": [
      "apps/redoc/README.md",
      "apps/redoc/src/domains/openapi/api/spec-source-search.ts",
      "apps/redoc/src/domains/openapi/__tests__/fixture-http-server.ts",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/provenance.md"
    ],
    "input": "Existing README sections; Petstore title Swagger Petstore - OpenAPI 3.0; search params url+op from spec-source-search",
    "check": "rg -n \"Out of scope|Try it out|hosted|fixture-http-server|\\\\?url=|Filter operations|bun run --filter @toolu-redoc/redoc build\" apps/redoc/README.md",
    "model": "sonnet"
  },
  {
    "id": "domain-maps",
    "title": "Update domains/openapi + docs + domains README inventories; clear stale #9 harness blocker lines",
    "depends_on": ["readme-journey"],
    "ac_refs": ["AC-3", "AC-4"],
    "paths": [
      "apps/redoc/src/domains/openapi/README.md",
      "apps/redoc/src/domains/docs/README.md",
      "apps/redoc/src/domains/README.md"
    ],
    "input": "Current openapi/docs inventories; document fixture-server lifecycle; no T06/Workers blocked-on-#9 claims",
    "check": "rg -n \"parseOpenApiDocument|loadOpenApiDocument|SpecLoadScreen|fixture-http-server|SchemaRail\" apps/redoc/src/domains/openapi/README.md apps/redoc/src/domains/docs/README.md apps/redoc/src/domains/README.md && (! rg -n \"blocked-on-#9|Hello from Toolu Redoc\" apps/redoc/src/domains/openapi/README.md apps/redoc)",
    "model": "haiku"
  },
  {
    "id": "agents-root-pointers",
    "title": "Add Out-of-scope / load-journey pointers in AGENTS.md and root README",
    "depends_on": ["readme-journey"],
    "ac_refs": ["AC-7"],
    "paths": [
      "apps/redoc/AGENTS.md",
      "README.md"
    ],
    "input": "One-line pointers to apps/redoc/README.md Out of scope and load journey",
    "check": "rg -n \"Out of scope|apps/redoc/README\" apps/redoc/AGENTS.md README.md",
    "model": "haiku"
  },
  {
    "id": "preview-smoke",
    "title": "Add playwright dep + scripts/preview-smoke.ts: dist preview, fixture Petstore URL load, filter/select/share, reload",
    "depends_on": ["readme-journey"],
    "ac_refs": ["AC-6"],
    "paths": [
      "apps/redoc/src/domains/openapi/__tests__/preview-smoke.ts",
      "apps/redoc/package.json",
      "apps/redoc/src/domains/openapi/__tests__/fixture-http-server.ts",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/petstore-3.0.json",
      "apps/redoc/src/domains/openapi/api/operation-identity.ts"
    ],
    "input": "petstore-3.0.json SHA 246cfe… via /fixtures/petstore.json; filter findByStatus; GET /pet/findByStatus; Copy link visible; page.reload keeps title",
    "check": "bun install && bunx playwright install chromium && bun run --filter @toolu-redoc/redoc build && bun run --filter @toolu-redoc/redoc test:preview-smoke",
    "model": "sonnet"
  },
  {
    "id": "ci-build-smoke",
    "title": "Wire ci.yml: redoc vite build, playwright chromium install, test:preview-smoke",
    "depends_on": ["preview-smoke"],
    "ac_refs": ["AC-5", "AC-6"],
    "paths": [
      ".github/workflows/ci.yml",
      "apps/redoc/package.json"
    ],
    "input": "Existing CI job steps; append after Test step",
    "check": "rg -n \"@toolu-redoc/redoc build|playwright install|test:preview-smoke\" .github/workflows/ci.yml",
    "model": "haiku"
  },
  {
    "id": "full-gate",
    "title": "Run bun run check + preview smoke green; confirm no Hello placeholder",
    "depends_on": ["domain-maps", "agents-root-pointers", "ci-build-smoke"],
    "ac_refs": ["AC-1", "AC-4", "AC-5", "AC-6"],
    "paths": [
      "package.json",
      "apps/redoc/package.json",
      ".github/workflows/ci.yml",
      "apps/redoc/README.md",
      "apps/redoc/src/domains/openapi/__tests__/preview-smoke.ts"
    ],
    "input": "Full workspace gate; preview smoke against dist; no Hello from Toolu Redoc under apps/redoc",
    "check": "bun run check && bun run --filter @toolu-redoc/redoc build && bun run --filter @toolu-redoc/redoc test:preview-smoke && (! rg -n \"Hello from Toolu Redoc\" apps/redoc)",
    "model": "sonnet"
  }
]
```

## Critical files

| Action | Path |
| --- | --- |
| modify | `apps/redoc/README.md` |
| modify | `apps/redoc/AGENTS.md` |
| modify | `apps/redoc/src/domains/openapi/README.md` |
| modify | `apps/redoc/src/domains/docs/README.md` |
| modify | `apps/redoc/src/domains/README.md` |
| modify | `README.md` |
| create | `apps/redoc/src/domains/openapi/__tests__/preview-smoke.ts` |
| modify | `apps/redoc/package.json` |
| modify | `.github/workflows/ci.yml` |

## Verification

1. Every AC-1…AC-7 mapped in the ledger with real fixture or file evidence.
2. `bun run check` green; `test:preview-smoke` green after `build`.
3. CI workflow contains redoc production build + Chromium install + smoke.
4. Docs name Out of scope (Try it out, hosted), fixture-server lifecycle, `url`/`op`, `/` vs `/docs`.
5. `rg "Hello from Toolu Redoc" apps/redoc` empty.
6. Commit on `feat/9-document-the-viewer-readme-domain`; PR targets `main`, body starts with `Closes Falconiere/toolu-redoc#9` and `Part of Falconiere/toolu-redoc#1`; babysit to ready — do not merge.

## Deviations

1. Smoke entry lives at `src/domains/openapi/__tests__/preview-smoke.ts` (not `scripts/`) so `@/` imports and oxlint/tsconfig apply.
2. Fixture HTTP server gained permissive CORS headers so Chromium can URL-load across localhost ports (harness-only).
3. `op` URL assertion uses `includes("findByStatus")` because TanStack JSON-encodes string search params.
4. Local Playwright Chromium download hung; smoke falls back to `channel=chrome` when the bundled browser is missing. CI still runs `playwright install --with-deps chromium`.
