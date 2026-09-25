# src/domains

Owns the domains surface. Keep this inventory current as files are added.

| Domain | Owns |
| --- | --- |
| `openapi/` | OpenAPI 3.0/3.1 models (Zod), `parseOpenApiDocument`, `loadOpenApiDocument`, `SpecLoadScreen` on `/`, nav model builders, fixtures + fixture HTTP server under `__tests__/` |
| `docs/` | Signal three-column shell (nav · main · Samples `SchemaRail`), operation nav/detail UI on DTOs, temporary Petstore twin under `api/` |

User walkthrough and Out of scope: [`apps/redoc/README.md`](../../../README.md).
