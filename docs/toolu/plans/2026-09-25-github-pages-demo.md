# GitHub Pages rich demo — Plan

**Date:** 2026-09-25   **Status:** Approved   **Spec:** docs/toolu/specs/2026-09-25-github-pages-demo-design.md   **Topic:** Base-path build + example gallery + CI-gated GitHub Pages deploy for apps/redoc

## Evidence and approach

**Inspected**
- The approved spec.
- `apps/redoc/vite.config.ts`: no `base`.
- `src/main.tsx`: `createRouter` has no `basepath`.
- `build-share-href.ts` and its 3 tests.
- `share-operation-link.tsx`: already has an `origin?` injection prop. Precedent for the new `examplesOrigin?` prop.
- `spec-load-screen.tsx`: 271 lines, `max-lines` 300. Idle render is at lines 73–111. `runUrlLoad` is the path for Load URL.
- `spec-load-screen.test.tsx`: `SearchHarness` + `startFixtureHttpServer` pattern.
- `fixture-http-server.ts`: fixed routes only.
- `preview-smoke.ts`: probes `/` on port 4173; Petstore journey.
- `.github/workflows/ci.yml`.
- Guardrails:
  - file-size scans only `src/`;
  - jscpd scans only `src/`;
  - `.oxfmtignore`;
  - knip workspace config;
  - `tsconfig` includes `vite.config.ts`.

**Verified during brainstorm and spec**
- Redocly Museum `openapi.yaml` parses `ok` (8 operations).
  - Upstream commit `2770b2b2e59832d245c7b0eb0badf6568d7efb53`, MIT, "Copyright (c) 2023 Redocly Inc".
  - SHA-256 `2d88e96a1860382fa86e15af892c50d95ae81d53324ac9b07aa9e6a72a8974aa`.
- `oxfmt --check` flags the upstream Museum bytes.
- actionlint runs via `docker run -i rhysd/actionlint:latest … -` (stdin; the volume mount cannot see `/Volumes`).
- TanStack `basepath` rewrites input and output (context7).

**Outcome:** a single `REDOC_BASE_PATH` build variable drives:
- Vite `base`;
- the router `basepath`;
- share hrefs and example hrefs, via `import.meta.env.BASE_URL`.

An always-on gallery of four same-origin example specs loads through `runUrlLoad`. `build:pages` assembles the exact Pages artifact. CI smokes both builds. `pages.yml` deploys only after a green CI push to `main` from this repository.

**Constraints**
- `max-lines` 300.
- Function size: 50 lines (`.ts`), 80 lines (`.tsx`).
- No barrels. Kebab-case filenames.
- Colocated `__tests__`.
- Real bytes only; no mocks for HTTP or parse.
- The Cloudflare build output at `/` must stay unchanged.

**Jev:** no plan-stage semantic classification changes step handling. Every step's handling follows directly from the approved spec and the repository gates.

## Workstream summary

base path → share href → example assets + manifest → gallery UI → Pages build script → smoke (both builds) → workflows → enable Pages → docs → full gate.

## Steps (machine-readable)

