# API Reference — design reference

Visual source for the toolu-redoc docs shell. Prefer `Main.dc.html` (Design
Component export with readable inline styles). A Claude “Download HTML” bundle
of the same artboard is a compressed wrapper — unpack it only if you need the
thumbnail; do not commit the 1MB+ bundler file.

## Viewing

```bash
cd apps/redoc/docs/design-reference
python3 -m http.server 8765
# open http://127.0.0.1:8765/Main.dc.html
```

## What to replicate in app code

| Region | Mock | App mapping |
| --- | --- | --- |
| Header | 56px, title + `/ API REFERENCE`, version pill, primary CTA | `LoadedDocsToolbar` (share + reset) |
| Nav | 264px, filter, group counts, live method colour | `DocsOperationNav` + row |
| Main | marker, display title, path bar + copy, param cards, pager | `OperationDetail*` + `DocsOperationPager` |
| Rail | 600px Example/Schema panels (mock also shows curl/ts/py) | `SchemaRail` panels — **no** SDK codegen in MVP |

Tokens: Signal jade, Archivo + JetBrains Mono, surface panels `rounded-xl`,
hairline borders. The mock's hex values inform the token definitions in
`src/ui/theme/*` — never paste mock hex directly into components.
