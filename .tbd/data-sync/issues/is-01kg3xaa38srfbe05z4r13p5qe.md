---
close_reason: null
closed_at: 2025-12-28T02:27:28.053Z
created_at: 2025-12-27T17:40:00.000Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.524Z
    original_id: markform-301
id: is-01kg3xaa38srfbe05z4r13p5qe
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 0a: Rename maxIssues to maxIssuesPerTurn"
type: is
updated_at: 2025-12-28T02:27:28.053Z
version: 1
---
Engineering cleanup for naming consistency. All per-turn limits should use *PerTurn suffix.

Spec: docs/project/specs/active/plan-2025-12-27-research-api-and-cli.md (Phase 0a)

Files to update:
- src/settings.ts: DEFAULT_MAX_ISSUES -> DEFAULT_MAX_ISSUES_PER_TURN
- src/harness/harnessTypes.ts: maxIssues -> maxIssuesPerTurn in FillOptions
- src/harness/harness.ts: Update HarnessConfig usage
- src/harness/programmaticFill.ts: Update fillForm() implementation
- src/cli/commands/fill.ts: Update CLI option mapping (keep --max-issues flag short)
- tests/*: Update all test usages

Rationale: Distinguishes total limits (maxTurns) from per-turn limits (maxIssuesPerTurn, maxPatchesPerTurn).
