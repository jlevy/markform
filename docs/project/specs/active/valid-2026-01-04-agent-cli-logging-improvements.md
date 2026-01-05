# Feature Validation: Agent CLI Logging Improvements

## Purpose

This is a validation spec for the enhanced CLI logging system that provides:
- Multiple log levels (quiet, default, verbose, debug)
- Structured tool callback information (web search queries, results, sources)
- Wire format capture via `--wire-log` flag
- **Trace file support via `--trace` flag for incremental logging during execution**
- Unified logging callbacks across fill, research, and run commands
- Reasoning capture in wire format for models with extended thinking

**Feature Plan:** [plan-2026-01-04-agent-cli-logging-improvements.md](plan-2026-01-04-agent-cli-logging-improvements.md)

**Review Document:** [review-2026-01-04-cli-logging-system.md](review-2026-01-04-cli-logging-system.md)

## Stage 4: Validation Stage

## Validation Planning

This PR implements the comprehensive logging improvements outlined in the plan spec.
All code changes have been reviewed, type-checked, linted, and tested.

## Automated Validation (Testing Performed)

### Unit Testing

- **fillLogging.test.ts** - 14 tests covering all logging callbacks:
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
  - **Trace file tests** - createTracer writes header and strips ANSI codes

- **commands.tryscript.md** - 12 CLI command tests including:
  - `--help` shows all global options including `--debug` and `--trace`
  - All commands function correctly with updated option parsing

### Integration Testing

- **Type checking passes** - All 0 TypeScript errors
- **Lint passes** - All 0 ESLint errors
- **1455 unit tests pass** - Full test suite green
- **18 tryscript tests pass** - CLI command integration tests
- **Build succeeds** - dist/ output verified

### Code Quality Verification

All changes have been verified against the following quality gates:
- `pnpm run typecheck` - TypeScript strict mode
- `pnpm run lint` - ESLint with --max-warnings 0
- `pnpm run test` - Vitest full test suite
- `pnpm run test:tryscript` - CLI integration tests
- `pnpm run build` - Production bundle

## Manual Testing Completed (2026-01-05)

### Test Results Summary

| Test | Result | Notes |
|------|--------|-------|
| Default log level | ✅ PASS | Shows turns, patches, completion |
| --quiet flag | ⚠️ BUG | Session transcript still printed (markform-8) |
| --verbose flag | ✅ PASS | Shows config details, timing |
| --debug flag | ✅ PASS | Works (no extra output for mock agents) |
| --trace file | ✅ PASS | Creates file, correct content, no ANSI |
| ANSI stripping | ✅ PASS | No escape codes in trace files |
| Live agent | ⏳ BLOCKED | Network issues prevented API testing |

### 1. Verify --trace Flag for Fill Command

Run with `--trace` flag to capture incremental output to file:

```bash
markform fill examples/simple/simple.form.md \
  --mock --mock-source examples/simple/simple-mock-filled.form.md \
  --trace /tmp/fill-trace.log
```

Verify:
- [x] `/tmp/fill-trace.log` is created
- [x] File begins with header: `# Markform Trace Log`
- [x] Header includes timestamp and model info
- [x] Turn info is logged: `Turn 1: ...`
- [x] Patches are logged with field IDs and values
- [x] Completion status is logged: `Form completed in N turn(s)`
- [x] Output file path is logged
- [x] ANSI color codes are stripped (no escape sequences in file)

### 2. Verify --trace Flag for Run Command

```bash
markform run examples/simple/simple.form.md \
  --trace /tmp/run-trace.log
```

Verify:
- [ ] Trace file is created during form selection/execution
- [ ] Header format matches fill command
- [ ] All execution stages are logged

### 3. Verify --trace Flag for Research Command

```bash
markform research examples/movie-research/movie-research-demo.form.md \
  --model openai/gpt-5-mini \
  --trace /tmp/research-trace.log
```

Verify:
- [ ] Trace file is created
- [ ] Web search queries and results are logged
- [ ] Token counts are logged

### 4. Verify MARKFORM_TRACE Environment Variable

```bash
MARKFORM_TRACE=/tmp/env-trace.log markform fill examples/simple/simple.form.md \
  --mock --mock-source examples/simple/simple-mock-filled.form.md
```

Verify:
- [ ] Trace file is created at specified path
- [ ] Works without --trace flag
- [ ] `--trace` flag takes precedence over env var

