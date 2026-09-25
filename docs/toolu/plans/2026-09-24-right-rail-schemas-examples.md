# Right rail: schemas, examples, and $ref display — Plan

**Date:** 2026-09-24   **Status:** Approved   **Spec:** docs/toolu/specs/2026-09-24-right-rail-schemas-examples-design.md   **Topic:** Samples SchemaRail + mapSchemaRail + T14/T16–T19/T26 tests

## Evidence and approach

Inspected approved #7 spec, `#6` `SchemaFocus` + stub rail in `docs.tsx`,
`#2` `resolveLocalRef` / `MAX_SCHEMA_DEPTH` / fixtures (`fref`, `composition`,
`examples`, `schema-distinctions`, `f31`, `operation-detail-bodies`, Petstore),
`ExampleValuePanel` / `formatExampleValue`, domain isolation, and Jev
(`docs_vm_app_map`, `disclosure_tree`, `rewalk_operation`, `rail_examples_panel`).

**Outcome:** Docs-owned `SchemaRailModel` + disclosure tree UI; app
`mapSchemaRail` / `mapSchemaNode` rewalking focus keys against the selected
operation and expanding local `$ref`s via `resolveLocalRef` on
`NormalizedOpenApiDocument`; replace Samples stub; committed
`schema-rail-ops.json` + `schema-rail-ops-3.1.json`; real-data tests for
AC-1…AC-10; docs + `bun run check` green; PR + babysit.

**Constraints:** docs must not import openapi; no schema graphs on
`SchemaFocus`; no external fetch; no example synthesis; ≤300 lines/file;
security-requirement display out of scope.

## Workstream summary

fixtures → map + view-model → SchemaRail UI + tests → route wire → docs/gate →
deliver PR.

## Steps (machine-readable)

