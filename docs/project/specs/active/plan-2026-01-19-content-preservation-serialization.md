# Plan Spec: Content Preservation in Canonical Serialization

## Purpose

This technical design document defines the implementation of **full content preservation**
during Markform canonical serialization. The goal is to ensure that all markdown content
outside of Markform tags is preserved through parse → serialize round-trips, maintaining
document structure and semantic equivalence.

This addresses a gap between the Markform specification (which requires content preservation)
and the current implementation (which only preserves HTML comments and content within
Markform tags).

## Background

The Markform specification (MF/0.1) was recently clarified to explicitly require content
preservation:

> **Content preservation semantics (*required*):**
>
> - *required:* All markdown content outside of Markform tags MUST be preserved on
>   canonical serialization
>
> - *required:* The markdown structure MUST be equivalent after round-trip (same headings,
>   paragraphs, lists, code blocks, etc.)
>
> - *recommended:* Visual appearance SHOULD be preserved (same rendering output)

However, the current implementation does NOT preserve this content:

1. **Parser** (`parse.ts`): Extracts only form schema, responses, notes, and doc blocks.
   No storage of content outside form tags.

2. **Serializer** (`serialize.ts`): Regenerates markdown entirely from structured data.
   Content outside form structure is lost.

3. **ParsedForm interface**: Has no field for storing raw/outside content.

**Related Documentation:**

- [Markform Specification](../../../markform-spec.md) - Section "Non-Markform content policy"
- [Current Parser](../../../../packages/markform/src/engine/parse.ts)
- [Current Serializer](../../../../packages/markform/src/engine/serialize.ts)
- [Core Types](../../../../packages/markform/src/engine/coreTypes.ts) - `ParsedForm` interface

## Summary of Task

Implement **raw slicing** to preserve all markdown content outside of Markform tags during
canonical serialization:

1. **Raw Content Storage**: Store original markdown text alongside parsed structure
2. **Position Tracking**: Track byte/character positions of Markform tags in source
3. **Splice-based Serialization**: Replace only Markform tag regions during serialization
4. **Structure Equivalence**: Ensure round-trip produces structurally equivalent markdown

**Core Approach - Raw Slicing:**

Rather than regenerating the entire document, the serializer will:
1. Keep the original source text
2. Identify regions containing Markform tags
3. Serialize only those regions (with canonical formatting)
4. Splice the serialized regions back into the original text

This preserves all content outside Markform tags verbatim while still producing
canonical Markform tag formatting.

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: DO NOT MAINTAIN
  - Internal changes to `ParsedForm` interface are additive
  - New fields are optional for backward compatibility during transition

- **Library APIs**: KEEP DEPRECATED for one release
  - `parseForm()` signature unchanged - returns enhanced `ParsedForm`
  - `serializeForm()` unchanged - automatically uses raw slicing when source available
  - New optional `preserveContent` option defaults to `true`

- **Server APIs**: N/A
  - No server component affected

- **File formats**: SUPPORT BOTH
  - Existing forms work unchanged
  - New behavior: content outside tags is preserved
  - Old behavior (regenerate from scratch) available via `preserveContent: false`

- **Database schemas**: N/A
  - No database component affected

## Stage 1: Planning Stage

### Feature Requirements

**Core Requirements:**

1. **Preserve all markdown content** - Headings, paragraphs, lists, code blocks outside
   form tags must survive round-trip
2. **Structural equivalence** - The markdown structure must be equivalent after round-trip
3. **Visual appearance preservation** - Rendering output should be identical (recommended)
4. **Backward compatible API** - Existing code using `parseForm`/`serializeForm` works unchanged
5. **Opt-out capability** - Allow regeneration from scratch when needed (e.g., normalization)

**Acceptance Criteria:**

- [ ] Markdown headings before form tag are preserved after round-trip
- [ ] Markdown paragraphs between groups are preserved after round-trip
- [ ] Code blocks outside form tags are preserved after round-trip
- [ ] Lists and other markdown structures are preserved
- [ ] Markform tags are serialized in canonical format
- [ ] Round-trip produces parseable, valid Markform document
- [ ] All existing tests continue passing
- [ ] New tests verify content preservation
- [ ] Golden tests validate round-trip fidelity

**Out of Scope:**

- Preserving arbitrary Markdoc tags (non-Markform) - these remain ignored per spec
- Preserving exact whitespace within Markform tags - canonical formatting applies
- Source mapping for error messages
- Incremental parsing (full re-parse on each operation)

