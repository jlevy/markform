# Plan Spec: Export and Reporting Improvements

## Purpose

This spec designs improvements to markform’s export, dump, and serve commands to provide
a cleaner separation of concerns and adds a new `report` subcommand for generating
filtered, human-readable markdown reports from filled forms.

## Prerequisites

**Prerequisite Spec:** `plan-2025-12-27-research-api-and-cli.md` should be completed
first.

That spec:

- Moves LLM settings to `src/llms.ts` (Phase 0b) - `settings.ts` is now lighter

- Uses `exportMultiFormat()` from `exportHelpers.ts` for research output

- Introduces `exportFormats: ('form' | 'raw' | 'yaml')[]` option pattern

- Adds `src/research/` module that depends on file I/O helpers

This spec builds on that work by:

- Adding `FILE_EXTENSIONS` constants to centralize extension strings

- Updating `exportHelpers.ts` to use those constants (replacing hardcoded strings)

- Adding `.report.md` format for filtered human-readable output

- Enhancing `serve` to handle all output file types

## Background

### Current State

Markform currently has overlapping functionality between `export` and `dump`:

**`export` command:**

- `--format=markform` (default): Canonical markdoc markdown with directives

- `--format=markdown`: Plain readable markdown (no directives)

- `--format=json/yaml`: Structured data with `schema`, `values`, `notes`, and `markdown`

**`dump` command:**

- Console/plaintext: Formatted display with colors

- JSON/YAML: `{ values: {...}, notes: [...] }` with plain values only

**`serve` command:**

- Currently only serves `.form.md` files with the interactive web UI

- Does not support viewing raw markdown exports or structured data files

### Problems to Solve

1. **Overlap**: Both commands can output values in JSON/YAML with similar but not
   identical formats

2. **Incomplete state info in dump**: The `dump` command outputs only answered field
   values, losing state information (skipped, aborted, unanswered) that is important for
   the new answer state model

3. **No report generation**: No way to generate filtered markdown that omits
   instructions or other content marked for exclusion from reports

4. **Limited serve**: Cannot easily view raw markdown exports, YAML values, or JSON
   files through the web UI

## Summary of Task

### 1. Keep `export` As-Is

The `export` command already handles form-level exports well:

- `--format=markform`: Canonical form with directives (default)

- `--format=markdown`: Raw readable markdown without directives

- `--format=json/yaml`: Full structured export with schema, values, notes, markdown

No changes needed.

### 2. Improve `dump` to Include Full State

Update `dump` to output the full field state for each field, aligning with
`exportHelpers.toStructuredValues()`:

```yaml
values:
  company_name:
    state: answered
    value: "Acme Corp"
  funding_amount:
    state: skipped
    reason: "Information not publicly available"
  analysis:
    state: unanswered
notes:
  - id: n1
    ref: company_overview
    role: agent
    text: "Based on web research..."
```

This is more useful than the current plain-value output because it preserves state.

### 3. New `report` Subcommand

Add `markform report <file>` command that generates filtered markdown reports:

- Outputs clean, readable markdown similar to `export --format=markdown`

- Filters content based on `report=true/false` attribute on tags

- Default behaviors:

  - Most fields: `report=true` (included by default)

  - `{% instructions %}` blocks: `report=false` (excluded by default)

- Can be overridden per-tag with explicit `report=true` or `report=false`

### 4. Enhance `serve` for Multiple File Types

Extend `markform serve` to handle all file types using `FILE_EXTENSIONS` constants:

1. **Form files (`.form.md`)**: Current behavior - interactive web UI

2. **Raw markdown (`.raw.md`)**: Read-only rendered markdown view

3. **Report files (`.report.md`)**: Read-only rendered markdown view

4. **YAML files (`.yml`)**: Syntax-highlighted, formatted view

5. **JSON files (`.json`)**: Syntax-highlighted, formatted view

The serve command should use `detectFileType()` from settings.ts and render
appropriately.

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: DO NOT MAINTAIN - Internal
  refactoring of dump output format is acceptable

