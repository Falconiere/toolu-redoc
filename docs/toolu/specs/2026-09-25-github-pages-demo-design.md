# GitHub Pages rich demo — Design

**Date:** 2026-09-25   **Status:** Approved   **Author:** Falconiere Barbosa   **Topic:** Publish the real redoc viewer on GitHub Pages under the repo subpath, with a one-click gallery of same-origin example specs and a CI-gated deploy

## Problem

The repository has an open-source landing README but no live demo. A visitor cannot try
the viewer without cloning, installing Bun, and running Vite. Pasting a third-party URL is
also a poor first run: many public specs fail on CORS or mixed content. That makes the
first impression an error banner.

GitHub Pages is free for this public repo, but it serves the site under a subpath
(`https://falconiere.github.io/toolu-redoc/`) and has no SPA fallback. The app assumes it
runs at `/`: Vite has no `base`, the router has no `basepath`, and `buildShareHref`
(`apps/redoc/src/domains/openapi/api/build-share-href.ts:10`) always emits `origin + "/?…"`.
Deploying the bundle unchanged would load broken assets and copy share links that drop
`/toolu-redoc/`.

## Non-Goals

1. A separate marketing site, landing page, screenshots, or feature tour outside the app.
2. A custom domain or DNS changes.
3. Changing the Cloudflare Workers deploy. It keeps building at `/` with identical output.
4. Switching to hash history or changing the share-link shape (`?url=…&op=…`).
5. Try it out, a CORS proxy, remote `$ref` fetch, or any other redoc Out-of-scope item.
6. Removing or reworking the temporary `/docs` Petstore playground.
7. Fetching example specs live from third parties at runtime. Every example is a pinned,
   committed copy.
8. Crawler/SEO correctness for deep paths. `/docs` on Pages is served by `404.html` with
   HTTP 404.

## Architecture

**Chosen approach:** build the existing app with a configurable base path, publish the
bundle to GitHub Pages from a workflow gated on green CI, and add an always-on gallery of
bundled example specs to the idle load screen. Gallery items load through the same URL
path as **Load URL**. Because the examples are same-origin, CORS cannot fail them, and
share links stay reproducible.

**Decisive trade-offs (Jev-informed):**

- **Subpath build over hash history** (Jev `routing` → subpath, p=1.0). This keeps the
  share-link format and the Cloudflare build unchanged. The cost is a `404.html` copy for
  direct deep paths.
- **Real app plus gallery over a separate landing page** (Jev `scope` → A, p=1.0). This is
  the least new surface, and a landing page can still be layered on later.
- **Gallery always on** (Jev `gallery` → always, p=0.56, weak). One behavior, no build
  flag. It is reversible by gating the manifest later (see Open Questions).
- **Real specs plus one authored feature-tour spec** (Jev `tour_spec`, p=0.98). The two
  real specs do not show composition, discriminator, `$ref` cycles, deprecated operations,
  or falsy examples.
- **Deploy gated on CI via `workflow_run`** (Jev `deploy_gate`, p=0.93). A red `main`
  never publishes. The base-path smoke runs inside `ci.yml`, so the gate covers it.

**One base-path source:** the build env var `REDOC_BASE_PATH` (default `/`) is read in
`vite.config.ts` as `base`. Everything at runtime derives from Vite's
`import.meta.env.BASE_URL`: the router `basepath`, share hrefs, and example hrefs. The
Cloudflare build sets nothing, so `BASE_URL === "/"`.

**Reuse:**

| Piece | Path |
| --- | --- |
| URL load path (claim, navigate, load, latest-wins) | `runUrlLoad` in `domains/openapi/screens/spec-load-screen.tsx` |
| Parse and limits | `parseOpenApiDocument`, `MAX_INPUT_BYTES` (`domains/openapi/api/`) |
| Share href | `buildShareHref` (extended, not replaced) |
| Petstore bytes and provenance | `domains/openapi/__tests__/fixtures/petstore-3.0.{json,yaml}` + `provenance.md` |
| Preview smoke harness | `domains/openapi/__tests__/preview-smoke.ts` |
| Signal styling | `docs/design-language.md` (list/link roles; no new icon library) |

**Module layout:**

