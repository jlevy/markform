# Plan Spec: Agent Message Improvements

## Purpose

This is a technical design doc for improving the clarity and correctness of messages sent
to LLM agents during form filling. These improvements were identified through review of
the wire format golden tests which now capture the complete LLM request/response format.

## Background

### The Wire Format Golden Tests

The enhanced session golden tests (implemented in `plan-2025-12-31-enhanced-session-golden-tests.md`)
now capture the complete wire format of LLM interactions. This enables systematic review
of the prompts and error messages agents receive.

Reviewing the wire format in session files like `simple.session.yaml` revealed several
issues with message clarity and correctness that should be addressed.

### Key Files

- `packages/markform/src/harness/prompts.ts` - Centralized prompt definitions
- `packages/markform/src/harness/liveAgent.ts` - Context prompt building
- `packages/markform/examples/simple/simple.session.yaml` - Wire format test fixture
- `packages/markform/examples/rejection-test/rejection-test.session.yaml` - Rejection feedback test

### Related Documentation

- [plan-2025-12-31-enhanced-session-golden-tests.md](plan-2025-12-31-enhanced-session-golden-tests.md) -
  Wire format capture that enables this review

## Summary of Task

Improve agent-facing messages for clarity and correctness:

1. **Fix issue count inconsistency** - The prompt says "up to 20 issues" but only 10 are
   shown (due to `max_issues_per_turn: 10`)

2. **Improve validation error messages** - When an agent uses the wrong patch operation
   for a field type, the error message should clearly state:
   - What operation was used incorrectly
   - What operation SHOULD be used
   - The field's actual type

3. **Add validation workflow documentation** - Document how to use wire format golden
   tests to validate prompt changes

## Issues Found During Review

### Issue 1: Issue Count Mismatch (Bug)

**Location:** `packages/markform/src/harness/prompts.ts:82-83`

```typescript
export function getIssuesIntro(maxPatches: number): string {
  return `You need to address up to ${maxPatches} issues. Here are the current issues:`;
}
```

**Problem:** The function receives `maxPatches` (default: 20) but the actual issues list
is limited by `max_issues_per_turn` (default: 10). This creates confusion:

- Message says: "You need to address up to 20 issues"
- Actual issues shown: 10 (or fewer)

**Evidence from wire format:**
```yaml
harness:
  max_patches_per_turn: 20
  max_issues_per_turn: 10

context_prompt: |-
  # Current Form Issues

  You need to address up to 20 issues. Here are the current issues:

  - **age** (field): Required field "Age" is empty
    ...
  # Only 10 issues are actually listed
```

**Fix:** Pass the actual issue count to `getIssuesIntro()`, not `maxPatches`.

### Issue 2: Error Message Could Be Clearer

**Location:** `packages/markform/src/harness/liveAgent.ts:452-462`

**Current behavior:** When an agent uses `set_string` on a table field:

```yaml
- **Error:** Cannot apply set_string to table field "ratings"
  **Use instead:** { op: "set_table", fieldId: "ratings", rows: [{ "source": "...", ... }] }
```

**Proposed improvement:** Make the error message more explicit about the correction:

```yaml
- **Error:** Cannot apply set_string to table field "ratings"
  **Correction:** This field is type "table". Use set_table (not set_string).
  **Correct format:** { op: "set_table", fieldId: "ratings", rows: [{ "source": "...", ... }] }
```

This separates the semantic explanation from the syntax example.

### Issue 3: Checkbox Mode Instructions

**Observation:** The checkbox mode instructions in the system prompt could be clearer:

```
9. For checkboxes: set appropriate states (done/todo for simple, yes/no for explicit)
```

**Improvement:** Make the mode names match what appears in issues:

```
9. For checkboxes:
   - Mode: simple → states: done, todo
   - Mode: multi → states: done, todo, na
   - Mode: explicit → states: yes, no
```

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: N/A - Internal improvements only

- **Library APIs**: N/A - No public API changes

- **Server APIs**: N/A - No server component

- **File formats**: N/A - Session files will have updated prompt text, which is expected
  (the whole point of wire format capture is to detect prompt changes)

- **Database schemas**: N/A - No database component

## Stage 1: Planning Stage

### Feature Requirements

**Core Requirements:**

1. Fix `getIssuesIntro()` to show the correct issue count
2. Improve validation error message format
3. Clarify checkbox mode instructions
4. Regenerate golden tests to capture the improved messages
5. Document validation workflow for future prompt changes

**Out of Scope (Not Implementing):**

- [ ] Complete rewrite of system prompt
- [ ] Localization/i18n of messages
- [ ] Configurable prompt templates

### Acceptance Criteria

1. [ ] Issue count in prompt matches actual number of issues shown
2. [ ] Validation errors clearly state the incorrect operation and correct operation
3. [ ] Checkbox instructions list all modes with their valid states
4. [ ] All golden tests pass after regeneration
5. [ ] Wire format captures show improved message formatting
6. [ ] Validation workflow is documented in development.md

## Stage 2: Architecture Stage

### Implementation Approach

**Fix 1: Issue Count**

Update `liveAgent.ts:buildContextPrompt()`:

```typescript
// Current (WRONG):
lines.push(getIssuesIntro(maxPatches));

// Fixed:
lines.push(getIssuesIntro(issues.length));
```

Update `prompts.ts:getIssuesIntro()` parameter naming for clarity:

```typescript
// Current:
export function getIssuesIntro(maxPatches: number): string {
  return `You need to address up to ${maxPatches} issues. Here are the current issues:`;
}

// Fixed (clarify parameter name):
export function getIssuesIntro(issueCount: number): string {
  return `You need to address ${issueCount} issues. Here are the current issues:`;
}
```

**Fix 2: Error Message Format**

Update `liveAgent.ts:buildContextPrompt()` rejection formatting:

```typescript
// Current:
lines.push(`- **Error:** ${rejection.message}`);
if (rejection.fieldKind) {
  const hint = getPatchFormatHint(...);
  lines.push(`  **Use instead:** ${hint}`);
}

// Improved:
lines.push(`- **Error:** ${rejection.message}`);
if (rejection.fieldKind) {
  lines.push(`  **Correction:** This field is type "${rejection.fieldKind}". Use set_${rejection.fieldKind} instead.`);
  const hint = getPatchFormatHint(...);
  lines.push(`  **Correct format:** ${hint}`);
}
```

**Fix 3: Checkbox Instructions**

Update `prompts.ts:DEFAULT_SYSTEM_PROMPT`:

```
9. For checkboxes: use the appropriate state for the checkbox mode:
   - Mode "simple": done (checked) or todo (unchecked)
   - Mode "multi": done, todo, or na (not applicable)
   - Mode "explicit": yes or no (must explicitly answer)
```

### File Changes

| File | Changes |
|------|---------|
| `src/harness/prompts.ts` | Fix `getIssuesIntro()` parameter, update checkbox instructions |
| `src/harness/liveAgent.ts` | Pass `issues.length` to `getIssuesIntro()`, improve rejection format |
| `examples/**/*.session.yaml` | Regenerate with new message format |

### Validation Workflow Documentation

Add to `docs/development.md` a section on validating prompt changes:

```markdown
### Validating Prompt Changes

When modifying agent prompts or error messages in `prompts.ts` or `liveAgent.ts`:

1. **Make your changes** to the prompt text or error message format

2. **Regenerate golden tests** to capture the new message format:
   ```bash
   pnpm --filter markform test:golden:regen
   ```

3. **Review the wire format diffs** to verify changes are correct:
   ```bash
   git diff packages/markform/examples/**/*.session.yaml
   ```

   Look for changes in `wire.request.system` and `wire.request.prompt` sections.

4. **Run golden tests** to verify the form filling logic still works:
   ```bash
   pnpm test:golden
   ```

5. **Commit the updated session files** along with your prompt changes
```

## Stage 3: Refine Architecture

### Reusable Components

1. **Existing `getPatchFormatHint()`** - Already provides field-specific format hints;
   we extend the context around it, not the function itself

2. **Existing rejection recording** - `PatchRejection` type already captures `fieldKind`,
   `fieldId`, and `columnIds` - all needed for improved messages

### Simplifications

1. **Single location for issue count fix** - Only need to change one line in
   `buildContextPrompt()` and rename parameter in `getIssuesIntro()`

2. **Rejection format is localized** - All changes are in the `buildContextPrompt()`
   function, not scattered across codebase

### Implementation Phases

**Phase 1: Fix Issue Count Mismatch**

- [ ] Update `getIssuesIntro()` parameter name from `maxPatches` to `issueCount`
- [ ] Change message from "up to N" to just "N" (we're showing exactly that many)
- [ ] Update call site in `buildContextPrompt()` to pass `issues.length`
- [ ] Write unit test verifying correct count appears in prompt

**Phase 2: Improve Error Message Format**

- [ ] Add "Correction" line explaining the type mismatch
- [ ] Rename "Use instead" to "Correct format" for clarity
- [ ] Update tests for rejection feedback format
- [ ] Verify rejection-test.session.yaml shows improved format after regen

**Phase 3: Improve Checkbox Instructions**

- [ ] Update `DEFAULT_SYSTEM_PROMPT` with clearer checkbox mode documentation
- [ ] Ensure all three modes (simple, multi, explicit) are explained
- [ ] Verify system prompt shows updated text after regen

**Phase 4: Regenerate Golden Tests and Document**

- [ ] Run `pnpm test:golden:regen`
- [ ] Review diffs to verify improvements appear in wire format
- [ ] Run `pnpm test:golden` to verify tests pass
- [ ] Add validation workflow section to `docs/development.md`
- [ ] Commit all changes

## Stage 4: Validation Stage

### Test Plan

**1. Unit Tests:**

- Test `getIssuesIntro(5)` returns "You need to address 5 issues..."
- Test `buildContextPrompt()` with 3 issues shows "3 issues" in output
- Test rejection format includes "Correction:" line

**2. Golden Test Validation:**

- Regenerate all session files
- Verify issue counts match actual issues in each turn
- Verify rejection feedback in `rejection-test.session.yaml` shows new format

**3. Wire Format Review:**

- Review `simple.session.yaml` wire format for correct issue counts
- Review `rejection-test.session.yaml` for improved error messages
- Verify no unintended changes to other prompt content

### Success Criteria

- [ ] Issue count in prompts matches actual issues shown
- [ ] Rejection errors include type explanation and correct operation name
- [ ] Checkbox mode instructions list all three modes with valid states
- [ ] All golden tests pass
- [ ] Validation workflow documented in development.md
- [ ] Wire format diffs show only expected changes

## References

- Wire format implementation: `packages/markform/src/harness/liveAgent.ts`
- Prompt definitions: `packages/markform/src/harness/prompts.ts`
- Session test fixtures: `packages/markform/examples/*/`
- Golden test runner: `packages/markform/tests/golden/runner.ts`