- **Library APIs**: KEEP DEPRECATED - The `dump` programmatic API should continue to
  work but output the new structured format.
  Document the change in CHANGELOG.

- **Server APIs**: N/A

- **File formats**: DO NOT MAINTAIN - The dump YAML/JSON output format is changing to
  include state. This is a breaking change for consumers of dump output.

- **Database schemas**: N/A

## Stage 1: Planning Stage

### Feature Requirements

**Must Have:**

0. **File Extension Constants in settings.ts**:

   - Add `FILE_EXTENSIONS` constant object to `settings.ts`

   - Consolidate all file extension conventions:
     ```typescript
     /** Export format extensions (used by export command and exportMultiFormat) */
     export const EXPORT_EXTENSIONS = {
       /** Canonical markform files with markdoc directives */
       form: '.form.md',
       /** Raw markdown export (no directives) */
       raw: '.raw.md',
       /** YAML values export */
       yaml: '.yml',
       /** JSON values export */
       json: '.json',
     } as const;
     
     /** Report extension (separate from exports - generated by report command) */
     export const REPORT_EXTENSION = '.report.md';
     
     /** All recognized markform file extensions */
     export const ALL_EXTENSIONS = {
       ...EXPORT_EXTENSIONS,
       report: REPORT_EXTENSION,
     } as const;
     ```

   - Add helper functions for path derivation:
     ```typescript
     /** Derive export path (for export formats only) */
     export function deriveExportPath(basePath: string, format: keyof typeof EXPORT_EXTENSIONS): string;
     
     /** Derive report path (separate from exports) */
     export function deriveReportPath(basePath: string): string;
     
     /** Detect file type from path */
     export function detectFileType(filePath: string): 'form' | 'raw' | 'report' | 'yaml' | 'json' | 'unknown';
     ```

   - Update `exportHelpers.deriveExportPaths()` to use `EXPORT_EXTENSIONS`

   - Ensure all commands use these constants for consistency

1. **Dump with Full State**:

   - Update `dump` JSON/YAML output to use `{ state, value?, reason?
     }` format

   - Align with `exportHelpers.toStructuredValues()` logic

   - Console output can remain human-readable but should indicate state

2. **Report Command**:

   - New `markform report <file>` subcommand

   - Outputs filtered markdown to stdout (or file with `-o`)

   - Respects `report=true/false` attribute on any tag

   - Default `report=false` for `{% instructions %}` blocks

   - Default `report=true` for all other tags (fields, groups, docs, notes)

   - Output format similar to `serializeRawMarkdown()` but with filtering

3. **Serve Multiple File Types**:

   - Auto-detect file type by extension

   - `.form.md`: Interactive form UI (existing)

   - `.raw.md`, `.md`: Read-only markdown viewer (rendered HTML)

   - `.yml`, `.yaml`: Syntax-highlighted YAML viewer

   - `.json`: Syntax-highlighted JSON viewer

   - Graceful fallback for unknown types

4. **Report Attribute Parsing**:

   - Add `report` attribute support to field/tag parsing

   - Boolean attribute: `report=true` or `report=false`

   - Store in field/block metadata

**Nice to Have:**

1. **Custom report templates**: Allow specifying which field types to include/exclude
   via CLI flags

2. **Report sections**: Support `{% section report=false %}` to hide entire sections

3. **Multiple output formats for report**: Could support JSON/YAML report output that
   only includes report-visible fields

**Not in Scope:**

1. PDF generation - out of scope for this feature

2. Custom CSS theming for serve - use existing styles

3. Report metadata/headers - just the filtered content

### Acceptance Criteria

1. **Dump**:

   - `markform dump file.form.md --format=yaml` outputs state for all fields

   - Skipped/aborted fields show state and reason

   - Unanswered fields explicitly show `state: unanswered`

2. **Report**:

   - `markform report file.form.md` outputs readable markdown

   - Instructions blocks are excluded by default

   - Fields with `report=false` are excluded

   - Output is clean markdown suitable for sharing

