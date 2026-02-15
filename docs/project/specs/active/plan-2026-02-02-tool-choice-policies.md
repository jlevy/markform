# Plan Spec: Tool Choice Policies for Reliable Form Filling

**Date:** 2026-02-02 (last updated 2026-02-15)

**Author:** AI Research

**Status:** Draft (revised after senior engineering review)

## Overview

This spec defines a **tool choice policy system** for Markform that gives form authors and
consumers fine-grained control over how agents use tools (especially web search) during form
filling. The goal is to ensure agents reliably research information before filling fields,
reducing hallucination and improving data accuracy.

**Related Docs:**
- `docs/project/research/research-2026-02-02-tool-choice-parameter.md` - Research on AI SDK
  toolChoice and provider behavior
- `docs/project/specs/active/plan-2026-01-27-parallel-form-filling.md` - Parallel execution spec

## Goals

1. **Reduce hallucination**: Ensure agents use web search and other research tools before
   filling fields that require external data
2. **Configurable policies**: Provide multiple tool use policies that balance research
   thoroughness against latency/cost
3. **Cross-model compatibility**: Work reliably across providers (OpenAI, Anthropic, Google,
   DeepSeek, xAI)
4. **Form-level control**: Allow policies at form level via frontmatter and CLI

## Non-Goals

- Custom tool definitions per form (tools are provided by the harness)
- Model-specific prompt tuning (policies should work across models)
- UI for policy configuration (CLI/API only for now)
- Automatic policy selection based on field content
- Per-field tool policies (may be considered in v2)

## Background

### The Problem

Models often skip web search and fill fields with training data (which may be outdated
or hallucinated). The current `toolChoice: 'required'` default (set at `liveAgent.ts:91`)
forces the model to call *some* tool, but doesn't guarantee it uses web search over
fill_form.

### Architecture: Steps vs Turns (Critical Context)

The Markform harness has a two-level iteration model that any tool policy must respect:

```
┌─────────────────────────────────────────────────────────────┐
│ Harness Turn (one fillFormTool() call)                      │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Single generateText() invocation                     │   │
│  │                                                      │   │
│  │  Step 0: web_search("query")  →  results ✓           │   │
│  │  Step 1: fill_form(patches)   ← sees search results  │   │
│  │  Step 2: web_search("query2") →  results ✓           │   │
│  │  Step 3: fill_form(patches)   ← sees all prior       │   │
│  │  ...up to maxStepsPerTurn (default: 20)               │   │
│  │                                                      │   │
│  │  Context PRESERVED within these steps                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Form markdown updated with patches → next turn             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼ Context RESET
┌─────────────────────────────────────────────────────────────┐
│ Next Harness Turn (fresh fillFormTool() call)                │
│                                                             │
│  Only sees: updated form markdown + remaining issues         │
│  Previous web search results are LOST                       │
│  Previous conversation/reasoning is LOST                    │
└─────────────────────────────────────────────────────────────┘
```

**Key facts from code review:**

1. **Within a turn** (`liveAgent.ts:201-209`): One `generateText()` call allows up to
   `maxStepsPerTurn` (default 20) AI SDK steps. The model accumulates context across
   steps—web search results from step 0 ARE visible when calling fill_form in step 1.
   AI SDK's `prepareStep` callback fires between steps and can change `toolChoice` and
   `activeTools` per step (`generate-text.ts:518-546`).

2. **Across turns** (`liveAgent.ts:123-125`): Each call is stateless. The full form
   context is provided fresh. Only three things persist across turns:
   - The form markdown (updated with filled values)
   - The remaining issues list
   - Previous patch rejections

3. **Web search results do NOT persist across turns.** Any policy that separates
   "research" and "fill" into different harness turns will lose the research results.

### Implications for Policy Design

- **Policies must operate at the step level** (within a single `generateText()` call),
  NOT at the turn level (across separate `fillFormTool()` invocations).
- **"Two-phase" as separate invocations is broken** — research results from Phase 1 are
  lost when Phase 2 starts fresh.
- **`prepareStep`** is the correct mechanism for step-level control. It can dynamically
  change `toolChoice` and `activeTools` between steps.

## Design

### Tool Choice Policy Enum

