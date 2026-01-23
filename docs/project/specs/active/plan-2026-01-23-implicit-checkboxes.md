# Plan Spec: Implicit Checkboxes

## Purpose

Enable "plan documents" — markdown documents with checkboxes but without explicit field
wrappers — to be parsed as valid Markforms. This simplifies authoring task lists, project
plans, and checklists while maintaining full Markform semantics.

## Background

Many real-world documents are task lists or plans:
- Project plans with phases and tasks
- Checklists with section headers
- Issue trackers with nested tasks

Currently, Markform requires explicit `{% field kind="checkboxes" %}` wrappers around
checkbox lists. This creates friction for simple plan documents where the entire doc is
essentially one big task list.

**Related docs:**
- `docs/markform-spec.md` — Main specification (Layer 1-4)
- `docs/markform-reference.md` — Quick reference
- `docs/markform-apis.md` — API documentation

## Summary of Task

1. **Implicit checkboxes field**: Forms with no explicit fields but with checkboxes get
   an automatic implicit checkboxes field wrapping all checkboxes

2. **Markdown headers utility**: Low-level API to find enclosing headings for any position

3. **ID injection APIs**: Functions to inject IDs into checkboxes and headers using
   generator functions

4. **Spec updates**: Document the new behavior in the main specification

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: MAINTAIN — new APIs are additive
- **Library APIs**: MAINTAIN — existing parseForm behavior unchanged by default
- **Server APIs**: N/A
- **File formats**: MAINTAIN — existing forms work unchanged; implicit mode is opt-in
- **Database schemas**: N/A

## Stage 1: Planning Stage

### Scope

**In scope:**

- Implicit checkboxes field when form has no explicit `{% field %}` tags
- Always `checkboxMode="multi"` for implicit field (user must use explicit field for other modes)
- `findAllHeadings()` and `findEnclosingHeadings()` utility functions
- `findAllCheckboxes()` function with enclosing heading info
- `injectCheckboxIds()` with generator function and uniqueness validation
- `injectHeaderIds()` with generator function and uniqueness validation
- Spec updates for implicit checkboxes behavior
- Golden tests for all new functionality

**Not in scope:**

- Auto-generating IDs from labels (generator function is required)
- Implicit checkboxes without `{% form %}` wrapper (still need form tag)
- Simple or explicit checkbox modes for implicit field
- Changes to existing explicit field behavior

### Acceptance Criteria

1. Form with `{% form %}` but no `{% field %}` tags and with checkboxes parses successfully
2. All checkboxes become options in implicit `_checkboxes` field
3. Checkboxes without ID annotations produce `MarkformParseError`
4. Forms with explicit fields AND checkboxes outside fields produce `MarkformParseError`
5. `findAllHeadings()` returns all headings in document order
6. `findEnclosingHeadings(markdown, line)` returns headings from innermost to outermost
7. `injectCheckboxIds()` injects IDs and validates uniqueness
8. `injectHeaderIds()` injects IDs and validates global uniqueness
9. All existing tests pass unchanged
10. Documentation is complete in spec and reference

### Design Decisions

1. **Implicit field is always multi-mode**: If user wants simple or explicit checkbox mode,
   they must use explicit `{% field %}` tags. This keeps implicit mode simple.

2. **Form wrapper required**: A `{% form %}` tag is still required for implicit checkboxes.
   This maintains the clear boundary of "this is a Markform."

3. **ID annotations required**: Checkboxes in implicit mode must have `{% #id %}` annotations.
   Use `injectCheckboxIds()` to add them programmatically.

4. **Reserved field ID**: The implicit checkboxes field uses ID `_checkboxes` (reserved).

5. **Error on mixed mode**: Having explicit fields AND checkboxes outside fields is an error.
   Either use all explicit fields or no explicit fields.

6. **Enclosing headings order**: `findEnclosingHeadings()` returns innermost first (the
   most specific heading), then progressively larger sections up to h1.

### Error Semantics

