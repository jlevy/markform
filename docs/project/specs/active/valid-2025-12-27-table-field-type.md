# Feature Validation: Table Field Type

## Purpose

This is a validation spec for the new `table-field` type implementation in Markform,
used to collect structured tabular data with typed columns.

**Feature Plan:** [plan-2025-12-27-table-field-type.md]

## Stage 4: Validation Stage

## Validation Planning

## Automated Validation (Testing Performed)

### Unit Testing

**✅ Scope Reference Parsing (`scopeRef.test.ts`)**

- Parsing field references: `company_name` → `{ type: 'field', fieldId: 'company_name'
  }`

- Parsing qualified references: `rating.bullish` → `{ type: 'option', fieldId: 'rating',
  optionId: 'bullish' }`

- Parsing cell references: `key_people.name[0]` → `{ type: 'cell', fieldId:
  'key_people', columnId: 'name', rowIndex: 0 }`

- Validating negative row indices are rejected

- Validating malformed syntax is rejected

- Round-trip serialization/parsing works correctly

**✅ Scope Reference Validation (`scopeRefValidation.test.ts`)**

- Type compatibility validation (cell refs only valid for table fields)

- Column existence validation with helpful error messages

- Row bounds validation when rowCounts provided

- Option/column disambiguation for qualified references

- Field existence validation

**✅ Table Parsing (`table/parseTable.test.ts`)**

- Markdoc AST table parsing with proper node traversal

- Cell text extraction from Markdoc nodes

- Sentinel value parsing (`%SKIP%`, `%SKIP% (reason)`, `%ABORT%`)

- Type coercion for string, number, url, date, year values

- Error handling for invalid types and malformed values

- Edge cases: empty tables, single rows, escaped pipes

**✅ Table Serialization (`table/serializeTable.test.ts`)**

- Markdown table generation with proper headers and separators

- Cell value escaping (`|` → `\|`, `\|` → `\\|`)

- Sentinel value preservation in output

- Empty table handling (header + separator only)

- Attribute ordering and formatting

**✅ Table Validation (`table/validateTable.test.ts`)**

- Row count constraints (minRows, maxRows)

- Cell type validation against column types

- Empty cell rejection (must use sentinels)

- Required field validation (required=true implies minRows >= 1)

- Error code generation and messaging

**✅ Field Parsing (`parseTableField.test.ts`)**

- Column attribute parsing (columnIds, columnLabels, columnTypes)

- Column ID validation (snake_case identifiers)

- Array length validation between column attributes

- Label backfilling from markdown headers

- Header count validation when backfilling

- Sentinel detection in table cells

- Row structure validation

**✅ Patch Application (`applyTable.test.ts`)**

- Set table patch processing

- Sentinel string parsing in patches

- Row structure validation

- Type compatibility validation

**✅ Integration Testing (`tableField.integration.test.ts`)**

- End-to-end roundtrip: parse → serialize → parse

- Sentinel value preservation through serialization

- Complex table structures with mixed data types

**✅ Field Registry Testing (`fieldRegistry.test.ts`)**

- Updated to expect 11 field kinds including ‘table’

- Type relationships validation (field → value → patch)

- Empty value generation for table fields

### Integration and End-to-End Testing

**✅ Complete TDD Implementation**

- 8 test suites with comprehensive coverage

- 744 total tests following Red → Green → Refactor approach

- All parsing, validation, serialization, and patching tested

- Integration tests for end-to-end workflows

**✅ Type Safety Validation**

- Full TypeScript compilation passes

- Zod schema validation for all table types

- Discriminated union types properly implemented

- Error handling with proper type guards

### Manual Testing Needed

## User Validation Checklist

### Basic Table Field Usage

1. **Create a simple table field form:**
   ```md
   {% table-field id="team" label="Team Members" 
      columnIds=["name", "role", "email"] %}
   | Name | Role | Email |
   |------|------|-------|
   {% /table-field %}
   ```

2. **Verify parsing works:**

   - Run `markform inspect` on the form

   - Confirm table field appears in structure summary

   - Check column count and types are detected

3. **Test serialization roundtrip:**

   - Fill the form with sample data

   - Run `markform export --format=json`

   - Verify table data exports as structured JSON with cell states

### Typed Columns Validation

4. **Test column types:**
   ```md
   {% table-field id="products" label="Products"
      columnIds=["name", "price", "website", "release_date"]
      columnTypes=["string", "number", "url", "date"] %}
   | Product Name | Price | Website | Release Date |
   |--------------|-------|---------|--------------|
   {% /table-field %}
   ```

5. **Verify type validation:**

   - Try entering invalid number in price column

   - Try entering invalid URL in website column

   - Try entering invalid date format in release_date column

   - Confirm appropriate error messages appear

### Sentinel Values Testing

6. **Test sentinel values:**
   ```md
   {% table-field id="tasks" label="Tasks" 
      columnIds=["task", "status", "notes"] %}
   | Task | Status | Notes |
   |------|--------|-------|
   | Research competitors | %SKIP% (Low priority) | |
   | Update documentation | done | |
   | Fix bug | %ABORT% (Blocked by dependency) | |
   {% /table-field %}
   ```

7. **Verify sentinel handling:**

   - Check `%SKIP%` values are preserved with reasons

   - Check `%ABORT%` values are preserved with reasons

   - Confirm skipped cells don’t block form completion

   - Confirm aborted cells mark the table as aborted

### Label Backfilling

8. **Test label backfilling:**
   ```md
   {% table-field id="contacts" label="Contacts"
      columnIds=["first_name", "last_name", "phone"] %}
   | First Name | Last Name | Phone Number |
   |------------|-----------|--------------|
   {% /table-field %}
   ```

9. **Verify labels are extracted:**

   - Fill the form and serialize it

   - Check that `columnLabels` attribute is added with extracted headers

   - Confirm subsequent parses use the explicit labels

### Row Constraints

10. **Test row constraints:**
    ```md
    {% table-field id="board_members" label="Board Members" required=true
       minRows=3 maxRows=7
       columnIds=["name", "role", "tenure_years"]
       columnTypes=["string", "string", "number"] %}
    | Name | Role | Tenure (Years) |
    |------|------|----------------|
    {% /table-field %}
    ```

11. **Verify constraints:**

    - Try submitting with fewer than 3 rows (should fail)

    - Try submitting with more than 7 rows (should fail)

    - Confirm required=true enforces minRows >= 1

### Error Messages and UX

12. **Test error scenarios:**

    - Invalid column IDs (spaces, uppercase)

    - Mismatched array lengths between column attributes

    - Invalid column types

    - Empty cells without sentinels

13. **Verify error messages:**

    - Check error messages are clear and actionable

    - Confirm error codes are consistent with taxonomy

    - Test scope references in error messages

### CLI Integration

14. **Test CLI commands:**

    - `markform inspect` shows table fields correctly

    - `markform export` exports table data properly

    - `markform fill --mock` generates valid table data

### Complex Real-World Usage

15. **Test complex table scenarios:**

    - Large tables (20+ rows, 10+ columns)

    - Mixed data types in same table

    - Tables with many sentinel values

    - Nested form contexts with table fields

## Post-Implementation Review

After completing the manual validation above:

- Review the implementation against the original plan spec

- Confirm all acceptance criteria are met

- Test performance with large forms containing multiple table fields

- Verify backward compatibility (existing forms still parse correctly)

- Document any limitations or known issues

## Feedback and Revisions

[Add any user feedback, issues found, or requested revisions here]
