# Feature Validation: Agent CLI Logging Improvements

## Purpose

This is a validation spec for the enhanced CLI logging system that provides:
- Multiple log levels (quiet, default, verbose, debug)
- Structured tool callback information (web search queries, results, sources)
- Wire format capture via `--wire-log` flag
- Unified logging callbacks across fill and research commands

**Feature Plan:** [plan-2026-01-04-agent-cli-logging-improvements.md](plan-2026-01-04-agent-cli-logging-improvements.md)

## Stage 4: Validation Stage

## Validation Planning

This PR implements the comprehensive logging improvements outlined in the plan spec.
All code changes have been reviewed, type-checked, linted, and tested.

## Automated Validation (Testing Performed)

### Unit Testing

- **fillLogging.test.ts** - 20 tests covering all logging callbacks:
  - `createFillLoggingCallbacks` returns all expected callbacks
  - `onIssuesIdentified` logs turn number and issues by default
  - `onIssuesIdentified` does not log when quiet mode is enabled
  - `onPatchesGenerated` logs patches with field IDs and values
  - `onPatchesGenerated` shows token counts in output
  - `onTurnComplete` logs completion status
  - `onToolStart` logs tool calls in default mode
  - `onToolStart` logs with query when provided
  - `onToolEnd` logs with formatted duration (seconds format)
  - `onToolEnd` logs errors with failure message
  - `onLlmCallStart` logs model name in verbose mode
  - `onLlmCallEnd` logs token counts in verbose mode
  - Spinner integration updates message for web search

### Integration Testing

- **Type checking passes** - All 0 TypeScript errors
- **Lint passes** - All 0 ESLint errors
- **1432 unit tests pass** - Full test suite green
- **Build succeeds** - dist/ output verified

### Code Quality Verification

All changes have been verified against the following quality gates:
- `npm run typecheck` - TypeScript strict mode
- `npm run lint` - ESLint with --max-warnings 0
- `npm run test` - Vitest full test suite
- `npm run build` - Production bundle

## Manual Testing Needed

### 1. Verify --debug Flag

Run with `--debug` flag to see enhanced output:

```bash
markform fill examples/movie-research/movie-research-demo.form.md \
  --model openai/gpt-5-mini \
  --debug
```

Verify:
- [ ] Debug messages appear in magenta color
- [ ] Raw tool input is shown after `[tool_name]` line
- [ ] Raw tool output is shown after completion
- [ ] System and context prompts are shown after patches

### 2. Verify --wire-log Flag

Run with `--wire-log` to capture wire format:

```bash
markform fill examples/movie-research/movie-research-demo.form.md \
  --model openai/gpt-5-mini \
  --wire-log /tmp/wire.yaml
```

Verify:
- [ ] `/tmp/wire.yaml` is created
- [ ] Contains `sessionVersion`, `mode`, `modelId`, `formPath`
- [ ] Contains `turns` array with `turn` number and `wire` data
- [ ] Wire data includes `request` with system/prompt and `response` with steps

### 3. Verify MARKFORM_LOG_LEVEL Environment Variable

```bash
MARKFORM_LOG_LEVEL=debug markform fill ... --model openai/gpt-5-mini
```

Verify:
- [ ] Debug output appears without needing --debug flag
- [ ] Setting to `verbose` shows verbose-level output
- [ ] Setting to `quiet` suppresses normal output

### 4. Verify MARKFORM_WIRE_LOG Environment Variable

```bash
MARKFORM_WIRE_LOG=/tmp/wire-env.yaml markform fill ... --model openai/gpt-5-mini
```

Verify:
- [ ] Wire log is created at specified path
- [ ] Works without --wire-log flag

### 5. Verify Tool Callback Output

Run a web search and verify structured output:

```bash
markform fill examples/movie-research/movie-research-demo.form.md \
  --model openai/gpt-5-mini
```

Verify in default mode:
- [ ] `[web_search] "query text"` shows query in yellow
- [ ] `✓ web_search: N results (Xs)` shows result count and duration
- [ ] `Sources: domain1.com, domain2.com` shows source domains
- [ ] `Results: "title1", "title2", ...` shows top result titles

Verify in verbose mode (`--verbose`):
- [ ] Full result listing shows `[1] "title" - url` format
- [ ] LLM call metadata shows model and tokens

### 6. Verify Research Command Integration

```bash
markform research examples/movie-research/movie-research-demo.form.md \
  --model openai/gpt-5-mini \
  --wire-log /tmp/research-wire.yaml
```

Verify:
- [ ] Same logging output format as fill command
- [ ] Wire log is created
- [ ] Callbacks show structured tool info

### 7. Verify Token Count Display

In default mode, patches line should show:
```
→ 2 patch(es) (tokens: ↓500 ↑100):
```

Verify:
- [ ] Token counts appear in dim text after patch count
- [ ] Format is `↓input ↑output`

## Files Changed

### New Files
- `src/harness/toolParsing.ts` - Web search result extraction utilities

### Modified Files
- `src/cli/lib/cliTypes.ts` - Added LogLevel type, debug property to CommandContext
- `src/cli/lib/shared.ts` - Added logDebug function, computeLogLevel helper
- `src/cli/cli.ts` - Added --debug global flag
- `src/cli/lib/fillLogging.ts` - Enhanced with LogLevel support, structured tool info
- `src/cli/commands/fill.ts` - Added --wire-log flag and env var support
- `src/cli/commands/research.ts` - Added --wire-log flag, unified callbacks
- `src/cli/commands/run.ts` - Updated CommandContext usage
- `src/harness/harnessTypes.ts` - Extended FillCallbacks with structured fields
- `src/harness/liveAgent.ts` - Updated wrapTool to use structured parsing
- `src/research/runResearch.ts` - Pass callbacks to agent
- `src/settings.ts` - Added DEBUG_OUTPUT_TRUNCATION_LIMIT constant
- `tests/unit/cli/fillLogging.test.ts` - Updated tests for new behavior

## Open Questions

1. Should `--wire-log` automatically enable `captureWireFormat` in fill command?
   (Currently it does, but user may want control)

2. Should token counts in default mode be opt-in via a separate flag?
   (Currently always shown when available)

3. Should reasoning tokens be displayed separately in verbose mode?
   (Currently included in onLlmCallEnd callback but not explicitly displayed)
