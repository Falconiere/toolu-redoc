# Spec load UX (URL fetch + paste) — Plan

**Date:** 2026-09-24   **Status:** Approved   **Spec:** docs/toolu/specs/2026-09-24-spec-load-ux-design.md   **Topic:** HTTP client + openapi load path + Signal SpecLoadScreen on `/`

## Evidence and approach

Inspected approved spec, merged #2 (`parseOpenApiDocument`, `openapi-limits`, Petstore fixtures, `operation-identity`), empty `utilities/` + `api/` inventories, missing `http.ts` / `http-client.ts`, `no-bare-fetch` exemptions, domain isolation (only `app/**` imports domains), scaffold `HomeScreen`, Signal §9 in `docs/design-language.md`, and issue #8 ownership of `op` selection.

**Outcome:** Paste and URL loads produce a retained `NormalizedOpenApiDocument` via production parse; `/` shows Signal load UI; `?url=` auto-loads; `op` pass-through; real fixture HTTP server proves T05–T09/T23 load subsets; docs + `bun run check` green.

**Approach (Jev → `http_then_load_then_ui`):** configured HTTP stack → fixture server harness → URL validate/fetch/byte-bound → `loadOpenApiDocument` → `useSpecLoad` latest-wins → `SpecLoadScreen` + search coerce → delete `home` → docs/gate.

**Constraints:** max-lines 300; no barrels; no bare `fetch` in domains; no MSW as substitute for HTTP evidence; credentials omitted; reuse `MAX_INPUT_BYTES` / `FETCH_TIMEOUT_MS`; T06 browser CORS matrix and T20–T22 op UI blocked on #8/#9 (not marked pass).

**Knip:** screen imported from `app/index.tsx`; load API imported from screen/hook/tests. Delete unused `home` domain.

**AC coverage:** every spec `AC-1`…`AC-12` and `AC-1b` appears in at least one ledger `ac_refs`.

## Workstream summary

http client → fixture server → validate/fetch/load API → hook concurrency → SpecLoadScreen + search → remove home → docs → full gate.

## Steps (machine-readable)

