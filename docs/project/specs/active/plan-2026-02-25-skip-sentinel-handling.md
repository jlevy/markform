---
title: Skip Sentinel and Prompt Context Hygiene in LLM Fill Loops
description: Reduce skip/reject loops and prompt ambiguity by sanitizing sentinels and removing YAML front matter from model-visible form context
author: Codex (GPT-5)
---
# Feature: Skip Sentinel and Prompt Context Hygiene in LLM Fill Loops

**Date:** 2026-02-25 (last updated 2026-02-25)

**Author:** Codex (GPT-5)

**Status:** Implemented (PR #169)

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

Current wire-level evidence in checked-in goldens:
- `packages/markform/examples/simple/simple-with-skips.session.yaml:1864-1874` shows
  YAML front matter inside model-visible context prompt
- `packages/markform/examples/simple/simple-with-skips.session.yaml:1907-1910` and
  `2038-2041` show `%SKIP%` literals in model-visible context prompt

## Design

### Approach

Use a single up-front design:

1. **Authoring alignment (A)**: remove `%SKIP%`/`%ABORT%` guidance from form/role/field
   instructions.
2. **Harness sanitization (B)**: never show raw sentinel literals in model-facing
   prompt/context text.
3. **Prompt-content contract**: make body instructions self-sufficient, then remove YAML
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

Risk profile:
- Low risk to harness behavior because changes are isolated to prompt construction and
  model-visible text transformations.
- No patch-application semantics change.
- Wire/session goldens will make every prompt-level byte change explicit in review.

### Decision Matrix

| Approach | Complex-Form Fit | Risk | Recommendation |
| --- | --- | --- | --- |
| A: form-content hygiene only | Medium (necessary but misses serialized-context leakage) | Low | Adopt with B |
| B: harness prompt sanitization | High (eliminates sentinel leakage to model) | Low | **Adopt** |
| C: patch canonicalization | Low for this strategy (unneeded semantic rewrite) | Medium | Do not adopt now |

### File and Line-Level Implementation Map

| File | Line-level touch points | Planned change |
| --- | --- | --- |
| `packages/markform/src/harness/liveAgent.ts` | `461-513` (`buildSystemPrompt`) | Apply sentinel-text sanitizer to form-level docs, role instructions, and field instruction snippets before joining sections. |
| `packages/markform/src/harness/liveAgent.ts` | `526-640` (`buildContextPrompt`) | Sanitize previous rejection messages (`542-555`), sanitize serialized-form payload, and replace `serializeForm(form)` insertion (`567`) with stripped-frontmatter + sanitized content. |
| `packages/markform/src/harness/liveAgent.ts` | `888-899` (`buildMockWireFormat`) | Keep wire generation path unchanged except inheriting new prompt-builder behavior, so golden sessions capture exact prompt diffs. |
| `packages/markform/src/harness/liveAgent.ts` | new helpers near context-building section | Add small pure helpers used only for prompt display: `sanitizeSentinelLiteralsForPrompt(text)` and `stripYamlFrontmatterForPrompt(markdown)`. |
| `packages/markform/src/harness/prompts.ts` | `20-79`, `254-257` | Confirm body instructions remain self-sufficient after frontmatter removal; adjust wording only if audit finds missing guidance. |
| `packages/markform/src/engine/apply.ts` | `268-338`, `383-397`, `485` | No behavior change; keep sentinel rejection and required-field skip rejection as invariants referenced by tests. |
| `packages/markform/src/engine/serialize.ts` | `337-340`, `1077-1080`, `1505` | No behavior change; keep sentinel round-trip behavior in form serialization. |
| `packages/markform/tests/unit/harness/liveAgent.test.ts` | file add/expand test blocks | Add focused tests around `buildMockWireFormat()` output for model-visible system/context prompts. |
| `packages/markform/tests/golden/helpers.ts` | `136-153` | Keep wire/context capture unchanged; this is the primary mechanism that snapshots prompt text at session level. |
| `packages/markform/scripts/regen-golden-sessions.ts` | `56-73` (`SESSIONS`) | Add one minimal prompt-hygiene scenario to generate a compact, reviewable wire/session golden. |
| `packages/markform/tests/golden/validation.test.ts` | `39-100` (`MUTATIONS`) | Add mutations specifically for frontmatter leakage and sentinel-literal leakage in prompt text. |

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

### API Changes

No patch API semantic changes.

Optional implementation choice:
- internal-only harness setting to disable sanitization for debugging
- default production behavior remains sanitization enabled

## Implementation Plan

### Task List (Implementation-Ready)

- [x] Add prompt-only sanitizer helpers in `liveAgent.ts`:
  - `%SKIP% (reason)` -> `(skipped: reason)`
  - `%SKIP%` -> `(skipped)`
  - `%ABORT% (reason)` -> `(aborted: reason)`
  - `%ABORT%` -> `(aborted)`
- [x] Add frontmatter-strip helper for model-visible context markdown only (do not alter
  persisted form serialization).
- [x] Apply helpers in `buildSystemPrompt()` and `buildContextPrompt()` at the exact
  callsites in the line map above.
- [x] Audit prompt-body sufficiency:
  - verify role/form/field instruction text appears in system prompt even when context
    prompt no longer includes frontmatter block.
- [x] Keep engine behavior unchanged (`apply.ts`, `serialize.ts`) and document these as
  explicit invariants.
- [x] Add/extend unit tests in `tests/unit/harness/liveAgent.test.ts` to assert:
  - model-visible prompts contain no `%SKIP%`/`%ABORT%` literals
  - context prompt omits leading YAML front matter
  - role instructions still appear in system prompt
- [x] Add a minimal prompt-hygiene golden scenario:
  - new tiny form fixture containing
    - frontmatter with `role_instructions`
    - at least one skipped/aborted value in serialized form state
  - regenerate session so wire request prompt is captured in git
- [x] Extend golden sensitivity tests (`validation.test.ts`) with prompt-hygiene
  mutations:
  - inject `%SKIP%` literal into wire request prompt
  - inject YAML frontmatter marker `---` at the start of embedded markdown block
  - verify mutations are detected
- [x] Update docs to state:
  - sentinels are valid serialization artifacts
  - agents must use `skip_field`/`abort_field`
  - YAML frontmatter is excluded from model-visible context prompt contract

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
- Golden wire-level assertions must verify:
  - `turns[].wire.request.system` contains explicit skip operation guidance
  - `turns[].wire.request.prompt` omits frontmatter block and sentinel literals
  - `turns[].context.context_prompt` matches the same transformed prompt contract
- Reproduction fixture test from downstream-like contradictory instruction setup:
  - Verify sentinel-in-value rejection is eliminated in first N turns after authoring +
    sanitization changes

### Golden Workflow (Explicit Before/After Diff)

Implementation should intentionally rely on git-visible golden diffs instead of staged
rollout:

1. Add/refresh minimal session fixture and run
   `pnpm --filter markform test:golden:regen`
2. Implement prompt-hygiene code changes.
3. Re-run `pnpm --filter markform test:golden:regen`.
4. Review `git diff packages/markform/examples/**/*.session.yaml`:
   - before/after prompt text change is explicit in wire/context sections
   - frontmatter removal and sentinel sanitization are visible as textual diffs
5. Run `pnpm --filter markform test:golden` and full test suite.

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
- Golden session diff for the prompt-hygiene fixture clearly shows:
  - removed frontmatter in embedded prompt markdown
  - sanitized sentinel display text
  - no unintended harness behavior drift outside prompt text and expected hashes

## Resolved Decisions

- Use one provider-agnostic sanitizer transform in harness prompt builders.
- Omit frontmatter unconditionally in model-visible embedded form markdown.
- Keep a dedicated prompt-hygiene fixture directory (`examples/prompt-hygiene/`) for
  explicit golden diffs.

## References

- `packages/markform/src/harness/liveAgent.ts`
- `packages/markform/src/engine/apply.ts`
- `packages/markform/src/engine/serialize.ts`
- `packages/markform/src/engine/parseSentinels.ts`
- `docs/project/specs/active/plan-2026-02-10-show-skip-reason-in-view.md`
