---
close_reason: null
closed_at: 2025-12-24T21:40:30.840Z
created_at: 2025-12-24T21:26:56.216Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.565Z
    original_id: markform-188
id: is-01kg3xaa35f02qbwpz5kwr76et
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Create integrations/toolTypes.ts and extract types
type: is
updated_at: 2025-12-24T21:40:30.840Z
version: 1
---
Create integrations/toolTypes.ts and extract AI SDK tool types.

Extract from ai-sdk.ts:
- CreateMarkformToolsOptions
- InspectToolResult, ApplyToolResult, ExportToolResult, GetMarkdownToolResult
- MarkformTool, MarkformToolSet

Update imports in ai-sdk.ts.
