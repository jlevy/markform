---
close_reason: null
closed_at: 2025-12-23T08:58:38.839Z
created_at: 2025-12-23T08:30:24.107Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.365Z
    original_id: markform-gyn
id: is-01kg3xaa3fy86z9dvn1k0mj678
kind: bug
labels: []
parent_id: null
priority: 0
status: closed
title: "ARCH-007: Fix Markdoc comment syntax in spec and fixtures"
type: is
updated_at: 2025-12-23T08:58:38.839Z
version: 1
---
## Problem
Architecture assumes `{# ... #}` is Markdoc comment syntax, but Markdoc uses HTML comments (`<!-- ... -->`). The `process=false` detection regex also incorrectly includes `{#`.

Per Markdoc docs: comment support uses HTML comments and requires `allowComments: true` on `Markdoc.Tokenizer`.

## Why It Matters
- `earnings-analysis.form.md` uses `{# PART 1 ... #}` separators
- If Markdoc doesn't treat those as comments, they appear as plain text nodes
- Serializer is not specified to preserve them → silent data loss risk on round-trip

## Decision Required
Choose ONE approach and codify it:

**Option A: Align with Markdoc**
- Switch all 'comment blocks' in examples/forms to `<!-- ... -->`
- Optionally enable `allowComments: true` in tokenizer
- HTML comments are parseable as HTML nodes even without the flag

**Option B: Define Markform-only comments**
- Keep `{# ... #}` but define it explicitly as Markform convention (not Markdoc)
- Specify whether preserved or discarded by canonical serialization
- Update process=false detection to NOT include `{#`

## Files to Update
- docs/project/architecture/current/arch-markform-design.md.md
- docs/project/test-fixtures/forms/earnings-analysis.form.md
- Any other fixtures using `{# #}` syntax

## Blocks
- ARCH-012 (non-Markform nodes policy)
- PLAN-003 (process=false emission)
- FORM-COMPANY-001 (company form comments)
