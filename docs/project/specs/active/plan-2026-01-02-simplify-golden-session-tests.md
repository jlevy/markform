# Plan Spec: Simplify Golden Session Tests

## Purpose

Simplify golden session testing to use direct file comparison instead of complex replay
logic. The current approach validates only semantic equivalence while ignoring most of
the session file content, which allowed stale documentation (hints with wrong property
names) to go undetected.

## Background

Golden session tests capture the complete execution trace of form-filling operations,
including:

- The context prompt sent to the LLM (with field hints)

- The wire format (system prompt, user prompt, tool schemas)

- The LLM’s patch responses

- Form state after each turn

**Problem discovered**: The hints in `context_prompt` used stale property names
(`selected`, `items`, `rows`) while the actual patch schema uses `value` for all
operations. This went undetected because:

1. Tests replay response patches, not validate prompt content

2. Tests compare semantic equivalence (issues by key, SHA256 of form state)

3. Tests completely ignore the `context_prompt` and `wire.request` sections

This violates the core principle of golden testing: **any change should show up in
diffs**. The current approach hides changes instead of surfacing them.

Reference:
[Golden Testing Guidelines](https://github.com/jlevy/speculate/blob/main/docs/general/agent-guidelines/golden-testing-guidelines.md)

## Summary of Task

Replace the complex replay-based golden test runner with simple direct file comparison:

1. **Regenerate session** → Run mock fill, serialize to YAML

2. **Compare byte-for-byte** → `expect(actual).toBe(expected)`

3. **Any diff = test failure** → Forces review of all changes

This ensures:

- Stale hints are caught immediately

- Wire format changes are visible

- No behavioral changes can hide in ignored sections

## Backward Compatibility

- **Breaking changes**: None (internal test infrastructure only)

- **Migration**: Regenerate all golden files once after implementation

## Stage 1: Planning Stage

### Current State Analysis

The current golden test infrastructure:

| File | Purpose | Problem |
| --- | --- | --- |
| `tests/golden/golden.test.ts` | Test driver | Uses complex replay logic |
| `tests/golden/runner.ts` | Replay engine | Validates only semantic equivalence |
| `scripts/regen-golden-sessions.ts` | Regeneration | Good - produces full session files |

**What the current tests validate:**

- Issues match by `ref:scope:reason` key only

- SHA256 hash of serialized form markdown

- Final form values match expected

**What the current tests ignore:**

- `context_prompt` content (the hints shown to LLM)

- `wire.request.system` (system prompt)

- `wire.request.prompt` (user prompt)

- `wire.request.tools` (tool schemas)

- Exact issue text and formatting

### Stable vs Unstable Fields

Per golden testing guidelines, we must classify all fields:

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

- `turns[].context_prompt` - **THE HINTS** (critical!)

- `turns[].wire.request.*` - what we send to LLM

- `turns[].wire.response.steps[]` - LLM responses

- `final.*` - completion expectations

**Unstable fields** (filter or normalize):

- `turns[].wire.response.usage.inputTokens` - varies with model

- `turns[].wire.response.usage.outputTokens` - varies with model

Looking at the session schema, **almost everything is stable**. The only unstable fields
are token counts, which should be normalized to `0` for deterministic comparison.

### Acceptance Criteria

1. **Direct comparison**: Test compares regenerated session YAML to golden file

2. **Any diff fails**: No semantic equivalence checking, byte-for-byte match required

3. **Clear workflow**: `pnpm test:golden` runs tests, `pnpm test:golden:regen` updates

4. **Fast execution**: Tests run in <100ms each (mock mode, no network)

5. **Token normalization**: Usage stats normalized to 0 for determinism

### Out of Scope

- Adding new session test scenarios (separate task)

- Changing the session schema itself

- Modifying the regeneration script (already correct)

## Stage 2: Architecture Stage

### New Test Structure

```
tests/golden/
  golden.test.ts          # Simplified: regenerate + compare
  runner.ts               # DELETE - no longer needed

scripts/
  regen-golden-sessions.ts  # Keep as-is (already correct)
```

### Simplified Test Implementation

```typescript
// golden.test.ts - The entire test file
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { regenerateSession, normalizeSession } from './helpers.js';

const EXAMPLES_DIR = join(__dirname, '../../examples');

const GOLDEN_SESSIONS = [
  'simple/simple.session.yaml',
  'simple/simple-with-skips.session.yaml',
  'rejection-test/rejection-test.session.yaml',
];

describe('Golden Session Tests', () => {
  for (const sessionPath of GOLDEN_SESSIONS) {
    it(`matches golden: ${sessionPath}`, async () => {
      const fullPath = join(EXAMPLES_DIR, sessionPath);

      // Regenerate session from form + mock
      const actual = await regenerateSession(fullPath);

      // Load golden file
      const expected = readFileSync(fullPath, 'utf-8');

      // Direct comparison - any diff fails
      expect(normalizeSession(actual)).toBe(normalizeSession(expected));
    });
  }
});
```

### Normalization Function

Only normalize the truly unstable fields (token counts):

```typescript
function normalizeSession(yaml: string): string {
  // Normalize token counts to 0 for deterministic comparison
  return yaml
    .replace(/input_tokens: \d+/g, 'input_tokens: 0')
    .replace(/output_tokens: \d+/g, 'output_tokens: 0');
}
```

### Workflow

**Running tests:**
```bash
pnpm test:golden        # Regenerate + compare, fail on any diff
```

**Updating golden files after intentional changes:**
```bash
pnpm test:golden:regen  # Regenerate all golden files
git diff tests/golden/  # Review changes
git add -p              # Stage intentional changes
```

## Stage 3: Implementation Stage

### Phase 1: Simplify Golden Tests

- [ ] Delete `tests/golden/runner.ts` (complex replay logic)

- [ ] Rewrite `tests/golden/golden.test.ts` to use direct comparison

- [ ] Add `normalizeSession()` helper for token count normalization

- [ ] Update `regenerateSession()` to return YAML string directly

- [ ] Ensure all 3 existing sessions pass with new approach

### Phase 2: Verify Coverage

- [ ] Confirm session files include `context_prompt` with hints

- [ ] Confirm hints now use `value` (not `selected`/`items`/`rows`)

- [ ] Run `pnpm test:golden:regen` to ensure files are current

- [ ] Verify test fails if we manually corrupt a hint

### Phase 3: Documentation

- [ ] Update `tests/golden/README.md` with new workflow

- [ ] Document stable vs unstable field classification

## Stage 4: Validation Stage

### Test Criteria

1. **Any diff fails**: Byte-for-byte comparison catches all changes
2. **Regeneration idempotent**: `pnpm test:golden:regen` produces identical files
3. **Speed**: All golden tests complete in <1 second total
4. **CI integration**: Tests run in CI and fail on unexpected diffs

### Fine-Grained Validation Tests

Each of these mutations to a golden file MUST cause the test to fail. This verifies
that the comparison is truly byte-for-byte and catches subtle drifts.

#### 1. Hint Property Name Changes (The Original Bug)

Change `value` to `selected` in a Set hint - this was the bug that went undetected:

```yaml
# Before (correct)
Set: { op: "set_single_select", fieldId: "priority", value: "option_id" }

# After (wrong - should fail)
Set: { op: "set_single_select", fieldId: "priority", selected: "option_id" }
```

#### 2. Operation Type Changes

Change the operation type in a hint:

```yaml
# Before
Set: { op: "set_string_list", fieldId: "tags", value: ["...", "..."] }

# After (wrong op)
Set: { op: "set_string", fieldId: "tags", value: ["...", "..."] }
```

#### 3. Field ID Changes

Change a field ID reference:

```yaml
# Before
- **priority** (field): Required field "Priority" has no selection

# After (different field id)
- **priorityy** (field): Required field "Priority" has no selection
```

#### 4. Issue Message Text Changes

Change the human-readable issue text:

```yaml
# Before
- **tags** (field): Required field "Tags" is empty

# After (subtle text change)
- **tags** (field): Required field "Tags" is Empty
```

#### 5. Patch Value Changes in Response

Change a value in the mock response patches:

```yaml
# Before
- field_id: priority
  op: set_single_select
  value: medium

# After (different value)
- field_id: priority
  op: set_single_select
  value: high
```

#### 6. Whitespace Changes

Add or remove whitespace (YAML is whitespace-sensitive):

```yaml
# Before
Type: string_list
Set: { op: "set_string_list", fieldId: "tags", value: ["...", "..."] }

# After (extra blank line)
Type: string_list

Set: { op: "set_string_list", fieldId: "tags", value: ["...", "..."] }
```

#### 7. System Prompt Changes

Modify the system prompt content:

```yaml
# Before
system: |
  You are a form-filling assistant...

# After (subtle change)
system: |
  You are a form filling assistant...
```

#### 8. Tool Schema Changes

Change the tool schema structure:

```yaml
# Before
fill_form:
  description: Fill form fields by submitting patches.

# After (description changed)
fill_form:
  description: Fill form fields by submitting patch operations.
```

#### 9. Hash/Checksum Changes

Change the SHA256 hash (if present):

```yaml
# Before
markdown_sha256: abc123def456...

# After
markdown_sha256: abc123def457...
```

#### 10. Ordering Changes

Reorder items that should have stable ordering:

```yaml
# Before (alphabetical by field_id)
- field_id: age
- field_id: categories
- field_id: email

# After (different order)
- field_id: categories
- field_id: age
- field_id: email
```

### Verification Script

Create a validation script that programmatically tests each mutation:

```typescript
// tests/golden/validation.test.ts
import { describe, expect, it } from 'vitest';

const MUTATIONS = [
  {
    name: 'hint property name (value → selected)',
    find: 'value: "option_id"',
    replace: 'selected: "option_id"',
  },
  {
    name: 'operation type (set_string_list → set_string)',
    find: 'op: "set_string_list"',
    replace: 'op: "set_string"',
  },
  {
    name: 'field id typo',
    find: '**priority**',
    replace: '**priorityy**',
  },
  {
    name: 'issue text case change',
    find: 'is empty',
    replace: 'is Empty',
  },
  {
    name: 'patch value change',
    find: 'value: medium',
    replace: 'value: high',
  },
  {
    name: 'extra whitespace',
    find: 'Type: string_list\n          Set:',
    replace: 'Type: string_list\n\n          Set:',
  },
];

describe('Golden Test Sensitivity', () => {
  for (const mutation of MUTATIONS) {
    it(`detects: ${mutation.name}`, async () => {
      // Load golden, apply mutation, verify test would fail
      const golden = readFileSync(GOLDEN_PATH, 'utf-8');
      const mutated = golden.replace(mutation.find, mutation.replace);

      // Regenerate should NOT match mutated version
      const regenerated = await regenerateSession(GOLDEN_PATH);
      expect(normalizeSession(regenerated)).not.toBe(normalizeSession(mutated));
    });
  }
});
```

### Manual Verification Commands

```bash
# 1. Baseline: tests should pass
pnpm test:golden

# 2. Apply each mutation and verify failure
# (Do this for each mutation type above)

# Example: Test hint property name change
sed -i '' 's/value: "option_id"/selected: "option_id"/' \
  examples/simple/simple.session.yaml
pnpm test:golden  # MUST fail
git checkout examples/simple/simple.session.yaml  # Restore

# Example: Test operation type change
sed -i '' 's/op: "set_string_list"/op: "set_string"/' \
  examples/simple/simple.session.yaml
pnpm test:golden  # MUST fail
git checkout examples/simple/simple.session.yaml  # Restore

# 3. Verify regeneration restores to passing state
pnpm test:golden:regen
pnpm test:golden  # Should pass
```

### CI Integration

The CI pipeline should:

1. Run `pnpm test:golden` on every PR
2. Fail if any session file differs from regenerated version
3. Require explicit `pnpm test:golden:regen` + commit to update golden files
4. Show diff in CI output for easy debugging
