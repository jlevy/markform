# Plan Spec: Fill Command with Live Agent Support

## Purpose

This plan covers refactoring the `run` command into a more general `fill` command that
supports both mock and live agent modes for autonomous form filling.

**Related Docs:**

- [Architecture Design](../../architecture/current/arch-markform-initial-design.md)

- [v0.1 Implementation Plan](plan-2025-12-22-markform-v01-implementation.md)

- [AI SDK Provider Management](https://ai-sdk.dev/docs/ai-sdk-core/provider-management)

## Background

The current `run` command only supports mock mode for testing.
This limitation is explicitly coded:

```typescript
// run.ts:126-129
if (!options.mock) {
  logError("Only mock mode is currently supported. Use --mock flag.");
  process.exit(1);
}
```

Users need the ability to run a live LLM agent to autonomously fill forms.
This is a core use case for Markform - agent-driven structured data assembly.

## Summary of Changes

1. **Rename `run` to `fill`** - More intuitive name for the action

2. **Add `--agent` flag** - Select agent type: `mock` or `live` (extensible)

3. **Add `--model` flag** - Specify model for live agent (AI SDK convention)

4. **Update architecture doc** - Reflect new command structure

5. **Remove `run` command** - No backward compatibility (v0.1 pre-release)

## Backward Compatibility

None required. This is a v0.1 pre-release change.
The `run` command will be removed entirely.

## Prerequisites

This plan depends on:

- **markform-100**: Add dotenv support for CLI (.env and .env.local)

  - Required for loading API keys from `.env` files

  - Live agent mode needs `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.

* * *

## Stage 1: Planning Stage

### Feature Requirements

**Must Have:**

- `markform fill <file>` command replacing `run`

- `--agent <type>` flag with values: `mock`, `live`

- `--model <id>` flag for live agent model selection

- `--completed-mock <file>` for mock agent (required when `--agent=mock`)

- `--record <file>` to output session transcript

- Harness configuration: `--max-turns`, `--max-patches`, `--max-issues`

- Live agent uses AI SDK tools (`markform_inspect`, `markform_apply`)

- Session transcript recording for both modes

- Graceful error handling and progress reporting

**Nice to Have:**

- `--provider <name>` flag for explicit provider selection

- `--api-key <key>` flag (override env var)

- `--prompt <file>` for custom system prompt

- `--dry-run` to show what would happen without calling LLM

**Explicitly Not Included:**

- Custom agent implementations (future `--agent=custom`)

- MCP server agent mode (deferred to v0.2)

- Multi-model orchestration

### Acceptance Criteria

1. `markform fill <file> --agent=mock --completed-mock <mock>` works identically to
   current `run --mock`

2. `markform fill <file> --agent=live --model=anthropic/claude-sonnet-4-5` fills form
   using Anthropic API (short form `--model=claude-sonnet-4-5` also works)

3. Session transcripts record all turns for both modes

4. `--model` follows AI SDK conventions: `provider/model-name` format with short name
   support

5. Architecture doc updated with new command structure

6. All existing tests pass after refactoring

* * *

## Stage 2: Architecture Stage

### Command Interface

```
markform fill <file.form.md> [options]

Options:
  --agent <type>          Agent type: mock, live (default: live)
  --model <id>            Model ID for live agent (format: provider/model-name)
                          Examples: anthropic/claude-sonnet-4-5, grok-4-fast
                          Default: anthropic/claude-sonnet-4-5
  --completed-mock <file> Path to completed mock file (required for --agent=mock)
  --record <file>         Record session transcript to file
  --max-turns <n>         Maximum turns (default: 50)
  --max-patches <n>       Maximum patches per turn (default: 20)
  --max-issues <n>        Maximum issues per step (default: 10)
  -o, --output <file>     Write final form to file (default: versioned filename)
  --dry-run               Show what would happen without executing
  --verbose               Verbose output
  --quiet                 Minimal output
  --format <type>         Output format: console, yaml, json (default: console)
```

### Model ID Convention

Following [AI SDK conventions](https://ai-sdk.dev/docs/ai-sdk-core/provider-management),
the `--model` flag uses a `provider/model-name` format:

```
--model anthropic/claude-sonnet-4-5    # Full format
--model claude-sonnet-4-5              # Short format (if unique)
```

**Short name resolution:** If the model name (after the slash) is unique across all
providers, you can omit the provider prefix.
If ambiguous, an error lists matching models.

#### Supported Models

| Provider | Models |
| --- | --- |
| `openai` | `gpt-5`, `gpt-5-mini`, `gpt-5-nano`, `gpt-5.1`, `gpt-5-pro`, `gpt-5.2`, `gpt-5.2-pro` |
| `anthropic` | `claude-opus-4-5`, `claude-opus-4-1`, `claude-sonnet-4-5`, `claude-sonnet-4-0`, `claude-haiku-4-5` |
| `google` | `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-2.0-flash-lite`, `gemini-3-pro-preview` |
| `xai` | `grok-4`, `grok-4-fast` |
| `deepseek` | `deepseek-chat`, `deepseek-reasoner` |

**Default model:** `anthropic/claude-sonnet-4-5`

#### Implementation

The format maps directly to AI SDK provider imports:

```typescript
// anthropic/claude-sonnet-4-5 becomes:
import { anthropic } from '@ai-sdk/anthropic';
const model = anthropic('claude-sonnet-4-5');

// openai/gpt-5 becomes:
import { openai } from '@ai-sdk/openai';
const model = openai('gpt-5');

// Short name resolution:
// "claude-sonnet-4-5" → unique match → anthropic/claude-sonnet-4-5
// "gpt-5" → unique match → openai/gpt-5
```

### File Structure Changes

```
packages/markform/src/cli/commands/
  fill.ts           # New command (replaces run.ts)
  run.ts            # DELETED

packages/markform/src/cli/lib/
  versioning.ts     # NEW - Shared versioned filename logic (used by fill, render, serve)

packages/markform/src/lib/
  models.ts         # NEW - Model registry, parsing, and resolution (shared across CLI, harness, tests)

packages/markform/src/harness/
  harness.ts        # Existing (no changes)
  mockAgent.ts      # Existing (no changes)
  liveAgent.ts      # NEW - Live agent implementation (uses lib/models.ts)
  index.ts          # Updated exports
```

### Dependencies

**Required (runtime):**

| Package | Purpose |
| --- | --- |
| `dotenv` | Load API keys from `.env` files (prerequisite: markform-100) |
| `ai` | Vercel AI SDK core |

**Optional peer dependencies** (users install only what they need):

| Package | Purpose |
| --- | --- |
| `@ai-sdk/anthropic` | Anthropic provider |
| `@ai-sdk/openai` | OpenAI provider |
| `@ai-sdk/google` | Google provider |

* * *

## Stage 3: Implementation Stage

### Phase 1: Refactor Command Structure

**Goal:** Rename `run` to `fill` with backward-compatible behavior for mock mode.

- [ ] Create `cli/commands/fill.ts` based on `run.ts`

- [ ] Add `--agent` flag with `mock` and `live` options

- [ ] Add `--model` flag (string, default: `anthropic/claude-sonnet-4-5`)

- [ ] Keep `--completed-mock` flag name (consistent with current `run` command)

- [ ] Update CLI registration in `cli.ts`

- [ ] Delete `run.ts`

- [ ] Update `--help` to show `fill` command

- [ ] Extract versioned filename logic into shared utility (`cli/lib/versioning.ts`)

  - Consolidate with existing render command and serve save button logic

  - Pattern: `name.form.md` → `name-v1.form.md`, `name-v2.form.md`, etc.

  - Detect existing version suffix and increment

**Tests:**

- [ ] Existing mock mode tests pass with `fill --agent=mock`

- [ ] `--agent=mock` without `--completed-mock` shows helpful error

- [ ] Invalid `--agent` value shows error with valid options

- [ ] Versioned filename logic generates correct names:

  - `form.form.md` → `form-v1.form.md`

  - `form-v1.form.md` → `form-v2.form.md`

  - `form-v99.form.md` → `form-v100.form.md`

### Phase 2: Live Agent Implementation

**Goal:** Implement live agent mode using AI SDK.

#### 2.1 Model Resolution

- [ ] Create `lib/models.ts` - consolidated model handling (shared across CLI, harness,
  tests)

  **Model Registry:**

  - [ ] Define `ModelInfo` type: `{ id, provider, modelName, displayName }`

  - [ ] Build `MODEL_REGISTRY` array with all supported models

  - [ ] Export `SUPPORTED_PROVIDERS` list: `['openai', 'anthropic', 'google', 'xai',
    'deepseek']`

  - [ ] Export `DEFAULT_MODEL` constant: `'anthropic/claude-sonnet-4-5'`

  **Parsing & Resolution:**

  - [ ] `parseModelId(input: string): { provider: string; modelName: string }`

  - [ ] `resolveShortName(shortName: string): string | null` - returns full ID if unique

  - [ ] `getModelInfo(modelId: string): ModelInfo | undefined`

  - [ ] `listModels(provider?: string): ModelInfo[]` - for CLI help

  **Provider Loading:**

  - [ ] `createModel(modelId: string): Promise<LanguageModel>` - dynamic import +
    instantiation

  - [ ] Clear error if provider package not installed

  - [ ] Clear error if model not in registry

- [ ] Support environment variable fallback for API keys:

  - `ANTHROPIC_API_KEY` for anthropic provider

  - `OPENAI_API_KEY` for openai provider

  - `GOOGLE_GENERATIVE_AI_API_KEY` for google provider

#### 2.2 Live Agent

- [ ] Create `harness/liveAgent.ts`

- [ ] Implement `LiveAgent` class matching `Agent` interface

- [ ] Use `generateText` with Markform tools

- [ ] Build context prompt with form state and issues

- [ ] Extract patches from tool call results

- [ ] Handle rate limits and API errors gracefully

- [ ] Support `maxSteps` for agentic loop control

```typescript
interface LiveAgentConfig {
  model: LanguageModel;
  maxStepsPerTurn: number;
  systemPrompt?: string;
}

class LiveAgent implements Agent {
  generatePatches(
    issues: InspectIssue[],
    form: ParsedForm,
    maxPatches: number
  ): Promise<Patch[]>;
}
```

#### 2.3 Fill Command Live Mode

- [ ] Resolve model from `--model` flag

- [ ] Create `LiveAgent` with resolved model

- [ ] Run harness loop with live agent

- [ ] Display real-time progress (turn number, issues remaining)

- [ ] Record session transcript

- [ ] Handle completion and failure states

**Tests:**

- [ ] Mock AI SDK responses for unit tests

- [ ] Live agent generates valid patches

- [ ] Session transcript records all turns

- [ ] API errors handled gracefully (retry, abort)

- [ ] Missing API key shows helpful error

- [ ] Model resolution tests (`lib/models.test.ts`):

  - `parseModelId('anthropic/claude-sonnet-4-5')` → `{ provider: 'anthropic', modelName:
    'claude-sonnet-4-5' }`

  - `resolveShortName('claude-sonnet-4-5')` → `'anthropic/claude-sonnet-4-5'`

  - `resolveShortName('nonexistent')` → `null`

  - `listModels('anthropic')` → 5 models

  - `listModels()` → all models

### Phase 3: Documentation Updates

**Goal:** Update all documentation to reflect new command structure.

#### 3.1 Architecture Doc

- [ ] Replace all `run` references with `fill`

- [ ] Update CLI command table

- [ ] Add `--agent` and `--model` documentation

- [ ] Update Live Mode section with actual implementation details

- [ ] Add model ID format documentation

#### 3.2 Development Guide

- [ ] Update CLI usage examples

- [ ] Add live agent setup instructions

- [ ] Document provider installation

#### 3.3 README

- [ ] Update quick start with `fill` command

- [ ] Add live agent example

* * *

## Stage 4: Validation Stage

### Automated Tests

- [ ] All existing unit tests pass

- [ ] `markform fill --help` shows correct options

- [ ] `markform fill <file> --agent=mock --completed-mock <mock>` completes form

- [ ] Mock mode session transcripts match expected format

- [ ] Golden tests pass with `fill` command

- [ ] Model resolution parses all supported formats

- [ ] Provider not installed error is clear

### Manual Tests

- [ ] `markform fill examples/simple/simple.form.md --agent=live` fills form

- [ ] Progress output is readable during execution

- [ ] Session transcript captures all turns

- [ ] Final form is correctly filled

- [ ] `ANTHROPIC_API_KEY` not set shows helpful error

- [ ] Rate limit handling works (may need to trigger manually)

### Definition of Done

1. `run` command completely removed

2. `fill` command works for both mock and live modes

3. Live agent successfully fills simple form with real LLM

4. Live agent successfully fills complex form with real LLM

5. Session transcripts recorded correctly for both modes

6. Architecture doc fully updated

7. All CI checks pass

8. Documentation updated

* * *

## Open Questions

1. **Default agent mode:** Should default be `mock` (safe) or `live` (intended use)?

   - **Recommendation:** Default to `live` since that’s the primary use case.
     Mock mode is primarily for testing.

2. **Model shorthand:** Should we support shorthands like `claude-sonnet` that expand to
   `anthropic:claude-sonnet-4-5`?

   - **Recommendation:** Start with explicit format only.
     Add shorthands later if needed.

3. **API key source:** Should we support `--api-key` flag or only env vars?

   - **Recommendation:** Env vars only initially.
     More secure, follows AI SDK patterns.

4. **Output file handling:** Should `fill` overwrite input or require `-o` flag?

   - **Decision:** Use versioned filename by default (like render/serve save button).
     Example: `form.form.md` → `form-v1.form.md`, `form-v2.form.md`, etc.
     Use `-o` flag to override with explicit path.

* * *

## Revision History

- 2025-12-23: Initial plan created

- 2025-12-23: Added prerequisite dependency on markform-100 (dotenv support)

- 2025-12-23: Updated model format to `provider/model-name` with short name support;
  added full model list; output uses versioned filenames by default

- 2025-12-23: Consolidated shared logic: `cli/lib/versioning.ts` for filenames,
  `lib/models.ts` for model registry/resolution
