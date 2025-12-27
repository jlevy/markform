# Feature Validation: Date and Year Field Types

## Purpose

This validation spec documents the testing performed for the `date-field` and `year-field`
implementations, and lists remaining manual validation steps for the reviewer.

**Feature Plan:** [plan-2025-12-27-date-field-type.md](plan-2025-12-27-date-field-type.md)

## Stage 4: Validation Stage

## Automated Validation (Testing Performed)

The implementation includes comprehensive unit test coverage across all engine components.
All 518 tests pass.

### Unit Testing

#### Field Registry (`tests/unit/engine/fieldRegistry.test.ts`)

- ✅ FIELD_KINDS array includes 'date' and 'year'
- ✅ `createEmptyValue('date')` returns `{ kind: 'date', value: null }`
- ✅ `createEmptyValue('year')` returns `{ kind: 'year', value: null }`
- ✅ Exhaustiveness checks cover date and year kinds

#### Core Types (`src/engine/coreTypes.ts`)

- ✅ `DateFieldSchema` Zod schema validates correctly
- ✅ `YearFieldSchema` Zod schema validates correctly
- ✅ `DateValueSchema` validates correctly
- ✅ `YearValueSchema` validates correctly
- ✅ `SetDatePatchSchema` validates correctly
- ✅ `SetYearPatchSchema` validates correctly
- ✅ FieldKind union includes 'date' and 'year'
- ✅ Field, FieldValue, and Patch unions include new types

#### Parser (`src/engine/parse.ts`)

- ✅ `parseDateField()` parses date-field tags with all attributes
- ✅ `parseYearField()` parses year-field tags with all attributes
- ✅ Parse switch handles date-field and year-field tag names
- ✅ Handles required, min, max attributes
- ✅ Parses fence content for date/year values
- ✅ SKIP/ABORT sentinel handling

#### Serializer (`src/engine/serialize.ts`)

- ✅ `serializeDateField()` serializes date fields to Markdoc
- ✅ `serializeYearField()` serializes year fields to Markdoc
- ✅ Attributes (min, max, required) are preserved
- ✅ Raw serialization support for both field types

#### Validator (`src/engine/validate.ts`)

- ✅ `validateDateField()` checks required fields
- ✅ `validateDateField()` validates YYYY-MM-DD format
- ✅ `validateDateField()` validates min/max constraints
- ✅ `validateYearField()` checks required fields
- ✅ `validateYearField()` validates integer format
- ✅ `validateYearField()` validates min/max constraints (default 1000-2500)
- ✅ `isValidDate()` helper validates date format and calendar correctness

#### Apply (`src/engine/apply.ts`)

- ✅ `applySetDate()` applies set_date patches
- ✅ `applySetYear()` applies set_year patches
- ✅ Patch validation for date and year patches
- ✅ clear_field works for date and year fields

#### Summaries (`src/engine/summaries.ts`)

- ✅ Date and year fields counted in `fieldCountByKind`
- ✅ `isFieldSubmitted()` handles date and year fields

#### Value Coercion (`src/engine/valueCoercion.ts`)

- ✅ `coerceToDate()` converts string input to date value
- ✅ `coerceToYear()` converts string/number input to year value
- ✅ `coerceToFieldPatch()` handles date and year field kinds

#### CLI (`src/cli/lib/patchFormat.ts`)

- ✅ `formatPatchValue()` handles set_date and set_year patches
- ✅ `formatPatchType()` handles set_date and set_year patches

### Integration and End-to-End Testing

- ✅ Full test suite passes (518 tests)
- ✅ Build succeeds with new types
- ✅ TypeScript compilation with strict mode passes
- ✅ ESLint checks pass
- ✅ Prettier formatting passes

## Manual Testing Needed

The following areas require manual validation by the reviewer:

### 1. CLI Commands - Date Field

Test with a form containing a date-field:

```bash
# Create a test form with date field
cat > /tmp/test-date.form.md << 'EOF'
---
markform:
  spec: MF/0.1
---

{% form id="test_form" %}
{% field-group id="dates" %}

{% date-field id="deadline" label="Project Deadline" required=true %}{% /date-field %}

{% date-field id="start_date" label="Start Date" min="2025-01-01" max="2025-12-31" %}{% /date-field %}

{% /field-group %}
{% /form %}
EOF

# Test parsing
pnpm --filter=markform exec markform parse /tmp/test-date.form.md

# Test inspection
pnpm --filter=markform exec markform inspect /tmp/test-date.form.md

# Test validation (should report required field empty)
pnpm --filter=markform exec markform validate /tmp/test-date.form.md
```