### Feature Scope

| Area | In Scope | Out of Scope |
| --- | --- | --- |
| Parsing | Store raw source + position info | Incremental parsing |
| Serialization | Splice-based content preservation | Full markdown serializer |
| Data Model | Add optional fields to ParsedForm | Breaking interface changes |
| Tests | Unit + integration + golden for preservation | Performance benchmarks |
| Specification | Already updated | N/A |

### Key Questions — RESOLVED

1. **Granularity of preservation**: Should we preserve at form-level (before/after form)
   or at tag-level (between every tag)?

   **Decision**: Tag-level for maximum fidelity. Store positions for all Markform tags.

2. **Handling of tag modifications**: When a field is added/removed/reordered, how do we
   handle the surrounding content?

   **Decision**: Content between tags is associated with preceding tag. New tags
   get minimal spacing. Removed tags' trailing content attaches to previous tag.
   Reordering falls back to regeneration mode.

3. **Frontmatter handling**: Frontmatter is already handled specially - should it be
   part of raw slicing or remain separate?

   **Decision**: Keep frontmatter handling separate (already works well). The
   `rawSource` stores post-frontmatter content; frontmatter is managed independently.

4. **Doc block content preservation**: Should content within `{% documentation %}` blocks
   be preserved verbatim?

   **Decision**: Yes. Doc blocks already store `bodyMarkdown` as raw text. The raw
   slicing approach naturally preserves this since doc block regions are replaced
   with their canonical serialization which includes the stored `bodyMarkdown`.

5. **Programmatically created forms**: How to handle forms with no source?

   **Decision**: Always regenerate. If `rawSource` is undefined, fall back to
   current regeneration behavior. This is the existing behavior and remains correct.

6. **CLI normalization option**: Should there be an option to force regeneration?

   **Decision**: Yes. Add `--normalize` flag to relevant CLI commands that sets
   `preserveContent: false`. Useful for standardizing form formatting.

## Stage 2: Architecture Stage

### Current Architecture

```
┌─────────────┐      ┌──────────────────┐      ┌────────────────┐
│  .form.md   │ ──▶  │  parseForm()     │ ──▶  │  ParsedForm    │
│  (source)   │      │  - Extract tags  │      │  - schema      │
└─────────────┘      │  - Build schema  │      │  - responses   │
                     │  - Discard rest  │      │  - notes, docs │
                     └──────────────────┘      └────────────────┘
                                                       │
                                                       ▼
                     ┌──────────────────┐      ┌────────────────┐
                     │  serializeForm() │ ◀──  │  Regenerate    │
                     │  - Build from    │      │  entire doc    │
                     │    structured    │      │                │
                     │    data only     │      └────────────────┘
                     └──────────────────┘
                            │
                            ▼
                     ┌─────────────┐
                     │  .form.md   │  (content outside tags LOST)
                     │  (output)   │
                     └─────────────┘
```

### Proposed Architecture

```
┌─────────────┐      ┌──────────────────┐      ┌────────────────────────┐
│  .form.md   │ ──▶  │  parseForm()     │ ──▶  │  ParsedForm            │
│  (source)   │      │  - Extract tags  │      │  - schema              │
└─────────────┘      │  - Build schema  │      │  - responses           │
       │             │  - Store source  │      │  - notes, docs         │
       │             │  - Track positions│      │  - rawSource (NEW)    │
       │             └──────────────────┘      │  - tagRegions (NEW)    │
       │                                       └────────────────────────┘
       │                                                │
       │                                                ▼
       │             ┌──────────────────┐      ┌────────────────────────┐
       └───────────▶ │  serializeForm() │ ◀──  │  Splice-based          │
         (preserved) │  - Serialize tags│      │  serialization         │
                     │  - Splice into   │      │  - Keep outside content│
                     │    original      │      │  - Replace tag regions │
                     └──────────────────┘      └────────────────────────┘
                            │
                            ▼
                     ┌─────────────┐
                     │  .form.md   │  (content outside tags PRESERVED)
                     │  (output)   │
                     └─────────────┘
```

### Data Model Changes

**New fields in ParsedForm:**

