# src/domains/docs

Owns the Signal three-column docs shell (nav · main · rail). `/docs` still wires
a temporary Petstore twin for shell/nav demos; home `/` already loads specs via
URL/paste (#3).

| Path | Holds |
| --- | --- |
| `screens/docs-shell-screen.tsx` | Band + chrome + `DocsShell` composition |
| `components/docs-shell*.tsx` | Layout, drawers, toolbar, placeholders |
| `components/docs-shell-focus.ts` | Shared `CONTROL_FOCUS` class string for toolbar + drawer |
| `components/docs-operation-nav.tsx` | Filter + tag sections; DTO props only (no openapi import) |
| `components/docs-operation-nav-row.tsx` | One selectable operation row |
| `components/docs-operation-selection.tsx` | Main-pane selection chrome until full detail (#6) |
| `hooks/use-md-up.ts` | `matchMedia("(min-width: 860px)")` subscription |
| `api/dev-petstore-3.0.json` | Temporary byte twin of `domains/openapi/__tests__/fixtures/petstore-3.0.json` (SHA-256 `246cfe6eaa556e39a38fe6be1bb5c29573dbde34ddb13313b3054afc0a7e3413`); remove when `/docs` consumes a loaded source |
| `__tests__/docs-shell.test.tsx` | Structure, collapse, FSAFE (T24–T26 shell slices) |
| `__tests__/docs-operation-nav.test.tsx` | Nav filter/selection/keyboard/overflow (AC-3, AC-5 UI, AC-6, AC-7) |

Public screen: `@/domains/docs/screens/docs-shell-screen` → `DocsShellScreen`.
Only `src/app/**` routes may import this domain.
