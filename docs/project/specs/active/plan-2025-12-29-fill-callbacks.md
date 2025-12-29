# Plan Spec: Fill Callbacks for Observability

## Purpose

Add a callbacks interface to `fillForm()` enabling consumers to observe form-filling
execution in real-time, including turn lifecycle, tool calls, and LLM interactions.

## Background

Markform is used as a library in other applications (e.g., Arena) that need visibility into
what's happening during form filling. Currently:

- `fillForm()` has `onTurnComplete` callback providing basic `TurnProgress`
- `TurnStats` includes token usage and tool call *counts* but not individual call details
- No hooks for observing individual tool executions or LLM calls as they happen

Arena has rich logging infrastructure (`EventLogger`) with methods like `toolStart()`,
`toolSuccess()`, `llmCall()` etc., but no way to connect markform execution to it.

### Related Documentation

- [programmaticFill.ts](packages/markform/src/harness/programmaticFill.ts) - Main `fillForm()` entry point
- [liveAgent.ts](packages/markform/src/harness/liveAgent.ts) - LLM agent that makes tool/LLM calls
- [harnessTypes.ts](packages/markform/src/harness/harnessTypes.ts) - `FillOptions`, `TurnProgress`, `TurnStats`

## Summary of Task

Replace the existing `onTurnComplete` callback with a comprehensive `callbacks` interface
that provides hooks for:

1. **Turn lifecycle** - `onTurnStart`, `onTurnComplete`
2. **Tool calls** - `onToolStart`, `onToolEnd`
3. **LLM calls** - `onLlmCallStart`, `onLlmCallEnd`

All callbacks are optional - consumers implement only what they need.

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: DO NOT MAINTAIN - Remove `onTurnComplete`
  from `FillOptions`, replace with `callbacks` object.

- **Library APIs**: DO NOT MAINTAIN - This is a breaking change to the public API.

- **Server APIs**: N/A - No server component.

- **File formats**: N/A - No file format changes.

- **Database schemas**: N/A - No database component.

## Stage 1: Planning Stage

### Feature Requirements

**Core Requirements:**

1. New `FillCallbacks` interface with optional lifecycle hooks
2. Replace `onTurnComplete` callback with `callbacks?: FillCallbacks` in `FillOptions`
3. Call appropriate hooks at each stage of form filling
4. All callbacks optional - no-op if not provided

**Callback Interface:**

```typescript
interface FillCallbacks {
  /** Called when a turn begins */
  onTurnStart?(turn: { turnNumber: number; issuesCount: number }): void;

  /** Called when a turn completes (replaces old onTurnComplete) */
  onTurnComplete?(progress: TurnProgress): void;

  /** Called before a tool executes */
  onToolStart?(call: { name: string; input: unknown }): void;

  /** Called after a tool completes */
  onToolEnd?(call: { name: string; output: unknown; durationMs: number; error?: string }): void;

  /** Called before an LLM request */
  onLlmCallStart?(call: { model: string }): void;

  /** Called after an LLM response */
  onLlmCallEnd?(call: { model: string; inputTokens: number; outputTokens: number }): void;
}
```

**Updated FillOptions:**

```typescript
interface FillOptions {
  form: string | ParsedForm;
  model: string | LanguageModel;
  callbacks?: FillCallbacks;  // NEW - replaces onTurnComplete
  // ... rest unchanged (inputContext, systemPromptAddition, maxTurns, etc.)
}
```

**Out of Scope (Not Implementing):**

- [ ] Event stream/observable pattern (rejected as overkill)
- [ ] Storing events in `FillResult` (memory overhead concern)
- [ ] Async callbacks (keep sync for simplicity)

### Acceptance Criteria

1. `FillCallbacks` interface exported from markform
2. `onTurnStart` called at start of each turn with turn number and issue count
3. `onTurnComplete` called after each turn with full `TurnProgress`
4. `onToolStart` called before each tool execution with name and input
5. `onToolEnd` called after each tool with output, duration, and optional error
6. `onLlmCallStart` called before `generateText()` with model name
7. `onLlmCallEnd` called after `generateText()` with token counts
8. All callbacks are optional - form filling works with no callbacks
9. Callback errors don't abort form filling (caught and ignored)

### Consumer Usage Examples

**CLI Mode - Real-time Console Feedback:**

```typescript
await fillForm({
  form: formMarkdown,
  model: modelId,
  enableWebSearch: true,
  callbacks: {
    onToolStart: ({ name }) => spinner.message(`🔧 ${name}...`),
    onTurnComplete: (p) => {
      console.log(`Turn ${p.turnNumber}: ${p.patchesApplied} patches, ${p.requiredIssuesRemaining} remaining`);
    },
  },
});
```

**Production - Forward to EventLogger:**

```typescript
function createEventLoggerCallbacks(eventLogger: EventLogger): FillCallbacks {
  return {
    onToolStart: ({ name, input }) => eventLogger.toolStart(name, input),
    onToolEnd: ({ name, output, durationMs, error }) =>
      error
        ? eventLogger.toolFailure(name, durationMs, error, null)
        : eventLogger.toolSuccess(name, durationMs, output, null),
    onLlmCallEnd: ({ model, inputTokens, outputTokens }) =>
      eventLogger.llmCall('markform', model, 'fill', { input: inputTokens, output: outputTokens }),
  };
}

await fillForm({
  form: formMarkdown,
  model: modelId,
  enableWebSearch: true,
  callbacks: createEventLoggerCallbacks(eventLogger),
});
```

