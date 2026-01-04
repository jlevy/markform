# Plan Spec: Agent CLI Logging Improvements

## Purpose

This is a technical design doc for improving the logging and CLI experience when running the
research agent harness. The goal is to provide more comprehensive and flexible logging at
varying levels, from basic console output to full wire format session capture.

## Background

**Current State:**

Markform provides several agent execution commands (`fill`, `research`, `run`) that produce
turn-by-turn console output showing:
- Turn numbers with issues list
- Patches generated per turn with field IDs and values
- Completion status

The current logging infrastructure includes:
- `--verbose` flag: Shows token counts, tool calls, full prompts (system + context)
- `--quiet` flag: Suppresses non-essential output
- `--record` / `--transcript` flags: Saves session transcript to YAML file

However, there are gaps in the current implementation:

1. **Inconsistent logging levels**: The `research` command has different logging behavior
   than `fill`, and the callback system isn't consistently wired up across commands.

2. **Limited verbose output**: While `--verbose` shows prompts, it doesn't show:
   - Web search results and queries
   - Tool inputs/outputs with timing
   - Detailed patch validation errors

3. **No wire format capture flag**: The `captureWireFormat` option exists in the API but
   isn't exposed as a CLI flag. This data is valuable for debugging and understanding
   the exact prompts sent to the LLM.

4. **Session logging isn't integrated with verbose**: The `--transcript` flag saves
   session data, but there's no way to capture the full wire format (LLM request/response)
   without modifying the code.

**Related Docs:**
- [development.md](../../development.md) - CLI commands and conventions
- [arch-markform-design.md](../architecture/current/arch-markform-design.md.md)

## Summary of Task

Improve agent CLI logging with three levels of output and better wire format capture:

### Logging Levels

1. **Default (no flags)**: Current behavior - turn numbers, issues, patches, completion

2. **Verbose (`--verbose`)**: Enhanced verbose output including:
   - Token counts per turn
   - Tool call start/end with timing and duration
   - Web search queries and result summaries
   - Patch validation warnings/errors
   - LLM model info

3. **Debug (`--debug` or `LOG_LEVEL=debug`)**: Full diagnostic output including:
   - Everything from verbose
   - Full system and context prompts each turn
   - Tool inputs and outputs
   - Detailed patch application results

### Wire Format Capture

Add `--wire-log <path>` flag to capture the complete wire format session to a YAML file:
- Complete LLM request/response for each turn
- Tool schemas sent to the model
- All tool calls and their inputs/outputs
- Token usage statistics

This is distinct from `--transcript` which captures a lighter session summary without
the full wire format data.

### CLI Flag Design

```
markform fill <file> --model <model>
markform research <file> --model <model>
markform run

New flags:
  --verbose        Enhanced output with timing, tokens, tool details
  --debug          Full diagnostic output (or LOG_LEVEL=debug)
  --wire-log <path>  Capture full wire format session to YAML file
```

**Environment Variables:**
- `LOG_LEVEL=debug`: Alternative to `--debug` flag
- `MARKFORM_WIRE_LOG=<path>`: Alternative to `--wire-log` flag

## Backward Compatibility

**Compatibility Level:** Fully Backward Compatible (Additive Only)

| Area | Impact |
| --- | --- |
| CLI | New optional flags; existing flags unchanged |
| Default behavior | No changes to default output |
| Verbose behavior | Enhanced (more info) but still respects `--verbose` |
| API | `FillCallbacks` interface unchanged |

**Default Behavior (unchanged):**
- Same turn-by-turn output format
- Same exit codes
- Same output file handling

## Stage 1: Planning Stage

### Current Implementation Analysis

**Files involved:**
- `src/cli/lib/shared.ts` - Core logging utilities (`logInfo`, `logVerbose`, `logError`)
- `src/cli/lib/fillLogging.ts` - `createFillLoggingCallbacks()` factory
- `src/cli/lib/fillCallbacks.ts` - Tool-specific callbacks for spinner updates
- `src/cli/commands/fill.ts` - Fill command implementation with inline logging
- `src/cli/commands/research.ts` - Research command with different logging pattern
- `src/harness/harnessTypes.ts` - `FillCallbacks` interface, `TurnStats`, `WireFormat`
- `src/harness/liveAgent.ts` - Wire format capture in `buildWireFormat()`
- `src/engine/session.ts` - Session serialization

