# Plan Spec: Serve Command Improvements

## Purpose

Improve the `markform serve` command with:

1. Clean, light-themed syntax highlighting for JSON/YAML
2. Tabbed interface for related files when serving a `.form.md` file
3. Better markdown rendering for report files

## Background

The `markform serve` command provides a web-based viewer for markform files. Currently:

- It uses dark-themed syntax highlighting (dark background) for JSON/YAML, which clashes
  with the light page background
- When serving a `.form.md` file, it only shows that single file, even though related
  files (`.report.md`, `.yml`, `.schema.json`) often exist alongside it
- Markdown rendering for `.report.md` files is very basic (simple header/paragraph parsing)

The settings module (`src/settings.ts`) already provides utilities for detecting file types
and deriving paths to related files (`deriveReportPath`, `deriveSchemaPath`, etc.).

## Summary of Task

1. **Clean JSON/YAML highlighting**: Replace dark-on-light syntax highlighting with a
   light-themed approach that matches the page background (`#f8f9fa`)

2. **Multi-file tabs**: When serving a `.form.md` file, discover related files
   (`*.report.md`, `*.yml`, `*.schema.json`) and show tabs to switch between them:
   - "Markform" - the form itself (interactive)
   - "Report" - rendered report markdown (if exists)
   - "Values" - YAML values (if exists)
   - "Schema" - JSON Schema (if exists)

   Hide tabs for missing files. If only one file exists, show single tab or no tabs.

3. **Improved markdown rendering**: Use a proper markdown rendering approach for
   `.report.md` files (lists, code blocks, links, etc.)

## Backward Compatibility

No breaking changes. This is purely additive UI enhancement:

- Existing serve behavior preserved for single files
- No API changes
- No CLI flag changes

## Stage 1: Planning Stage

### Current State

The serve command (`src/cli/commands/serve.ts`):

- Dispatches to renderers based on `FileType` (form, raw, report, yaml, json, schema)
- Form files are interactive (editable with POST /save endpoint)
- Other files are read-only viewers
- Syntax highlighting uses dark colors on dark `#1e1e1e` background (VS Code dark theme)
- Markdown rendering is minimal (headers and paragraphs only)

### Feature Requirements

1. **Syntax highlighting (JSON/YAML)**:
   - Use light colors on `#f8f9fa` background (matching page background)
   - Keys in a readable dark color (e.g., blue or dark gray)
   - Strings in a distinct color (e.g., green or dark red)
   - Numbers and booleans in appropriate colors
   - Remove the dark `pre` background entirely

2. **Tabbed interface**:
   - Only activate when serving a `.form.md` file
   - Discover related files by replacing `.form.md` with other extensions
   - Tab labels: "Markform", "Report", "Values", "Schema"
   - Current tab highlighted
   - Click tab to switch content (client-side navigation)
   - If file doesn't exist, hide that tab

3. **Markdown rendering**:
   - Parse and render: headers (h1-h6), paragraphs, lists (ul/ol), code blocks, inline
     code, links, bold, italic
   - Could use a lightweight markdown library or improve the existing parser

### Out of Scope

- Dark mode toggle (explicitly skipped per user request)
- Editing non-form files
- Real-time file watching

## Stage 2: Architecture Stage

### File Changes

| File | Changes |
| --- | --- |
| `src/cli/commands/serve.ts` | Main implementation: tabs, improved renderers |
| `tests/unit/web/serve-render.test.ts` | Add tests for new features |

### Implementation Approach

#### 1. Light-Themed Syntax Highlighting

Update `READ_ONLY_STYLES` and `renderYamlHtml`/`renderJsonHtml` to use light theme:

```css
pre {
  background: #f8f9fa;  /* Match page background */
  color: #24292e;       /* GitHub dark text */
  padding: 1rem;
  border-radius: 6px;
  border: 1px solid #e1e4e8;
  overflow-x: auto;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9rem;
  line-height: 1.5;
}
```

Color scheme (GitHub-inspired light theme):

- Keys: `#005cc5` (blue)
- Strings: `#22863a` (green)
- Numbers: `#005cc5` (blue)
- Booleans/null: `#d73a49` (red)
- Comments: `#6a737d` (gray)

#### 2. Tabbed Interface

Add new functions:

- `findRelatedFiles(formPath: string): RelatedFiles` - Discover related files
- `renderTabbedContainer(tabs: Tab[], activeTab: string): string` - Render tab bar
- `handleTabRequest(req, res, filePath, ...)` - Handle tab content requests

Tab structure:

```typescript
interface Tab {
  id: 'form' | 'report' | 'values' | 'schema';
  label: string;
  path: string | null;  // null if file doesn't exist
}
```

Client-side: Use JavaScript to fetch tab content via new `/tab/:id` endpoint.

#### 3. Markdown Rendering

Options:

A. **Use marked library** - Full-featured, battle-tested, small bundle
B. **Improve existing parser** - No new dependencies, but more work

Recommendation: Option A (marked) - It's widely used, well-maintained, and handles edge
cases properly. Can import just the parser for minimal footprint.

However, to avoid adding dependencies, we can enhance the existing simple parser to handle:
- Lists (ul/ol)
- Code blocks (fenced with ```)
- Inline formatting (bold, italic, code)
- Links

## Stage 3: Implementation Stage

### Phase 1: Light-Themed Syntax Highlighting

- [x] Update `READ_ONLY_STYLES` with light-themed `pre` styles
- [x] Update `renderYamlHtml` syntax highlighting colors
- [x] Update `renderJsonHtml` syntax highlighting colors
- [x] Add tests for new styling (check for expected color classes)

### Phase 2: Tabbed Interface

- [x] Add `findRelatedFiles(formPath: string)` function
- [x] Add `RelatedFiles` type
- [x] Add tab bar HTML/CSS styles
- [x] Modify `handleRequest` to detect form files and check for related files
- [x] Add `/tab/:id` endpoint for fetching tab content
- [x] Add JavaScript for client-side tab switching
- [x] Update form HTML to include tab container
- [x] Add tests for tab discovery

### Phase 3: Enhanced Markdown Rendering

- [x] Enhance `renderMarkdownHtml` to support:
  - Unordered lists (`-`, `*`)
  - Ordered lists (`1.`, `2.`)
  - Fenced code blocks (```)
  - Inline code (`)
  - Bold (`**text**`)
  - Italic (`*text*`)
  - Links (`[text](url)`)
- [x] Add tests for new markdown features

**Implementation Status: COMPLETE** (2026-01-01)

All phases implemented in commit `c0ad453`.

## Stage 4: Validation Stage

### Automated Verification

```bash
# All tests pass
pnpm test

# Type checking
pnpm typecheck

# Build succeeds
pnpm build
```

### Manual Verification

```bash
# Serve a form with related files
pnpm markform serve packages/markform/examples/startup-research/startup-research.form.md

# Verify:
# 1. JSON/YAML highlighting uses light colors
# 2. Tabs appear for existing related files
# 3. Clicking tabs switches content
# 4. Report markdown renders properly
```
