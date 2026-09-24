# Docs shell Signal three-column — Plan

**Date:** 2026-09-24   **Status:** Approved   **Spec:** docs/toolu/specs/2026-09-24-docs-shell-signal-three-column-design.md   **Topic:** Implement domains/docs shell + /docs Petstore route + T24–T26 tests

## Evidence and approach

Inspected approved spec, `apps/redoc/guardrails.config.json` (`domains/*` →
`screens|components|hooks|api|__tests__` only — no `dev/`), `.oxlintrc.json`
(`src/app/**` may import domains), `design-language.md` breakpoints (`md`=860),
`vite.config.ts` (`passWithNoTests: true`, jsdom), existing Petstore at
`domains/openapi/__tests__/fixtures/petstore-3.0.json`, and empty `domains/home`
screen shape.

**Outcome:** Signal/chalk three-column docs shell with drawer collapse below
`md`, temporary `/docs` route loading real Petstore bytes through
`parseOpenApiDocument`, colocated real-data tests for AC-1…AC-6 / T24–T26 shell
slices, docs updated, `bun run check` green, then conventional commit + push +
PR + babysit per epic worker brief.

**Approach:** Petstore twin under `domains/docs/api/` → shell UI + shell tests →
`loadDocsChrome` + `/docs` + route tests (ok + invalid parse) → docs / gate →
commit/push/PR.

**Constraints:** no `docs`→`openapi` imports; no `dangerouslySetInnerHTML`; no
decorative column shadows; ≤300 lines/file; add `@testing-library/user-event`.

## Workstream summary

fixture twin → shell UI + T24–T26 tests → route + parse chrome tests → docs/gate
→ deliver PR.

## Steps (machine-readable)

```json
[
  {
    "id": "fixture-twin",
    "title": "Add domains/docs README + byte-identical Petstore twin under api/",
    "ac_refs": ["AC-1", "AC-6"],
    "paths": [
      "apps/redoc/src/domains/docs/README.md",
      "apps/redoc/src/domains/docs/api/dev-petstore-3.0.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/petstore-3.0.json"
    ],
    "input": "Copy openapi petstore-3.0.json bytes; SHA-256 must equal 246cfe6eaa556e39a38fe6be1bb5c29573dbde34ddb13313b3054afc0a7e3413",
    "check": "test -f apps/redoc/src/domains/docs/api/dev-petstore-3.0.json && shasum -a 256 apps/redoc/src/domains/docs/api/dev-petstore-3.0.json | grep -q 246cfe6eaa556e39a38fe6be1bb5c29573dbde34ddb13313b3054afc0a7e3413 && test -f apps/redoc/src/domains/docs/README.md",
    "model": "haiku"
  },
  {
    "id": "shell-ui-tests",
    "title": "Build DocsShell stack (placeholder/drawer/toolbar/shell/screen) + AC-2..5 tests",
    "depends_on": ["fixture-twin"],
    "ac_refs": ["AC-2", "AC-3", "AC-4", "AC-5"],
    "paths": [
      "apps/redoc/package.json",
      "apps/redoc/src/domains/docs/components/docs-shell-placeholder.tsx",
      "apps/redoc/src/domains/docs/components/docs-shell-drawer.tsx",
      "apps/redoc/src/domains/docs/components/docs-shell-toolbar.tsx",
      "apps/redoc/src/domains/docs/components/docs-shell.tsx",
      "apps/redoc/src/domains/docs/screens/docs-shell-screen.tsx",
      "apps/redoc/src/domains/docs/__tests__/docs-shell.test.tsx"
    ],
    "input": "FSAFE corpus; matchMedia stubs for widths {375,599,600,859,860,1119,1120,1399,1400}; keyboard Escape/focus restore; long path overflow string",
    "check": "bun install && bun run --filter @toolu-redoc/redoc test",
    "model": "sonnet"
  },
  {
    "id": "route-tests",
    "title": "loadDocsChrome + /docs route; ok Petstore + invalid-parse failure tests",
    "depends_on": ["shell-ui-tests", "fixture-twin"],
    "ac_refs": ["AC-1", "AC-6"],
    "paths": [
      "apps/redoc/src/app/load-docs-chrome.ts",
      "apps/redoc/src/app/docs.tsx",
      "apps/redoc/src/app/__tests__/docs-route.test.tsx",
      "apps/redoc/src/route-tree.gen.ts",
      "apps/redoc/src/domains/docs/api/dev-petstore-3.0.json"
    ],
    "input": "dev-petstore-3.0.json bytes (checksum assert) through loadDocsChrome; also whitespace-only and swagger-2 JSON for ok:false message path",
    "check": "bun run --filter @toolu-redoc/redoc test && bun run --filter @toolu-redoc/redoc type-check",
    "model": "sonnet"
  },
  {
    "id": "docs-gate",
    "title": "Sync domain/AGENTS/README; passWithNoTests false; full bun run check",
    "depends_on": ["route-tests"],
    "ac_refs": ["AC-1", "AC-2", "AC-3", "AC-4", "AC-5", "AC-6"],
    "paths": [
      "apps/redoc/src/domains/README.md",
      "apps/redoc/src/domains/docs/README.md",
      "apps/redoc/AGENTS.md",
      "apps/redoc/README.md",
      "apps/redoc/vite.config.ts"
    ],
    "input": "Docs name temporary /docs Petstore wire; vitest passWithNoTests false",
    "check": "bun run check",
    "model": "sonnet"
  },
  {
    "id": "deliver-pr",
    "title": "Commit, rebase origin/main, push branch, open PR, hand off babysit",
    "depends_on": ["docs-gate"],
    "ac_refs": ["AC-1", "AC-2", "AC-3", "AC-4", "AC-5", "AC-6"],
    "paths": [
      "docs/toolu/specs/2026-09-24-docs-shell-signal-three-column-design.md",
      "docs/toolu/plans/2026-09-24-docs-shell-signal-three-column.md"
    ],
    "input": "Epic-authorized delivery: conventional commit; PR body starts with Closes Falconiere/toolu-redoc#4 and Part of Falconiere/toolu-redoc#1 plus verification evidence",
    "check": "git status -sb | grep -q 'feat/4-docs-shell-signal-three-column' && gh pr view --json number,url,body -q '.number' | grep -E '^[0-9]+$'",
    "model": "sonnet"
  }
]
```

