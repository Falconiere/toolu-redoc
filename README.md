# Toolu Redoc

A Bun workspace. Every app and package owns its own quality gate; the root fans
them out.

## Apps

- `apps/redoc` — OpenAPI docs viewer console (port 5173). Run/load/Out of scope: [`apps/redoc/README.md`](./apps/redoc/README.md).
- `apps/api` — backend-ts (port 8787)

## Shared packages

- `packages/ui`
- `packages/config`
- `packages/types`

## Commands

| Command | What it does |
| --- | --- |
| `bun install` | Install every workspace member |
| `bun run check` | The full gate: structure, unused, then each member's own check |
| `bun run test` | Every member's tests |
| `bun run --filter <package> dev` | Run one app |

## Deploys

`operations.config.json` carries one Cloudflare worker pair, and it is
`apps/api`. The other deployable app deploys with its own script: `bun run --filter @toolu-redoc/redoc deploy`.
