# Plan Spec: Serve Command Tabs Improvements

## Purpose

Enhance the `markform serve` command with an improved tabbed interface that provides:
1. A clean read-only View tab for displaying the form contents
2. Syntax-highlighted Source tab showing the Markdown/Jinja source
3. Fixed Report tab rendering
4. Reorganized tab order

This builds upon the previous serve improvements (plan-2026-01-01-serve-improvements.md).

## Background

The `markform serve` command provides a web-based viewer for markform files with tabs:
- Markform (interactive form editor)
- Report (rendered report markdown)
- Values (YAML values)
- Schema (JSON Schema)

Current limitations:
- No way to view the form in a clean, read-only format with all fields visible
- No syntax highlighting for the source Markdown/Jinja content
- Report tab has HTML rendering issues
- Tab naming could be clearer ("Markform" → "Edit")

## Summary of Task

1. **Rename "Markform" tab to "Edit"**: Clearer name for the interactive form editor

2. **Add "View" tab**: A clean read-only rendering showing:
   - All form fields (filled or empty) in a nice display format
   - No input elements, just clean presentation of field labels and values
   - Similar to Report but shows the full form structure, not just filled values

3. **Add "Source" tab**: Syntax-highlighted view of the form source showing:
   - Markdown formatting (headers, lists, code blocks, etc.)
   - Jinja/MarkDoc tags ({% form %}, {% field %}, etc.) highlighted distinctly
   - Similar approach to existing YAML/JSON highlighting

4. **Fix Report tab**: Ensure HTML renders correctly for report markdown

5. **Reorder tabs**: View, Edit, Source, Report, Values, Schema

## Backward Compatibility

No breaking changes. This is purely additive UI enhancement:
- Existing serve behavior preserved
- No API changes
- No CLI flag changes
- Report tab retains existing functionality with improved rendering

## Stage 1: Planning Stage

### Current State

The serve command (`src/cli/commands/serve.ts`):
- Has tabbed interface for form, report, values, schema
- Tab bar with active state management
- Client-side tab switching with content caching
- Syntax highlighting for YAML and JSON using CSS classes
- Basic markdown rendering with limited features

### Feature Requirements

1. **View Tab** (new):
   - Read-only form display
   - Show all groups and fields with labels
   - Display current values or placeholder "(not filled)" for empty fields
   - Clean presentation without input elements
   - Use existing form schema to render structure

2. **Edit Tab** (renamed from "Markform"):
   - Keep all existing functionality
   - Just rename the tab label

3. **Source Tab** (new):
   - Read the raw form file content
   - Apply syntax highlighting for:
     - Jinja tags: `{% tag %}`, `{% /tag %}`, `{# comment #}`
     - Markdown: headers, bold, italic, code blocks, lists
   - Use similar CSS class pattern as YAML/JSON highlighting

4. **Report Tab** (fix):
   - Review and fix HTML rendering issues
   - Ensure proper escaping and rendering of HTML content

5. **Tab order**: View, Edit, Source, Report, Values, Schema

### Out of Scope

- Dark mode toggle
- Editing Source tab content
- Real-time file watching
- Live form validation in View tab

## Stage 2: Architecture Stage

### File Changes

| File | Changes |
| --- | --- |
| `src/cli/commands/serve.ts` | Add View tab, Source tab, rename Edit, reorder tabs, fix Report rendering |
| `tests/unit/web/serve-render.test.ts` | Add tests for new tabs and rendering |

### Implementation Approach

#### 1. Tab Interface Updates

Update `Tab` interface and `buildTabs` function:
- Add `view` and `source` tab types
- Change `form` label to "Edit"
- Reorder tabs: view, form, source, report, values, schema

```typescript
interface Tab {
  id: 'view' | 'form' | 'source' | 'report' | 'values' | 'schema';
  label: string;
  path: string | null;
}
```

#### 2. View Tab Renderer

Create `renderViewContent(form: ParsedForm): string`:
- Iterate through form schema groups and fields
- Display field labels, types, and current values
- Use clean read-only HTML presentation
- Style similar to Report tab content

#### 3. Source Tab Renderer

Create `renderSourceContent(content: string): string`:
- Apply syntax highlighting for Markdown + Jinja hybrid format
- CSS classes:
  - `.syn-jinja-tag` - `{%`, `%}`, `{#`, `#}`
  - `.syn-jinja-keyword` - tag names (form, field, group, etc.)
  - `.syn-jinja-attr` - attribute names
  - `.syn-md-header` - `#`, `##`, etc.
  - `.syn-md-bold` - `**text**`
  - `.syn-md-code` - backtick code

#### 4. Report Tab Fix

Review `renderMarkdownContent` for:
- Proper HTML entity handling
- Correct list rendering
- Code block formatting

#### 5. Request Handler Updates

Update `handleRequest` to:
- Handle `/tab/view` and `/tab/source` endpoints
- Read form file for source tab content
- Render view from in-memory parsed form

## Stage 3: Implementation Stage

### Phase 1: Tab Infrastructure

- [ ] Update `Tab` interface to include `view` and `source` types
- [ ] Update `buildTabs` to include all tabs in correct order
- [ ] Rename "Markform" label to "Edit"
- [ ] Add CSS styles for new syntax highlighting classes

### Phase 2: View Tab

- [ ] Create `renderViewContent(form: ParsedForm): string` function
- [ ] Render groups with headers
- [ ] Render fields with label, type badge, and value (or "(not filled)")
- [ ] Handle all field types appropriately
- [ ] Add to request handler for `/tab/view`

### Phase 3: Source Tab

- [ ] Create `renderSourceContent(content: string): string` function
- [ ] Implement Jinja tag highlighting
- [ ] Implement Markdown syntax highlighting
- [ ] Add CSS classes for syntax colors
- [ ] Store raw content for source tab access
- [ ] Add to request handler for `/tab/source`

### Phase 4: Report Tab Fix

- [ ] Review current `renderMarkdownContent` for issues
- [ ] Fix any HTML rendering problems identified
- [ ] Add tests for report rendering edge cases

### Phase 5: Integration & Testing

- [ ] Update tests for new tab structure
- [ ] Add tests for View tab rendering
- [ ] Add tests for Source tab rendering
- [ ] Manual testing with example forms

## Stage 4: Validation Stage

### Automated Verification

```bash
pnpm lint        # No lint errors
pnpm typecheck   # No type errors
pnpm build       # Build succeeds
pnpm test        # Tests pass
```

### Manual Verification

```bash
# Serve a form with related files
pnpm markform serve packages/markform/examples/simple/simple.form.md

# Verify:
# 1. Tabs appear in order: View, Edit, Source, Report, Values, Schema
# 2. View tab shows clean read-only form with field values
# 3. Edit tab works as before (interactive form)
# 4. Source tab shows syntax-highlighted Markdown/Jinja source
# 5. Report tab renders markdown correctly
# 6. Values and Schema tabs work as before
```
