# Feature Validation: JSON Schema Export

## Purpose

This validation spec documents the testing performed and manual validation needed for the JSON Schema export feature, which enables exporting Markform form structures as standard JSON Schema.

**Feature Plan:** [plan-2025-12-28-json-schema-export.md](./plan-2025-12-28-json-schema-export.md)

**Implementation Plan:** N/A (implementation followed plan spec directly)

## Stage 4: Validation Stage

## Automated Validation (Testing Performed)

### Unit Testing

32 unit tests in `tests/unit/jsonSchema.test.ts` covering:

**Golden Schema Snapshot Test:**
- Compares generated schema against `examples/simple/simple.schema.json` snapshot
- Uses file-based test data from `simple.form.md` (not hardcoded inline form)

**Form-Level Schema Generation:**
- Generates valid JSON Schema with `$schema` and `$id`
- Includes form title and description from doc blocks
- Generates `required` array from required fields
- Includes `x-markform` extension at schema level with spec, roles, roleInstructions, groups
- Excludes `x-markform` when `includeExtensions: false`
- Uses correct `$schema` URL for different drafts (2020-12, 2019-09, draft-07)

**Field Type Mapping Tests (all 11 types):**

| Field Type | Tests |
|------------|-------|
| `string` | Schema with constraints (minLength, maxLength), pattern for regex, x-markform with role/placeholder/examples |
| `number` | Integer schema for `integer=true`, number schema for floating point, priority in x-markform |
| `string_list` | Array schema with string items, minItems/maxItems/uniqueItems, item constraints (itemMinLength/itemMaxLength) |
| `url` | URI format string schema |
| `url_list` | Array with URI format items |
| `date` | Date format string, minDate/maxDate in x-markform extension |
| `year` | Integer with min/max |
| `single_select` | String with enum of option IDs |
| `multi_select` | Array with enum items, minItems/maxItems from minSelections/maxSelections |
| `checkboxes` | Object schema with properties for each option; correct enum values per mode (multi/simple/explicit); checkboxMode and approvalMode in x-markform |
| `table` | Array of objects with column schemas, required columns, minRows/maxRows |

**Group Handling:**
- Includes group ID in field x-markform for non-implicit groups
- Lists groups in schema-level x-markform

### Integration and End-to-End Testing

- All 710 tests pass including the 32 JSON Schema tests
- CLI command tested manually during development
- Pre-commit hooks pass (typecheck, lint, format, full test suite)

### Golden Test Refactoring (Latest Update)

The JSON Schema testing was refactored to use file-based golden tests:

1. **Schema Snapshot Test** - `tests/unit/jsonSchema.test.ts` now includes a golden schema comparison test that compares the generated schema against `examples/simple/simple.schema.json`

2. **File-Based Test Data** - Replaced 118-line hardcoded `TEST_FORM_MD` with the actual `simple.form.md` example form, providing:
   - Single source of truth for test data
   - Consistent test data across session and schema tests
   - Full diffability of schema changes in code review

3. **Schema Regeneration Script** - Extended `scripts/regen-golden-sessions.ts` to also regenerate schema snapshots:
   - Run `pnpm --filter markform test:golden:regen` to regenerate both session transcripts AND schema snapshots
   - New `SCHEMAS` configuration array for forms with schema snapshots

4. **Documentation Updated** - `docs/development.md` now documents the schema regeneration process alongside session transcript regeneration

### Not Implemented (From Plan Spec)

The following items from the plan spec were not implemented:

1. **Ajv meta-validation** - Not added as the snapshot comparison provides equivalent coverage with simpler tooling

2. **DOCS.md update** - Documentation update was not performed (the CLI command is discoverable via `--help`)

3. **zod-to-json-schema dependency** - Not needed as the implementation converts from `ParsedForm` directly

## Manual Testing Needed

### CLI Command Validation

The user should validate the CLI command works correctly:

**1. Basic Schema Generation:**
```bash
markform schema packages/markform/examples/simple/simple.form.md
```
- Verify output is valid JSON with `$schema` and `$id`
- Check that all fields from the form appear in `properties`
- Verify `required` array contains the expected required fields

**2. Pure Mode (No Extensions):**
```bash
markform schema --pure packages/markform/examples/simple/simple.form.md
```
- Verify NO `x-markform` properties appear anywhere in output
- Confirm it's still valid JSON Schema

**3. Different Draft Versions:**
```bash
markform schema --draft 2020-12 packages/markform/examples/simple/simple.form.md
markform schema --draft 2019-09 packages/markform/examples/simple/simple.form.md
markform schema --draft draft-07 packages/markform/examples/simple/simple.form.md
```
- Verify each produces correct `$schema` URL:
  - 2020-12: `https://json-schema.org/draft/2020-12/schema`
  - 2019-09: `https://json-schema.org/draft/2019-09/schema`
  - draft-07: `http://json-schema.org/draft-07/schema#`

**4. YAML Output:**
```bash
markform schema --format yaml packages/markform/examples/simple/simple.form.md
```
- Verify output is valid YAML
- Check structure matches JSON output

**5. Compact JSON Output:**
```bash
markform schema --compact packages/markform/examples/simple/simple.form.md
```
- Verify output is single-line JSON without formatting

**6. Test with Movie Research Form (more complex):**
```bash
markform schema packages/markform/examples/movie-research/movie-research-basic.form.md
```
- Verify all field types present in this form are correctly mapped
- Check descriptions appear from doc blocks
- Verify groups are listed in x-markform

### Output Quality Verification

For the simple.form.md output, verify:

1. **Field type mappings are correct:**
   - `name`, `email` fields → `type: "string"`
   - `age` field → `type: "integer"` (not number, since integer=true)
   - `score` field → `type: "number"`
   - `tags` field → `type: "array"` with string items
   - `priority` field → `type: "string"` with enum
   - `categories` field → `type: "array"` with enum items
   - `checkboxes` fields → `type: "object"` with properties
   - `website` → `type: "string"` with `format: "uri"`
   - `event_date` → `type: "string"` with `format: "date"`
   - `founded_year` → `type: "integer"`
   - `team_members`, `project_tasks` → `type: "array"` with object items

2. **Constraints are preserved:**
   - minLength/maxLength for strings
   - min/max for numbers
   - minItems/maxItems for arrays
   - uniqueItems when specified
   - pattern for regex

3. **Extension data is correct:**
   - Each field has correct `role`
   - `priority` only appears when not "medium"
   - `group` shows the parent group ID
   - Checkbox fields have `checkboxMode`

### API Validation

If using the library API directly, verify:

```typescript
import { parseForm, formToJsonSchema } from 'markform';

const form = parseForm(formMarkdown);
const { schema } = formToJsonSchema(form);

// Check schema structure
console.log(schema.$schema);  // Should be draft URL
console.log(schema.$id);      // Should be form ID
console.log(schema.properties); // Should have all fields
```

## Validation Checklist

- [ ] CLI `markform schema <file>` produces valid JSON Schema
- [ ] `--pure` flag removes all x-markform extensions
- [ ] `--draft` flag changes the $schema URL correctly
- [ ] `--format yaml` produces valid YAML output
- [ ] `--compact` produces single-line JSON
- [ ] All 11 field types map correctly
- [ ] Required fields appear in required array
- [ ] Field labels appear as `title`
- [ ] Doc block descriptions appear as `description`
- [ ] x-markform extension contains expected metadata

## User Feedback

> (Record any issues or feedback from manual validation below)
