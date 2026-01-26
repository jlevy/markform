# Plan: Use Markdoc Native Frontmatter Parsing

## Summary

Refactor frontmatter parsing to use Markdoc's built-in frontmatter extraction instead of
duplicate regex-based extraction. This consolidates frontmatter handling and leverages
Markdoc's robust parsing.

## Problem

Currently there are **two places** with duplicate regex-based frontmatter extraction:

1. `packages/markform/src/engine/parse.ts:56` - `FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/`
2. `packages/markform/src/cli/examples/exampleRegistry.ts:153` - Similar regex pattern

The current flow in `parse.ts`:
```typescript
// Step 1: Extract frontmatter manually with regex
const { body, metadata } = extractFrontmatter(markdown);

// Step 2: Parse only the body with Markdoc
const ast = Markdoc.parse(body);
```

## Solution

Markdoc natively handles frontmatter extraction. When you call `Markdoc.parse(doc)`:

1. It automatically detects YAML frontmatter (between `---` delimiters)
2. Stores the raw YAML string in `ast.attributes.frontmatter`
3. Parses the remaining body into the AST

**New flow:**
```typescript
// Step 1: Parse full content with Markdoc (handles frontmatter automatically)
const ast = Markdoc.parse(markdown);

// Step 2: Extract frontmatter from AST and parse YAML
const rawFrontmatter = ast.attributes.frontmatter;
const frontmatter = rawFrontmatter ? YAML.parse(rawFrontmatter) : {};
```

## Benefits

1. **Single source of truth** - Markdoc handles frontmatter detection consistently
2. **Better edge case handling** - Markdoc handles `\r\n` vs `\n` internally
3. **Reduced code duplication** - Remove regex patterns from two files
4. **Consistent behavior** - Both parse.ts and exampleRegistry.ts use same mechanism
5. **Future-proof** - If Markdoc improves frontmatter handling, we benefit automatically

## Implementation Plan

### Phase 1: Refactor parse.ts

1. Remove `FRONTMATTER_REGEX` constant
2. Modify `extractFrontmatter()` to accept Markdoc AST instead of raw string:
   ```typescript
   function extractFrontmatter(ast: Node): FrontmatterResult {
     const rawFrontmatter = ast.attributes.frontmatter as string | undefined;
     if (!rawFrontmatter) {
       return { frontmatter: {}, body: '' };
     }
     // ... YAML parsing logic stays the same
   }
   ```
3. Update `parseForm()` to:
   - Call `Markdoc.parse(markdown)` first (full content)
   - Pass AST to `extractFrontmatter(ast)`
   - Continue with existing form parsing logic
4. Update tests to verify frontmatter is still correctly extracted

### Phase 2: Refactor exampleRegistry.ts

Option A: Reuse parse.ts helper
- Export a lightweight `parseFrontmatter()` helper from engine
- Use it in exampleRegistry.ts

Option B: Direct Markdoc usage
- Call `Markdoc.parse()` directly in exampleRegistry.ts
- Access `ast.attributes.frontmatter`

Recommendation: **Option A** - Create shared helper to avoid Markdoc imports in CLI

### Phase 3: Create shared frontmatter utility

Create `packages/markform/src/engine/frontmatter.ts`:
```typescript
import Markdoc from '@markdoc/markdoc';
import YAML from 'yaml';

/**
 * Parse YAML frontmatter from markdown content using Markdoc's native support.
 * @param markdown - Full markdown content (may include frontmatter)
 * @returns Parsed frontmatter object, or empty object if none
 */
export function parseFrontmatter(markdown: string): Record<string, unknown> {
  const ast = Markdoc.parse(markdown);
  const raw = ast.attributes.frontmatter as string | undefined;
  if (!raw) return {};

  try {
    return YAML.parse(raw) as Record<string, unknown> ?? {};
  } catch {
    return {};
  }
}
```

## Testing

1. Existing parse tests should continue passing
2. Add test for edge cases:
   - Windows-style line endings (`\r\n`)
   - No frontmatter
   - Empty frontmatter (`---\n---`)
   - Invalid YAML in frontmatter
3. Test exampleRegistry still loads metadata correctly

## Migration Notes

- This is an internal refactoring - no API changes
- Frontmatter schema and structure remain unchanged
- No changes to form file format

## References

- [Markdoc Frontmatter Docs](https://markdoc.dev/docs/frontmatter)
- Current regex locations:
  - [parse.ts:56](../../../packages/markform/src/engine/parse.ts#L56)
  - [exampleRegistry.ts:153](../../../packages/markform/src/cli/examples/exampleRegistry.ts#L153)
