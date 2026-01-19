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
| Tests | Unit + integration for preservation | Performance benchmarks |
| Specification | Already updated | N/A |

### Key Questions to Resolve

1. **Granularity of preservation**: Should we preserve at form-level (before/after form)
   or at tag-level (between every tag)?

   **Recommendation**: Tag-level for maximum fidelity. Store positions for all tags.

2. **Handling of tag modifications**: When a field is added/removed/reordered, how do we
   handle the surrounding content?

   **Recommendation**: Content between tags is associated with preceding tag. New tags
   get minimal spacing. Removed tags' trailing content attaches to previous tag.

3. **Frontmatter handling**: Frontmatter is already handled specially - should it be
   part of raw slicing or remain separate?

   **Recommendation**: Keep frontmatter handling separate (already works well).

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
       │             └──────────────────┘      │  - tagPositions (NEW)  │
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
  rawSource?: string;           // Original markdown source (post-preprocessing)
  tagRegions?: TagRegion[];     // Positions of all Markform tags in source
}

/** Position of a Markform tag in the source */
interface TagRegion {
  tagId: Id;                    // ID of the element (form, group, field, etc.)
  tagType: 'form' | 'group' | 'field' | 'note' | 'doc';
  startOffset: number;          // Start position in source (inclusive)
  endOffset: number;            // End position in source (exclusive)
  includesValue?: boolean;      // Whether region includes value fence
}
```

### Serialization Algorithm

```
function serializeForm(form: ParsedForm, opts?: SerializeOptions): string {
  // If no raw source or preservation disabled, use existing regeneration
  if (!form.rawSource || !form.tagRegions || opts?.preserveContent === false) {
    return serializeFormFromScratch(form, opts);
  }

  // Sort regions by position (descending) to splice from end
  const regions = [...form.tagRegions].sort((a, b) => b.startOffset - a.startOffset);

  let result = form.rawSource;

  for (const region of regions) {
    // Serialize this tag to canonical format
    const serialized = serializeTag(region.tagId, form);

    // Splice into result
    result = result.slice(0, region.startOffset) +
             serialized +
             result.slice(region.endOffset);
  }

  // Handle frontmatter separately (already works)
  result = updateFrontmatter(result, form);

  return result;
}
```

### Edge Cases

1. **New tags added**: No position in source - append at appropriate location
2. **Tags removed**: Remove from source, preserve surrounding content
3. **Tags reordered**: Reorder in source (complex - may need full regeneration)
4. **Source not available**: Fall back to existing regeneration behavior

## Stage 3: Refine Architecture

### Reusable Components

**Existing code to leverage:**

1. **`detectSyntaxStyle()`** - Already tracks original syntax style
2. **`preprocessCommentSyntax()`** - Transforms source, can track positions
3. **`postprocessToCommentSyntax()`** - Reverse transform for output
4. **Markdoc AST** - Already has position information via `node.location`

**Key insight**: Markdoc's AST already contains `location` information for each node:
```typescript
interface Location {
  start: { line: number; character: number; offset?: number };
  end: { line: number; character: number; offset?: number };
}
```

We can leverage this instead of custom position tracking.

### Simplified Approach

Instead of custom position tracking, use Markdoc's AST locations:

1. Store preprocessed source in `ParsedForm.rawSource`
2. During parsing, extract `location` from each Markform tag node
3. During serialization, use locations to identify splice regions

This reduces new code needed and leverages existing Markdoc infrastructure.

### Performance Considerations

- **Memory**: Storing raw source doubles memory per form (~2x for typical forms)
- **CPU**: Splice-based serialization is O(n * m) where n = tags, m = source length
- **Mitigation**: For very large forms, fall back to regeneration

**Recommendation**: No performance concern for typical forms (<100KB). Add size threshold
for fallback if needed later.

## Stage 4: Implementation Plan

### Phase 1: Core Infrastructure

**Goal**: Add raw source storage and position tracking without changing behavior.

- [ ] Add `rawSource` field to `ParsedForm` interface
- [ ] Add `tagRegions` field to `ParsedForm` interface
- [ ] Modify `parseForm()` to store preprocessed source
- [ ] Modify `parseForm()` to extract tag positions from AST
- [ ] Add unit tests for position tracking accuracy
- [ ] Verify all existing tests pass

### Phase 2: Splice-based Serialization

**Goal**: Implement content-preserving serialization.

- [ ] Create `serializeFormWithPreservation()` internal function
- [ ] Implement splice algorithm for tag replacement
- [ ] Handle edge case: missing source (fall back to regeneration)
- [ ] Handle edge case: mismatched positions (fall back to regeneration)
- [ ] Update `serializeForm()` to use preservation by default
- [ ] Add `preserveContent` option for opt-out
- [ ] Add unit tests for content preservation
- [ ] Add integration tests for round-trip fidelity

### Phase 3: Edge Cases and Polish

**Goal**: Handle all edge cases robustly.

- [ ] Handle new tags added (no position)
- [ ] Handle tags removed
- [ ] Handle tags reordered
- [ ] Handle value changes (within tag region)
- [ ] Add comprehensive test suite for edge cases
- [ ] Update documentation

### Phase 4: Validation

**Goal**: Verify feature works correctly across all scenarios.

- [ ] Run full test suite
- [ ] Test with real-world forms from examples/
- [ ] Test with forms containing complex markdown (code blocks, lists, tables)
- [ ] Verify spec compliance
- [ ] Performance testing (optional)

## Outstanding Questions

1. Should we preserve content within `{% documentation %}` blocks verbatim, or is the
   current "raw text slice" approach sufficient?

2. How should we handle forms created programmatically (no source)? Always regenerate?

3. Should there be a CLI option to force regeneration (for normalization use cases)?

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
