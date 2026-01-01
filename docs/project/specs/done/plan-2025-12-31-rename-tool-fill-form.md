# Plan Spec: Rename generatePatches Tool to fill_form

## Purpose

Rename the `generatePatches` LLM tool to `fill_form` for naming consistency and semantic
clarity. Also consolidate all tool API definitions into a single source-of-truth file.

## Background

The markform harness exposes a tool to LLMs called `generatePatches`. This tool:

- Accepts an array of patches (e.g., `{ op: 'set_string', fieldId: 'name', value:
  'Alice' }`)

- Is the primary mechanism for agents to fill form fields

**Problems:**

1. **Naming inconsistency**: Patch operations use `snake_case` (`set_string`,
   `set_number`), but the tool name uses `camelCase` (`generatePatches`)

2. **Semantic mismatch**: From the LLM’s perspective, it’s “filling form fields”, not
   “generating patches” — the latter leaks implementation details

3. **Scattered definitions**: Tool name, description, and schema are spread across
   multiple files (`prompts.ts`, `liveAgent.ts`, `harnessTypes.ts`)

## Summary of Task

1. Rename `generatePatches` → `fill_form` everywhere

2. Create a centralized `toolApi.ts` file containing all tool API definitions:

   - Tool name constant

   - Tool description

   - Patch operation names and schemas

   - Any other tool-related constants

3. Update all consumers to import from the centralized file

## Backward Compatibility

**Breaking change**: Yes, but acceptable because:

- The tool name is internal to markform (LLMs see it, but no external code depends on
  it)

- No public API contract for tool names

- Clean break preferred over migration complexity

## Stage 1: Planning Stage

### Current State

`generatePatches` appears in:

| Category | Files | Count |
| --- | --- | --- |
| Core types | `harnessTypes.ts` | 2 |
| Prompts | `prompts.ts` | 3 |
| Agent implementations | `liveAgent.ts`, `mockAgent.ts`, `rejectionMockAgent.ts` | 9 |
| Fill logic | `programmaticFill.ts`, `runResearch.ts` | 2 |
| CLI | `fill.ts`, `shared.ts` | 2 |
| Scripts | `regen-golden-sessions.ts` | 1 |
| Tests | 3 test files | ~20 |
| Docs | `arch-markform-design.md` | 4 |

### Design Decision

**Tool name (LLM-facing):** `fill_form` (snake_case for tool registration)

**TypeScript method name:** `fillFormTool()` (camelCase, clarifies this is the tool
interface)

This distinguishes:

- `fillForm()` in `programmaticFill.ts` — High-level API that orchestrates the harness
  loop

- `Agent.fillFormTool()` — Agent interface method that invokes the `fill_form` LLM tool

Alternatives considered for tool name:

- `fill_fields` — Good but `fill_form` is more concise

- `submit_fields` — “Submit” implies finality, but this is iterative

- `update_fields` — Too generic, could mean anything

### New File: `toolApi.ts`

Create `src/harness/toolApi.ts` as single source of truth:

```typescript
/**
 * Tool API Definitions
 *
 * Single source of truth for all LLM tool names, descriptions, and schemas.
 * This file defines the contract between markform and LLM agents.
 */

// =============================================================================
// Tool Names
// =============================================================================

/** The primary tool for filling form fields */
export const FILL_FORM_TOOL_NAME = 'fill_form';

// =============================================================================
// Tool Descriptions
// =============================================================================

/** Description shown to LLMs for the fill_form tool */
export const FILL_FORM_TOOL_DESCRIPTION =
  'Fill form fields by submitting patches. Each patch sets a value for one field. ' +
  'Use the field IDs from the issues list. Return patches for all issues you can address.';

// =============================================================================
// Patch Operations
// =============================================================================

/** All valid patch operation names */
export const PATCH_OPERATIONS = [
  'set_string',
  'set_number',
  'set_string_list',
  'set_checkboxes',
  'set_single_select',
  'set_multi_select',
  'set_url',
  'set_url_list',
  'set_date',
  'set_year',
  'set_table',
  'clear_field',
  'skip_field',
  'abort_field',
] as const;

export type PatchOperation = (typeof PATCH_OPERATIONS)[number];
```

### Out of Scope

- Renaming patch operations (they’re already snake_case)

- Backward compatibility shims

- Updating historical spec docs in `docs/project/specs/done/`

## Stage 2: Architecture Stage

### File Changes

| File | Changes |
| --- | --- |
| **New:** `src/harness/toolApi.ts` | Create with tool name, description, operation constants |
| `src/harness/harnessTypes.ts` | Rename interface method `generatePatches` → `fillFormTool` |
| `src/harness/prompts.ts` | Remove `GENERATE_PATCHES_TOOL_DESCRIPTION`, import from toolApi |
| `src/harness/liveAgent.ts` | Import from toolApi, rename method to `fillFormTool`, register tool as `fill_form` |
| `src/harness/mockAgent.ts` | Rename method to `fillFormTool` |
| `src/harness/rejectionMockAgent.ts` | Rename method to `fillFormTool` |
| `src/harness/programmaticFill.ts` | Update method calls to `agent.fillFormTool()` |
| `src/research/runResearch.ts` | Update method calls to `agent.fillFormTool()` |
| `src/cli/commands/fill.ts` | Update method calls to `agent.fillFormTool()` |
| `src/cli/lib/shared.ts` | Update JSDoc example |
| `scripts/regen-golden-sessions.ts` | Update method calls to `agent.fillFormTool()` |
| Tests | Update all test assertions and mocks |
| `docs/project/architecture/current/arch-markform-design.md` | Update diagrams |

### Prompt Text Updates

In `prompts.ts`, update:

- “Always use the generatePatches tool...” → “Always use the fill_form tool …”

- “Use the generatePatches tool to submit...” → “Use the fill_form tool to submit …”

## Stage 3: Implementation Stage

### Phase 1: Create toolApi.ts and Update Core

- [x] Create `src/harness/toolApi.ts` with constants

- [x] Update `harnessTypes.ts`: rename `generatePatches` → `fillFormTool` in Agent
  interface

- [x] Update `prompts.ts`: import from toolApi, update prompt text

- [x] Update `liveAgent.ts`: import from toolApi, rename method to `fillFormTool`,
  register tool as `fill_form`

- [x] Update `mockAgent.ts` and `rejectionMockAgent.ts`: rename methods to
  `fillFormTool`

- [x] Run `npm test` — expect failures in tests (not updated yet)

### Phase 2: Update Consumers and Tests

- [x] Update `programmaticFill.ts`, `runResearch.ts`, `fill.ts`, `shared.ts` to call
  `agent.fillFormTool()`

- [x] Update `regen-golden-sessions.ts`

- [x] Update all test files

- [x] Run `npm test` — should pass

### Phase 3: Update Documentation

- [x] Update `arch-markform-design.md` diagrams and text

- [x] Verify no stray references: `grep -r "generatePatches" packages/markform/`

## Stage 4: Validation Stage

### Automated Verification

```bash
# No old references in source
grep -r "generatePatches" packages/markform/src/
grep -r "GENERATE_PATCHES" packages/markform/src/

# No old references in tests
grep -r "generatePatches" packages/markform/tests/

# All tests pass
npm test

# Build succeeds
npm run build
```

### Manual Verification

```bash
# Run a fill and check logs show fill_form (not generatePatches)
node packages/markform/dist/bin.mjs fill \
  packages/markform/examples/movie-research/movie-research-demo.form.md \
  --roles=agent --model openai/gpt-4o-mini --max-turns 1 --verbose
```

Expected output should show:
```
Tools: web_search×N, fill_form×1
```
