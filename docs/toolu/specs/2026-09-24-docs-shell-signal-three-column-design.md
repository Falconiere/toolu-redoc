# Docs shell Signal three-column layout — Design

**Date:** 2026-09-24   **Status:** Approved   **Author:** epic-worker (issue #4)   **Topic:** Signal/chalk three-column docs shell with responsive collapse and fixture-wired route

## Problem

The OpenAPI viewer has a typed parse model (#2) but no screen chrome. Without a
band-based three-region shell (nav · main · rail), sibling panels cannot land in
a shared layout, and epic scenarios T24–T26 have nowhere to demonstrate
keyboard, breakpoint, and inert-content behavior.

## Non-Goals

1. URL/paste load UX, CORS, fetch limits, or cancellation (#3).
2. Operation list filtering, selection state, or share-link encoding (#5–#8).
3. Filled nav rows, operation detail body, or schema/example inspectors — those
   are sibling issues; this issue ships structure + placeholders.
4. Browser-runner harness / CI Playwright wiring (#9).
5. Request execution, credentials, Markdown rendering, or security-requirement
   display (optional epic feature; **not accepted**).
6. Swagger 2, external `$ref` fetch, or a second styling system.
7. Relocating `#2` fixture trees out of `domains/openapi/__tests__/`.

## Architecture

**Chosen approach:** a new `domains/docs` domain owning the shell screen and
layout primitives. Columns are **slots** (`nav`, `main`, `rail` as `ReactNode`)
plus plain chrome primitives (`title`, `version`) so the domain never imports
`domains/openapi` (isolation rule). A thin TanStack route `/docs` loads a
**docs-owned copy** of the Petstore JSON (same SHA-256 as `#2`), calls
production `parseOpenApiDocument` via a route-layer helper, and on success
renders `DocsShellScreen` with chrome extracted from the model and ruled
placeholder children in each slot.

**Decisive trade-off (Jev `docs_slots`, confidence 0.70):** slot props keep
domain isolation and let later issues fill columns without moving types into
`packages/types`. Cost: the route (not the shell) owns the parse → chrome
mapping.

**Fixture copy:** `guardrails.config.json` allows only
`screens|components|hooks|api|__tests__` under `domains/*` — not `dev/`.
Commit a byte-identical Petstore twin at
`domains/docs/api/dev-petstore-3.0.json` (SHA-256
`246cfe6eaa556e39a38fe6be1bb5c29573dbde34ddb13313b3054afc0a7e3413`, same as
`domains/openapi/__tests__/fixtures/petstore-3.0.json`). Document the twin in
`domains/docs/README.md`. Remove when `#3` lands real load UX. Do not import
from `**/__tests__/**` in production modules.

**Collapse (Jev `drawer_below_md`; progressive rejected):** house “three-up →
two-up at `lg`” is for marketing card rows; index rows “keep the spec column”
at `lg`. Docs shell therefore keeps three columns from `md` upward:

| Viewport | Tailwind | Layout |
| --- | --- | --- |
| width ≥ 860 CSS px | `md:` and up | Three in-flow columns: nav · main · rail, `border-border` hairline seams, no `shadow-*` / card chrome on columns. |
| width ≤ 859 CSS px | default / below `md` | Main in-flow full width. Toolbar shows two controls. Nav and Samples content live in drawers only. |

**Breakpoint signal:** one boolean `isMdUp` from `window.matchMedia("(min-width: 860px)")`
(token `--breakpoint-md`). Subscribe with `addEventListener("change")`. When
`isMdUp` becomes true, force both drawers closed and do not leave focus inside a
hidden drawer.

**Fixture wire (Jev `dev_route`):** temporary `/docs` route; home `/` untouched.

**Reuse:** `.band`, chalk `data-signal`, Tailwind only, `parseOpenApiDocument`.

**Module layout:**

```
apps/redoc/src/domains/docs/
  README.md
  api/
    dev-petstore-3.0.json          # byte twin of openapi Petstore; temporary
  screens/
    docs-shell-screen.tsx
  components/
    docs-shell.tsx                 # regions + matchMedia + drawer state
    docs-shell-drawer.tsx
    docs-shell-placeholder.tsx
    docs-shell-toolbar.tsx         # Navigation / Samples openers (< md only)
  __tests__/
    docs-shell.test.tsx            # T24–T26 shell slices (slots + collapse)
apps/redoc/src/app/
  docs.tsx                         # thin route
  load-docs-chrome.ts              # text → { title, version } via parseOpenApiDocument
  __tests__/
    docs-route.test.tsx            # AC-1/AC-6 real Petstore bytes through parse
```

No barrel `index.ts`. Keep files ≤300 lines. Add `@testing-library/user-event`
as a redoc `devDependency` for keyboard evidence.

## Interfaces / Schema

### loadDocsChrome (route layer)

```ts
// apps/redoc/src/app/load-docs-chrome.ts
loadDocsChrome(input: string):
  | { ok: true; title: string; version: string }
  | { ok: false; message: string }

// title ← info.title.trim() || "Untitled document"
// version ← info.version.trim() || "—"
// message ← OpenApiParseError.message (no stack)
```

### DocsShellScreen props

```ts
type DocsShellScreenProps = {
  title: string;
  version: string;
  nav: ReactNode;
  main: ReactNode;
  rail: ReactNode;
};
```

### Control and focus contract (T24)

| Control | Role / name | Behavior |
| --- | --- | --- |
| Open nav | `button` name `Navigation` | Opens nav drawer; closes samples if open; `aria-expanded` |
| Open rail | `button` name `Samples` | Opens samples drawer; closes nav if open; `aria-expanded` |
| Close | `button` name `Close` inside open drawer | Closes that drawer |
| Backdrop | `button` or clickable `div` with `aria-hidden` presentation | Closes open drawer (same as Close) |
| Escape | document keydown while drawer open | Closes open drawer |

**Focus:**

1. On open: move focus to the drawer panel (`tabIndex={-1}` on the panel root,
   `aria-modal="true"`, `role="dialog"`, labelled by a visible heading matching
   `Navigation` or `Samples`).
2. While open (`isMdUp === false`): Tab / Shift+Tab **cycle inside the dialog**
   (focus trap). No keyboard path to the covered main chrome.
3. On close (Close, Escape, backdrop, or `isMdUp` flip): restore focus to the
   opener that opened the drawer (`Navigation` or `Samples`). If that button is
   no longer rendered (`isMdUp`), focus the shell `<main>`.
4. Desktop (`isMdUp`): toolbar hidden (`hidden md:hidden` inverted — use
   `md:hidden` on toolbar); columns participate in normal tab order:
   document chrome (title/version) → Navigation region → Operation → Samples.
5. Focus ring: never remove outline; use house `focus-visible:border-accent`
   / focus-ring utilities on every control.

### Region contract

- Root: `<main className="band min-h-screen …">`.
- Landmarks: `<nav aria-label="Navigation">`, `<section aria-label="Operation">`,
  `<section aria-label="Samples">`.
- Placeholders: `DocsShellPlaceholder` — hairline ruled box + one `type-meta`
  sentence (`Navigation will list operations.` / `Select an operation.` /
  `Schemas and examples appear here.`). No cards, no icons-as-decoration.
- Column classes: `border-border` seams, `bg-background`, `overflow-auto`,
  `min-w-0`. Forbidden on columns: `shadow-card`, `shadow-panel`, `rounded-xl`
  as decorative card framing.
- Inert content: React text / element children only. Ban
  `dangerouslySetInnerHTML` in this domain. No `fetch`/`http` calls from docs
  components.

### FSAFE corpus (T26)

Exact slot strings used in tests (and safe to pass as children):

1. `<script>alert("xss")</script>`
2. `<img src=x onerror=alert(1)>`
3. `javascript:alert(1)`
4. `"><a href="http://evil.example">click</a>`

Expected: string visible as text; `document.querySelector("script")` inside the
shell container is `null`; no new `fetch` invocations during render.

### Route `/docs`

```ts
// 1. import petstoreText from "@/domains/docs/api/dev-petstore-3.0.json?raw"
// 2. const chrome = loadDocsChrome(petstoreText)
// 3. ok → <DocsShellScreen title version nav={<Placeholder…/>} … />
// 4. err → <main class="band"> mono incident note with chrome.message
```

## Failure modes and edge cases

| Case | Observable behavior |
| --- | --- |
| Parse fails | Incident mono note; no three-column shell. |
| Empty title / version after trim | `"Untitled document"` / `"—"`. |
| `isMdUp` flips true while drawer open | Drawer unmounts/closes; focus → `<main>`; trap ends. |
| Open nav then Samples | Nav closes; Samples opens; focus moves to Samples dialog. |
| Reduced motion | Transitions ≤0.01ms via existing globals rule. |
| Long unbroken string in a slot | Region scrolls locally (`overflow-auto`); `document.documentElement`
  scrollWidth stays within clientWidth + 1px in tests at listed widths. |
| 200% zoom | Out of scope for jsdom; note as `#9` browser evidence. Shell still uses
  relative/token spacing so zoom is not clipped by fixed px shells. |
| Duplicate opener activation | Toggle: second click on the same opener closes that drawer and restores focus. |

## Acceptance criteria

- **AC-1:** Given `domains/docs/api/dev-petstore-3.0.json` bytes through
  `loadDocsChrome` → `parseOpenApiDocument`, rendering the `/docs` route tree
  shows a `.band` shell whose accessible chrome includes the parsed `info.title`
  and `info.version` (Petstore product title and version string).
- **AC-2:** When `matchMedia("(min-width: 860px)")` matches, three landmarks
  `Navigation`, `Operation`, and `Samples` are visible in-flow as siblings with
  hairline seams and without decorative `shadow-*` card classes on the column
  roots.
- **AC-3:** When `matchMedia` does not match, Operation remains visible; Navigation
  and Samples content are inside closed dialogs until their toolbar buttons open
  them; Escape closes the open dialog and returns focus to that opener (T24).
- **AC-4:** For each stubbed viewport width in
  `{375, 599, 600, 859, 860, 1119, 1120, 1399, 1400}`, every region is reachable
  (in-flow or via opener→dialog), and a 200-character path-like string in a slot
  does not make `document.documentElement.scrollWidth` exceed
  `clientWidth + 1` (T25 shell slice; 200% zoom deferred to `#9`).
- **AC-5:** Rendering each FSAFE corpus string as a slot child keeps the string
  as text, inserts no `<script>` node, and triggers zero `fetch` calls (T26).
- **AC-6:** `app/__tests__/docs-route.test.tsx` derives title/version by calling
  `loadDocsChrome` on the real Petstore file bytes (checksum asserted) — not a
  hand-built `NormalizedOpenApiDocument` mock.

## Acceptance evidence

| AC | Real input | Expected observable | Runnable check |
| --- | --- | --- | --- |
| AC-1 | `api/dev-petstore-3.0.json` (`?raw` or `readFileSync` in test) | Title/version from parse on screen | `app/__tests__/docs-route.test.tsx` |
| AC-2 | `matchMedia` stub `matches: true` | Three landmarks; column classList has no `shadow-card`/`shadow-panel` | `domains/docs/__tests__/docs-shell.test.tsx` |
| AC-3 | `matches: false`; user-event keyboard | Focus path + `aria-expanded` + Escape restore | same + user-event |
| AC-4 | widths list via `matchMedia` + `innerWidth` stubs; long string slot | Reachable regions; no page-wide overflow | `docs-shell.test.tsx` |
| AC-5 | FSAFE corpus above; `fetch` spy | Inert text; no script node; spy callCount 0 | `docs-shell.test.tsx` |
| AC-6 | SHA-256 of fixture file equals provenance | `loadDocsChrome(...).ok === true` with real title | `docs-route.test.tsx` |

Command: `bun run --filter @toolu-redoc/redoc test` and `bun run check`.

## Documentation impact

- `apps/redoc/src/domains/README.md` — add `docs/` row.
- `apps/redoc/src/domains/docs/README.md` — inventory + temporary
  `api/dev-petstore-3.0.json` twin checksum.
- `apps/redoc/AGENTS.md` — repo map line for `domains/docs`.
- `apps/redoc/README.md` — `/docs` temporary Petstore route until `#3`.

## Open Questions

None blocking. Resolved here:

1. **Domain → `domains/docs` slots** (Jev).
2. **Collapse → drawers below `md`; three columns from `md` up** (Jev +
   design-language index/spec note); full focus-trap/restore table above.
3. **Wire → `/docs` + `loadDocsChrome` + `api/dev-petstore-3.0.json` twin**
   (guardrails allowlist; not `dev/`).
4. **200% zoom / real browser T25 remainder → `#9` harness** (explicit deferral;
   jsdom covers width stubs + overflow).
5. **Security-requirement display → out of scope.**
