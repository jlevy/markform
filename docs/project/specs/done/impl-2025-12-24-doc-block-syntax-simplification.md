# Implementation Spec: Doc Block Syntax Simplification

## Purpose

This is an implementation spec for simplifying the documentation block syntax in
Markform. The change replaces the generic `{% doc %}` tag with `kind` attribute with
distinct semantic tags: `{% description %}`, `{% instructions %}`, and `{% documentation
%}`.

**Bead:** markform-172

**Design Source:** Conversation-based design (no formal plan spec - inline design
decision)

## Motivation

The current syntax `{% doc ref="x" kind="description" %}` has issues:

1. Overloads “kind” terminology (also used for field types)

2. Verbose syntax

3. Less readable/scannable

The new syntax makes the semantic purpose immediately clear from the tag name itself.

## Syntax Changes

### Current (Before)

```markdoc
{% doc ref="simple_test" kind="description" %}
A form demonstrating user and agent roles.
{% /doc %}

{% doc ref="name" kind="instructions" %}
Enter your full name (2-50 characters).
{% /doc %}
```

### New (After)

```markdoc
{% description ref="simple_test" %}
A form demonstrating user and agent roles.
{% /description %}

{% instructions ref="name" %}
Enter your full name (2-50 characters).
{% /instructions %}

{% documentation ref="political_research" %}
**Workflow:**
1. User enters the political figure's name
2. Agent researches and fills biographical data
{% /documentation %}
```

## Semantic Distinction

| Tag | Purpose | Example |
| --- | --- | --- |
| `description` | Brief, declarative statement of what something is | "A biographical research form for political figures" |
| `instructions` | Action-oriented guidance for filling a field | "Enter the full name (2-50 characters)" |
| `documentation` | General information, workflow context, data sources | "Workflow: 1. User enters name... Data Sources: Wikipedia..." |

## Type Changes

### Before (types.ts)

```typescript
type DocBlockKind = "description" | "instructions" | "notes" | "examples";

interface DocumentationBlock {
  ref: string;
  kind?: DocBlockKind;
  bodyMarkdown: string;
}
```

### After (types.ts)

```typescript
type DocumentationTag = "description" | "instructions" | "documentation";

interface DocumentationBlock {
  tag: DocumentationTag;
  ref: string;
  bodyMarkdown: string;
}
```

## Backward Compatibility

**NOT maintaining backward compatibility.** This is a syntax change for v0.1.0 before
release. The old `{% doc %}` syntax will no longer be supported.

## Stage 3: Implementation Stage

### Implementation Phases

The implementation is broken into phases that may be committed and tested separately:

- Phase 1: Core types and parser changes (types.ts, parse.ts)

- Phase 2: Serializer changes (serialize.ts)

- Phase 3: Migrate example files (11 .form.md files)

- Phase 4: Update tests and verify

* * *

## Phase 1: Core Types and Parser

### Files to Touch

- `packages/markform/src/engine/types.ts` (lines 226-237, 767-778)

- `packages/markform/src/engine/parse.ts` (lines 858-924)

### Detailed Changes

#### types.ts

1. **Replace DocBlockKind** (line 229):
   ```typescript
   // Before
   export type DocBlockKind = "description" | "instructions" | "notes" | "examples";
   
   // After
   export type DocumentationTag = "description" | "instructions" | "documentation";
   ```

2. **Update DocumentationBlock** (lines 231-237):
   ```typescript
   // Before
   export interface DocumentationBlock {
     ref: string;
     kind?: DocBlockKind;
     bodyMarkdown: string;
   }
   
   // After
   export interface DocumentationBlock {
     tag: DocumentationTag;
     ref: string;
     bodyMarkdown: string;
   }
   ```

3. **Update Zod schemas** (lines 767-778):
   ```typescript
   // Before
   export const DocBlockKindSchema = z.enum([
     "description",
     "instructions",
     "notes",
     "examples",
   ]);
   
   export const DocumentationBlockSchema = z.object({
     ref: z.string(),
     kind: DocBlockKindSchema.optional(),
     bodyMarkdown: z.string(),
   });
   
   // After
   export const DocumentationTagSchema = z.enum([
     "description",
     "instructions",
     "documentation",
   ]);
   
   export const DocumentationBlockSchema = z.object({
     tag: DocumentationTagSchema,
     ref: z.string(),
     bodyMarkdown: z.string(),
   });
   ```

#### parse.ts

