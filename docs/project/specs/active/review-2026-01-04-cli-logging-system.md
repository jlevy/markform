# Senior Engineering Review: CLI Logging System

**Date:** 2026-01-04
**PR:** #73 - feat(cli): Implement enhanced CLI logging with multiple log levels
**Reviewer:** Claude (Senior Engineering Review)

## Executive Summary

The logging system implementation is well-structured and provides a solid foundation. However, there are several issues that need attention to ensure the system works intuitively as both a CLI and library, with clear separation between logging modes.

**Overall Assessment:** Good implementation with architectural cleanup needed.

## Current Architecture

### Log Levels
- `quiet`: Only errors
- `default`: Turn info, tool calls, patches, completion status
- `verbose`: + harness config, full result listings, LLM metadata
- `debug`: + full prompts, raw tool I/O (truncated)

### Key Files
- `src/cli/lib/cliTypes.ts` - LogLevel type, CommandContext
- `src/cli/lib/shared.ts` - logDebug, logVerbose, logInfo, computeLogLevel
- `src/cli/lib/fillLogging.ts` - createFillLoggingCallbacks factory
- `src/cli/lib/fillCallbacks.ts` - createCliToolCallbacks (legacy)
- `src/harness/harnessTypes.ts` - FillCallbacks interface
- `src/harness/toolParsing.ts` - Structured tool output parsing
- `src/harness/liveAgent.ts` - Wire format capture

### Wire Format Capture
- `--wire-log <file>` flag captures full LLM request/response
- `MARKFORM_WIRE_LOG` environment variable support
- Session transcript includes wire data when captureWireFormat enabled

---

## Issues Identified

### Issue 1: Duplicate Logging Code in fill.ts (HIGH)

**Problem:** `fill.ts` has inline logging code (lines 486-530) that duplicates the functionality in `fillLogging.ts`. It uses `createCliToolCallbacks` from `fillCallbacks.ts` for spinner updates but then logs patches/stats manually.

**Impact:**
- Maintenance burden - changes must be made in two places
- Inconsistent output format between fill and research commands
- fillCallbacks.ts exists only for fill.ts and does less than fillLogging.ts

**Evidence:**
```typescript
// fill.ts lines 486-504 - manual patch logging
logInfo(ctx, `  → ${pc.yellow(String(patches.length))} patches${tokenSuffix}:`);
for (const patch of patches) {
  const typeName = formatPatchType(patch);
  // ...duplicates fillLogging.ts logic
}
```

**Recommendation:** Refactor fill.ts to use createFillLoggingCallbacks like research.ts does.

---

### Issue 2: run.ts Doesn't Pass Model Info to Callbacks (MEDIUM)

**Problem:** In run.ts line 363, `createFillLoggingCallbacks(ctx)` is called without the model/provider options, so the "Model: ..." line never appears.

**Evidence:**
```typescript
// run.ts line 363 - missing modelId and provider
const callbacks = createFillLoggingCallbacks(ctx);
```

Compared to research.ts:
```typescript
// research.ts line 177-181 - correct usage
const callbacks = createFillLoggingCallbacks(ctx, {
  spinner,
  modelId,
  provider,
});
```

**Recommendation:** Pass modelId to createFillLoggingCallbacks in run.ts.

---

### Issue 3: Missing Trace File Capability (HIGH - User Request)

**Problem:** User specifically requested "trace writing to a file capability" for incremental logging during execution. Current `--wire-log` only writes at the end of the session.

**Current Behavior:**
- `--wire-log` writes complete session at end
- No incremental output during long-running fills
- No way to monitor progress in real-time to a file

**Recommendation:** Add `--trace <file>` flag that appends log lines incrementally during execution. This is distinct from --wire-log which captures structured data.

---

### Issue 4: fillCallbacks.ts is Redundant (LOW)

**Problem:** `fillCallbacks.ts` provides `createCliToolCallbacks` which only implements onToolStart and onToolEnd for spinner updates. It does less than `createFillLoggingCallbacks` and is only used by fill.ts.

