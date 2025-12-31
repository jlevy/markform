# Plan Spec: Enhanced Session Golden Tests with Full LLM Wire Format

## Purpose

This is a technical design doc for enhancing the golden test session logging to capture
the complete wire format of LLM interactions, enabling comprehensive regression testing
and prompt engineering visibility.

## Background

### The Session Testing Methodology

Session golden tests are a powerful testing methodology that captures the complete
execution trace of an agent session and replays it for verification. This approach:

1. **Records everything** - All input, output, and intermediate states are serialized to
   a `.session.yaml` file alongside each test form

2. **Enables diffing** - Changes between test runs are visible through version control,
   making regressions immediately apparent

3. **Catches regressions** - Any change to LLM prompts, error messages, or behavior is
   immediately detected by hash mismatches or content diffs

4. **Documents behavior** - Session files serve as living documentation of exactly how
   the system behaves with specific inputs

### Why Capture Everything?

The key insight of session testing is that the session log should be the **single source
of truth** for all LLM interactions. By capturing the complete wire format:

- **Prompt changes are visible** - If someone edits a system prompt or error message,
  the exact change appears in git diff
- **Regressions are caught** - Any unintended change to what the LLM sees is detected
- **Debugging is easier** - When a session fails, the full context is available
- **Iteration is systematic** - Improve prompts and error messages by seeing exactly
  what the LLM receives and how it responds

### Current State

The existing session logging (in `.session.yaml` files) captures a clean YAML
representation of each turn:

```yaml
turns:
  - turn: 1
    inspect:
      issues: [...]        # InspectIssue[] - what the agent sees
    apply:
      patches: [...]       # Patch[] - what the agent tried
      rejected_patches: [] # PatchRejection[] - validation failures
    after:
      required_issue_count: 2
      markdown_sha256: <hash>
      answered_field_count: 10
    llm:                   # Optional stats
      input_tokens: 1234
      output_tokens: 567
      tool_calls: [{ name: generatePatches, count: 1 }]
    context:               # Optional prompts
      system_prompt: "..."
      context_prompt: "..."
```

This captures the **semantic** content but not the **exact wire format** as sent to and
received from the LLM.

### What's Missing

The current approach does NOT capture:

1. **Raw tool call inputs** - The exact JSON structure sent to tool calls
2. **Tool call results** - What the tools return (for executable tools)
3. **Multi-step execution** - Each step in `result.steps` with intermediate state
4. **LLM text responses** - Any text output from the model between tool calls
5. **Tool schemas** - The inputSchema definitions that constrain tool inputs

### Related Documentation

- [development.md](../../development.md) - Development guide and testing overview
- [general-tdd-guidelines.md](../../general/agent-guidelines/general-tdd-guidelines.md) -
  Golden test methodology
- [plan-2025-12-30-unified-fill-logging.md](plan-2025-12-30-unified-fill-logging.md) -
  Related logging improvements
- [plan-2025-12-29-fill-callbacks.md](../done/plan-2025-12-29-fill-callbacks.md) -
  Callback infrastructure this builds on

## Summary of Task

Enhance the session logging to include a **transparent wire format view** that captures
the exact JSON structure sent to and received from the LLM via Vercel AI SDK. This
includes:

1. The complete request (system prompt, context prompt, tool schemas)
2. The complete response (steps with tool calls, tool results, text, usage)
3. Serialization that is stable across runs (deterministic ordering, no timestamps)

### Key Example: Validation Error Messages

When an agent sends invalid patches (wrong field type, invalid column IDs, etc.), the
system returns error messages to help the agent correct its mistakes. These messages
are constructed in `buildContextPrompt()` in `liveAgent.ts`:

```typescript
if (previousRejections && previousRejections.length > 0) {
  lines.push('# Previous Patch Errors');
  lines.push('Your previous patches were rejected due to the following errors...');
  for (const rejection of previousRejections) {
    lines.push(`- **Error:** ${rejection.message}`);
    if (rejection.fieldKind) {
      const hint = getPatchFormatHint(...);
      lines.push(`  **Use instead:** ${hint}`);
    }
  }
}
```

With the enhanced session logging, we can:

1. See the **exact** error message text the LLM receives in the session log
2. Review how well the LLM understands and corrects from these errors
3. Iterate on error message wording to improve agent recovery
4. Detect any unintended regressions in error message format through diffs

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: DO NOT MAINTAIN - All changes are
  additive (new optional fields). Existing code continues to work unchanged.