```json
[
  {
    "id": "http-client",
    "title": "Add utilities/http.ts and configured api/http-client.ts (credentials omit, timeout/abort helpers)",
    "ac_refs": ["AC-7", "AC-12"],
    "paths": [
      "apps/redoc/src/utilities/http.ts",
      "apps/redoc/src/api/http-client.ts",
      "apps/redoc/src/utilities/README.md",
      "apps/redoc/src/api/README.md",
      "apps/redoc/src/utilities/__tests__/http.test.ts"
    ],
    "input": "Request to a listening ephemeral local server (created in this step or shared with fixture-server) asserting credentials omit; closed-port / aborted request yields typed network or abort error",
    "check": "bun run --filter @toolu-redoc/redoc test",
    "model": "sonnet"
  },
  {
    "id": "fixture-server",
    "title": "Add Vitest fixture HTTP server helper serving Petstore bytes, MIME variants, redirect, 404/500/HTML, delay, stream size",
    "depends_on": ["http-client"],
    "ac_refs": ["AC-2", "AC-3", "AC-5", "AC-10"],
    "paths": [
      "apps/redoc/src/domains/openapi/__tests__/fixture-http-server.ts",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/petstore-3.0.json",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/fbad-html-login.html"
    ],
    "input": "Committed Petstore JSON + new HTML login fixture bytes; server binds ephemeral port",
    "check": "bun run --filter @toolu-redoc/redoc test",
    "model": "sonnet"
  },
  {
    "id": "validate-url",
    "title": "Implement validate-spec-source-url (http/https only, reject userinfo and other schemes)",
    "depends_on": ["http-client"],
    "ac_refs": ["AC-7"],
    "paths": [
      "apps/redoc/src/domains/openapi/api/validate-spec-source-url.ts",
      "apps/redoc/src/domains/openapi/api/__tests__/validate-spec-source-url.test.ts"
    ],
    "input": "https://example.com/a.json; http://127.0.0.1/x; https://user:pass@h/x; file:///etc/passwd; data:text/plain,hi",
    "check": "bun run --filter @toolu-redoc/redoc test",
    "model": "haiku"
  },
  {
    "id": "fetch-text",
    "title": "Implement fetch-openapi-text via http-client with byte cap, timeout abort, redirect final URL, html sniff",
    "depends_on": ["fixture-server", "validate-url"],
    "ac_refs": ["AC-2", "AC-3", "AC-4", "AC-7", "AC-10"],
    "paths": [
      "apps/redoc/src/domains/openapi/api/fetch-openapi-text.ts",
      "apps/redoc/src/domains/openapi/api/spec-load-error.ts",
      "apps/redoc/src/domains/openapi/api/__tests__/fetch-openapi-text.test.ts",
      "apps/redoc/src/api/http-client.ts",
      "apps/redoc/src/domains/openapi/api/openapi-limits.ts"
    ],
    "input": "Fixture server: JSON MIME, text/plain, redirect, 404, 500, HTML 200, oversize stream without Content-Length, abort mid-stream cancel (no partial success text)",
    "check": "bun run --filter @toolu-redoc/redoc test",
    "model": "sonnet"
  },
  {
    "id": "load-api",
    "title": "Implement loadOpenApiDocument paste|url → parse; map network/mixed-content messages; recovery paste",
    "depends_on": ["fetch-text"],
    "ac_refs": ["AC-1", "AC-2", "AC-3", "AC-4", "AC-7"],
    "paths": [
      "apps/redoc/src/domains/openapi/api/load-openapi-document.ts",
      "apps/redoc/src/domains/openapi/api/network-error-message.ts",
      "apps/redoc/src/domains/openapi/api/parse-openapi-document.ts",
      "apps/redoc/src/domains/openapi/api/openapi-limits.ts",
      "apps/redoc/src/domains/openapi/api/__tests__/load-openapi-document.test.ts",
      "apps/redoc/src/domains/openapi/api/__tests__/network-error-message.test.ts"
    ],
    "input": "petstore-3.0.json paste; empty paste; MAX_INPUT_BYTES+1 paste; fixture-server URL; injected TypeError network; assert load issues only the source URL (no ref/example/API op fetches)",
    "check": "bun run --filter @toolu-redoc/redoc test",
    "model": "sonnet"
  },
  {
    "id": "load-hook",
    "title": "Implement useSpecLoad latest-wins, cancel, retain-last-success, reset (no Web Storage)",
    "depends_on": ["load-api"],
    "ac_refs": ["AC-5", "AC-6", "AC-7"],
    "paths": [
      "apps/redoc/src/domains/openapi/hooks/use-spec-load.ts",
      "apps/redoc/src/domains/openapi/hooks/__tests__/use-spec-load.test.tsx",
      "apps/redoc/src/domains/openapi/api/openapi-limits.ts"
    ],
    "input": "Fixture-server delayed A vs fast B; cancel pending; FETCH_TIMEOUT_MS timeout; fail replacement; reset; localStorage spy",
    "check": "bun run --filter @toolu-redoc/redoc test",
    "model": "sonnet"
  },
  {
    "id": "search-params",
    "title": "Add per-field validateSpecLoadSearch + wire Route validateSearch on /",
    "depends_on": ["load-hook"],
    "ac_refs": ["AC-8", "AC-9"],
    "paths": [
      "apps/redoc/src/domains/openapi/api/spec-source-search.ts",
      "apps/redoc/src/domains/openapi/api/__tests__/spec-source-search.test.ts",
      "apps/redoc/src/app/index.tsx"
    ],
    "input": "Non-string/oversize url/op → undefined; valid url+op pair round-trip",
    "check": "bun run --filter @toolu-redoc/redoc test",
    "model": "haiku"
  },
  {
    "id": "spec-load-screen",
    "title": "Build SpecLoadScreen Signal UI; auto-load ?url=; preserve op; missing-source banner; delete home domain",
    "depends_on": ["search-params"],
    "ac_refs": ["AC-1b", "AC-4", "AC-8", "AC-9", "AC-11", "AC-12"],
    "paths": [
      "apps/redoc/src/domains/openapi/screens/spec-load-screen.tsx",
      "apps/redoc/src/domains/openapi/components/spec-load-banner.tsx",
      "apps/redoc/src/domains/openapi/screens/__tests__/spec-load-screen.test.tsx",
      "apps/redoc/src/app/index.tsx",
      "apps/redoc/src/domains/home/screens/home-screen.tsx",
      "apps/redoc/src/domains/home/screens/integration-status.ts",
      "apps/redoc/src/domains/home/README.md"
    ],
    "input": "RTL: Petstore paste success panel; network failure banner; HTML url; ?url=&op= preserve; op-only missing source",
    "check": "bun run --filter @toolu-redoc/redoc test",
    "model": "sonnet"
  },
  {
    "id": "docs-gate",
    "title": "Update openapi/api/utilities/domains READMEs, AGENTS, product README load journey; run full bun run check",
    "depends_on": ["spec-load-screen"],
    "ac_refs": ["AC-12"],
    "paths": [
      "apps/redoc/src/domains/openapi/README.md",
      "apps/redoc/src/domains/README.md",
      "apps/redoc/src/api/README.md",
      "apps/redoc/src/utilities/README.md",
      "apps/redoc/AGENTS.md",
      "apps/redoc/README.md",
      "apps/redoc/src/domains/openapi/__tests__/fixtures/provenance.md",
      "docs/toolu/specs/2026-09-24-spec-load-ux-design.md",
      "docs/toolu/plans/2026-09-24-spec-load-ux.md"
    ],
    "input": "Doc inventory matches shipped public load entry + share params; list blocked T06/T20-T22",
    "check": "bun run check",
    "model": "haiku"
  },
  {
    "id": "deliver",
    "title": "Rebase on origin/main, push branch, open PR, babysit to ready",
    "depends_on": ["docs-gate"],
    "ac_refs": ["AC-12"],
    "paths": [
      "apps/redoc/src/**",
      "docs/toolu/**"
    ],
    "input": "Green gate + PR body starts with Closes Falconiere/toolu-redoc#3 and Part of Falconiere/toolu-redoc#1 with verification evidence",
    "check": "git status -sb && gh pr view --json number,url,statusCheckRollup",
    "model": "sonnet"
  }
]
```