```json
[
  {
    "id": "base-path",
    "title": "Add resolveBasePath util + test; wire vite.config base and router basepath",
    "ac_refs": [
      "AC-1"
    ],
    "paths": [
      "apps/redoc/index.html",
      "apps/redoc/package.json",
      "apps/redoc/public",
      "apps/redoc/src",
      "apps/redoc/src/main.tsx",
      "apps/redoc/src/utilities/README.md",
      "apps/redoc/src/utilities/__tests__/resolve-base-path.test.ts",
      "apps/redoc/src/utilities/resolve-base-path.ts",
      "apps/redoc/vite.config.ts"
    ],
    "input": "Valid bases '/', '/toolu-redoc/', '/a/b/'; undefined and '' → '/'; invalid 'toolu-redoc', '/toolu-redoc', '/../x/', '/a b/' throw naming the value; real vite builds with and without REDOC_BASE_PATH plus an invalid one",
    "check": "cd apps/redoc && bunx vitest run src/utilities/__tests__/resolve-base-path.test.ts && REDOC_BASE_PATH=/toolu-redoc/ bunx vite build --logLevel error && grep -q 'src=\"/toolu-redoc/assets/' dist/index.html && bunx vite build --logLevel error && grep -q 'src=\"/assets/' dist/index.html && if REDOC_BASE_PATH=toolu-redoc bunx vite build >/tmp/redoc-bad-base.log 2>&1; then exit 1; fi && grep -qF 'REDOC_BASE_PATH' /tmp/redoc-bad-base.log && grep -qF '\"toolu-redoc\"' /tmp/redoc-bad-base.log",
    "model": "sonnet"
  },
  {
    "id": "share-href-base",
    "title": "Extend buildShareHref with normalized basePath; ShareOperationLink passes import.meta.env.BASE_URL",
    "ac_refs": [
      "AC-3"
    ],
    "depends_on": [
      "base-path"
    ],
    "paths": [
      "apps/redoc/src/domains/openapi/api/build-share-href.ts",
      "apps/redoc/src/domains/openapi/api/__tests__/build-share-href.test.ts",
      "apps/redoc/src/domains/openapi/components/share-operation-link.tsx",
      "apps/redoc/src/domains/openapi/components/__tests__/share-operation-link.test.tsx"
    ],
    "input": "Origin 'https://falconiere.github.io' + url 'https://falconiere.github.io/toolu-redoc/examples/petstore-3.0.json' + op encodeOperationIdentity('get','/pet/findByStatus') with basePath '/toolu-redoc/' and 'toolu-redoc'; existing three cases with basePath omitted stay byte-identical",
    "check": "cd apps/redoc && bunx vitest run src/domains/openapi/api/__tests__/build-share-href.test.ts src/domains/openapi/components/__tests__/share-operation-link.test.tsx",
    "model": "sonnet"
  },
  {
    "id": "example-assets",
    "title": "Add public/examples (2 Petstore copies, pinned Museum 3.1, authored feature tour), NOTICE.md, .oxfmtignore entry, EXAMPLE_SPECS manifest + exampleSpecHref, and example-specs test",
    "ac_refs": [
      "AC-5",
      "AC-6"
    ],
    "paths": [
      ".oxfmtignore",
      "apps/redoc/public/examples/NOTICE.md",
      "apps/redoc/public/examples/feature-tour-3.1.yaml",
      "apps/redoc/public/examples/museum-3.1.yaml",
      "apps/redoc/public/examples/petstore-3.0.json",
      "apps/redoc/public/examples/petstore-3.0.yaml",
      "apps/redoc/src/domains/openapi/api/__tests__/example-specs.test.ts",
      "apps/redoc/src/domains/openapi/api/example-specs.ts",
      "apps/redoc/src/domains/openapi/api/openapi-limits.ts",
      "apps/redoc/src/domains/openapi/api/parse-openapi-document.ts"
    ],
    "input": "Committed example bytes: Petstore copied from __tests__/fixtures; Museum fetched from raw.githubusercontent.com/Redocly/museum-openapi-example/2770b2b2e59832d245c7b0eb0badf6568d7efb53/openapi.yaml; authored feature tour. Boundaries: size ≤ MAX_INPUT_BYTES; title/version mismatch detection; NOTICE hash drift detection; feature-tour presence of deprecated op, discriminator.mapping ≥2, self $ref, webhooks-present notice, type array with 'null'",
    "check": "cd apps/redoc && bunx vitest run src/domains/openapi/api/__tests__/example-specs.test.ts && test \"$(shasum -a 256 public/examples/museum-3.1.yaml | cut -d' ' -f1)\" = 2d88e96a1860382fa86e15af892c50d95ae81d53324ac9b07aa9e6a72a8974aa && bun run fmt:check",
    "model": "sonnet"
  },
  {
    "id": "gallery-ui",
    "title": "Add SpecExampleGallery + fixture-server /examples route; render gallery on idle SpecLoadScreen via runUrlLoad with examplesOrigin prop",
    "ac_refs": [
      "AC-4"
    ],
    "depends_on": [
      "share-href-base",
      "example-assets"
    ],
    "paths": [
      "apps/redoc/public/examples",
      "apps/redoc/src/domains/openapi/README.md",
      "apps/redoc/src/domains/openapi/__tests__/fixture-http-server.ts",
      "apps/redoc/src/domains/openapi/api/build-share-href.ts",
      "apps/redoc/src/domains/openapi/api/example-specs.ts",
      "apps/redoc/src/domains/openapi/components/__tests__/spec-example-gallery.test.tsx",
      "apps/redoc/src/domains/openapi/components/spec-example-gallery.tsx",
      "apps/redoc/src/domains/openapi/screens/__tests__/spec-load-screen.test.tsx",
      "apps/redoc/src/domains/openapi/screens/spec-load-screen.tsx"
    ],
    "input": "Real public/examples bytes served by startFixtureHttpServer GET /examples/museum-3.1.yaml; SearchHarness with examplesOrigin = fixture baseUrl. Boundaries: modifier (ctrl/meta) click not intercepted; loaded state hides gallery; Reset shows it again; GET /examples/not-listed.yaml → 404",
    "check": "cd apps/redoc && bunx vitest run src/domains/openapi/components/__tests__/spec-example-gallery.test.tsx src/domains/openapi/screens/__tests__/spec-load-screen.test.tsx && bunx oxlint --deny-warnings src/domains/openapi",
    "model": "sonnet"
  },
  {
    "id": "pages-build-script",
    "title": "Add apps/redoc build:pages script producing the exact Pages artifact",
    "ac_refs": [
      "AC-8",
      "AC-1"
    ],
    "depends_on": [
      "base-path",
      "example-assets"
    ],
    "paths": [
      "apps/redoc/index.html",
      "apps/redoc/package.json",
      "apps/redoc/public",
      "apps/redoc/public/examples/NOTICE.md",
      "apps/redoc/src",
      "apps/redoc/vite.config.ts"
    ],
    "input": "Real build with REDOC_BASE_PATH=/toolu-redoc/",
    "check": "cd apps/redoc && REDOC_BASE_PATH=/toolu-redoc/ bun run build:pages && grep -q '/toolu-redoc/assets/' dist/index.html && cmp dist/index.html dist/404.html && test -f dist/.nojekyll && for f in petstore-3.0.json petstore-3.0.yaml museum-3.1.yaml feature-tour-3.1.yaml NOTICE.md; do test -f dist/examples/$f || exit 1; done",
    "model": "sonnet"
  },
  {
    "id": "preview-smoke-base",
    "title": "Extend preview-smoke: base-aware probe/preview; when REDOC_BASE_PATH ≠ '/' run the gallery journey (window marker survives Museum click, url param = same-origin example href, filter+select op, share href prefix http://127.0.0.1:4173/toolu-redoc/?url=, reload = direct /toolu-redoc/?url=&op= deep-link load restoring heading AND selected operation detail, /toolu-redoc/docs Petstore heading); root journey unchanged",
    "ac_refs": [
      "AC-2",
      "AC-7"
    ],
    "depends_on": [
      "gallery-ui",
      "pages-build-script"
    ],
    "paths": [
      "apps/redoc/index.html",
      "apps/redoc/package.json",
      "apps/redoc/public",
      "apps/redoc/src",
      "apps/redoc/src/domains/openapi/__tests__/preview-smoke.ts",
      "apps/redoc/src/domains/openapi/components/spec-example-gallery.tsx",
      "apps/redoc/src/domains/openapi/screens/spec-load-screen.tsx",
      "apps/redoc/src/utilities/resolve-base-path.ts",
      "apps/redoc/vite.config.ts"
    ],
    "input": "Real Chromium against real dist/ builds: root build + fixture Petstore URL; base build (/toolu-redoc/) + same-origin public/examples/museum-3.1.yaml via gallery click; /toolu-redoc/docs deep path",
    "check": "cd apps/redoc && bun run build && bun run test:preview-smoke && REDOC_BASE_PATH=/toolu-redoc/ bun run build:pages && REDOC_BASE_PATH=/toolu-redoc/ bun run test:preview-smoke",
    "model": "sonnet"
  },
  {
    "id": "workflows",
    "title": "ci.yml: add build:pages + base-path smoke after root smoke; add pages.yml (workflow_run CI main + guarded if, dispatch on default branch, pages permissions, concurrency, build:pages, upload-pages-artifact, deploy-pages)",
    "ac_refs": [
      "AC-7",
      "AC-8"
    ],
    "depends_on": [
      "preview-smoke-base"
    ],
    "paths": [
      ".github/workflows/ci.yml",
      ".github/workflows/pages.yml"
    ],
    "input": "Committed workflow files linted by actionlint 1.7.12 (docker, stdin)",
    "check": "for f in .github/workflows/ci.yml .github/workflows/pages.yml; do docker run --rm -i rhysd/actionlint:latest -no-color -stdin-filename \"$f\" - < \"$f\" || exit 1; done && grep -qF \"workflow_run.event == 'push'\" .github/workflows/pages.yml && grep -qF 'head_repository.full_name == github.repository' .github/workflows/pages.yml && grep -qF 'repository.default_branch' .github/workflows/pages.yml && grep -qF \"workflow_run.conclusion == 'success'\" .github/workflows/pages.yml && grep -qF 'build:pages' .github/workflows/pages.yml && grep -qF 'REDOC_BASE_PATH' .github/workflows/ci.yml",
    "model": "sonnet"
  },
  {
    "id": "enable-pages",
    "title": "One-time: enable GitHub Pages with build_type=workflow (repo setting; nothing is published until pages.yml runs on main)",
    "ac_refs": [
      "AC-8"
    ],
    "depends_on": [
      "workflows"
    ],
    "paths": [
      ".github/workflows/pages.yml"
    ],
    "input": "Live GitHub API for Falconiere/toolu-redoc",
    "check": "test \"$(gh api repos/Falconiere/toolu-redoc/pages --jq .build_type)\" = workflow",
    "model": "haiku"
  },
  {
    "id": "docs",
    "title": "Docs: root README live-demo badge/link + gallery feature; apps/redoc/README Live demo section (URL, REDOC_BASE_PATH, build:pages, pages.yml CI gate, one-time enable, /docs 404 caveat), gallery note, layout + workflows rows, doubled smoke; AGENTS.md repo map; openapi README",
    "ac_refs": [
      "AC-9"
    ],
    "depends_on": [
      "workflows"
    ],
    "paths": [
      "README.md",
      "apps/redoc/README.md",
      "apps/redoc/AGENTS.md",
      "apps/redoc/src/domains/openapi/README.md"
    ],
    "input": "Final README/AGENTS text",
    "check": "grep -qF 'https://falconiere.github.io/toolu-redoc/' README.md && grep -qiF 'live demo' README.md && grep -qF 'https://falconiere.github.io/toolu-redoc/' apps/redoc/README.md && grep -qF 'REDOC_BASE_PATH' apps/redoc/README.md && grep -qF 'build:pages' apps/redoc/README.md && grep -qF 'pages.yml' apps/redoc/README.md && grep -qF '404' apps/redoc/README.md && grep -qF 'public/examples' apps/redoc/README.md && grep -qF 'public/examples' apps/redoc/AGENTS.md",
    "model": "sonnet"
  },
  {
    "id": "full-gate",
    "title": "Full workspace quality gate + both production builds",
    "ac_refs": [
      "AC-1",
      "AC-2",
      "AC-3",
      "AC-4",
      "AC-5",
      "AC-6",
      "AC-7",
      "AC-8",
      "AC-9"
    ],
    "depends_on": [
      "base-path",
      "share-href-base",
      "example-assets",
      "gallery-ui",
      "pages-build-script",
      "preview-smoke-base",
      "workflows",
      "enable-pages",
      "docs"
    ],
    "paths": [
      "apps/redoc",
      "README.md",
      ".github/workflows",
      ".oxfmtignore",
      "knip.json"
    ],
    "input": "Entire workspace",
    "check": "bun run check && bun run --filter @toolu-redoc/redoc build",
    "model": "sonnet"
  }
]
```

