---
close_reason: null
closed_at: 2025-12-29T00:14:38.718Z
created_at: 2025-12-29T00:05:33.353Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.987Z
    original_id: markform-418
id: is-01kg3x1bv8033qhdttfmn5yech
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Add table-field documentation to SPEC.md
type: is
updated_at: 2025-12-29T00:14:38.718Z
version: 1
---
Add comprehensive table-field documentation to SPEC.md, incorporating valuable additions from Grok's PR #31.

## Documentation to Add

### Table Field Attributes Section
Add a table documenting table-field attributes:
| Attribute | Type | Required | Description |
| --- | --- | --- | --- |
| `columnIds` | string[] | Yes | Array of snake_case column identifiers |
| `columnLabels` | string[] | No | Array of display labels (defaults to columnIds) |
| `columnTypes` | string[] | No | Array of column types (defaults to all 'string') |
| `minRows` | number | No | Minimum row count (default: 0) |
| `maxRows` | number | No | Maximum row count (default: unlimited) |

### Column Type Validation
Document valid column types and their validation:
- `string`: Any text value
- `number`: Numeric values (integers or floats)
- `url`: Valid URL format
- `date`: ISO 8601 date format (YYYY-MM-DD)
- `year`: Integer year (1000-9999)

### Examples
Add clean template syntax examples and complete examples with data.

### Sentinel Values in Cells
Document how to use %SKIP% and %ABORT% in table cells.

### Cell Escaping
Document pipe escaping: Use `\|` for literal pipe characters.

### Type Mappings Reference
Add table-field entry to the Type Mappings section with Markdoc tag, TypeScript interface, FieldValue, Patch operation, Zod schema, and JSON Schema.

## Files to Modify
- `SPEC.md`

## Reference
See Grok's SPEC.md changes in PR #31 for format examples.
