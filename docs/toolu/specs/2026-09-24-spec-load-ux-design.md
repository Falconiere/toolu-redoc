# Spec load UX (URL fetch + paste) — Design

**Date:** 2026-09-24   **Status:** Approved   **Author:** epic-worker (issue #3)   **Topic:** Signal-styled home load screen that pastes or fetches OpenAPI text, parses via #2, and retains a loaded model for the docs viewer

## Problem

The redoc `/` route is still a placeholder. Developers cannot paste or fetch an OpenAPI document into the viewer. Without a load path that uses the configured HTTP client, reuses `parseOpenApiDocument`, and surfaces loading / validation / network failures in Signal empty/banner patterns, every downstream docs UI issue has no entry point.

## Non-Goals

1. Three-region docs chrome, operation detail, schema rail, sidebar filter, or Back/Forward operation selection (#4–#8).
2. Swagger 2 conversion, external `$ref` fetch, remote example fetch, or request execution / credentials.
3. Playwright / Workers browser harness ownership (#9). Full browser-enforced CORS proof is blocked on that harness; this issue ships message-mapping + real Node/Bun fixture-server evidence.
4. Hosted document persistence, Turso, logging of pasted bodies / query strings, or storing full document bytes in the URL.
5. Effective security-requirement display (optional epic feature; not accepted).
6. Inventing a second parser or calling bare `fetch` from domain code.

## Architecture

**Chosen approach:** Own load orchestration and the Signal load screen inside `domains/openapi` (same domain as parse). Thin `/` route renders `SpecLoadScreen`. Introduce the missing configured HTTP stack (`utilities/http.ts` + `api/http-client.ts`) so URL loads never use bare `fetch` in domain code. Paste and URL paths both end at `parseOpenApiDocument`; URL path streams/reads body bytes with `MAX_INPUT_BYTES` and aborts at `FETCH_TIMEOUT_MS`.

**Decisive trade-off (Jev `domain_home` → `openapi_screen`):** put the screen under `openapi` rather than `home`, because domain isolation forbids `home` importing `openapi`. Cost: remove the unused scaffold `home` domain so knip stays green. Routes stay thin; only `app/index.tsx` imports the screen.

**Share-link scope (Jev `share_scope` → `encode_plus_source_url`):** specify the source/operation URL encoding contract now; implement auto-load from a search param carrying the remote source URL; defer operation key selection, history, filter, and paste-pending-op restore UI to #8. Still handle absent/failed/disallowed source recoverably.

**Evidence (Jev `cors_evidence` → `node_server_plus_message_map`):** Vitest starts a real fixture HTTP server; production `http` client hits it. CORS/mixed-content honesty is a typed network-error → guidance map (never claim a diagnosis the browser cannot expose). Record full cross-origin browser CORS as blocked-on-#9.

**Reuse:**

| Piece | Path |
| --- | --- |
| Parse | `@/domains/openapi/api/parse-openapi-document` |
| Limits | `MAX_INPUT_BYTES`, `FETCH_TIMEOUT_MS` from `openapi-limits.ts` |
| Operation identity (for #8 contract) | `encodeOperationIdentity` / `decodeOperationIdentity` |
| Fixtures | `domains/openapi/__tests__/fixtures/` (Petstore + provenance) |
| Signal Banner / Empty / Loading | `docs/design-language.md` §9 — implement with Tailwind utilities on this screen (no new icon library) |
| HTTP | new `src/utilities/http.ts` (client impl) + `src/api/http-client.ts` (app-configured instance: no credentials, timeout wiring) |

**Module layout:**

```
apps/redoc/src/
  utilities/http.ts                 # bare-fetch-exempt client primitive
  api/http-client.ts                # configured `http` export (omit credentials)
  domains/openapi/
    api/
      validate-spec-source-url.ts   # scheme/userinfo gate
      fetch-openapi-text.ts         # http + byte bound + abort/timeout
      load-openapi-document.ts      # paste | url → parse → LoadResult
      spec-source-search.ts         # encode/decode `url` (+ reserved `op`) search params
    hooks/
      use-spec-load.ts              # latest-wins, cancel, retain-last-success
    screens/
      spec-load-screen.tsx          # Signal paste + URL form + states
    components/                     # banner / empty / field pieces as needed
    __tests__/
      fixture-http-server.ts        # real Node/Bun server for T05–T09/T23 load subset
      load-openapi-document.test.ts
      …
  app/index.tsx                     # Route → SpecLoadScreen only
```

Remove `domains/home/**` once `/` no longer references it.

## Interfaces / Schema

### Public load API

```ts
type SpecSource =
  | { kind: "paste"; text: string }
  | { kind: "url"; href: string } // validated absolute URL string

type SpecLoadErrorCode =
  | OpenApiParseErrorCode
  | "disallowed_url"   // non-http(s), userinfo present
  | "http_status"      // non-2xx after redirects
  | "network"          // opaque fetch failure (may be CORS/connectivity)
  | "timeout"
  | "cancelled"
  | "oversize"         // while reading URL body (also parse-owned for paste)
  | "html_body"        // response looks like HTML login/page, not a spec

type SpecLoadError = {
  code: SpecLoadErrorCode
  message: string // user-facing; network never claims "CORS confirmed"
  httpStatus?: number
  recovery?: "paste" | "retry"
}

type SpecLoadSuccess = {
  document: NormalizedOpenApiDocument
  source: {
    kind: "paste" | "url"
    /** Final request URL after redirects for url loads; omitted for paste. */
    href?: string
    /** Redirect chain length (0 = no redirect). */
    redirectCount: number
  }
}

type SpecLoadResult =
  | { ok: true; value: SpecLoadSuccess }
  | { ok: false; error: SpecLoadError }

loadOpenApiDocument(
  source: SpecSource,
  options?: { signal?: AbortSignal },
): Promise<SpecLoadResult>
```

Paste path: size-check via existing decode/parse (`MAX_INPUT_BYTES`); no network.

URL path:

1. `validateSpecSourceUrl(href)` — accept only `http:` / `https:`; reject userinfo (`user:pass@`), other schemes, empty/relative strings.
2. `http.get/text` (or equivalent) via configured client with `credentials: "omit"`, `AbortSignal` racing `FETCH_TIMEOUT_MS`.
3. While reading body, enforce UTF-8 byte length ≤ `MAX_INPUT_BYTES` (stream/chunk accumulate; reject `oversize` without parsing). Header `Content-Length` alone is insufficient.
4. Successful text → optional HTML sniff, then `parseOpenApiDocument`. MIME/extension do not gate success (T05). **HTML precedence:** if the body (trimmed, case-insensitive) starts with `<!DOCTYPE html` or `<html`, return `html_body` **without** calling parse; otherwise parse failures stay parse codes (`yaml`/`json`/`schema`/…). HTTP 4xx/5xx stay `http_status` (no body sniff).
5. Source identity for URL loads is the **final** response URL after redirects (`redirectCount` recorded).

### Configured HTTP client

```ts
// utilities/http.ts — low-level; may call fetch
// api/http-client.ts
export const http: HttpClient // credentials omitted by default; timeout helper
```

Domain code imports `@/api/http-client` only — never bare `fetch`.

### Share URL encoding contract (#3 specifies; #8 consumes `op`)

Search params on `/` via TanStack Router `validateSearch`. Invalid keys must become `undefined` without throwing the route — use per-field coerce (not a single failing `parse`):

```ts
function optionalSearchString(max: number, value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  if (value.length === 0 || value.length > max) return undefined
  return value
}

function validateSpecLoadSearch(raw: Record<string, unknown>): SpecLoadSearch {
  return {
    url: optionalSearchString(8192, raw.url),
    op: optionalSearchString(4096, raw.op),
  }
}
type SpecLoadSearch = { url?: string; op?: string }
```

`#3` does not interpret `op` beyond pass-through.

| Param | Meaning | Owner |
| --- | --- | --- |
| `url` | Absolute `http(s)` source URL, as a single search value (router/percent-encoding). No userinfo. | #3 loads it |
| `op` | percent-encoded `encodeOperationIdentity(method, path)` (`JSON.stringify([method, path])` from #2) | #8 selects |

Behavior:

- Fresh session with `?url=` → validate + fetch + parse before any operation UI (#8). On failure: keep load form, show banner, leave `url` visible for edit/retry.
- **Runtime `op` preserve:** while auto-loading or after load success/failure, `#3` must not strip `op` from the location (read search → write only `url`-related updates if any; pass through `op` unchanged). `#3` never selects an operation from `op`.
- Paste-only sessions never put document bytes in the URL or storage. A shared link with `op` but no `url` shows an empty/banner explaining the source is missing and offering paste (#3 ships missing-source message; #8 wires pending-`op` restore after paste — **not** in #3).
- Copy/share chrome and query-param disclosure for sources that themselves contain `?` are #8; this issue documents that `url` is one search value and must round-trip the full source href including its query string.

### Loader state hook

`useSpecLoad` (client state in-domain):

- States: `idle` | `loading` | `success` | `failure`.
- **Latest load wins:** starting B aborts A; a late A must not replace B’s result or clear B’s error.
- Cancel → leave prior success visible if any; clear loading; `cancelled` is not sticky over a newer success.
- Failure after prior success → **retain** last successful document + source; associate the new error with the attempted replacement (T08).
- Reset → clear model, source identity, and error (selection/filter/examples do not exist yet; document the hook so #4–#8 reset those when added).
- No `localStorage` / `sessionStorage` of paste text, bodies, or raw query strings.

### UI (Signal)

- Band: dark default home band; form as spec lines (mono label, hairline control).
- Actions: **Load URL**, **Parse paste**, **Cancel** (while loading), **Reset** (when a document is loaded or an error is shown).
- Loading: still skeleton of the result panel + mono `loading · fetching` / `loading · parsing` — no spinner.
- Failure: Banner `dot | message | Paste` (or Retry) per §9; network copy offers paste recovery without asserting CORS.
- Success (until docs chrome lands): Empty/success panel with `info.title`, `info.version`, source kind/href, operation count — ruled placeholder sized for the future viewer. This is the handoff surface for later screens in the same domain.

## Failure modes and edge cases

| Input / event | Observable behavior |
| --- | --- |
| Empty paste | parse `empty`; banner; no throw |
| Paste >5 MiB | `oversize` before/at decode |
| Valid Petstore paste | success; model retained |
| `http(s)` URL → 200 JSON/YAML (any MIME) | parse success; source `href` = final URL |
| Redirect 3xx → 200 fixture | success; `redirectCount ≥ 1`; identity = final URL |
| 404 / 500 | `http_status` + status; no parse |
| HTML login body on 200 | `html_body` via sniff (see precedence); not network; not a parse code |
| Cross-origin without CORS / offline | `network` + guidance naming connectivity or browser blocking (CORS possible) + paste recovery; never “CORS confirmed” |
| Mixed content (HTTPS app page → `http://` spec URL) | same `network` code; message **must** mention mixed content / HTTP blocked on HTTPS pages as one possible cause alongside connectivity |
| URL with userinfo or `file:` / `data:` | `disallowed_url`; no request |
| Supported fetch | `credentials: "omit"`; no Authorization header from the app |
| Load A slow; start B; B finishes; A finishes | B remains; A ignored |
| Cancel pending | loading clears; prior success kept |
| Timeout (>15s) | `timeout` + retry |
| Fail replacement B after success A | A still shown; B’s error labeled as replacement failure |
| Reset | idle; no document |
| `?url=` disallowed/failed | form + banner; recoverable |
| Stream oversize without Content-Length | stop reading; `oversize` |
| Spec fetch must not call paths from the loaded API, remote refs, or external examples | enforced by load code only requesting the source URL |

## Acceptance criteria

- **AC-1:** Given committed `petstore-3.0.json` bytes, `loadOpenApiDocument({ kind:"paste", text })` returns `ok` with nonempty operations and Petstore info title/version (issue paste path; epic paste minimum).
- **AC-1b:** Given the same Petstore text entered through `SpecLoadScreen` paste + Parse action (RTL), the success panel shows the fixture title/version and a nonempty operation count (Signal empty/success pattern).
- **AC-2:** Given the same fixture bytes served by the real fixture HTTP server over `http` with `Content-Type: application/json`, with `text/plain`, and after one redirect to the JSON fixture, URL load returns `ok` and the same operation identity set as paste; source `href` is the final URL after redirect (T05 success subset).
- **AC-3:** Given fixture server responses 404, 500, and 200 with an HTML login page body, results are `http_status` (404/500) or `html_body` (HTML sniff) — never a successful model and never a parse code for the HTML case (T05 error subset).
- **AC-4:** Given (a) opaque network failure from the http client and (b) the documented mixed-content guidance string path, error mapping yields `network` copy that names connectivity / browser blocking (CORS possible) and, for HTTPS-page→HTTP-URL guidance, mixed content — without “CORS confirmed” — and `recovery: "paste"`; `SpecLoadScreen` shows that banner with a Paste action (T06 message contract; browser CORS matrix blocked-on-#9).
- **AC-5:** Given delayed load A and faster load B (real server delay), then a late A completion, displayed success/error remains B’s; cancel of a pending load clears loading without applying the cancelled response; timeout after `FETCH_TIMEOUT_MS` yields `timeout` + retry (T07).
- **AC-6:** Given success A, failed replacement B, retry success B, then reset: A remains through B’s failure with B’s error associated; success replaces source+model together; reset clears document-specific state (T08).
- **AC-7:** Given `https://`/`http://` allowed URLs, and rejected `https://user:pass@host/…`, `file:`, `data:` — disallowed never hit the network; allowed requests omit credentials; load path does not persist paste/body/query to Web Storage; load does not request API operations, remote refs, or external example URLs (T09).
- **AC-8:** Given `/` with search `{ url: <fixture-server href>, op: <opaque sample> }`, the screen auto-loads that source; after success or failure the location still contains the same `op` value; malformed/disallowed/failed `url` shows recoverable banner; no operation is selected from `op` (T20 source-load subset + encoding contract).
- **AC-9:** Given missing `url` with or without `op`, the load screen explains that a pasted document is not in the link and offers paste — document bytes never appear in the URL (T21 missing-source subset only; pending-`op` restore after paste is #8).
- **AC-10:** Given URL body at exactly `MAX_INPUT_BYTES` and one byte over (streamed without relying only on Content-Length), boundary accepted / excess `oversize`; cancel during an in-flight large stream leaves no partial success model (T23 load-owned subset). Alias/depth remain #2-enforced via parse.
- **AC-11:** Given paste → success, URL network failure, and validation/`html_body` failure through `SpecLoadScreen`, the UI shows Signal loading skeleton copy, failure banner (`dot | message | action`), and success empty/placeholder respectively — no spinner.
- **AC-12:** Given the production module graph, no `src/domains/**` file calls bare `fetch`; URL loads import `@/api/http-client`; `src/app/index.tsx` only maps the route to `SpecLoadScreen`.

## Acceptance evidence

| AC | Real input | Expected | Boundary | Check |
| --- | --- | --- | --- | --- |
| AC-1 | `petstore-3.0.json` bytes | paste API `ok`, ops nonempty | empty + oversize paste | `bun run --filter @toolu-redoc/redoc test` |
| AC-1b | same bytes via screen paste | title/version + op count visible | — | RTL screen test |
| AC-2 | fixture server JSON MIME, text/plain MIME, redirect→JSON | `ok`, identical op ids, final href | three server setups | load + fixture-server tests |
| AC-3 | 404 / 500 / HTML 200 | `http_status` / `http_status` / `html_body` | HTML must not be parse code | same |
| AC-4 | injected network failure + mixed-content message fixture | `network` copy + Paste banner; no “CORS confirmed” | mixed-content phrase present | message-map unit + RTL banner |
| AC-5 | delayed A / fast B / cancel / timeout | latest-wins; cancel; timeout | 15s abort | fixture-server delay + abort tests |
| AC-6 | A ok → B fail → B ok → reset | retain / replace / clear | — | hook/load tests |
| AC-7 | userinfo + non-http schemes + storage spy | `disallowed_url`; omit credentials; no storage writes | — | same |
| AC-8 | search `{url, op}` against fixture server | auto-load; `op` still in location after | failed + successful load | route/search + screen tests |
| AC-9 | `op` without `url` | missing-source banner + paste CTA | no body in URL | RTL |
| AC-10 | streamed size at/over limit; cancel mid-stream | accept / `oversize`; no partial success | +1 byte; cancel | fixture-server stream tests |
| AC-11 | Petstore paste; network fail; HTML URL | skeleton / banner / success placeholder | — | RTL |
| AC-12 | domain sources + `app/index.tsx` | no bare fetch; thin route | — | oxlint `no-bare-fetch` + `bun run check` |

Docs inventory (READMEs, AGENTS, product README load journey) updates are required with the implementation and verified during `bun run check` / review — not a separate product AC.

**Explicitly blocked (not pass):** T06 full distinct-origin browser CORS matrix; T20 operation restore / history; T21 pending-`op` after paste; T22 filter/selection/copy chrome — owned with #8/#9. Spec records them as blocked dependencies, not green.

## Documentation impact

- `docs/toolu/specs/2026-09-24-spec-load-ux-design.md` — this contract.
- `apps/redoc/src/domains/openapi/README.md` — load API, screen, share-param contract.
- `apps/redoc/src/api/README.md`, `apps/redoc/src/utilities/README.md` — http client inventory.
- `apps/redoc/src/domains/README.md` / `AGENTS.md` — remove `home`, note load screen entry.
- Product `apps/redoc/README.md` — document paste/URL load journey once UI lands.
- Fixture provenance: note fixture-server usage; no new Petstore bytes required unless HTML/oversize helpers are generated in tests.

## Open Questions

1. **T06 browser CORS / mixed-content matrix** — **Decided for #3:** ship honest network messaging + real same-process HTTP server evidence; full browser matrix blocked on #9. Reason: Jev `cors_evidence`; epic forbids marking missing harness as pass.
2. **T20–T22 operation UI / T21 pending-`op` after paste** — **Decided:** #3 owns encoding + `url` auto-load + runtime `op` pass-through + missing-source copy; #8 owns `op` selection, history, filter, copy chrome, and pending-`op` restore after paste. Epic accepts this split: #3 does not mark pending-`op` restore as pass. Reason: Jev `share_scope`; issue #8 acceptance.
3. **Search param names `url` / `op`** — **Decided:** `url` + `op` as specified above. Reason: short, epic-aligned (“encoded source URL and operation key”); avoids embedding document bytes.
4. **Home domain fate** — **Decided:** delete scaffold `home` once `/` points at `SpecLoadScreen`. Reason: Jev `domain_home`; knip + isolation.
5. **Success handoff before docs chrome** — **Decided:** in-domain success panel showing title/version/source/op count as ruled placeholder. Reason: issue requires handoff surface; #4+ replace placeholder with three regions in the same domain.

No remaining questions block implementation.
