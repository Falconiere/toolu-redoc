# Sidebar tags and operations navigation — Plan

**Date:** 2026-09-24   **Status:** Approved   **Spec:** docs/toolu/specs/2026-09-24-sidebar-tags-operations-navigation-design.md   **Topic:** Tag-grouped operation nav, filter, route-local selection

## Evidence and approach

Inspected approved sidebar spec, `#2` normalize/`operation-identity`/FEDGE/
identity-paths/provenance checksums, `#4` DocsShell slots + `/docs` placeholders
+ `loadDocsChrome`, domain isolation (docs ↛ openapi), and epic T10–T12 /
T24–T25 nav obligations on issue #5.

**Outcome:** Pure nav model + filter in `domains/openapi/api`; React nav +
selection chrome in `domains/docs` on DTOs; `/docs` holds `useState` selection/
filter and fills shell slots from real Petstore bytes; colocated real-data
tests for AC-1…AC-8; docs synced; `bun run check` green; PR + babysit.

**Approach:** nav model builders + unit tests (FEDGE/identity/empty) → filter
pure tests → docs nav/selection UI + tests → route composition replacing
placeholders → docs/gate → deliver.

**Constraints:** no docs→openapi imports; neutral mono methods; no URL sync
(#8); no full operation detail (#6); ≤300 lines/file; real fixture bytes only.

## Workstream summary

openapi nav model+filter → docs nav UI → `/docs` composition → docs/gate → PR.

## Steps (machine-readable)

```json
[
  {
    "id": "nav-model",
    "title": "buildOperationNavModel + FEDGE/empty/Untagged-collision unit tests",
    "ac_refs": ["AC-2", "AC-4", "AC-8"],
    "paths": [
      "apps/redoc/src/domains/openapi/api/build-operation-nav-model.ts",
      "apps/redoc/src/domains/openapi/api/__tests__/build-operation-nav-model.test.ts",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/fedge.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/identity-paths.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/empty-paths.json"
    ],
    "input": "fedge.json SHA 6d73dc4d…; identity-paths.json SHA 83d1b134…; empty-paths.json through parseOpenApiDocument then buildOperationNavModel",
    "check": "bun run --filter @toolu-redoc/redoc test",
    "model": "sonnet"
  },
  {
    "id": "nav-filter",
    "title": "filterOperationNavModel + T12 matching/clear/filtered-out unit tests",
    "depends_on": ["nav-model"],
    "ac_refs": ["AC-5", "AC-8"],
    "paths": [
      "apps/redoc/src/domains/openapi/api/filter-operation-nav-model.ts",
      "apps/redoc/src/domains/openapi/api/__tests__/filter-operation-nav-model.test.ts",
      "apps/redoc/src/domains/openapi/api/build-operation-nav-model.ts"
    ],
    "input": "Nav model from FEDGE/Petstore parse; queries for path, mixed-case method, tag, summary, operationId, whitespace-only, no-match; selectedIdentity filtered out",
    "check": "bun run --filter @toolu-redoc/redoc test",
    "model": "sonnet"
  },
  {
    "id": "nav-ui",
    "title": "DocsOperationNav + row + DocsOperationSelection + keyboard/overflow tests",
    "depends_on": ["nav-filter"],
    "ac_refs": ["AC-3", "AC-6", "AC-7"],
    "paths": [
      "apps/redoc/src/domains/docs/components/docs-operation-nav.tsx",
      "apps/redoc/src/domains/docs/components/docs-operation-nav-row.tsx",
      "apps/redoc/src/domains/docs/components/docs-operation-selection.tsx",
      "apps/redoc/src/domains/docs/__tests__/docs-operation-nav.test.tsx"
    ],
    "input": "DTO built from parsed FEDGE/Petstore in test (route-layer style mapping ok in test file); user-event click/tab; matchMedia widths {375,599,600,859,860,1119,1120,1399,1400}; 200-char path overflow",
    "check": "bun run --filter @toolu-redoc/redoc test",
    "model": "sonnet"
  },
  {
    "id": "route-wire",
    "title": "loadDocsDocument; loadDocsChrome delegates to it; /docs composition with selection/filter state",
    "depends_on": ["nav-ui", "nav-model", "nav-filter"],
    "ac_refs": ["AC-1", "AC-3", "AC-8"],
    "paths": [
      "apps/redoc/src/app/load-docs-document.ts",
      "apps/redoc/src/app/load-docs-chrome.ts",
      "apps/redoc/src/app/docs.tsx",
      "apps/redoc/src/app/__tests__/docs-route.test.tsx",
      "apps/redoc/src/domains/docs/api/dev-petstore-3.0.json"
    ],
    "input": "dev-petstore-3.0.json bytes checksum 246cfe6e… through loadDocsDocument; assert nav lists ops and selection updates main chrome. Keep loadDocsChrome as thin chrome-only wrapper over loadDocsDocument so existing chrome tests and knip stay green (no dead export).",
    "check": "bun run --filter @toolu-redoc/redoc test && bun run --filter @toolu-redoc/redoc type-check",
    "model": "sonnet"
  },
  {
    "id": "docs-gate",
    "title": "Sync openapi/docs/README + app README; full bun run check",
    "depends_on": ["route-wire"],
    "ac_refs": ["AC-1", "AC-2", "AC-3", "AC-4", "AC-5", "AC-6", "AC-7", "AC-8"],
    "paths": [
      "apps/redoc/src/domains/openapi/README.md",
      "apps/redoc/src/domains/docs/README.md",
      "apps/redoc/src/domains/README.md",
      "apps/redoc/README.md"
    ],
    "input": "Docs describe nav model builders and /docs operation list behavior",
    "check": "bun run check",
    "model": "sonnet"
  },
  {
    "id": "deliver-pr",
    "title": "Commit, rebase origin/main, push, open PR, hand off babysit",
    "depends_on": ["docs-gate"],
    "ac_refs": ["AC-1", "AC-2", "AC-3", "AC-4", "AC-5", "AC-6", "AC-7", "AC-8"],
    "paths": [
      "docs/toolu/specs/2026-09-24-sidebar-tags-operations-navigation-design.md",
      "docs/toolu/plans/2026-09-24-sidebar-tags-operations-navigation.md"
    ],
    "input": "Epic-authorized delivery: conventional commit; PR body starts with Closes Falconiere/toolu-redoc#5 and Part of Falconiere/toolu-redoc#1 plus verification evidence",
    "check": "git status -sb | grep -q 'feat/5-sidebar-tags-and-operations-navigation' && gh pr view --json number,url -q '.number' | grep -E '^[0-9]+$'",
    "model": "sonnet"
  }
]
```

## Critical files

| Action | Path |
| --- | --- |
| create | `apps/redoc/src/domains/openapi/api/build-operation-nav-model.ts` |
| create | `apps/redoc/src/domains/openapi/api/filter-operation-nav-model.ts` |
| create | `apps/redoc/src/domains/openapi/api/__tests__/build-operation-nav-model.test.ts` |
| create | `apps/redoc/src/domains/openapi/api/__tests__/filter-operation-nav-model.test.ts` |
| create | `apps/redoc/src/domains/docs/components/docs-operation-nav.tsx` |
| create | `apps/redoc/src/domains/docs/components/docs-operation-nav-row.tsx` |
| create | `apps/redoc/src/domains/docs/components/docs-operation-selection.tsx` |
| create | `apps/redoc/src/domains/docs/__tests__/docs-operation-nav.test.tsx` |
| create | `apps/redoc/src/app/load-docs-document.ts` |
| modify | `apps/redoc/src/app/load-docs-chrome.ts` |
| modify | `apps/redoc/src/app/docs.tsx` |
| modify | `apps/redoc/src/app/__tests__/docs-route.test.tsx` |
| modify | `apps/redoc/src/domains/openapi/README.md` |
| modify | `apps/redoc/src/domains/docs/README.md` |
| modify | `apps/redoc/src/domains/README.md` |
| modify | `apps/redoc/README.md` |

## Verification

- AC-1…AC-8 each appear in ≥1 `ac_refs`.
- Final product check: `bun run check`.
- Delivery: commit on `feat/5-sidebar-tags-and-operations-navigation`, push, PR
  targeting `main` with required Closes/Part-of lines, then babysit.

## Deviations

1. **Tagless sentinel key:** `__toolu.untagged__` instead of `__untagged__` so a
   literal OpenAPI tag named `__untagged__` cannot collide with the tagless
   bucket (pre-push review).
2. **Rebase onto #12:** merged main's URL/paste load docs; `/docs` still uses
   the Petstore twin while home `/` loads real sources.
3. **Parse once:** module-level `loadDocsDocument(petstoreText)` + `useMemo`
   for nav model so filter/selection re-renders do not re-parse.
