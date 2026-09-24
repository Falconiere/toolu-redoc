# src/api

Owns the api surface. Keep this inventory current as files are added.

| File | Role |
| --- | --- |
| `http-client.ts` | App-configured `http` export (`credentials: "omit"`, `REQUEST_TIMEOUT_MS`) — domains import this, never bare `fetch` |
| `clients/` | Third-party API wrappers built on `http` (allowlisted nested dir) |
| `queries/` | TanStack Query option factories for non-oRPC resources (allowlisted nested dir) |
