---
close_reason: null
closed_at: 2025-12-23T16:36:36.831Z
created_at: 2025-12-23T07:18:36.913Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.344Z
    original_id: markform-2j6
id: is-01kg3x1bv6dk0yhwr4t9m11ycg
kind: epic
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 1: Core Engine with Unit Tests"
type: is
updated_at: 2025-12-23T16:41:39.882Z
version: 1
---
Implement all core engine functionality using TDD with simple test form.

Sub-tasks:
1.1 Types and Schemas (engine/types.ts)
1.2 Markdoc Parsing (engine/parse.ts)
1.3 Canonical Serialization (engine/serialize.ts)
1.4 Summaries (engine/summaries.ts)
1.5 Validation (engine/validate.ts)
1.6 Patch Application (engine/apply.ts)
1.7 Inspect (engine/inspect.ts)
1.8 Validate with Simple Form
1.9 Session Transcript Handling (engine/session.ts)

Checkpoints:
- All unit tests pass
- Parse simple.form.md → structure summary matches
- Round-trip test passes
- Validation tests pass
- Patch tests pass
