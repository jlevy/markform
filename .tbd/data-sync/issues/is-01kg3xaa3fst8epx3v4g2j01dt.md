---
close_reason: null
closed_at: 2025-12-23T09:39:04.644Z
created_at: 2025-12-23T08:33:51.856Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.350Z
    original_id: markform-fdu
id: is-01kg3xaa3fst8epx3v4g2j01dt
kind: bug
labels: []
parent_id: null
priority: 1
status: closed
title: "FORM-COMPANY-001: Fix comment syntax in company form"
type: is
updated_at: 2025-12-23T09:39:04.644Z
version: 1
---
## Problem
`earnings-analysis.form.md` uses `{# PART ... #}` separators which aren't Markdoc comment syntax per Markdoc docs. Markdoc uses HTML comments (`<!-- ... -->`).

## Why It Matters
- These will be parsed as plain text nodes, not comments
- Serializer behavior is unspecified for these nodes
- Could cause silent data loss on round-trip

## Recommended Fix
After ARCH-007 decision:
1. **If using HTML comments:** Convert `{# PART 1 ... #}` to `<!-- PART 1 ... -->`
2. **If removing comments:** Delete the separator lines entirely
3. **If Markform-only convention:** Keep as-is (requires ARCH-007 to define behavior)

## Files to Update
- docs/project/test-fixtures/forms/earnings-analysis.form.md

## Depends On
- ARCH-007 (need decision on comment syntax first)
