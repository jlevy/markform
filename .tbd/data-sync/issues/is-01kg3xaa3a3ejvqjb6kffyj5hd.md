---
close_reason: null
closed_at: 2025-12-29T00:19:25.542Z
created_at: 2025-12-29T00:06:33.684Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.175Z
    original_id: markform-421
id: is-01kg3xaa3a3ejvqjb6kffyj5hd
kind: task
labels: []
parent_id: null
priority: 3
status: closed
title: Enhance validation spec with detailed test case documentation
type: is
updated_at: 2025-12-29T00:19:25.542Z
version: 1
---
Enhance the validation spec with more detailed test case documentation, following the thorough approach from Grok's PR #31.

## Enhancement Areas

### Current State
Our validation spec at `docs/project/specs/active/valid-2025-12-27-table-field-type.md` documents:
- Total test count (637 tests)
- High-level test categories
- Manual testing steps

### Improvements to Add
Following Grok's more detailed approach, add specific test case documentation for:

**Scope Reference Parsing:**
- Parsing field references
- Parsing qualified references
- Parsing cell references with row indices
- Negative row index rejection
- Malformed syntax rejection
- Round-trip serialization/parsing

**Scope Reference Validation:**
- Type compatibility validation
- Column existence validation
- Row bounds validation
- Option/column disambiguation
- Field existence validation

**Table Parsing:**
- Markdoc AST table parsing
- Cell text extraction
- Sentinel value parsing (%SKIP%, %ABORT%)
- Type coercion for all column types
- Edge cases: empty tables, single rows, escaped pipes

**Table Serialization:**
- Markdown table generation
- Cell value escaping
- Sentinel value preservation
- Empty table handling
- Attribute ordering

**Table Validation:**
- Row count constraints (minRows, maxRows)
- Cell type validation
- Empty cell rejection
- Required field validation

## Files to Modify
- `docs/project/specs/active/valid-2025-12-27-table-field-type.md`

## Notes
This is documentation-only - no code changes required.