## Critical files

Create:
- `apps/redoc/src/utilities/resolve-base-path.ts`
- `apps/redoc/src/utilities/__tests__/resolve-base-path.test.ts`
- `apps/redoc/public/examples/{petstore-3.0.json,petstore-3.0.yaml,museum-3.1.yaml,feature-tour-3.1.yaml,NOTICE.md}`
- `apps/redoc/src/domains/openapi/api/example-specs.ts`
- `apps/redoc/src/domains/openapi/api/__tests__/example-specs.test.ts`
- `apps/redoc/src/domains/openapi/components/spec-example-gallery.tsx`
- `apps/redoc/src/domains/openapi/components/__tests__/spec-example-gallery.test.tsx`
- `.github/workflows/pages.yml`

Modify:
- `apps/redoc/vite.config.ts`
- `apps/redoc/src/main.tsx`
- `apps/redoc/package.json`
- `apps/redoc/src/domains/openapi/api/build-share-href.ts` + its test
- `apps/redoc/src/domains/openapi/components/share-operation-link.tsx`
- `apps/redoc/src/domains/openapi/screens/spec-load-screen.tsx` + its test
- `apps/redoc/src/domains/openapi/__tests__/fixture-http-server.ts`
- `apps/redoc/src/domains/openapi/__tests__/preview-smoke.ts`
- `.github/workflows/ci.yml`
- `.oxfmtignore`
- `README.md`
- `apps/redoc/README.md`
- `apps/redoc/AGENTS.md`
- `apps/redoc/src/domains/openapi/README.md`
- `apps/redoc/src/utilities/README.md`

