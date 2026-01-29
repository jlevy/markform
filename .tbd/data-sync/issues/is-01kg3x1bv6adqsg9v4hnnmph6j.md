---
close_reason: null
closed_at: 2025-12-28T02:29:53.537Z
created_at: 2025-12-27T17:40:00.000Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.366Z
    original_id: markform-302
id: is-01kg3x1bv6adqsg9v4hnnmph6j
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 0b: Create src/llms.ts for LLM settings"
type: is
updated_at: 2025-12-28T02:29:53.537Z
version: 1
---
Consolidate all LLM-related settings into a new src/llms.ts file.

Spec: docs/project/specs/active/plan-2025-12-27-research-api-and-cli.md (Phase 0b)

Move from settings.ts:
- SUGGESTED_LLMS constant
- formatSuggestedLlms() function
- WebSearchConfig interface
- WEB_SEARCH_CONFIG constant
- hasWebSearchSupport() function
- getWebSearchConfig() function

Add new helpers:
- getWebSearchProviders(): string[] - returns ['openai', 'google', 'xai']
- formatWebSearchModels(): string - formats for error messages
- isWebSearchModel(modelId: string): boolean - validates full model ID
- getSuggestedModels(provider: string): string[] - get models for provider

Update imports in:
- src/harness/liveAgent.ts
- src/harness/modelResolver.ts
- src/cli/commands/fill.ts
- src/index.ts (public exports)
