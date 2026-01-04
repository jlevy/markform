# Plan Spec: Agent CLI Logging Improvements

## Purpose

This is a technical design doc for improving the logging and CLI experience when running
markform agents. The goal is to provide:

1. **Comprehensive logging levels** - From basic console output to full wire format capture
2. **Library-first design** - Callbacks that work for both CLI and programmatic TypeScript usage
3. **Enhanced console experience** - Better progress display with tool details and web search summaries

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

1. **Default (no flags)**: Rich output suitable for interactive use:
   - Model and provider info at start
   - Turn numbers with issues list
   - Tool calls with start notification, query, timing, and duration
   - Web search: query, result count, timing, and source summary
   - First 5-8 result titles from web search
   - Token counts per turn
   - Patches generated with field IDs and values
   - Patch validation warnings/errors
   - Tool summary at end of turn
   - Completion status

2. **Verbose (`--verbose`)**: Operational details for debugging:
   - Everything from default
   - Harness configuration (maxTurns, maxPatches, targetRoles, fillMode)
   - Detailed issue breakdown by field/group
   - Full web search result details (all titles, snippets, URLs)
   - Patch application details (accepted, rejected, reasons)
   - Field validation details (which validators ran, pass/fail)
   - Form progress stats (answered, skipped, remaining by priority)

3. **Debug (`--debug` or `LOG_LEVEL=debug`)**: Full diagnostic output:
   - Everything from verbose
   - Full system and context prompts each turn
   - Raw tool inputs and outputs (truncated at 500 chars)
   - LLM response steps and reasoning
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

### Library-First Callback Design

The logging system must work for both CLI and programmatic TypeScript usage. The `FillCallbacks`
interface should be rich enough that library users can build their own logging/progress UIs.

**Extended Callback Information:**

```typescript
interface FillCallbacks {
  // Existing callbacks (unchanged signature)
  onTurnStart?(turn: { turnNumber: number; issuesCount: number }): void;
  onIssuesIdentified?(info: { turnNumber: number; issues: InspectIssue[] }): void;
  onPatchesGenerated?(info: { turnNumber: number; patches: Patch[]; stats?: TurnStats }): void;
  onTurnComplete?(progress: TurnProgress): void;

  // Enhanced tool callbacks with richer information
  onToolStart?(call: {
    name: string;
    input: unknown;
    // NEW: Structured input for known tool types
    toolType?: 'web_search' | 'fill_form' | 'custom';
    query?: string;  // For web search tools
  }): void;

  onToolEnd?(call: {
    name: string;
    output: unknown;
    durationMs: number;
    error?: string;
    // NEW: Structured output for known tool types
    toolType?: 'web_search' | 'fill_form' | 'custom';
    resultCount?: number;  // For web search: number of results
    sources?: string;  // For web search: source domains (e.g., "imdb.com, wikipedia.org")
    topResults?: string;  // For web search: first 5-8 result titles with "..."
    fullResults?: Array<{ index: number; title: string; url: string; snippet?: string }>;
  }): void;

  onLlmCallStart?(call: { model: string }): void;
  onLlmCallEnd?(call: { model: string; inputTokens: number; outputTokens: number }): void;
}
```

**Library Usage Example:**

```typescript
import { fillForm } from 'markform';

const result = await fillForm({
  form: markdown,
  model: 'anthropic/claude-sonnet-4-5',
  enableWebSearch: true,
  captureWireFormat: false,
  callbacks: {
    onTurnStart: ({ turnNumber }) => {
      myLogger.info(`Starting turn ${turnNumber}`);
    },
    onToolStart: ({ name, query }) => {
      if (query) {
        myProgressUI.showSearching(query);
      }
    },
    onToolEnd: ({ name, resultCount, sources, topResults, durationMs }) => {
      if (resultCount !== undefined) {
        myProgressUI.showResults(`${resultCount} results (${durationMs}ms)`);
        if (sources) myLogger.info(`Sources: ${sources}`);
        if (topResults) myLogger.debug(`Top results: ${topResults}`);
      }
    },
    onPatchesGenerated: ({ patches, stats }) => {
      myLogger.info(`Generated ${patches.length} patches`);
      if (stats?.inputTokens) {
        myMetrics.recordTokens(stats.inputTokens, stats.outputTokens);
      }
    },
  },
});
```

### Enhanced Console Progress Display

The CLI should show better real-time progress, especially for tool execution:

