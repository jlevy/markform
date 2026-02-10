# Plan Spec: Export Rendering Functions as `markform/render` Subpath

## Purpose

Export rendering functions from `serve.ts` as a `markform/render` subpath so external
consumers (e.g. DataRoom Browser) can render forms and fill records with exact visual parity
to `markform serve`, without duplicating ~1800 lines of rendering code.

**GitHub Issue:** #131

**Related docs:**

- `packages/markform/src/cli/commands/serve.ts` — Current home of all rendering functions
  (3,544 lines)
- `packages/markform/tsdown.config.ts` — Build configuration with entry points
- `packages/markform/package.json` — Current subpath exports (`.`, `./cli`, `./ai-sdk`)
- `packages/markform/src/index.ts` — Main package entry point

## Background

### Current State

All HTML rendering logic lives in a single monolithic file: `serve.ts` (3,544 lines). This
file contains:

1. **HTTP server** — `registerServeCommand()`, request routing, file watching
2. **Full-page HTML renderers** — `renderFormHtml()`, `renderFieldHtml()`, complete page
   shells with CSS/JS
3. **Content-only renderers** — Functions that produce HTML fragments without page wrappers:
   - `renderViewContent(form: ParsedForm): string` (line 1994)
   - `renderSourceContent(content: string): string` (line 2218)
   - `renderMarkdownContent(content: string): string` (line 2270)
   - `renderYamlContent(content: string): string` (line 2531)
   - `renderJsonContent(content: string): string` (line 2572)
   - `renderFillRecordContent(record: FillRecord): string` (line 3200)
4. **Utility functions** — `escapeHtml()`, `formatDuration()`, `formatTokens()`
5. **CSS constants** — `FILL_RECORD_STYLES` (not currently exported, line 2732),
   `READ_ONLY_STYLES`, tab styles, form styles
6. **JavaScript for interactivity** — `frShowTip()`, `frHideTip()`, `frCopyYaml()` tooltip
   and copy handlers (defined in inline `<script>`, lines 1014-1039)
7. **Private helpers** — `renderViewFieldValue()`, `formatCheckboxState()`,
   `highlightSourceLine()`, `highlightYamlValue()`, `formatPatchValue()`,
   `renderPatchDetails()`, `renderToolCall()` — used internally by the exported functions

### Dependency Analysis

The rendering functions depend on:

| Dependency | Type | Source |
|-----------|------|--------|
| `ParsedForm`, `Field`, `FieldValue`, etc. | Types | `engine/coreTypes.ts` |
| `FillRecord` | Type | `harness/fillRecord.ts` |
| `escapeHtml()` | Utility | Same file (serve.ts:1706) |
| `formatDuration()`, `formatTokens()` | Utilities | Same file (serve.ts:2595, 2607) |
| `friendlyUrlAbbrev()`, `formatBareUrlsAsHtmlLinks()` | Utilities | `utils/urlFormat.ts` |
| `YAML.stringify()` | External dep | `yaml` package |
| `FILL_RECORD_STYLES` | CSS constant | Same file (serve.ts:2732, ~460 lines) |
| Private helpers (7+) | Internal | Same file |
| `frShowTip/frHideTip/frCopyYaml` | JS scripts | Inline in page shell (serve.ts:1014-1039) |

Key observations:
- All rendering functions already have `export` and `@public` JSDoc tags
- `FILL_RECORD_STYLES` is the only constant that is NOT exported
- The tooltip/copy JS functions are embedded in the page shell, not in the rendering
  output — but `renderFillRecordContent()` emits `onmouseenter="frShowTip(this)"` inline
  handlers that expect these globals to exist
- No Node.js-specific APIs (fs, http, etc.) are used by the rendering functions themselves

### Gap Analysis

External consumers currently cannot:

1. Import rendering functions — they're only accessible via `markform/cli` which pulls in
   the entire CLI including commander, HTTP server, picocolors, etc.
2. Access `FILL_RECORD_STYLES` — it's a private constant
3. Get the tooltip/copy JS — it's embedded in the serve command's page template
4. Use rendering functions without pulling in CLI dependencies

### Consumer Use Case

DataRoom Browser needs to:
```typescript
import {
  renderFillRecordContent,
  renderViewContent,
  renderYamlContent,
  FILL_RECORD_STYLES,
  FILL_RECORD_SCRIPTS,
  escapeHtml,
  formatDuration,
  formatTokens,
} from 'markform/render';
```

