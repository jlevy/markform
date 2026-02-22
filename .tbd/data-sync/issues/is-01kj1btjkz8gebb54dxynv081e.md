---
type: is
id: is-01kj1btjkz8gebb54dxynv081e
title: "Fix: patchesApplied inflation in parallel path + wrong issues in CLI serial path"
kind: bug
status: closed
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-02-21-fill-record-comprehensive-source-of-truth.md
labels: []
dependencies:
  - type: blocks
    target: is-01kj1avqsvvs91f3basxqme7qh
parent_id: is-01kj166gy9tgxd8203jhdfy7kp
created_at: 2026-02-22T00:26:09.405Z
updated_at: 2026-02-22T00:42:43.723Z
closed_at: 2026-02-22T00:42:43.721Z
close_reason: Fixed patchesApplied inflation in parallel path (used appliedPatches.length) and pre-apply issues capture in CLI serial path
---
Fix two data accuracy bugs in the fill record pipeline found during spec review.

## Bug 1: Parallel path reports patches generated, not patches applied

File: packages/markform/src/harness/programmaticFill.ts, runMultiTurnForItems function

Line 1299: `patchesApplied: response.patches.length`
This reports the number of patches the LLM generated, not the number actually applied
after validation. When patches are rejected, the count is inflated.

Fix: Track actual applied count from applyResult.appliedPatches.length and report that.
See Phase 2 bead for the specific code change (3a).

## Bug 2: CLI serial path uses post-apply issues instead of pre-apply issues

File: packages/markform/src/cli/commands/fill.ts, serial harness loop

Line 811: `stepResult = harness.apply(patches, stepResult.issues, ...)` overwrites stepResult.
Line 824: `issues: stepResult.issues` passes post-apply issues to collector.onTurnComplete.

But the issues that matter for the FillRecord timeline are the PRE-apply issues -- the ones
shown to the LLM that motivated the patches. Post-apply issues are the result, not the input.

Fix: Capture `const preApplyIssues = stepResult.issues` before the harness.apply call.
Pass preApplyIssues to collector.onTurnComplete.
See Phase 2 bead for the specific code change (4a).

Note: These bugs are fixed as part of Phase 2 implementation. This bead exists to
track them explicitly as known issues.
