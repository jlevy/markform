---
close_reason: null
closed_at: null
created_at: 2025-12-27T00:00:00.000Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.621Z
    original_id: markform-320
id: is-01kg3xaa389xxjjp2xdv2eyh3q
kind: task
labels: []
parent_id: null
priority: 3
status: closed
title: Remove duplicate example metadata from exampleRegistry.ts
type: is
updated_at: 2025-12-27T00:00:00.000Z
version: 1
---
## Problem
`exampleRegistry.ts` hardcodes `title` and `description` for each example, duplicating content that already exists in the example form files:
- Title is in `{% form title="..." %}`
- Description is in `{% description %}` blocks

This duplication creates maintenance burden and potential for inconsistency.

## Solution
Add `title` and `description` to the YAML frontmatter of each example form (single source of truth), then update the registry to load these values dynamically.

## Implementation Plan

### Phase 1: Update example form frontmatter
Add `title` and `description` fields to markform frontmatter in each example:
- `packages/markform/examples/simple/simple.form.md`
- `packages/markform/examples/political-research/political-research.form.md`
- `packages/markform/examples/earnings-analysis/earnings-analysis.form.md`
- `packages/markform/examples/startup-deep-research/startup-deep-research.form.md`
- `packages/markform/examples/celebrity-deep-research/celebrity-deep-research.form.md`

Example frontmatter:
```yaml
markform:
  spec: MF/0.1
  title: Simple Test Form
  description: User and agent roles for testing full workflow. User fills required fields, agent fills optional.
  roles: [user, agent]
  ...
```

### Phase 2: Update cliTypes.ts
Make `title` and `description` optional in ExampleDefinition (they'll be loaded from frontmatter):
```typescript
export interface ExampleDefinition {
  id: string;
  filename: string;
  path: string;
  title?: string;      // Loaded from frontmatter
  description?: string; // Loaded from frontmatter
}
```

### Phase 3: Update exampleRegistry.ts
1. Remove hardcoded `title` and `description` from EXAMPLE_DEFINITIONS
2. Add `loadExampleMetadata(exampleId: string)` function that:
   - Reads the form file
   - Parses YAML frontmatter (simple yaml.parse, don't need full form parse)
   - Returns `{ title, description }` from frontmatter
3. Add `getExampleWithMetadata(id: string): ExampleDefinition` that combines static definition with loaded metadata
4. Add `getAllExamplesWithMetadata(): ExampleDefinition[]` for listing

### Phase 4: Update examples command consumer
Update `cli/commands/examples.ts` (or wherever examples are listed) to use the new metadata loading functions.

### Phase 5: Clean up form content (optional)
Consider whether the `{% form title="..." %}` and `{% description %}` blocks should remain for rendering, or if they should also read from frontmatter. For now, leave them - they serve different purposes (frontmatter = document metadata, directives = rendered form structure).

## Files to Modify
- packages/markform/examples/*/\*.form.md (5 files)
- packages/markform/src/cli/lib/cliTypes.ts
- packages/markform/src/cli/examples/exampleRegistry.ts
- packages/markform/src/cli/commands/examples.ts (if needed)

## Acceptance Criteria
- Example forms have title/description in frontmatter
- EXAMPLE_DEFINITIONS no longer contains hardcoded title/description
- `markform examples --list` shows correct titles and descriptions
- Tests pass