```typescript
export interface ParsedForm {
  // Existing fields
  schema: FormSchema;
  responsesByFieldId: Record<Id, FieldResponse>;
  notes: Note[];
  docs: DocumentationBlock[];
  orderIndex: Id[];
  idIndex: Map<Id, IdIndexEntry>;
  metadata?: FormMetadata;
  syntaxStyle?: SyntaxStyle;

  // NEW: Raw source preservation
  rawSource?: string;           // Original markdown source (post-frontmatter extraction)
  tagRegions?: TagRegion[];     // Positions of all Markform tags in source
}

/**
 * Tag types that can appear in Markform documents.
 * Note: 'note' refers to the `<!-- note ... -->` inline tag.
 */
type TagType = 'form' | 'group' | 'field' | 'note' | 'documentation';

/** Position of a Markform tag region in the source */
interface TagRegion {
  /** ID of the element (form, group, field ID, or note ID) */
  tagId: Id;
  /** Type of Markform tag */
  tagType: TagType;
  /** Start position in rawSource (inclusive, byte offset) */
  startOffset: number;
  /** End position in rawSource (exclusive, byte offset) */
  endOffset: number;
  /**
   * For field tags: whether region includes value fence.
   * True if field has a value block between open/close tags.
   */
  includesValue?: boolean;
}
```

**New serialization options:**

```typescript
export interface SerializeOptions {
  // Existing options...

  /**
   * Whether to preserve content outside Markform tags.
   * - true (default): Use raw slicing to preserve outside content
   * - false: Regenerate entire document from structured data
   */
  preserveContent?: boolean;
}
```

### Serialization Algorithm

```typescript
function serializeForm(form: ParsedForm, opts?: SerializeOptions): string {
  // If no raw source, preservation disabled, or structural changes detected
  if (!form.rawSource || !form.tagRegions || opts?.preserveContent === false) {
    return serializeFormFromScratch(form, opts);
  }

  // Detect structural changes that require full regeneration
  if (hasStructuralChanges(form)) {
    return serializeFormFromScratch(form, opts);
  }

  // Sort regions by position (descending) to splice from end
  const regions = [...form.tagRegions].sort((a, b) => b.startOffset - a.startOffset);

  let result = form.rawSource;

  for (const region of regions) {
    // Serialize this tag to canonical format
    const serialized = serializeTagRegion(region, form);

    // Splice into result
    result = result.slice(0, region.startOffset) +
             serialized +
             result.slice(region.endOffset);
  }

  // Handle frontmatter separately (recompute and prepend)
  result = updateFrontmatter(result, form);

  return result;
}

/**
 * Detect changes that require full regeneration:
 * - Tags added (no position in tagRegions)
 * - Tags removed (position exists but ID not in schema)
 * - Tags reordered (positions don't match schema order)
 */
function hasStructuralChanges(form: ParsedForm): boolean {
  // Implementation checks for added/removed/reordered elements
  // Returns true if splice-based approach won't work correctly
}
```

### Edge Cases

1. **New tags added**: Detected by `hasStructuralChanges()` → fall back to regeneration
2. **Tags removed**: Detected by `hasStructuralChanges()` → fall back to regeneration
3. **Tags reordered**: Detected by `hasStructuralChanges()` → fall back to regeneration
4. **Value-only changes**: Handled by splice - region includes value fence
5. **Source not available**: Fall back to existing regeneration behavior
6. **Comment syntax forms**: `rawSource` stores preprocessed (tag syntax) form;
   `postprocessToCommentSyntax()` applied after splice serialization

## Stage 3: Refine Architecture

### Reusable Components

**Existing code to leverage:**

1. **`detectSyntaxStyle()`** - Already tracks original syntax style
2. **`preprocessCommentSyntax()`** - Transforms source, need to track position mapping
3. **`postprocessToCommentSyntax()`** - Reverse transform for output
4. **Markdoc AST** - Has position information via `node.location`

**Key insight**: Markdoc's AST contains `location` information for each node:

```typescript
interface Location {
  start: { line: number; character: number; offset?: number };
  end: { line: number; character: number; offset?: number };
}
```

We leverage this for position tracking. The `offset` field provides byte positions
directly usable for slicing.

### Position Tracking Strategy

1. **Store preprocessed source**: `rawSource` contains the Markdoc tag-syntax version
   (after `preprocessCommentSyntax()` for comment-syntax files)

2. **Extract positions during parsing**: As Markdoc AST is traversed, extract `location`
   from each Markform tag node and store in `tagRegions`

