# Plan Spec: Interactive Fill Mode with Console Prompts

## Purpose

This plan implements `fill --interactive` mode, providing a console-based interactive UI
for users to fill form fields directly in the terminal using `@clack/prompts`.

**Related Docs:**

- [Role System](../done/plan-2025-12-23-role-system.md) - Roles determine which fields to fill
  ✅ **COMPLETE** - Role system fully implemented

- [Examples CLI Command](plan-2025-12-23-examples-cli-command.md) - Uses this feature

- [Fill Command Spec](../done/valid-2025-12-23-fill-command-live-agent.md) - Base fill command
  ✅ **COMPLETE** - Fill command with live/mock agent support

- [Architecture Design](../../architecture/current/arch-markform-initial-design.md)

## Background

The current `fill` command runs an AI agent to autonomously fill forms.
However, users often need to provide initial context (company name, person name, etc.)
before the agent runs.
The role system separates fields into `user` and `agent` roles for this purpose.

To complete the workflow, users need a way to interactively fill their assigned fields
in the console.
The `serve` command already provides a web-based UI for form filling, but
launching a browser isn’t always convenient—especially for quick workflows or when
scaffolding examples.

**Workflow with roles:**

```bash
# 1. User fills their fields interactively (saves to form-v1.form.md)
markform fill form.md --interactive

# 2. Agent fills remaining fields (saves to form-v2.form.md)
markform fill form-v1.form.md
```

## Summary of Task

1. Add `--interactive` flag to the `fill` command

2. When `--interactive` is set, default to `--roles=user` (can be overridden)

3. Iterate through target role fields and prompt user for each using `@clack/prompts`

4. Support all field types with appropriate prompt UIs

5. Save filled form to output path (like normal fill)

6. Skip already-filled fields by default (`mode=continue`)

## Backward Compatibility

**Fully backward compatible.** This is additive:

- New `--interactive` flag doesn’t change existing behavior

- Default fill behavior (agent mode) unchanged

- Forms work identically whether filled interactively or by agent

* * *

## Stage 1: Planning Stage

### Feature Requirements

**Must Have:**

- `--interactive` flag on fill command

- Defaults to `--roles=user` when interactive (role system dependency)

- Prompt for each unfilled field using `@clack/prompts`

- Field type mappings to clack prompts:

| Field Type | Clack Prompt |
| --- | --- |
| `string` | `text()` |
| `number` | `text()` with validation |
| `string_list` | `text()` (one item per line) |
| `single_select` | `select()` |
| `multi_select` | `multiselect()` |
| `checkboxes` | varies by mode (see below) |

- Show field label and description in prompts

- Skip fields that already have values

- Allow user to skip optional fields (press Enter)

- Show progress through form (field X of Y)

- Save form on completion

- Support Ctrl+C cancellation with confirmation

**Nice to Have:**

- `--roles` override to fill different role interactively

- Preview current value if field is already filled

- Undo/go back to previous field

- Show form summary before saving

**Out of Scope:**

- Form groups UI (just iterate through fields linearly)

- Validation beyond required field checks

- File upload or image fields

### Checkbox Field Handling

Checkboxes have three modes that require different prompts:

| checkboxMode | UI Approach |
| --- | --- |
| `simple` | `multiselect()` - select items to mark done |
| `multi` | Per-option `select()` with todo/active/done/incomplete/na |
| `explicit` | Per-option `select()` with yes/no/unfilled |

### CLI Interface

```bash
# Interactive mode - fills user role fields (auto-versioned output)
markform fill form.md --interactive

# Combine with role override
markform fill form.md --interactive --roles=reviewer

# Full workflow (each step creates a new version)
markform fill form.md --interactive && markform fill form-v1.form.md
```

### User Flow

```
$ markform fill company-quarterly.form.md --interactive

◆  Markform Interactive Fill
│
│  Form: Company Quarterly Analysis
│  Role: user
│  Fields: 3 to fill
│

◆  Company Name (field 1 of 3)
│  The legal name of the company
│
│  > Acme Corporation
│

◆  Ticker Symbol (field 2 of 3)
│  Stock exchange ticker (e.g., AAPL)
│
│  > ACME
│

◆  Fiscal Period (field 3 of 3)
│  Which quarter to analyze
│
│  ○ Q1 2024
│  ○ Q2 2024
│  ● Q3 2024
│  ○ Q4 2024
│

◆  Save form?
│  3 fields completed
│
│  ● Yes / ○ No
│

✔ Saved to company-quarterly-v1.form.md

Next steps:
  markform fill company-quarterly-v1.form.md
```

### Acceptance Criteria

1. `markform fill form.md --interactive` prompts for user role fields

2. Each field type has appropriate prompt UI

3. Progress indicator shows field X of Y

4. Optional fields can be skipped with Enter

5. Form is saved on completion

6. Ctrl+C prompts for confirmation before canceling

7. `--roles` can override the default user role

