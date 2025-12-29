# Plan Spec: Documentation Reorganization

## Purpose

Reorganize documentation files for better structure and discoverability:

1. Move `DOCS.md` → `docs/markform-reference.md`

2. Move `SPEC.md` → `docs/markform-spec.md`

3. Create `docs/markform-apis.md` documenting TypeScript and AI SDK APIs

4. Add `markform apis` CLI command

## Background

Currently, key documentation files live in the package root:

- `packages/markform/DOCS.md` — Quick reference for form syntax

- `packages/markform/SPEC.md` — Full specification (copied from root at build time)

- Root `SPEC.md` is the canonical source

Moving these to `docs/` improves organization and makes the docs directory the single
source for all documentation.
The CLI commands (`markform docs`, `markform spec`) need updates to point to the new
locations, and a new `markform apis` command will be added.

**Key design decision:** Use consistent `markform-*.md` filenames in both the canonical
`docs/` location and the package build artifacts.
This means:

- `docs/markform-reference.md` → `packages/markform/markform-reference.md`

- `docs/markform-spec.md` → `packages/markform/markform-spec.md`

- `docs/markform-apis.md` → `packages/markform/markform-apis.md`

**Related docs:**

- [README.md](README.md) — References DOCS.md and SPEC.md

- [docs/docs-overview.md](docs/docs-overview.md) — Documentation index

- `packages/markform/package.json` — Lists files to include in npm package

## Summary of Task

### Task 1: Rename DOCS.md → docs/markform-reference.md

**Files to update:**

| File | Change |
| --- | --- |
| `packages/markform/DOCS.md` | Move to `docs/markform-reference.md` |
| `packages/markform/package.json` | Update `files` array and `copy-docs` script |
| `packages/markform/src/cli/commands/docs.ts` | Update path to `markform-reference.md` |
| `README.md` | Update links |
| `.gitignore` | Update patterns for `markform-*.md` |
| `docs/markform-reference.md` | Add link to `markform apis`, remove API section |

### Task 2: Rename SPEC.md → docs/markform-spec.md

**Files to update:**

| File | Change |
| --- | --- |
| Root `SPEC.md` | Move to `docs/markform-spec.md` |
| `packages/markform/package.json` | Update `files` array and `copy-docs` script |
| `packages/markform/src/cli/commands/spec.ts` | Update path to `markform-spec.md` |
| `README.md` | Update links |
| `.gitignore` | Update patterns |
| `docs/markform-reference.md` | Update internal link to spec |

### Task 3: Create docs/markform-apis.md

New file documenting:

1. **CLI overview** — Brief section noting `markform --help` is self-documenting

2. **TypeScript API** — Key exports from `markform` package

3. **Vercel AI SDK Tools** — `createMarkformTools`, `MarkformSessionStore`

4. **Harness API** — `FormHarness`, `createHarness`, `fillForm`

5. **Research API** — `runResearch`

### Task 4: Add `markform apis` CLI command

**Files to create/update:**

| File | Change |
| --- | --- |
| `packages/markform/src/cli/commands/apis.ts` | NEW: Display markform-apis.md |
| `packages/markform/src/cli/cli.ts` | Register `apis` command |

The command follows the same pattern as `docs` and `spec` commands.

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: NO CHANGES — documentation only

- **Library APIs**: NO CHANGES — documentation only

- **CLI commands**: MAINTAIN — `markform docs` and `markform spec` must continue working

- **New CLI command**: ADD — `markform apis` to display API documentation

- **npm package**: MAINTAIN — Published package must include reference docs

## Stage 1: Planning Stage

### Scope

This is a **documentation-only change**. No code logic changes.
Only file moves and reference updates.

### Not in Scope

- Changing content of DOCS.md or SPEC.md (except internal links)

- Changing the CLI command names (`docs`, `spec`)

### Acceptance Criteria

1. `markform docs` displays the reference documentation

2. `markform spec` displays the full specification

3. `markform apis` displays the API documentation (NEW)

4. All links in README.md work

5. npm package includes documentation files with consistent `markform-*.md` names

6. New `docs/markform-apis.md` covers key TypeScript APIs

## Stage 2: Architecture Stage

### File Move Strategy

Since `packages/markform/SPEC.md` is copied from root at build time via `copy-docs`
script, the new strategy is:

1. Move root `SPEC.md` to `docs/markform-spec.md` (canonical source)

2. Move `packages/markform/DOCS.md` to `docs/markform-reference.md`

3. Create `docs/markform-apis.md`

4. Update `copy-docs` script to copy all three with consistent names

**Package structure after changes:**

```
docs/
  markform-spec.md        # Canonical specification
  markform-reference.md   # Quick reference (was DOCS.md)
  markform-apis.md        # NEW: API documentation
packages/markform/
  markform-spec.md        # Build-time copy (gitignored)
  markform-reference.md   # Build-time copy (gitignored)
  markform-apis.md        # Build-time copy (gitignored)
```

