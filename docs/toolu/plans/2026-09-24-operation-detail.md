# Operation detail (summary, params, request, responses) — Plan

**Date:** 2026-09-24   **Status:** Approved   **Spec:** docs/toolu/specs/2026-09-24-operation-detail-design.md   **Topic:** Main-column OperationDetail + map/load helpers + T13–T15/T19/T26 tests

## Evidence and approach

Inspected approved spec, `#2` `NormalizedOpenApiOperation` /
`mergeParametersForPath`, `#4` `DocsShellScreen` slots + `/docs` /
`loadDocsChrome`, fixtures (`petstore-3.0`, `param-merge`, `examples`,
`provenance.md`), domain isolation (`docs` must not import `openapi`), and
Jev decisions (`docs_vm`, `route_state_picker`, `callback_focus`, security out).

**Outcome:** Docs-owned `OperationDetail` view-model UI; app-layer
`mapOperationDetail` + `loadDocsDocument` (replacing `loadDocsChrome`);
temporary nav list + focus stub rail on `/docs`; committed T14/T15 fixtures;
real-data tests for AC-1…AC-8; docs + `bun run check` green; PR + babysit.

**Constraints:** no cross-domain imports; no `dangerouslySetInnerHTML`; no
schema graphs in `SchemaFocus`; ≤300 lines/file; security-requirement display
out of scope; temporary nav is not `#5` tag grouping.

## Workstream summary

fixtures → map + view-model types → OperationDetail UI + tests → route wire →
docs/gate → deliver PR.

## Steps (machine-readable)

