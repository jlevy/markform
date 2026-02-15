# Plan Spec: Tool Choice Policies for Reliable Form Filling

**Date:** 2026-02-02 (last updated 2026-02-03)

**Author:** AI Research

**Status:** Draft

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
4. **Form-level and field-level control**: Allow policies at form level with optional per-field
   overrides
5. **Integration with parallel execution**: Policies should compose with the existing `parallel`
   and `order` attributes

## Non-Goals

- Custom tool definitions per form (tools are provided by the harness)
- Model-specific prompt tuning (policies should work across models)
- UI for policy configuration (CLI/API only for now)
- Automatic policy selection based on field content

## Background

### The Problem

Current Markform behavior uses `toolChoice: 'auto'` by default, meaning the model decides
whether to use tools. In practice, models often:

1. **Skip web search entirely** and fill fields with training data (which may be outdated)
2. **Hallucinate tool calls** by describing what they would search without actually searching
3. **Become unreliable after ~5 turns** as conversation length increases
4. **Fill forms without research** when under time pressure or with simpler prompts

### Research Findings

From the research doc (`research-2026-02-02-tool-choice-parameter.md`):

- `toolChoice: 'required'` forces tool use but can cause infinite loops without termination
- `toolChoice: { type: 'tool', toolName: 'webSearch' }` forces a specific tool
- Different providers translate these values differently (Anthropic: `required` → `any`)
- AI SDK 6's `prepareStep` allows dynamic toolChoice per turn
- Google recommends limiting to 10-20 tools for reliable selection
- DeepSeek has unreliable multi-turn tool calling; best for single-turn

### Current Implementation

The harness provides these tools to the agent:
- `fill_form` - Apply patches to the form
- `web_search` (optional, via `enableWebSearch`) - Search the web for information

Currently, `toolChoice` is not explicitly set, defaulting to `'auto'`.

## Design

### Tool Choice Policy Enum

A new `toolPolicy` option controls how the harness manages tool selection:

```typescript
type ToolPolicy =
  | 'none'                // No tools provided to agent
  | 'auto'                // Model chooses freely whether to use tools
  | 'require_tools'       // toolChoice: 'required' on every turn (DEFAULT)
  | 'web_search_first'    // Force web_search on first turn, then require_tools
  | 'web_search_always'   // Force web_search every turn until form complete
  | 'two_phase'           // Phase 1: web search only, Phase 2: fill only
```

**Default:** `require_tools` — ensures the agent always makes progress by calling a tool
(either `fill_form` or `web_search`) on every turn. This prevents "analysis paralysis"
where models describe what they would do without actually doing it.

### Policy Behaviors

#### `none`

```
No tools provided to agent
Agent can only generate text responses
```

**When to use:** Testing, debugging, or when tools are intentionally disabled

#### `auto`

```
toolChoice: 'auto' on every turn
Model decides when to search and when to fill
No enforcement of research before filling
```

**When to use:** Legacy behavior, simple forms that don't need research, or when you
want maximum model flexibility

#### `require_tools` (Default)

```
toolChoice: 'required' on every turn
Model must call SOME tool every turn (fill_form or web_search)
Prevents "analysis paralysis" where model talks without acting
Uses termination detection to allow final response
```

**When to use:** General production use, ensures progress every turn. This is the
recommended default for most forms.

#### `web_search_first`

```
Turn 1: toolChoice: { type: 'tool', toolName: 'web_search' }
Turn 2+: toolChoice: 'required'
```

**When to use:** Forms with factual fields that need current data, moderate latency tolerance

#### `web_search_always`

```
Every turn: First call must be web_search (via prepareStep logic)
After web_search returns, toolChoice: 'required' for rest of turn
```

**When to use:** High-accuracy requirements, fields with rapidly changing data

**Implementation:**
```typescript
prepareStep: ({ lastToolResults }) => {
  const hasSearchedThisTurn = lastToolResults?.some(
    r => r.toolName === 'web_search'
  );
  if (!hasSearchedThisTurn) {
    return { toolChoice: { type: 'tool', toolName: 'web_search' } };
  }
  return { toolChoice: 'required' };
},
```

#### `two_phase`

```
Phase 1 (Research): Only web_search available, toolChoice: 'required'
                    Runs until configurable turn count or all fields researched
Phase 2 (Fill):     Only fill_form available, toolChoice: 'required'
                    Uses research context from Phase 1
```

**When to use:** Maximum accuracy, complex research forms, acceptable latency

