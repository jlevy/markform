---
close_reason: null
closed_at: 2025-12-23T22:11:11.144Z
created_at: 2025-12-23T21:50:29.507Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:02.953Z
    original_id: markform-111
id: is-01kg3x1bv09d621ettct3xsxhq
kind: feature
labels: []
parent_id: null
priority: 2
status: closed
title: Add dump command for extracting form values
type: is
updated_at: 2025-12-23T22:11:11.144Z
version: 1
---
Add a `dump` command that outputs only the values portion of a form (subset of inspect).

## Usage
```
markform dump <file> [--format=<fmt>]
```

## Output Formats

| Format | Description |
|--------|-------------|
| `console` (default) | Colored output, field ID with formatted value per line |
| `plaintext` | Same as console, no colors (suitable for piping) |
| `yaml` | Standard YAML serialization of the values map |
| `json` | Standard JSON serialization of the values map |

## Output Structure

**JSON/YAML output**: Raw `Record<string, FieldValue>` map (same structure as `form.valuesByFieldId`)

**Console/Plaintext output**: Pretty-printed list
```
name: "Alice Johnson"
age: 32
categories: [frontend, backend]
tasks_simple: read_guidelines:done, agree_terms:done
```

## Implementation

1. Create `packages/markform/src/cli/commands/dump.ts`
2. Reuse `parseForm()` to get the form
3. Extract `form.valuesByFieldId` directly (no need for full `inspect()`)
4. Reuse `formatFieldValue()` helper from inspect for console/plaintext
5. Use existing `formatOutput` infrastructure with format handling
6. Register command in `cli.ts`

## Notes
- Unlike `inspect`, this command is lightweight - no validation, no progress computation
- Useful for quick value extraction, scripting, and integration with other tools
