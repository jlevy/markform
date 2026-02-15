---
created_at: 2026-02-15T01:54:38.167Z
dependencies: []
id: is-01khfg3hyrgqj1za2bac11acmn
kind: feature
labels: []
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-14-tiered-validation-model.md
status: open
title: Two-tier validation model (instant vs deferred) with consistent issue surfacing across CLI and API
type: is
updated_at: 2026-02-15T06:33:29.135Z
version: 6
---
## Problem

`markform set` silently accepts semantically invalid values (e.g., lowercase ticker against a pattern constraint), printing only "Form updated" with no indication anything is wrong. The invalid value enters the form and is only caught later by `markform validate`.

More broadly, the spec groups all semantic checks together regardless of cost, and the CLI surfaces issues inconsistently across commands.

## Design (two-tier model)

Replace the current two-phase model with two tiers based on cost:

- **Instant validation** (~0ms, during `applyPatches()`) — structural failures reject the batch; constraint failures (pattern, min/max, required, etc.) accept the patch and surface issues in `ApplyResult.issues`
- **Deferred validation** (ms-seconds, during `validate()`/`inspect()`) — code validators, LLM validators, cross-field checks; must be explicitly triggered

## Changes needed

1. CLI `set`: Remove `validation_error` filter — surface ALL issue reasons
2. `FillResult.remainingIssues`: Align type with `InspectIssue[]`
3. `InspectIssue`: Add `deferred?: boolean` flag
4. Update spec Layer 4 with two-tier model

## References

- GitHub issue: https://github.com/jlevy/markform/issues/145
- Plan spec: `docs/project/specs/active/plan-2026-02-14-tiered-validation-model.md`

## Notes

GitHub issue: https://github.com/jlevy/markform/issues/145
