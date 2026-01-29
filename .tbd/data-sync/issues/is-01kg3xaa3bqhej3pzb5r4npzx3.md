---
close_reason: null
closed_at: 2025-12-30T19:06:06.334Z
created_at: 2025-12-30T19:02:56.653Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.451Z
    original_id: markform-474
id: is-01kg3xaa3bqhej3pzb5r4npzx3
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 2: Update programmaticFill to call new callbacks"
type: is
updated_at: 2025-12-30T19:06:06.334Z
version: 1
---
Update programmaticFill.ts harness loop to call the new callbacks.

**Spec:** docs/project/specs/active/plan-2025-12-30-unified-fill-logging.md

**Changes:**
1. After harness.step() returns issues, call onIssuesIdentified if defined
2. After agent.generatePatches(), call onPatchesGenerated if defined
3. Update onTurnComplete to include issues and patches arrays

**File:** packages/markform/src/harness/programmaticFill.ts

**Current code location:** lines 254-312 (harness loop)

**Parent:** markform-472