```
apps/redoc/
  vite.config.ts                              # base ← resolveBasePath(REDOC_BASE_PATH)
  public/examples/
    petstore-3.0.json                         # copy of committed fixture (Apache-2.0)
    petstore-3.0.yaml                         # copy of committed fixture (Apache-2.0)
    museum-3.1.yaml                           # Redocly Museum API 1.2.1 (MIT), pinned
    feature-tour-3.1.yaml                     # authored showcase
    NOTICE.md                                 # provenance + licences + SHA-256 (ships in dist)
  package.json                                # + "build:pages" script (single Pages artifact recipe)
  src/main.tsx                                # createRouter({ basepath: import.meta.env.BASE_URL })
  src/utilities/resolve-base-path.ts          # pure validator shared by vite.config + tests
  src/domains/openapi/
    api/example-specs.ts                      # typed manifest + exampleSpecHref()
    api/build-share-href.ts                   # + basePath parameter
    components/spec-example-gallery.tsx       # idle-screen gallery list
    components/share-operation-link.tsx       # passes BASE_URL
    screens/spec-load-screen.tsx              # renders gallery when idle
    __tests__/preview-smoke.ts                # honours REDOC_BASE_PATH; gallery journey
    __tests__/fixture-http-server.ts          # + GET /examples/<manifest file> from public/examples
.oxfmtignore                                  # + apps/redoc/public/examples/** (pinned bytes)
.github/workflows/
  ci.yml                                      # + base-path build and smoke
  pages.yml                                   # workflow_run(CI, main, success) → deploy
```

## Interfaces / Schema

```ts
// src/utilities/resolve-base-path.ts (imported by vite.config.ts via relative path)
// undefined | "" → "/"; otherwise must match /^\/([A-Za-z0-9._-]+\/)*$/ with no ".." segment,
// else throws Error naming the bad value.
export function resolveBasePath(raw: string | undefined): string;

// vite.config.ts: throws at config load if the value is invalid.
base: resolveBasePath(process.env.REDOC_BASE_PATH)

// src/main.tsx
createRouter({ routeTree, basepath: import.meta.env.BASE_URL, /* existing opts */ })

// domains/openapi/api/build-share-href.ts
export function buildShareHref(
  origin: string,          // browser origin, no path; trailing "/" tolerated
  search: SpecLoadSearch,
  basePath: string = "/",  // Vite BASE_URL; normalized to leading + trailing "/"
): string                  // `${origin}${basePath}` or `${origin}${basePath}?url=…&op=…`

// domains/openapi/api/example-specs.ts
export type ExampleSpec = {
  id: string;                     // stable kebab id, e.g. "museum-3.1"
  title: string;                  // must equal parsed info.title
  file: string;                   // basename under public/examples/
  format: "json" | "yaml";
  openapi: "3.0" | "3.1";         // must equal parsed openapi major.minor
  blurb: string;                  // one line: what this example shows
};
export const EXAMPLE_SPECS: readonly ExampleSpec[];   // order = display order
export function exampleSpecHref(spec: ExampleSpec, origin: string, basePath: string): string;
// → absolute `${origin}${basePath}examples/${spec.file}`

// domains/openapi/components/spec-example-gallery.tsx
export type SpecExampleGalleryProps = {
  specs: readonly ExampleSpec[];
  origin: string;
  basePath: string;
  onLoadExample: (href: string) => void;   // plain click → runUrlLoad(href, …)
};
// Each item: <a href={buildShareHref(origin, { url: exampleHref }, basePath)}>.
// Plain primary click: preventDefault + onLoadExample(exampleHref).
// Modifier/middle click: browser default (new tab with the full share href).
```

**Manifest (display order):**

| id | title | file | openapi | shows |
| --- | --- | --- | --- | --- |
| `petstore-3.0-json` | Swagger Petstore - OpenAPI 3.0 | `petstore-3.0.json` | 3.0 | Canonical 3.0, 19 ops, tags |
| `petstore-3.0-yaml` | Swagger Petstore - OpenAPI 3.0 | `petstore-3.0.yaml` | 3.0 | Same document from YAML |
| `museum-3.1` | Redocly Museum API | `museum-3.1.yaml` | 3.1 | Real 3.1: webhooks, examples, tags |
| `feature-tour-3.1` | Toolu Redoc Feature Tour | `feature-tour-3.1.yaml` | 3.1 | oneOf + discriminator, allOf, local `$ref` cycle, deprecated op, path+op params, multi-media body, falsy examples, null unions, op servers, webhook |

**`apps/redoc/package.json` script (single Pages artifact recipe):**
`"build:pages": "vite build && cp dist/index.html dist/404.html && touch dist/.nojekyll"`.
The caller supplies `REDOC_BASE_PATH`. `pages.yml`, the CI base-path smoke, and local
verification all run this one script.

**`.oxfmtignore`:** add `apps/redoc/public/examples/**`. Example bytes stay identical to
their upstream or committed sources, so the NOTICE hashes can be checked against upstream.
Verified: `oxfmt --check` flags the upstream `museum.yaml`.

