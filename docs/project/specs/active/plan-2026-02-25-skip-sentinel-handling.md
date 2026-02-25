---
title: Skip Sentinel and Prompt Context Hygiene in LLM Fill Loops
description: Reduce skip/reject loops and prompt ambiguity by sanitizing sentinels and removing YAML front matter from model-visible form context
author: Codex (GPT-5)
---
# Feature: Skip Sentinel and Prompt Context Hygiene in LLM Fill Loops

**Date:** 2026-02-25 (last updated 2026-02-25)

**Author:** Codex (GPT-5)

**Status:** Draft

## Overview

Markform currently has a confusing split:
- Form serialization and docs use sentinel strings like `%SKIP%` and `%ABORT%`
- Patch application requires explicit meta operations (`skip_field`, `abort_field`)

In LLM fill loops, contradictory instructions and raw serialized form state can cause
models to emit `%SKIP%` in `set_*` patch values, which are then rejected.
This creates avoidable retry loops.

This plan assumes we control the downstream form authoring surface and can update forms
and role instructions directly.

Separately, the embedded literal form currently includes YAML front matter in
model-visible context.
We already inject role/form instructions into prompt body sections, so front matter
content can be redundant or confusing.
This plan verifies prompt body sufficiency and removes front matter from embedded form
context shown to agents.

## Goals

- Eliminate most `%SKIP%`/`%ABORT%` sentinel-in-value rejection loops caused by prompt
  text
- Establish one clear AI-fill contract: `skip_field`/`abort_field` operations only
- Preserve current canonical file format and strict patch semantics
- Preserve full sentinel round-trip behavior in form content
  (`parse -> state -> serialize`)
- Ensure agent prompt body contains all required instructions without relying on YAML
  front matter
- Remove YAML front matter from model-visible embedded literal form context
- Keep required-field protection intact (`skip_field` must still fail on required
  fields)
- Add guardrails so contradictory skip guidance is easier to detect and prevent

## Non-Goals

- Changing persisted markdown/YAML/JSON serialization format
- Removing sentinel parsing support from the engine
- Relaxing required-field rules
- Adding patch canonicalization that rewrites `set_*` sentinel values into meta
  operations
- Changing persisted front matter on disk

## Background

Observed behavior from QA runs:
- Prompts can simultaneously instruct `skip_field` and `%SKIP% (reason)`
- Models copy `%SKIP%` literals into `set_*` values
- `applyPatches()` rejects these values by design, causing extra turns and noise

This is amplified for complex forms because:
- Multiple instruction surfaces exist (form docs, role instructions, field docs,
  retries)
- Large context payloads increase chance of copying literal sentinel tokens

Related context issue:
- `buildContextPrompt()` embeds `serializeForm(form)` as markdown, including YAML front
  matter
- Models may over-index on frontmatter metadata even when explicit body instructions
  already exist

## Design

### Approach

Use a single up-front design:

1. **Authoring alignment (A)**: remove `%SKIP%`/`%ABORT%` guidance from form/role/field
   instructions.
2. **Harness sanitization (B)**: never show raw sentinel literals in model-facing
   prompt/context text.
3. **Guardrail (D)**: add lint/checks that fail or warn when authoring surfaces
   reintroduce sentinel guidance.
4. **Prompt-content contract**: make body instructions self-sufficient, then remove YAML
   front matter from model-visible embedded form markdown.

Reject `Approach C` for now because it changes patch semantics and can hide instruction
bugs. If inputs are controlled, correctness is better enforced at authoring and prompt
construction layers.

This intentionally keeps a dual-surface model:
- **Form content surface** (markdown/state): sentinels remain valid for round-trip and
  interoperability.
- **Agent patch surface** (fill operations): agents should use explicit operations, not
  embedded sentinels.
- **Prompt-display surface** (model-visible context): include instructions and current
  field state, but omit YAML front matter once body-complete guidance is confirmed.

### Decision Matrix

| Approach | Complex-Form Fit | Risk | Recommendation |
| --- | --- | --- | --- |
| A: form-content hygiene only | Medium (necessary but misses serialized-context leakage) | Low | Adopt with B + D |
| B: harness prompt sanitization | High (eliminates sentinel leakage to model) | Low | **Adopt** |
| C: patch canonicalization | Low for this strategy (unneeded semantic rewrite) | Medium | Do not adopt now |
| D: lint/guardrail | High (prevents regressions in controlled authoring) | Low | **Adopt** |

### Components

