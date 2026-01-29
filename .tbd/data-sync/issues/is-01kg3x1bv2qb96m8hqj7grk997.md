---
close_reason: null
closed_at: 2025-12-24T21:40:30.841Z
created_at: 2025-12-24T21:25:57.017Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.420Z
    original_id: markform-185
id: is-01kg3x1bv2qb96m8hqj7grk997
kind: feature
labels: []
parent_id: null
priority: 2
status: closed
title: "Refactor: Extract and rename type files for consistency"
type: is
updated_at: 2025-12-24T21:40:30.841Z
version: 1
---
## Summary
Refactor type organization across the markform package for consistency and clarity.

## Goals
1. Use descriptive filenames (e.g., coreTypes.ts instead of generic types.ts)
2. Extract embedded types from implementation files into dedicated type files
3. Keep related types together in logical groupings

## Changes

### 1. Rename engine/types.ts to engine/coreTypes.ts
- Simple rename, no content changes
- Update all imports across the codebase

### 2. Create harness/harnessTypes.ts
Extract types from:
- programmaticFill.ts: FillOptions, TurnProgress, FillStatus, FillResult
- mockAgent.ts: Agent
- liveAgent.ts: LiveAgentConfig
- modelResolver.ts: ProviderName, ParsedModelId, ResolvedModel, ProviderInfo

### 3. Create integrations/toolTypes.ts
Extract from ai-sdk.ts:
- CreateMarkformToolsOptions
- InspectToolResult, ApplyToolResult, ExportToolResult, GetMarkdownToolResult
- MarkformTool, MarkformToolSet

### 4. Create cli/lib/cliTypes.ts
Extract from:
- shared.ts: OutputFormat, CommandContext
- exportHelpers.ts: ExportResult
- examples/index.ts: ExampleDefinition

## Non-Goals
- Splitting engine/coreTypes.ts further (well-organized with section comments)
- Changing any type definitions (pure refactor)