**Fixture server:** `startFixtureHttpServer` serves `GET /examples/<file>` from
`apps/redoc/public/examples/`. Only files named in `EXAMPLE_SPECS` are served (any other
file returns 404), with the same CORS headers as the existing routes.

**Preview smoke:** reads `REDOC_BASE_PATH` through `resolveBasePath`, probes
`${PREVIEW_ORIGIN}${base}` for readiness, and picks its journey from the base:
- `/`: the current Petstore fixture-URL journey.
- anything else: the gallery journey.

**`.github/workflows/pages.yml` contract:**

- `on: workflow_run: { workflows: [CI], types: [completed], branches: [main] }` plus
  `workflow_dispatch`.
- The deploy job runs only when one of these holds:
  - `github.event_name == 'workflow_dispatch'` and
    `github.ref == format('refs/heads/{0}', github.event.repository.default_branch)`; or
  - all of: `github.event.workflow_run.conclusion == 'success'`,
    `github.event.workflow_run.event == 'push'`, and
    `github.event.workflow_run.head_repository.full_name == github.repository`.
- Reason: the `workflow_run` `branches` filter matches `head_branch`. Without these guards,
  a fork PR whose branch is named `main` could get its commit deployed.
- A manual `workflow_dispatch` from any other branch is skipped by the same `if:`. It does
  not rely on the environment's branch rules.
- Checkout `ref: ${{ github.event.workflow_run.head_sha || github.sha }}`.
- `permissions: { contents: read, pages: write, id-token: write }`.
- `concurrency: { group: pages, cancel-in-progress: false }`.
- Build step: set `REDOC_BASE_PATH=/${{ github.event.repository.name }}/`, then run
  `bun run --filter @toolu-redoc/redoc build:pages`.
- Then `actions/upload-pages-artifact` with path `apps/redoc/dist`, and
  `actions/deploy-pages` in environment `github-pages`.

**`ci.yml` additions (after the existing root smoke):** run `build:pages` with
`REDOC_BASE_PATH=/toolu-redoc/`, then `test:preview-smoke` with the same env. The smoke
script spawns `vite preview`, which reads the same config.

**Repo setting (one time, during execution):**
`gh api -X POST repos/Falconiere/toolu-redoc/pages -f build_type=workflow`.

## Failure modes and edge cases

| Case | Observable behavior | Handling |
| --- | --- | --- |
| `REDOC_BASE_PATH` unset or `""` | `base: "/"`; build byte-identical in asset paths to today | Default |
| `REDOC_BASE_PATH` missing leading/trailing `/` or has `..`/spaces | `vite build` fails at config load, naming the bad value | Propagates, fails the build |
| `basePath` passed to `buildShareHref` without slashes (`"toolu-redoc"`) | Normalized to `/toolu-redoc/` | Converted |
| Router `basepath: "/"` (Cloudflare) | No rewrite; current routing unchanged | Identity |
| Direct hit `/toolu-redoc/docs` on Pages | `404.html` (copy of index) boots the SPA and renders `/docs`, with HTTP status 404 | Accepted (Non-Goal 8) |
| Unknown path under base | Existing router not-found behavior | Unchanged |
| Example fetch fails (offline, Pages outage) | Existing URL network-error banner with paste recovery. No new copy. | Recovered by existing path |
| Gallery click while another load is in flight | Latest load wins (existing `useSpecLoad` semantics) | Existing path |
| Gallery modifier or middle click | New tab opens the full share href, which auto-loads | Browser default |
| Gallery after a successful load | Not rendered (loaded viewer replaces load chrome); back after **Reset** | By design |
| Manifest entry whose file is missing, too big, fails to parse, or has a title/version mismatch | Unit test fails in CI, so deploy is blocked | Propagates to gate |
| NOTICE SHA-256 drifts from file bytes (e.g. oxfmt reformat) | Unit test fails | Propagates to gate |
| CI fails or runs on a non-`main` branch | `pages.yml` job skipped; nothing published | Gated |
| Fork PR whose head branch is named `main` passes CI | `workflow_run.event` is `pull_request` and the head repo differs, so the job is skipped | Gated (security) |
| Fixture server asked for a non-manifest file under `/examples/` | 404 | Converted |
| Two `main` pushes back to back | Deploys queue in the `pages` group; the latest finishes last | Serialized |
| Pages not enabled | `deploy-pages` fails with the GitHub error | One-time enable step (Interfaces) |
| Repo renamed or forked | Base derives from `github.event.repository.name` | Automatic |
| Paste-only session on Pages | Existing paste disclosure; share link is `${origin}/toolu-redoc/?op=…` | Unchanged semantics |

