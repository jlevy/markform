# Feature Validation: Agent Message Improvements

## Purpose

This is a validation spec documenting the testing performed and manual validation needed
for improvements to LLM agent-facing messages in the form filling harness.

**Feature Plan:** [plan-2026-01-01-agent-message-improvements.md](plan-2026-01-01-agent-message-improvements.md)

## Stage 4: Validation Stage

## Automated Validation (Testing Performed)

### Unit Testing

The following unit tests validate the core functionality:

1. **`getIssuesIntro()` tests** in `tests/unit/harness/prompts.test.ts`:
   - `returns correct count for multiple issues` - verifies "5 issues" output
   - `returns singular form for one issue` - verifies "1 issue" output
   - `returns correct count for 10 issues` - verifies count and absence of "up to"

2. **Existing prompt tests** continue to pass:
   - All field type documentation tests (32 tests in prompts.test.ts)
   - Patch format hint tests
   - Rejection feedback tests

### Integration and End-to-End Testing

1. **Golden test validation** (`pnpm test:golden`):
   - All 13 golden tests pass
   - Session files regenerated to capture new message format
   - Wire format captures show correct issue counts and error message format

2. **Wire format verification** in session files:
   - `simple.session.yaml` - shows "10 issues" instead of "up to 20 issues"
   - `rejection-test.session.yaml` - shows improved error format with "Correction" and "Correct format" lines
   - `simple-with-skips.session.yaml` - shows correct issue counts

### Manual Testing Needed

The following manual validation steps should be performed:

#### 1. Review Wire Format Changes

Examine the wire format diffs to confirm the improvements are visible:

```bash
git diff origin/main -- packages/markform/examples/**/*.session.yaml
```

**Verify:**
- [ ] Issue count intro shows actual count (e.g., "2 issues") not "up to 20 issues"
- [ ] Rejection errors include "**Correction:**" line explaining the field type
- [ ] Rejection errors include "**Correct format:**" with the correct patch format
- [ ] Checkbox instructions in system prompt list all three modes

#### 2. Inspect a Session File

Open `packages/markform/examples/rejection-test/rejection-test.session.yaml` and verify:

- [ ] The `wire.request.prompt` includes proper error feedback format:
  ```yaml
  - **Error:** Cannot apply set_string to table field "ratings"
    **Correction:** This field is type "table". Use set_table instead.
    **Correct format:** { op: "set_table", fieldId: "ratings", rows: [...] }
  ```

#### 3. Review Development Documentation

Open `docs/development.md` and verify:

- [ ] New "Validating Prompt Changes" section exists (around line 271)
- [ ] Instructions explain the workflow: make changes → regenerate → review diffs → run tests → commit
- [ ] Commands are correct: `pnpm --filter markform test:golden:regen` and `pnpm test:golden`

#### 4. Run the Tests Locally

```bash
# Run all unit tests
pnpm --filter markform test:unit

# Run golden tests specifically
pnpm --filter markform test:golden
```

**Verify:**
- [ ] All 782+ unit tests pass
- [ ] All 13 golden tests pass

## Open Questions

None - all implementation is complete and tested.

## Commits

The implementation includes the following commits:

1. `fix(prompts): show actual issue count instead of max patches` - markform-488
2. `fix(prompts): improve validation error message format` - markform-489
3. `docs(prompts): clarify checkbox mode instructions in system prompt` - markform-490
4. `chore: regenerate golden tests and add prompt validation docs` - markform-491
5. `chore: close implementation beads for agent message improvements`
