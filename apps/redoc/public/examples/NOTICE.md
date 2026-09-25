# Example OpenAPI documents — provenance and licences

These files back the "Try an example" gallery on the Toolu Redoc load screen
(`src/domains/openapi/api/example-specs.ts`). They are served from the same
origin as the app, so loading them never depends on third-party CORS. Bytes are
committed as-is (excluded from oxfmt) so each hash below can be checked against
its source; a test fails if a file and its row drift apart.

| File | Source | Retrieved | Licence | SHA-256 |
| --- | --- | --- | --- | --- |
| `petstore-3.0.json` | https://petstore3.swagger.io/api/v3/openapi.json (copy of `src/domains/openapi/__tests__/fixtures/petstore-3.0.json`, bytes formatted by oxfmt after download) | 2026-09-24 | Apache-2.0 (per the document's `info.license`) | `246cfe6eaa556e39a38fe6be1bb5c29573dbde34ddb13313b3054afc0a7e3413` |
| `petstore-3.0.yaml` | eemeli `yaml.stringify` of the Petstore JSON above (copy of `src/domains/openapi/__tests__/fixtures/petstore-3.0.yaml`) | 2026-09-24 | Apache-2.0 (per the document's `info.license`) | `a39ae3e65a16abc7ce67320984b669b6ca7a7f6b8ed451247f548e4b227291a7` |
| `museum-3.1.yaml` | https://raw.githubusercontent.com/Redocly/museum-openapi-example/2770b2b2e59832d245c7b0eb0badf6568d7efb53/openapi.yaml (unmodified) | 2026-09-25 | MIT — Copyright (c) 2023 Redocly Inc | `2d88e96a1860382fa86e15af892c50d95ae81d53324ac9b07aa9e6a72a8974aa` |
| `feature-tour-3.1.yaml` | Authored in this repository for the gallery | 2026-09-25 | Authored for Toolu Redoc (same terms as this repository) | `7b371839d467d9fca464444620c0616ddb82882575040031ab0ecf5f5765e61e` |

## MIT licence (Redocly Museum API)

Copyright (c) 2023 Redocly Inc

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Apache-2.0 (Swagger Petstore)

The Swagger Petstore OpenAPI document is published by SmartBear under the
Apache License, Version 2.0: https://www.apache.org/licenses/LICENSE-2.0.html