**Implementation:** Two separate agent invocations with different tool sets

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

  /**
   * For 'two_phase' policy: max turns in research phase.
   * After this many turns, switches to fill phase.
   *
   * @default 5
   */
  researchPhaseTurns?: number;

  /**
   * For 'web_search_always': max searches per turn.
   * Prevents excessive API calls on forms with many fields.
   *
   * @default 3
   */
  maxSearchesPerTurn?: number;
}
```

#### Frontmatter Configuration

```yaml
---
markform:
  spec: MF/0.1
  harness_config:
    tool_policy: web_search_first    # New option
    research_phase_turns: 5          # For two_phase
    max_searches_per_turn: 3         # For web_search_always
---
```

#### CLI Extension

```bash
# New --tool-policy flag
markform fill form.md --tool-policy=web_search_first

# Override policy at CLI level
markform fill form.md --tool-policy=two_phase --research-phase-turns=8
```

### Field-Level Research Hints (Future Enhancement)

For v2, consider per-field annotations:

```markdown
<!-- field kind="string" id="revenue" label="Revenue" research="required" -->
<!-- /field -->

<!-- field kind="string" id="notes" label="Notes" research="none" -->
<!-- /field -->
```

This is deferred - the form-level policy is sufficient for initial implementation.

### Provider-Specific Considerations

From research, key provider differences to handle:

| Provider | Notes |
|----------|-------|
| OpenAI | `'required'` works directly; parallel tool calls supported |
| Anthropic | `'required'` → `'any'` translation; `disable_parallel_tool_use` available |
| Google | `'required'` → `mode: 'ANY'`; limit to 10-20 tools |
| DeepSeek | Unreliable multi-turn; best with `auto` or single-turn `required` |
| xAI | Can't force provider-defined tools; use grok-4-1-fast |

**Recommendation:** Test `two_phase` and `web_search_always` across all providers before
recommending as defaults. `require_tools` should work reliably across all providers.

### Areas of Uncertainty (Requiring Testing)

1. **DeepSeek multi-turn behavior**: Research indicates unreliable tool calling after first turn.
   Need to test:
   - Does `toolChoice: 'required'` work reliably on DeepSeek?
   - What happens with `two_phase` policy?
   - Should we auto-downgrade to `auto` for DeepSeek?

2. **Anthropic extended thinking**: `toolChoice: 'required'` may conflict with extended thinking.
   Need to test:
   - Does `web_search_first` work with Claude 4 extended thinking?
   - Should we detect extended thinking and adjust policy?

3. **Termination detection**: With `toolChoice: 'required'`, how do we allow final text response?
   Options to test:
   - Use `stopWhen: hasToolCall('fill_form')` with form completion check
   - Use `prepareStep` to switch to `'auto'` on last turn
   - Add a no-op `complete` tool

4. **Parallel execution interaction**: When `enableParallel: true`:
   - Should each parallel agent have its own tool policy?
   - Should research happen in loose-serial before parallel batches?
   - Test: parallel agents with `web_search_first` - do they all search or just one?

5. **Turn limits**: With `web_search_always`, does forcing search on every turn:
   - Hit rate limits with providers?
   - Significantly impact latency?
   - Improve accuracy enough to justify cost?

## Implementation Plan

### Phase 1: Core Policy Engine

**Goal:** Implement `toolPolicy` option with `none`, `auto`, `require_tools`, and `web_search_first`.

- [ ] Add `ToolPolicy` type to `harnessTypes.ts`
- [ ] Add `toolPolicy` to `FillOptions` and `HarnessConfig`
- [ ] Add `tool_policy` to `HarnessConfigYaml` and mapping in `settings.ts`
- [ ] Implement `getToolChoiceForPolicy()` helper that returns AI SDK toolChoice
- [ ] Update `liveAgent.ts` to use `prepareStep` for policy enforcement
- [ ] Update `fillRecord` to track policy and actual tool usage
- [ ] Add `--tool-policy` flag to `markform fill` command
- [ ] Write unit tests for policy → toolChoice translation
- [ ] Write integration tests with mock agents

### Phase 2: Advanced Policies

**Goal:** Implement `web_search_always` and `two_phase` policies.

- [ ] Implement `web_search_always` with `prepareStep` logic
- [ ] Implement `two_phase` with separate agent invocations
- [ ] Add `researchPhaseTurns` and `maxSearchesPerTurn` options
- [ ] Update frontmatter parser for new options
- [ ] Add session transcript support for two_phase (mark phase transitions)
- [ ] Write integration tests for advanced policies

### Phase 3: Provider Testing & Documentation

**Goal:** Validate policies across providers and document recommendations.

- [ ] Create test matrix: policy × provider × form complexity
- [ ] Test DeepSeek specifically for multi-turn reliability
- [ ] Test Anthropic with extended thinking
- [ ] Document provider-specific recommendations in research doc
- [ ] Update `docs/markform-apis.md` with policy documentation
- [ ] Add example forms demonstrating each policy
- [ ] Create troubleshooting guide for policy issues

### Phase 4: Parallel Execution Integration

**Goal:** Ensure policies work correctly with parallel execution.

- [ ] Define policy behavior for parallel agents
- [ ] Test `web_search_first` with parallel batches
- [ ] Test `two_phase` with parallel batches (research → parallel fill)
- [ ] Add policy options to `ParallelHarnessConfig`
- [ ] Document parallel + policy interaction

## Testing Strategy

### Unit Tests

- Policy → toolChoice translation for each policy type
- Policy parsing from frontmatter
- CLI flag parsing

### Integration Tests (Mock Agents)

- `none`: Agent receives no tools
- `auto`: Agent receives `toolChoice: 'auto'`
- `require_tools`: Agent receives `toolChoice: 'required'`
- `web_search_first`: Turn 1 gets forced web_search, turn 2+ gets required
- `web_search_always`: Each turn starts with forced web_search
- `two_phase`: Two agent invocations with different tool sets

### End-to-End Tests (Real LLM Calls)

- Test each policy with a factual research form
- Verify web search is actually called (check fill record)
- Compare accuracy: auto vs web_search_first vs two_phase
- Measure latency impact

### Provider Matrix Tests

Create automated tests that run the same form across providers:

```
┌───────────────────┬────────┬──────────┬─────────┬────────┐
│ Policy            │ OpenAI │ Anthropic│ DeepSeek│ Google │
├───────────────────┼────────┼──────────┼─────────┼────────┤
│ none              │   ✓    │    ✓     │    ✓    │   ✓    │
│ auto              │   ✓    │    ✓     │    ✓    │   ✓    │
│ require_tools     │   ✓    │    ✓     │    ?    │   ✓    │
│ web_search_first  │   ✓    │    ✓     │    ?    │   ✓    │
│ web_search_always │   ✓    │    ?     │    ?    │   ✓    │
│ two_phase         │   ✓    │    ✓     │    ?    │   ✓    │
└───────────────────┴────────┴──────────┴─────────┴────────┘
```

## Rollout Plan

1. **Phase 1 release**: Add `toolPolicy` with `none`, `auto`, `require_tools`, `web_search_first`
   - Default is `require_tools` for reliable tool usage out of the box
   - Document policy options and when to use each

2. **Phase 2 release**: Add `web_search_always` and `two_phase`
   - Include provider testing results
   - Document recommended policies per use case

3. **Backward compatibility**: Existing forms without `tool_policy` get `require_tools`
   - This is a behavior change from implicit `auto`, but improves reliability
   - Users can explicitly set `tool_policy: auto` if needed

## Open Questions

1. **DeepSeek compatibility**: Does `require_tools` work reliably on DeepSeek?
   - If not, should we auto-detect DeepSeek and fall back to `auto`?
   - Need testing to determine

2. **Per-field policies**: Is form-level policy sufficient, or do we need field-level control?
   - Current decision: Form-level first, field-level in v2

3. **Policy inheritance in parallel execution**: Should parallel agents inherit the form policy
   or have independent policies?
   - Recommendation: Inherit form policy, with option to override per batch

4. **Cost tracking**: Should we track web search costs separately in fill records?
   - Recommendation: Yes, add `webSearchCalls` count to fill record

5. **Policy composition with `order`**: For `two_phase`, should research happen only for
   the current order level, or research all fields upfront?
   - Recommendation: Research current order level only (progressive disclosure)

## References

- [Research: Tool Choice Parameter](../research/research-2026-02-02-tool-choice-parameter.md)
- [AI SDK Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [AI SDK Agents: Loop Control](https://ai-sdk.dev/docs/agents/loop-control)
- [Parallel Form Filling Spec](plan-2026-01-27-parallel-form-filling.md)
- [GitHub Issue: Tool Execution Unreliable](https://github.com/vercel/ai/issues/10269)
- [GitHub Issue: toolChoice Endless Loop](https://github.com/vercel/ai/issues/3944)
