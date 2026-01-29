---
close_reason: null
closed_at: 2025-12-23T17:31:28.539Z
created_at: 2025-12-23T08:33:54.145Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:06.248Z
    original_id: markform-sub
id: is-01kg3x1bvhhgx0cv6vh3cyh64r
kind: task
labels: []
parent_id: null
priority: 4
status: closed
title: "FORM-COMPANY-004: Tighten fiscal_year_end date regex"
type: is
updated_at: 2025-12-23T17:32:58.461Z
version: 1
---
## Problem
`fiscal_year_end` regex pattern allows invalid day values (e.g., month 13, day 32, day 00).

## Why It Matters
- Invalid dates could pass validation
- Not a blocker but reduces data quality
- Could confuse downstream processing

## Recommended Fix
Choose ONE approach:
1. **Tighten regex:** Use pattern that validates real month/day ranges
2. **Accept limitation:** Document as 'format validation only, not date validation'
3. **Use date validator:** Add custom `valid_date` validator instead of regex

## Severity
Low priority - the current regex catches most malformed input; edge cases are unlikely in practice.

## Files to Update
- docs/project/test-fixtures/forms/earnings-analysis.form.md