### 5. Verify --debug Flag

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

### 6. Verify --wire-log Flag (REMOVED)

**Note:** The `--wire-log` flag has been removed per PR review feedback. All trace output now uses the global `--trace` flag for consistency.

### 7. Verify MARKFORM_LOG_LEVEL Environment Variable

```bash
MARKFORM_LOG_LEVEL=debug markform fill ... --model openai/gpt-5-mini
```

Verify:
- [ ] Debug output appears without needing --debug flag
- [ ] Setting to `verbose` shows verbose-level output
- [ ] Setting to `quiet` suppresses normal output

### 8. Verify Combined Flags

Test multiple flags together:

```bash
markform fill examples/movie-research/movie-research-demo.form.md \
  --model openai/gpt-5-mini \
  --trace /tmp/combined-trace.log \
  --wire-log /tmp/combined-wire.yaml \
  --debug
```

Verify:
- [ ] Both trace and wire log files are created
- [ ] Console shows debug output
- [ ] Trace file contains readable (non-colored) output
- [ ] Wire file contains YAML-formatted request/response data

### 9. Verify Tool Callback Output

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

### 10. Verify Token Count Display

In default mode, patches line should show:
```
→ 2 patch(es) (tokens: ↓500 ↑100):
```

Verify:
- [ ] Token counts appear in dim text after patch count
- [ ] Format is `↓input ↑output`

## Edge Cases and Error Handling

### Trace File Error Handling

- [ ] Invalid trace path (e.g., `/nonexistent/dir/trace.log`) shows warning but doesn't crash
- [ ] Read-only file system silently ignores write errors
- [ ] Very long lines are handled correctly

### Environment Variable Priority

- [ ] CLI flags take precedence over environment variables
- [ ] MARKFORM_TRACE + --trace: --trace wins
- [ ] MARKFORM_LOG_LEVEL + --debug: --debug wins

## Files Changed

### New Files
- `src/harness/toolParsing.ts` - Web search result extraction utilities

### Modified Files
- `src/cli/lib/cliTypes.ts` - Added LogLevel type, debug property, traceFile to CommandContext
- `src/cli/lib/shared.ts` - Added logDebug function, computeLogLevel helper, traceFile extraction
- `src/cli/cli.ts` - Added --debug and --trace global flags
- `src/cli/lib/fillLogging.ts` - Enhanced with LogLevel support, structured tool info, trace file support
- `src/cli/commands/fill.ts` - Added --wire-log flag, trace file support with createTracer helper
- `src/cli/commands/research.ts` - Added --wire-log flag, unified callbacks, traceFile support
- `src/cli/commands/run.ts` - Added --wire-log flag, transcript support via fillForm, traceFile support
- `src/harness/harnessTypes.ts` - Extended FillCallbacks with structured fields, added transcript to FillResult
- `src/harness/programmaticFill.ts` - Added transcript building when captureWireFormat is enabled
- `src/harness/liveAgent.ts` - Reasoning extraction, updated wrapTool for structured parsing
- `src/engine/coreTypes.ts` - Added WireReasoningContent type, reasoning field to WireResponseStep
- `src/research/runResearch.ts` - Pass callbacks to agent
- `src/settings.ts` - Added DEBUG_OUTPUT_TRUNCATION_LIMIT constant (increased to 2000)
- `tests/unit/cli/fillLogging.test.ts` - Updated tests for new behavior
- `tests/cli/commands.tryscript.md` - Updated to include --debug and --trace in help output
- `docs/development.md` - Added Log Levels and Wire Format Capture sections

## Potential Issues to Watch For

1. **Trace file size**: Long-running fills with verbose prompts could create large trace files
2. **File locking**: Concurrent writes to the same trace file are not protected
3. **Performance**: Synchronous file I/O for each trace line could slow down execution
4. **Unicode handling**: Complex characters in field values might not display correctly in trace

## Open Questions

1. Should `--wire-log` automatically enable `captureWireFormat` in fill command?
   (Currently it does, but user may want control)

2. Should token counts in default mode be opt-in via a separate flag?
   (Currently always shown when available)

3. Should reasoning tokens be displayed separately in verbose mode?
   (Currently included in onLlmCallEnd callback but not explicitly displayed)

4. Should trace file use async I/O to avoid blocking main execution?
   (Currently uses synchronous writeFileSync/appendFileSync)
