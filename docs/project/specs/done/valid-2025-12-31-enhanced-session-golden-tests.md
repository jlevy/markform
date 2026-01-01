# Feature Validation: Enhanced Session Golden Tests with Wire Format

## Purpose

This is a validation spec documenting the testing performed and manual validation needed
for the enhanced session golden tests feature, which captures the complete LLM wire
format in session logs.

**Feature Plan:**
[plan-2025-12-31-enhanced-session-golden-tests.md](plan-2025-12-31-enhanced-session-golden-tests.md)

## Stage 4: Validation Stage

## Automated Validation (Testing Performed)

### Unit Testing

All 800 tests pass. Key test coverage includes:

**Wire Format Types** (`tests/unit/engine/coreTypes.test.ts`):
- WireFormat Zod schema validates correctly
- WireRequestFormat and WireResponseFormat schemas work independently
- Optional wire field on SessionTurn validates correctly

**Session Serialization** (`tests/unit/engine/session.test.ts`):
- **NEW**: `preserves wire format through round-trip` - Comprehensive test that:
  - Creates a session with full wire format (request with system/prompt/tools, response
    with steps/toolCalls/toolResults/usage)
  - Serializes to YAML
  - Parses back
  - Verifies all wire format fields are preserved
  - Verifies YAML output uses snake_case for keys (input_tokens, output_tokens, etc.)
  - Verifies tool names in `wire.request.tools` are preserved as-is (not case-converted)

- Existing round-trip tests continue to pass (backward compatibility)
- Sessions without wire format parse correctly

**Golden Tests** (`tests/golden/golden.test.ts`):
- All 13 golden tests pass
- Session replay correctly ignores wire format (not used for validation)
- Hash verification still works on form content

### Integration and End-to-End Testing

**Programmatic Fill** (`tests/integration/programmaticFill.test.ts`):
- All 8 integration tests pass
- Wire format flows through the complete fill pipeline

**Harness Tests** (`tests/unit/harness/harness.test.ts`):
- All 35 harness tests pass
- Wire format correctly recorded in session turns

### Code Quality

- TypeScript: No type errors (strict mode)
- ESLint: No warnings or errors
- Prettier: All files formatted correctly
- Pre-commit hooks: All checks pass

## Manual Testing Needed

### 1. Live Agent Wire Format Capture

The automated tests use mock agents. To validate wire format capture with a real LLM:

```bash
# Run a live fill (requires API key)
cd packages/markform
pnpm markform fill examples/simple/simple.form.md --live

# After completion, inspect the generated session file
cat examples/simple/simple.session.yaml
```

**Verify:**
- [ ] Session file contains a `wire:` section in each turn
- [ ] `wire.request.system` contains the system prompt
- [ ] `wire.request.prompt` contains the context prompt with form state
- [ ] `wire.request.tools` contains tool definitions with `description` and `input_schema`
- [ ] `wire.response.steps` contains array of steps
- [ ] Each step has `tool_calls` with `tool_name` and `input`
- [ ] `wire.response.usage` shows `input_tokens` and `output_tokens`

### 2. Error Message Visibility

Test that validation error messages appear in wire format:

```bash
# Create a form that will cause validation errors
# (e.g., a number field where the mock provides a string)
pnpm markform fill examples/rejection-test/rejection-test.form.md --mock
```

**Verify:**
- [ ] When patches are rejected, the next turn's `wire.request.prompt` shows error messages
- [ ] Error messages include field-specific hints

### 3. Deterministic Output Stability

```bash
# Run the same fill twice
pnpm markform fill examples/simple/simple.form.md --mock
cp examples/simple/simple.session.yaml /tmp/session1.yaml

pnpm markform fill examples/simple/simple.form.md --mock
diff /tmp/session1.yaml examples/simple/simple.session.yaml
```

**Verify:**
- [ ] Both session files are identical (deterministic output)
- [ ] No timestamp-like fields causing churn

### 4. Git Diff Visibility

Make a small change to a prompt and verify it shows in diff:

```bash
# Edit src/harness/liveAgent.ts
# Change a string in buildSystemPrompt() or buildContextPrompt()
# Run a fill and commit
# Verify the prompt change is visible in the session file diff
```

**Verify:**
- [ ] Prompt changes appear in `wire.request.system` or `wire.request.prompt` diff
- [ ] Tool schema changes appear in `wire.request.tools` diff

## Implementation Notes

### Files Changed

| File | Changes |
|------|---------|
| `src/engine/coreTypes.ts` | Added WireFormat types and Zod schemas, added `wire?` to SessionTurn |
| `src/harness/harnessTypes.ts` | Re-exports WireFormat, added `wire?` to TurnStats |
| `src/harness/liveAgent.ts` | Added wire format capture in generatePatches() |
| `src/harness/harness.ts` | Updated apply() and recordTurn() to flow wire format |
| `src/harness/programmaticFill.ts` | Passes wire through to harness |
| `src/engine/session.ts` | Preserves tool names in wire.request.tools during serialization |
| `src/index.ts` | Exports WireFormat types |
| `tests/unit/engine/session.test.ts` | Added wire format round-trip test |

### Beads Closed

- markform-481: Parent feature bead
- markform-482: Phase 1 - Define WireFormat types
- markform-483: Phase 2 - Update Session types
- markform-484: Phase 3 - Capture wire format in LiveAgent
- markform-485: Phase 4 - Flow through harness and serialize
- markform-486: Phase 5 - Regenerate golden tests

## Open Questions

None - implementation is complete and all automated tests pass.
