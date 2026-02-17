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

#### Fix #153: Catch tool errors and return as result

Instead of re-throwing errors in `wrapTool()`, catch them and return a descriptive error
string. This makes the AI SDK send a normal `tool_result` (without `is_error: true`) so
the LLM sees the error message as a result and can adapt.

**In `liveAgent.ts` `wrapTool()`:**

```typescript
// Before (line 722-737):
} catch (error) {
  // ... callbacks ...
  throw error;  // AI SDK catches this → is_error: true → may be empty
}

// After:
} catch (error) {
  // ... callbacks ...
  const errorMessage = error instanceof Error ? error.message : String(error);
  return `Tool error: ${errorMessage || 'Tool call failed'}`;
}
```

This ensures:
- The error message is always non-empty
- The AI SDK sends it as a normal result, not `is_error: true`
- The LLM can see and react to the error

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
| `src/harness/liveAgent.ts` | `wrapTool()`: return error string instead of throwing |
| `src/harness/programmaticFill.ts` | `fillFormParallel()`: add and pass `providerTools` |
| `tests/unit/harness/liveAgent.test.ts` | Add tests for tool error handling |
| `tests/unit/harness/programmaticFill.test.ts` | Add tests for providerTools in parallel |

### API Changes

None. Both fixes are internal behavior changes with no public API modifications.

## Implementation Plan

### Phase 1: Fix tool error handling and parallel provider tools

- [ ] Write failing test for #153: tool error produces non-empty result (not throw)
- [ ] Fix `wrapTool()` in `liveAgent.ts` to return error string instead of throwing
- [ ] Write failing test for #154: parallel agents receive providerTools
- [ ] Fix `fillFormParallel()` to accept and pass `providerTools`
- [ ] Run full test suite and quality gates
- [ ] Update golden tests if needed

## Testing Strategy

- **Unit tests**: Add tests in `liveAgent.test.ts` verifying that `wrapTool()` returns
  error strings instead of throwing
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
