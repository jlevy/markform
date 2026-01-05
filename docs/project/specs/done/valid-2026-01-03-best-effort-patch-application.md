# Feature Validation: Best-Effort Patch Application with Value Coercion

## Purpose

This validation spec documents the testing performed and manual validation needed for the
best-effort patch application feature with automatic value coercion.

**Feature Plan:** [implemented-2026-01-03-best-effort-patch-application.md](../completed/implemented-2026-01-03-best-effort-patch-application.md)

## Stage 4: Validation Stage

## Automated Validation (Testing Performed)

### Unit Testing

All unit tests pass (1415 tests total). Key test coverage:

**Core apply logic** (`packages/markform/tests/unit/engine/apply.test.ts`):

- **Best-effort semantics**: Verifies valid patches applied even when others fail
  - `applyStatus: 'applied'` when all patches succeed
  - `applyStatus: 'partial'` when some succeed, some fail
  - `applyStatus: 'rejected'` when all patches fail
  - `appliedPatches` array correctly reflects only applied patches
  - `rejectedPatches` array contains detailed errors for failed patches

**Value coercion tests** (`packages/markform/tests/unit/engine/apply.test.ts`):

- Single string → string_list coercion with warning
- Single URL → url_list coercion with warning
- Single option ID → multi_select array coercion with warning
- Boolean → checkbox coercion with appropriate mode (done/yes)
- Coerced values appear in `appliedPatches` (not original)
- `warnings` array contains coercion details

**Golden session tests**:

- Updated `rejection-test.session.yaml` to reflect best-effort behavior
- Turn 1 now applies valid patches even when one fails
- Verified hash stability after change

### Integration and End-to-End Testing

**Type checking**: `pnpm typecheck` passes
- All type additions are backward compatible
- ApplyResult interface extended (not modified)

**Linting**: `pnpm lint` passes
- ESLint disabled for intentional `any` usage in coercion tests

**Build**: `pnpm build` passes
- All packages build correctly

## Manual Testing Needed

### 1. CLI Apply Command

Run the CLI apply command with mixed valid/invalid patches:

```bash
cd packages/markform
# Create a test form with string_list field
echo '# Test Form

## Section

- Name: {% #name type:string %}
- Tags: {% #tags type:string_list %}
- URLs: {% #urls type:url_list %}
' > /tmp/test-form.md

# Test best-effort with one valid and one invalid patch
echo '[
  {"op": "set_string", "fieldId": "name", "value": "Alice"},
  {"op": "set_string", "fieldId": "nonexistent", "value": "fail"}
]' | pnpm markform apply /tmp/test-form.md

# Expected: name is set, nonexistent is rejected, status is "partial"
```

**Verify**:
- Output shows `apply_status: partial`
- `applied_patches` contains the valid name patch
- `rejected_patches` contains error for nonexistent field
- Form content shows name filled

### 2. Coercion via CLI

Test value coercion behavior:

```bash
# Test single string → string_list coercion
echo '[
  {"op": "set_string_list", "fieldId": "tags", "value": "single-tag"}
]' | pnpm markform apply /tmp/test-form.md

# Expected: applied with warning, value coerced to ["single-tag"]
```

**Verify**:
- Output shows `apply_status: applied`
- `warnings` array contains coercion warning
- Form content shows `- single-tag`

### 3. AI SDK Integration

If you have an OpenAI/Anthropic API key configured, test with the example scripts:

```bash
cd packages/markform/examples/consulting-intake
pnpm tsx consulting-intake-fill.ts
```

**Verify**:
- Form fills correctly with partial patch scenarios
- Coerced values are handled gracefully
- Agent sees coercion warnings and can self-correct

### 4. Review API Documentation

Check that documentation accurately reflects the new behavior:

- [ ] `docs/markform-spec.md` - Has "Best-Effort Patching Semantics" section
- [ ] `docs/markform-spec.md` - Has "Recommended Value Coercions" table
- [ ] `docs/markform-apis.md` - Documents `appliedPatches`, `warnings` fields

## Open Questions

None - implementation matches spec and all tests pass.