**Default Mode (rich output for interactive use):**
```
Model: openai/gpt-5-mini (provider: openai)
Turn 1: 5 issue(s): directors (missing), full_title (missing), ...
  [web_search] "Pulp Fiction 1994 movie details"
  ✓ web_search: 8 results (1.2s)
     Sources: imdb.com, wikipedia.org, rottentomatoes.com
     Results: "Pulp Fiction (1994) - IMDb", "Pulp Fiction - Wikipedia", ...
  → 5 patches (tokens: ↓1234 ↑567):
    full_title (string) = "Pulp Fiction"
    year (number) = 1994
    directors (string_list) = [Quentin Tarantino]
    ...
  Tools: web_search(1), fill_form(1)
Turn 2: 3 issue(s): ...
  ...
  ✓ Complete
⏰ Research time: 45.2s
```

**Verbose Mode (operational details):**
```
Model: openai/gpt-5-mini (provider: openai)
Harness: maxTurns=100, maxPatches=10, targetRoles=[agent], fillMode=continue
Turn 1: 5 issue(s): directors (missing), full_title (missing), ...
  Issues by group: movie_info(3), credits(2)
  [web_search] "Pulp Fiction 1994 movie details"
  ✓ web_search: 8 results (1.2s)
     Sources: imdb.com, wikipedia.org, rottentomatoes.com
     [1] "Pulp Fiction (1994) - IMDb" - imdb.com/title/tt0110912
     [2] "Pulp Fiction - Wikipedia" - en.wikipedia.org/wiki/Pulp_Fiction
     [3] "Pulp Fiction - Rotten Tomatoes" - rottentomatoes.com/m/pulp_fiction
     ... (5 more)
  → 5 patches (tokens: ↓1234 ↑567):
    full_title (string) = "Pulp Fiction" [accepted]
    year (number) = 1994 [accepted]
    directors (string_list) = [Quentin Tarantino] [accepted]
    invalid_field (string) = "test" [rejected: field not found]
    ...
  Validators: url_validator(2 passed), required(5 passed)
  Progress: 5 answered, 0 skipped, 12 remaining (3 high, 5 medium, 4 low)
  Tools: web_search(1), fill_form(1)
```

**Debug Mode (full diagnostic):**
```
Model: openai/gpt-5-mini (provider: openai)
Harness: maxTurns=100, maxPatches=10, targetRoles=[agent], fillMode=continue
Turn 1: 5 issue(s): directors (missing), full_title (missing), ...
  ─── System Prompt ───
  You are a research assistant...
  ─── Context Prompt ───
  # Current Form State
  ...
  [web_search] "Pulp Fiction 1994 movie details"
     Input: { query: "Pulp Fiction 1994 movie details" }
  ✓ web_search: 8 results (1.2s)
     Output: { results: [...], total: 8 } ...[truncated]
  → 5 patches (tokens: ↓1234 ↑567):
    ...
```

**Key Console Improvements:**
1. Default shows model info, token counts, tool summaries, and result titles
2. Default shows patch validation warnings/errors inline
3. Use limited indicators: ✓ (success), ❌ (error), → (result), [tool_name] for tool calls
4. Verbose adds harness config, full result listings, patch accept/reject details, validator info
5. Debug adds full prompts and raw tool inputs/outputs (truncated at 500 chars)

## Backward Compatibility

**Compatibility Level:** Minor Enhancement (More Informative Default Output)

| Area | Impact |
| --- | --- |
| CLI | New optional flags (`--debug`, `--wire-log`); existing flags unchanged |
| Default behavior | Enhanced with tool call details (more informative, same structure) |
| Verbose behavior | Enhanced with additional details beyond new default |
| API | `FillCallbacks` interface extended with optional fields |

**Default Behavior Changes:**
- Now shows tool call names, queries, and timing (previously only in verbose)
- Same turn-by-turn structure
- Same exit codes
- Same output file handling

**Use `--quiet` for minimal output** (unchanged behavior)

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
- [ ] Unified logging callback system across `fill`, `research`, and `run` commands
- [ ] Library-friendly callbacks with structured tool information (query, resultCount, sources, topResults)
- [ ] Default mode: model info, tool calls, result titles, token counts, tool summary, patch warnings
- [ ] Verbose mode: harness config, full result listings, patch accept/reject, validator details
- [ ] Debug mode via `--debug` flag or `LOG_LEVEL=debug` environment variable
- [ ] `--wire-log <path>` flag to capture full wire format to YAML

**Should Have:**
- [ ] Consistent spinner/progress behavior across commands
- [ ] Limited visual indicators per CLI best practices (✓ ❌ → [tool])
- [ ] Form progress stats in verbose mode (answered, skipped, remaining by priority)

