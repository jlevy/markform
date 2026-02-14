# Feature: fillForm Error Diagnostics and Callback Contract (#142)

**Date:** 2026-02-14 (last updated 2026-02-14)

**Author:** Codex (GPT-5)

**Status:** Implemented (pending merge)

## Overview

Issue #142 reports that `fillForm()` dropped structured error objects and only returned string
messages. This spec defines and records the landed fix (`FillStatus.error` + `onError` callback),
including follow-up validation and docs parity.

## Goals

- Preserve original `Error` objects for `reason: 'error'` outcomes in `FillResult.status`.
- Provide real-time error reporting through `FillCallbacks.onError` during fill-loop execution.
- Verify serial and parallel paths behave consistently.
- Align public API docs with the shipped TypeScript contract.

## Non-Goals

- Serializing full `Error` objects into `FillRecord` JSON sidecars.
- Changing retry policy or provider-specific error wrapping.
- Redesigning all callback contracts beyond `onError` behavior.

## Background

`fillForm()` can fail from agent/model/provider errors where the thrown object carries valuable
structured diagnostics (`cause`, `statusCode`, `responseBody`, `url`, etc.). Historically, only
`error.message` survived, which blocked root-cause diagnosis and structured programmatic handling.

Issue reference: <https://github.com/jlevy/markform/issues/142>

## Design

### Approach

Use additive, backward-compatible API extensions:

- `FillStatus` includes optional `error?: Error` when `reason === 'error'`.
- `FillCallbacks` includes optional `onError(error, { turnNumber })` invoked before returning the
  error result from the fill loop.
- Existing `message` and `statusDetail` behavior remains intact for compatibility.

### Components

- `packages/markform/src/harness/harnessTypes.ts`
  - `FillStatus` contract
  - `FillCallbacks` contract
- `packages/markform/src/harness/programmaticFill.ts`
  - serial and parallel catch paths
  - parse/model-resolution failure paths
- `packages/markform/tests/unit/harness/programmaticFill.test.ts`
  - status error preservation + callback semantics
- `packages/markform/docs/markform-apis.md`
  - public API docs for `FillStatus` and callback list

### API Changes

- Add `error?: Error` to `FillStatus` error variant.
- Add `onError?(error: Error, context: { turnNumber: number }): void` to `FillCallbacks`.

These are optional additions and remain backward-compatible for existing consumers.

## Implementation Plan

### Phase 1: Validate and Land Issue #142 Contract

- [x] Confirm all relevant failure paths preserve `Error` where available.
- [x] Confirm `onError` firing semantics in serial and parallel loops.
- [x] Add/adjust tests for any uncovered behavior regressions.
- [x] Update API docs to include `FillStatus.error` and `onError` callback.
- [x] Run targeted quality gates and finalize bead/issue status updates.

## Testing Strategy

- Unit tests for:
  - serial agent throw -> `status.error` preserved, `onError` called once with turn context
  - parallel item throw -> status + callback semantics preserved
  - pre-fill parse/model resolution throws -> `status.error` preserved
- Regression tests ensure non-Error thrown values remain handled safely.

## Rollout Plan

- No migration required (additive API changes).
- Release notes should mention enhanced error diagnostics for `fillForm()` consumers.

## Open Questions

- Should `onError` also fire for pre-fill setup failures (parse/model/input context), or remain
  fill-loop-only?
- Should a future schema-safe `errorSummary` object be added to `FillRecord` for offline analysis?

## References

- GitHub issue: <https://github.com/jlevy/markform/issues/142>