3. **Handle comment syntax**: For comment-syntax files:
   - Parse after preprocessing (tag syntax)
   - Store preprocessed source as `rawSource`
   - After splice serialization, apply `postprocessToCommentSyntax()`

### Performance Considerations

- **Memory**: Storing raw source adds ~1x memory per form (source text size)
- **CPU**: Splice-based serialization is O(n × m) where n = tags, m = source length
- **Mitigation**: For very large forms (>100KB), could add size threshold for fallback

**Decision**: No performance concern for typical forms. Defer optimization until needed.

## Stage 4: Implementation Plan

### Phase 1: Core Infrastructure

**Goal**: Add raw source storage and position tracking without changing serialization behavior.

**Tasks:**

- [ ] Add `TagRegion` type to `coreTypes.ts`
- [ ] Add `rawSource?: string` field to `ParsedForm` interface
- [ ] Add `tagRegions?: TagRegion[]` field to `ParsedForm` interface
- [ ] Modify `parseForm()` to store preprocessed source in `rawSource`
- [ ] Modify `parseForm()` to extract tag positions from Markdoc AST `location` fields
- [ ] Add unit tests for position tracking accuracy
- [ ] Verify all existing tests pass (no behavior change yet)

**Estimated scope**: ~200 lines code, ~100 lines tests

### Phase 2: Splice-based Serialization

**Goal**: Implement content-preserving serialization as the default.

**Tasks:**

- [ ] Add `preserveContent` option to `SerializeOptions`
- [ ] Create `serializeTagRegion()` helper function
- [ ] Create `hasStructuralChanges()` detection function
- [ ] Implement splice algorithm in `serializeForm()`
- [ ] Handle edge case: missing `rawSource` (fall back to regeneration)
- [ ] Handle edge case: structural changes detected (fall back to regeneration)
- [ ] Add unit tests for content preservation
- [ ] Add unit tests for fallback scenarios

**Estimated scope**: ~300 lines code, ~200 lines tests

### Phase 3: Testing and Validation

**Goal**: Comprehensive test coverage ensuring spec compliance.

**Tasks:**

- [ ] Create dedicated `serialize-preservation.test.ts` test file
- [ ] Add round-trip fidelity tests (see Testing Strategy below)
- [ ] Add golden test form with complex markdown content
- [ ] Enhance existing golden tests to verify content preservation
- [ ] Test with all example forms from `examples/`
- [ ] Add CLI `--normalize` flag integration test
- [ ] Update documentation

**Estimated scope**: ~400 lines tests, ~50 lines docs

### Phase 4: Polish and Edge Cases

**Goal**: Handle remaining edge cases and polish.

**Tasks:**

- [ ] Handle new notes added (assign ID, append to appropriate position)
- [ ] Handle notes removed
- [ ] Test forms with complex nested markdown (tables, blockquotes)
- [ ] Test forms with code blocks containing Markform-like syntax
- [ ] Verify comment-syntax round-trip preservation
- [ ] Performance validation with large forms

**Estimated scope**: ~100 lines code, ~150 lines tests

## Testing Strategy

### Unit Tests: Position Tracking (`parse.test.ts` additions)

```typescript
describe('position tracking', () => {
  it('tracks form tag positions', () => {
    const md = `---\nmarkform:\n  spec: MF/0.1\n---\n\n{% form id="test" %}\n{% /form %}`;
    const form = parseForm(md);
    expect(form.tagRegions).toBeDefined();
    expect(form.tagRegions?.find(r => r.tagType === 'form')).toBeDefined();
  });

  it('tracks field tag positions with values', () => {
    // Test that field regions include value fences
  });

  it('tracks note tag positions', () => {
    // Test inline note position tracking
  });
});
```

### Unit Tests: Round-trip Preservation (`serialize-preservation.test.ts`)

```typescript
describe('content preservation', () => {
  it('preserves markdown headings before form', () => {
    const md = `---
markform:
  spec: MF/0.1
---

# My Form Title

Some intro text.

