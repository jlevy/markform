# Feature: Fix Tool Error Handling and Parallel Provider Support

**Date:** 2026-02-17 (last updated 2026-02-17)

**Author:** Claude (agent)

**Status:** Approved

**Issues:** [#153](https://github.com/jlevy/markform/issues/153),
[#154](https://github.com/jlevy/markform/issues/154)

## Overview

Two bugs affecting the form-filling harness when tools error and when custom providers
are used in parallel execution:

1. **Issue #153**: When a tool’s `execute()` throws during multi-step LLM interaction,
   the AI SDK constructs a `tool_result` with `is_error: true` and potentially empty
   content. The Anthropic API rejects this with HTTP 400.

2. **Issue #154**: When `fillForm()` runs with `enableParallel: true` and a custom
   `ProviderAdapter`, the provider’s tools (e.g., web search) are not passed to parallel
   sub-agents. The `providerTools` parameter is passed in the serial path but omitted
   from the `fillFormParallel()` function signature and `createAgentForExecution()`
   call.

## Goals

- Ensure tool execution errors never produce empty `tool_result` content that Anthropic
  rejects
- Ensure parallel sub-agents receive the same provider tools as serial agents
- Add tests for both bugs following TDD methodology
- Maintain backward compatibility with all existing behavior

## Non-Goals

- Changing the AI SDK’s internal error handling
- Adding new providers or provider features
- Modifying the parallel execution architecture

## Background

### Issue #153: Empty tool_result

The `wrapTool()` function in `liveAgent.ts` (lines 670-741) wraps tool `execute()`
functions with callback instrumentation.
When the original `execute()` throws, the error is re-thrown at line 737. The Vercel AI
SDK catches this and constructs a `tool_result` message with `is_error: true` to send
back to the LLM. If the error message is empty or the SDK sends empty content, the
Anthropic API returns HTTP 400: `content cannot be empty if is_error is true`.

This affects any tool with an `execute()` function (web search, custom tools), not the
declarative `fill_form` tool.

### Issue #154: Missing providerTools in parallel path

In `programmaticFill.ts`, the serial agent creation (line 573-584) passes
`providerTools` to `createLiveAgent()`. However, `fillFormParallel()` (line 833+) is
called without `providerTools` as a parameter (line 536-548), so it’s not in scope.
The `createAgentForExecution()` helper (lines 855-871) therefore cannot pass it to
`createLiveAgent()`.

This means custom `ProviderAdapter` tools (e.g., web search from DeepInfra) are silently
lost for parallel sub-agents.

## Design

### Approach

#### Fix #153: Re-throw tool errors with guaranteed non-empty message

In `wrapTool()`, catch errors and re-throw with a guaranteed non-empty message.
This preserves the AI SDK’s proper error handling path — the SDK catches thrown errors,
sends them as `tool_result` with `is_error: true`, and the Anthropic provider uses
`getErrorMessage(error)` to extract `error.message` as the content string.

The root cause is that when a tool throws `new Error('')` or `new Error()`, the SDK’s
`getErrorMessage()` returns an empty string, producing `is_error: true` with empty
content — which the Anthropic API rejects.

**In `liveAgent.ts` `wrapTool()`:**

```typescript
// Before:
} catch (error) {
  // ... callbacks ...
  throw error;  // May re-throw Error('') → empty content with is_error: true
}

// After:
} catch (error) {
  // ... callbacks ...
  const message =
    (error instanceof Error ? error.message : String(error)) || 'Tool call failed';
  throw new Error(message);  // Guaranteed non-empty → safe for Anthropic API
}
```

This ensures:
- The error message is always non-empty (falls back to `'Tool call failed'`)
- The AI SDK’s `is_error: true` semantics are preserved (errors stay as errors)
- The LLM correctly sees the tool result as failed, not successful
- SDK telemetry/tracing correctly classifies errors

#### Fix #154: Pass providerTools through parallel path

Add `providerTools` as a parameter to `fillFormParallel()` and thread it through to
`createAgentForExecution()` → `createLiveAgent()`.

**In `programmaticFill.ts`:**

1. Add `providerTools` parameter to `fillFormParallel()` function signature
2. Pass `providerTools` in the `fillFormParallel()` call from `fillForm()`
3. Pass `providerTools` to `createLiveAgent()` in `createAgentForExecution()`

### Components

| File | Change |
| --- | --- |
| `src/harness/liveAgent.ts` | `wrapTool()`: re-throw with guaranteed non-empty message |
| `src/harness/programmaticFill.ts` | `fillFormParallel()`: add and pass `providerTools` |
| `tests/unit/harness/liveAgent.test.ts` | Add tests for tool error handling |
| `tests/unit/harness/programmaticFill.test.ts` | Add tests for providerTools in parallel |

### API Changes

None. Both fixes are internal behavior changes with no public API modifications.

## Implementation Plan

### Phase 1: Fix tool error handling and parallel provider tools

- [x] Write failing test for #153: tool error throws with non-empty message
- [x] Fix `wrapTool()` in `liveAgent.ts` to re-throw with guaranteed non-empty message
- [x] Write failing test for #154: parallel agents receive providerTools
- [x] Fix `fillFormParallel()` to accept and pass `providerTools`
- [x] Run full test suite and quality gates
- [x] Update golden tests if needed (none needed)

## Testing Strategy

- **Unit tests**: Add tests in `liveAgent.test.ts` verifying that `wrapTool()` re-throws
  with guaranteed non-empty messages
- **Unit tests**: Add tests in `programmaticFill.test.ts` verifying that parallel agents
  receive `providerTools`
- **Existing tests**: Ensure all existing tests continue to pass (golden tests,
  tryscript, unit tests)
- **Type checking**: Ensure no type errors introduced

## Open Questions

None - both fixes are straightforward with clear root causes.

## References

- [Issue #153](https://github.com/jlevy/markform/issues/153): Empty tool_result with
  is_error=true causes Anthropic API 400 rejection
- [Issue #154](https://github.com/jlevy/markform/issues/154): Parallel sub-agents fail
  for custom ProviderAdapter models (serialization)
- `packages/markform/src/harness/liveAgent.ts` — Tool wrapping and error re-throw
- `packages/markform/src/harness/programmaticFill.ts` — Serial vs parallel agent
  creation