```typescript
type ToolPolicy =
  | 'none'                  // No tools provided to agent
  | 'auto'                  // Model chooses freely whether to use tools
  | 'require_tools'         // toolChoice: 'required' on every step (DEFAULT)
  | 'require_web_search'    // Step 0 must be web_search, then require_tools
```

**Default:** `require_tools`

### Policy Behaviors

#### `none`

```
No tools provided to agent.
Agent can only generate text responses.
toolChoice: N/A
```

**When to use:** Testing, debugging, or when tools are intentionally disabled.

#### `auto`

```
toolChoice: 'auto' on every step.
Model decides when to search and when to fill.
No enforcement of tool usage.
```

**When to use:** Legacy behavior, simple forms that don't need research, or when you
want maximum model flexibility.

#### `require_tools` (Default)

```
toolChoice: 'required' on every step.
Model must call SOME tool on every step (fill_form or web_search).
Prevents "analysis paralysis" where model talks without acting.
Model can interleave web_search and fill_form freely within a turn.
```

**When to use:** General production use. Ensures progress on every step.
Already set as the default at `liveAgent.ts:91`.

**Note:** This does NOT guarantee web search is used. The model may go straight
to fill_form. For guaranteed research, use `require_web_search`.

#### `require_web_search`

```
Step 0: toolChoice: { type: 'tool', toolName: 'web_search' }
Step 1+: toolChoice: 'required'
```

**When to use:** Forms with factual fields that need current data. Guarantees at
least one web search before any form filling within each turn.

**Implementation:**
```typescript
// In liveAgent.ts, pass prepareStep to generateText():
prepareStep: ({ stepNumber, steps }) => {
  const hasSearched = steps.some(step =>
    step.toolCalls.some(tc => isWebSearchTool(tc.toolName))
  );
  if (!hasSearched) {
    return { toolChoice: { type: 'tool', toolName: 'web_search' } };
  }
  return { toolChoice: 'required' };
},
```

**Behavior within a single turn:**
1. Step 0: Model is forced to call web_search
2. Step 1: Model sees search results, chooses any tool (usually fill_form)
3. Step 2+: Model continues with required tools (may search again or fill more)

### Deferred: More Aggressive Research Policies

The original spec proposed `web_search_always` and `two_phase` policies. These are
**deferred** pending architectural work:

#### Why `two_phase` doesn't work as designed

The original design called for "Phase 1: research only, Phase 2: fill only" as separate
agent invocations. This is broken because web search results from Phase 1 are completely
lost when Phase 2 starts (turns are stateless).

**Possible future approaches:**
1. **Harness-level research injection** (recommended): The harness itself runs web
   searches before calling the LLM, based on field labels/descriptions. Inject results
   into the context prompt. The model never has to decide whether to search.
2. **Research accumulator**: Store web search results in a sidecar that persists across
   turns. Inject into subsequent prompts. Adds complexity.
3. **Single-turn two-phase via `activeTools`**: Within one `generateText()` call, use
   `prepareStep` to only expose web_search for steps 0-N, then only expose fill_form
   for steps N+1+. Works within a turn but may exceed step limits for complex forms.

#### Why `web_search_always` is questionable

Forcing web search on every step within a turn doesn't make sense — after step 0
returns search results, the model already has the information. Forcing redundant
searches wastes API calls. The `require_web_search` policy (search on step 0) achieves
the same goal more efficiently.

If the concern is that the model needs to search for different fields at different
points, `require_tools` already allows this — the model can interleave searches and
fills freely.

### Alternative Approaches Worth Considering

#### Harness-Level Research Injection (Future)

Instead of asking the model to decide when to search, the harness itself runs web
searches based on field metadata:

```typescript
// Pseudocode for future harness-level research
async function researchFields(form: ParsedForm, issues: InspectIssue[]): Promise<string> {
  const queries = generateSearchQueries(form, issues);
  const results = await Promise.all(queries.map(q => webSearch(q)));
  return formatResearchContext(results);
}

// Inject into context prompt
const contextPrompt = buildContextPrompt(issues, form, maxPatches, previousRejections);
const researchContext = await researchFields(form, issues);
const fullPrompt = contextPrompt + '\n\n# Research Results\n' + researchContext;
```

**Advantages:**
- Most reliable — doesn't depend on model behavior
- Works identically across all providers
- Research quality can be tuned independently of the LLM
- Can be cached/reused across turns

