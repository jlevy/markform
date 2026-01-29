---
close_reason: null
closed_at: 2025-12-29T01:10:41.442Z
created_at: 2025-12-29T00:58:03.563Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.010Z
    original_id: markform-423
id: is-01kg3x1bv86raesvzpk6q77kd1
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Validate all example forms after table-field migration
type: is
updated_at: 2025-12-29T01:10:41.442Z
version: 1
---
After migrating string-list fields to table-field format in markform-422, validate all examples work correctly.

**Validation steps:**

1. Run CLI inspect on each form:
   ```bash
   pnpm markform inspect packages/markform/examples/movie-research/movie-research-basic.form.md
   pnpm markform inspect packages/markform/examples/movie-research/movie-deep-research.form.md
   pnpm markform inspect packages/markform/examples/celebrity-deep-research/celebrity-deep-research.form.md
   pnpm markform inspect packages/markform/examples/startup-deep-research/startup-deep-research.form.md
   pnpm markform inspect packages/markform/examples/earnings-analysis/earnings-analysis.form.md
   ```

2. Run full test suite:
   ```bash
   pnpm test
   ```

3. Verify each form:
   - Parses without errors
   - All table-fields have valid column types
   - Field count and structure is correct
   - No validation errors reported

**Acceptance criteria:**
- All example forms pass inspection
- Test suite passes
- No regressions in existing functionality