{% form id="test" %}
{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}
{% /form %}
`;
    const form = parseForm(md);
    const output = serializeForm(form);
    expect(output).toContain('# My Form Title');
    expect(output).toContain('Some intro text.');
  });

  it('preserves markdown between groups', () => {
    // Test content between groups survives round-trip
  });

  it('preserves markdown after form', () => {
    // Test footer content survives round-trip
  });

  it('preserves code blocks outside form tags', () => {
    // Test fenced code blocks in intro/outro
  });

  it('preserves lists and blockquotes', () => {
    // Test complex markdown structures
  });

  it('falls back to regeneration when preserveContent=false', () => {
    const md = `# Title\n\n{% form id="test" %}...`;
    const form = parseForm(md);
    const output = serializeForm(form, { preserveContent: false });
    expect(output).not.toContain('# Title'); // Regenerated, no outside content
  });

  it('falls back to regeneration when rawSource missing', () => {
    // Test programmatically created forms
  });

  it('handles value changes without losing outside content', () => {
    // Modify a field value, verify surrounding content preserved
  });
});
```

### Golden Tests: Content Preservation

**New golden test form**: `examples/content-preservation/content-preservation.form.md`

```markdown
---
markform:
  spec: MF/0.1
---

# Content Preservation Test Form

This form tests that markdown content outside Markform tags is preserved
through parse → serialize round-trips.

## Introduction

Here is some introductory content with various markdown features:

- Bullet point 1
- Bullet point 2
- Bullet point 3

> This is a blockquote that should be preserved.

\`\`\`python
# This code block should be preserved exactly
def hello():
    print("Hello, world!")
\`\`\`

{% form id="preservation_test" title="Preservation Test" %}

## Section One

Some text between the form tag and the first group.

{% group id="section_one" title="Section One" %}
{% field kind="string" id="question_one" label="Question One" %}{% /field %}
{% /group %}

## Section Two

More markdown content between groups.

| Column A | Column B |
|----------|----------|
| Value 1  | Value 2  |

{% group id="section_two" title="Section Two" %}
{% field kind="number" id="question_two" label="Question Two" %}{% /field %}
{% /group %}

{% /form %}

## Appendix

Footer content after the form tag.

1. Numbered item 1
2. Numbered item 2
3. Numbered item 3

---

*Italic text* and **bold text** in the footer.
```

**Golden test enhancement**: Add assertion that round-tripped form matches original
(excluding frontmatter which is recomputed):

```typescript
it('preserves all markdown content through round-trip', () => {
  const original = readFileSync(formPath, 'utf-8');
  const form = parseForm(original);
  const serialized = serializeForm(form);
  const reparsed = parseForm(serialized);
  const reserialized = serializeForm(reparsed);

  // After two round-trips, content should stabilize
  expect(serialized).toBe(reserialized);

  // Verify specific content is preserved
  expect(serialized).toContain('# Content Preservation Test Form');
  expect(serialized).toContain('def hello():');
  expect(serialized).toContain('| Column A | Column B |');
  expect(serialized).toContain('*Italic text*');
});
```

### Integration Tests: CLI Normalization

```typescript
describe('CLI --normalize flag', () => {
  it('regenerates form without preserving outside content', async () => {
    // Test that `markform apply --normalize` produces clean output
  });
});
```

### Tryscript Tests: CLI Output

Add tryscript test verifying `markform inspect` and `markform apply` work correctly
with content-preserving forms.

## Appendix: Test Cases

**Basic preservation:**
```markdown
# My Form Title

Some introductory text.

<!-- form id="test" -->
<!-- field kind="string" id="name" label="Name" --><!-- /field -->
<!-- /form -->

Footer text here.
```

After round-trip, all content should be preserved exactly.

**Complex preservation:**
```markdown
# Research Form

## Instructions

Please fill out this form carefully.

- Item 1
- Item 2

<!-- form id="research" -->

## Section A

<!-- group id="section_a" title="Section A" -->
<!-- field kind="string" id="q1" label="Question 1" --><!-- /field -->
<!-- /group -->

## Section B

Some text between sections.

<!-- group id="section_b" title="Section B" -->
<!-- field kind="number" id="q2" label="Question 2" --><!-- /field -->
<!-- /group -->

<!-- /form -->

## Appendix

Additional notes after the form.
```

All markdown structure must be preserved through round-trip.

**Edge case - code blocks with Markform-like content:**
```markdown
# Example

\`\`\`markdown
<!-- This looks like a Markform tag but is in a code block -->
<!-- form id="fake" -->
\`\`\`

<!-- form id="real" -->
<!-- field kind="string" id="name" label="Name" --><!-- /field -->
<!-- /form -->
```

The code block content must be preserved verbatim; only the real form tags are processed.
