---
created_at: 2026-02-15T01:54:38.167Z
dependencies: []
id: is-01khfg3hyrgqj1za2bac11acmn
kind: feature
labels: []
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-14-tiered-validation-model.md
status: open
title: set command should surface semantic validation issues and spec should distinguish eager vs deferred validation
type: is
updated_at: 2026-02-15T03:18:11.120Z
version: 4
---
## Notes

## Problem

`markform set` silently accepts semantically invalid values (e.g., lowercase ticker against `pattern="^[A-Z]{1,5}$"`), printing only "Form updated" with no indication anything is wrong. The invalid value enters the form and is only caught later by `markform validate`. This surprises both agents and users, who reasonably expect "set succeeded" to mean "value is valid."

## Root cause

The spec (Layer 4) defines two-phase patch validation:

1. **Structural** (pre-apply): field exists, type matches, option ID valid — rejects on failure
2. **Semantic** (post-apply): pattern, range, required, selection counts — accepts value, returns issues

All semantic checks are grouped together and none block writes. But this conflates two very different cost profiles:

- **Fast deterministic checks** (~0ms): pattern regex, min/max, integer, date format, minLength/maxLength, minItems, uniqueItems
- **Expensive checks** (ms-seconds): code validators via jiti, LLM validators (MF/0.2), cross-field validation, external API calls

The fast checks have no reason to be deferred. The expensive checks genuinely must be.

## Proposed changes

**Short-term (CLI UX fix):** `set` should surface post-apply semantic issues in its console output, e.g.: "Form updated (1 issue: Ticker Symbol does not match required pattern)". No spec change needed — ApplyResult already returns issues.

**Longer-term (spec refinement):** Formalize a three-tier validation model:

- Structural: field exists, type shape, option ID valid (~0ms) — pre-apply, reject
- Eager semantic: pattern, min/max, integer, date format, length/item constraints (~0ms) — at-apply, reject or warn
- Deferred semantic: code validators, LLM validators, cross-field checks (ms-seconds) — post-apply only, return as issues

Open design question: should eager semantic failures reject the write (clean invariant: all values in form pass deterministic constraints) or warn (accept + surface issues, preserving "write first, fix later" workflow)? Consider whether this should be configurable per-constraint or per-field.

## Notes

GitHub issue: https://github.com/jlevy/markform/issues/145
