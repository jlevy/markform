---
title: Tiered Validation Model
description: Formalize two-tier validation with consistent surfacing across CLI and API
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: Tiered Validation Model

**Date:** 2026-02-14 (last updated 2026-02-14)

**Author:** Joshua Levy

**Status:** Draft

**Bead:** mf-mhsi

**GitHub issue:** https://github.com/jlevy/markform/issues/145

## Overview

Formalize a two-tier validation model in the Markform spec (instant vs deferred) and
ensure consistent issue surfacing across all interfaces (CLI commands, TypeScript API,
programmatic fill).

The current spec defines two validation phases (structural and semantic), but all
semantic checks are grouped together regardless of cost.
This conflates fast deterministic checks (~0ms: regex, min/max) with potentially
expensive ones (ms-seconds: code validators, LLM validators).
The CLI surfaces issues inconsistently across commands, and the API returns issues in
slightly different shapes depending on which function you call.

## Goals

- Define a clear two-tier validation model in the spec (instant vs deferred)
- Fold fast deterministic checks into instant validation alongside structural checks
- Ensure consistent issue surfacing across CLI and API
- Maintain backward compatibility with existing forms and workflows

## Non-Goals

- LLM validators (MF/0.2 scope — this spec only defines the tier they’ll slot into)
- Cross-field validation (future work — will use the deferred tier)
- Changes to the priority scoring system (P1-P5 is working well)

## Background

### Current state

The spec (Layer 4) defines two-phase patch validation:

1. **Structural** (pre-apply): field exists, type matches, option ID valid — rejects on
   failure
2. **Semantic** (post-apply): pattern, range, required, selection counts — accepts
   value, returns issues

All semantic checks are grouped together and none block writes.

### Problem

This conflates two very different cost profiles:

| Check type | Examples | Cost |
| --- | --- | --- |
| Fast deterministic | pattern regex, min/max, integer, date format, minLength/maxLength, minItems, uniqueItems | ~0ms |
| Expensive/external | code validators (.valid.ts), LLM validators (MF/0.2), cross-field validation, external API calls | ms-seconds |

The fast checks have no reason to be deferred.
The expensive checks genuinely must be.

### CLI inconsistencies

| Command | How issues are surfaced | Gap |
| --- | --- | --- |
| `validate` | Full issue list with priorities | Good |
| `inspect` | Full issue list with form content | Good |
| `set` | Only `validation_error` issues via `logWarn`; other reasons filtered out | Partial |
| `fill` | Per-turn issue count; final status | OK but minimal |
| `fillForm()` API | `remainingIssues` in FillResult when incomplete | OK but type is a subset of InspectIssue |
| `applyPatches()` API | `ApplyResult.issues` always returned | Good |

The `set` command currently filters to only `validation_error` reason and logs via
`logWarn`. It misses `required_missing`, `checkbox_incomplete`, and `min_items_not_met`.

## Design

### Two-Tier Validation Model

Replace the current two-phase model with two tiers based on cost:

| Tier | Name | Cost | When | Behavior |
| --- | --- | --- | --- | --- |
| **Instant** | Instant validation | ~0ms | During `applyPatches()` | Always runs; structural failures reject, constraint failures surface as issues |
| **Deferred** | Deferred validation | ms-seconds | During `validate()` / `inspect()` | Must be explicitly triggered |

#### Instant validation

All checks that execute in ~0ms run during `applyPatches()`. Within instant validation,
there are two failure modes — but they are not separate tiers, just different outcomes
of the same phase:

**Structural failures — reject the patch:**

- Field ID does not exist in schema
- Option ID does not exist for referenced field
- Value shape does not match expected type (e.g., `number` for `set_number`)
- Transaction semantics: if any patch fails structurally, the entire batch is rejected

These represent patches that are impossible to apply.
The form is unchanged.
Reported via `ApplyResult.rejectedPatches`.

**Constraint failures — accept the patch, surface as issues:**

- `pattern` — regex match
- `min` / `max` — numeric/date range
- `integer` — integer constraint
- `minLength` / `maxLength` — string length
- `minItems` / `maxItems` — list/select item count
- `uniqueItems` — list uniqueness
- `minSelections` / `maxSelections` — multi-select count
- Date format validation (ISO 8601)
- URL format validation
- `required` — required field missing value

These represent patches that CAN be applied but where the value violates a constraint.
The value is written to the form and issues are returned in `ApplyResult.issues`. This
preserves the “write first, fix later” workflow while making problems visible.

#### Deferred validation

Expensive checks that are NOT run during `applyPatches()`. Must be triggered explicitly
by calling `validate()` or `inspect()`:

- Code validators (`.valid.ts` files loaded via jiti)
- LLM validators (MF/0.2 — future)
- Cross-field validation (future)
- External API validation (future)

The current `skipCodeValidators` flag already implements this behavior —
`applyPatches()` passes `skipCodeValidators: true` to its internal `validate()` call.

### Consistent issue surfacing across interfaces

#### Principle: Same data model, channel-appropriate presentation

All interfaces should return the same `InspectIssue[]` data.
Presentation differs by channel but the underlying data model is identical.

