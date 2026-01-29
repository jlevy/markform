---
close_reason: null
closed_at: 2025-12-28T05:24:05.039Z
created_at: 2025-12-27T17:40:00.000Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.518Z
    original_id: markform-300
id: is-01kg3xaa38ceswakn89kpvxn2g
kind: epic
labels: []
parent_id: null
priority: 1
status: closed
title: Research API and CLI Command
type: is
updated_at: 2025-12-28T05:24:05.039Z
version: 1
---
Implement complete research workflow for markform with web search capabilities.

See spec: docs/project/specs/active/plan-2025-12-27-research-api-and-cli.md

Phases:
- Phase 0a: Naming consistency cleanup (maxIssues -> maxIssuesPerTurn)
- Phase 0b: LLM settings consolidation (new src/llms.ts)
- Phase 1: Frontmatter harness config (parse & resolve)
- Phase 2: Core research types and validation (src/research/)
- Phase 3: Research API (runResearch - follows fillForm pattern)
- Phase 4: CLI commands (research.ts, initial values, file I/O at CLI layer)
- Phase 5: Examples command integration
- Phase 6: Update research example forms

Design principle: Core API (runResearch) works with strings like fillForm(). File I/O is handled at CLI layer using shared helpers.
