# Implicit Checkboxes Feature Design

**Status**: Draft
**Epic**: mf-djfs
**Author**: Claude
**Date**: 2026-01-23

## Overview

This document specifies an enhancement to Markform that allows "plan documents" - markdown
documents with checkboxes but without explicit field wrappers - to be parsed as valid
Markforms with an implicit checkboxes field.

## Motivation

Many real-world documents are task lists or plans:
- Project plans with phases and tasks
- Checklists with section headers
- Issue trackers with nested tasks

Currently, Markform requires explicit `{% field kind="checkboxes" %}` wrappers around
checkbox lists. This creates friction for simple plan documents where the entire doc
is essentially one big task list.

## Design Goals

1. **Simplicity**: Plan documents should "just work" without boilerplate
2. **Consistency**: Implicit behavior should follow existing Markform rules
3. **Composability**: Low-level APIs enable higher-level tools (issue trackers, etc.)
4. **Safety**: ID uniqueness validation prevents conflicts

---

## Spec 1: Implicit Checkboxes Field Behavior (mf-rtp7)

### Definition

A Markform with **implicit checkboxes** is a form that:
1. Has a `{% form %}` wrapper (making it a Markform)
2. Contains no explicit `{% field %}` tags
3. Contains standard markdown checkboxes (`- [ ] Item` syntax)

### Parsing Behavior

When parsing such a form:
1. Detect that the form has no explicit fields
2. Collect all checkboxes across the document
3. Create an implicit field with:
   - `id: "_checkboxes"` (reserved ID)
   - `label: "Checkboxes"` (default label)
   - `kind: "checkboxes"`
   - `checkboxMode: "multi"` (always multi, per design decision)
   - `implicit: true` (internal flag)
4. Each checkbox becomes an option in this implicit field
5. Checkbox options MUST have ID annotations (`{% #id %}`)

### Error Conditions

1. **Checkbox without ID**: If any checkbox lacks an ID annotation, raise `MarkformParseError`:
   ```
   Option in implicit field '_checkboxes' missing ID annotation. Use {% #option_id %}
   ```

2. **Duplicate checkbox ID**: If two checkboxes have the same ID, raise `MarkformParseError`:
   ```
   Duplicate option ID 'task_1' in field '_checkboxes'
   ```

3. **Mixed explicit/implicit**: If a form has both explicit fields AND checkboxes outside
   fields, raise `MarkformParseError`:
   ```
   Checkboxes found outside of field tags. Either wrap all checkboxes in fields or use
   implicit checkboxes mode (no explicit fields).
   ```

### Reserved ID

The ID `_checkboxes` is reserved for the implicit checkboxes field. If a user defines
a field with this ID explicitly, raise an error:
```
Field ID '_checkboxes' is reserved for implicit checkboxes
```

### Example

**Input:**
```markdown
---
markform:
  spec: MF/0.1
  title: Project Plan
---
{% form id="plan" title="Project Plan" %}

## Phase 1: Research
- [ ] Literature review {% #lit_review %}
- [ ] Competitive analysis {% #comp_analysis %}

## Phase 2: Design
- [x] Architecture doc {% #arch_doc %}
- [/] API design {% #api_design %}

{% /form %}
```

**Parsed Schema:**
```json
{
  "id": "plan",
  "title": "Project Plan",
  "groups": [{
    "id": "_default",
    "label": "Default",
    "implicit": true,
    "fields": [{
      "id": "_checkboxes",
      "label": "Checkboxes",
      "kind": "checkboxes",
      "checkboxMode": "multi",
      "implicit": true,
      "options": [
        { "id": "lit_review", "label": "Literature review" },
        { "id": "comp_analysis", "label": "Competitive analysis" },
        { "id": "arch_doc", "label": "Architecture doc" },
        { "id": "api_design", "label": "API design" }
      ]
    }]
  }]
}
```

**Parsed Response:**
```json
{
  "_checkboxes": {
    "kind": "checkboxes",
    "values": {
      "lit_review": "todo",
      "comp_analysis": "todo",
      "arch_doc": "done",
      "api_design": "incomplete"
    }
  }
}
```

---

