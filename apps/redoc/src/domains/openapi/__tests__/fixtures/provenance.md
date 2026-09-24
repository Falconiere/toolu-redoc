# OpenAPI fixture provenance

Retrieved / authored for issue #2 (`domains/openapi` parse acceptance).
All hashes are SHA-256 of the committed file bytes.

## Petstore (official OAS 3)

| File | Source | Retrieved | SHA-256 |
| --- | --- | --- | --- |
| `petstore-3.0.json` | https://petstore3.swagger.io/api/v3/openapi.json (bytes formatted by oxfmt after download) | 2026-09-24 | `246cfe6eaa556e39a38fe6be1bb5c29573dbde34ddb13313b3054afc0a7e3413` |
| `petstore-3.0.yaml` | eemeli `yaml.stringify` of the decoded Petstore JSON value (same logical document) | 2026-09-24 | `a39ae3e65a16abc7ce67320984b669b6ca7a7f6b8ed451247f548e4b227291a7` |

Document reports `openapi: 3.0.4`, title `Swagger Petstore - OpenAPI 3.0`.

## Hand-authored scenario fixtures

| File | Role | SHA-256 |
| --- | --- | --- |
| `f30.json` | AC-3 OpenAPI 3.0.3 nullable sample | `5fa0551dacfdda7c4637926721d95247a025082fbb79abd72abfc7214ec27959` |
| `f30.yaml` | eemeli twin of `f30.json` | `4fe283b417b89d38fb7c6bed09377f8ad660b8be25a9832f7e2fe32f11dcfe3e` |
| `f31.json` | AC-3 OpenAPI 3.1.0 null-union + boolean schemas | `3286a256e9e4cb44a51aac99e7b27b01f18a795fdf19754520e8cb1808713c6b` |
| `f31.yaml` | eemeli twin of `f31.json` | `7d13bc58a815727ceffd22cb1f65d995a596a4bcc795903633ff3d0aa467441a` |
| `schema-distinctions.json` | AC-3b authored schema distinctions + falsy literals | `bfa326ea08f25966f03cb01e0d0b8331359f56c60c21a8fed1492faf1f478f6e` |
| `examples.json` | AC-12 media/schema examples including falsy + `externalValue` | `3eb080a00d349a7ebb5eed3e0b8d183254c9568ddd69ad9cf899d101f623a2fa` |
| `composition.json` | AC-11 composition / discriminator / unsupported keywords | `a244fda4065bb823981510674e1b383823a1b72489adf9b0fddec3429ea27f0f` |
| `fedge.json` | AC-7 eight verbs + Path Item metadata + tags | `6d73dc4d51bf6fab48ca27ef4211d2b44d8fb57fb3c7329b5544beec7dffdc8a` |
| `fref.json` | AC-10 local `$ref` / escaped keys / cycle / wrong-kind | `2a099aa3943bd81fde8dd633ce3cad48cb289b53d3d4674f7a2928df8ff915e5` |
| `identity-paths.json` | AC-8 operation identity edge paths | `83d1b134bfded771fd29761932e0305a2f029558ab9bb32f1a4f51155e3de078` |
| `param-merge.json` | AC-9 path + operation parameter merge | `b211af36cb33a6032c9ef648e8e7862cfef8348f1e215e50c2c40fb301e8cd20` |
| `empty-paths.json` | AC-5 empty `paths` | `4f74e3ca75d9c4448ab0ee89fb714640f6db4b1d5e1a6d7708c79ea9e4e3f49a` |
| `webhook-only-3.1.yaml` | AC-5 webhook-only 3.1 | `6e700ea816b91b2a92f9c17e9d5380e38eafc7a1015c660b08d1318830f7eaee` |
| `fbad-empty.txt` | AC-4 / AC-6 empty-ish decode | `2106c36011520fe73876d45bfb9ef8bf7b2e9f4362096a320376d8ee9b27ef12` |
| `fbad-dup-key.yaml` | AC-6 duplicate keys | `be9862e0783ef169a923831f9d5bf688201c9cb5ebfa9724c1d7ec7c51b318b3` |
| `fbad-multi-doc.yaml` | AC-6 multi-document YAML | `a154f6155e597058895a02b0cdafe6e896535d311ce4ef1222d0fd52e5b38037` |
| `fbad-alias-bomb.yaml` | AC-6 / AC-13 alias limit | `fd4663c0836429f5e84907e004fb36cb04575a8933bc89abd3d0036786527031` |

Size-boundary inputs for AC-13 (`MAX_INPUT_BYTES` and `MAX_INPUT_BYTES + 1`) are generated in-test with `TextEncoder` rather than committed as blobs.
