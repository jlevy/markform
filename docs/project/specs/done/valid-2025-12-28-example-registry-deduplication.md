# Feature Validation: Remove Duplicate Example Metadata from exampleRegistry

## Purpose

This is a validation spec for the implementation of issue `markform-320`, which removes
duplicate example metadata from `exampleRegistry.ts` by loading `title` and `description`
dynamically from YAML frontmatter.

**Feature Plan:** Issue markform-320 (in `.beads/issues.jsonl`)

**Implementation Plan:** Defined in issue description

## Stage 4: Validation Stage

## Validation Planning

The implementation eliminates duplication of example metadata by establishing YAML
frontmatter as the single source of truth for `title` and `description` fields.

## Automated Validation (Testing Performed)

### Unit Testing

The following unit tests were added/updated in `tests/unit/cli/examples.test.ts`:

1. **Static field validation** - `each example has all required static fields`
   - Verifies EXAMPLE_DEFINITIONS contains `id`, `filename`, `path` for each example
   - Confirms filename ends with `.form.md`
   - Confirms path contains subdirectory structure

2. **Frontmatter metadata loading** - `each example has title and description in frontmatter`
   - Verifies `loadExampleMetadata()` successfully extracts title and description from each
     example's YAML frontmatter

3. **getExampleWithMetadata** tests
   - Returns example with title and description loaded from frontmatter
   - Returns undefined for invalid ID

4. **getAllExamplesWithMetadata** tests
   - Returns all examples with metadata populated
   - All returned examples have id, title, and description

5. **Existing tests updated**
   - `getExampleById` test updated to check static fields only (not metadata)
   - All 570 tests pass

### Integration and End-to-End Testing

The changes are covered by existing golden tests and integration tests that exercise the
examples command flow. The `pnpm precommit` script runs:
- Format check (Prettier)
- Type check (TypeScript)
- Lint check (ESLint)
- All unit and integration tests

All checks pass successfully.

### Manual Testing Needed

The following manual validation should be performed:

1. **List examples command** - Run and verify output:
   ```bash
   pnpm --filter markform exec markform examples --list
   ```
   Expected: All 5 examples displayed with correct titles and descriptions loaded from
   frontmatter:
   - simple: "Simple Test Form"
   - political-research: "Political Research"
   - earnings-analysis: "Company Quarterly Analysis"
   - startup-deep-research: "Startup Deep Research"
   - celebrity-deep-research: "Celebrity Deep Research"

2. **Interactive examples flow** - Run without `--list`:
   ```bash
   pnpm --filter markform exec markform examples
   ```
   Expected: Interactive selector shows all examples with correct titles and descriptions
   as labels and hints.

3. **Verify frontmatter content** - Spot check that example forms contain the new
   frontmatter fields:
   ```bash
   head -10 packages/markform/examples/simple/simple.form.md
   ```
   Expected: YAML frontmatter includes `title:` and `description:` under `markform:`.

4. **Verify no hardcoded metadata** - Confirm exampleRegistry.ts no longer contains
   hardcoded title/description strings:
   ```bash
   grep -E "title:|description:" packages/markform/src/cli/examples/exampleRegistry.ts
   ```
   Expected: No matches (metadata is loaded dynamically, not hardcoded).