## Spec 2: Enclosing Headers Utility API (mf-qr24)

### Purpose

A low-level markdown utility that, given a position in a document, returns all enclosing
headers from innermost to outermost. This is a generic markdown utility, not
Markform-specific.

### File Location

`packages/markform/src/markdown/markdownHeaders.ts`

### API

```typescript
/**
 * Information about a markdown heading.
 */
interface HeadingInfo {
  /** Heading level (1-6 for h1-h6) */
  level: number;

  /** Heading text content (without # prefix) */
  title: string;

  /** Line number (1-indexed) where heading starts */
  line: number;

  /** Full source position */
  position: SourceRange;
}

/**
 * Find all headings in a markdown document.
 *
 * @param markdown - The markdown source text
 * @returns Array of all headings in document order
 */
function findAllHeadings(markdown: string): HeadingInfo[];

/**
 * Find all headings that enclose a given line position.
 *
 * Returns headings from innermost (most specific) to outermost (least specific).
 * A heading "encloses" a line if:
 * 1. The heading appears before the line
 * 2. No heading of equal or higher level appears between them
 *
 * @param markdown - The markdown source text
 * @param line - The line number (1-indexed) to find enclosing headings for
 * @returns Array of enclosing headings, innermost first
 *
 * @example
 * const md = `
 * # Chapter 1
 * ## Section A
 * ### Subsection i
 * Some content here  // line 5
 * `;
 *
 * findEnclosingHeadings(md, 5);
 * // Returns:
 * // [
 * //   { level: 3, title: "Subsection i", line: 4, ... },
 * //   { level: 2, title: "Section A", line: 3, ... },
 * //   { level: 1, title: "Chapter 1", line: 2, ... }
 * // ]
 */
function findEnclosingHeadings(markdown: string, line: number): HeadingInfo[];
```

### Implementation Notes

- Should use the existing Markdoc/markdown-it parser already in the codebase
- Line numbers are 1-indexed (matching source positions elsewhere)
- ATX headings only (`# Heading`), not setext (`Heading\n===`)
- Heading text should be trimmed of leading/trailing whitespace

---

## Spec 3: injectCheckboxIds API (mf-as7e)

### Purpose

A function that injects ID annotations into checkboxes that lack them, using a
user-provided generator function.

### File Location

`packages/markform/src/engine/injectIds.ts`

### API

```typescript
/**
 * Information about a checkbox found in markdown.
 */
interface CheckboxInfo {
  /** Existing ID, if any (from {% #id %} annotation) */
  id?: string;

  /** Checkbox label text */
  label: string;

  /** Current checkbox state from marker */
  state: CheckboxValue;

  /** Source position of the checkbox line */
  position: SourceRange;

  /** Enclosing headings, innermost first */
  enclosingHeadings: HeadingInfo[];
}

/**
 * Options for injecting checkbox IDs.
 */
interface InjectCheckboxIdsOptions {
  /**
   * Generator function to create IDs from checkbox info.
   * Receives the checkbox info and its 0-based index among checkboxes needing IDs.
   *
   * @example
   * // Simple prefix
   * generator: (info, idx) => `task_${idx + 1}`
   *
   * // Slugified label
   * generator: (info) => slugify(info.label)
   *
   * // Issue tracker style
   * generator: (info, idx) => `PROJ-${String(idx + 1).padStart(3, '0')}`
   */
  generator: (info: CheckboxInfo, index: number) => string;

  /**
   * If true, only inject IDs where missing. If false, replace all IDs.
   * @default true
   */
  onlyMissing?: boolean;
}

/**
 * Result of ID injection.
 */
interface InjectIdsResult {
  /** The modified markdown with IDs injected */
  markdown: string;

  /** Number of IDs injected */
  injectedCount: number;

  /** Map of checkbox label -> generated ID for reference */
  injectedIds: Map<string, string>;
}

/**
 * Find all checkboxes in a markdown document.
 *
 * @param markdown - The markdown source text
 * @returns Array of checkbox info objects in document order
 */
function findAllCheckboxes(markdown: string): CheckboxInfo[];

/**
 * Inject ID annotations into checkboxes.
 *
 * @param markdown - The markdown source text
 * @param options - Injection options including generator function
 * @returns Result with modified markdown and injection info
 * @throws MarkformParseError if generated IDs are not unique
 *
 * @example
 * const result = injectCheckboxIds(markdown, {
 *   generator: (info, idx) => `task_${idx + 1}`,
 * });
 *
 * console.log(result.markdown);
 * // - [ ] First task {% #task_1 %}
 * // - [ ] Second task {% #task_2 %}
 */
function injectCheckboxIds(
  markdown: string,
  options: InjectCheckboxIdsOptions
): InjectIdsResult;
```

