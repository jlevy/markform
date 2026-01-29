---
close_reason: null
closed_at: 2026-01-01T23:22:45.764Z
created_at: 2026-01-01T23:14:52.304Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.656Z
    original_id: markform-507
id: is-01kg3xaa3crfdvhmt75kpshjev
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Migrate codebase to use structured MarkformXxxError types
type: is
updated_at: 2026-01-01T23:22:45.764Z
version: 1
---
## Context

Commit 1cab6da added a structured error hierarchy (MarkformError, MarkformParseError, etc.) with type guards, but **none of these errors are actually being thrown** in the codebase.

## Current State

- ~40 places throw old `ParseError` (from parseHelpers.ts)  
- ~35 places throw generic `Error`
- 0 places throw the new structured errors

## Migration Tasks

1. **Replace old ParseError with MarkformParseError**
   - Delete `ParseError` class from parseHelpers.ts
   - Update all ~40 throw sites in parse.ts, parseFields.ts, parseSentinels.ts
   - Add source/line/column context where available

2. **Replace generic Error with appropriate typed errors**
   - Config validation → MarkformConfigError (settings.ts, modelResolver.ts)
   - LLM/API errors → MarkformLlmError (harness, agents)
   - Patch validation → MarkformPatchError (validate.ts)
   - Form abort → MarkformAbortError (already implied by abort_form)
   - Exhaustive checks → Keep as generic Error (unreachable code)

3. **Consider: Catch sites**
   - Update catch blocks to use type guards where beneficial
   - Document error handling patterns for consumers

## Not Included

Keep generic `throw new Error()` for:
- Exhaustive type checks (`Unhandled field kind`)
- Internal invariants/assertions
- Test setup failures