| Condition | Error Message |
| --- | --- |
| Checkbox without ID in implicit mode | `Option in implicit field '_checkboxes' missing ID annotation. Use {% #option_id %}` |
| Duplicate checkbox ID | `Duplicate option ID 'xxx' in field '_checkboxes'` |
| Explicit field with ID `_checkboxes` | `Field ID '_checkboxes' is reserved for implicit checkboxes` |
| Checkboxes outside fields when explicit fields exist | `Checkboxes found outside of field tags. Either wrap all checkboxes in fields or remove all explicit fields for implicit checkboxes mode.` |
| Generated ID conflicts with existing | `Generated ID 'xxx' conflicts with existing ID at line N` |
| Invalid generated ID format | `Invalid generated ID 'xxx': must start with letter or underscore` |

## Stage 2: Architecture Stage

### New Files

```
packages/markform/src/
├── markdown/
│   └── markdownHeaders.ts      # Low-level heading utilities
└── engine/
    └── injectIds.ts            # ID injection functions
```

### API Design

#### 1. Markdown Headers Utility

**File:** `packages/markform/src/markdown/markdownHeaders.ts`

```typescript
import { SourceRange } from '../engine/coreTypes.js';

/**
 * Information about a markdown heading.
 */
export interface HeadingInfo {
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
 * Returns headings in document order.
 */
export function findAllHeadings(markdown: string): HeadingInfo[];

/**
 * Find all headings that enclose a given line position.
 * Returns headings from innermost (most specific) to outermost (least specific).
 *
 * A heading "encloses" a line if:
 * 1. The heading appears before the line
 * 2. No heading of equal or higher level appears between them
 *
 * @param markdown - The markdown source text
 * @param line - The line number (1-indexed)
 * @returns Array of enclosing headings, innermost first
 */
export function findEnclosingHeadings(markdown: string, line: number): HeadingInfo[];
```

#### 2. ID Injection Functions

**File:** `packages/markform/src/engine/injectIds.ts`

```typescript
import { CheckboxValue, SourceRange } from './coreTypes.js';
import { HeadingInfo } from '../markdown/markdownHeaders.js';

/**
 * Information about a checkbox found in markdown.
 */
export interface CheckboxInfo {
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
 * Find all checkboxes in a markdown document.
 * Returns checkboxes in document order with enclosing heading info.
 */
export function findAllCheckboxes(markdown: string): CheckboxInfo[];

/**
 * Options for injecting checkbox IDs.
 */
export interface InjectCheckboxIdsOptions {
  /**
   * Generator function to create IDs from checkbox info.
   * @param info - Checkbox info including label and enclosing headings
   * @param index - 0-based index among checkboxes needing IDs
   * @returns The ID to inject
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
export interface InjectIdsResult {
  /** The modified markdown with IDs injected */
  markdown: string;

  /** Number of IDs injected */
  injectedCount: number;

  /** Map of original checkbox label -> generated ID */
  injectedIds: Map<string, string>;
}

/**
 * Inject ID annotations into checkboxes.
 * Validates uniqueness and throws MarkformParseError on conflicts.
 */
export function injectCheckboxIds(
  markdown: string,
  options: InjectCheckboxIdsOptions
): InjectIdsResult;

/**
 * Options for injecting header IDs.
 */
export interface InjectHeaderIdsOptions {
  /**
   * Generator function to create IDs from heading info.
   */
  generator: (info: HeadingInfo, index: number) => string;

  /**
   * If true, only inject IDs where missing.
   * @default true
   */
  onlyMissing?: boolean;

  /**
   * Which heading levels to inject IDs for.
   * @default [1, 2, 3, 4, 5, 6]
   */
  levels?: number[];
}

/**
 * Inject ID annotations into markdown headings.
 * Validates global uniqueness and throws MarkformParseError on conflicts.
 */
export function injectHeaderIds(
  markdown: string,
  options: InjectHeaderIdsOptions
): InjectIdsResult;
```

#### 3. Parser Changes for Implicit Checkboxes

**File:** `packages/markform/src/engine/parse.ts`

Add detection of implicit checkboxes mode:
1. After parsing, check if form has any explicit fields
2. If no fields, scan for checkboxes in the document
3. If checkboxes found, create implicit field with ID `_checkboxes`
4. Validate all checkboxes have ID annotations
5. If explicit fields exist AND checkboxes outside fields, throw error