- **Library APIs**: N/A - This is an internal enhancement to session logging, not a
  public API change.

- **Server APIs**: N/A - No server component.

- **File formats**: SUPPORT BOTH - Session files with or without `wire` section are
  valid. The new `wire` field is optional. Existing session files remain valid.

- **Database schemas**: N/A - No database component.

## Stage 1: Planning Stage

### Vercel AI SDK Research

The project uses **AI SDK v6.0.3** (`"ai": "^6.0.3"` in package.json).

The `generateText` function returns a result object with the following structure
(from [AI SDK documentation](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text)):

```typescript
const result = await generateText({
  model: this.model,
  system: systemPrompt,     // String - captured in wire.request.system
  prompt: contextPrompt,    // String - captured in wire.request.prompt
  tools,                    // Record<string, Tool> - captured in wire.request.tools
  stopWhen: stepCountIs(this.maxStepsPerTurn),
});

// Result object properties:
result.steps        // Array of steps - each step contains toolCalls, toolResults, text
result.usage        // { inputTokens, outputTokens, ... }
result.text         // Final text output (if any)
result.toolCalls    // Tool calls from last step
result.toolResults  // Tool results from last step
result.finishReason // Why generation stopped
result.request      // Request metadata
result.response     // Response metadata
```

Each step in `result.steps` contains:

```typescript
interface Step {
  toolCalls: Array<{
    toolName: string;      // Name of the tool called
    input: unknown;        // The input passed to the tool
    toolCallId: string;    // Unique ID for this call
  }>;
  toolResults: Array<{
    toolName: string;
    result: unknown;       // Return value from tool.execute()
    toolCallId: string;
  }>;
  text: string | null;     // Any text output in this step
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}
```

The current code in `liveAgent.ts` already iterates over `result.steps`:

```typescript
for (const step of result.steps) {
  for (const toolCall of step.toolCalls) {
    const count = toolCallCounts.get(toolCall.toolName) ?? 0;
    toolCallCounts.set(toolCall.toolName, count + 1);

    if (toolCall.toolName === 'generatePatches' && 'input' in toolCall) {
      const input = toolCall.input as { patches: Patch[] };
      patches.push(...input.patches);
    }
  }
}
```

### Feature Requirements

**Core Requirements:**

1. Add `WireFormat` interface capturing request and response structure
2. Capture wire format in `LiveAgent.generatePatches()` after `generateText()` returns
3. Flow wire format through `TurnStats` to `SessionTurn`
4. Serialize wire format in session YAML output
5. Ensure wire format is deterministically ordered (stable across runs)

**Wire Format Structure:**

```typescript
interface WireFormat {
  request: {
    system: string;           // System prompt sent to LLM
    prompt: string;           // Context prompt sent to LLM
    tools: Record<string, {   // Tool definitions
      description: string;
      inputSchema: unknown;   // JSON Schema from Zod
    }>;
  };
  response: {
    steps: Array<{
      toolCalls: Array<{
        toolName: string;
        input: unknown;
      }>;
      toolResults: Array<{
        toolName: string;
        result: unknown;
      }>;
      text: string | null;
    }>;
    usage: {
      inputTokens: number;
      outputTokens: number;
    };
  };
}
```

**Stability Requirements:**

| Field | Stability | Handling |
|-------|-----------|----------|
| Timestamps | Unstable | Omit (not present in relevant data) |
| Tool call IDs | Unstable | Omit from wire format |
| Token counts | Stable | Include (deterministic for same input) |
| Tool schemas | Stable | Include (want to catch schema changes) |
| Prompt text | Stable | Include (want to catch prompt changes) |
| JSON ordering | Must stabilize | Sort object keys deterministically |

**Out of Scope (Not Implementing):**

- [ ] Streaming response capture (we use `generateText`, not `streamText`)
- [ ] Request/response headers or HTTP-level details
- [ ] Provider-specific metadata (model fingerprints, etc.)
- [ ] Caching of wire format between runs
- [ ] Compression of wire format in session files

### Acceptance Criteria