## Critical files

| Action | Path |
| --- | --- |
| create | `apps/redoc/src/domains/docs/README.md` |
| create | `apps/redoc/src/domains/docs/api/dev-petstore-3.0.json` |
| create | `apps/redoc/src/domains/docs/components/docs-shell-placeholder.tsx` |
| create | `apps/redoc/src/domains/docs/components/docs-shell-drawer.tsx` |
| create | `apps/redoc/src/domains/docs/components/docs-shell-toolbar.tsx` |
| create | `apps/redoc/src/domains/docs/components/docs-shell.tsx` |
| create | `apps/redoc/src/domains/docs/screens/docs-shell-screen.tsx` |
| create | `apps/redoc/src/domains/docs/__tests__/docs-shell.test.tsx` |
| create | `apps/redoc/src/app/load-docs-chrome.ts` |
| create | `apps/redoc/src/app/docs.tsx` |
| create | `apps/redoc/src/app/__tests__/docs-route.test.tsx` |
| modify | `apps/redoc/src/route-tree.gen.ts` |
| modify | `apps/redoc/src/domains/README.md` |
| modify | `apps/redoc/AGENTS.md` |
| modify | `apps/redoc/README.md` |
| modify | `apps/redoc/package.json` |
| modify | `apps/redoc/vite.config.ts` |

## Verification

- AC-1…AC-6 each appear in ≥1 `ac_refs`; invalid parse covered in `route-tests`.
- Final product check: `bun run check`.
- Delivery: commit on `feat/4-docs-shell-signal-three-column`, push, PR targeting
  `main` with required footer lines, then `/pr-babysit:babysit` (epic brief).

## Deviations

1. **Petstore twin size/dupes:** `guardrails.config.json` `fileSize.overrides`
   for `api/dev-petstore-3.0.json` (800) and `.jscpd.json` ignore for the twin —
   byte-identical OAS Petstore exceeds 300-line/jscpd rules; openapi
   `__tests__/fixtures` were already exempt.
2. **oxlintrc:** same-domain `@/domains/<name>/**` imports allowed; vitest setup
   import override; test overrides ordered after `**/*.tsx`.
3. **vite `routeFileIgnorePattern`:** `^(__tests__|load-)` so
   `load-docs-chrome.ts` and `app/__tests__` are not treated as routes.
4. **Split:** `hooks/use-md-up.ts` extracted; drawer uses `<dialog>` for a11y
   lint; function-size splits to stay under 80-line TSX limit.
5. **vitest.setup:** switch to `@testing-library/jest-dom/vitest` for matcher types.