```json
[
  {
    "id": "fixtures-t14-t15",
    "title": "Add operation-detail-bodies.json + operation-detail-meta.json and provenance rows",
    "ac_refs": ["AC-3", "AC-4"],
    "paths": [
      "apps/redoc/src/domains/openapi/__tests__/fixtures/operation-detail-bodies.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/operation-detail-meta.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/provenance.md",
      "apps/redoc/src/domains/openapi/api/parse-openapi-document.ts"
    ],
    "input": "Hand-authored OAS 3.0.x bytes: bodies fixture has json+form+multipart request media and responses 200(with header)/default/2XX/204; meta fixture has missing-fields op + deprecated op with operation servers/variables",
    "check": "test -f apps/redoc/src/domains/openapi/__tests__/fixtures/operation-detail-bodies.json && test -f apps/redoc/src/domains/openapi/__tests__/fixtures/operation-detail-meta.json && grep -q operation-detail-bodies apps/redoc/src/domains/openapi/__tests__/fixtures/provenance.md && bun -e 'import { parseOpenApiDocument } from \"./apps/redoc/src/domains/openapi/api/parse-openapi-document.ts\"; import { readFileSync } from \"fs\"; for (const f of [\"operation-detail-bodies.json\",\"operation-detail-meta.json\"]) { const r = parseOpenApiDocument(readFileSync(\"apps/redoc/src/domains/openapi/__tests__/fixtures/\"+f,\"utf8\")); if (!r.ok) { console.error(f,r.error); process.exit(1);} console.log(f,\"ops\",r.document.operations.length);} '",
    "model": "haiku"
  },
  {
    "id": "map-model",
    "title": "Add docs view-model types + app mapOperationDetail + loadDocsDocument; delete loadDocsChrome",
    "depends_on": ["fixtures-t14-t15"],
    "ac_refs": ["AC-2", "AC-3", "AC-4", "AC-5", "AC-8"],
    "paths": [
      "apps/redoc/src/domains/docs/api/operation-detail-model.ts",
      "apps/redoc/src/app/map-operation-detail.ts",
      "apps/redoc/src/app/load-docs-document.ts",
      "apps/redoc/src/app/load-docs-chrome.ts",
      "apps/redoc/src/app/__tests__/map-operation-detail.test.ts",
      "apps/redoc/src/app/__tests__/load-docs-document.test.ts",
      "apps/redoc/src/domains/openapi/api/parse-openapi-document.ts",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/param-merge.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/examples.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/operation-detail-bodies.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/operation-detail-meta.json",
      "apps/redoc/src/domains/docs/api/dev-petstore-3.0.json"
    ],
    "input": "Real bytes: param-merge.json, examples.json, operation-detail-bodies.json, operation-detail-meta.json, petstore twin via parseOpenApiDocument then mapOperationDetail / loadDocsDocument",
    "check": "test ! -f apps/redoc/src/app/load-docs-chrome.ts && bun run --filter @toolu-redoc/redoc test -- src/app/__tests__/map-operation-detail.test.ts src/app/__tests__/load-docs-document.test.ts",
    "model": "sonnet"
  },
  {
    "id": "detail-ui-tests",
    "title": "Build OperationDetail (+ header/params/request/responses/servers/nav) and AC-1..7 tests",
    "depends_on": ["map-model"],
    "ac_refs": ["AC-1", "AC-2", "AC-3", "AC-4", "AC-5", "AC-6", "AC-7"],
    "paths": [
      "apps/redoc/src/domains/docs/api/operation-detail-model.ts",
      "apps/redoc/src/app/map-operation-detail.ts",
      "apps/redoc/src/domains/docs/components/operation-detail.tsx",
      "apps/redoc/src/domains/docs/components/operation-detail-header.tsx",
      "apps/redoc/src/domains/docs/components/operation-detail-parameters.tsx",
      "apps/redoc/src/domains/docs/components/operation-detail-request.tsx",
      "apps/redoc/src/domains/docs/components/operation-detail-responses.tsx",
      "apps/redoc/src/domains/docs/components/operation-detail-servers.tsx",
      "apps/redoc/src/domains/docs/components/operation-nav-list.tsx",
      "apps/redoc/src/domains/docs/__tests__/operation-detail.test.tsx",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/param-merge.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/examples.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/operation-detail-bodies.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/operation-detail-meta.json",
      "apps/redoc/src/domains/docs/api/dev-petstore-3.0.json"
    ],
    "input": "Mapped models from Petstore twin + param-merge + bodies + meta + examples fixtures; FSAFE corpus strings; fetch spy; user-event status/media/example switches",
    "check": "bun run --filter @toolu-redoc/redoc test -- src/domains/docs/__tests__/operation-detail.test.tsx",
    "model": "sonnet"
  },
  {
    "id": "route-wire",
    "title": "Wire /docs selection + focus stub rail via loadDocsDocument; update docs-route tests",
    "depends_on": ["detail-ui-tests"],
    "ac_refs": ["AC-6", "AC-8"],
    "paths": [
      "apps/redoc/src/app/docs.tsx",
      "apps/redoc/src/app/load-docs-document.ts",
      "apps/redoc/src/app/map-operation-detail.ts",
      "apps/redoc/src/domains/docs/components/operation-detail.tsx",
      "apps/redoc/src/domains/docs/components/operation-nav-list.tsx",
      "apps/redoc/src/domains/docs/screens/docs-shell-screen.tsx",
      "apps/redoc/src/domains/docs/api/dev-petstore-3.0.json",
      "apps/redoc/src/app/__tests__/docs-route.test.tsx"
    ],
    "input": "dev-petstore-3.0.json checksum 246cfe6eaa556e39a38fe6be1bb5c29573dbde34ddb13313b3054afc0a7e3413; default empty selection; click nav identity → detail; invalid parse still incident note",
    "check": "bun run --filter @toolu-redoc/redoc test -- src/app/__tests__/docs-route.test.tsx && bun run --filter @toolu-redoc/redoc type-check",
    "model": "sonnet"
  },
  {
    "id": "docs-gate",
    "title": "Sync docs README/AGENTS/app README; full bun run check",
    "depends_on": ["route-wire"],
    "ac_refs": ["AC-1", "AC-2", "AC-3", "AC-4", "AC-5", "AC-6", "AC-7", "AC-8"],
    "paths": [
      "apps/redoc/src/domains/docs/README.md",
      "apps/redoc/AGENTS.md",
      "apps/redoc/README.md",
      "docs/toolu/specs/2026-09-24-operation-detail-design.md",
      "docs/toolu/plans/2026-09-24-operation-detail.md"
    ],
    "input": "Docs describe temporary nav + OperationDetail main slot until #5/#7",
    "check": "bun run check",
    "model": "sonnet"
  },
  {
    "id": "deliver-pr",
    "title": "Commit, rebase origin/main, push, open PR, babysit to ready",
    "depends_on": ["docs-gate"],
    "ac_refs": ["AC-1", "AC-2", "AC-3", "AC-4", "AC-5", "AC-6", "AC-7", "AC-8"],
    "paths": [
      "docs/toolu/specs/2026-09-24-operation-detail-design.md",
      "docs/toolu/plans/2026-09-24-operation-detail.md"
    ],
    "input": "Branch feat/6-operation-detail-summary-params-request; PR body Closes #6 / Part of #1 + verification",
    "check": "git rev-parse --abbrev-ref HEAD | grep -q feat/6-operation-detail && test -z \"$(git status --porcelain)\" && gh pr view --json number,url >/dev/null",
    "model": "sonnet"
  }
]
```

## Critical files

| Action | Path |
| --- | --- |
| create | `apps/redoc/src/domains/openapi/__tests__/fixtures/operation-detail-bodies.json` |
| create | `apps/redoc/src/domains/openapi/__tests__/fixtures/operation-detail-meta.json` |
| create | `apps/redoc/src/domains/docs/api/operation-detail-model.ts` |
| create | `apps/redoc/src/app/map-operation-detail.ts` |
| create | `apps/redoc/src/app/load-docs-document.ts` |
| create | `apps/redoc/src/domains/docs/components/operation-detail*.tsx` / `operation-nav-list.tsx` |
| create | `apps/redoc/src/domains/docs/__tests__/operation-detail.test.tsx` |
| create | `apps/redoc/src/app/__tests__/map-operation-detail.test.ts` |
| create | `apps/redoc/src/app/__tests__/load-docs-document.test.ts` |
| modify | `apps/redoc/src/app/docs.tsx`, `docs-route.test.tsx`, docs READMEs, `provenance.md` |
| delete | `apps/redoc/src/app/load-docs-chrome.ts` |

## Verification

- Every AC maps to a real fixture parse → map → render path (no mocked
  `NormalizedOpenApiOperation`).
- Failure/boundary: empty selection, 204 empty body, path-param issues,
  falsy/external examples, FSAFE inert text, missing identity → empty.
- Docs synced in the same change as behavior.
- Gate: `bun run check` green before push; babysit to CI green / ready.
