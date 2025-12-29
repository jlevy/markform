# Feature Validation: Fill Callbacks for Observability

## Purpose

This is a validation spec for the FillCallbacks implementation, listing post-testing validation
that must be performed by the user to confirm the feature implementation and testing is adequate.

**Feature Plan:** [plan-2025-12-29-fill-callbacks.md](plan-2025-12-29-fill-callbacks.md)

**Implementation:** Completed across beads markform-446 through markform-452

## Stage 4: Validation Stage

## Validation Planning

The FillCallbacks implementation adds a comprehensive callbacks interface to `fillForm()` enabling
consumers to observe form-filling execution in real-time. Six callback hooks are supported:

| Callback | Purpose | Tested |
|----------|---------|--------|
| `onTurnStart` | Called when a turn begins | Yes |
| `onTurnComplete` | Called when a turn completes | Yes |
| `onToolStart` | Called before a tool executes | No |
| `onToolEnd` | Called after a tool completes | No |
| `onLlmCallStart` | Called before an LLM request | No |
| `onLlmCallEnd` | Called after an LLM response | No |

## Automated Validation (Testing Performed)

### Unit Testing

**File:** [packages/markform/tests/unit/harness/programmaticFill.test.ts](../../../packages/markform/tests/unit/harness/programmaticFill.test.ts)

**Turn Lifecycle Callbacks (7 tests):**

1. `callbacks.onTurnStart called before each turn` - Verifies turn number and issue count
2. `callbacks.onTurnComplete called after each turn` - Verifies progress updates
3. `TurnProgress contains correct values` - Validates all TurnProgress fields
4. `callback errors don't abort fill` - Confirms error isolation
5. `onTurnStart and onTurnComplete both called in order` - Verifies event ordering
6. `works with partial callbacks (only onTurnStart)` - Partial implementation support
7. `works with no callbacks (undefined)` - No callbacks baseline

### Integration and End-to-End Testing

**Not explicitly tested:**

- Tool callbacks (`onToolStart`, `onToolEnd`) are implemented but rely on integration with
  real/mock tools during `generateText()`. The wrapping logic in
  [liveAgent.ts:395-465](../../../packages/markform/src/harness/liveAgent.ts#L395-L465) is not
  unit tested.

- LLM callbacks (`onLlmCallStart`, `onLlmCallEnd`) are implemented at
  [liveAgent.ts:150-176](../../../packages/markform/src/harness/liveAgent.ts#L150-L176) but require
  real LLM calls to trigger.

- CLI integration at
  [cli/lib/fillCallbacks.ts](../../../packages/markform/src/cli/lib/fillCallbacks.ts) has no
  dedicated tests (covered by manual testing below).

## Manual Testing Needed

### 1. CLI Fill Command with Web Search

Test the CLI integration to verify spinner feedback during web search tool calls:

```bash
# Create a test form that triggers web search
cat > /tmp/test-websearch.form.md << 'EOF'
---
spec: MF/0.1
id: test_websearch
title: Web Search Test
---

# Web Search Test

{% string-field #query role="user" required %}
**Search Query**
Enter a query to search for.
{% /string-field %}

{% string-field #result role="agent" required minLength=10 %}
**Search Result**
{% /string-field %}

Fill the result field by searching for the query online.
EOF

# Run fill with web search enabled (watch for spinner feedback)
npx markform fill /tmp/test-websearch.form.md --roles=agent --model anthropic/claude-3-5-haiku-latest --interactive

# When prompted, enter: "current weather in San Francisco"
# VERIFY: Spinner should show "🔍 Web search..." during search
# VERIFY: --verbose should show "Tool started: web_search" and "Tool completed"
```

### 2. Verbose Mode Callback Logging

```bash
# Run fill with verbose flag to see tool callback logging
npx markform fill packages/markform/examples/movie-research/movie-research-minimal.form.md \
  --roles=agent \
  --model anthropic/claude-3-5-haiku-latest \
  --verbose \
  --interactive

# Enter a movie title when prompted
# VERIFY: Console shows "Tool started: <name>" for any tool calls
# VERIFY: Console shows "Tool <name> completed (<time>ms)" after completion
```

### 3. Programmatic API Validation

Test the exported `FillCallbacks` type is usable from consuming code:

```typescript
// In a TypeScript file, verify type exports
import { fillForm, FillCallbacks, TurnProgress } from 'markform';

const callbacks: FillCallbacks = {
  onTurnStart: ({ turnNumber, issuesCount }) => {
    console.log(`Turn ${turnNumber}: ${issuesCount} issues`);
  },
  onToolStart: ({ name, input }) => {
    console.log(`Tool: ${name}`, input);
  },
  onLlmCallEnd: ({ model, inputTokens, outputTokens }) => {
    console.log(`LLM: ${model} - ${inputTokens}/${outputTokens} tokens`);
  },
};

// VERIFY: TypeScript compiles without errors
// VERIFY: All callback parameter types are correct
```

### 4. Event Ordering Validation

With verbose logging, verify callback events fire in correct order:

```
Expected order per turn:
1. onTurnStart({ turnNumber, issuesCount })
2. onLlmCallStart({ model })
3. [for each tool call]
   - onToolStart({ name, input })
   - onToolEnd({ name, output, durationMs })
4. onLlmCallEnd({ model, inputTokens, outputTokens })
5. onTurnComplete(progress)
```

### 5. Error Isolation Validation

Verify that callback errors don't abort form filling:

```typescript
// Programmatically test with throwing callbacks
const result = await fillForm({
  form: myForm,
  model: 'anthropic/claude-3-5-haiku-latest',
  enableWebSearch: false,
  callbacks: {
    onToolStart: () => { throw new Error('Test error'); },
    onTurnComplete: () => { throw new Error('Test error'); },
  },
});

// VERIFY: result.status.ok === true (fill completes despite errors)
```

## Acceptance Criteria Verification

From plan spec:

- [x] `FillCallbacks` interface exported from markform
- [x] `onTurnStart` called at start of each turn with turn number and issue count
- [x] `onTurnComplete` called after each turn with full `TurnProgress`
- [x] `onToolStart` called before each tool execution with name and input
- [x] `onToolEnd` called after each tool with output, duration, and optional error
- [x] `onLlmCallStart` called before `generateText()` with model name
- [x] `onLlmCallEnd` called after `generateText()` with token counts
- [x] All callbacks are optional - form filling works with no callbacks
- [x] Callback errors don't abort form filling (caught and ignored)

## Notes

The implementation is complete. Manual testing focuses on:

1. CLI spinner integration (visual feedback during web search)
2. Verbose logging output (confirms tool callbacks fire)
3. Real-world usage patterns for consuming applications

Unit tests cover turn lifecycle thoroughly. Tool and LLM callbacks are implemented but tested only
through integration (real fills with actual LLM calls).
