---
close_reason: null
closed_at: 2025-12-23T21:21:09.090Z
created_at: 2025-12-23T21:15:38.490Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.034Z
    original_id: markform-104
id: is-01kg3xaa32ajp8v2hwkwjf3n4w
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Create model registry and resolution in lib/models.ts
type: is
updated_at: 2025-12-23T21:21:09.090Z
version: 1
---
Create consolidated model handling module for CLI, harness, and tests.

**Location:** `lib/models.ts`

**Model Registry:**
- `ModelInfo` type: `{ id, provider, modelName, displayName }`
- `MODEL_REGISTRY` array with all supported models
- `SUPPORTED_PROVIDERS`: `['openai', 'anthropic', 'google', 'xai', 'deepseek']`
- `DEFAULT_MODEL`: `'anthropic/claude-sonnet-4-5'`

**Supported Models:**
| Provider | Models |
|----------|--------|
| openai | gpt-5, gpt-5-mini, gpt-5-nano, gpt-5.1, gpt-5-pro, gpt-5.2, gpt-5.2-pro |
| anthropic | claude-opus-4-5, claude-opus-4-1, claude-sonnet-4-5, claude-sonnet-4-0, claude-haiku-4-5 |
| google | gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash, gemini-2.0-flash-lite, gemini-3-pro-preview |
| xai | grok-4, grok-4-fast |
| deepseek | deepseek-chat, deepseek-reasoner |

**Parsing & Resolution:**
- `parseModelId(input)` → `{ provider, modelName }`
- `resolveShortName(shortName)` → full ID if unique, null otherwise
- `getModelInfo(modelId)` → ModelInfo or undefined
- `listModels(provider?)` → array for CLI help

**Provider Loading:**
- `createModel(modelId)` → Promise<LanguageModel> via dynamic import
- Clear errors for: provider not installed, model not in registry

**Tests:** `lib/models.test.ts`

**Part of:** markform-101 (fill command)