**Current callback flow:**
1. `fill.ts` creates inline callbacks and tool callbacks
2. `research.ts` doesn't use the callback system (uses `runResearch` directly)
3. `createFillLoggingCallbacks()` provides standard callbacks but isn't used by `research`

**Wire format capture:**
- `captureWireFormat` option exists in `FillOptions`
- Wire format is built in `liveAgent.ts::buildWireFormat()`
- Includes: system prompt, context prompt, tool schemas, LLM response steps
- Currently only used for golden tests (when `captureWireFormat: true`)

### Feature Requirements

**Must Have:**
- [ ] Unified logging callback system across `fill` and `research` commands
- [ ] `--verbose` enhanced with tool timing and token counts
- [ ] `--wire-log <path>` flag to capture full wire format to YAML
- [ ] Debug mode via `--debug` flag or `LOG_LEVEL=debug` environment variable

**Should Have:**
- [ ] Web search result summaries in verbose mode
- [ ] Patch validation error details in verbose mode
- [ ] Consistent spinner behavior across commands

**Won't Have (This Phase):**
- JSON streaming output format (separate feature)
- Progress bars instead of spinners
- Real-time log streaming to external services

### Acceptance Criteria

1. Running `markform research <form> --model <model> --verbose` shows:
   - All default output (turn, issues, patches)
   - Token counts per turn
   - Tool call names with timing (e.g., "web_search completed in 1.2s")
   - Model and provider info at start

2. Running with `--debug` or `LOG_LEVEL=debug` additionally shows:
   - Full system prompt each turn
   - Full context prompt each turn
   - Tool inputs/outputs (summarized for large responses)

3. Running with `--wire-log session.yaml` produces a YAML file containing:
   - `request.system`: Full system prompt
   - `request.prompt`: Full context prompt
   - `request.tools`: Tool schemas
   - `response.steps`: All tool calls and results
   - `response.usage`: Token counts

4. Both `fill` and `research` commands produce identical logging for the same operations

## Stage 2: Architecture Stage

### Logging Level Implementation

Add a `LogLevel` enum to `src/cli/lib/cliTypes.ts`:

```typescript
export type LogLevel = 'quiet' | 'default' | 'verbose' | 'debug';

export interface CommandContext {
  dryRun: boolean;
  verbose: boolean;
  quiet: boolean;
  debug: boolean;  // NEW
  logLevel: LogLevel;  // NEW (computed from flags)
  format: OutputFormat;
  formsDir?: string;
  overwrite: boolean;
}
```

Derive `logLevel` from flags in `getCommandContext()`:
- `--quiet` → `'quiet'`
- No flags → `'default'`
- `--verbose` → `'verbose'`
- `--debug` or `LOG_LEVEL=debug` → `'debug'`

### Unified Callback System

Refactor `createFillLoggingCallbacks()` to accept `LogLevel` and provide appropriate
output for each level:

```typescript
export function createFillLoggingCallbacks(
  ctx: CommandContext,
  options: FillLoggingOptions = {},
): FillCallbacks {
  const level = ctx.logLevel;

  return {
    onIssuesIdentified: ({ turnNumber, issues }) => {
      if (level === 'quiet') return;
      logInfo(ctx, `Turn ${turnNumber}: ${formatTurnIssues(issues)}`);
    },

    onToolStart: ({ name, input }) => {
      if (level === 'quiet') return;
      if (name.includes('search')) {
        options.spinner?.message(`Web search...`);
      }
      if (level === 'verbose' || level === 'debug') {
        logVerbose(ctx, `  Tool ${name} started`);
      }
      if (level === 'debug') {
        logDebug(ctx, `  Input: ${summarize(input)}`);
      }
    },

    onToolEnd: ({ name, output, durationMs, error }) => {
      if (level === 'quiet') return;
      if (level === 'verbose' || level === 'debug') {
        if (error) {
          logVerbose(ctx, `  Tool ${name} failed (${durationMs}ms): ${error}`);
        } else {
          logVerbose(ctx, `  Tool ${name} completed (${durationMs}ms)`);
        }
      }
      if (level === 'debug' && output) {
        logDebug(ctx, `  Output: ${summarize(output)}`);
      }
    },

    // ... other callbacks
  };
}
```

### Wire Format Capture

Add `wireLogPath` option to pass through the fill flow:

1. CLI parses `--wire-log <path>` flag
2. Sets `captureWireFormat: true` in fill options
3. After fill completes, writes wire format to the specified path
4. Uses existing `serializeSession()` or new `serializeWireLog()` function