```json
[
  {
    "id": "fixtures-rail-ops",
    "title": "Add schema-rail-ops.json + schema-rail-ops-3.1.json and provenance rows",
    "ac_refs": ["AC-4", "AC-6", "AC-7"],
    "paths": [
      "apps/redoc/src/domains/openapi/__tests__/fixtures/schema-rail-ops.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/schema-rail-ops-3.1.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/schema-distinctions.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/f31.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/provenance.md",
      "apps/redoc/src/domains/openapi/api/parse-openapi-document.ts"
    ],
    "input": "Hand-authored OAS 3.0.x schema-rail-ops mirroring schema-distinctions.json shapes (nullable/falsy/array/readWrite/additionalProperties) via components+$ref ops, plus external $ref media and 204 empty; OAS 3.1.x twin mirroring f31.json null-in-type/boolean schemas plus one schema with $dynamicRef and $id for unsupported listing — do not invent types/requiredness",
    "check": "test -f apps/redoc/src/domains/openapi/__tests__/fixtures/schema-rail-ops.json && test -f apps/redoc/src/domains/openapi/__tests__/fixtures/schema-rail-ops-3.1.json && grep -q schema-rail-ops.json apps/redoc/src/domains/openapi/__tests__/fixtures/provenance.md && grep -q schema-rail-ops-3.1.json apps/redoc/src/domains/openapi/__tests__/fixtures/provenance.md && bun -e 'import { parseOpenApiDocument } from \"./apps/redoc/src/domains/openapi/api/parse-openapi-document.ts\"; import { readFileSync } from \"fs\"; for (const f of [\"schema-rail-ops.json\",\"schema-rail-ops-3.1.json\"]) { const r = parseOpenApiDocument(readFileSync(\"apps/redoc/src/domains/openapi/__tests__/fixtures/\"+f,\"utf8\")); if (!r.ok) { console.error(f,r.error); process.exit(1);} if (r.document.operations.length < 1) { console.error(f,\"no ops\"); process.exit(1);} console.log(f,\"ops\",r.document.operations.length);} '",
    "model": "haiku"
  },
  {
    "id": "map-schema-rail",
    "title": "Add SchemaRailModel types + mapSchemaNode + mapSchemaRail with real-fixture tests",
    "depends_on": ["fixtures-rail-ops"],
    "ac_refs": ["AC-1", "AC-3", "AC-4", "AC-5", "AC-6", "AC-7", "AC-8"],
    "paths": [
      "apps/redoc/src/domains/docs/api/schema-rail-model.ts",
      "apps/redoc/src/app/map-schema-node.ts",
      "apps/redoc/src/app/map-schema-rail.ts",
      "apps/redoc/src/app/map-operation-detail.ts",
      "apps/redoc/src/domains/docs/api/operation-detail-model.ts",
      "apps/redoc/src/app/__tests__/map-schema-rail.test.ts",
      "apps/redoc/src/domains/openapi/api/resolve-local-ref.ts",
      "apps/redoc/src/domains/openapi/api/openapi-limits.ts",
      "apps/redoc/src/domains/openapi/api/parse-openapi-document.ts",
      "apps/redoc/src/domains/docs/api/dev-petstore-3.0.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/fref.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/composition.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/examples.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/operation-detail-bodies.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/schema-rail-ops.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/schema-rail-ops-3.1.json"
    ],
    "input": "parseOpenApiDocument on Petstore twin, fref, composition, examples, operation-detail-bodies, schema-rail-ops, schema-rail-ops-3.1; SchemaFocus from mapOperationDetail (or identical shape); mapSchemaRail asserts Pet properties, escaped ~0/~1, cycle/dangling/wrong-kind/external boundaries, composition branches + unsupported keywords, media-over-schema examples including null via Object.hasOwn, and 204 focus → root null",
    "check": "bun run --filter @toolu-redoc/redoc test -- src/app/__tests__/map-schema-rail.test.ts && bun run --filter @toolu-redoc/redoc type-check",
    "model": "sonnet"
  },
  {
    "id": "schema-rail-ui",
    "title": "Build SchemaRail disclosure UI + AC-2/3/6/9 component tests",
    "depends_on": ["map-schema-rail"],
    "ac_refs": ["AC-2", "AC-3", "AC-6", "AC-9"],
    "paths": [
      "apps/redoc/src/domains/docs/api/schema-rail-model.ts",
      "apps/redoc/src/domains/docs/components/schema-rail.tsx",
      "apps/redoc/src/domains/docs/components/schema-tree-node.tsx",
      "apps/redoc/src/domains/docs/components/schema-rail-example.tsx",
      "apps/redoc/src/domains/docs/components/format-example-value.ts",
      "apps/redoc/src/domains/docs/__tests__/schema-rail.test.tsx",
      "apps/redoc/src/app/map-schema-rail.ts",
      "apps/redoc/src/app/map-operation-detail.ts",
      "apps/redoc/src/domains/docs/api/dev-petstore-3.0.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/operation-detail-bodies.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/examples.json"
    ],
    "input": "Mapped SchemaRailModel from Petstore + bodies + examples; user-event expands disclosure rows (not JSON-only dump); re-render with 204-mapped model clears prior tree; FSAFE description/example strings + fetch spy callCount 0",
    "check": "bun run --filter @toolu-redoc/redoc test -- src/domains/docs/__tests__/schema-rail.test.tsx",
    "model": "sonnet"
  },
  {
    "id": "route-wire",
    "title": "Replace /docs Samples stub with SchemaRail; extend docs-route tests",
    "depends_on": ["schema-rail-ui"],
    "ac_refs": ["AC-1", "AC-10"],
    "paths": [
      "apps/redoc/src/app/docs.tsx",
      "apps/redoc/src/app/map-schema-rail.ts",
      "apps/redoc/src/domains/docs/components/schema-rail.tsx",
      "apps/redoc/src/domains/docs/api/dev-petstore-3.0.json",
      "apps/redoc/src/app/__tests__/docs-route.test.tsx"
    ],
    "input": "dev-petstore-3.0.json; empty focus → placeholder; select op + default focus → SchemaRail heading/tree visible; stub label gone",
    "check": "bun run --filter @toolu-redoc/redoc test -- src/app/__tests__/docs-route.test.tsx && bun run --filter @toolu-redoc/redoc type-check",
    "model": "sonnet"
  },
  {
    "id": "docs-gate",
    "title": "Sync docs README + provenance; full bun run check",
    "depends_on": ["route-wire"],
    "ac_refs": ["AC-1", "AC-2", "AC-3", "AC-4", "AC-5", "AC-6", "AC-7", "AC-8", "AC-9", "AC-10"],
    "paths": [
      "apps/redoc/src/domains/docs/README.md",
      "apps/redoc/README.md",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/provenance.md",
      "docs/toolu/specs/2026-09-24-right-rail-schemas-examples-design.md",
      "docs/toolu/plans/2026-09-24-right-rail-schemas-examples.md"
    ],
    "input": "Docs describe Samples SchemaRail for focused operation schemas/examples",
    "check": "bun run check",
    "model": "sonnet"
  },
  {
    "id": "deliver-pr",
    "title": "Commit, rebase origin/main, push, open PR, babysit to ready",
    "depends_on": ["docs-gate"],
    "ac_refs": ["AC-1", "AC-2", "AC-3", "AC-4", "AC-5", "AC-6", "AC-7", "AC-8", "AC-9", "AC-10"],
    "paths": [
      "docs/toolu/specs/2026-09-24-right-rail-schemas-examples-design.md",
      "docs/toolu/plans/2026-09-24-right-rail-schemas-examples.md"
    ],
    "input": "Branch feat/7-right-rail-schemas-examples-and; PR body Closes #7 / Part of #1 + verification",
    "check": "git rev-parse --abbrev-ref HEAD | grep -q feat/7-right-rail && test -z \"$(git status --porcelain)\" && gh pr view --json number,url >/dev/null",
    "model": "sonnet"
  }
]
```

## Critical files

| Action | Path |
| --- | --- |
| create | `apps/redoc/src/domains/openapi/__tests__/fixtures/schema-rail-ops.json` |
| create | `apps/redoc/src/domains/openapi/__tests__/fixtures/schema-rail-ops-3.1.json` |
| create | `apps/redoc/src/domains/docs/api/schema-rail-model.ts` |
| create | `apps/redoc/src/app/map-schema-node.ts` |
| create | `apps/redoc/src/app/map-schema-rail.ts` |
| create | `apps/redoc/src/app/__tests__/map-schema-rail.test.ts` |
| create | `apps/redoc/src/domains/docs/components/schema-rail.tsx` |
| create | `apps/redoc/src/domains/docs/components/schema-tree-node.tsx` |
| create | `apps/redoc/src/domains/docs/components/schema-rail-example.tsx` |
| create | `apps/redoc/src/domains/docs/__tests__/schema-rail.test.tsx` |
| modify | `apps/redoc/src/app/docs.tsx`, `docs-route.test.tsx`, docs READMEs, `provenance.md` |

## Verification

- Every AC maps to real fixture parse → map → render (no mocked schema graphs).
- Failure/boundary: null focus, 204 clear, external/dangling/cycle/depth/wrong-kind
  boundaries, escaped pointers, falsy/null examples, FSAFE inert, composition
  without flatten.
- Docs synced in the same change as behavior.
- Gate: `bun run check` green before push; babysit to CI green / ready.
