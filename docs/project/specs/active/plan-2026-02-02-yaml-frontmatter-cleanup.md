# Feature: YAML Frontmatter Parsing and Serialization Cleanup

**Date:** 2026-02-02

**Author:** Assistant (with LLM assistance)

**Status:** Draft

## Overview

Clean up and consolidate YAML frontmatter parsing and serialization to use consistent Zod validation, eliminate code duplication, and fix discovered bugs.

## Goals

- Fix critical bugs in frontmatter parsing/serialization
- Use Zod schemas consistently for all frontmatter validation
- Eliminate code duplication (snake_case mapping, default values)
- Add comprehensive validation for roles and role_instructions
- Preserve title and description from frontmatter through round-trips
- Enable reliable syntax migration (Markdoc to HTML comments)

## Non-Goals

- Changing the YAML frontmatter schema/spec
- Adding new frontmatter fields
- Changing the form tag or body structure

## Background

During an attempt to migrate example forms from Markdoc syntax (`{% %}`) to HTML comment syntax (`<!-- -->`), critical bugs were discovered:

### Bugs Found and Partially Fixed

1. **BUG (FIXED): roles/role_instructions at wrong level**
   - Parser read from `frontmatter.roles` but files have `markform.roles`
   - Serializer wrote to `frontmatter.roles` instead of `markform.roles`
   - **Fix applied:** Updated both parse.ts and serialize.ts

2. **BUG (NOT FIXED): title and description not preserved**
   - Frontmatter `markform.title` and `markform.description` are parsed but lost during serialization
   - `FormMetadata` type doesn't include title/description fields
   - Only `description` is extracted but not re-serialized

### Structural Issues Found

1. **Inconsistent validation strategies in one function:**
   - `RunMode`: Uses Zod (`RunModeSchema.safeParse()`)
   - `Harness config`: Manual type checking (`typeof value !== 'number'`)
   - `Roles/instructions`: No validation, just type assertions

2. **Zod schemas exist but aren't used during parsing:**
   - `FrontmatterHarnessConfigSchema` defined but not used
   - `FormMetadataSchema` defined but not used
   - Manual validation duplicates schema logic

3. **Code duplication:**
   - snake_case/camelCase mapping in both parse.ts and serialize.ts
   - Default roles defined in multiple places
   - Default role instructions defined in multiple places

4. **Missing validations:**
   - roles array elements not validated as strings
   - roles array minimum length not enforced
   - roleInstructions values not validated
   - Harness config doesn't enforce positive integers

## Design

### Approach

1. Create a single Zod schema for the entire `markform:` section of frontmatter
2. Use this schema for both parsing and serialization validation
3. Centralize all constants (defaults, mappings) in one place
4. Add title and description to FormMetadata
5. Update serializer to preserve all frontmatter fields

### Components

- `packages/markform/src/engine/coreTypes.ts` - Add comprehensive frontmatter input schema
- `packages/markform/src/engine/parse.ts` - Use Zod for all validation
- `packages/markform/src/engine/serialize.ts` - Use shared mappings, preserve all fields
- `packages/markform/src/settings.ts` - Centralize defaults and mappings

### API Changes

- `FormMetadata` interface: Add `title?: string` and `description?: string`
- New export: `MarkformSectionInputSchema` for validating frontmatter input

## Implementation Plan

### Phase 1: Bug Fixes and Basic Cleanup

- [x] Fix roles/role_instructions read from wrong level (parse.ts)
- [x] Fix roles/role_instructions write to wrong level (serialize.ts)
- [ ] Add title and description to FormMetadata interface
- [ ] Update parser to extract title from markform section
- [ ] Update serializer to output title and description
- [ ] Test round-trip preserves all frontmatter fields

### Phase 2: Zod Consolidation

- [ ] Create `MarkformSectionInputSchema` in coreTypes.ts:
  ```typescript
  export const MarkformSectionInputSchema = z.object({
    spec: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    run_mode: RunModeSchema.optional(),
    roles: z.array(z.string()).min(1).optional(),
    role_instructions: z.record(z.string(), z.string()).optional(),
    harness: FrontmatterHarnessConfigSchema.optional(),
  });
  ```
- [ ] Replace manual parsing in extractFrontmatter() with Zod validation
- [ ] Replace manual parseHarnessConfig() with Zod validation
- [ ] Add proper error messages with Zod error formatting

### Phase 3: DRY Cleanup

- [ ] Move HARNESS_CONFIG_MAPPING to settings.ts
- [ ] Create functions to convert snake_case<->camelCase using single mapping
- [ ] Ensure DEFAULT_ROLES used consistently in parse.ts and serialize.ts
- [ ] Ensure DEFAULT_ROLE_INSTRUCTIONS used consistently
- [ ] Remove duplicated default value definitions

### Phase 4: Migration and Testing

- [ ] Re-run migration of example forms to HTML comment syntax
- [ ] Verify all forms round-trip correctly
- [ ] Add unit tests for frontmatter parsing edge cases
- [ ] Add unit tests for frontmatter serialization edge cases
- [ ] Test with malformed frontmatter to verify error handling

## Testing Strategy

1. **Unit tests for Zod schemas:**
   - Valid inputs pass validation
   - Invalid inputs produce clear error messages
   - Optional fields default correctly

2. **Round-trip tests:**
   - Parse form -> serialize -> parse again = same result
   - All frontmatter fields preserved
   - Comments/tags syntax both work

3. **Integration tests:**
   - `markform export --syntax comments` preserves all data
   - `markform validate` catches invalid frontmatter

## Rollout Plan

1. Implement fixes in feature branch
2. Run full test suite
3. Re-migrate example forms
4. Review diff for any unexpected changes
5. Merge to main

## Open Questions

- Should we support both `markform.roles` and top-level `roles` for backwards compatibility, or deprecate top-level?
  - **Current approach:** Support both, prefer markform section
- Should title/description in frontmatter override or supplement form tag attributes?
  - **Recommendation:** Form tag is authoritative for structure, frontmatter is metadata

## References

- Related files:
  - `packages/markform/src/engine/parse.ts`
  - `packages/markform/src/engine/serialize.ts`
  - `packages/markform/src/engine/coreTypes.ts`
  - `packages/markform/src/settings.ts`