## Critical files

| Action | Path |
| --- | --- |
| Create | `apps/redoc/src/utilities/http.ts` |
| Create | `apps/redoc/src/api/http-client.ts` |
| Create | `apps/redoc/src/domains/openapi/api/{validate-spec-source-url,fetch-openapi-text,load-openapi-document,spec-load-error,network-error-message,spec-source-search}.ts` |
| Create | `apps/redoc/src/domains/openapi/hooks/use-spec-load.ts` |
| Create | `apps/redoc/src/domains/openapi/screens/spec-load-screen.tsx` |
| Create | `apps/redoc/src/domains/openapi/__tests__/fixture-http-server.ts` |
| Modify | `apps/redoc/src/app/index.tsx` |
| Delete | `apps/redoc/src/domains/home/**` |
| Update | READMEs / `AGENTS.md` / provenance note |

## Verification

1. Every AC-1…AC-12 and AC-1b has real fixture or generated boundary input and automated assertions (API, hook, and/or RTL as mapped).
2. `bun run --filter @toolu-redoc/redoc test` then `bun run check` must pass (structure, knip without home, no-bare-fetch, types, lint, fmt, tests).
3. Failure/network cases assert structured codes + honest messages (never “CORS confirmed”); latest-wins / retain-last-success / reset covered.
4. Docs list load entry, share params (`url`/`op`), and blocked T06/T20–T22 dependencies in the same change.
5. Commit on `feat/3-spec-load-ux-url-fetch` (authorized epic worker). PR targets `main`, conventional title, body starts with `Closes Falconiere/toolu-redoc#3` and `Part of Falconiere/toolu-redoc#1`, then `/pr-babysit:babysit` to ready — do not merge.
6. Manual `dev` paste spot-check is optional and not a substitute for automated ACs.