## Stage 2: Architecture Stage

### Implementation Approach

**Challenge:** Tool calls happen inside Vercel AI SDK's `generateText()` which runs
autonomously. We need to instrument tools to capture before/after timing.

**Solution:** Wrap tools before passing to `generateText()`:

```typescript
function wrapToolsWithCallbacks(
  tools: Record<string, Tool>,
  callbacks?: FillCallbacks
): Record<string, Tool> {
  if (!callbacks?.onToolStart && !callbacks?.onToolEnd) {
    return tools; // No wrapping needed
  }

  const wrapped: Record<string, Tool> = {};
  for (const [name, tool] of Object.entries(tools)) {
    wrapped[name] = wrapTool(tool, name, callbacks);
  }
  return wrapped;
}

function wrapTool(tool: Tool, name: string, callbacks: FillCallbacks): Tool {
  return {
    ...tool,
    execute: async (input) => {
      const startTime = Date.now();
      callbacks.onToolStart?.({ name, input });
      try {
        const output = await tool.execute(input);
        callbacks.onToolEnd?.({ name, output, durationMs: Date.now() - startTime });
        return output;
      } catch (error) {
        callbacks.onToolEnd?.({
          name,
          output: null,
          durationMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    },
  };
}
```

### File Changes

```
packages/markform/src/
  harness/
    harnessTypes.ts          # MODIFY: Add FillCallbacks, remove onTurnComplete
    programmaticFill.ts      # MODIFY: Use callbacks, add onTurnStart/onLlmCall* hooks
    liveAgent.ts             # MODIFY: Accept callbacks, wrap tools
  index.ts                   # MODIFY: Export FillCallbacks type
```

### Data Flow

```
fillForm()
  │
  ├─ onTurnStart({ turnNumber, issuesCount })
  │
  ├─ agent.generatePatches()
  │     │
  │     ├─ onLlmCallStart({ model })
  │     │
  │     ├─ generateText() with wrapped tools
  │     │     │
  │     │     ├─ [for each tool call]
  │     │     │     ├─ onToolStart({ name, input })
  │     │     │     ├─ tool.execute()
  │     │     │     └─ onToolEnd({ name, output, durationMs, error? })
  │     │     │
  │     │     └─ [LLM response]
  │     │
  │     └─ onLlmCallEnd({ model, inputTokens, outputTokens })
  │
  ├─ harness.apply(patches)
  │
  └─ onTurnComplete(progress)
```

## Stage 3: Refine Architecture

### Reusable Components

- Existing `TurnProgress` type can be reused for `onTurnComplete`
- Tool wrapping pattern is self-contained, no external dependencies

### Simplifications

1. **No new files** - All changes fit in existing files
2. **No new dependencies** - Pure TypeScript implementation
3. **Callbacks passed through** - `fillForm` → `LiveAgent` → tool wrappers

### Implementation Phases

**Phase 1: Types and Interface**

- [ ] Add `FillCallbacks` interface to `harnessTypes.ts`
- [ ] Remove `onTurnComplete` from `FillOptions`, add `callbacks`
- [ ] Export `FillCallbacks` from `index.ts`

**Phase 2: Turn Lifecycle Callbacks**

- [ ] Add `onTurnStart` call in `programmaticFill.ts` before agent call
- [ ] Update `onTurnComplete` call to use `callbacks?.onTurnComplete`
- [ ] Add unit tests for turn callbacks

**Phase 3: LLM Call Callbacks**

- [ ] Pass callbacks to `LiveAgent` constructor
- [ ] Add `onLlmCallStart` before `generateText()` in `liveAgent.ts`
- [ ] Add `onLlmCallEnd` after `generateText()` with token counts
- [ ] Add unit tests for LLM callbacks

**Phase 4: Tool Call Callbacks**

- [ ] Implement `wrapToolsWithCallbacks()` helper in `liveAgent.ts`
- [ ] Wrap tools before passing to `generateText()`
- [ ] Add unit tests for tool callbacks (mock tools)

**Phase 5: Integration Testing**

- [ ] Test full flow with all callbacks
- [ ] Test partial callbacks (only some implemented)
- [ ] Test callback errors don't abort fill
- [ ] Update any existing tests that use `onTurnComplete`

## Stage 4: Validation Stage

### Test Plan

**1. Unit Tests** (`tests/unit/harness/callbacks.test.ts`):

- `FillCallbacks` with all hooks receives all events
- `FillCallbacks` with only `onTurnComplete` works
- `FillCallbacks` with only tool hooks works
- Callback that throws doesn't abort fill
- No callbacks (undefined) works

**2. Integration Tests**:

- Mock agent with tool calls triggers tool callbacks
- Real form fill with callbacks captures expected events
- Event ordering is correct (turnStart → llmStart → toolStart → toolEnd → llmEnd → turnComplete)

**3. Manual Testing**:

- Console logger callbacks with CLI `fill` command
- Verify timing values are reasonable (durationMs > 0)

### Success Criteria

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Callback errors are caught and don't abort fill
- [ ] No performance regression (benchmark optional)
- [ ] Types exported correctly (`import { FillCallbacks } from 'markform'`)
- [ ] Arena can integrate with `createEventLoggerCallbacks` pattern