**Disadvantages:**
- Harness must know what to search for (field labels may not be sufficient)
- Upfront latency for search before LLM call
- May search for things the model doesn't need

This is the recommended direction for forms that truly need guaranteed research.

#### Post-Turn Validation (Alternative)

Let the model use `require_tools` freely, but validate after each turn:

```typescript
// After fillFormTool() returns, check tool usage
const toolCalls = response.stats.toolCalls;
const usedWebSearch = toolCalls.some(tc => isWebSearchTool(tc.name));

if (!usedWebSearch && policyRequiresSearch) {
  // Inject reminder into next turn's context
  previousRejections.push({
    message: 'You did not use web search. Research field values before filling.',
    // ... triggers re-try
  });
}
```

**Advantages:** Simple, works across providers, no `prepareStep` complexity.
**Disadvantages:** Wastes a turn when model doesn't search. Slower.

### API Changes

#### FillOptions Extension

```typescript
interface FillOptions {
  // ... existing options

  /**
   * Tool choice policy for agent tool selection.
   * Controls how strictly the harness enforces tool usage.
   *
   * @default 'require_tools'
   */
  toolPolicy?: ToolPolicy;
}
```

#### Frontmatter Configuration

```yaml
---
markform:
  spec: MF/0.1
  harness_config:
    tool_policy: require_web_search    # New option
---
```

#### CLI Extension

```bash
# New --tool-policy flag
markform fill form.md --tool-policy=require_web_search

# Override policy at CLI level (CLI overrides frontmatter)
markform fill form.md --tool-policy=auto
```

### Provider-Specific Considerations

| Provider | `require_tools` | `require_web_search` | Notes |
|----------|----------------|---------------------|-------|
| OpenAI | Works directly | Works directly | Parallel tool calls supported |
| Anthropic | `required` → `any` | `{ type: 'tool' }` works | Not compatible with extended thinking |
| Google | `required` → `ANY` | `ANY` + `allowedFunctionNames` | Limit to 10-20 tools |
| DeepSeek | **Needs testing** | **Needs testing** | Unreliable multi-turn; may need fallback |
| xAI | Works | Can't force provider-defined tools | Use grok-4-1-fast |

### Areas of Uncertainty (Requiring Testing)

1. **DeepSeek `require_tools` behavior**: Research indicates unreliable tool calling.
   - Does `toolChoice: 'required'` work reliably?
   - Should we auto-downgrade to `auto` for DeepSeek?
   - Test with both single-step and multi-step turns.

2. **Anthropic extended thinking + `require_tools`**: Anthropic docs say only
   `tool_choice: 'auto'` is compatible with extended thinking.
   - Does this affect our default? Should we detect extended thinking?
   - Workaround: Use `auto` + strong prompting when extended thinking is enabled.

3. **`require_web_search` with providers using different search tool names**:
   - OpenAI: `web_search`, Anthropic: `web_search`, Google: `google_search`
   - Need to resolve correct tool name dynamically.

4. **Step limits**: With `require_web_search`, do we burn a step on search?
   - Current default: 20 steps per turn (plenty of room).
   - Monitor if complex forms hit the step limit.

5. **Provider-specific `toolChoice: { type: 'tool' }` support**:
   - xAI can't force server-side tools — does this affect web search?
   - Need to test forcing specific tool names across all providers.

## Implementation Plan

### Phase 1: Core Policies

**Goal:** Implement `toolPolicy` with `none`, `auto`, `require_tools`, `require_web_search`.

- [ ] Add `ToolPolicy` type to `harnessTypes.ts`
- [ ] Add `toolPolicy` to `FillOptions` and `LiveAgentConfig`
- [ ] Add `tool_policy` to `HarnessConfigYaml` and mapping in `settings.ts`
- [ ] Implement `prepareStep` callback in `liveAgent.ts` for `require_web_search`
- [ ] Resolve web search tool name dynamically (provider-aware)
- [ ] Add `--tool-policy` flag to `markform fill` command
- [ ] Update `fillRecord` to track policy in metadata
- [ ] Write unit tests for policy → toolChoice translation
- [ ] Write integration tests with mock agents

### Phase 2: Provider Validation

**Goal:** Validate all policies across providers.

