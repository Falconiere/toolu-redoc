# Right rail: schemas, examples, and $ref display — Design

**Date:** 2026-09-24   **Status:** Approved   **Author:** epic-worker (issue #7)   **Topic:** Samples rail schema tree, examples, and local `$ref` resolution

## Problem

Issue #6 leaves the Samples column as a stub focus label. Readers selecting an
operation cannot inspect request/response/parameter schemas, follow local
`#/components/schemas/...` references, or see examples beside the tree. Epic
scenarios T14 (rail updates), T16–T19 (schema/composition/ref/example
distinctions), and T26 (inert content) have no rail surface.

## Non-Goals

1. Request execution, credentials, auth, or security-requirement display
   (optional epic feature; **not accepted** — same as #6).
2. External `$ref` fetch, remote example URL fetch, or 3.1 `$id`/`$dynamicRef`
   evaluation (label + local notice only; reuse `#2` `resolveLocalRef`).
3. Flattening or evaluating `allOf`/`oneOf`/`anyOf` / discriminator semantics.
4. Synthesizing examples when none are authored.
5. Deep-link / URL sync for focus (#8).
6. Browser-runner harness / CI Playwright wiring (#9).
7. Changing `SchemaFocus` into an embedded schema graph (rejected by #6
   contract and Jev `embed_in_focus`).
8. Markdown rendering of descriptions (plain inert text only).

## Architecture

**Chosen approach (Jev `rail_home` → `docs_vm_app_map`, confidence 0.75):**
`domains/docs` owns a plain `SchemaRailModel` and the Samples UI
(`SchemaRail` + recursive disclosure tree + example panel). The app layer maps
`NormalizedOpenApiDocument` + selected `NormalizedOpenApiOperation` +
`SchemaFocus` into that view-model, calling `#2` `resolveLocalRef` and walking
inline schemas. Docs never imports `openapi`.

**Lookup (Jev `lookup_source` → `rewalk_operation`, confidence 0.43):** from the
focus handle, re-locate the authored schema on the selected operation
(parameter by `(name,in)`, request media, response status/media/header), then
lazily expand local `$ref`s while building the tree. Do not rely on
`SchemaFocus.ref` alone (inline schemas have `ref: null`). Do not embed schema
graphs on the focus handle.

**Tree chrome (Jev `tree_shape` → `disclosure_tree`, confidence 1.0):** nested
objects/arrays render as a fact-rail / mono disclosure tree (Signal
`type-data` / `type-meta`, hairline borders, no cards/shadows). Composition
branches stay authored (`allOf`/`oneOf`/`anyOf` + discriminator metadata);
unsupported keywords appear under an expandable “unsupported semantics”
section.

**Examples (Jev `example_surface` → `rail_examples_panel`, confidence 0.75):**
the rail shows an Example panel from focus scalars (media precedence already
applied by #6). When media examples are absent, show schema-level
`example`/`examples` if present on the resolved schema root; otherwise the
existing empty copy. Never synthesize. `externalValue` is labeled text only.

**Decisive trade-off:** rewalk + resolve keeps `#6` handles stable and avoids
cycle/size risk on focus state. Cost: mapper complexity and a thin fixture for
rail scenarios that `#2` fixtures do not expose via operations.

**Reuse:** `resolveLocalRef`, `MAX_SCHEMA_DEPTH`, `isExternalRef`,
`decodePointerToken`, `summarizeSchema` / `hasRef` / `isRecord` helpers,
`ExampleValuePanel` / `formatExampleValue`, Petstore twin, `fref.json`,
`composition.json`, `schema-distinctions.json`, `examples.json`,
`operation-detail-bodies.json`, FSAFE strings, Signal utilities.

**Module layout:**

```
apps/redoc/src/domains/docs/
  api/
    schema-rail-model.ts           # SchemaRailModel + SchemaNode (plain VM)
  components/
    schema-rail.tsx                # Samples column root (empty / notices / tree / example)
    schema-tree-node.tsx           # recursive disclosure row
    schema-rail-example.tsx        # example panel (reuses formatExampleValue)
  __tests__/
    schema-rail.test.tsx           # Petstore + T14/T16–T19/T26 rail slices
apps/redoc/src/app/
  map-schema-rail.ts               # document + operation + focus → SchemaRailModel
  map-schema-node.ts               # unknown schema → SchemaNode (depth/cycle via resolveLocalRef)
  docs.tsx                         # replace focus stub with <SchemaRail model={…} />
  __tests__/
    map-schema-rail.test.ts        # real fixtures through parse → map
apps/redoc/src/domains/openapi/__tests__/fixtures/
  schema-rail-ops.json             # NEW — OAS 3.0 ops for T16 + T17 external ref
  schema-rail-ops-3.1.json         # NEW — OAS 3.1 null-union + boolean schema ops
```

No barrel `index.ts`. Production files ≤300 lines.

**Committed fixtures:**

| File | Role |
| --- | --- |
| `petstore-3.0.json` / docs twin | AC-1 local `#/components/schemas/...` (e.g. Pet) |
| `fref.json` | T17 shared local refs, `~0`/`~1`, recursion, dangling, wrong-kind |
| **new** `schema-rail-ops.json` | `openapi: 3.0.x` operations `$ref`ing T16 distinction shapes (nullable30, falsy literals, arrays, readOnly/writeOnly, additionalProperties); one media schema with external `$ref` URI; one bodyless 204 (T14 stale-clear) |
| **new** `schema-rail-ops-3.1.json` | `openapi: 3.1.x` operations exposing null-in-type unions, boolean schemas, and one schema carrying `$dynamicRef` and/or `$id` so the rail lists them under unsupportedKeywords / notices (T16 + T18 3.1 slice) — **required** |
| `composition.json` | T18 allOf/oneOf/anyOf, discriminator, unsupported keywords, callbacks/links flags |
| `examples.json` | T19 media/named/falsy/external |
| `operation-detail-bodies.json` | T14 media/status switching updates rail |
| FSAFE strings | T26 inert rail text |

Both new fixtures are hand-authored for issue #7; record SHA-256 in
`provenance.md`. Mirror the schema shapes from `schema-distinctions.json` /
`f31.json` via `$ref` or inline copies — do not invent types or requiredness.

## Interfaces / Schema

### View-model (docs-owned)

```ts
// domains/docs/api/schema-rail-model.ts

type SchemaRailModel = {
  /** Human title: e.g. "Request · application/json" / "Parameter limit (query)". */
  heading: string;
  notices: { code: string; message: string }[];
  root: SchemaNode | null;          // null → no schema (bodyless / missing)
  example: SchemaRailExample;
};

type SchemaRailExample =
  | { kind: "empty" }
  | { kind: "value"; value: unknown; source: "media" | "schema"; name: string | null }
  | { kind: "external"; url: string; name: string | null };

type SchemaNode =
  | {
      kind: "boundary";
      $ref: string;
      reason: "cycle" | "depth" | "dangling" | "external" | "wrong-kind";
      message: string;
    }
  | {
      kind: "boolean";
      value: boolean;
      description: string | null;
    }
  | {
      kind: "schema";
      /** Present when this node was entered through a local `$ref`. */
      viaRef: string | null;
      typeLabel: string;             // joined types, "object", "array", or "—"
      format: string | null;
      description: string | null;
      nullable30: boolean;           // OAS 3.0 `nullable: true`
      nullInType: boolean;           // 3.1 type array includes "null"
      requiredNames: string[];
      enumValues: unknown[] | null;
      defaultPresent: boolean;
      defaultValue: unknown;
      readOnly: boolean;
      writeOnly: boolean;
      properties: SchemaPropertyRow[];
      /** `true` → allowed; `false` → forbidden; schema object → nested node; absent → null */
      additionalProperties: "allowed" | "forbidden" | SchemaNode | null;
      items: SchemaNode | null;      // when type includes array / items present
      composition: SchemaComposition | null;
      discriminator: {
        propertyName: string;
        mapping: { name: string; $ref: string }[];
      } | null;
      /**
       * Keyword names present on the schema object that the rail does not
       * interpret beyond listing (e.g. `xml`, `not`, `$comment`, vendor `x-*`
       * beyond display). Always disclose; never silently drop.
       */
      unsupportedKeywords: string[];
      constraints: { name: string; value: string }[]; // min/max/pattern/… as authored
    };

type SchemaPropertyRow = {
  name: string;
  required: boolean;
  node: SchemaNode;
};

type SchemaComposition = {
  keyword: "allOf" | "oneOf" | "anyOf";
  branches: SchemaNode[];
};
```

Boolean JSON Schema (`true`/`false`) uses `kind: "boolean"`. Unresolved /
boundary results from `resolveLocalRef` map to `kind: "boundary"` (never throw).

### Mapper (app layer)

```ts
// app/map-schema-rail.ts
mapSchemaRail(
  document: NormalizedOpenApiDocument,
  operation: NormalizedOpenApiOperation | null,
  focus: SchemaFocus | null,
): SchemaRailModel | null
// null → empty Samples placeholder (no focus)

// app/map-schema-node.ts
mapSchemaNode(
  document: NormalizedOpenApiDocument,
  schema: unknown,
  depth: number,
  stack: ReadonlySet<string>,
): SchemaNode
```

**Rewalk rules:**

| Focus kind | Locate schema |
| --- | --- |
| `parameter` | Merged `operation.parameters` entry with matching `(name,in)`; if entry is `$ref`, `resolveLocalRef(..., expectedKind: "parameter")` then use `.schema` / first content media schema; if `in === "$ref"`, treat `name` as pointer |
| `request` | `operation.requestBody` (resolve body `$ref` if needed) → `content[mediaType].schema` |
| `response` + `headerName` | Response (resolve response `$ref`) → `headers[headerName].schema` (resolve header `$ref`) |
| `response` + media | Response → `content[mediaType].schema`; when `mediaType === null` / empty content → `root: null` |

After locating the schema value: if it is a `$ref` object, expand with
`resolveLocalRef(document, pointer, { expectedKind: "schema", depth })`. Nested
property/item/`additionalProperties`/`allOf` branch `$ref`s expand lazily inside
`mapSchemaNode` with the same depth/cycle rules (`MAX_SCHEMA_DEPTH`). Stack keys
are normalized JSON Pointer paths when entering via `$ref`; inline nodes use a
synthetic path only for depth counting, not cycle identity.

**`resolveLocalRef` document root:** pass the `NormalizedOpenApiDocument` value
produced by `parseOpenApiDocument` (it exposes `components` at the root, so
pointers `#/components/schemas|parameters|…` resolve). MVP local refs in fixtures
and Petstore are components-scoped; do **not** require a second raw
`OpenApiDocument` tree or `#/paths/...` pointer support in this issue. Parameter /
requestBody / response `$ref`s that target `#/components/...` use the same root
with the matching `expectedKind`.

**Example panel rules (T19):**

Media example presence on focus uses **key presence**, matching #6:

1. If `focus.kind` is `request` or `response` and
   `Object.hasOwn(focus, "exampleValue")` → `{ kind: "value", value:
   focus.exampleValue, source: "media", name: focus.exampleKey }` (preserves
   `false` / `0` / `""` / `null`).
2. Else if that focus has a non-null `externalValue` →
   `{ kind: "external", url: focus.externalValue, name: focus.exampleKey }`.
3. Else if resolved schema root has authored `example` (`Object.hasOwn`) or a
   first named `examples` entry with `value` → `source: "schema"`.
4. Else `{ kind: "empty" }`.
5. Never fetch `externalValue` / external `$ref`. Parameter focus shows schema
   tree only (parameter `example`/`examples` are not a T19 rail requirement).

**Heading:** derived from focus kind + keys (same information as today’s stub
label, slightly tighter prose).

### UI contract (Samples rail)

| State | Behavior |
| --- | --- |
| `model === null` | Existing placeholder: `Schemas and examples appear here.` |
| Notices | Mono `type-meta` list above the tree; local only — do not blank the whole rail |
| Boundary node | Visible `$ref` + reason message; siblings remain usable |
| Object/array | Disclosure (`<details>` or button+region) per property/item branch; required marker; mono type/format |
| Composition | Labeled branch list; discriminator property + mapping refs as meta rows |
| Unsupported keywords | Collapsed section titled with unsupported-semantics notice; keyword names listed; no silent drop |
| Example | Above or below tree; empty / value / external label; `pre.type-data` for JSON |
| Inert (T26) | React text only; ban `dangerouslySetInnerHTML`; zero `fetch` from docs components |
| Bodyless focus | `root: null` + empty example; clearing prior tree when focus switches to 204 |

Route `/docs`: keep `focus` state; compute
`mapSchemaRail(document, selectedOperation, focus)` and pass to `<SchemaRail />`.
Remove `focusStubLabel`.

## Failure modes and edge cases

| Case | Observable behavior |
| --- | --- |
| `focus === null` | Placeholder; no crash |
| `operation === null` with non-null focus | Treat as no focus (null model); do not rewalk |
| Bodyless response (204) | No schema tree; no stale prior body |
| Local Petstore `$ref` | Tree shows resolved Pet (and nested) properties |
| Recursive `$ref` | Boundary node with cycle reason; rest of tree usable |
| Depth > `MAX_SCHEMA_DEPTH` | Boundary with depth reason |
| Dangling / wrong-kind / external | Boundary + notice; unrelated rail content remains |
| Escaped `~0` / `~1` names | Resolve via `decodePointerToken` (covered by `fref` Escaped) |
| 3.0 `nullable` vs 3.1 null union | Distinct flags (`nullable30` / `nullInType`); no invented type |
| Boolean schema | `kind: "boolean"`; not coerced to object |
| Falsy enum/default/example | Shown, not treated as absent |
| `additionalProperties: false` / schema | Forbidden vs nested node |
| Unsupported keywords / callbacks/links | Disclosed; no flatten; no external fetch |
| FSAFE markup in description/example | Inert text; no script nodes; zero fetch |

## Acceptance criteria

- **AC-1:** Given Petstore bytes through `parseOpenApiDocument`, focusing a
  response/request whose schema is `#/components/schemas/Pet` (or equivalent
  Petstore component ref) renders a schema tree with Pet’s authored properties
  (at least `id` / `name` when present) — local refs resolve (issue + T17 shared
  ref slice).
- **AC-2:** Nested object and array schemas render as a disclosure mono tree
  (fact-rail pattern): parent rows expand to child property/item rows without
  dumping opaque JSON as the only representation.
- **AC-3:** When media or schema defines examples, the rail Example panel shows
  them (including `false`/`0`/`""`/`null`); media examples win over schema;
  `externalValue` is labeled without network I/O; absent → empty state (T19).
- **AC-4:** External / dangling / wrong-kind / cycle / depth `$ref` failures
  produce a visible boundary + notice and do not crash or blank unrelated rail
  content (`fref` + external op in `schema-rail-ops`) (T17).
- **AC-5:** Escaped pointer segments (`tilde~0key`, `slash~1key`) resolve to the
  authored component schemas in `fref` Escaped (T17).
- **AC-6:** Switching operation status/media (bodies fixture) updates the rail
  schema/example; focusing `204` clears prior body schema (T14).
- **AC-7:** Given `schema-rail-ops.json` and `schema-rail-ops-3.1.json` through
  production parse → map, the rail preserves 3.0 nullable vs 3.1 null unions,
  boolean schemas, enum/default/required/arrays/readOnly/writeOnly/
  additionalProperties distinctions without inventing types (T16).
- **AC-8:** `composition.json` shows allOf/oneOf/anyOf branches and
  discriminator metadata; unsupported keywords listed; no flattening; no
  external fetch (T18).
- **AC-9:** FSAFE strings in schema description / example stay inert text with
  zero `fetch` during rail render (T26).
- **AC-10:** `/docs` Samples region shows `SchemaRail` for a focused Petstore
  operation (stub label gone); empty focus keeps the placeholder.

## Acceptance evidence

| AC | Real input | Expected observable | Runnable check |
| --- | --- | --- | --- |
| AC-1 | Petstore | Resolved Pet properties in rail | `map-schema-rail.test.ts` + `schema-rail.test.tsx` |
| AC-2 | Petstore / bodies nested schema | Disclosure tree, not JSON-only | `schema-rail.test.tsx` |
| AC-3 | `examples.json` | Precedence, falsy, external label, empty | same + fetch spy |
| AC-4 | `fref.json` + `schema-rail-ops` external | Boundary + notice; no crash | `map-schema-rail.test.ts` |
| AC-5 | `fref` Escaped | tilde/slash keys resolve | same |
| AC-6 | `operation-detail-bodies.json` | Rail updates; 204 clears | `schema-rail.test.tsx` |
| AC-7 | `schema-rail-ops.json` + `schema-rail-ops-3.1.json` | Authored distinctions preserved | `map-schema-rail.test.ts` |
| AC-8 | `composition.json` | Branches + unsupported disclosure | same + UI test |
| AC-9 | FSAFE corpus in mapped fields | Inert; fetch count 0 | `schema-rail.test.tsx` |
| AC-10 | `dev-petstore-3.0.json` via `/docs` | SchemaRail replaces stub | `docs-route.test.tsx` |

Command: `bun run --filter @toolu-redoc/redoc test` and `bun run check`.

## Documentation impact

- `apps/redoc/src/domains/docs/README.md` — inventory `SchemaRail` + model.
- `apps/redoc/README.md` — Samples rail shows schemas/examples for focused
  operation detail.
- `apps/redoc/src/domains/openapi/__tests__/fixtures/provenance.md` — checksums
  for `schema-rail-ops.json` and `schema-rail-ops-3.1.json`.
- Spec/plan under `docs/toolu/` for this issue.

## Open Questions

None blocking. Resolved here:

1. **Domain → docs VM + app mapper** (Jev `docs_vm_app_map`).
2. **Tree → recursive disclosure mono fact-rail** (Jev `disclosure_tree`).
3. **Lookup → rewalk operation from SchemaFocus keys** (Jev `rewalk_operation`).
4. **Examples → rail panel; media over schema; no synthesize** (Jev
   `rail_examples_panel`).
5. **Security-requirement display → out of scope.**
6. **Required fixtures `schema-rail-ops.json` (3.0) and
   `schema-rail-ops-3.1.json` (3.1)** — one document cannot be both version
   families.
7. **Reuse `#2` `resolveLocalRef` / `MAX_SCHEMA_DEPTH`** against
   `NormalizedOpenApiDocument` as the components-capable root — no second
   resolver; no `#/paths/...` pointer requirement.
8. **`SchemaFocus` stays a handle** — no embedded schema graphs.
9. **Media example presence → `Object.hasOwn(focus, "exampleValue")`** so
   authored `null` is not treated as absent.
