---
close_reason: null
closed_at: 2025-12-26T23:47:00.042Z
created_at: 2025-12-24T20:56:09.020Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.410Z
    original_id: markform-184.5
id: is-01kg3x1bv26bz2grmjyrqdj8q7
kind: task
labels: []
parent_id: null
priority: 3
status: closed
title: "Consistency: fillForm default maxTurns (30) differs from CLI (100)"
type: is
updated_at: 2025-12-26T23:47:00.042Z
version: 1
---
programmaticFill.ts:124 sets DEFAULT_FILL_MAX_TURNS=30, while settings.ts:95 has DEFAULT_MAX_TURNS=100 used by CLI. This could cause confusion: library users get 30 turns, CLI users get 100. Either align to one default, or document the difference explicitly in both spec and CLI help. Consider using the same constant from settings.ts.