## Verification

**End-to-end, real data**
- Root build: the Petstore smoke passes unchanged.
- `REDOC_BASE_PATH=/toolu-redoc/ build:pages` build, in real Chromium:
  - clicking the Museum gallery item loads it with no document navigation;
  - the `url` param equals the same-origin example href;
  - the share href keeps `/toolu-redoc/`;
  - reload restores the heading and `op`;
  - `/toolu-redoc/docs` renders.

**Failure and boundary checks**
- Invalid `REDOC_BASE_PATH` fails the build and names the value.
- An unslashed `basePath` gets normalized.
- A non-manifest example path returns 404.
- A modifier click falls through to the browser.
- NOTICE hash drift and manifest title/version mismatches fail the tests.
- The workflow guards reject failed, `pull_request`, foreign-repo, and non-default-branch dispatch runs.

**Delivery**
- Scoped commits on `demo`.
- `bash "$TOOLU_LIB/plan-ledger.sh" run docs/toolu/plans/2026-09-25-github-pages-demo.md --verify`.
- `toolu-review:review`.
- `verdict.sh status` reports `overall: ready`.
- Push, then open a PR to `main`, then `pr-babysit:babysit`.
- Prerequisites: `gh api user` succeeds (verified: `Falconiere`); the branch is not the default branch (`demo`); the toolu, toolu-review, and pr-babysit skills are installed.

