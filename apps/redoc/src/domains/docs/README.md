# src/domains/docs

Owns the Signal three-column docs shell (nav · main · rail) and temporary Petstore
preview wiring until URL/paste load (#3) lands.

| Path | Holds |
| --- | --- |
| `screens/docs-shell-screen.tsx` | Band + chrome + `DocsShell` composition |
| `components/docs-shell*.tsx` | Layout, drawers, toolbar, placeholders |
| `hooks/use-md-up.ts` | `matchMedia("(min-width: 860px)")` subscription |
| `api/dev-petstore-3.0.json` | Temporary byte twin of `domains/openapi/__tests__/fixtures/petstore-3.0.json` (SHA-256 `246cfe6eaa556e39a38fe6be1bb5c29573dbde34ddb13313b3054afc0a7e3413`); remove when #3 loads real sources |
| `__tests__/docs-shell.test.tsx` | Structure, collapse, FSAFE (T24–T26 shell slices) |

Public screen: `@/domains/docs/screens/docs-shell-screen` → `DocsShellScreen`.
Only `src/app/**` routes may import this domain.