### Validation

After injection, the function MUST validate:

1. **Uniqueness within scope**: All checkbox IDs must be unique within their containing
   field (or globally for implicit checkboxes mode)

2. **No conflicts with existing IDs**: Generated IDs must not conflict with:
   - Existing checkbox IDs (if `onlyMissing: true`)
   - Field IDs
   - Group IDs
   - Form ID

If validation fails, throw `MarkformParseError` with descriptive message:
```
Generated checkbox ID 'task_1' conflicts with existing ID at line 15
```

### ID Format

Generated IDs must be valid Markform IDs:
- Start with letter or underscore
- Contain only letters, numbers, underscores, hyphens
- Not be a reserved ID (`_checkboxes`, `_default`, etc.)

If the generator produces an invalid ID, throw `MarkformParseError`:
```
Invalid generated ID '123-task': must start with letter or underscore
```

---

## Spec 4: injectHeaderIds API (mf-47tn)

### Purpose

A function that injects ID annotations into markdown headings, using a user-provided
generator function.

### File Location

`packages/markform/src/engine/injectIds.ts` (same file as checkbox injection)

### API

```typescript
/**
 * Options for injecting header IDs.
 */
interface InjectHeaderIdsOptions {
  /**
   * Generator function to create IDs from heading info.
   *
   * @example
   * // Slugified title
   * generator: (info) => slugify(info.title)
   *
   * // Prefixed
   * generator: (info) => `section_${slugify(info.title)}`
   */
  generator: (info: HeadingInfo, index: number) => string;

  /**
   * If true, only inject IDs where missing. If false, replace all IDs.
   * @default true
   */
  onlyMissing?: boolean;

  /**
   * Which heading levels to inject IDs for.
   * @default [1, 2, 3, 4, 5, 6] (all levels)
   */
  levels?: number[];
}

/**
 * Inject ID annotations into markdown headings.
 *
 * @param markdown - The markdown source text
 * @param options - Injection options including generator function
 * @returns Result with modified markdown and injection info
 * @throws MarkformParseError if generated IDs are not unique
 *
 * @example
 * const result = injectHeaderIds(markdown, {
 *   generator: (info) => slugify(info.title),
 *   levels: [2, 3], // Only h2 and h3
 * });
 *
 * console.log(result.markdown);
 * // ## Introduction {% #introduction %}
 * // ### Background {% #background %}
 */
function injectHeaderIds(
  markdown: string,
  options: InjectHeaderIdsOptions
): InjectIdsResult;
```

### Validation

Header IDs are globally unique within the document. After injection, validate:

1. **Global uniqueness**: All header IDs must be unique across the document
2. **No conflicts**: Generated IDs must not conflict with existing header IDs

If validation fails, throw `MarkformParseError`:
```
Generated header ID 'introduction' conflicts with existing ID at line 5
```

---

## Testing Strategy

### Golden Tests (Snapshot-based)

Golden tests compare actual output against stored expected output files.

#### Structure

```
packages/markform/src/__tests__/
├── goldens/
│   └── implicit-checkboxes/
│       ├── basic-plan/
│       │   ├── input.md          # Input markdown
│       │   ├── schema.json       # Expected parsed schema
│       │   └── response.json     # Expected parsed response
│       ├── nested-sections/
│       │   ├── input.md
│       │   ├── schema.json
│       │   └── response.json
│       ├── inject-checkbox-ids/
│       │   ├── input.md          # Markdown without IDs
│       │   ├── output.md         # Expected markdown with IDs
│       │   └── options.json      # Generator config
│       ├── inject-header-ids/
│       │   ├── input.md
│       │   ├── output.md
│       │   └── options.json
│       └── errors/
│           ├── missing-id/
│           │   ├── input.md
│           │   └── error.json    # Expected error
│           ├── duplicate-id/
│           │   ├── input.md
│           │   └── error.json
│           └── mixed-explicit-implicit/
│               ├── input.md
│               └── error.json
```

