---
close_reason: null
closed_at: 2025-12-24T01:15:57.838Z
created_at: 2025-12-23T22:14:27.152Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:02.989Z
    original_id: markform-118
id: is-01kg3x1bv05d67dj80m8atbh56
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "ARCH-016: Document harness error behavior and exit codes"
type: is
updated_at: 2025-12-24T01:15:57.838Z
version: 1
---
Add explicit documentation for harness error behavior to aid testability.

**Changes:**
- In Harness section, specify the returned status when `max_turns` is exceeded
- Document CLI exit code behavior (non-zero exit on failure)
- Add error state description for integration testing

**Files:**
- docs/project/architecture/current/arch-markform-design.md.md
