# Operation detail (summary, params, request, responses) — Design

**Date:** 2026-09-24   **Status:** Approved   **Author:** epic-worker (issue #6)   **Topic:** Main-column operation detail with schema-focus handles for the right rail

## Problem

The docs shell (#4) ships an empty Operation slot, and the normalized OpenAPI
model (#2) is unused by any detail UI. Without a main-column panel that shows
summary, parameters, request body, and responses for a selected operation,
downstream sidebar (#5), right-rail (#7), and deep-link (#8) work have nothing
to drive, and epic scenarios T13–T15, T19, and T26 have no presentation surface.

## Non-Goals

1. Full sidebar tag grouping, filter, or deep-link encoding (#5 / #8) — only a
   temporary minimal identity picker on `/docs` until those land.
2. Schema tree, `$ref` expansion UI, or example inspector chrome (#7) — this
   issue emits a focus handle and a stub rail label only.
3. URL/paste load UX, CORS, fetch limits, or cancellation (#3).
4. Markdown rendering of descriptions (plain inert text only; HTML/script stay
   text nodes).
5. Request execution, credentials, auth flows, or security-requirement display
   (optional epic feature; **not accepted** — Jev `security_scope` noul 0.06).
6. Swagger 2, external `$ref` fetch, or synthesizing examples.
7. Browser-runner harness / CI Playwright wiring (#9).
8. Relocating `#2` fixture trees out of `domains/openapi/__tests__/`.

## Architecture

**Chosen approach (Jev `domain_home` → `docs_vm`, confidence 0.94):** present
operation detail inside `domains/docs` as slot content with **plain view-model
props**. The route layer maps `NormalizedOpenApiOperation` (+ document servers)
into that view-model so `docs` never imports `openapi` (same isolation pattern
as `#4` chrome).

**Selection until #5 (Jev `temp_selection` → `route_state_picker`, confidence
0.95):** `/docs` holds `selectedIdentity: string | null` (default `null` →
empty state). A temporary nav list of buttons (`method` + `path`, one per
operation identity) sets selection; it is **not** tag-grouped and is removed
or replaced when `#5` ships. Colocated tests drive `OperationDetail` props
directly from production `parseOpenApiDocument` on real fixture bytes.

**Rail bridge (Jev `rail_handle` → `callback_focus`, confidence 0.99):**
`OperationDetail` calls `onFocusChange(SchemaFocus | null)` when the reader
changes response status, request/response media type, named example, or clicks
a parameter/response-header schema handle. The route keeps focus state and
renders a stub Samples label (`Schema focus: …` / empty) until `#7` owns the
rail.

**Decisive trade-off:** temporary nav + focus callback keep `#6` deliverable
and unblock `#7`/`#8` without stealing their UI. Cost: a short-lived picker
and stub rail string that later issues replace.

**Reuse:** `parseOpenApiDocument`, merged `parameters` /
`pathParameterIssues` from normalize, `encodeOperationIdentity`, Petstore twin
`domains/docs/api/dev-petstore-3.0.json`, `#2` scenario fixtures
(`param-merge`, `examples`, `fedge`, …), Signal/chalk utilities (`type-*`,
`border-border`, no card shadows), no `dangerouslySetInnerHTML`, no `fetch`
from docs components.

**Module layout:**

```
apps/redoc/src/domains/docs/
  components/
    operation-detail.tsx              # main panel root (null → empty state)
    operation-detail-header.tsx       # method/path, summary, deprecated, ids
    operation-detail-parameters.tsx   # parameters table + path-param issues
    operation-detail-request.tsx      # body requiredness, media/example pickers
    operation-detail-responses.tsx    # status list, headers, media/example pickers
    operation-detail-servers.tsx      # effective servers + variables (read-only)
    operation-nav-list.tsx            # TEMPORARY identity buttons until #5
  api/
    operation-detail-model.ts         # plain view-model types + SchemaFocus
  __tests__/
    operation-detail.test.tsx         # Petstore every-op + T13–T15/T19/T26 slices
apps/redoc/src/app/
  load-docs-document.ts               # text → chrome + operations view-models
  map-operation-detail.ts             # NormalizedOpenApiOperation → view-model
  docs.tsx                            # selection state + focus stub rail
  __tests__/
    docs-route.test.tsx               # extend: empty default + select one op
apps/redoc/src/domains/openapi/__tests__/fixtures/
  operation-detail-bodies.json        # NEW — T14: json/form/multipart, headers, default/range/204
  operation-detail-meta.json          # NEW — T15: missing fields, deprecated, root vs op servers
```

No barrel `index.ts`. Keep production files ≤300 lines.

**Committed fixtures (required, real OpenAPI bytes):**

| File | Covers |
| --- | --- |
| existing `param-merge.json` | T13 merge + path-param issues |
| existing `examples.json` | T19 media/named/falsy/external |
| existing `petstore-3.0.json` (+ docs twin) | AC-1 every-op; AC-3 path+JSON body smoke; AC-8 route |
| **new** `operation-detail-bodies.json` | T14: one op with `application/json` + `application/x-www-form-urlencoded` + `multipart/form-data` request media; responses `200` (JSON + header), `default`, `2XX`, and `204` without content |
| **new** `operation-detail-meta.json` | T15: op A missing summary/description/operationId; op B `deprecated: true`; document `servers` + op B overrides with its own `servers` + variables |

Place the two new files under `domains/openapi/__tests__/fixtures/` with a provenance note in `provenance.md` (hand-authored for epic #6; SHA-256 recorded). Tests read them via `readFileSync` / `?raw` — never hand-built `NormalizedOpenApiOperation` mocks.

## Interfaces / Schema

### View-model (docs-owned, no openapi imports)

```ts
// domains/docs/api/operation-detail-model.ts

type OperationDetailModel = {
  identity: string;
  method: string;           // lowercase HTTP verb
  path: string;
  operationId: string | null;   // null → omit row / show "—"
  summary: string | null;
  description: string | null;   // plain text; may contain markup characters
  deprecated: boolean;
  tags: string[];
  parameters: OperationParameterRow[];
  pathParameterIssues: { name: string; issue: "missing" | "not_required" }[];
  requestBody: OperationRequestBodyModel | null;
  responses: OperationResponseRow[];
  servers: OperationServerModel[];  // effective: op.servers ?? doc.servers
};

type OperationParameterRow = {
  name: string;
  in: "path" | "query" | "header" | "cookie" | "$ref";
  required: boolean;
  deprecated: boolean;
  description: string | null;
  typeSummary: string;          // e.g. "string", "integer", "$ref #/…", "content"
  schemaHandle: SchemaFocus;    // kind: "parameter"
};

type OperationRequestBodyModel = {
  description: string | null;
  required: boolean;
  mediaTypes: string[];         // authored order
  contents: Record<string, OperationMediaModel>;
};

type OperationResponseRow = {
  status: string;               // "200" | "default" | "2XX" | …
  description: string;          // may be empty string
  headers: { name: string; typeSummary: string; schemaHandle: SchemaFocus }[];
  mediaTypes: string[];
  contents: Record<string, OperationMediaModel>;
  emptyContent: boolean;        // true when no content map (e.g. 204)
};

type OperationMediaModel = {
  typeSummary: string;          // schema summary or "—"
  schemaHandle: SchemaFocus;
  /** Media `example` key present → prefer singular; else first namedExamples key; else null. */
  defaultExampleKey: string | null;
  singularExample: { present: boolean; value: unknown };
  namedExamples: {
    key: string;
    summary: string | null;
    value: unknown | undefined;       // undefined when only externalValue
    externalValue: string | null;     // labeled, never fetched
  }[];
};

/**
 * Unwrap a media-type example entry (Zod stores examples as unknown).
 * For each named entry E under media.examples:
 *   - if E is a non-null object:
 *       externalValue ← typeof E.externalValue === "string" ? E.externalValue : null
 *       value ← Object.hasOwn(E, "value") ? E.value : undefined
 *         (when only externalValue is set, value stays undefined — do not invent)
 *       summary ← typeof E.summary === "string" ? E.summary : null
 *   - else (JSON-compatible scalar / array): value ← E; externalValue ← null; summary ← null
 * Singular media.example: { present: true, value: media.example } when the
 * `example` key exists (including false/0/""/null); else { present: false, value: undefined }.
 * defaultExampleKey: if singularExample.present → null (UI uses singular);
 * else first Object.keys(namedExamples) in authored order; else null.
 * Do not fall back to schema.example(s) when media examples are absent — empty example state.
 */

type OperationServerModel = {
  url: string;
  description: string | null;
  variables: { name: string; defaultValue: string; enumValues: string[] }[];
};

type SchemaFocus =
  | {
      kind: "parameter";
      name: string;
      in: string;
      typeSummary: string;
      /** Present when the parameter is/was a `$ref`; otherwise null. */
      ref: string | null;
    }
  | {
      kind: "request";
      mediaType: string;
      typeSummary: string;
      ref: string | null;
      exampleKey: string | null;
      exampleValue: unknown | undefined;
      externalValue: string | null;
    }
  | {
      kind: "response";
      status: string;
      mediaType: string | null;
      headerName: string | null;
      typeSummary: string;
      ref: string | null;
      exampleKey: string | null;
      exampleValue: unknown | undefined;
      externalValue: string | null;
    };

/** SchemaFocus is a handle for #7 — keys + summaries + example scalars only.
 * Do not embed full schema object graphs (cycle/size risk). #7 resolves schemas
 * from the loaded document using operation identity + these keys.
 */
```

### Component props

```ts
type OperationDetailProps = {
  operation: OperationDetailModel | null;
  onFocusChange?: (focus: SchemaFocus | null) => void;
};

type OperationNavListProps = {
  operations: { identity: string; method: string; path: string }[];
  selectedIdentity: string | null;
  onSelect: (identity: string) => void;
};
```

### Mapping (route / app layer)

```ts
// app/map-operation-detail.ts
mapOperationDetail(
  operation: NormalizedOpenApiOperation,
  documentServers: OpenApiServer[],
): OperationDetailModel

// app/load-docs-document.ts
loadDocsDocument(input: string):
  | {
      ok: true;
      title: string;
      version: string;
      operations: OperationDetailModel[];
      navItems: { identity: string; method: string; path: string }[];
    }
  | { ok: false; message: string }
```

- **Replace** `loadDocsChrome` with `loadDocsDocument` (same chrome field rules:
  empty title → `"Untitled document"`, version → `"—"`). Update
  `docs-route.test.tsx` and delete `load-docs-chrome.ts` so knip stays green
  and chrome mapping cannot diverge.
- `$ref` parameters/bodies/responses: `typeSummary` starts with `$ref `;
  `SchemaFocus.ref` carries the pointer string; do not drop the row/section.
- Schema type summary: prefer `schema.type` (string or joined array), else
  `boolean` schema → `"true"` / `"false"`, else composition keyword name
  (`allOf`/`oneOf`/`anyOf`), else `"—"`. Never put the schema object itself
  into `SchemaFocus`.
- Example precedence (T19): media `example` / `examples` only (see unwrap
  rules above). Do not synthesize values. Preserve `false` / `0` / `""` /
  `null`. `externalValue` → visible label + URL text; zero network calls.
  Example scalars may appear on the focus handle (bounded JSON values); not
  schema trees.
- Effective servers: `operation.servers` if defined and non-empty, else
  document `servers` (may be `[]`).
- Selection identity: if `selectedIdentity` is non-null but missing from
  `operations`, treat as empty selection and clear focus.
- Default focus on select: after `onFocusChange(null)`, if the operation has
  any responses, focus the first authored status with `mediaType` =
  first media type of that response (or `null` when `emptyContent`); else if
  request body exists, focus its first media type; else leave null.

### UI contract (main column)

| Region | Behavior |
| --- | --- |
| Empty (`operation === null`) | Same copy as placeholder: `Select an operation.` (`type-meta`). No focus emit (or `onFocusChange(null)` once on mount/change). |
| Header | Mono method + path; summary as `type-subhead` (fallback path if summary null); optional operationId as `type-data`; deprecated badge (`text-warning` / degraded token); description as inert plain text. |
| Servers | Read-only list of URL + variables (`name=default`); **no** Try-it / Execute controls. |
| Parameters | Table columns: Name, In, Required, Type, Description. Path-param issues listed above the table without hiding other rows. Clicking Type emits parameter `SchemaFocus`. |
| Request | If null → explicit empty: `No request body.` If present → required flag, media-type control (`role="listbox"` or radio group name `Request media type`), named-example control when `namedExamples.length > 0`, singular/default example value rendered as mono JSON/text (including falsy). Media/example change updates focus. |
| Responses | Ordered list of status keys as authored. Selecting a status shows description, headers (if any), media/example controls when `!emptyContent`. Bodyless (204 / no content) → `No response body.` and focus with `mediaType: null` / cleared example. |
| Inert | All description/name/example strings via React text. Ban `dangerouslySetInnerHTML`. No `fetch`/`http` from docs components (T26). |

### Route `/docs` composition

1. `loadDocsDocument(petstoreText)`.
2. `selectedIdentity` state default `null`; `focus` state default `null`.
3. `nav={<OperationNavList …/>}` (temporary).
4. `main={<OperationDetail operation={selected} onFocusChange={setFocus} />}`.
5. `rail` stub: if focus → `type-meta` line summarizing `kind` + keys; else
   existing Samples placeholder sentence.

## Failure modes and edge cases

| Case | Observable behavior |
| --- | --- |
| `operation === null` | Empty selection copy; no crash; focus cleared. |
| Missing summary / description / operationId | Stable fallbacks (path as title stand-in; omit or `—` for id; no description block). |
| Deprecated true | Visible deprecated marker; operation still fully readable. |
| Path-param `missing` / `not_required` | Issue notice; other parameters and the operation remain. |
| Same `name` different `in` | Distinct rows (from merge). Operation override of same `(name,in)` already applied by normalize. |
| Request body absent | Explicit empty state — never invent a schema. |
| Response without `content` (204) | Empty body state; switching away from a media-bearing status clears stale body/focus payload. |
| Only `externalValue` example | Label + URL text; `exampleValue` undefined; no fetch. |
| Falsy example values | `false` / `0` / `""` / `null` shown, not treated as absent. |
| FSAFE markup in description/name/example | Visible as text; no `<script>` node; zero `fetch` during render. |
| Unresolved `$ref` in param/body/response | Row/section still renders with `$ref` summary; focus carries `ref` pointer, not a resolved graph. |
| Empty `servers` | Omit the Servers region entirely (no execute UI). |
| `selectedIdentity` not in `operations` | Render empty selection; clear focus. |
| Switch operation while focus set | Emit `onFocusChange(null)`, then apply default focus (first response status/media, else first request media, else null). |

## Acceptance criteria

- **AC-1:** Given Petstore bytes through `parseOpenApiDocument` →
  `mapOperationDetail`, rendering `OperationDetail` for **every** normalized
  operation (`document.operations`, length asserted `> 0` and equal to the
  parse result — do not hardcode a count) completes without throw and shows
  that operation’s method + path.
- **AC-2:** Given `param-merge.json` `GET /pets/{petId}`, the parameters table
  shows merged rows where operation `limit@query` description wins, both
  `limit@query` and `limit@header` appear, and `GET /items/{itemId}` surfaces a
  `missing` path-param issue without dropping the `verbose` query row (T13).
- **AC-3:** Given `operation-detail-bodies.json` through production parse → map,
  the selected operation lists all three request media types (json, form,
  multipart); response statuses include `200`, `default`, `2XX`, and `204`;
  `200` exposes a response header row; `204` shows `No response body.` with no
  stale media from a prior status; changing status/media/example updates
  `onFocusChange` (T14). Petstore `PUT /pet` and `GET /pet/{petId}` remain
  smoke coverage for JSON body + path param on the fixture used by `/docs`.
- **AC-4:** Given `operation-detail-meta.json`, the missing-metadata operation
  shows path as title stand-in and omits/dashes id and description; the
  deprecated operation shows a visible deprecated marker; its servers list is
  the operation-level URLs/variables (not only document root); **zero**
  request-execution controls exist in the tree (T15).
- **AC-5:** Given `examples.json` `POST /demo`, switching media/named examples
  respects media-over-schema precedence, renders `false`/`0`/`""`/`null`, labels
  `externalValue` without fetching, and absent examples show an empty example
  state (T19).
- **AC-6:** When `operation` is `null`, the main panel shows the empty selection
  copy and does not render parameter/request/response tables.
- **AC-7:** Rendering FSAFE corpus strings as description / parameter name /
  example values keeps them as text, inserts no `<script>`, and triggers zero
  `fetch` calls (T26 detail slice).
- **AC-8:** `/docs` defaults to empty selection; choosing a temporary nav
  identity renders that operation’s detail from real Petstore parse bytes
  (checksum of `dev-petstore-3.0.json` asserted in route/detail tests).

## Acceptance evidence

| AC | Real input | Expected observable | Runnable check |
| --- | --- | --- | --- |
| AC-1 | `petstore-3.0.json` / docs twin | Every parsed op renders method+path | `operation-detail.test.tsx` |
| AC-2 | `param-merge.json` | Merge + issues as above | same |
| AC-3 | `operation-detail-bodies.json` (+ Petstore smoke) | Media types, statuses, header, 204 empty, focus updates | `operation-detail.test.tsx` |
| AC-4 | `operation-detail-meta.json` | Fallbacks, deprecated, op servers, no execute | same |
| AC-5 | `examples.json` | Precedence, falsy, external label, no fetch | same + fetch spy |
| AC-6 | `operation={null}` | Empty copy only | same |
| AC-7 | FSAFE strings in mapped fields | Inert text; spy callCount 0 | same |
| AC-8 | `dev-petstore-3.0.json` via `loadDocsDocument` | Empty default; select → detail | `docs-route.test.tsx` |

Command: `bun run --filter @toolu-redoc/redoc test` and `bun run check`.

## Documentation impact

- `apps/redoc/src/domains/docs/README.md` — inventory operation-detail modules +
  temporary nav list note (remove when `#5`).
- `apps/redoc/AGENTS.md` — repo map stays `domains/docs`; no new domain.
- `apps/redoc/README.md` — `/docs` now shows selectable Petstore operation
  detail (temporary nav until `#5`).
- Spec/plan under `docs/toolu/` for this issue.

## Open Questions

None blocking. Resolved here:

1. **Domain → `domains/docs` view-model + app mapping** (Jev `docs_vm`).
2. **Selection → route state + temporary nav list; default null** (Jev
   `route_state_picker`).
3. **Rail → `onFocusChange(SchemaFocus)` + stub label until `#7`** (Jev
   `callback_focus`).
4. **Security-requirement display → out of scope** (Jev `security_scope`).
5. **Descriptions → plain inert text only** (issue + epic MVP default).
6. **T14/T15 fixtures → required committed files**
   `operation-detail-bodies.json` and `operation-detail-meta.json` (named above).
7. **`loadDocsDocument` replaces `loadDocsChrome`** (delete the old helper).
8. **Example Object unwrap + defaultExampleKey** documented under Interfaces.
9. **SchemaFocus is a handle** (keys/summaries/example scalars) — no embedded
   schema graphs; `#7` resolves from the document.