**Won't Have (This Phase):**
- JSON streaming output format (separate feature)
- Progress bars instead of spinners
- Real-time log streaming to external services
- Custom tool type registration (use 'custom' type for now)

### Acceptance Criteria

**CLI Behavior:**

1. Running `markform research <form> --model <model>` (default mode) shows:
   - Model and provider info at start
   - Turn numbers with issues list
   - Tool calls with name and query (`[web_search] "query"`)
   - Tool completion with result count, timing, source domains, and first 5-8 titles
   - Token counts per turn
   - Patches generated with field IDs and values
   - Patch validation warnings/errors
   - Tool summary at end of turn
   - Total timing

2. Running with `--verbose` additionally shows:
   - Harness configuration (maxTurns, maxPatches, targetRoles, fillMode)
   - Issues breakdown by group
   - Full web search result listings (all titles, snippets, URLs)
   - Patch accept/reject status with reasons
   - Validator execution details
   - Form progress stats (answered, skipped, remaining by priority)

3. Running with `--debug` or `LOG_LEVEL=debug` additionally shows:
   - Full system prompt each turn
   - Full context prompt each turn
   - Raw tool inputs (before execution)
   - Raw tool outputs (truncated at 500 chars)

4. Running with `--wire-log session.yaml` produces a YAML file containing:
   - `request.system`: Full system prompt
   - `request.prompt`: Full context prompt
   - `request.tools`: Tool schemas
   - `response.steps`: All tool calls and results
   - `response.usage`: Token counts

5. All commands (`fill`, `research`, `run`) produce identical logging for the same operations

**Library API:**

6. `fillForm()` accepts callbacks with structured tool information:
   ```typescript
   onToolStart: ({ name, query }) => { /* query available for web search */ }
   onToolEnd: ({ name, resultCount, resultSummary }) => { /* structured results */ }
   ```

