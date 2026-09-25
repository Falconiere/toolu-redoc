# src/domains/docs

Owns the Signal three-column docs shell (nav · main · rail), tag-grouped operation
navigation, and operation detail view-model UI. `/docs` still wires a temporary
Petstore twin for shell/nav/detail demos; home `/` already loads specs via
URL/paste (#3).

| Path | Holds |
| --- | --- |
| `screens/docs-shell-screen.tsx` | Band + chrome + `DocsShell` composition |
| `components/docs-shell*.tsx` | Layout, drawers, toolbar, placeholders |
| `components/docs-shell-focus.ts` | Shared `CONTROL_FOCUS` class string for toolbar + drawer |
| `components/docs-operation-nav.tsx` | Filter + tag sections; DTO props only (no openapi import) |
| `components/docs-operation-nav-row.tsx` | One selectable operation row |
| `components/operation-detail*.tsx` | Main-column operation detail (header, params, request, responses, servers) |
| `components/schema-rail*.tsx` / `schema-tree-node.tsx` | Samples rail: schema disclosure tree + example panel |
| `api/operation-detail-model.ts` | Plain view-model types + `SchemaFocus` handle (no openapi imports) |
| `api/schema-rail-model.ts` | Plain `SchemaRailModel` / `SchemaNode` types for the Samples rail |
| `hooks/use-md-up.ts` | `matchMedia("(min-width: 860px)")` subscription |
| `api/dev-petstore-3.0.json` | Temporary byte twin of `domains/openapi/__tests__/fixtures/petstore-3.0.json` (SHA-256 `246cfe6eaa556e39a38fe6be1bb5c29573dbde34ddb13313b3054afc0a7e3413`); remove when `/docs` consumes a loaded source |
| `__tests__/docs-shell.test.tsx` | Structure, collapse, FSAFE (T24–T26 shell slices) |
| `__tests__/docs-operation-nav.test.tsx` | Nav filter/selection/keyboard/overflow |
| `__tests__/operation-detail.test.tsx` | AC-1…AC-7: Petstore every-op + T13–T15/T19/T26 detail slices |
| `__tests__/schema-rail.test.tsx` | Samples rail disclosure tree, examples, 204 clear, FSAFE |

Public screen: `@/domains/docs/screens/docs-shell-screen` → `DocsShellScreen`.
Only `src/app/**` routes may import this domain. Mapping from normalized OpenAPI
lives in `src/app/map-operation-detail.ts` and `src/app/map-schema-rail.ts`;
`load-docs-document.ts` returns the normalized document for nav builders.
