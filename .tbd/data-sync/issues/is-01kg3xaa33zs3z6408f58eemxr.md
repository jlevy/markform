---
close_reason: null
closed_at: 2025-12-24T05:28:17.807Z
created_at: 2025-12-23T22:48:11.682Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.163Z
    original_id: markform-128
id: is-01kg3xaa33zs3z6408f58eemxr
kind: feature
labels: []
parent_id: null
priority: 2
status: closed
title: Rename export 'markdown' format to 'markform', add raw markdown export
type: is
updated_at: 2025-12-24T05:28:17.807Z
version: 1
---
## Problem

The export command's "markdown" format (line 47 of export.ts) outputs markform format with markdoc directives like `{% field %}`, not plain readable markdown. This naming is confusing.

## Proposed Changes

### 1. Rename current format: `markdown` → `markform`
The current output with markdoc directives should be called `markform` since that's what it actually is—the canonical markform format that can be re-parsed.

### 2. Add new `markdown` format for raw, readable output
A new "markdown" format that outputs plain markdown **without** markdoc directives:
- Insert filled values inline where they belong
- Output readable markdown that non-technical users can consume
- Example: instead of `{% field id="name" value="Alice" /%}`, output `Alice` or `**Name:** Alice`

### Implementation Notes

The raw markdown output requires heuristics to insert values:
- Text fields: replace with the value text
- Single select: show selected option label
- Multi-select/checkboxes: list selected items
- Groups: preserve headers, show fields with labels

**NOT round-trippable**: The raw markdown output cannot be parsed back into a form (no schema preserved). This is intentional for v1.

### Future Enhancement (not this issue)
Could add round-trip support for raw markdown by embedding schema in HTML comments or YAML frontmatter. Track separately if desired.

## Files to Modify
- `packages/markform/src/cli/commands/export.ts` - Update ExportFormat type, add markdown serializer
- `packages/markform/src/engine/` - May need new serialize function for raw markdown
- Tests for both formats