And embed the HTML fragments in their own page shell, providing their own CSS reset, layout,
and surrounding UI.

## Design Approaches

### Option A: New `markform/render` Subpath (Re-export from serve.ts)

Create a thin `src/render/index.ts` that re-exports from `serve.ts`. No code moves.

```typescript
// src/render/index.ts
export {
  renderFillRecordContent,
  renderViewContent,
  renderYamlContent,
  renderJsonContent,
  renderSourceContent,
  renderMarkdownContent,
  escapeHtml,
  formatDuration,
  formatTokens,
} from '../cli/commands/serve.js';
```

**Pros:**
- Minimal change — no code moves, zero risk of breaking existing serve command
- Quick to implement
- Re-exports create a stable public API surface

**Cons:**
- `import from 'markform/render'` would pull in the entire serve.ts module at import time,
  including all its imports (commander types, picocolors, node:http, node:fs, etc.)
- Tree-shaking may not eliminate server-side imports since tsdown bundles entry points
- Doesn't solve the `FILL_RECORD_STYLES` export (still private in serve.ts)
- Consumers get a large bundle for just a few rendering functions

### Option B: Extract Rendering Module (Move Code Out of serve.ts)

Move rendering functions, their private helpers, and CSS/JS constants into a new
`src/render/` module. The serve command imports from render instead of defining inline.

```
src/render/
  index.ts              # Public API re-exports
  htmlRenderers.ts      # renderViewContent, renderSourceContent, renderMarkdownContent,
                        # renderYamlContent, renderJsonContent + private helpers
  fillRecordRenderer.ts # renderFillRecordContent + private helpers + FILL_RECORD_STYLES
  renderUtils.ts        # escapeHtml, formatDuration, formatTokens
  fillRecordAssets.ts   # FILL_RECORD_STYLES, FILL_RECORD_SCRIPTS constants
```

**Pros:**
- Clean separation — rendering code has no CLI/server dependencies
- `markform/render` is lightweight — only pulls in rendering code + yaml + core types
- serve.ts shrinks from 3,544 lines to ~1,700 (server + page shell + form editor)
- Enables future use cases (SSR, static site generation, other consumers)
- Proper module boundaries make testing easier

**Cons:**
- Larger change — more files touched, more risk of subtle breakage
- Need to carefully extract private helpers
- serve.ts still needs to import from render + provide page shell
- Need to verify all internal cross-references work after extraction

### Option C: Export from Main Entry (`markform`)

Add rendering exports to the existing main `markform` entry point (src/index.ts) rather
than creating a new subpath.

**Pros:**
- No new subpath or build entry point needed
- Simpler package.json

**Cons:**
- Pollutes the main entry point with HTML rendering concerns
- Main entry is for engine/harness — rendering is a different layer
- Increases bundle size for consumers who only need the engine
- Doesn't match the established pattern (`.`, `./cli`, `./ai-sdk` are separate concerns)

### Option D: Hybrid — Extract Core Renderers, Thin Subpath

Move only the pure rendering functions (no CLI deps) to `src/render/`, keep page-shell
rendering in serve.ts. This is a pragmatic middle ground:

- Move: `escapeHtml`, `formatDuration`, `formatTokens`, `renderViewContent`,
  `renderYamlContent`, `renderJsonContent`, `renderFillRecordContent`,
  `FILL_RECORD_STYLES`, `FILL_RECORD_SCRIPTS`, and their private helpers
- Keep in serve.ts: `renderFormHtml`, `renderFieldHtml`, `registerServeCommand`, page
  shell, tab/form editing logic, HTTP server
- serve.ts imports from `render/` for the content renderers it needs

**Pros:**
- Clean module boundary — rendering functions have no CLI deps
- serve.ts still owns the full-page rendering and server
- Smaller extraction scope than Option B (less risk)
- `markform/render` is truly lightweight

**Cons:**
- Still a non-trivial extraction (rendering functions + ~10 private helpers + CSS/JS)
- serve.ts changes (imports instead of inline definitions)

## Recommended Approach: Option D (Hybrid Extract + Subpath)

Option D provides the best trade-off:

1. **Consumer value**: `markform/render` is lightweight with no CLI/server baggage
2. **Manageable scope**: Only move rendering functions, not server logic
3. **Clean architecture**: serve.ts handles serving, render/ handles HTML generation
4. **Low risk**: Private helpers move with their callers, serve.ts just changes imports