- [ ] Create test matrix: policy × provider
- [ ] Test DeepSeek specifically: `require_tools` and `require_web_search`
- [ ] Test Anthropic with extended thinking
- [ ] Test xAI with forced tool names
- [ ] Document provider-specific recommendations
- [ ] Add fallback behavior for unsupported provider/policy combos

### Phase 3: Harness-Level Research (Future)

**Goal:** Enable guaranteed research without relying on model behavior.

- [ ] Design search query generation from field metadata
- [ ] Implement harness-level web search execution
- [ ] Inject research results into context prompt
- [ ] Add `research_mode: auto | manual` config option
- [ ] Cache research results across turns for efficiency
- [ ] Write integration tests

## Testing Strategy

### Unit Tests

- Policy → toolChoice translation for each policy type
- Policy parsing from frontmatter and CLI
- Web search tool name resolution per provider

### Integration Tests (Mock Agents)

- `none`: Agent receives no tools
- `auto`: Agent receives `toolChoice: 'auto'`
- `require_tools`: Agent receives `toolChoice: 'required'`
- `require_web_search`: Step 0 forced to web_search, step 1+ required

### End-to-End Tests (Real LLM Calls)

- Test each policy with a factual research form
- Verify web search is actually called (check fill record / wire format)
- Compare accuracy: auto vs require_tools vs require_web_search
- Measure latency impact

### Provider Matrix

```
┌─────────────────────┬────────┬──────────┬─────────┬────────┬─────┐
│ Policy              │ OpenAI │ Anthropic│ DeepSeek│ Google │ xAI │
├─────────────────────┼────────┼──────────┼─────────┼────────┼─────┤
│ none                │   ✓    │    ✓     │    ✓    │   ✓    │  ✓  │
│ auto                │   ✓    │    ✓     │    ✓    │   ✓    │  ✓  │
│ require_tools       │   ✓    │    ✓     │    ?    │   ✓    │  ✓  │
│ require_web_search  │   ✓    │    ?     │    ?    │   ?    │  ?  │
└─────────────────────┴────────┴──────────┴─────────┴────────┴─────┘
```

## Rollout Plan

1. **Phase 1**: Ship `none`, `auto`, `require_tools`, `require_web_search`
   - Default is `require_tools` (already the current behavior)
   - `require_web_search` documented as beta until provider testing complete

2. **Phase 2**: Validate across providers, promote `require_web_search` to stable

3. **Phase 3**: Harness-level research injection as the robust solution for
   forms that truly need guaranteed research

## Open Questions

1. **Web search tool naming**: Should `require_web_search` resolve tool names
   dynamically (e.g., `google_search` for Google provider), or should we normalize
   all search tools to `web_search`?
   - Current code: Google uses `google_search`, others use `web_search`
   - Recommendation: Resolve dynamically using existing `isWebSearchTool()` helper

2. **DeepSeek fallback**: If `require_tools` doesn't work on DeepSeek, should we
   auto-detect and fall back, or let it fail visibly?
   - Recommendation: Fail visibly with a warning, let user set `auto` explicitly

3. **Extended thinking**: Should we auto-detect extended thinking on Anthropic and
   downgrade to `auto`?
   - Recommendation: Yes, with a logged warning

4. **Harness-level research scope**: When implemented, should it search for all
   fields or only unfilled fields with `research: required` annotation?
   - Deferred to Phase 3 design

## References

- [Research: Tool Choice Parameter](../research/research-2026-02-02-tool-choice-parameter.md)
- [AI SDK Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [AI SDK Agents: Loop Control](https://ai-sdk.dev/docs/agents/loop-control)
- [Parallel Form Filling Spec](plan-2026-01-27-parallel-form-filling.md)
- [GitHub Issue: Tool Execution Unreliable](https://github.com/vercel/ai/issues/10269)
- [GitHub Issue: toolChoice Endless Loop](https://github.com/vercel/ai/issues/3944)

### Source Code References

- `liveAgent.ts:91` — current `toolChoice` default (`'required'`)
- `liveAgent.ts:123-125` — stateless turn documentation
- `liveAgent.ts:201-209` — `generateText()` invocation with `stepCountIs`
- `liveAgent.ts:231` — tool call counting (for post-turn validation)
- `liveAgent.ts:746-748` — `isWebSearchTool()` helper
- `generate-text.ts:518-546` (AI SDK) — `prepareStep` callback invocation