| Interface | Issue representation | Change needed |
| --- | --- | --- |
| TypeScript API (`applyPatches`) | `ApplyResult.issues: InspectIssue[]` | None (already correct) |
| TypeScript API (`fillForm`) | `FillResult.remainingIssues` | Align type with `InspectIssue[]` |
| CLI `set` (default) | stderr warnings | Show ALL issue reasons, not just `validation_error` |
| CLI `set --report` | Full report | None (already correct) |
| CLI `validate` | Full issue list | None (already correct) |
| CLI `inspect` | Full issue list | None (already correct) |
| CLI `fill` | Per-turn summary + final | None (already correct) |

#### Specific changes

**1. CLI `set` command — surface all issues**

Current (`set.ts` lines 334-342):

```ts
const validationIssues = applyResult.issues.filter(
  (i) => i.reason === 'validation_error',
);
```

Proposed: Remove the filter.
Show all issues from `applyResult.issues`:

```ts
if (applyResult.issues.length > 0) {
  for (const issue of applyResult.issues) {
    logWarn(ctx, `${issue.ref}: ${issue.message}`);
  }
}
```

Include issue count in success message:

```
Form updated: form.md (2 issues)
```

**2. `FillResult.remainingIssues` — align with `InspectIssue`**

Current type (in `harnessTypes.ts`):

```ts
remainingIssues?: {
  ref: string;
  message: string;
  severity: 'required' | 'recommended';
  priority: number;
}[];
```

This is a subset of `InspectIssue` (missing `scope`, `reason`, `blockedBy`). Change to
`InspectIssue[]` for full consistency.
Callers who want the subset can destructure.
Having the full type means no information loss at the API boundary.

**3. `InspectIssue` — add `deferred` flag**

Add a flag to `InspectIssue` so callers can distinguish instant from deferred issues:

```ts
interface InspectIssue {
  ref: string;
  scope: IssueScope;
  reason: IssueReason;
  message: string;
  severity: 'required' | 'recommended';
  priority: number;
  blockedBy?: Id;
  deferred?: boolean;  // NEW: true for deferred validation issues
}
```

The `deferred` field is optional for backward compatibility.
When `true`, it indicates the issue came from deferred validation (code validators,
etc.). When absent or `false`, the issue is from instant validation.

### Spec changes

The following section of the Markform spec needs updating:

**Layer 4, “Patch validation layers”** (currently lines 3031-3066 of
`docs/markform-spec.md`):

Replace the current two-phase description with the two-tier model:

1. **Instant validation** (~0ms, during `applyPatches()`) — structural failures reject;
   constraint failures accept + surface
2. **Deferred validation** (ms-seconds, during `validate()`/`inspect()`) — code
   validators, LLM validators, cross-field checks

Add a table listing which checks are instant vs deferred.

Add a note that `applyPatches()` runs only instant validation by default, and deferred
validation requires explicit `validate()` or `inspect()`.

## Implementation Plan

### Phase 1: Spec and type changes

- [ ] Update `docs/markform-spec.md` Layer 4 validation section with two-tier model
- [ ] Add `deferred` flag to `InspectIssue` type in `coreTypes.ts`
- [ ] Annotate deferred validation issues with `deferred: true`
- [ ] Align `FillResult.remainingIssues` type with `InspectIssue[]`

### Phase 2: CLI consistency

- [ ] Fix `set` command to surface all issue reasons (remove `validation_error` filter)
- [ ] Add issue count to `set` success message
- [ ] Add tests for `set` issue surfacing (pattern failure, required missing, etc.)
- [ ] Verify `fill`, `validate`, `inspect` commands are consistent

### Phase 3: Architecture docs

- [ ] Update `docs/project/architecture/` design docs to reflect two-tier model
- [ ] Update any QA test playbooks that reference validation behavior

## Testing Strategy

- Unit tests: Verify `applyPatches()` returns issues with correct `deferred` flag
- Unit tests: Verify `set` command surfaces all issue reasons in console output
- Integration tests: End-to-end validation flow through CLI commands
- Golden tests: Verify output format consistency across commands
- Backward compatibility: Existing forms and patches continue to work without changes

## Open Questions

1. **Exit code for issues:** Should `set` return a non-zero exit code when issues exist
   (even though patches were applied)?
   This would make shell scripts aware of issues but changes current behavior where exit
   0 means “patches applied.”

2. **`FillResult` breaking change:** Changing `FillResult.remainingIssues` to
   `InspectIssue[]` is a minor breaking change for TypeScript consumers who destructure
   the current type. Acceptable if we document it in release notes.

3. **Partial apply + issues:** When `applyStatus: 'partial'` (some patches rejected,
   some applied), how should issues from the applied patches interact with the rejection
   report? Currently both are returned separately (`rejectedPatches` + `issues`), which
   is correct but may be confusing in CLI output.

## References

- GitHub issue: https://github.com/jlevy/markform/issues/145
- Bead: mf-mhsi ("set command should surface semantic validation issues")
- Markform spec Layer 4: `docs/markform-spec.md` (lines 3031-3066)
- Current validation code: `packages/markform/src/engine/apply.ts`, `validate.ts`,
  `inspect.ts`
- CLI set command: `packages/markform/src/cli/commands/set.ts` (lines 334-342)
