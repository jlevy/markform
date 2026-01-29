---
close_reason: null
closed_at: 2025-12-24T05:36:42.794Z
created_at: 2025-12-23T21:42:25.983Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.068Z
    original_id: markform-110
id: is-01kg3xaa33wnx5qek7vn5m1jq8
kind: task
labels: []
parent_id: null
priority: 3
status: closed
title: Review coverage reports and improve test coverage
type: is
updated_at: 2025-12-24T05:36:42.794Z
version: 1
---
After code coverage is implemented (markform-109), review the HTML coverage reports and identify areas for improvement.

**Workflow:**
1. Run `pnpm test:coverage:html`
2. Open coverage/index.html in browser
3. Identify:
   - Uncovered critical paths (public APIs, error handling, validation)
   - Dead code that can be removed
   - Missing edge case tests (especially branches)
4. Create follow-up tasks or fix directly

**Priority areas (from research):**
- High: Public API functions, error handling, business logic, validation
- Medium: Internal utilities, config parsing
- Lower: Debug utilities (can be excluded)

**Goal:** Get to 80%+ coverage on statements/functions/lines, 75%+ on branches