Option A is tempting for simplicity but defeats the purpose — consumers would still pull in
the full CLI module graph. Option B is more than needed. Option C is architecturally wrong.

## Detailed Design

### New Module Structure

```
src/render/
  index.ts               # Public re-exports (the subpath API surface)
  renderUtils.ts         # escapeHtml, formatDuration, formatTokens
  contentRenderers.ts    # renderViewContent, renderYamlContent, renderJsonContent,
                         #   renderSourceContent, renderMarkdownContent
                         #   + private helpers: renderViewFieldValue,
                         #     formatCheckboxState, highlightSourceLine,
                         #     highlightYamlValue
  fillRecordRenderer.ts  # renderFillRecordContent
                         #   + private helpers: formatPatchValue,
                         #     renderPatchDetails, renderToolCall
                         #   + FILL_RECORD_STYLES, FILL_RECORD_SCRIPTS
```

### Public API Surface (`markform/render`)

```typescript
// Functions
export function escapeHtml(str: string): string;
export function formatDuration(ms: number): string;
export function formatTokens(count: number): string;
export function renderViewContent(form: ParsedForm): string;
export function renderYamlContent(content: string): string;
export function renderJsonContent(content: string): string;
export function renderSourceContent(content: string): string;
export function renderMarkdownContent(content: string): string;
export function renderFillRecordContent(record: FillRecord): string;

// CSS and JS constants for embedding
export const FILL_RECORD_STYLES: string;
export const FILL_RECORD_SCRIPTS: string;
```

### `FILL_RECORD_SCRIPTS` Design

The tooltip and copy functions currently live in the serve page shell. We need to extract
them as a string constant that consumers can embed:

```typescript
/**
 * JavaScript for fill record interactive features.
 * Consumers should include this in a <script> tag on their page.
 * Provides: frShowTip(el), frHideTip(), frCopyYaml(btn)
 */
export const FILL_RECORD_SCRIPTS = `
  function frShowTip(el) { ... }
  function frHideTip() { ... }
  function frCopyYaml(btn) { ... }
`;
```

### Impact on serve.ts

After extraction, serve.ts will:
- Import from `../../render/index.js` instead of defining renderers inline
- Keep: `registerServeCommand()`, `renderFormHtml()`, `renderFieldHtml()`, HTTP server,
  page shell template, tab switching logic, form editing endpoints
- Estimated reduction: ~1,800 lines removed (rendering + CSS + helpers)

### Build Configuration Changes

**tsdown.config.ts** — add entry point:
```typescript
entry: {
  index: 'src/index.ts',
  cli: 'src/cli/cli.ts',
  bin: 'src/cli/bin.ts',
  'ai-sdk': 'src/integrations/vercelAiSdkTools.ts',
  render: 'src/render/index.ts',  // NEW
},
```

**package.json** — add subpath export:
```json
"exports": {
  ".": { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
  "./cli": { "types": "./dist/cli.d.mts", "default": "./dist/cli.mjs" },
  "./ai-sdk": { "types": "./dist/ai-sdk.d.mts", "default": "./dist/ai-sdk.mjs" },
  "./render": { "types": "./dist/render.d.mts", "default": "./dist/render.mjs" },
  "./package.json": "./package.json"
}
```

### Type Dependencies

The render module needs types from the engine. These are already exported from the main
entry point, so consumers can import types from `markform` and renderers from
`markform/render`:

```typescript
import type { ParsedForm, FillRecord } from 'markform';
import { renderViewContent, renderFillRecordContent } from 'markform/render';
```

The render module itself imports types directly from engine source files (not via the main
entry point), which is the standard pattern in this codebase.

## Implementation Plan

### Phase 1: Create Render Module and Extract Utilities

**Files created:**
- `src/render/renderUtils.ts` — Move `escapeHtml`, `formatDuration`, `formatTokens`
- `src/render/index.ts` — Public API surface

**Files modified:**
- `src/cli/commands/serve.ts` — Import utilities from render module instead of defining
  inline

**Testing:** Existing tests for serve.ts should pass unchanged since the functions are
just moving.

### Phase 2: Extract Content Renderers

**Files created:**
- `src/render/contentRenderers.ts` — Move `renderViewContent`, `renderYamlContent`,
  `renderJsonContent`, `renderSourceContent`, `renderMarkdownContent` and their private
  helpers (`renderViewFieldValue`, `formatCheckboxState`, `highlightSourceLine`,
  `highlightYamlValue`)