**Expected behavior:**
- Parse should succeed and show date fields with correct attributes
- Inspect should show date fields with their constraints
- Validate should report "deadline" as empty (required field)

### 2. CLI Commands - Year Field

Test with a form containing a year-field:

```bash
# Create a test form with year field
cat > /tmp/test-year.form.md << 'EOF'
---
markform:
  spec: MF/0.1
---

{% form id="test_form" %}
{% field-group id="years" %}

{% year-field id="founded_year" label="Year Founded" required=true %}{% /year-field %}

{% year-field id="target_year" label="Target Year" min=2020 max=2030 %}{% /year-field %}

{% /field-group %}
{% /form %}
EOF

# Test parsing
pnpm --filter=markform exec markform parse /tmp/test-year.form.md

# Test inspection
pnpm --filter=markform exec markform inspect /tmp/test-year.form.md

# Test validation
pnpm --filter=markform exec markform validate /tmp/test-year.form.md
```

**Expected behavior:**
- Parse should succeed and show year fields with correct attributes
- Inspect should show year fields with their constraints
- Validate should report "founded_year" as empty (required field)

### 3. Apply Patches

Test applying patches to date and year fields:

```bash
# Apply a date patch
echo '{"op":"set_date","fieldId":"deadline","value":"2025-06-15"}' | \
  pnpm --filter=markform exec markform apply /tmp/test-date.form.md

# Apply a year patch
echo '{"op":"set_year","fieldId":"founded_year","value":2015}' | \
  pnpm --filter=markform exec markform apply /tmp/test-year.form.md
```

**Expected behavior:**
- Date field should be updated with the provided date value
- Year field should be updated with the provided year value
- Output should show the updated markdown

### 4. Validation Constraints

Test that validation properly enforces constraints:

```bash
# Create form with filled values
cat > /tmp/test-validation.form.md << 'EOF'
---
markform:
  spec: MF/0.1
---

{% form id="test_form" %}
{% field-group id="test" %}

{% date-field id="date1" label="Date" min="2025-01-01" max="2025-12-31" %}
```value
2024-06-15
```
{% /date-field %}

{% year-field id="year1" label="Year" min=2020 max=2030 %}
```value
2019
```
{% /year-field %}

{% /field-group %}
{% /form %}
EOF

# Validate (should report out-of-range errors)
pnpm --filter=markform exec markform validate /tmp/test-validation.form.md
```

**Expected behavior:**
- Validation should report date1 is before minimum (2025-01-01)
- Validation should report year1 is before minimum (2020)

### 5. Invalid Date Format Validation

Test that invalid date formats are rejected:

```bash
cat > /tmp/test-invalid-date.form.md << 'EOF'
---
markform:
  spec: MF/0.1
---

{% form id="test_form" %}
{% field-group id="test" %}

{% date-field id="bad_date" label="Bad Date" %}
```value
not-a-date
```
{% /date-field %}

{% date-field id="impossible_date" label="Impossible Date" %}
```value
2025-02-30
```
{% /date-field %}

{% /field-group %}
{% /form %}
EOF

pnpm --filter=markform exec markform validate /tmp/test-invalid-date.form.md
```

**Expected behavior:**
- bad_date should be flagged as invalid format
- impossible_date should be flagged as invalid (Feb 30 doesn't exist)

### 6. Web UI (if applicable)

If the web UI is available, verify:
- Date fields render with appropriate date picker or input
- Year fields render with appropriate number input
- Validation errors display correctly for invalid dates/years

```bash
pnpm --filter=markform exec markform serve /tmp/test-date.form.md
# Open browser and verify date field rendering
```

### 7. Round-Trip Serialization

Verify that parsing and serializing produces identical output:

```bash
# Parse, serialize, and compare
pnpm --filter=markform exec markform parse /tmp/test-date.form.md --format=json | \
  pnpm --filter=markform exec markform serialize --stdin
```

**Expected behavior:**
- Output should match the original input format
- All attributes (min, max, required) should be preserved

## Reviewer Checklist

- [ ] All CLI commands work correctly with date and year fields
- [ ] Validation errors are clear and actionable
- [ ] Min/max constraints are properly enforced
- [ ] Invalid date formats are rejected with helpful messages
- [ ] Year defaults (1000-2500) are reasonable
- [ ] Code follows existing patterns in the codebase
- [ ] No regressions in existing functionality