### Exports

Add to `packages/markform/src/index.ts`:

```typescript
// Markdown utilities
export { findAllHeadings, findEnclosingHeadings } from './markdown/markdownHeaders.js';
export type { HeadingInfo } from './markdown/markdownHeaders.js';

// ID injection
export {
  findAllCheckboxes,
  injectCheckboxIds,
  injectHeaderIds,
} from './engine/injectIds.js';
export type {
  CheckboxInfo,
  InjectCheckboxIdsOptions,
  InjectHeaderIdsOptions,
  InjectIdsResult,
} from './engine/injectIds.js';
```

## Stage 3: Refine Architecture

### Reusable Components

- **Existing markdown parser**: Use Markdoc's AST for heading detection
- **Existing checkbox parsing**: Reuse `parseOptionText()` and `CHECKBOX_MARKERS` from
  `parseFields.ts`
- **Existing error types**: Use `MarkformParseError` for all validation errors
- **Existing source position tracking**: Reuse `SourceRange` type

### Simplifications

- The heading utility is pure markdown, no Markform dependencies
- `findAllCheckboxes()` can use the heading utility internally
- ID injection functions work on raw markdown strings, not parsed forms

## Stage 4: Implementation

### Phase 1: Markdown Headers Utility

**Tasks:**
- [ ] Create `packages/markform/src/markdown/markdownHeaders.ts`
- [ ] Implement `findAllHeadings()` using Markdoc AST
- [ ] Implement `findEnclosingHeadings()` with correct ordering (innermost first)
- [ ] Add unit tests for edge cases (nested headings, code blocks, empty docs)
- [ ] Export from `index.ts`

**Golden tests:**
- `basic-headings`: Document with h1, h2, h3 headings
- `nested-sections`: Deeply nested heading structure
- `headings-in-code`: Headings inside code blocks (should be ignored)

### Phase 2: Checkbox Discovery

**Tasks:**
- [ ] Create `packages/markform/src/engine/injectIds.ts`
- [ ] Implement `findAllCheckboxes()` returning `CheckboxInfo[]`
- [ ] Include enclosing headings for each checkbox
- [ ] Add unit tests
- [ ] Export from `index.ts`

**Golden tests:**
- `basic-checkboxes`: Simple list of checkboxes
- `checkboxes-with-headings`: Checkboxes under various heading levels
- `all-checkbox-states`: All 5 multi-mode states

### Phase 3: ID Injection

**Tasks:**
- [ ] Implement `injectCheckboxIds()` with generator and validation
- [ ] Implement `injectHeaderIds()` with generator and validation
- [ ] Add uniqueness validation (throw `MarkformParseError` on conflict)
- [ ] Add ID format validation (must start with letter or underscore)
- [ ] Add unit tests for error cases
- [ ] Export from `index.ts`

**Golden tests:**
- `inject-prefix`: Simple `task_N` prefix generator
- `inject-slugify`: Slugified label generator
- `inject-only-missing`: Preserve existing, inject missing
- `inject-with-context`: Generator using enclosing headings
- Error cases: duplicate IDs, invalid format, conflicts

### Phase 4: Implicit Checkboxes Parser

**Tasks:**
- [ ] Update `parse.ts` to detect implicit checkboxes mode
- [ ] Create implicit field with ID `_checkboxes`, label `Checkboxes`
- [ ] Set `checkboxMode: 'multi'` and `implicit: true`
- [ ] Validate all checkboxes have ID annotations
- [ ] Add error for mixed explicit/implicit mode
- [ ] Add reserved ID check for `_checkboxes`
- [ ] Add unit tests

**Golden tests:**
- `implicit-basic`: Simple plan document
- `implicit-nested`: Plan with nested sections
- `implicit-all-states`: All checkbox states in implicit mode
- Error cases: missing IDs, mixed mode, reserved ID conflict

### Phase 5: Spec Updates