**Files modified:**
- `src/cli/commands/serve.ts` — Import content renderers from render module
- `src/render/index.ts` — Add re-exports

### Phase 3: Extract Fill Record Renderer

**Files created:**
- `src/render/fillRecordRenderer.ts` — Move `renderFillRecordContent`, private helpers
  (`formatPatchValue`, `renderPatchDetails`, `renderToolCall`), `FILL_RECORD_STYLES`,
  and new `FILL_RECORD_SCRIPTS` constant

**Files modified:**
- `src/cli/commands/serve.ts` — Import fill record renderer + use `FILL_RECORD_SCRIPTS`
  in the page template instead of inline script definitions
- `src/render/index.ts` — Add re-exports

### Phase 4: Build and Package Configuration

**Files modified:**
- `packages/markform/tsdown.config.ts` — Add `render` entry point
- `packages/markform/package.json` — Add `./render` subpath export

**Validation:**
- `pnpm build` succeeds
- `pnpm publint` passes (validates subpath exports)
- `pnpm typecheck` passes

### Phase 5: Testing

**New tests:**
- Unit tests for render module functions (mirror existing serve.ts tests)
- Verify `markform/render` subpath is importable
- Verify rendered HTML output matches before/after extraction (golden comparison)

**Existing tests that must pass:**
- All unit tests (`pnpm test:unit`)
- All golden tests (`pnpm test:golden`) — these exercise the full serve rendering path
- All tryscript CLI tests (`pnpm test:tryscript`)
- `pnpm publint` — validates the new subpath export

**Test strategy:**
- The primary validation is that existing golden tests and serve tests still pass after
  extraction. Since we're moving code (not rewriting), output should be byte-identical.
- Add a focused unit test file `tests/unit/render.test.ts` that imports from the render
  module directly and verifies the key functions produce expected output.
- Add a `publint` check to CI (already exists) to validate the new subpath export.

### Phase 6: Documentation

Update all project docs that reference subpath exports to include `markform/render`:

1. **`docs/markform-apis.md`** — Add "Rendering API" section (DONE: content renderers,
   CSS/JS constants, utility functions documented)
2. **`README.md` (root)** — Add "Rendering API" subsection under "Programmatic Usage",
   following the existing "AI SDK Integration" pattern
3. **`packages/markform/README.md`** — Mirror root README changes (these two files are
   kept in sync)
4. **`docs/development.md`** — Add "Rendering API" section after "AI SDK Integration",
   showing import example and linking to markform-apis.md
5. **`docs/project/architecture/current/arch-markform-design.md`** — Add render module
   to "Programmatic APIs" or "User Interfaces" section, and update "NPM Package" section
   to list the render subpath

## Files Involved (Summary)

| File | Action | Description |
|------|--------|-------------|
| `src/render/index.ts` | Create | Public API surface for `markform/render` |
| `src/render/renderUtils.ts` | Create | `escapeHtml`, `formatDuration`, `formatTokens` |
| `src/render/contentRenderers.ts` | Create | View, YAML, JSON, source, markdown renderers |
| `src/render/fillRecordRenderer.ts` | Create | Fill record renderer + styles + scripts |
| `src/cli/commands/serve.ts` | Modify | Remove extracted code, import from render/ |
| `packages/markform/tsdown.config.ts` | Modify | Add `render` entry point |
| `packages/markform/package.json` | Modify | Add `./render` export |
| `tests/unit/render.test.ts` | Create | Unit tests for render module |

## Backward Compatibility

- **Code types, methods, and function signatures**: MAINTAIN — all functions keep identical
  signatures
- **CLI**: MAINTAIN — `markform serve` behavior unchanged
- **Package exports**: EXTEND — new `./render` subpath, existing subpaths unchanged
- **serve.ts exports**: MAINTAIN — existing exports from serve.ts continue to work (they
  now re-export from render/ internally)

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Circular imports between render/ and serve.ts | Low | High | Render module has no serve.ts deps; serve.ts imports from render/ (one direction) |
| Bundle size regression for ./cli subpath | Low | Medium | Rendering code is already in serve.ts which is in ./cli; no net change |
| Private helper extraction breaks subtle behavior | Low | Medium | Golden tests catch any rendering differences |
| Missing dependency in render module | Low | Low | Build + publint catch import issues |
