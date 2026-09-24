# src/utilities

Owns the utilities surface. Keep this inventory current as files are added.

| File | Role |
| --- | --- |
| `http.ts` | House HTTP client (`createHttpClient`, `HttpError`, `HttpAbortError`, `getText`, `getResponse`) — the only module that may call bare `fetch` |