3. **Serve**:

   - `markform serve file.raw.md` renders markdown as HTML

   - `markform serve file.yml` shows formatted YAML with syntax highlighting

   - `markform serve file.json` shows formatted JSON with syntax highlighting

   - Interactive form features disabled for non-form files

### Open Questions

1. ~~**Report filename convention**~~: RESOLVED - Using `.report.md` extension, defined
   as `REPORT_EXTENSION` constant in `settings.ts` (separate from `EXPORT_EXTENSIONS`)

2. **Serve port behavior**: Should serve for read-only files use a simpler server, or
   reuse the existing infrastructure?
   (Recommend: reuse existing, just change rendering)

3. **Live reload for raw files**: Should serve watch for changes in raw
   markdown/YAML/JSON files and auto-reload?
   (Recommend: yes, watch and reload for all file types)

## Stage 2: Architecture Stage

### Existing Code to Reuse

1. **`exportHelpers.toStructuredValues()`**: Already has the right state-aware format,
   should be used by dump

2. **`serializeRawMarkdown()`**: Base for report output, needs filtering extension

3. **`serve.ts` and `renderFormHtml()`**: Existing serve infrastructure to extend

4. **`coreTypes.ts`**: Field and response types already support state

5. **`research/research.ts`** (from research spec): Uses `exportMultiFormat()` - will
   need update to use `EXPORT_EXTENSIONS` constants

6. **`src/llms.ts`** (from research spec): LLM settings now live here, not in
   settings.ts

### New Components

1. **Report Serializer**:

   - New function `serializeReportMarkdown(form, options)` in `serialize.ts`

   - Accepts filter options for which tags to include

   - Reuses field rendering logic from `serializeRawMarkdown()`

2. **Report Command**:

   - New `commands/report.ts`

   - Similar structure to export command

3. **Multi-Format Serve**:

   - New renderer functions for YAML/JSON/markdown

   - File type detection in serve command

   - Read-only HTML templates

### File Type Detection Strategy

Use the centralized helpers from `settings.ts`:

```typescript
// In settings.ts

/** Export format extensions (used by export command and exportMultiFormat) */
export const EXPORT_EXTENSIONS = {
  form: '.form.md',
  raw: '.raw.md',
  yaml: '.yml',
  json: '.json',
} as const;

/** Report extension (separate from exports - generated by report command) */
export const REPORT_EXTENSION = '.report.md';

/** All recognized markform file extensions */
export const ALL_EXTENSIONS = {
  ...EXPORT_EXTENSIONS,
  report: REPORT_EXTENSION,
} as const;

export type FileType = 'form' | 'raw' | 'report' | 'yaml' | 'json' | 'unknown';

export function detectFileType(filePath: string): FileType {
  if (filePath.endsWith(ALL_EXTENSIONS.form)) return 'form';
  if (filePath.endsWith(ALL_EXTENSIONS.raw)) return 'raw';
  if (filePath.endsWith(ALL_EXTENSIONS.report)) return 'report';
  if (filePath.endsWith(ALL_EXTENSIONS.yaml)) return 'yaml';
  if (filePath.endsWith(ALL_EXTENSIONS.json)) return 'json';
  if (filePath.endsWith('.md')) return 'raw'; // generic .md treated as raw
  return 'unknown';
}

/** Derive export path - only for export formats, not reports */
export function deriveExportPath(
  basePath: string, 
  format: keyof typeof EXPORT_EXTENSIONS
): string {
  // Remove any known extension first
  let base = basePath;
  for (const ext of Object.values(ALL_EXTENSIONS)) {
    if (base.endsWith(ext)) {
      base = base.slice(0, -ext.length);
      break;
    }
  }
  return base + EXPORT_EXTENSIONS[format];
}

/** Derive report path - separate from exports */
export function deriveReportPath(basePath: string): string {
  let base = basePath;
  for (const ext of Object.values(ALL_EXTENSIONS)) {
    if (base.endsWith(ext)) {
      base = base.slice(0, -ext.length);
      break;
    }
  }
  return base + REPORT_EXTENSION;
}
```