**Recommendation:** Delete fillCallbacks.ts after refactoring fill.ts to use fillLogging.ts.

---

### Issue 5: Debug Output Truncation Too Short (MEDIUM)

**Problem:** `DEBUG_OUTPUT_TRUNCATION_LIMIT = 500` in settings.ts may be too short for effective debugging of tool outputs.

**Recommendation:**
- Increase to 2000 or make configurable via environment variable
- Consider separate limits for prompts vs tool outputs

---

### Issue 6: Inconsistent Spinner Query Display (LOW)

**Problem:** Spinner updates for web search don't consistently show the query.

**Evidence:**
```typescript
// fillLogging.ts line 177 - shows query
options.spinner?.message(`Web search${queryText}...`);

// fillCallbacks.ts line 38 - doesn't show query
spinner.message(`🔍 Web search...`);
```

**Recommendation:** Standardize spinner messages to show query when available.

---

### Issue 7: Library Consumer Logging Unclear (MEDIUM)

**Problem:** While FillCallbacks is well-designed, there's no easy way for library consumers to get console logging without implementing all callbacks themselves.

**Recommendation:** Export a `createConsoleCallbacks()` helper from the library that provides default console logging (without CLI-specific features like spinners).

---

### Issue 8: Reasoning Tokens Not Displayed (LOW)

**Problem:** `onLlmCallEnd` callback receives `reasoningTokens` but it's not displayed anywhere in the logging output.

**Evidence:**
```typescript
// fillLogging.ts line 251 - reasoningTokens received but not shown
onLlmCallEnd: ({ model, inputTokens, outputTokens, reasoningTokens }) => {
  if (shouldShow(ctx, 'verbose')) {
    const reasoningInfo = reasoningTokens ? ` reasoning=${reasoningTokens}` : '';
    // reasoningInfo IS shown - this is actually fine
  }
}
```

Actually this is already implemented correctly. ✓

---

## Recommended Improvements

### Priority 1 (HIGH - Should Fix Before Merge)

1. **Unify fill.ts logging with fillLogging.ts**
   - Refactor fill.ts to use createFillLoggingCallbacks instead of manual logging
   - Remove createCliToolCallbacks and fillCallbacks.ts after migration

2. **Add --trace flag for incremental file logging**
   - New flag: `--trace <file>`
   - Appends log lines during execution (not just at end)
   - Useful for monitoring long-running fills

### Priority 2 (MEDIUM - Should Fix Soon)

3. **Pass model info in run.ts callbacks**
   - Update createFillLoggingCallbacks call to include modelId/provider

4. **Increase DEBUG_OUTPUT_TRUNCATION_LIMIT**
   - Change from 500 to 2000 characters
   - Consider MARKFORM_DEBUG_TRUNCATION_LIMIT env var

5. **Add library-friendly console callbacks**
   - Export createConsoleCallbacks() for library consumers

### Priority 3 (LOW - Nice to Have)

6. **Standardize spinner query display**
   - Always show query in spinner message when available

7. **Document logging levels in README/docs**
   - Add clear documentation of what each level shows

---

## Testing Recommendations

1. Add integration tests that verify output at each log level
2. Test trace file output with long-running fills
3. Test environment variable precedence (MARKFORM_LOG_LEVEL)
4. Verify fill/research/run commands produce consistent output

---

## Files to Modify

1. `src/cli/commands/fill.ts` - Refactor to use fillLogging.ts
2. `src/cli/commands/run.ts` - Pass model info to callbacks
3. `src/cli/lib/fillLogging.ts` - Add trace file support
4. `src/cli/lib/fillCallbacks.ts` - DELETE after migration
5. `src/settings.ts` - Increase truncation limit
6. `src/harness/programmaticFill.ts` - Export console callbacks helper
7. `docs/development.md` - Document logging levels

---

## Conclusion

The core logging architecture is sound. The main work is:
1. Consolidating duplicate code (fill.ts → fillLogging.ts)
2. Adding incremental trace file output
3. Minor consistency fixes

Estimated effort: 2-4 hours for Priority 1 items.
