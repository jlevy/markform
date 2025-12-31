# Plan: Enhanced Session Golden Tests with Full LLM Wire Format

## Purpose

This is a technical design doc for enhancing the golden test session logging to capture
the complete wire format of LLM interactions, enabling comprehensive regression testing
and prompt engineering visibility.

## Background

### What Are Session Golden Tests?

Session golden tests are a powerful testing methodology that captures the complete
execution trace of an agent session and replays it for verification. This approach:

1. **Records everything** - All input, output, and intermediate states are serialized
2. **Enables diffing** - Changes between test runs are visible through version control
3. **Catches regressions** - Any change to LLM prompts, error messages, or behavior is
   immediately detected
4. **Documents behavior** - Session files serve as living documentation of system behavior

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

This captures the **semantic** content but not the **exact wire format**.

### What's Missing

The current approach does NOT capture:

1. **Raw JSON tool calls** - The exact JSON sent to/from the LLM via Vercel AI SDK
2. **Multi-step tool execution** - Each step in `result.steps` with intermediate results
3. **LLM text responses** - Any text output from the model between tool calls
4. **Exact error messages** - The precise validation error strings the LLM sees when
   patches fail

## Summary of Task

Enhance the session logging to include a **transparent wire format view** alongside the
existing clean YAML representation. This enables:

1. **Exact regression detection** - Any change to prompt format, error messages, or tool
   schemas is immediately visible in diffs
2. **Prompt engineering visibility** - Engineers can see exactly what the LLM receives
   and responds with
3. **Error message improvement** - Iterate on validation error messages by seeing exactly
   what the LLM sees and how it responds
4. **Complete audit trail** - Every aspect of LLM interaction is captured for debugging

### Key Example: Validation Error Messages

When an agent sends invalid patches (wrong field type, invalid column IDs, etc.), the
system returns error messages to help the agent correct its mistakes. Currently, these
errors are constructed in `buildContextPrompt()`:

```typescript
// In liveAgent.ts
if (previousRejections && previousRejections.length > 0) {
  lines.push('# Previous Patch Errors');
  lines.push('');
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

1. See the **exact** error message text the LLM receives
2. Review how well the LLM understands and corrects from these errors
3. Iterate on error message wording to improve agent recovery
4. Detect any regressions in error message format through diffs

## The Session Testing Methodology

### Principles

1. **Capture everything** - The session log should contain all information needed to
   understand and reproduce the LLM interaction

2. **Make it diffable** - Changes between sessions should be meaningful and reviewable
   through git diffs

3. **Keep it stable** - Avoid capturing non-deterministic fields (timestamps, UUIDs) that
   would cause false-positive test failures

4. **Two levels of detail** - Provide both a clean semantic view (current YAML) and a raw
   wire format view (new JSON)

### Why This Matters

Consider this scenario:

- Engineer changes an error message from "Invalid field type" to "Expected set_number for
  field 'age', got set_string"
- Without wire format logging: The change is invisible to tests, might improve or degrade
  agent behavior without anyone knowing
- With wire format logging: The exact text change appears in the git diff, can be reviewed
  and correlated with any changes in agent success rates

This methodology turns the session log into a **single source of truth** for all LLM
interactions, enabling systematic improvement of prompts and error handling.

## Stage 1: Planning Stage

### What to Capture (Vercel AI SDK Format)

The Vercel AI SDK's `generateText` function returns a structured result:

```typescript
const result = await generateText({
  model: this.model,
  system: systemPrompt,     // Capture this
  prompt: contextPrompt,    // Capture this
  tools,
  stopWhen: stepCountIs(this.maxStepsPerTurn),
});

// result.steps contains the full execution trace:
for (const step of result.steps) {
  step.toolCalls     // Array of { toolName, input, ... }
  step.toolResults   // Array of { toolName, result, ... }
  step.text          // Any text output
}

// result.usage contains token counts:
result.usage.inputTokens
result.usage.outputTokens
```

### Proposed Enhanced Session Format

Add a new `wire` section to each turn with the raw JSON:

```yaml
turns:
  - turn: 1
    # Existing clean semantic view (unchanged)
    inspect:
      issues: [...]
    apply:
      patches: [...]
      rejected_patches: [...]
    after:
      required_issue_count: 2
      markdown_sha256: <hash>
      answered_field_count: 10

    # NEW: Raw wire format (Vercel AI SDK format)
    wire:
      request:
        system: |
          You are a form-filling agent...
        prompt: |
          # Current Form State
          ...
          # Remaining Issues
          ...
        tools:
          generatePatches:
            description: "..."
            inputSchema: { ... }
      response:
        steps:
          - tool_calls:
              - tool_name: generatePatches
                input: { patches: [...] }
            tool_results:
              - tool_name: generatePatches
                result: { ... }  # or null for declarative tools
            text: null  # or any model text
        usage:
          input_tokens: 1234
          output_tokens: 567
```

### Stability Considerations

Fields that must be **excluded or normalized** to avoid test churn:

| Field | Stability Issue | Solution |
|-------|----------------|----------|
| Timestamps | Changes every run | Omit entirely |
| Request IDs | Changes every run | Omit entirely |
| Token counts | May vary slightly | Include (deterministic with same input) |
| Tool schemas | Zod descriptions change | Include (want to catch changes) |
| Prompt text | Changes intentionally | Include (want to catch changes) |

The goal is that re-running a mock session with the same mock agent should produce
**identical** session files, while changes to prompts/schemas are detected.

### Implementation Approach

1. **Extend TurnStats** - Add raw request/response data to the stats passed through the
   harness

2. **Extend SessionTurn** - Add optional `wire` section to the turn structure

3. **Capture in LiveAgent** - Serialize the request and response in `generatePatches()`

4. **Serialize carefully** - Ensure JSON is deterministically ordered and formatted

5. **Test the tests** - Verify that mock sessions are stable across runs

## Stage 2: Architecture Stage

### Current Data Flow

```
LiveAgent.generatePatches()
  ↓ builds systemPrompt, contextPrompt
  ↓ calls generateText(...)
  ↓ extracts patches from result.steps
  ↓ builds TurnStats with usage, prompts
  ↓
