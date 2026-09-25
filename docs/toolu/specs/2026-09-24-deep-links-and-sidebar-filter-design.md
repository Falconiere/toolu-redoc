# Deep links and sidebar filter — Design

**Date:** 2026-09-24   **Status:** Approved   **Author:** epic-worker (issue #8)   **Topic:** Sync operation selection to shareable `/` search `op`, wire loaded docs viewer after SpecLoad, reuse #5 filter, history + unknown-op recovery

## Problem

Developers can load a spec (#3), browse tag-grouped operations (#5), and read
detail (#6), but selection is route-local on temporary `/docs` and the SpecLoad
success panel never opens the three-column viewer. Without URL ↔ selection sync,
pending-`op` restore after paste, history, and share/copy disclosure, epic
scenarios T11 (identity round-trip in links), T12 (already implemented — reused),
T20–T22 have no delivery surface, and a shared link cannot reopen the same
operation.

## Non-Goals

1. Re-implementing sidebar filter matching — reuse `filterOperationNavModel` and
   `DocsOperationNav` from #5 unchanged (T12 already owned there).
2. Schema/example right rail (#7) — keep the existing focus stub rail.
3. Playwright / Workers browser harness ownership (#9). Fresh-session and
   Back/Forward are proven with TanStack Router memory history + RTL (and the
   existing fixture HTTP server for URL-spec loads). Full cross-origin Workers
   SPA reload remains blocked-on-#9 where the harness is required.
4. Persisting the filter query in the share URL (Jev `filter_url` noul 0.46 →
   **no**). Filter stays local React state.
5. Putting document bytes in the URL or Web Storage; request execution;
   credentials; security-requirement display (optional epic feature; **not
   accepted**); Swagger 2; external `$ref` fetch.
6. Changing the #3 encoding of `url` / `op` search params, identity codec, or
   auto-load / `op` pass-through on SpecLoad.

## Architecture

**Chosen approach (Jev `viewer_surface` → `replace_success_on_slash`,
confidence 0.85):** after a successful load on `/`, **replace the entire SpecLoad
screen chrome** (header/form/success panel) with the three-column `DocsShell`
composition driven by the loaded `NormalizedOpenApiDocument`, plus a slim viewer
toolbar (title/version, Share, Reset). Selection is the search param `op`
(already reserved by #3). Temporary `/docs` remains a Petstore playground (may
optionally mirror `op` sync for local demos) but **share links target `/`**.

**History (Jev `history_mode` → `push_on_select`, confidence 0.96):** user
selecting a row `navigate`s with `replace: false` so Back/Forward restore prior
`op`. Applying an inbound deep-link `op` after load uses `replace: true` so the
load does not double-stack a history entry. Clearing selection (if exposed)
writes search without `op` via push. Filter changes never write the URL.

**Unknown op (Jev `unknown_op` → `unknown_empty_keep_op`, confidence 0.99):** when
`op` is present but decode fails **or** the identity is absent from
`document.operations`, main shows a distinct unknown-operation empty/error; keep
`op` in the URL; select nothing else; clear schema focus; do not fall back to
another operation (T22).

**Decisive trade-off:** keep share encoding on `/` (already implemented) and
promote SpecLoad success into the real viewer instead of relocating load to
`/docs`. Cost: `/` grows a thin composition that switches load form ↔ viewer;
`domains/docs` still never imports `openapi` (route/app maps DTOs).

**Reuse:**

| Piece | Path |
| --- | --- |
| Search coerce | `validateSpecLoadSearch` / `SpecLoadSearch` (`url`, `op`) |
| Identity | `encodeOperationIdentity` / `decodeOperationIdentity` |
| Nav + filter | `buildOperationNavModel`, `filterOperationNavModel`, `DocsOperationNav` |
| Detail | `mapOperationDetail`, `OperationDetail` |
| Load | `useSpecLoad`, `loadOpenApiDocument`, fixture HTTP server |
| Shell | `DocsShellScreen` |

**Module layout:**

```
apps/redoc/src/
  domains/openapi/
    api/
      resolve-operation-selection.ts  # decode op → Selected | Unknown | None
      build-share-href.ts             # compose public href from origin + search
    hooks/
      use-operation-search.ts         # read/write op via navigate (push/replace)
    screens/
      spec-load-screen.tsx            # success===null → form; else viewer toolbar+shell
    components/
      share-operation-link.tsx        # copy UI + query-param disclosure (T22)
      loaded-docs-toolbar.tsx         # title/version/share/reset above DocsShell
  domains/docs/
    components/
      unknown-operation-empty.tsx     # distinct unknown-op empty (docs-owned DTO)
  app/
    index.tsx                         # pass navigate helpers for op + url
    compose-loaded-docs.tsx           # route-only: doc + search → shell slots
                                      # (prefix load-/map-/compose- ignored by router)
```

No barrel `index.ts`. Keep files ≤300 lines. Domain isolation: `docs` receives
plain DTOs/callbacks only; `openapi` may own selection resolve + share href
helpers that use identity codecs.

## Interfaces / Schema

### Selection resolution

```ts
type OperationSelection =
  | { kind: "none" }
  | { kind: "selected"; identity: string } // valid encodeOperationIdentity key present in doc
  | { kind: "unknown"; rawOp: string; reason: "malformed" | "missing" }

resolveOperationSelection(
  op: string | undefined,
  identities: ReadonlySet<string> | ReadonlyArray<{ identity: string }>,
): OperationSelection
```

- Missing / empty `op` → `none`.
- `decodeOperationIdentity` throws → `unknown` / `malformed` (do not throw into UI).
- Decoded key not in document identities → `unknown` / `missing`.
- Else → `selected` with the canonical identity string (use the document’s
  stored identity string when equal under decode, prefer the exact key from the
  document map to avoid encoding drift).

**Identity rule (T11):** `operationId` never determines selection. Path
characters (braces, `/`, `~`, spaces, Unicode) round-trip only via the existing
JSON `[method, path]` codec + router percent-encoding of the `op` search value.
No second encoding scheme.

### Writing `op`

```ts
type WriteOpOptions = {
  /** false = push (user select); true = replace (inbound deep-link apply). */
  replace: boolean
}

writeOperationSearch(
  navigate: AppNavigate,
  op: string | undefined,
  options: WriteOpOptions,
): void
```

- Sets or clears `op` while **preserving** `url` and any future pass-through
  fields.
- User row select → `writeOperationSearch(nav, identity, { replace: false })`.
- After successful load, if current `op` resolves to `selected` or `unknown`,
  do **not** rewrite unless normalizing is required; if the location already
  matches, skip. If load succeeds with no `op`, leave selection empty (no
  auto-pick).
- Reset (SpecLoad reset) clears document **and** should clear selection UI;
  `op` may remain until explicitly cleared — **decided:** Reset clears `op`
  via replace so a fresh load form does not show a stale unknown banner over
  an empty document. Reason: reset means “start over”; keeping a dangling `op`
  without a document is the paste-pending path (T21), which is the missing-`url`
  case, not reset-after-success.

### Loaded `/` composition

When `useSpecLoad().success !== null`:

1. Build `navModel` from `success.document`.
2. `selection = resolveOperationSelection(search.op, document.operations)`.
3. `selectedIdentity = selection.kind === "selected" ? selection.identity : null`.
4. `filtered = filterOperationNavModel(navModel, filterQuery, selectedIdentity)`.
5. **Do not** keep the SpecLoad form mounted. Render viewer chrome +
   `DocsShellScreen` only:
   - Viewer toolbar (openapi-owned screen chrome, not inside `domains/docs`):
     title/version from success; source kind/href summary; **Share** control;
     **Reset** (calls `useSpecLoad().reset` and clears `op` via replace).
   - `nav`: existing `DocsOperationNav` (filter local state) — props only.
   - `main`: if `selection.kind === "unknown"` → unknown empty; else
     `OperationDetail` for the matched operation (or empty “Select an
     operation.” when `none`).
   - `rail`: existing focus stub (#7 unchanged).
6. App route (`compose-loaded-docs` / `index.tsx`) maps openapi success + search
   into docs DTOs/callbacks so `domains/docs` never imports `openapi`.

While `success === null`, keep the existing SpecLoad form / banners / missing-
source copy (`MISSING_SOURCE_MESSAGE`). **Pending op (T21):** when `op` is set
and `url` is absent, show missing-source banner (already #3). After a successful
**paste** of a document that contains that identity, selection resolves from the
still-present `op` — no extra pending store. After paste of a document that
lacks the key → `unknown` / `missing` (T21 wrong-spec clause). **Reset after
success** is not T21: it is an explicit start-over that clears document and
`op`; T21 is only the fresh-session missing-`url` share path.

### Share / copy (T20 / T22)

```ts
buildShareHref(origin: string, search: SpecLoadSearch): string
// origin + `/?` + URLSearchParams from defined url/op only
```

UI hosted in the **openapi viewer toolbar** (sibling to `DocsShellScreen`, never
imported by `domains/docs`):

- **Copy link** copies `buildShareHref(window.location.origin, currentSearch)`.
- When `source.kind === "url"` and `source.href` contains `?`, show a
  `type-meta` disclosure that the full source URL (including its query string)
  is embedded as the single `url` search value, and that pasted documents are
  not in the link — reader must paste again (T21/T22).
- When `source.kind === "paste"`, copy still includes `op` (and omits `url`);
  disclosure states the document must be pasted again in a fresh session.
- Never put document bytes into the clipboard beyond the share href.

### Filter

Unchanged from #5:

- Local `filterQuery` state; empty query shows all.
- Filtered-out selection banner + Clear filter.
- No-results / no-operations empties.
- Filter does not clear selection and does not write the URL.

### `/docs` playground

Keep Petstore `/docs` for fixture demos. Optional: sync its selection to the
same `op` search shape for consistency; **not** required for issue ACs. Do not
make `/docs` the share target.

## Failure modes and edge cases

| Input / event | Observable behavior |
| --- | --- |
| `/?url=<fixture>&op=<valid identity>` fresh | Auto-load source first; on success select exact operation; history works (T20). |
| `/?op=<valid>` no `url` | Missing-source banner; after paste of matching fixture, that op selected (T21). |
| `/?op=<valid>` then paste wrong spec | `unknown` / `missing`; main shows unknown empty; `op` kept (T21). |
| Malformed `op` (bad JSON / bad method) | `unknown` / `malformed`; no fallback selection; focus cleared (T22). |
| Valid `op` not in document | `unknown` / `missing`; same (T22). |
| Oversized / non-string `op` from coerce | Treated as absent (`none`) by existing `optionalSearchString`. |
| Select row A then B | URL `op` updates; Back restores A (push) (T20). |
| Filter hides selected row | Selection + detail stable; “hidden by filter” banner; clear restores (T12). |
| Replace document (new URL/paste success) | Resolve `op` against new ops; may become `unknown`; no stale detail for old identity. |
| Reset after success | Clears document + clears `op` (replace); returns to idle load form. |
| Source URL containing `?a=1&b=2` | `url` search value round-trips full href; copy UI discloses embedding (T22). |
| Source fetch fail with `op` present | Load banner; `op` preserved; no selection UI until success (#3 + T20 recoverable). |
| Duplicate / missing `operationId` in fixture | Selection still method+path only (T11). |

## Acceptance criteria

- **AC-1:** Given fixture-server bytes of the committed Petstore twin
  (`domains/docs/api/dev-petstore-3.0.json` / equivalent `petstore-3.0.json`) and
  search
  `/?url=<href>&op=<encodeOperationIdentity("get","/pet/findByStatus")>`,
  auto-load succeeds then main shows that operation’s detail (`GET`
  `/pet/findByStatus`); no other operation is selected (T20 + issue deep-link).
- **AC-2:** Given a loaded document on `/`, clicking a different nav row updates
  location search `op` to that row’s identity; `url` (if any) is preserved
  (issue selection→URL).
- **AC-3:** Given AC-2 history, router Back restores the previous `op` and
  detail; Forward restores the next (T20 history). Proven with TanStack memory
  history + RTL in this issue; full Workers SPA reload harness remains #9.
- **AC-4:** Given the loaded `/` viewer wiring, a smoke path proves filter
  props reach `DocsOperationNav` (type a query → visible row count drops; clear
  → all restored). Full T12 matching matrix remains owned by #5 unit tests on
  `filterOperationNavModel` / `DocsOperationNav` — this issue does not re-own
  that matrix (issue filter + T12 reuse).
- **AC-5:** Given loaded document and malformed `op` or a well-formed identity
  absent from the document, main shows a distinct unknown-operation empty/error
  (not “Select an operation.”); no other op is selected; `op` remains in the
  URL (issue unknown + T22).
- **AC-6:** Given `/?op=<valid Petstore identity>` with no `url`, missing-source
  messaging is shown; after pasting the Petstore twin bytes, the pending
  operation is selected; document bytes never appear in the URL (T21).
- **AC-7:** Given paste of a different fixture that lacks that identity, state
  is `unknown` / `missing` (T21 wrong-spec).
- **AC-8:** Given paths with braces/slashes/tilde/spaces/Unicode and
  missing/duplicate `operationId` from the identity-paths / FEDGE fixtures,
  encoding an op into `op` and resolving it round-trips without collision;
  `operationId` never wins identity (T11).
- **AC-9:** Given a URL-sourced success whose `href` includes query parameters,
  Copy link produces a href whose `url` search value decodes to that full
  source href, and the UI discloses the embedding / paste limitation (T22
  copy).
- **AC-10:** Given Replace success B after success A while `op` pointed at an A-
  only operation, selection becomes `unknown` or resolves to B’s match — never
  shows A’s stale detail rows (T22 replace document).
- **AC-11:** Given production module graph, `domains/docs/**` still does not
  import `@/domains/openapi`; `/` route file stays thin (composition helpers
  under `app/` with allowed prefixes); no bare `fetch` in domains.
- **AC-12:** Real-data Vitest (RTL + memory router + fixture HTTP server where
  URL load is required) covers AC-1…AC-10; no mock OpenAPI document substitutes
  for Petstore/FEDGE/identity-paths bytes.

## Acceptance evidence

| AC | Real input | Expected | Boundary | Check |
| --- | --- | --- | --- | --- |
| AC-1 | Fixture server + Petstore twin + `op` for `get` `/pet/findByStatus` | Load then that op’s detail | failed url keeps op, no select | `bun run --filter @toolu-redoc/redoc test` |
| AC-2 | Loaded Petstore; click second row | `op` updates; `url` kept | — | RTL `/` composition |
| AC-3 | Two selections then `history.back()` | Prior op restored | forward too | memory-history RTL |
| AC-4 | `/` viewer filter smoke + existing #5 T12 tests | Smoke narrow/clear; matrix stays #5 | — | RTL wiring + #5 suites still green |
| AC-5 | `op=not-json` and `op` for missing path | Unknown empty; op kept | coerce oversize → none | resolve unit + RTL |
| AC-6 | `op` only → paste Petstore twin | Pending op selected; no body in URL | — | RTL |
| AC-7 | Same then paste empty-paths / other fixture | unknown/missing | — | RTL |
| AC-8 | identity-paths + FEDGE fixtures | round-trip set equal | duplicate operationId | unit + search write |
| AC-9 | Source href with `?a=1&b=2` via fixture server | copy href embeds full url; disclosure visible | — | RTL / unit `buildShareHref` |
| AC-10 | A ok → B ok different ops | no stale A detail | — | hook/composition test |
| AC-11 | knip + oxlint restricted imports | green | — | `bun run check` |
| AC-12 | provenance fixtures | all ACs recorded | skip = blocked | test files + plan ledger |

Fixtures: committed Petstore twin / `petstore-3.0.json`, FEDGE, identity-paths,
empty-paths from #2/#5; pin checksums already recorded in prior specs; do not
invent mock documents.

## Documentation impact

- `apps/redoc/README.md` — `/` after load shows the docs viewer; share via
  `url`+`op`; `/docs` remains Petstore playground; remove “URL sync lands in #8”.
- `apps/redoc/src/app/README.md` — note `compose-loaded-docs` (or final helper
  name) and `op` navigation.
- `apps/redoc/src/domains/openapi/README.md` — selection resolve + share href +
  success→viewer handoff.
- `apps/redoc/src/domains/docs/README.md` — unknown-operation empty if docs-owned.
- Spec cross-link: this file is the durable #8 contract; #3 encoding table
  remains authoritative for param names/limits.

## Open Questions

1. **Whether `/docs` also syncs `op`** — **Decided: optional, non-blocking.**
   Share target is `/`. Reason: ACs and T20–T22 are satisfied on `/`; playground
   parity is nice-to-have.
2. **Browser-harness proof of Workers direct-link fallback** — **Non-blocking
   for #8; blocked-on-#9.** Reason: epic assigns harness to #9; this issue ships
   memory-router + fixture-server evidence and documents the residual.
3. **Exact unknown-operation copy string** — **Decided:** main empty title
   **Unknown operation.** with body **This link’s operation key is missing or
   invalid in the loaded document.** Reason: must be distinct from “Select an
   operation.”; keep Signal empty pattern.
)
