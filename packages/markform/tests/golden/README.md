# Golden Session Tests

Golden session tests use **direct file comparison** to catch any drift in the form-filling
pipeline. Any difference between the regenerated session and the golden file causes a test
failure, ensuring all changes are visible in code reviews.

## Philosophy

The core principle is: **any change should show up in diffs**. This includes:

- Context prompts (hints shown to LLM)
- System prompts
- Tool schemas
- Issue messages and severity
- Patch values and operations
- SHA256 hashes of form state

Nothing is "semantically equivalent" - if bytes differ, the test fails.

## Files

| File | Purpose |
| --- | --- |
| `golden.test.ts` | Main test file - regenerate + compare sessions |
| `helpers.ts` | Utilities for normalization and regeneration |
| `validation.test.ts` | Tests that verify mutation detection works |

## Workflow

### Running Tests

```bash
pnpm test:golden        # Regenerate + compare, fail on any diff
```

### Updating Golden Files

When you intentionally change the form-filling pipeline:

```bash
pnpm test:golden:regen  # Regenerate all golden files
git diff examples/      # Review changes carefully
git add -p              # Stage intentional changes only
```

### Adding New Session Tests

1. Create a form file: `examples/my-test/my-test.form.md`
2. Create a mock-filled version: `examples/my-test/my-test-mock-filled.form.md`
3. Add the session config to `scripts/regen-golden-sessions.ts`
4. Run `pnpm test:golden:regen` to generate the session file
5. The test will automatically pick up new `.session.yaml` files

## Stable vs Unstable Fields

**Stable fields** (must match exactly):

- `sessionVersion` - schema version
- `mode` - mock/live
- `form.path` - form file path
- `mock.completedMock` - mock source file
- `harness.*` - all harness configuration
- `turns[].turn` - turn number
- `turns[].inspect.issues[]` - full issue objects
- `turns[].apply.patches[]` - all patches applied
- `turns[].apply.rejectedPatches[]` - any rejections
- `turns[].after.*` - all post-turn state
- `turns[].context_prompt` - the hints (critical!)
- `turns[].wire.request.*` - what we send to LLM
- `turns[].wire.response.steps[]` - LLM responses
- `final.*` - completion expectations

**Unstable fields** (normalized to 0):

- `turns[].wire.response.usage.inputTokens` - varies with model
- `turns[].wire.response.usage.outputTokens` - varies with model

## Test Coverage

### What Golden Tests Cover

- **End-to-end session flow**: Form → inspect → apply → serialize
- **Patch rejection**: Type mismatches are recorded in `rejectedPatches`
- **Coercion warnings**: Soft type conversions are recorded in `warnings`
- **Context prompts**: System/context hints sent to LLM
- **Wire format**: Complete request/response logging
- **Form state**: SHA256 hashes verify deterministic form state

### What's Tested Elsewhere

- **Value coercion logic** (e.g., string → array, boolean → checkbox): Unit tests in
  `tests/unit/valueCoercion.test.ts` and `tests/unit/engine/apply.test.ts`
- **Best-effort patch application**: Unit tests verify that valid patches apply
  even when some fail

## Validation Tests

The `validation.test.ts` file verifies that the golden tests actually catch various types
of drift. It applies mutations to golden files and confirms the test would detect them:

- Operation type changes (set_number → set_string)
- Field ID typos
- Issue severity/message changes
- Patch value changes
- System prompt modifications
- Hash corruption
- Tool schema changes
- Configuration changes

## Troubleshooting

### Test fails after upgrading dependencies

The YAML library or other dependencies may serialize slightly differently. Run
`pnpm test:golden:regen` and review the diffs - they're usually just formatting
(e.g., quote style).

### Test fails with "Cannot parse session metadata"

The session file format may have changed. Check that the session file has valid YAML
with `form.path` and `mock.completed_mock` fields.

### Adding a new field type

When adding a new field type, you'll need to:

1. Create test forms that use the new type
2. Regenerate golden files
3. Verify the hints and patches look correct in the diff