1. **Update extractDocBlocks function** (lines 858-924):

   - Change from looking for `{% doc %}` tags to looking for `{% description %}`, `{%
     instructions %}`, `{% documentation %}` tags

   - Extract `ref` attribute (no longer need `kind`)

   - Set `tag` field based on which tag was matched

   ```typescript
   const DOC_TAG_NAMES = ["description", "instructions", "documentation"] as const;
   type DocTagName = (typeof DOC_TAG_NAMES)[number];
   
   function extractDocBlocks(ast: Node, idIndex: Map<Id, IdIndexEntry>): DocumentationBlock[] {
     const docs: DocumentationBlock[] = [];
     const seenRefs = new Set<string>();
   
     function traverse(node: Node): void {
       if (!node || typeof node !== "object") {
         return;
       }
   
       // Check for description, instructions, or documentation tags
       if (node.type === "tag" && node.tag && DOC_TAG_NAMES.includes(node.tag as DocTagName)) {
         const tag = node.tag as DocumentationTag;
         const ref = getStringAttr(node, "ref");
   
         if (!ref) {
           throw new ParseError(`${tag} block missing required 'ref' attribute`);
         }
   
         if (!idIndex.has(ref)) {
           throw new ParseError(`${tag} block references unknown ID '${ref}'`);
         }
   
         const uniqueKey = `${ref}:${tag}`;
         if (seenRefs.has(uniqueKey)) {
           throw new ParseError(
             `Duplicate ${tag} block for ref='${ref}'`
           );
         }
         seenRefs.add(uniqueKey);
   
         // Extract body content
         let bodyMarkdown = "";
         function extractText(n: Node): void {
           if (n.type === "text" && typeof n.attributes?.content === "string") {
             bodyMarkdown += n.attributes.content;
           }
           if (n.children && Array.isArray(n.children)) {
             for (const c of n.children) {
               extractText(c);
             }
           }
         }
         if (node.children && Array.isArray(node.children)) {
           for (const child of node.children) {
             extractText(child);
           }
         }
   
         docs.push({
           tag,
           ref,
           bodyMarkdown: bodyMarkdown.trim(),
         });
       }
   
       if (node.children && Array.isArray(node.children)) {
         for (const child of node.children) {
           traverse(child);
         }
       }
     }
   
     traverse(ast);
     return docs;
   }
   ```

### Automated Testing Strategy

After Phase 1:

- Unit tests will initially fail (expected - tests still use old syntax)

- Can manually test with `pnpm exec tsx -e "..."` to verify parsing works

* * *

## Phase 2: Serializer

### Files to Touch

- `packages/markform/src/engine/serialize.ts` (lines 429-437)

### Detailed Changes

Update `serializeDocBlock` function:

```typescript
// Before
function serializeDocBlock(doc: DocumentationBlock): string {
  const attrs: Record<string, unknown> = { ref: doc.ref };
  if (doc.kind) {
    attrs.kind = doc.kind;
  }

  const attrStr = serializeAttrs(attrs);
  return `{% doc ${attrStr} %}\n${doc.bodyMarkdown}\n{% /doc %}`;
}

// After
function serializeDocBlock(doc: DocumentationBlock): string {
  const attrs: Record<string, unknown> = { ref: doc.ref };
  const attrStr = serializeAttrs(attrs);
  return `{% ${doc.tag} ${attrStr} %}\n${doc.bodyMarkdown}\n{% /${doc.tag} %}`;
}
```

### Automated Testing Strategy

After Phase 2:

- Round-trip tests should work once example files are updated

- Can test serialization manually

* * *

## Phase 3: Migrate Example Files

### Files to Touch

1. `packages/markform/examples/simple/simple.form.md`

2. `packages/markform/examples/simple/simple-mock-filled.form.md`

3. `packages/markform/examples/political-research/political-research.form.md`

4. `packages/markform/examples/political-research/political-research.mock.lincoln.form.md`

5. `packages/markform/examples/earnings-analysis/earnings-analysis.form.md`

6. Root-level filled forms (6 files): `political-research-filled*.form.md`,
   `simple-filled*.form.md`

### Migration Pattern

For each file, apply these transformations:

| Old Pattern | New Pattern |
| --- | --- |
| `{% doc ref="x" kind="description" %}` | `{% description ref="x" %}` |
| `{% /doc %}` | `{% /description %}` |
| `{% doc ref="x" kind="instructions" %}` | `{% instructions ref="x" %}` |
| `{% /doc %}` | `{% /instructions %}` |

**Special case for political-research.form.md:** The workflow/data sources block
currently tagged as `kind="instructions"` should become `{% documentation %}` since it’s
general context, not filling instructions.

### Automated Testing Strategy

After Phase 3:

- Run `pnpm markform inspect <file>` on each migrated file

- Verify no parse errors

* * *

## Phase 4: Update Tests

### Files to Touch

- `packages/markform/tests/unit/engine/parse.test.ts` (lines 424-531)

- `packages/markform/tests/unit/engine/serialize.test.ts` (lines 630-650)

### Detailed Changes

#### parse.test.ts

Update “doc block edge cases” describe block:

1. Rename to “documentation tag edge cases”

2. Update test markdown to use new syntax

3. Update assertions: `.kind` → `.tag`

Example test update:
```typescript
// Before
it("allows multiple doc blocks with same ref but different kinds", () => {
  const markdown = `...
{% doc ref="name" kind="description" %}...{% /doc %}
{% doc ref="name" kind="instructions" %}...{% /doc %}
...`;
  expect(result.docs[0]?.kind).toBe("description");
});

// After
it("allows multiple doc tags with same ref but different tags", () => {
  const markdown = `...
{% description ref="name" %}...{% /description %}
{% instructions ref="name" %}...{% /instructions %}
...`;
  expect(result.docs[0]?.tag).toBe("description");
});
```

#### serialize.test.ts

Update test that includes doc blocks to use new syntax.

### Automated Testing Strategy

After Phase 4:

- Run `pnpm test --filter=markform` - all tests should pass

- Run `pnpm markform inspect` on all example files

- Verify golden tests still pass (if any use doc blocks)

* * *

## Open Questions (resolve now)

- [x] Keep `notes` and `examples` doc kinds?
  **Decision: No, drop them.
  Only description/instructions/documentation.**

- [x] Add visibility attribute?
  **Decision: No, defer to future.**

- [x] Backward compatibility?
  **Decision: No, breaking change for v0.1.0.**

## Out of Scope (do NOT do now)

- Visibility attribute (`shown`/`hidden`) - deferred to future

- Migration tooling for existing forms - manual migration only

- Backward compatibility support for `{% doc %}` syntax