Wire log file structure:
```yaml
session_version: "0.1.0"
mode: live
model_id: "openai/gpt-5-mini"
turns:
  - turn: 1
    wire:
      request:
        system: "..."
        prompt: "..."
        tools: {...}
      response:
        steps: [...]
        usage:
          input_tokens: 1234
          output_tokens: 567
```

### Research Command Integration

Update `research.ts` to use the same callback system as `fill`:

```typescript
// Create callbacks same as fill command
const callbacks = createFillLoggingCallbacks(ctx, { spinner });

// Pass to runResearch options
const result = await runResearch(form, {
  model: modelId,
  enableWebSearch: true,
  captureWireFormat: !!options.wireLog,
  callbacks,
  // ... other options
});
```

This requires updating `ResearchOptions` to accept callbacks.

### File Changes Summary

| File | Changes |
| --- | --- |
| `src/cli/lib/cliTypes.ts` | Add `LogLevel`, `debug` to `CommandContext` |
| `src/cli/lib/shared.ts` | Add `logDebug()`, update `getCommandContext()` |
| `src/cli/lib/fillLogging.ts` | Enhance callbacks for all log levels |
| `src/cli/cli.ts` | Add `--debug` and `--wire-log` global options |
| `src/cli/commands/fill.ts` | Wire up `--wire-log`, use unified callbacks |
| `src/cli/commands/research.ts` | Use unified callbacks, add wire log support |
| `src/research/runResearch.ts` | Accept callbacks in options |

## Stage 3: Refine Architecture

### Reusable Components Found

1. **Existing callback system** (`FillCallbacks` in `harnessTypes.ts`)
   - Already supports all the hook points we need
   - `onToolStart`, `onToolEnd`, `onLlmCallStart`, `onLlmCallEnd` are already defined
   - Just need to wire them up consistently

2. **Existing wire format capture** (`buildWireFormat()` in `liveAgent.ts`)
   - Already builds complete wire format
   - Already captured in `TurnStats.wire`
   - Just need to expose via CLI flag

3. **Existing session serialization** (`serializeSession()` in `session.ts`)
   - Already handles YAML output with proper snake_case conversion
   - Can be used for wire log output

4. **Existing logging utilities** (`shared.ts`)
   - `logInfo`, `logVerbose`, `logError`, `logWarn` already exist
   - Just need to add `logDebug` and update context handling

### Simplifications

1. **No new callback interface** - Use existing `FillCallbacks`
2. **No new serialization** - Extend `SessionTranscript` or use same serializer
3. **Unified approach** - `research.ts` should use `fillForm()` or at minimum the same callback wiring

### Performance Considerations

- Wire format capture adds memory overhead (storing prompts/responses)
- Only enable when `--wire-log` is specified
- No performance impact on default or verbose modes

## Stage 4: Implementation Phase

### Phase 1: Unified Logging Infrastructure

- [ ] Add `LogLevel` type and `debug` flag to `CommandContext`
- [ ] Add `logDebug()` function to `shared.ts`
- [ ] Update `getCommandContext()` to compute `logLevel` from flags
- [ ] Add `--debug` and `--wire-log <path>` to global CLI options
- [ ] Enhance `createFillLoggingCallbacks()` with log level awareness

### Phase 2: Command Integration

- [ ] Update `fill.ts` to use `createFillLoggingCallbacks()` consistently
- [ ] Update `research.ts` to use `createFillLoggingCallbacks()`
- [ ] Add wire log output writing after fill completes
- [ ] Ensure spinner behavior is consistent across commands

### Phase 3: Testing and Documentation

- [ ] Add unit tests for logging utilities
- [ ] Test all three log levels with example forms
- [ ] Verify wire log output format matches schema
- [ ] Update CLI help text and development.md

## Open Questions

1. **Wire log format**: Should wire log be a separate file format or extend SessionTranscript?
   - Recommendation: Extend SessionTranscript with optional `wire` field per turn (already exists)

2. **Debug output volume**: How to summarize large tool outputs in debug mode?
   - Recommendation: Truncate to first 500 chars with "...[truncated]" suffix

3. **Environment variable naming**: `LOG_LEVEL` or `MARKFORM_LOG_LEVEL`?
   - Recommendation: `LOG_LEVEL` for simplicity (common convention)

## Stage 5: Validation Stage

_(To be filled after implementation)_

- [ ] All acceptance criteria verified
- [ ] No regressions in existing behavior
- [ ] Wire log format documented
- [ ] CLI help updated
