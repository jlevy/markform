# Feature Validation: Interactive Fill Mode

## Purpose

This is a validation spec for the interactive fill mode implementation in Markform.
It validates console-based form filling using `@clack/prompts`.

**Feature Plan:**
[plan-2025-12-23-fill-interactive-mode.md](plan-2025-12-23-fill-interactive-mode.md)

**Implementation Commits:**

- `d111716` - feat(cli): add --interactive mode for console-based form filling

## Stage 4: Validation Stage

## Automated Validation (Testing Performed)

### Unit Testing

The following unit tests cover the interactive prompts module:

1. **interactivePrompts.test.ts** (22 tests)

   - `promptForField()` returns correct patch types for each field kind

   - String field returns `set_string` patch

   - Number field returns `set_number` patch

   - String list field returns `set_string_list` patch with parsed items

   - Single select field returns `set_single_select` patch

   - Multi select field returns `set_multi_select` patch

   - Checkboxes field (simple mode) returns `set_checkboxes` with done/todo values

   - Checkboxes field (explicit mode) returns `set_checkboxes` with yes/no values

   - Checkboxes field (multi mode) returns `set_checkboxes` with 5-state values

   - Optional fields return null on empty input (field skipping)

   - Cancel returns null

   - Field descriptions are shown when available

   - `runInteractiveFill()` filters to field-level issues only

   - `runInteractiveFill()` deduplicates issues by field ID

   - `runInteractiveFill()` returns empty patches when no field issues

   - `runInteractiveFill()` collects patches from multiple fields

   - `showInteractiveIntro()` displays form info

   - `showInteractiveOutro()` shows cancel message when cancelled

   - `showInteractiveOutro()` shows no changes message when patch count is 0

   - `showInteractiveOutro()` shows success message with patch count

2. **Integration with existing tests**

   - All 277 tests pass (22 new + 255 existing)

   - Build succeeds

   - Type checking passes

## Manual Testing Needed

The following manual validation steps confirm the implementation works in a real
terminal:

### 1. CLI Help Output

Verify the `--interactive` flag appears in help:

```bash
pnpm markform fill --help
```

**Expected:** Shows `-i, --interactive` option with description mentioning user role
default.

### 2. Interactive Mode Startup

Test interactive mode starts correctly with proper field detection:

```bash
pnpm markform fill packages/markform/examples/earnings-analysis/earnings-analysis.form.md --interactive
```

**Expected behavior:**

- Shows “Markform Interactive Fill” intro

- Displays form title: “Earnings Analysis Worksheet”

- Shows role: “user”

- Shows fields: “3 to fill” (company_legal_name, tickers, fiscal_year_end)

- Prompts for first field

### 3. Two-Stage Workflow

Test the complete user → agent workflow:

```bash
# Stage 1: Fill user fields interactively (requires TTY)
pnpm markform fill packages/markform/examples/earnings-analysis/earnings-analysis.form.md --interactive -o /tmp/earnings-user-filled.form.md

# Stage 2: Fill agent fields (requires API key)
pnpm markform fill /tmp/earnings-user-filled.form.md --agent=live --model=openai/gpt-4o
```

**Expected:**

- Stage 1 prompts for 3 user fields, saves to output file

- Stage 2 fills remaining agent fields using LLM

### 4. Role Override

Test `--roles` override in interactive mode:

```bash
pnpm markform fill packages/markform/examples/simple/simple.form.md --interactive --roles=agent
```

**Expected:** Prompts for agent-role fields instead of user-role fields.

### 5. Field Type Prompts

Test each field type renders correctly:

- String field: Text input

- Number field: Text input with number validation

- String list: Multi-line text input

- Single select: Selection menu

- Multi select: Multi-selection menu

- Checkboxes: Varies by mode (simple/explicit/multi)

### 6. Cancellation

Test Ctrl+C during interactive fill prompts for confirmation.

## User Review Checklist

- [ ] CLI help shows --interactive option correctly

- [ ] Interactive mode detects correct number of user fields

- [ ] Role defaults work (user in interactive, agent otherwise)

- [ ] `--roles` override works in interactive mode

- [ ] Two-stage workflow completes successfully

- [ ] All automated tests pass (277 tests)

## Definition of Done

1. ✅ `fill --interactive` prompts for each field

2. ✅ All field types have working prompts

3. ✅ Progress indicator works (field X of Y)

4. ✅ Optional fields can be skipped

5. ✅ Form saves on completion

6. ✅ Cancellation is handled

7. ✅ `--roles` can override default user role

8. ✅ Unit tests pass (22 tests)

9. ✅ Integration tests pass (277 total)