1. [ ] `WireFormat` type is defined and exported
2. [ ] `TurnStats.wire` optional field captures complete request/response
3. [ ] `SessionTurn.wire` optional field is serialized to YAML
4. [ ] Wire format includes system prompt, context prompt, and tool schemas
5. [ ] Wire format includes all steps with tool calls, results, and text
6. [ ] Wire format is deterministically ordered (identical output for identical input)
7. [ ] Existing session files without `wire` field remain valid
8. [ ] Mock agent sessions produce stable wire format (no timestamp-like churn)
9. [ ] Golden tests pass after regeneration with wire format

## Stage 2: Architecture Stage

### Implementation Approach

**Capture Point:** Inside `LiveAgent.generatePatches()` after `generateText()` returns.

This is the ideal capture point because:
- We have access to the request (systemPrompt, contextPrompt, tools)
- We have access to the response (result.steps, result.usage)
- The data flows naturally through existing TurnStats plumbing

**Serialization Strategy:**

1. Extract wire format data in `LiveAgent.generatePatches()`
2. Add to `TurnStats.wire` (optional field)
3. Flow through to `SessionTurn.wire` in harness recording
4. Serialize as YAML (not embedded JSON) for readability and diffability
5. Use deterministic key ordering for stable output

### Current Data Flow

```
LiveAgent.generatePatches()
  ↓ builds systemPrompt, contextPrompt, tools
  ↓ calls generateText(...)
  ↓ extracts patches from result.steps
  ↓ builds TurnStats { usage, toolCalls, prompts }    ← ADD wire HERE
  ↓
programmaticFill()
  ↓ receives patches and stats
  ↓ passes to harness.apply()
  ↓
Harness.apply()
  ↓ records turn via recordTurn()
  ↓ includes stats in SessionTurn                     ← wire flows through
  ↓
SessionTranscript
  ↓ serialized to YAML via serializeSession()         ← wire serialized here
```

### File Changes

| File | Changes |
|------|---------|
| `src/harness/harnessTypes.ts` | Add `WireFormat` interface, add `wire?: WireFormat` to `TurnStats` |
| `src/harness/liveAgent.ts` | Capture wire format after `generateText()`, return in stats |
| `src/engine/coreTypes.ts` | Add `wire?: WireFormat` to `SessionTurn`, update Zod schemas |
| `src/engine/session.ts` | Handle wire format in `serializeSession()` / `parseSession()` |
| `tests/golden/runner.ts` | Wire format flows through; may add optional validation |

### Tool Schema Extraction

To capture tool schemas, we need to extract them from the tools object:

```typescript
function extractToolSchemas(tools: Record<string, Tool>): Record<string, { description: string; inputSchema: unknown }> {
  const schemas: Record<string, { description: string; inputSchema: unknown }> = {};
  for (const [name, tool] of Object.entries(tools)) {
    schemas[name] = {
      description: tool.description ?? '',
      inputSchema: tool.inputSchema ?? {},
    };
  }
  return schemas;
}
```

Note: The AI SDK's `Tool` interface has `description?: string` and `inputSchema` (the
Zod-wrapped schema). We capture the raw schema for the wire format.

### Deterministic Serialization

To ensure stable output, we need to sort object keys before serialization:

```typescript
function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);

  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}
```

This is applied to wire format data before adding to TurnStats.

## Stage 3: Refine Architecture

### Reusable Components

1. **Existing session serialization** (`session.ts`) - Already handles snake_case
   conversion and YAML output. Wire format will flow through this.

2. **Existing TurnStats flow** - Already captures prompts via `stats.prompts`. Wire
   format is a superset that includes prompts plus tool schemas and response steps.

3. **Existing step iteration** - `liveAgent.ts` already iterates over `result.steps`
   to extract patches. We extend this to capture the full step data.

### Simplifications

1. **Reuse prompts data** - The wire format includes system/prompt which overlaps with
   existing `context` section. We can either:
   - Keep both (wire is complete, context is convenient shorthand)
   - Remove context in favor of wire (breaking change, not recommended)

   **Decision:** Keep both. Wire is for comprehensive capture; context is for quick
   reference. They should match.

2. **Skip tool results for declarative tools** - The `generatePatches` tool is
   declarative (no execute function), so `toolResults` will be empty for it. Other
   tools (like web search) have actual results to capture.

3. **No separate wire format file** - Wire format is embedded in session YAML, not
   a separate file. This keeps everything in one place for easy diffing.

### Implementation Phases

**Phase 1: Define Types (TDD: Write Tests First)**

