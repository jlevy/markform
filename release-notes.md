## What's Changed

### Features

- **Render subpath export**: New `markform/render` subpath exports rendering functions (`renderViewContent`, `renderSourceContent`, `renderFillRecordContent`, etc.) so external consumers can render forms with visual parity to `markform serve` without CLI/server dependencies
- **Twitter thread example**: New content transformation example form for Twitter thread workflows

### Fixes

- **Skip reason display**: Skip reasons from agents (e.g., "Not applicable") now display correctly in View, Edit, and Report tabs of the serve UI
- **URL preservation in tables**: Fixed URL validation in table cells that incorrectly checked link display text instead of the actual URL, causing valid URLs to be rejected
- **API error messages**: Improved error context for model API failures with HTTP status codes, response bodies, and actionable troubleshooting hints

### Refactoring

- Extracted ~1600 lines of rendering code from `serve.ts` into dedicated `src/render/` module

**Full commit history**: https://github.com/jlevy/markform/compare/v0.1.21...v0.1.22
