# Deep links and sidebar filter — Plan

**Date:** 2026-09-24   **Status:** Approved   **Spec:** docs/toolu/specs/2026-09-24-deep-links-and-sidebar-filter-design.md   **Topic:** `/` success→DocsShell, `op` search sync + history, unknown-op, share copy, reuse #5 filter

## Evidence and approach

Inspected approved #8 spec; #3 `validateSpecLoadSearch` / `SpecLoadScreen` / `useSpecLoad` / fixture HTTP server; #5 `filterOperationNavModel` + `DocsOperationNav`; #6 `OperationDetail` + `/docs` composition; Petstore twin first GET `get /pet/findByStatus`; identity codec JSON `[method,path]`.

**Outcome:** After successful paste/URL load on `/`, the viewer shows DocsShell with selection driven by `op`; user selects push history; inbound deep-link apply uses replace; unknown op shows distinct empty; share copy discloses source-query embedding; filter stays local; real-data tests cover AC-1…AC-12; docs + `bun run check` green.

**Approach:** pure resolve + share-href → write-op navigate helper → unknown empty + toolbar/share UI → compose loaded docs on `/` → history/filter/pending-op RTL → docs → gate.

**Constraints:** domain isolation (`docs` never imports `openapi`); max-lines 300; no barrels; no filter in URL; no document bytes in URL/storage; `/docs` playground optional (non-blocking); Workers SPA harness residual blocked-on-#9.

**AC coverage:** every spec `AC-1`…`AC-12` appears in at least one ledger `ac_refs`.

## Workstream summary

resolve/share pure APIs → op navigate helper → unknown empty + toolbar → `/` compose viewer → RTL deep-link/history/paste/replace → README sync → full gate.

## Steps (machine-readable)

```json
[
  {
    "id": "resolve-selection",
    "title": "Add resolveOperationSelection (none|selected|unknown malformed|missing) over encode/decode identity",
    "ac_refs": ["AC-5", "AC-8"],
    "paths": [
      "apps/redoc/src/domains/openapi/api/resolve-operation-selection.ts",
      "apps/redoc/src/domains/openapi/api/operation-identity.ts",
      "apps/redoc/src/domains/openapi/api/__tests__/resolve-operation-selection.test.ts",
      "apps/redoc/src/domains/openapi/__tests__/fixtures"
    ],
    "input": "Petstore twin identities; malformed JSON op; valid identity absent from empty-paths; identity-paths Unicode/tilde/space keys round-trip",
    "check": "bun run --filter @toolu-redoc/redoc test",
    "model": "sonnet"
  },
  {
    "id": "share-href",
    "title": "Add buildShareHref(origin, SpecLoadSearch) round-tripping url with query + op",
    "ac_refs": ["AC-9"],
    "paths": [
      "apps/redoc/src/domains/openapi/api/build-share-href.ts",
      "apps/redoc/src/domains/openapi/api/spec-source-search.ts",
      "apps/redoc/src/domains/openapi/api/__tests__/build-share-href.test.ts"
    ],
    "input": "origin http://localhost:5173; url with ?a=1&b=2; op encodeOperationIdentity get /pet/findByStatus; paste-only op without url",
    "check": "bun run --filter @toolu-redoc/redoc test",
    "model": "haiku"
  },
  {
    "id": "write-op-search",
    "title": "Add writeOperationSearch helper preserving url; push vs replace flags",
    "depends_on": ["resolve-selection"],
    "ac_refs": ["AC-2", "AC-3"],
    "paths": [
      "apps/redoc/src/domains/openapi/api/write-operation-search.ts",
      "apps/redoc/src/domains/openapi/api/__tests__/write-operation-search.test.ts"
    ],
    "input": "Synthetic SpecLoadSearch {url, op}; assert merge clears/sets op only; replace flag plumbed to navigate options object",
    "check": "bun run --filter @toolu-redoc/redoc test",
    "model": "haiku"
  },
  {
    "id": "unknown-empty",
    "title": "Add docs UnknownOperationEmpty with distinct copy from Select an operation",
    "ac_refs": ["AC-5"],
    "paths": [
      "apps/redoc/src/domains/docs/components/unknown-operation-empty.tsx",
      "apps/redoc/src/domains/docs/__tests__/unknown-operation-empty.test.tsx",
      "apps/redoc/src/domains/docs/README.md"
    ],
    "input": "Render component; assert title Unknown operation. and body about missing/invalid key; assert not Select an operation.",
    "check": "bun run --filter @toolu-redoc/redoc test",
    "model": "haiku"
  },
  {
    "id": "toolbar-share",
    "title": "Add loaded-docs toolbar + ShareOperationLink with query-param / paste disclosures",
    "depends_on": ["share-href"],
    "ac_refs": ["AC-9"],
    "paths": [
      "apps/redoc/src/domains/openapi/components/loaded-docs-toolbar.tsx",
      "apps/redoc/src/domains/openapi/components/share-operation-link.tsx",
      "apps/redoc/src/domains/openapi/components/__tests__/share-operation-link.test.tsx"
    ],
    "input": "URL source href containing ?a=1; paste source; clipboard write of buildShareHref result; disclosure text visible",
    "check": "bun run --filter @toolu-redoc/redoc test",
    "model": "sonnet"
  },
  {
    "id": "compose-loaded",
    "title": "Compose success→viewer on `/`: nav/filter/detail/unknown + op write on select; Reset clears op",
    "depends_on": ["resolve-selection", "write-op-search", "unknown-empty", "toolbar-share"],
    "ac_refs": ["AC-1", "AC-2", "AC-4", "AC-5", "AC-10", "AC-11"],
    "paths": [
      "apps/redoc/src/app/map-loaded-docs.tsx",
      "apps/redoc/src/app/index.tsx",
      "apps/redoc/src/domains/openapi/screens/spec-load-screen.tsx",
      "apps/redoc/src/domains/openapi/hooks/use-spec-load.ts",
      "apps/redoc/src/domains/docs/components/docs-operation-nav.tsx",
      "apps/redoc/src/domains/docs/components/operation-detail.tsx",
      "apps/redoc/src/app/map-operation-detail.ts",
      "apps/redoc/src/app/__tests__/map-loaded-docs.test.tsx"
    ],
    "input": "parseOpenApiDocument on Petstore twin bytes; select get /pet/findByStatus; filter smoke narrow/clear; unknown op raw; replace document A→B",
    "check": "bun run --filter @toolu-redoc/redoc test",
    "model": "sonnet"
  },
  {
    "id": "deep-link-rtl",
    "title": "RTL memory-router: url+op auto-load selects op; Back/Forward; paste pending op; wrong paste unknown",
    "depends_on": ["compose-loaded"],
    "ac_refs": ["AC-1", "AC-3", "AC-6", "AC-7", "AC-12"],
    "paths": [
      "apps/redoc/src/domains/openapi/screens/__tests__/spec-load-screen.test.tsx",
      "apps/redoc/src/app/__tests__/deep-link-routing.test.tsx",
      "apps/redoc/src/domains/openapi/__tests__/fixture-http-server.ts",
      "apps/redoc/src/domains/docs/api/dev-petstore-3.0.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/petstore-3.0.json"
    ],
    "input": "Fixture HTTP server Petstore; search url+op get /pet/findByStatus; memory history two selections; op-only then paste twin; paste empty-paths after",
    "check": "bun run --filter @toolu-redoc/redoc test",
    "model": "sonnet"
  },
  {
    "id": "docs-sync",
    "title": "Update redoc README + domain/app READMEs for `/` viewer, url+op share, `/docs` playground",
    "depends_on": ["compose-loaded"],
    "ac_refs": ["AC-11"],
    "paths": [
      "apps/redoc/README.md",
      "apps/redoc/src/app/README.md",
      "apps/redoc/src/domains/openapi/README.md",
      "apps/redoc/src/domains/docs/README.md"
    ],
    "input": "Prose must describe success→viewer on `/` and share params; remove URL sync lands in #8",
    "check": "rg -n \"URL sync lands in #8|share|\\\\?url=|op=\" apps/redoc/README.md apps/redoc/src/app/README.md apps/redoc/src/domains/openapi/README.md apps/redoc/src/domains/docs/README.md",
    "model": "haiku"
  },
  {
    "id": "full-gate",
    "title": "Run bun run check green with all deep-link suites",
    "depends_on": ["deep-link-rtl", "docs-sync", "share-href", "resolve-selection"],
    "ac_refs": ["AC-11", "AC-12"],
    "paths": [
      "apps/redoc/package.json",
      "package.json"
    ],
    "input": "Full workspace gate including redoc vitest",
    "check": "bun run check",
    "model": "sonnet"
  }
]
```

