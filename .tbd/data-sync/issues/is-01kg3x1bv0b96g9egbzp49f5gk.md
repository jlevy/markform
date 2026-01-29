---
close_reason: null
closed_at: 2025-12-24T01:26:46.224Z
created_at: 2025-12-23T22:13:47.679Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:02.974Z
    original_id: markform-115
id: is-01kg3x1bv0b96g9egbzp49f5gk
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "DOCS-001: Align CLI defaults and flag names across all docs"
type: is
updated_at: 2025-12-24T01:26:46.224Z
version: 1
---
Batch of consistency fixes across architecture, plans, and development guide:

**Changes:**
- Change `--mock-source` → `--completed-mock` in architecture doc (lines 2182, 2428-2430) and development.md (line 180)
- Unify `max_turns` default to 100 everywhere (architecture says 100, fill plan CLI says 50)
- Add `DEFAULT_MAX_TURNS = 100` to `packages/markform/src/settings.ts`
- Document mapping between `--max-patches` (CLI) and `max_patches_per_turn` (config/YAML), or rename CLI flag to `--max-patches-per-turn`
- Standardize model example to `anthropic/claude-sonnet-4-5` everywhere (development.md line 295 shows `claude-sonnet-4-20250514`)

**Files:**
- packages/markform/src/settings.ts
- docs/project/architecture/current/arch-markform-design.md.md
- docs/development.md
- docs/project/specs/active/plan-2025-12-23-fill-command-live-agent.md