### Report Attribute Flow

```
Parse form → Check report attribute on each element → Filter during serialization
```

The `report` attribute should be stored on:

- `DocumentationBlock.report?: boolean`

- `Field.report?: boolean`

- `FieldGroup.report?: boolean`

Defaults:

- `DocumentationBlock` with `tag === 'instructions'`: `false`

- All others: `true`

## Stage 3: Refine Architecture

### Reusable Components Found

1. **`exportHelpers.toStructuredValues()`** (line 29-94):

   - Already implements state-aware value extraction

   - Can be directly used by dump command

2. **`serialize.ts` `serializeRawMarkdown()`** (line 1036-1096):

   - Base implementation for raw markdown

   - Needs filter predicate parameter added

3. **Serve infrastructure** (`commands/serve.ts`):

   - HTTP server setup

   - HTML template rendering

   - Can be extended for read-only views

4. **Syntax highlighting**:

   - Web UI already uses Prism or similar for code blocks

   - Can reuse for YAML/JSON highlighting

### Simplification Opportunities

1. **Unify value extraction**: Remove duplicate logic in `dump.ts` `toPlainValue()`, use
   `exportHelpers.toStructuredValues()` instead

2. **Share markdown rendering**: Both report and raw markdown export can share the same
   field-to-markdown logic with a filter predicate

3. **Serve renderers**: Use a single template with conditional styling based on file
   type

### Architecture Updates

1. **Dump command**: Replace custom `toPlainValue()` with import from `exportHelpers`

2. **Report serializer**: Add `serializeReportMarkdown(form, options)` that wraps
   `serializeRawMarkdown()` with filtering

3. **Serve command**: Add file type detection and dispatch to appropriate renderer

## Stage 4: Implementation

### Phase 0: File Extension Constants (Foundation)

**Note:** After research spec is complete, `exportHelpers.ts` and `research/research.ts`
will have hardcoded extension strings (`.form.md`, `.raw.md`, `.yml`). This phase
centralizes those into `FILE_EXTENSIONS` constants.

- [ ] Add `FILE_EXTENSIONS` constant to `settings.ts`:
  ```typescript
  export const FILE_EXTENSIONS = {
    form: '.form.md',
    raw: '.raw.md',
    report: '.report.md',  // NEW: for report command
    yaml: '.yml',
    json: '.json',
  } as const;
  ```

- [ ] Add `FileType` type to `settings.ts`

- [ ] Add `detectFileType()` helper to `settings.ts`

- [ ] Add `deriveExportPath()` helper to `settings.ts` (for export formats only)

- [ ] Add `deriveReportPath()` helper to `settings.ts` (separate from exports)

- [ ] Update `exportHelpers.deriveExportPaths()` to use `EXPORT_EXTENSIONS`

- [ ] Update `exportHelpers.exportMultiFormat()` to use `EXPORT_EXTENSIONS`

- [ ] Update `research/research.ts` `runResearchFromFile()` to use `EXPORT_EXTENSIONS`

- [ ] Update `ResearchFileOptions.exportFormats` type to use `keyof typeof
  EXPORT_EXTENSIONS`

- [ ] Search codebase for any remaining hardcoded `.form.md`, `.raw.md`, `.yml` strings

- [ ] Add unit tests for file type detection and path derivation

### Phase 1: Dump Improvements

- [ ] Update `dump` command to use `toStructuredValues()` from exportHelpers

- [ ] Update console output to show state for each field

- [ ] Remove duplicate `toPlainValue()` function

- [ ] Add tests for new dump output format

- [ ] Update CHANGELOG

### Phase 2: Report Command

- [ ] Add `report` attribute to field/block types in `coreTypes.ts`

- [ ] Update parser to extract `report` attribute

- [ ] Create `serializeReportMarkdown()` function with filtering

- [ ] Create `commands/report.ts` command

- [ ] Default: instructions have `report=false`, all else `report=true`

- [ ] Output file uses `REPORT_EXTENSION` (`.report.md`)