## Critical files

| Action | Path |
| --- | --- |
| create | `apps/redoc/src/domains/openapi/api/resolve-operation-selection.ts` (+ test) |
| create | `apps/redoc/src/domains/openapi/api/build-share-href.ts` (+ test) |
| create | `apps/redoc/src/domains/openapi/api/write-operation-search.ts` (+ test) |
| create | `apps/redoc/src/domains/docs/components/unknown-operation-empty.tsx` (+ test) |
| create | `apps/redoc/src/domains/openapi/components/loaded-docs-toolbar.tsx` |
| create | `apps/redoc/src/domains/openapi/components/share-operation-link.tsx` (+ test) |
| create | `apps/redoc/src/app/map-loaded-docs.tsx` (+ test) |
| create | `apps/redoc/src/app/__tests__/deep-link-routing.test.tsx` |
| modify | `apps/redoc/src/app/index.tsx`, `spec-load-screen.tsx` |
| modify | READMEs listed in `docs-sync` |

## Verification

1. Every AC-1…AC-12 has real fixture or boundary input and automated assertions as mapped in the ledger.
2. `bun run --filter @toolu-redoc/redoc test` then `bun run check` must pass.
3. Failure cases: malformed/missing `op` → unknown empty (no fallback); document replace clears stale detail; share disclosure for query-bearing source URLs.
4. Docs describe `/` success→viewer, `url`/`op` share, and `/docs` playground in the same change.
5. Commit on `feat/8-deep-links-and-sidebar-filter` (authorized epic worker). PR targets `main`, conventional title, body starts with `Closes Falconiere/toolu-redoc#8` and `Part of Falconiere/toolu-redoc#1`, then `/pr-babysit:babysit` to ready — do not merge.
6. Manual `dev` spot-check is optional and not a substitute for automated ACs.
)