**Post-merge (outside delivery, per spec):** live Pages checks.
- `gh run list --workflow pages.yml`
- `curl -sI` on the live URL
- The Museum SHA of the live file
- An agent-browser snapshot of the gallery and `/docs`

**Docs**
- The `docs` step greps for the README and AGENTS surfaces.
- `bun run check` covers format, structure, and knip across the new files.

## Deviations

- **CI base path:** `ci.yml` sets `REDOC_BASE_PATH=/${{ github.event.repository.name }}/`, the same expression `pages.yml` uses, instead of a literal `/toolu-redoc/`. For this repo the value is identical, and it stays correct in forks.
- **`SpecLoadScreen`:**
  - Adding the gallery pushed the function to 91 lines, over the 80-line `.tsx` limit. The URL-load closure moved into a module-level `bindUrlLoad` helper, now shared by **Load URL** and the gallery, and the props are destructured in the body.
  - A gallery click does not call `setUrlField`. The URL field follows `search.url` through the existing `useSyncUrlField`.
- **Preview smoke:** journeys now `throw` instead of calling `fail()`. `fail()` calls `process.exit()`, which skipped `main`'s `finally` and left `vite preview` running on port 4173 after a failure; that is what turned the first stamp red. The mutation re-run confirmed 0 listeners after a failure.
- **Feature tour trimmed:** the `guardrails --hook` file-size check applies the 300 code-line ceiling to any edited file, including `public/`. The tour dropped a redundant sandbox server and a header parameter to land at 296 lines.
- **`pages.yml` versions:** `actions/upload-pages-artifact@v5` (set `include-hidden-files: true` so `.nojekyll` ships) and `actions/deploy-pages@v5`, the current majors. `actions/checkout@v4` and `oven-sh/setup-bun@v2` match `ci.yml`.