- [ ] Add tests for report generation

- [ ] Update CLI help and documentation

### Phase 3: Serve Enhancements

- [ ] Use `detectFileType()` from settings.ts for file type detection

- [ ] Create read-only markdown renderer for `.raw.md` and `.report.md`

- [ ] Create YAML syntax-highlighted renderer for `.yml`

- [ ] Create JSON syntax-highlighted renderer for `.json`

- [ ] Update serve command to dispatch based on file type

- [ ] Add tests for multi-format serve

- [ ] Update documentation

### Phase 4: Documentation & Example Form

Create a concise example form and update README to demonstrate the full research →
report workflow end-to-end.

**Create `celebrity-quick-research.form.md`:**

A simplified version of `celebrity-deep-research.form.md` that:

- [ ] Has 3-5 user fields (celebrity name, disambiguation, any specific questions)

- [ ] Has 5-8 agent fields covering key areas (bio, career highlights, notable works,
  controversies if any, social media)

- [ ] Ends with a **summary field** that synthesizes all research:
  ```
  {% string-field id="biography_summary" label="Biography Summary" multiline=true %}
  {% /string-field %}
  
  {% instructions ref="biography_summary" %}
  Synthesize everything learned about this celebrity into a concise, engaging biography
  written in the style of The New Yorker. Should be 2-3 paragraphs, capturing the
  essence of who they are, their significance, and what makes them interesting.
  {% /instructions %}
  ```

- [ ] Includes `report=false` on some fields (demonstrating the report feature)

- [ ] Add to `exampleRegistry.ts` with `type: 'research'`

**Update main `README.md`:**

- [ ] Add “Quick Start” or “See It In Action” section showing:

  1. Scaffold the form: `markform examples --name celebrity-quick-research`

  2. Fill user fields interactively

  3. Run research with web search model

  4. Generate report: `markform report output.form.md`

  5. View report: `markform serve output.report.md`

- [ ] Show sample output snippets (form → report transformation)

- [ ] Demonstrate how the summary field synthesizes the research

- [ ] Keep README concise - link to full docs for details

**Why this example works:**

- Small enough to run quickly (not 60+ fields)

- Shows user → agent field flow clearly

- Summary field demonstrates “meta” research tasks

- Report output is shareable/readable (no instructions clutter)

- End-to-end workflow visible in README

## Stage 5: Validation

### Manual Testing Checklist

- [ ] Verify `EXPORT_EXTENSIONS` and `REPORT_EXTENSION` constants are used consistently

- [ ] Verify no hardcoded `.form.md`, `.raw.md`, `.yml` strings remain (grep check)

- [ ] Run `markform dump form.form.md --format=yaml` and verify state output for all
  fields

- [ ] Run `markform report form.form.md` and verify instructions are excluded

- [ ] Run `markform report form.form.md -o output.report.md` and verify `.report.md`
  extension

- [ ] Run `markform serve file.form.md` and verify interactive form UI

- [ ] Run `markform serve file.raw.md` and verify read-only rendered markdown

- [ ] Run `markform serve file.report.md` and verify read-only rendered markdown

- [ ] Run `markform serve file.yml` and verify syntax-highlighted YAML

- [ ] Run `markform serve file.json` and verify syntax-highlighted JSON

- [ ] Run `markform research` and verify outputs still use correct extensions

- [ ] Run `markform examples --name celebrity-quick-research` end-to-end

- [ ] Verify `celebrity-quick-research` summary field produces coherent New Yorker-style
  bio

- [ ] Generate report from celebrity-quick-research output and verify it’s
  shareable/readable

### Automated Test Coverage

- [ ] Unit tests for `detectFileType()` in settings.ts

- [ ] Unit tests for `deriveExportPath()` in settings.ts

- [ ] Unit tests for dump state output format

- [ ] Unit tests for report filtering (include/exclude based on `report` attribute)

- [ ] Integration tests for serve with all file types (.form.md, .raw.md, .report.md,
  .yml, .json)
