---
close_reason: null
closed_at: 2025-12-28T05:24:01.190Z
created_at: 2025-12-27T17:40:00.000Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.438Z
    original_id: markform-316
id: is-01kg3x1bv6m47vse3cgrccf7qs
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 5.3: Update examples.ts for research workflow"
type: is
updated_at: 2025-12-28T05:24:01.190Z
version: 1
---
Integrate research workflow into examples command.

Spec: docs/project/specs/active/plan-2025-12-27-research-api-and-cli.md (Phase 5)

1. Update menu display:
   - Show [research] or [interactive] label in example list
   - Group or sort by type if helpful

2. After user selects example:
   - Check example.type or use isResearchForm(parsedForm)
   - If research form:
     - Use promptForWebSearchModel() instead of regular model prompt
     - Use resolveHarnessConfig('research', ...)
     - Call runResearch() or reuse research command logic
   - If standard form:
     - Continue with existing interactive fill logic

3. Integration tests for both paths
