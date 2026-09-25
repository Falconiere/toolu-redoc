# src/utilities

Owns the utilities surface. Keep this inventory current as files are added.

| File | Role |
| --- | --- |
| `http.ts` | House HTTP client (`createHttpClient`, `HttpError`, `HttpAbortError`, `getText`, `getResponse`) — the only module that may call bare `fetch` |
| `resolve-base-path.ts` | `resolveBasePath` — validates the `REDOC_BASE_PATH` build variable into Vite's `base` (`/` or `/<segment>/…/`); imported by `vite.config.ts` |
| `band-theme.ts` | Signal band preference (`dark` / `light`): storage key, read/write, apply `.band-light` on `<html>` |