**Tasks:**
- [ ] Add "Implicit Checkboxes" section to `docs/markform-spec.md` Layer 1
- [ ] Document behavior, error conditions, reserved ID
- [ ] Add examples of implicit checkboxes forms
- [ ] Update `docs/markform-reference.md` with new APIs
- [ ] Update `docs/markform-apis.md` with API details
- [ ] Add plan document examples to examples directory

**Spec changes to `docs/markform-spec.md`:**

Add new section after "Checkboxes Fields" (~line 633):

```markdown
##### Implicit Checkboxes (Plan Documents)

Forms designed as task lists or plans can omit explicit field wrappers. When a form
contains:
- A `{% form %}` wrapper
- No explicit `{% field %}` tags
- Standard markdown checkboxes (`- [ ] Item {% #id %}`)

The parser automatically creates an implicit checkboxes field:
- ID: `_checkboxes` (reserved)
- Label: `Checkboxes`
- Mode: `multi` (always)
- Options: All checkboxes in document order

**Example implicit checkboxes form:**
```md
---
markform:
  spec: MF/0.1
  title: Project Plan
---
{% form id="plan" title="Project Plan" %}

## Phase 1: Research
- [ ] Literature review {% #lit_review %}
- [ ] Competitive analysis {% #comp %}

## Phase 2: Design
- [x] Architecture doc {% #arch %}
- [/] API design {% #api %}

{% /form %}
```

**Requirements:**
- Each checkbox MUST have an ID annotation (`{% #id %}`)
- ID `_checkboxes` is reserved and MUST NOT be used for explicit fields

**Errors:**
- Missing checkbox ID: `Option in implicit field '_checkboxes' missing ID annotation`
- Mixed mode (explicit fields with checkboxes outside): Error, must choose one approach
```

### Phase 6: Final Validation

**Tasks:**
- [ ] Run full test suite: `pnpm precommit`
- [ ] Verify all golden tests pass
- [ ] Manual test: create plan document, parse, inspect
- [ ] Verify spec documentation is complete
- [ ] Verify API documentation is complete

## Stage 5: Validation

### Final Checklist

- [ ] `pnpm precommit` passes
- [ ] All golden tests pass
- [ ] Manual inspection of plan document works
- [ ] Spec documentation complete in `markform-spec.md`
- [ ] API reference complete in `markform-reference.md`
- [ ] API details complete in `markform-apis.md`
- [ ] New functions exported from `index.ts`

### Verification Commands

```bash
# Run all tests
pnpm precommit

# Test implicit checkboxes parsing
echo '---
markform:
  spec: MF/0.1
---
{% form id="test" title="Test" %}
- [ ] Task one {% #task1 %}
- [x] Task two {% #task2 %}
{% /form %}' | pnpm markform inspect -

# Test ID injection (once implemented)
# Use programmatic test or add CLI command

# Verify exports
grep -n "findAllHeadings\|findEnclosingHeadings\|findAllCheckboxes\|injectCheckboxIds\|injectHeaderIds" packages/markform/src/index.ts
```

## Appendix: Issue Tracking

**Epic:** mf-djfs - Implicit Checkboxes Feature

**Spec tasks (ready):**
- mf-rtp7: Define implicit checkboxes field behavior
- mf-qr24: Define enclosing headers utility API
- mf-as7e: Define injectCheckboxIds API
- mf-47tn: Define injectHeaderIds API

**Code tasks:**
- mf-r5wq: Implement markdownHeaders.ts utility
- mf-s84s: Implement findAllCheckboxes function
- mf-3t1l: Implement injectCheckboxIds function
- mf-it7y: Implement injectHeaderIds function
- mf-smlt: Update parser to support implicit checkboxes field
- mf-vitr: Export new APIs from index.ts

**Test tasks:**
- mf-1g95: Unit tests for markdownHeaders utility
- mf-6tit: Golden tests for implicit checkboxes parsing
- mf-vp5c: Golden tests for injectCheckboxIds
- mf-b1l4: Golden tests for injectHeaderIds
- mf-02bp: Error case tests for ID uniqueness validation

**Doc tasks:**
- mf-b3sz: Update markform-spec.md with implicit checkboxes
- mf-aex2: Update markform-reference.md with new APIs
- mf-m8mu: Add examples for plan documents