- [ ] Add `WireFormat` interface to `harnessTypes.ts`
- [ ] Add `WireRequestFormat` and `WireResponseFormat` sub-interfaces
- [ ] Add `wire?: WireFormat` to `TurnStats`
- [ ] Write unit test: `WireFormat` interface matches expected structure
- [ ] Run tests (expect fail), implement, run tests (expect pass)

**Phase 2: Update Session Types**

- [ ] Add `wire?: WireFormat` to `SessionTurn` in `coreTypes.ts`
- [ ] Add `WireFormatSchema` Zod schema for validation
- [ ] Update `SessionTurnSchema` to include optional `wire` field
- [ ] Write unit test: Session with wire format parses correctly
- [ ] Write unit test: Session without wire format still parses (backward compat)
- [ ] Run tests, implement, verify

**Phase 3: Capture Wire Format in LiveAgent**

- [ ] Add `extractToolSchemas()` helper function
- [ ] Add `sortObjectKeys()` helper for deterministic ordering
- [ ] Capture wire format after `generateText()` in `generatePatches()`
- [ ] Add wire format to returned `TurnStats`
- [ ] Write unit test: `generatePatches()` returns wire format in stats
- [ ] Write integration test: Wire format contains expected request/response structure
- [ ] Run tests, implement, verify

**Phase 4: Flow Through Harness and Serialize**

- [ ] Update `Harness.recordTurn()` to include wire format in SessionTurn
- [ ] Update `serializeSession()` to handle wire format serialization
- [ ] Update `parseSession()` to handle wire format parsing
- [ ] Write unit test: Session round-trips with wire format intact
- [ ] Write unit test: Wire format YAML is deterministically ordered
- [ ] Run tests, implement, verify

**Phase 5: Regenerate Golden Tests and Validate**

- [ ] Run `pnpm test:golden:regen` to regenerate session files with wire format
- [ ] Review diffs to verify wire format content is correct and stable
- [ ] Run `pnpm test:golden` twice to verify identical output (stability)
- [ ] Commit regenerated session files
- [ ] Document wire format in session file header comments

## Stage 4: Validation Stage

### Test Plan

**1. Unit Tests** (`tests/unit/harness/wireFormat.test.ts`):

- `WireFormat` type validation with Zod schema
- `extractToolSchemas()` extracts description and inputSchema
- `sortObjectKeys()` produces deterministic ordering
- Wire format round-trips through YAML serialization
- Session with wire format parses correctly
- Session without wire format parses correctly (backward compat)

**2. Integration Tests**:

- `LiveAgent.generatePatches()` returns wire format in TurnStats
- Wire format contains system prompt, context prompt, tool schemas
- Wire format contains all steps with tool calls
- Wire format usage matches result.usage

**3. Stability Tests**:

- Run mock session twice, verify identical wire format output
- Change prompt text, verify it appears in wire format diff
- Change tool schema, verify it appears in wire format diff

**4. Golden Test Validation**:

- Regenerate all session files with wire format
- Verify all golden tests pass
- Review diffs to ensure wire format content is complete and correct

### Success Criteria

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Wire format is deterministically ordered (no random key ordering)
- [ ] Mock sessions produce identical wire format on repeated runs
- [ ] Existing session files without wire format remain valid
- [ ] Golden tests pass after regeneration
- [ ] Error messages appear in wire format prompts as expected
- [ ] Tool schemas are captured in wire format for diffing

### Manual Testing

1. Run `pnpm markform fill examples/simple/simple.form.md --mock`
2. Inspect generated session file for wire format section
3. Verify system prompt, context prompt, and tool schemas are present
4. Verify steps contain tool calls with input data
5. Change an error message in `liveAgent.ts`, regenerate, verify diff shows change

## References

- Current session types: `packages/markform/src/engine/coreTypes.ts`
- Current session serialization: `packages/markform/src/engine/session.ts`
- Live agent implementation: `packages/markform/src/harness/liveAgent.ts`
- Harness recording: `packages/markform/src/harness/harness.ts`
- Golden test runner: `packages/markform/tests/golden/runner.ts`
- Vercel AI SDK generateText: [ai-sdk.dev/docs/reference/ai-sdk-core/generate-text](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text)
- AI SDK GitHub: [github.com/vercel/ai](https://github.com/vercel/ai)