8. Already-filled fields are skipped

* * *

## Stage 2: Architecture Stage

### Module Structure

```
src/cli/
├── commands/
│   └── fill.ts               # Add --interactive handling
└── lib/
    └── interactivePrompts.ts # New: field-to-clack mapping
```

### Key Components

**interactivePrompts.ts:**

```typescript
import * as p from '@clack/prompts';
import type { Field, FieldValue, Patch } from '../../engine/types.js';

/**
 * Prompt user for a single field value.
 * Returns a Patch to set the value, or null if skipped.
 */
export async function promptForField(
  field: Field,
  currentValue: FieldValue | undefined,
  index: number,
  total: number
): Promise<Patch | null>;

/**
 * Run interactive fill session for a list of fields.
 * Returns patches for all filled fields.
 */
export async function runInteractiveFill(
  fields: Field[],
  values: Record<string, FieldValue>
): Promise<Patch[]>;
```

### Dependencies

Already installed:

- `@clack/prompts` - Interactive console prompts

- `picocolors` - Colored output

### Integration with Roles

The role system is now implemented. Integration points:

1. `--interactive` sets default `--roles=user`

2. Field filtering uses the existing `targetRoles` + `inspectForm()` with role filtering

3. Interactive fill respects blocking checkpoints (approval gates)

4. Constants `USER_ROLE` and `AGENT_ROLE` are in `settings.ts`

5. `parseRolesFlag()` parses `--roles` CLI argument

* * *

## Stage 3: Implementation Stage

### Phase 1: Interactive Prompts Module

**Goal:** Create the prompt-to-field-type mapping.

- [ ] Create `src/cli/lib/interactivePrompts.ts`

- [ ] Implement `promptForStringField()` using `p.text()`

- [ ] Implement `promptForNumberField()` using `p.text()` with number validation

- [ ] Implement `promptForStringListField()` using `p.text()` (multiline hint)

- [ ] Implement `promptForSingleSelectField()` using `p.select()`

- [ ] Implement `promptForMultiSelectField()` using `p.multiselect()`

- [ ] Implement `promptForCheckboxesField()` based on checkboxMode

- [ ] Implement main `promptForField()` dispatcher

- [ ] Implement `runInteractiveFill()` loop with progress

- [ ] Handle cancellation with `p.confirm()`

### Phase 2: Fill Command Integration

**Goal:** Add `--interactive` flag to fill command.

- [ ] Add `--interactive` option to fill command

- [ ] Detect interactive mode and branch logic

- [ ] In interactive mode:

  - [ ] Show intro with form title and field count

  - [ ] Call `runInteractiveFill()` with filtered fields

  - [ ] Apply returned patches to form

  - [ ] Prompt to save with `p.confirm()`

  - [ ] Write output file

  - [ ] Show next steps hint

- [ ] Ensure `--interactive` conflicts with `--agent=mock/live`

### Phase 3: Role System Integration

**Goal:** Wire up role filtering (after role system implemented).

- [ ] Default `--roles=user` when `--interactive` is set

- [ ] Allow `--roles` override in interactive mode

- [ ] Pass role instructions as context in prompts

- [ ] Respect blocking checkpoints (skip blocked fields)

### Phase 4: Tests

**Goal:** Unit tests for interactive prompts.

- [ ] Test `promptForField()` returns correct patch types

- [ ] Test field skipping for optional fields

- [ ] Test progress counting (X of Y)

- [ ] Test cancellation handling

* * *

## Stage 4: Validation Stage

### Automated Tests

- [ ] All prompt functions return correct Patch types

- [ ] Number validation rejects non-numeric input

- [ ] Optional fields allow empty input

- [ ] Select prompts have correct options

### Manual Tests

- [ ] Run `fill --interactive` on example form

- [ ] Test each field type renders correctly

- [ ] Test Ctrl+C cancellation flow

- [ ] Test skip optional field with Enter

- [ ] Test full workflow: interactive fill then agent fill

### Definition of Done

1. `fill --interactive` prompts for each field

2. All field types have working prompts

3. Progress indicator works

4. Form saves on completion

5. Cancellation is graceful

6. Tests pass

* * *

## Open Questions

1. **Go back/undo:** Should users be able to go back to previous field?

   - **Decision:** Out of scope for v1. Keep it simple.

2. **Show current value:** Should we show current value for partially filled forms?

   - **Decision:** Yes, show in placeholder/hint if field has value but we’re in
     overwrite mode.

3. **Multi-line string fields:** How to handle multi-line text in console?

   - **Decision:** Use `p.text()` with hint “Press Enter twice to finish” or accept
     single line for now.
     Full multi-line can be added later.

4. **Dependent on role system:** Should this wait for role system implementation?

   - **Decision:** Can implement basic interactive fill without roles (fills all
     fields). Role filtering added when role system lands.

* * *

## Revision History

- 2025-12-23: Initial plan created