## Acceptance criteria

- **AC-1:** Building with `REDOC_BASE_PATH=/toolu-redoc/` produces a `dist/index.html`
  whose script/style URLs start with `/toolu-redoc/assets/`. Building with the var unset
  produces URLs starting with `/assets/`. An invalid value (`toolu-redoc`) fails the build
  with a message naming the value.
- **AC-2:** In a base-path build served by `vite preview`,
  `/toolu-redoc/?url=<same-origin museum href>&op=<identity>` renders the heading
  "Redocly Museum API" with that operation selected. `/toolu-redoc/docs` renders the
  Petstore playground heading.
- **AC-3:**
  `buildShareHref("https://falconiere.github.io", { url: U, op: O }, "/toolu-redoc/")`
  returns `https://falconiere.github.io/toolu-redoc/?url=<enc U>&op=<enc O>`. `basePath`
  `"toolu-redoc"` gives the same result. With `basePath` omitted, the outputs are identical
  to the current tests.
- **AC-4:** On the idle load screen, the gallery lists the four manifest entries in order,
  each with its title, format, OpenAPI version, and blurb. Each item's `href` is the share
  href that embeds `${origin}${BASE_URL}examples/<file>`. A plain click on "Redocly Museum
  API" loads that spec, shows its heading, and sets the `url` search param, all without a
  document navigation. After **Reset**, the gallery shows again.
- **AC-5:** Every `EXAMPLE_SPECS` entry's file exists in `apps/redoc/public/examples/`, is at
  most `MAX_INPUT_BYTES`, and parses `ok` with `parseOpenApiDocument`. Its parsed
  `info.title` and `openapi` major.minor equal the manifest, and it has at least one
  operation. The parsed feature tour must also have:
  - an operation with `deprecated === true`;
  - a `components.schemas` entry whose `discriminator.mapping` has two or more keys;
  - a `components.schemas` entry with a property `$ref` pointing back to that same schema;
  - a notice with code `webhooks-present`;
  - a schema whose `type` array includes `"null"`.