- `packages/markform/src/harness/liveAgent.ts`
  - Sanitize sentinel literals in:
    - composed system prompt sections
    - serialized form markdown inserted into context prompt
    - prior rejection/error text shown back to model
  - Remove YAML front matter from embedded literal form markdown in context prompt
- `packages/markform/src/harness/prompts.ts` and related harness helpers
  - Keep patch guidance centered on `skip_field`/`abort_field`
  - Ensure body instructions cover all agent-required behavior currently implied by
    front matter
- Downstream form definitions (controlled authoring surface)
  - Remove `%SKIP%`/`%ABORT%` textual instructions from role/form docs
- Lint/check tooling
  - Flag sentinel instruction literals in AI-fill authoring paths

### API Changes

No patch API semantic changes.

Optional implementation choice:
- internal-only harness setting to disable sanitization for debugging
- default production behavior remains sanitization enabled

## Implementation Plan

### Phase 1: Single-Contract Skip Design

- [ ] Add sentinel prompt sanitizer utility for `%SKIP%` and `%ABORT%` display text
- [ ] Apply sanitizer in `buildSystemPrompt()` instruction sections
- [ ] Apply sanitizer in `buildContextPrompt()` for serialized form text and rejection
  feedback
- [ ] Audit model-required instruction inputs and verify they are fully present in
  prompt body sections
- [ ] Remove YAML front matter from model-visible embedded form markdown (context prompt
  only)
- [ ] Ensure no model-facing prompt path can emit raw `%SKIP%`/`%ABORT%`
- [ ] Add tests verifying prompt text shown to model does not contain `%SKIP%`/`%ABORT%`
- [ ] Add tests verifying context-embedded form markdown omits YAML front matter
- [ ] Add regression tests to confirm no behavior loss after front matter removal from
  prompt context
- [ ] Add tests confirming engine serialization remains unchanged
- [ ] Update downstream form authoring instructions to use `skip_field`/`abort_field`
  only
- [ ] Add warning/lint checks for `%SKIP%`/`%ABORT%` literals in AI-fill instruction
  surfaces
- [ ] Update docs to clarify: sentinels are serialization artifacts, not patch values,
  and front matter is not part of the agent prompt contract

## Testing Strategy

- Unit tests for prompt sanitization behavior and replacement formatting
- Unit tests for `liveAgent` prompt builders ensuring no `%SKIP%`/`%ABORT%` leak into
  model-visible prompt text
- Unit tests for prompt builders ensuring YAML front matter is absent from embedded form
  markdown
- Regression tests verifying `applyPatches()` still rejects embedded sentinel values by
  default
- Regression tests verifying sentinel round-trip still works for literal form responses
- Regression tests showing equivalent fill behavior with and without prompt-side front
  matter display
- Golden/e2e fill-session test that exercises:
  - serialized form context containing skipped/aborted responses
  - agent turns producing valid `skip_field`/`abort_field` patches
  - context prompt without YAML front matter
  - final `parse -> serialize -> parse` equivalence for sentinel-bearing responses
- Reproduction fixture test from downstream-like contradictory instruction setup:
  - Verify sentinel-in-value rejection is eliminated in first N turns after authoring +
    sanitization changes

## Rollout Plan

1. Land Phase 1 changes in Markform and downstream forms together.
2. Run targeted QA reruns on complex forms.
3. Review rejection metrics and qualitative traces.
4. Fix any remaining authoring outliers rather than adding patch rewrite semantics.

## Acceptance Criteria

- Model-visible system/context prompts contain no `%SKIP%`/`%ABORT%` literals by
  default.
- Model-visible embedded form markdown omits YAML front matter.
- Prompt body still contains all required role/form guidance after front matter removal.
- Serialization/export behavior and existing sentinel-friendly file format remain
  unchanged.
- Literal sentinel form responses still round-trip correctly (including reason text).
- Golden/e2e fill-session test passes with sentinel-bearing forms.
- Reproduction runs no longer show sentinel-in-`set_*` rejection loops.
- Required-field skip errors continue to fire correctly.
- Contradictory `%SKIP%` instruction text is flagged by guardrail/lint mechanisms.

## Open Questions

- Should the guardrail be warning-only initially or CI-blocking from day one?
- Do we want one generic sanitizer transform across providers, or provider-specific
  variants?
- Should front matter omission be unconditional, or behind a debug toggle for prompt
  inspection?

## References

- `packages/markform/src/harness/liveAgent.ts`
- `packages/markform/src/engine/apply.ts`
- `packages/markform/src/engine/serialize.ts`
- `packages/markform/src/engine/parseSentinels.ts`
- `docs/project/specs/active/plan-2026-02-10-show-skip-reason-in-view.md`