7. Library users can implement their own progress UI using callbacks alone (no CLI dependencies)

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

    onToolStart: ({ name, query }) => {
      if (level === 'quiet') return;
      // DEFAULT: Show tool name and query
      const queryStr = query ? ` "${query}"` : '';
      logInfo(ctx, `  [${name}]${queryStr}`);
      options.spinner?.message(`${name}...`);
      // DEBUG: Show full input
      if (level === 'debug') {
        logDebug(ctx, `     Input: ${summarize(input, DEBUG_OUTPUT_TRUNCATION_LIMIT)}`);
      }
    },

    onToolEnd: ({ name, resultCount, sources, topResults, fullResults, durationMs, error }) => {
      if (level === 'quiet') return;
      if (error) {
        logInfo(ctx, `  ❌ ${name} failed (${durationMs}ms): ${error}`);
        return;
      }
      // DEFAULT: Show result count, timing, sources, and top results
      const countStr = resultCount !== undefined ? `${resultCount} results` : 'done';
      logInfo(ctx, `  ✓ ${name}: ${countStr} (${formatDuration(durationMs)})`);
      if (sources) {
        logInfo(ctx, `     Sources: ${sources}`);
      }
      if (topResults) {
        logInfo(ctx, `     Results: ${topResults}`);
      }
      // VERBOSE: Show full result listings
      if ((level === 'verbose' || level === 'debug') && fullResults) {
        for (const result of fullResults) {
          logVerbose(ctx, `     [${result.index}] "${result.title}" - ${result.url}`);
        }
      }
      // DEBUG: Show raw output (truncated)
      if (level === 'debug') {
        logDebug(ctx, `     Output: ${summarize(output, DEBUG_OUTPUT_TRUNCATION_LIMIT)}`);
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
| `src/harness/harnessTypes.ts` | Extend `FillCallbacks` with structured tool fields |
| `src/harness/liveAgent.ts` | Extract and pass structured tool info to callbacks |
| `src/cli/lib/cliTypes.ts` | Add `LogLevel`, `debug` to `CommandContext` |
| `src/cli/lib/shared.ts` | Add `logDebug()`, update `getCommandContext()` |
| `src/cli/lib/fillLogging.ts` | Enhance callbacks for all log levels, add emoji output |
| `src/cli/lib/toolParsing.ts` | NEW: Helper to extract web search queries and results |
| `src/cli/cli.ts` | Add `--debug` and `--wire-log` global options |
| `src/cli/commands/fill.ts` | Wire up `--wire-log`, use unified callbacks |
| `src/cli/commands/research.ts` | Use unified callbacks, add wire log support |
| `src/cli/commands/run.ts` | Use unified callbacks |
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

### Phase 1: Enhanced Callback Types

- [ ] Extend `FillCallbacks.onToolStart` with `toolType`, `query` fields
- [ ] Extend `FillCallbacks.onToolEnd` with `toolType`, `resultCount`, `resultSummary` fields
- [ ] Add helper to extract structured info from web search tool inputs/outputs
- [ ] Update `liveAgent.ts` to populate structured fields in callbacks

### Phase 2: Logging Infrastructure

- [ ] Add `DEBUG_OUTPUT_TRUNCATION_LIMIT = 500` to `settings.ts`
- [ ] Add `LogLevel` type and `debug` flag to `CommandContext`
- [ ] Add `logDebug()` function to `shared.ts`
- [ ] Update `getCommandContext()` to compute `logLevel` from flags and `LOG_LEVEL` env var
- [ ] Add `--debug` and `--wire-log <path>` to global CLI options
- [ ] Enhance `createFillLoggingCallbacks()` with log level awareness

### Phase 3: Command Integration

- [ ] Update `fill.ts` to use `createFillLoggingCallbacks()` consistently
- [ ] Update `research.ts` to use `createFillLoggingCallbacks()`
- [ ] Update `run.ts` to use `createFillLoggingCallbacks()`
- [ ] Add wire log output writing after fill completes
- [ ] Ensure consistent behavior across all commands

### Phase 4: Web Search Result Parsing

- [ ] Add `extractWebSearchResults()` helper to parse provider responses
- [ ] Extract result count from all providers (OpenAI, Anthropic, Google, XAI)
- [ ] Extract source domains from URLs (e.g., "imdb.com, wikipedia.org")
- [ ] Extract first 5-8 result titles with "..." for additional results
- [ ] Handle provider-specific response structures gracefully

### Phase 5: Testing and Documentation

- [ ] Add unit tests for logging utilities
- [ ] Add unit tests for structured callback extraction
- [ ] Test all three log levels with example forms
- [ ] Verify wire log output format matches schema
- [ ] Update CLI help text and development.md
- [ ] Add library usage examples to documentation

## Resolved Design Decisions

1. **Wire log format**: Extend `SessionTranscript` with wire format data
   - **Decision**: Unify with golden test transcript format
   - Reuse `SessionTranscript` schema, include wire format in each turn
   - Ensure tool call details are captured (inputs, outputs, timing)
   - Same format works for `--wire-log`, `--transcript`, and golden tests

2. **Debug output truncation**: Truncate at configurable limit
   - **Decision**: 500 chars with "...[truncated]" suffix
   - Add `DEBUG_OUTPUT_TRUNCATION_LIMIT = 500` to `settings.ts`

3. **Environment variable**: `LOG_LEVEL=debug`
   - **Decision**: `LOG_LEVEL` is fine
   - Must have equivalent semantics to `--debug` flag
   - Values: `quiet`, `default`, `verbose`, `debug`

4. **Web search result extraction**: Show first 5-8 result titles/domains
   - **Decision**: Extract titles and domains from all providers
   - All providers (OpenAI, Anthropic, Google, XAI) return structured results with titles/URLs
   - Show: "Sources: IMDb, Wikipedia, ..." (domains extracted from URLs)
   - Show: "Title 1, Title 2, Title 3, ..." (first 5-8 titles, then "...")
   - Provider-specific parsing is feasible - all return `title` and `url` fields

5. **Emoji usage**: Follow CLI best practices - limited emoji set
   - **Decision**: Use only approved emojis per `typescript-cli-tool-rules.md`:
     - ✅ for success (or ✓ checkmark)
     - ❌ for failure/error
     - ⚠️ for warnings
     - ⏰ for timing information
   - Avoid excessive emojis like 🔍 - use text labels instead
   - picocolors handles TTY detection automatically

6. **Callback backward compatibility**: No backward compat needed
   - **Decision**: Clean break - design for future, not past
   - New callback fields are required, not optional
   - This is a hard cut

7. **Progress without spinner**: Use log lines for non-TTY
   - **Decision**: Non-TTY environments get regular log lines
   - `createNoOpSpinner()` already handles quiet/non-TTY
   - Progress shown via `logInfo()` calls instead of spinner updates

## Stage 5: Validation Stage

_(To be filled after implementation)_

- [ ] All acceptance criteria verified
- [ ] No regressions in existing behavior
- [ ] Wire log format documented
- [ ] CLI help updated