- **AC-6:** `public/examples/NOTICE.md` has one row per example file with source URL,
  retrieval date, licence (Apache-2.0, MIT with its copyright line, or "authored, repo
  licence"), and SHA-256. A test asserts each row's hash equals the SHA-256 of the
  committed file bytes.
- **AC-7:** CI runs the preview smoke twice.
  - **Root build:** the existing Petstore journey passes unchanged.
  - **`REDOC_BASE_PATH=/toolu-redoc/`:** open `http://127.0.0.1:4173/toolu-redoc/`, set a
    `window` marker, then click the Museum gallery item. Check all of these:
    - the heading shows;
    - the marker survives, so there was no document navigation;
    - the `url` search param equals `http://127.0.0.1:4173/toolu-redoc/examples/museum-3.1.yaml`;
    - after filtering and selecting an operation, the share href starts with
      `http://127.0.0.1:4173/toolu-redoc/?url=`;
    - after reload, the heading and `op` are restored;
    - `http://127.0.0.1:4173/toolu-redoc/docs` renders the Petstore playground heading.
- **AC-8:** `pages.yml` passes `actionlint` with zero findings. Its deploy-job `if:` requires
  either `workflow_dispatch` on the default branch, or all three of: a successful CI conclusion, a `push`
  event, and the same head repository. Running `REDOC_BASE_PATH=/toolu-redoc/ bun run
  build:pages` locally produces all of the following in `dist/`:
  - `index.html` with `/toolu-redoc/assets/` URLs;
  - a `404.html` byte-identical to `index.html`;
  - `.nojekyll`;
  - `examples/` holding the four manifest files plus `NOTICE.md`.
- **AC-9:** The root `README.md` shows a Live demo link and badge to the Pages URL.
  `apps/redoc/README.md` documents:
  - the gallery;
  - `REDOC_BASE_PATH`;
  - the Pages deploy and its CI gate;
  - the `/docs` 404-status caveat.

## Acceptance evidence

| AC | Real input / fixture | Expected observable | Boundary / failure case | Runnable check |
| --- | --- | --- | --- | --- |
| AC-1 | Real `vite build` of apps/redoc | Asset URL prefixes in `dist/index.html` | Unset var; invalid `toolu-redoc` | Vitest `src/utilities/__tests__/resolve-base-path.test.ts` valid/invalid table, plus CI builds (root and base) and `grep -c '/toolu-redoc/assets/' dist/index.html` in the plan's verify step |
| AC-2 | Base-path `dist/` + committed `museum-3.1.yaml` | Museum heading + selected op; `/docs` heading | Deep path under base | `REDOC_BASE_PATH=/toolu-redoc/ bun run test:preview-smoke` (extended) |
| AC-3 | Literal Pages origin + Petstore identity | Exact href strings | Unslashed base; omitted base | `build-share-href.test.ts` (extended; existing cases untouched) |
| AC-4 | `SpecLoadScreen` in jsdom, fetching real `public/examples` bytes from `fixture-http-server` `/examples/<file>` (new route) | 4 items in manifest order, each showing its title, format, OpenAPI version, and blurb, with `href` equal to `buildShareHref(origin, { url: exampleSpecHref(…) }, BASE_URL)`; museum heading after click; `onSourceUrlChange` called with example href; gallery back after Reset | Modifier click not intercepted; loaded state hides gallery; non-manifest file 404 | `spec-example-gallery.test.tsx` + `spec-load-screen.test.tsx` addition. The `url`-param and no-document-navigation observables are asserted in the real browser by AC-7 (base-path smoke) |
| AC-5 | The four committed example files | `ok`, matching title/version, ≥1 op; tour feature presence | Size bound; mismatch detection | `example-specs.test.ts` |
| AC-6 | `NOTICE.md` + committed example bytes | Hash equality per row | Missing row; drifted bytes | `example-specs.test.ts` (NOTICE block) |
| AC-7 | Real Chromium against both `dist/` builds | `preview-smoke: ok` twice | Base-path share href prefix; reload restore | CI `ci.yml` steps; locally `bun run build && bun run test:preview-smoke` then same with `REDOC_BASE_PATH=/toolu-redoc/` |
| AC-8 | Committed `pages.yml`; real `build:pages` output | actionlint exit 0; `dist/404.html` equals `index.html`; `.nojekyll` and `examples/` present | Guard expression rejects failed, `pull_request`, foreign-repo, and non-default-branch dispatch runs | `grep -F "workflow_run.event == 'push'"` and `grep -F 'head_repository.full_name == github.repository'` and `grep -F 'repository.default_branch'` on `pages.yml`, then `docker run --rm -i rhysd/actionlint:latest -no-color -stdin-filename .github/workflows/pages.yml - < .github/workflows/pages.yml`, then (from `apps/redoc`) `REDOC_BASE_PATH=/toolu-redoc/ bun run build:pages && grep -q '/toolu-redoc/assets/' dist/index.html && cmp dist/index.html dist/404.html && test -f dist/.nojekyll && for f in petstore-3.0.json petstore-3.0.yaml museum-3.1.yaml feature-tour-3.1.yaml NOTICE.md; do test -f dist/examples/$f; done` (each command must exit 0) |
| AC-9 | README files | Link + badge + sections present | None | Review in PR; `grep` for the Pages URL in both READMEs |

### Post-merge verification (outside delivery)

Delivery ends at the PR, and the deploy runs only from `main`. After merge, check the live
site:
1. One-time Pages enable, if it has not been done already.
2. `gh run list --workflow pages.yml` shows a successful deploy.
3. `curl -sI https://falconiere.github.io/toolu-redoc/` returns 200.
4. The live `…/examples/museum-3.1.yaml` bytes hash to the NOTICE SHA-256.
5. An agent-browser snapshot shows the gallery, and `/toolu-redoc/docs` renders.

## Documentation impact

- `README.md` (root): Live demo badge and link near the title; a Quick start line
  pointing at the demo; one sentence on the example gallery under Features.
- `apps/redoc/README.md`:
  - a "Live demo (GitHub Pages)" section covering the URL, `REDOC_BASE_PATH`, `build:pages`,
    `pages.yml` and its CI gate, the one-time Pages enable, and the `/docs` 404-status
    caveat;
  - a gallery note in "Loading an OpenAPI document";
  - `public/examples/` in the Project layout table;
  - `pages.yml` in the workflows row;
  - the doubled smoke in the T27 journey.
- `apps/redoc/AGENTS.md`: add `public/examples/` and the manifest to the repo map.
- `apps/redoc/public/examples/NOTICE.md`: new file with provenance and licences. It ships
  in `dist`, which satisfies MIT/Apache attribution.

## Open Questions

1. **Gallery on the Cloudflare deploy too?** Owner: Falconiere. **Non-blocking.** The
   default is always on; Jev's lean was weak (0.56). Reverse it by gating `EXAMPLE_SPECS`
   behind a `VITE_` flag.
2. **Custom domain for the demo later?** Owner: Falconiere. **Non-blocking.**
   `REDOC_BASE_PATH=/` plus a `CNAME` file would be enough.
