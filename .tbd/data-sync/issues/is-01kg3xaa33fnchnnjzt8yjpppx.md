---
close_reason: null
closed_at: 2025-12-23T23:30:38.429Z
created_at: 2025-12-23T22:28:32.081Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.158Z
    original_id: markform-127
id: is-01kg3xaa33fnchnnjzt8yjpppx
kind: bug
labels: []
parent_id: null
priority: 2
status: closed
title: modelResolver rejects xai/deepseek providers despite spec support
type: is
updated_at: 2025-12-23T23:30:38.429Z
version: 1
---
## Problem
The provider map in `packages/markform/src/harness/modelResolver.ts` only enumerates anthropic, openai, and google. This causes `parseModelId` to reject models like `--model xai/grok-4` or `--model deepseek/deepseek-chat` with "Unknown provider" before resolution.

## Expected Behavior
The feature spec (docs/project/specs/done/plan-2025-12-23-fill-command-live-agent.md lines 162-168) lists xAI and DeepSeek as supported providers, so the CLI should accept these models.

## Fix
Add xai and deepseek to the provider map in modelResolver.ts with appropriate API base URLs and environment variable names.