### CLI Path Resolution Updates

**docs.ts changes:**

```typescript
// Before:
return join(dirname(thisDir), 'DOCS.md');
// After:
return join(dirname(thisDir), 'markform-reference.md');
```

**spec.ts changes:**

```typescript
// Before:
return join(dirname(thisDir), 'SPEC.md');
// After:
return join(dirname(thisDir), 'markform-spec.md');
```

**apis.ts (NEW):**

```typescript
return join(dirname(thisDir), 'markform-apis.md');
```

### package.json Changes

```json
{
  "files": [
    "dist",
    "README.md",
    "markform-reference.md",
    "markform-spec.md",
    "markform-apis.md"
  ],
  "scripts": {
    "copy-docs": "cp ../../docs/markform-spec.md . && cp ../../docs/markform-reference.md . && cp ../../docs/markform-apis.md . && cp ../../README.md ."
  }
}
```

## Stage 3: Implementation

### Phase 1: Move DOCS.md and SPEC.md

**Tasks:**

- [ ] Create `docs/markform-reference.md` from `packages/markform/DOCS.md`

- [ ] Move root `SPEC.md` to `docs/markform-spec.md`

- [ ] Update `.gitignore` to ignore `packages/markform/markform-*.md` (build artifacts)

- [ ] Update `packages/markform/package.json`:

  - Update `files` array to use `markform-*.md` names

  - Update `copy-docs` script to copy with consistent names

- [ ] Update `docs/markform-reference.md` internal link to spec

- [ ] Delete original `packages/markform/DOCS.md` (now generated)

### Phase 2: Update CLI Commands

**Tasks:**

- [ ] Update `packages/markform/src/cli/commands/docs.ts` path to
  `markform-reference.md`

- [ ] Update `packages/markform/src/cli/commands/spec.ts` path to `markform-spec.md`

- [ ] Create `packages/markform/src/cli/commands/apis.ts` (copy pattern from docs.ts)

- [ ] Register `apis` command in `packages/markform/src/cli/cli.ts`

### Phase 3: Update References

**Tasks:**

- [ ] Update `README.md` links to new doc paths

- [ ] Update `docs/docs-overview.md` if it exists

### Phase 4: Create markform-apis.md

**Tasks:**

- [ ] Create `docs/markform-apis.md` with:

  - CLI overview section (including `markform apis`)

  - Core engine API (parseForm, serialize, validate, inspect, applyPatches)

  - Vercel AI SDK tools (createMarkformTools, MarkformSessionStore)

  - Harness API (FormHarness, createHarness, fillForm)

  - Research API (runResearch, isResearchForm)

  - Links to source files for additional details

### Phase 5: Verification

**Tasks:**

- [ ] Run `npm run build` in packages/markform

- [ ] Verify `markform docs` works

- [ ] Verify `markform spec` works

- [ ] Verify `markform apis` works (NEW)

- [ ] Verify README links are correct

- [ ] Verify npm package contents with `npm pack --dry-run`

### Phase 6: Update markform-reference.md Content

**Tasks:**

- [ ] Add prominent note at top of `docs/markform-reference.md` pointing to `markform
  apis`

- [ ] Remove “Programmatic API (AI SDK Tools)” section from reference doc (move to apis
  doc)

- [ ] Ensure reference doc focuses on form syntax, not TypeScript APIs

**Reference doc header should include:**

```markdown
**Developer APIs:** For TypeScript and AI SDK integration, run `markform apis` or see
[markform-apis.md](markform-apis.md).
```

## Stage 4: Validation

### Manual Testing

```bash
# Build and verify CLI commands
cd packages/markform
npm run build
node dist/bin.mjs docs    # Should display reference
node dist/bin.mjs spec    # Should display specification
node dist/bin.mjs apis    # Should display API documentation

# Verify package files
npm pack --dry-run | grep -E "markform-"
```

### Link Verification

After changes, these links must work in the GitHub UI:

- `README.md` → `docs/markform-reference.md`

- `README.md` → `docs/markform-spec.md`

- `README.md` → `docs/markform-apis.md`

- `docs/markform-reference.md` → `docs/markform-spec.md`

- `docs/markform-reference.md` → `docs/markform-apis.md`

- `docs/markform-apis.md` → `docs/markform-reference.md`

## Content for docs/markform-apis.md

````markdown
# Markform APIs

Markform provides TypeScript APIs for parsing, validating, and manipulating forms
programmatically.

## CLI

The `markform` CLI is self-documenting:

