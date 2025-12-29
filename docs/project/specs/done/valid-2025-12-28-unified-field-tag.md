# Feature Validation: Unified Field Tag Syntax

## Purpose

This is a validation spec documenting the post-testing validation performed and any
remaining manual validation needed to confirm the unified field tag syntax migration.

**Feature Plan:** [plan-2025-12-28-unified-field-tag.md](plan-2025-12-28-unified-field-tag.md)

**Implementation Plan:** N/A (implementation details included in feature plan)

## Stage 4: Validation Stage

## Validation Planning

The unified field tag migration replaces 11 distinct field tags (`{% string-field %}`,
`{% number-field %}`, etc.) with a single unified `{% field kind="..." %}` syntax.

### Scope of Changes

1. **Serializer** (`serialize.ts`): All 11 `serializeXxxField()` functions now output
   `{% field kind="xxx" %}` syntax
2. **Parser** (`parseFields.ts`): Accepts unified syntax, rejects legacy tags with clear
   migration hints
3. **Form files**: All 11 `.form.md` files migrated
4. **Session files**: 2 `.session.yaml` files migrated
5. **Unit tests**: 12 test files updated with new syntax
6. **Documentation**: SPEC.md, DOCS.md, README.md, architecture docs updated

## Automated Validation (Testing Performed)

### Unit Testing

All 653 unit tests pass, including:

- **Parse tests** (`parse.test.ts`): 75 tests covering all field kinds with unified syntax
- **Serialize tests** (`serialize.test.ts`): 38 tests verifying correct output format
- **Validate tests** (`validate.test.ts`): 41 tests for field validation
- **Apply tests** (`apply.test.ts`): 28 tests for patch application
- **Harness tests** (`harness.test.ts`): 28 tests including `getMarkdown()` verification
- **Golden tests** (`golden.test.ts`): 3 tests validating session round-trip

**New Error Case Tests Added** (6 tests in `parse.test.ts`):
- `{% field %}` without `kind` attribute throws `"field tag missing required 'kind' attribute"`
- `{% field kind="invalid" %}` throws error with valid kinds list
- `{% string-field %}` throws `"Legacy field tag 'string-field' is no longer supported. Use {% field kind="string" %} instead"`
- `{% number-field %}` throws legacy rejection error
- `{% single-select %}` throws legacy rejection error
- `{% table-field %}` throws legacy rejection error

### Integration and End-to-End Testing

- **Golden session tests**: Verified parse-serialize round-trip with regenerated golden files
- **Programmatic fill tests**: 8 tests validating end-to-end form filling
- **CLI examples tests**: 18 tests validating example forms parse correctly

### Pre-commit Validation

- TypeScript type checking passes
- ESLint passes with 0 warnings
- Prettier formatting applied
- All 653 tests pass

## Manual Testing Needed

### 1. Verify CLI Inspect Output

Run `markform inspect` on a migrated form to confirm it parses correctly:

```bash
pnpm markform inspect packages/markform/examples/simple/simple.form.md
```

**Expected**: Form parses without errors, shows unified field syntax in any output.

### 2. Verify Legacy Tag Rejection

Test that legacy tags produce clear error messages:

```bash
echo '---
markform:
  spec: MF/0.1
---
{% form id="test" %}
{% field-group id="g" %}
{% string-field id="f" label="L" %}{% /string-field %}
{% /field-group %}
{% /form %}' | pnpm markform inspect -
```

**Expected**: ParseError with message containing:
- `Legacy field tag 'string-field' is no longer supported`
- `Use {% field kind="string" %} instead`

### 3. Review Documentation Updates

Confirm documentation accurately reflects the new syntax:

- [ ] `packages/markform/SPEC.md` - Field Tags section shows unified syntax
- [ ] `packages/markform/DOCS.md` - Examples use `{% field kind="..." %}`
- [ ] `README.md` (root and package) - Examples updated

### 4. Verify Web Server (Optional)

If using the web UI, start the server and verify forms render correctly:

```bash
pnpm markform serve packages/markform/examples/simple/simple.form.md
```

**Expected**: Form renders with all fields functional, no console errors.

## Validation Checklist

- [x] All 653 tests pass
- [x] TypeScript compiles without errors
- [x] ESLint passes
- [x] No legacy field tags in source files (verified via grep)
- [x] No legacy field tags in form files (verified via grep)
- [x] Golden tests regenerated and pass
- [x] Error case tests added for legacy tag rejection
- [x] Documentation updated with new syntax
- [ ] Manual CLI inspect validation (user)
- [ ] Manual legacy rejection test (user)
- [ ] Documentation review (user)
