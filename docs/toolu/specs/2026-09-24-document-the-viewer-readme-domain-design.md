# Document the viewer (README, domain map, load journey) — Design

**Date:** 2026-09-24   **Status:** Approved   **Author:** epic-worker (issue #9)   **Topic:** User/agent docs for run → load → browse → share, domain maps, out-of-scope, CI frontend build + preview smoke (T27 / AC-8)

## Problem

The MVP viewer path is implemented (#2–#8), but agent- and user-facing docs still
leave gaps that cause invented features and incomplete AC-8 evidence: no single
Out-of-scope list for Try-it-out / hosted platform, incomplete fixture-server and
CORS lifetime guidance, `openapi` README still marks T06 / Workers SPA harness as
blocked-on-#9, and CI builds only `apps/api` — not the redoc production bundle —
so T27 cannot claim “CI includes frontend build” or production route/reload.

## Non-Goals

1. Re-implementing parse, load, shell, nav, detail, Samples rail, or deep links.
2. Full T06 distinct-origin browser CORS matrix (honest docs + paste recovery
   guidance only; browser opaque errors stay non-diagnostic).
3. Full Playwright Workers-runtime SPA matrix beyond a lean preview smoke.
4. Security-requirement display, Try it out / request execution, credentials,
   hosted documents, Swagger 2, remote `$ref` fetch, file upload.
5. Closing the epic (orchestrator merges; other ACs already owned by #2–#8).
6. Changing share encoding (`url` / `op`) or product behavior except docs, CI,
   and the preview-smoke harness required for T27.

## Architecture

**Chosen approach (Jev `browser_acceptance_scope` → `ci_preview_smoke`,
confidence 0.95; `out_of_scope_section_home` → `redoc_readme_primary`,
confidence 0.89; CI frontend build decided yes from epic AC-8/T27 text —
Jev noul 0.60 leans true, epic wording is decisive):** treat #9 as a
**docs + verification** slice. Primary product docs live in
`apps/redoc/README.md` (run/build, load flows, routes, limits, out-of-scope,
fixture-server lifecycle, T27 journey). Domain maps stay in
`src/domains/README.md`, `openapi/README.md`, and `docs/README.md`. AGENTS.md
gets a one-line Out-of-scope pointer. CI gains an `apps/redoc` production
`vite build` step plus a noninteractive preview smoke that serves `dist/`,
loads `/`, exercises URL-load → filter → select → share against the existing
fixture HTTP server (or paste path), and checks SPA deep-link reload for a
known path.

**Decisive trade-off:** ship a lean Chromium/Playwright (or equivalent
headless) smoke against `vite preview` rather than claiming Vitest/RTL alone
satisfies “production route/reload,” and rather than a full T06/Workers matrix
that would dominate a documentation issue.

**Reuse:**

| Piece | Path |
| --- | --- |
| Load / share contract | `apps/redoc/README.md` (existing sections) + `#3`/`#8` specs |
| Fixture HTTP server | `domains/openapi/__tests__/fixture-http-server.ts` |
| Fixtures + provenance | `domains/openapi/__tests__/fixtures/` + `provenance.md` |
| Domain inventories | `domains/*/README.md` |
| SPA deploy config | `apps/redoc/wrangler.jsonc` (`not_found_handling: single-page-application`) |
| Existing viewer tests | Vitest suites under `domains/**/__tests__` and `app/__tests__` |

**Doc ownership map:**

| Surface | Owns |
| --- | --- |
| `apps/redoc/README.md` | Quick start, load paste/URL, `/` vs `/docs`, share params, limits/CORS/paste lifetime, Out of scope, fixture-server lifecycle, T27 command journey, scripts/CI |
| `apps/redoc/AGENTS.md` | Repo map + one-line Out-of-scope → README pointer; domain map line stays accurate |
| `src/domains/README.md` | Domain inventory table |
| `src/domains/openapi/README.md` | Models, parse/load APIs, screens, fixtures, share contract; clear #9 harness notes |
| `src/domains/docs/README.md` | Shell / nav / detail / Samples inventory; `/` vs `/docs` roles |
| `src/api/README.md` | Touch only if http-client pointer is stale |
| Root `README.md` | One-line pointer that redoc viewer docs live in `apps/redoc/README.md` |
| `.github/workflows/ci.yml` | Redoc production build + preview-smoke step |
| `apps/redoc/scripts/` (new) | Noninteractive preview smoke entry |

## Interfaces / Schema

### README Out of scope (required list)

Must state MVP does **not** include:

- Try it out / executing requests described by the spec
- Credential entry, OAuth, or authentication flows
- Hosted document platform / Turso persistence / backend proxy for specs
- Spec editing, linting, Swagger 2 conversion
- Remote `$ref` / external example URL fetch
- Generated SDK / code samples
- Optional security-requirement display (deferred; not accepted for MVP)

### Documented load journey (commands)

README must list a reproducible sequence equivalent to:

```bash
bun install
bun run --filter @toolu-redoc/redoc check   # or bun run check at root
bun run --filter @toolu-redoc/redoc build
bun run --filter @toolu-redoc/redoc preview # or documented smoke script
```

Plus interactive: `dev` → paste Petstore / `/?url=` → filter → select → share copy.

### Preview smoke contract (pinned)

| Field | Value |
| --- | --- |
| Entrypoint | `apps/redoc/src/domains/openapi/__tests__/preview-smoke.ts` |
| npm script | `@toolu-redoc/redoc` → `test:preview-smoke` → `bun run src/domains/openapi/__tests__/preview-smoke.ts` |
| Driver | `playwright` (devDependency); Chromium only |
| CI browser install | `bunx playwright install --with-deps chromium` before smoke |
| Fixture bytes | `apps/redoc/src/domains/openapi/__tests__/fixtures/petstore-3.0.json` |
| Fixture SHA-256 | `246cfe6eaa556e39a38fe6be1bb5c29573dbde34ddb13313b3054afc0a7e3413` |
| Fixture HTTP route | `startFixtureHttpServer()` → `GET {baseUrl}/fixtures/petstore.json` |
| Expected title text | `Swagger Petstore - OpenAPI 3.0` (from fixture `info.title`) |
| Filter query | `findByStatus` (narrows to known Petstore ops) |
| Selected identity | method `get`, path `/pet/findByStatus` → `op` search param via `encodeOperationIdentity` |

| Step | Observable |
| --- | --- |
| Build | Prior CI/step `vite build` left `apps/redoc/dist/index.html`; smoke refuses to start if missing |
| Serve | `vite preview --host 127.0.0.1 --port 0` (ephemeral); record bound port |
| Fixture | `startFixtureHttpServer`; close in `finally` |
| Load | Chromium opens `http://127.0.0.1:<preview>/?url=<encodeURIComponent(fixturePetstoreHref)>`; page shows expected title text |
| Filter/select | Type filter `findByStatus`; click the `GET /pet/findByStatus` row; URL search contains matching `op` |
| Share | Control labeled for share/copy is visible after selection |
| Reload | `page.reload()` on the same query-bearing URL; title text still present (SPA shell + restore) |

Smoke uses production `dist/` only (no Vite dev). Any assertion failure exits nonzero.
Do not skip when Chromium is missing — install fails the job.

### CI additions

```yaml
- name: Build (apps/redoc production)
  run: bun run --filter @toolu-redoc/redoc build

- name: Install Chromium (Playwright)
  run: bunx playwright install --with-deps chromium

- name: Preview smoke (apps/redoc T27)
  run: bun run --filter @toolu-redoc/redoc test:preview-smoke
```

Order: existing member checks → redoc production build → Playwright Chromium
install → preview smoke. Smoke depends on `dist/`.

### Domain README completeness (openapi)

Must list, at minimum: Zod models/schemas, `parseOpenApiDocument`,
`loadOpenApiDocument`, normalize/nav/filter/identity helpers, screens
(`SpecLoadScreen`), post-load toolbar/share, fixtures + `fixture-http-server`
lifecycle (start/close in tests; smoke reuses same helper).

## Failure modes and edge cases

| Input / situation | Observable docs or smoke behavior |
| --- | --- |
| Stale “Hello from Toolu Redoc” | Must be absent from shipped prose (already gone; AC verifies) |
| Agent invents Try it out | Out-of-scope section + AGENTS pointer block invention |
| CORS / opaque network error | README: paste recovery; do not claim browser-diagnosed CORS |
| Paste session / share | Document: bytes never in URL; paste cannot deep-link `url`; share discloses query/`url` limitation |
| Smoke without Chromium | `playwright install` fails the job; no `test.skip` |
| Preview port busy | Bind `--port 0`; no hard-coded 4173-only |
| Fixture server leak | `close()` in `finally` even on assertion failure |
| Missing `dist/` | Smoke exits nonzero with a message to run `build` first |
| Fixture HTTP 404 | Load fails visibly; smoke fails (does not fall back to paste) |
| Zero viewer tests | README states `bun run --filter @toolu-redoc/redoc test` must stay nonempty; existing suites already satisfy |

## Acceptance criteria

- **AC-1:** Given the commands listed under “Documented load journey” in
  `apps/redoc/README.md` run from a clean install of this worktree, each
  command exits 0 and the README’s load → filter → select → share steps name
  the same `/` search params (`url`, `op`) the app implements.
- **AC-2:** Given `apps/redoc/README.md`, a reader finds paste and URL load
  instructions, `/?url=` + `op` share docs, `/` vs `/docs`, URL/CORS/limits,
  paste/link lifetime, fixture-server lifecycle, and an Out of scope list that
  includes both “Try it out” and “hosted” platform (or equivalent wording).
- **AC-3:** Given `src/domains/openapi/README.md`, the inventory lists Zod
  models/schemas, `parseOpenApiDocument`, `loadOpenApiDocument`,
  `SpecLoadScreen`, and fixture-server start/close lifecycle; it does not claim
  T06 full CORS matrix or Workers SPA harness remain blocked on #9.
- **AC-4:** Given `src/domains/docs/README.md` and `src/domains/README.md`,
  shell/nav/detail/Samples and domain ownership match the tree; `rg "Hello from
  Toolu Redoc" apps/redoc` returns no matches.
- **AC-5:** Given `.github/workflows/ci.yml`, a PR to `main` runs
  `bun run --filter @toolu-redoc/redoc build` as a named step.
- **AC-6 (T27):** Given production `apps/redoc/dist/` and fixture
  `petstore-3.0.json` (SHA-256 above) served at `/fixtures/petstore.json`,
  `bun run --filter @toolu-redoc/redoc test:preview-smoke` shows title
  `Swagger Petstore - OpenAPI 3.0`, accepts filter `findByStatus`, selects
  `GET /pet/findByStatus` so `op` is in the URL, shows share UI, and after
  `reload()` the title remains visible.
- **AC-7:** Given `apps/redoc/AGENTS.md` and root `README.md`, each points
  readers to `apps/redoc/README.md` for viewer Out of scope / load journey
  (AGENTS: one-line pointer; root: one-line apps list note).

## Acceptance evidence

| AC | Real input / fixture | Expected result | Boundary | Check |
| --- | --- | --- | --- | --- |
| AC-1 | README command block + clean `bun install` | Exit 0; `url`/`op` prose matches `spec-source-search` | Wrong param names → fail review | Run commands + diff against `spec-source-search.ts` |
| AC-2 | `apps/redoc/README.md` | Required sections + Out of scope strings | Missing Try it out → fail | `rg` for section headings / Out of scope phrases |
| AC-3 | `openapi/README.md` | Models/parse/screen/lifecycle; no stale #9 blocker | Leftover “blocked-on-#9” for delivered harness → fail | `rg` + review |
| AC-4 | domain READMEs + tree | Accurate map; zero Hello matches | Stale home domain → fail | `rg "Hello from Toolu Redoc" apps/redoc`; review tables |
| AC-5 | `ci.yml` | Redoc build step present | Api-only build remains insufficient | Workflow diff + CI log |
| AC-6 | Petstore SHA + fixture HTTP + `dist/` | Title, filter, `op`, share, post-reload title | Missing Chromium / dist → nonzero | `test:preview-smoke` |
| AC-7 | AGENTS.md + root README | Pointers present | Orphan AGENTS with no Out-of-scope → fail | `rg` pointer phrases |

## Documentation impact

Primary delivery of this issue: `apps/redoc/README.md`, `AGENTS.md` pointer,
`src/domains/{README,openapi/README,docs/README}.md`, root README pointer,
toolu spec/plan under `docs/toolu/`, CI workflow, and smoke script docs in
package.json scripts table.

## Open Questions

None blocking. Resolved decisions:

1. **Headless driver** — Playwright + Chromium (`playwright` devDependency;
   `bunx playwright install --with-deps chromium` in CI).
2. **T06 full CORS matrix** — out of scope; README honest network/paste guidance only.
3. **Workers `wrangler dev` smoke** — not required for T27; `vite preview` +
   reload on query URL is the production-bundle proof; wrangler stays deploy docs.