```bash
markform --help              # List all commands
markform <command> --help    # Help for specific command
markform docs                # Form syntax quick reference
markform spec                # Full specification
markform apis                # This document
````

**Form syntax:** See [markform-reference.md](markform-reference.md) for the quick
reference on form syntax, field kinds, and attributes.

## Installation

```bash
npm install markform
```

## Core Engine API

Import from the main package:

```typescript
import {
  parseForm,
  serialize,
  validate,
  inspect,
  applyPatches,
} from 'markform';
```

### parseForm(content: string): ParsedForm

Parse a `.form.md` file into a structured form object.

### serialize(form: ParsedForm, options?: SerializeOptions): string

Convert a parsed form back to Markdown.

### validate(form: ParsedForm, options?: ValidateOptions): ValidateResult

Validate form syntax and constraints.

### inspect(form: ParsedForm, options?: InspectOptions): InspectResult

Get form state including structure, progress, and validation issues.

### applyPatches(form: ParsedForm, patches: Patch[]): ApplyResult

Apply value changes to a form.
Modifies the form in place.

## Vercel AI SDK Integration

Import from the ai-sdk subpath:

```typescript
import {
  createMarkformTools,
  MarkformSessionStore
} from 'markform/ai-sdk';
```

### MarkformSessionStore

Session store for managing form state during AI interactions.

```typescript
const store = new MarkformSessionStore(parsedForm);
```

### createMarkformTools(options): MarkformToolSet

Create AI SDK compatible tools for agent-driven form filling.

```typescript
import { generateText } from 'ai';

const tools = createMarkformTools({ sessionStore: store });
const { text } = await generateText({
  model: yourModel,
  tools,
  prompt: 'Fill out this form...',
});
```

**Available tools:**

| Tool | Description |
| --- | --- |
| `markform_inspect` | Get form state, structure, progress, issues |
| `markform_apply` | Apply patches to update field values |
| `markform_export` | Export schema and values as JSON |
| `markform_get_markdown` | Get canonical Markdown representation |

See [vercelAiSdkTools.ts](../packages/markform/src/integrations/vercelAiSdkTools.ts) for
full details.

### Patch Operations

Use `markform_apply` with an array of patches.
Each patch has an `op` and `fieldId`.

| Operation | Fields | Value Format |
| --- | --- | --- |
| `set_string` | string | `{ "op": "set_string", "fieldId": "name", "value": "Alice" }` |
| `set_number` | number | `{ "op": "set_number", "fieldId": "age", "value": 25 }` |
| `set_string_list` | string_list | `{ "op": "set_string_list", "fieldId": "tags", "items": ["a", "b"] }` |
| `set_single_select` | single_select | `{ "op": "set_single_select", "fieldId": "rating", "selected": "high" }` |
| `set_multi_select` | multi_select | `{ "op": "set_multi_select", "fieldId": "cats", "selected": ["a", "b"] }` |
| `set_checkboxes` | checkboxes | `{ "op": "set_checkboxes", "fieldId": "tasks", "values": {"item1": "done"} }` |
| `set_url` | url | `{ "op": "set_url", "fieldId": "website", "value": "https://..." }` |
| `set_url_list` | url_list | `{ "op": "set_url_list", "fieldId": "sources", "items": ["https://..."] }` |
| `set_date` | date | `{ "op": "set_date", "fieldId": "deadline", "value": "2024-06-15" }` |
| `set_year` | year | `{ "op": "set_year", "fieldId": "founded", "value": 2015 }` |
| `clear_field` | any | `{ "op": "clear_field", "fieldId": "name" }` |
| `skip_field` | optional | `{ "op": "skip_field", "fieldId": "notes", "reason": "Not applicable" }` |
| `abort_field` | any | `{ "op": "abort_field", "fieldId": "data", "reason": "Unable to find" }` |

### Checkbox Values

For `set_checkboxes`, values depend on the checkbox mode:

- **multi** (default): `todo`, `done`, `incomplete`, `active`, `na`

- **simple**: `todo`, `done`

- **explicit**: `unfilled`, `yes`, `no`

## Form Harness API

The harness manages step-by-step form filling sessions.

```typescript
import { FormHarness, createHarness, fillForm } from 'markform';
```

### fillForm(options: FillOptions): Promise<FillResult>

High-level API for filling a form with an AI model.

```typescript
const result = await fillForm({
  form: parsedForm,
  model: 'anthropic/claude-sonnet-4-5',
  roles: ['agent'],
});
```

### createHarness(form, config?): FormHarness

Create a harness for manual control over the fill loop.

See [harness.ts](../packages/markform/src/harness/harness.ts) for full details.

## Research API

For research-type forms that run extended data gathering sessions.

```typescript
import { runResearch, isResearchForm } from 'markform';
```

### runResearch(options: ResearchOptions): Promise<ResearchResult>

Run a research session on a research-type form.

See [runResearch.ts](../packages/markform/src/research/runResearch.ts) for full details.

## Type Exports

All Zod schemas and TypeScript types are exported from the main package:

```typescript
import type {
  ParsedForm,
  Field,
  FieldValue,
  Patch,
  InspectResult,
  // ... many more
} from 'markform';
```

See [src/index.ts](../packages/markform/src/index.ts) for the complete list of exports.
```

## Open Questions

None at this time.
```
