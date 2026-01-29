---
close_reason: null
closed_at: 2025-12-28T05:24:01.190Z
created_at: 2025-12-27T17:40:00.000Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.432Z
    original_id: markform-315
id: is-01kg3x1bv6m0kcaj8jrb4e05ax
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 5.2: Add promptForWebSearchModel() helper"
type: is
updated_at: 2025-12-28T05:24:01.190Z
version: 1
---
Model selection helper for research workflow.

Spec: docs/project/specs/active/plan-2025-12-27-research-api-and-cli.md (Phase 5)

Create helper in cli/lib/modelHelpers.ts (or add to existing):

async function promptForWebSearchModel(): Promise<string>

1. Filter SUGGESTED_LLMS to only include web-search-capable providers
2. Use inquirer to prompt user to select from filtered list
3. Format options similar to existing model prompts
4. Return selected model ID (provider/model)
