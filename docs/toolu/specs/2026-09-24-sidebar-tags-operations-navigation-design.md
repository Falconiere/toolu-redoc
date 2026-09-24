# Sidebar tags and operations navigation — Design

**Date:** 2026-09-24   **Status:** Approved   **Author:** epic-worker (issue #5)   **Topic:** Left-rail tag/operation nav with filter and shared selection

## Problem

The docs shell (#4) leaves the Navigation slot as a placeholder, and the
normalized OpenAPI model (#2) is flat (`operations[]` + root `tags[]`). Without
tag grouping, filter, keyboard-selectable rows, and shared selection into the
main pane, developers cannot browse Petstore/FEDGE operations, and epic
scenarios T10–T12 (plus nav slices of T24–T25) have no UI surface.

## Non-Goals

1. URL/paste load UX, fetch, CORS, cancellation (#3).
2. Full operation detail body (parameters/bodies/responses) — #6 owns that;
   this issue only proves selection with lightweight selection chrome.
3. Schema/example right rail (#7).
4. Share-link / deep-link URL encoding and history (#8). Selection is
   route-local state here; #8 will sync it to the location later.
5. Browser-runner harness / CI Playwright (#9). 200% zoom remains deferred to
   `#9`; jsdom covers width stubs + local overflow like #4.
6. Request execution, credentials, Markdown rendering, security-requirement
   display (optional epic feature; **not accepted**).
7. Swagger 2, external `$ref` fetch, or a second styling system.
8. Relocating `#2` fixture trees; importing from `**/__tests__/**` in
   production modules.

## Architecture

**Chosen approach (Jev `nav_home` → `docs_ui_openapi_model`, confidence 0.57):**

| Layer | Owns |
| --- | --- |
| `domains/openapi/api` | Pure `buildOperationNavModel` + `filterOperationNavModel` over `NormalizedOpenApiDocument` (grouping, filter, DTOs). Reuses `encodeOperationIdentity` / existing normalize order. |
| `domains/docs` | React nav UI (`DocsOperationNav`, filter field, tag sections, rows) that accepts **plain DTOs + callbacks** — never imports `@/domains/openapi`. Selection chrome for the main slot (`DocsOperationSelection`). |
| `src/app` | Temporary `/docs` composition: parse Petstore twin → chrome + nav model → `useState` for `selectedIdentity` + `filterQuery` → fill shell slots. |

**Decisive trade-off:** OpenAPI-specific grouping stays next to the normalize
model; docs stays isolated via DTO props. Cost: the route (or a thin
route-only composition helper under `app/`) maps parse → DTO and holds
selection until #8.

**Selection (Jev `selection_state` → `route_local`, confidence 0.79):**
`useState` in the `/docs` composition for `selectedIdentity: string | null`
and `filterQuery: string`. No `src/providers` Context yet; no TanStack search
params (owned by #8).

**Filter (Jev `filter_owner` noul 0.68 → ship in #5):** full T12 UX lives in
this issue. #8 reuses the same filter props when wiring URLs; it does not
re-implement matching.

**Tag section order (Jev `untagged_order`, confidence 1.0):**

1. Unique **declared** tag names from `document.tags` in first-declaration
   document order (duplicate root entries with the same `name` collapse to one
   section; first description wins for display if needed later — MVP shows
   `name` only).
2. **Undeclared** tag names (appear on operations but not in the unique
   declared set) in first-appearance order across `operations[]` (document
   order already fixed by normalize: paths object order × eight verbs).
3. **Tagless bucket** last, only when at least one operation has an empty
   `tags` list (after treating missing as `[]`). Section `key` is the
   sentinel `"__toolu.untagged__"` and `label` is always the display string
   **`Untagged`**. A real OpenAPI tag whose `name` is `"Untagged"` or
   `"__toolu.untagged__"` is a **declared/undeclared tag section** with that exact
   name as both `key` and `label` — it never merges with the tagless bucket.
   Tagless operations never appear under a tag literally named `Untagged`.

**Row membership:** each operation appears once under each **distinct** tag
string on that operation (duplicate tags on one op do not duplicate the row).
The same `identity` under multiple sections shares selection. Path Item
metadata keys are never operations (#2 already excludes them).

**Within-section order:** stable `operations[]` document order (first time
the op would appear under that tag).

**Method labels:** uppercase verb in `type-data` / mono meta with
`text-text-faint` (or equivalent ink utility) — **neutral only**. House status
colors (`text-danger`, degraded gold, etc.) are forbidden for HTTP methods.

**Main selection chrome (Jev `main_selection_chrome` → `identity_placeholder`):**
when `selectedIdentity` is set, main shows method, path, summary (if any),
operationId (if any), and deprecated flag as plain text — enough to prove
shared state. Empty selection keeps `Select an operation.` placeholder. #6
replaces this chrome later.

**Reuse:** `parseOpenApiDocument`, `CONTROL_FOCUS`, DocsShell slots,
`dev-petstore-3.0.json` twin, FEDGE / identity-paths / empty-paths fixtures
from `#2` (tests read fixture files; production never imports `__tests__`).

**Module layout:**

```
apps/redoc/src/domains/openapi/api/
  build-operation-nav-model.ts   # group → OperationNavModel
  filter-operation-nav-model.ts  # filter → filtered model + selectionVisible
apps/redoc/src/domains/docs/components/
  docs-operation-nav.tsx         # filter input + tag sections + rows
  docs-operation-nav-row.tsx     # one selectable row (≤300 lines split)
  docs-operation-selection.tsx   # main-pane selection chrome
apps/redoc/src/app/
  docs.tsx                       # composition + useState
  load-docs-document.ts          # parse → chrome + NormalizedOpenApiDocument
                                 # (extends/replaces loadDocsChrome usage)
```

No barrel `index.ts`. Keep files ≤300 lines.

## Interfaces / Schema

### Operation nav DTO (openapi → plain JSON-serializable shapes)

```ts
/** One selectable row under a tag section. */
type OperationNavItem = {
  identity: string; // encodeOperationIdentity(method, path)
  method: string;   // lowercase verb from model; UI uppercases for display
  path: string;
  summary?: string;
  operationId?: string;
  deprecated: boolean;
  /** Distinct tag names from the operation (empty ⇒ tagless). Used by filter. */
  tags: string[];
};

/** One tag heading + its rows. */
type OperationNavSection = {
  /** Tag name, or sentinel `"__toolu.untagged__"` for the tagless bucket. */
  key: string;
  /** Visible heading; `"Untagged"` for the tagless bucket only. */
  label: string;
  items: OperationNavItem[];
};

/** Full sidebar model before or after filter. */
type OperationNavModel = {
  sections: OperationNavSection[];
  /** Flat unique identities in document order (for tests / empty checks). */
  operationCount: number;
};

type FilterOperationNavResult = {
  model: OperationNavModel;
  /** False when selectedIdentity is non-null and no visible row has it. */
  selectionVisible: boolean;
};
```

### buildOperationNavModel

```ts
buildOperationNavModel(document: NormalizedOpenApiDocument): OperationNavModel
```

- Empty `operations` → `{ sections: [], operationCount: 0 }`.
- Section rules as in Architecture.
- Item primary fields copied from the normalized operation; do not invent
  summary/operationId.

### filterOperationNavModel

```ts
filterOperationNavModel(
  model: OperationNavModel,
  query: string,
  selectedIdentity: string | null,
): FilterOperationNavResult
```

- Let `q = query.trim()`.
- Matching (when `q` nonempty): case-insensitive substring — an item matches if
  `q` is found in any of: `path`, `method`, each string in `item.tags`, parent
  section `label`, `summary` (if present), `operationId` (if present). Do not
  use section `key` as a haystack (avoids matching the `__toolu.untagged__` sentinel;
  the label **Untagged** and empty `tags` still allow tagless ops to match
  query `untagged` via section label). Missing optional fields contribute no
  haystack. When any of an op’s tags matches, **every** section row for that
  identity that remains after per-item filtering stays (each row is filtered
  independently with the same item fields, so all appearances match together).
- When `q === ""`: `model` is a structural copy of the input sections (all
  items kept). When `q !== ""`: keep only matching items; drop sections that
  retain zero items.
- Does **not** mutate caller state and does **not** clear `selectedIdentity`.
- `selectionVisible` (single rule): `true` iff `selectedIdentity === null` **or**
  at least one item in the **returned** `model.sections` has that `identity`.
  Therefore with an empty filter, a selected identity that exists in the input
  model stays visible; with a narrowing filter it becomes `false` when every
  row of that identity was removed.

### DocsOperationNav props

```ts
type DocsOperationNavProps = {
  model: OperationNavModel; // already filtered by caller
  filterQuery: string;
  onFilterQueryChange: (query: string) => void;
  selectedIdentity: string | null;
  onSelectIdentity: (identity: string) => void;
  selectionVisible: boolean;
  /** Shown when filter active and model.sections is empty. */
};
```

- Section headings: render `label`; set `data-section-key={section.key}` on the
  section element for tests (distinguishes literal tag `Untagged` from the
  tagless bucket).
- Filter control: `<input type="search">` accessible name **Filter operations**.
- Rows: `<button type="button">` (or equivalent focusable control) with
  `CONTROL_FOCUS`; selected row `aria-current="true"` (or `aria-pressed`).
- Primary text: `summary` trimmed if nonempty, else `path`. Method as separate
  mono meta (uppercase). Deprecated: faint `(deprecated)` suffix when true.
- When `selectionVisible === false` and `selectedIdentity !== null`: show a
  `type-meta` notice **Selected operation is hidden by the filter.** plus a
  button **Clear filter** that calls `onFilterQueryChange("")`.
- When filter nonempty and `sections.length === 0`: **No matching operations.**
- When unfiltered `operationCount === 0`: **No operations in this document.**
- Long path/summary: row container `min-w-0 overflow-auto` / truncate with
  local scroll — no page-wide overflow (T25 nav slice).
- **Keyboard / drawer:** introduce no second focus trap. When the shell nav
  drawer is open (< md), filter + rows participate in the existing #4 drawer
  tab cycle. On md+, they participate in normal document tab order inside the
  Navigation landmark (T24 nav slice).

### DocsOperationSelection props

```ts
type DocsOperationSelectionProps = {
  item: OperationNavItem | null; // resolve from unfiltered model by identity
};
```

- `null` → existing placeholder sentence `Select an operation.`
- non-null → method (mono), path, optional summary/operationId, deprecated.

### loadDocsDocument (route layer)

```ts
loadDocsDocument(input: string):
  | { ok: true; title: string; version: string; document: NormalizedOpenApiDocument }
  | { ok: false; message: string }
```

Chrome field rules match `loadDocsChrome`. Prefer one helper; keep
`loadDocsChrome` as a thin wrapper **or** delete it and update `#4` tests to
use `loadDocsDocument` (knip must stay green — no dead export).

### `/docs` composition

1. `loadDocsDocument(petstoreText)`.
2. On failure → incident note (unchanged).
3. On success → `navModel = buildOperationNavModel(document)`;
   `filtered = filterOperationNavModel(navModel, filterQuery, selectedIdentity)`.
4. `nav={<DocsOperationNav … filtered …/>}`;
   `main={<DocsOperationSelection item={resolve(navModel, selectedIdentity)}/>}`.

## Failure modes and edge cases

| Case | Observable behavior |
| --- | --- |
| Empty paths / zero ops | Nav empty state; main stays unselected; no crash. |
| Path Item metadata only (FEDGE `/meta`) | Not listed; eight `/verbs` ops only. |
| Duplicate root tag `alpha` | One Alpha section. |
| Op tags `["alpha","alpha"]` | One row under alpha. |
| Op tags `["beta","undeclared"]` | Row under beta and under undeclared. |
| Tagless ops | Tagless bucket last (`key: "__toolu.untagged__"`, label `Untagged`). |
| Declared tag literally named `Untagged` | Separate section `key/label: "Untagged"`; tagless bucket still uses sentinel key if needed — two headings may both display “Untagged” only if both a literal tag and tagless ops exist; distinguish in tests via `data-section-key` on the section element. |
| Undeclared-only tags (`ghost`) | Section after declared, before tagless bucket. |
| Missing/duplicate `operationId` | Identity remains method+path; selection never keys on operationId (T11). |
| Paths with braces/slash/tilde/space/Unicode | Rows use exact path strings; identity encode/decode round-trips; selecting sets that identity (T11). |
| Filter whitespace-only | Treated as empty; full list restored. |
| Filter no match | No-results message; selection unchanged; filtered-out banner if selection set. |
| Clear filter | All sections restored; selection still selected and visible. |
| Select under tag A then see same op under tag B | Both rows `aria-current` when that identity selected. |
| Parse failure | No nav; incident note only. |
| Reduced motion | Inherit globals; no new unbounded animation. |

## Acceptance criteria

- **AC-1:** Given Petstore fixture bytes through `loadDocsDocument` →
  `buildOperationNavModel`, the `/docs` Navigation region lists every
  normalized Petstore operation grouped by tag (including Untagged if any),
  with method mono labels and summary-or-path primary text.
- **AC-2:** Given FEDGE bytes through production parse +
  `buildOperationNavModel`, the section/row set matches the epic contract:
  exactly the eight `/verbs` operations; `/meta` absent; unique `alpha` /
  `beta` declared sections; undeclared `undeclared` + `ghost`; Untagged for
  tagless delete/head; multi-tag ops appear in each distinct tag; Path Item
  metadata is never a row (T10).
- **AC-3:** Selecting a nav row sets `selectedIdentity` to that row’s identity;
  main selection chrome shows that operation’s method+path (and summary when
  present); selecting the same identity under another tag keeps one selection
  (T10 shared selection).
- **AC-4:** Given identity-paths fixture, each listed path/method is selectable
  by identity; duplicate `operationId` values do not collide; identity keys
  round-trip via `decodeOperationIdentity` without double-decoding (T11).
- **AC-5:** Filter matches path, mixed-case method, tag label, summary, and
  operationId with trimmed query; no-match shows **No matching operations.**;
  clearing restores all rows; selection is not cleared by filtering; when the
  selected row is filtered out, the filtered-out notice and **Clear filter**
  appear (T12).
- **AC-6:** Nav filter input and operation rows are keyboard-focusable with
  visible house focus ring (`CONTROL_FOCUS`); rows are buttons (or equivalent
  controls) with accessible names derived from method + primary text (T24 nav
  slice).
- **AC-7:** At stubbed widths `{375, 599, 600, 859, 860, 1119, 1120, 1399, 1400}`
  with a 200-character path in a nav row, Navigation remains reachable
  (in-flow or via #4 drawer opener) and
  `document.documentElement.scrollWidth ≤ clientWidth + 1` (T25 nav slice).
  Widths ≥860 reuse the same three-column shell already proven in #4; this AC
  still asserts overflow with real nav content. 200% zoom deferred to #9.
- **AC-8:** Colocated tests use real fixture file bytes (Petstore twin and/or
  openapi `__tests__/fixtures` via `readFileSync` in tests only) through
  `parseOpenApiDocument` / `loadDocsDocument` — not hand-built mock documents
  standing in for parse.

## Acceptance evidence

| AC | Real input | Expected observable | Boundary / failure | Runnable check |
| --- | --- | --- | --- | --- |
| AC-1 | `dev-petstore-3.0.json` SHA-256 `246cfe6e…3413` | All Petstore ops under tags in nav | parse fail → incident | `app/__tests__/docs-route.test.tsx` + `docs/__tests__/docs-operation-nav.test.tsx` |
| AC-2 | `fedge.json` SHA `6d73dc4d…dc8a` | Exact grouping matrix | `/meta` absent | `openapi/api/__tests__/build-operation-nav-model.test.ts` |
| AC-3 | Petstore or FEDGE via parse | Main chrome updates; multi-tag shared `aria-current` | empty selection placeholder | `docs-operation-nav.test.tsx` (user-event click) |
| AC-4 | `identity-paths.json` SHA `83d1b134…e078` | Select each edge path; decode(identity) matches | duplicate operationId | nav model + selection tests |
| AC-5 | FEDGE / Petstore | Match/clear/no-results/filtered-out banner | whitespace-only query | `filter-operation-nav-model.test.ts` + nav UI test |
| AC-6 | rendered nav | Tab to filter + row; focus ring classes present | — | `docs-operation-nav.test.tsx` user-event tab |
| AC-7 | long path item + matchMedia stubs | Reachable; no page overflow | below/above md | `docs-operation-nav.test.tsx` or shell integration |
| AC-8 | checksum asserts in tests | `ok: true` from real bytes | — | same suites |

Command: `bun run --filter @toolu-redoc/redoc test` and `bun run check`.

## Documentation impact

- `apps/redoc/src/domains/openapi/README.md` — nav model builders.
- `apps/redoc/src/domains/docs/README.md` — nav + selection components.
- `apps/redoc/src/domains/README.md` — one-line nav note if the map lists
  responsibilities.
- `apps/redoc/README.md` — `/docs` now lists operations (still temporary until
  #3).

## Open Questions

None blocking. Resolved here:

1. **Module split → openapi pure model + docs React DTO UI** (Jev `nav_home`).
2. **Selection → route-local `useState`; URL deferred to #8** (Jev
   `selection_state`).
3. **Filter → owned by #5 / T12** (Jev `filter_owner`).
4. **Tag order → declared (unique) → undeclared first-seen → tagless bucket**
   (Jev `untagged_order`); tagless sentinel `key: "__toolu.untagged__"` so a real
   tag named `Untagged` or `__untagged__` does not merge with tagless ops.
5. **Main pane → identity selection chrome until #6** (Jev
   `main_selection_chrome`).
6. **Method colors → neutral mono only** (issue + epic explicit).
7. **200% zoom / full browser T24–T25 remainder → #9**.
8. **No second focus trap** — nav controls join #4 drawer/document order.
)