programmaticFill()
  ↓ receives patches and stats
  ↓ passes to harness.apply()
  ↓
Harness.apply()
  ↓ records turn via recordTurn()
  ↓ includes stats in SessionTurn
  ↓
SessionTranscript
  ↓ serialized to YAML
```

### Where to Add Wire Format Capture

**Option A: Extend TurnStats (Recommended)**

Add wire format to the existing `TurnStats` interface:

```typescript
// In harnessTypes.ts
export interface TurnStats {
  inputTokens?: number;
  outputTokens?: number;
  toolCalls: { name: string; count: number }[];
  prompts?: { system: string; context: string };

  // NEW: Raw wire format
  wire?: {
    request: {
      system: string;
      prompt: string;
      tools: Record<string, { description: string; inputSchema: unknown }>;
    };
    response: {
      steps: Array<{
        toolCalls: Array<{ toolName: string; input: unknown }>;
        toolResults: Array<{ toolName: string; result: unknown }>;
        text: string | null;
      }>;
      usage: { inputTokens: number; outputTokens: number };
    };
  };
}
```

**Benefits:**

- Minimal changes to data flow
- Wire format flows through existing plumbing
- Can be conditionally included based on recording mode

**Option B: Separate capture in harness**

Have the harness capture wire format directly via callbacks. More invasive, less clean.

### Files to Modify

| File | Changes |
|------|---------|
| `src/harness/harnessTypes.ts` | Extend TurnStats with wire format |
| `src/harness/liveAgent.ts` | Capture and return wire format |
| `src/engine/coreTypes.ts` | Extend SessionTurn with wire section |
| `src/engine/session.ts` | Handle wire format in serialization |
| `tests/golden/runner.ts` | Verify or skip wire format in replay |

### Serialization Format

Use JSON within YAML for the wire format:

```yaml
wire:
  request: |
    {
      "system": "You are a form-filling agent...",
      "prompt": "# Current Form State\n...",
      "tools": {
        "generatePatches": {
          "description": "...",
          "inputSchema": { ... }
        }
      }
    }
  response: |
    {
      "steps": [...],
      "usage": { "inputTokens": 1234, "outputTokens": 567 }
    }
```

Or use YAML flow style for cleaner diffs:

```yaml
wire:
  request:
    system: "You are a form-filling agent..."
    prompt: "# Current Form State\n..."
    tools:
      generatePatches: { description: "...", inputSchema: {...} }
  response:
    steps: [...]
    usage: { input_tokens: 1234, output_tokens: 567 }
```

**Decision:** Use YAML flow style (second option) for human readability while maintaining
diffability.

## Stage 3: Refine Architecture

### Reusable Components

1. **Existing session serialization** (`session.ts`) - Already handles snake_case
   conversion and YAML output

2. **Existing TurnStats flow** - Already captures prompts, just need to extend

3. **Existing callback infrastructure** - Could use onLlmCallEnd to capture wire format

### Configuration

Add a flag to control wire format capture:

```typescript
// In harness config
interface HarnessConfig {
  // ... existing fields
  captureWireFormat?: boolean;  // Default false for production, true for golden tests
}
```

Or enable automatically when in `mock` mode (golden tests always use mock mode).

### Implementation Phases

**Phase 1: Extend Types**

1. Add `WireFormat` interface to `harnessTypes.ts`
2. Add optional `wire` field to `TurnStats`
3. Add optional `wire` field to `SessionTurn`
4. Update Zod schemas in `coreTypes.ts`

**Phase 2: Capture in LiveAgent**

1. Extract tool schemas for wire format
2. Capture result.steps with tool calls and results
3. Return wire format in TurnStats

**Phase 3: Flow Through Harness**

1. Pass wire format through `harness.apply()`
2. Include in `recordTurn()`
3. Serialize in session output

**Phase 4: Update Golden Test Infrastructure**

1. Regenerate session files with wire format
2. Verify mock sessions are stable
3. Update test comparison logic (optional: skip wire comparison for now)

**Phase 5: Documentation and Validation**

1. Document wire format in session file comments
2. Verify error messages appear correctly
3. Create example of iterating on error message text

## Benefits

1. **Complete visibility** - See exactly what the LLM receives and responds with

2. **Regression detection** - Any change to prompts, schemas, or error messages is
   captured in diffs

3. **Prompt engineering** - Iterate on prompts with confidence, seeing exact effects

4. **Error message improvement** - Tune validation error messages by seeing agent response

5. **Debugging** - When a session fails, the full wire format is available for analysis

6. **Documentation** - Session files document the exact API contract with the LLM

## Testing

1. **Stability test** - Run mock session twice, verify identical output

2. **Regression test** - Change error message text, verify it appears in session diff

3. **Completeness test** - Verify wire format captures all steps, tool calls, results

4. **Golden test update** - Regenerate all session files, review diffs

## References

- Current session types: `src/engine/coreTypes.ts`
- Current session serialization: `src/engine/session.ts`
- Live agent implementation: `src/harness/liveAgent.ts`
- Harness recording: `src/harness/harness.ts`
- Golden test runner: `tests/golden/runner.ts`
- Vercel AI SDK types: `node_modules/ai/dist/index.d.ts`
- Related spec: `docs/project/specs/active/plan-2025-12-30-unified-fill-logging.md`