#### Test Cases

**Implicit Checkboxes Parsing (mf-6tit)**

1. `basic-plan`: Simple plan with flat checkboxes
2. `nested-sections`: Checkboxes under multiple heading levels
3. `all-states`: Checkboxes in all 5 multi states
4. `empty-form`: Form with no checkboxes (should have empty implicit field)
5. `with-other-content`: Form with text, code blocks, etc. alongside checkboxes

**injectCheckboxIds (mf-vp5c)**

1. `prefix-generator`: Simple `task_N` prefix
2. `slugify-label`: ID from slugified label
3. `issue-tracker`: `PROJ-001` style IDs
4. `only-missing`: Preserve existing IDs, inject missing
5. `replace-all`: Replace all IDs
6. `with-context`: Generator uses enclosing headings

**injectHeaderIds (mf-b1l4)**

1. `slugify-title`: ID from slugified title
2. `specific-levels`: Only inject for h2/h3
3. `preserve-existing`: Only inject where missing

**Error Cases (mf-02bp)**

1. `duplicate-checkbox-id`: Same ID on two checkboxes
2. `duplicate-header-id`: Same ID on two headers
3. `generated-conflict`: Generated ID conflicts with existing
4. `invalid-generated-id`: Generator returns invalid ID format
5. `reserved-id`: Generator returns reserved ID like `_checkboxes`

### Unit Tests

**markdownHeaders utility (mf-1g95)**

```typescript
describe('findAllHeadings', () => {
  it('finds ATX headings at all levels');
  it('ignores headings in code blocks');
  it('handles empty document');
  it('handles document with no headings');
});

describe('findEnclosingHeadings', () => {
  it('returns innermost heading first');
  it('stops at same-level heading');
  it('handles line at document start');
  it('handles line in heading itself');
  it('handles deeply nested structure');
});
```

---

## Implementation Order

Based on dependencies:

### Phase 1: Spec (Ready Now)
1. mf-rtp7: Define implicit checkboxes field behavior ← this doc
2. mf-qr24: Define enclosing headers utility API ← this doc
3. mf-as7e: Define injectCheckboxIds API ← this doc
4. mf-47tn: Define injectHeaderIds API ← this doc

### Phase 2: Code (After Spec)
1. mf-r5wq: Implement markdownHeaders.ts utility
2. mf-s84s: Implement findAllCheckboxes function (depends on r5wq)
3. mf-3t1l: Implement injectCheckboxIds function (depends on s84s)
4. mf-it7y: Implement injectHeaderIds function (depends on 47tn)
5. mf-smlt: Update parser to support implicit checkboxes field
6. mf-vitr: Export new APIs from index.ts

### Phase 3: Test (After Code)
1. mf-1g95: Unit tests for markdownHeaders utility
2. mf-6tit: Golden tests for implicit checkboxes parsing
3. mf-vp5c: Golden tests for injectCheckboxIds
4. mf-b1l4: Golden tests for injectHeaderIds
5. mf-02bp: Error case tests for ID uniqueness validation

### Phase 4: Docs (Can Start After Spec)
1. mf-b3sz: Update markform-spec.md with implicit checkboxes
2. mf-aex2: Update markform-reference.md with new APIs
3. mf-m8mu: Add examples for plan documents

---

## Open Questions

1. **Should frontmatter be required for implicit checkboxes?**
   - Current design: `{% form %}` wrapper required
   - Alternative: Allow any markdown with checkboxes to be parsed with option

2. **Patch API for implicit field**
   - Patches should work normally with field ID `_checkboxes`
   - Confirm this doesn't break existing tools

3. **Progress summary for implicit field**
   - Should work same as explicit checkboxes field
   - Label shown as "Checkboxes" in summaries
