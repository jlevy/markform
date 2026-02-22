---
type: is
id: is-01kj1avqsvvs91f3basxqme7qh
title: "Phase 2: Per-turn enrichment wiring (FR-2, FR-3, FR-5)"
kind: task
status: closed
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-02-21-fill-record-comprehensive-source-of-truth.md
labels: []
dependencies:
  - type: blocks
    target: is-01kj1aw076g0mmng7b7ymzzj9z
parent_id: is-01kj166gy9tgxd8203jhdfy7kp
created_at: 2026-02-22T00:09:18.905Z
updated_at: 2026-02-22T00:46:00.996Z
closed_at: 2026-02-22T00:46:00.994Z
close_reason: "Wired per-turn enrichment: full PatchRejection, issueRefs, formProgressSnapshot, and conditional patches in collector and both serial/parallel paths"
---
Wire per-turn rejection details, form progress snapshots, and issue refs into collector and fill paths.
Reference: plan-2026-02-21-fill-record-comprehensive-source-of-truth.md, FR-2, FR-3, FR-5.

## 1. Update fillRecordCollector.ts

### 1a. Extend TurnCompleteEvent interface (lines 58-67)
Add optional fields after coercionWarnings:
- rejectedPatches?: PatchRejection[] (import from coreTypes)
- formProgress?: { answeredFields: number; skippedFields: number; requiredRemaining: number; optionalRemaining: number }
- issueRefs?: { ref: string; scope: string; severity: string; reason: string }[]
- patches?: Patch[] (import Patch from coreTypes)

### 1b. Update onTurnComplete method (lines 221-233)
Currently stores only counts. Change to also store:
- rejectedPatches: full PatchRejection[] from progress.rejectedPatches (not just .length)
- issueRefs: map progress.issues to compact form: { ref, scope, severity, reason }
- formProgress: from progress.formProgressSnapshot (if present)
- patches: from progress.patches (only if this.recordPatches is true) -- Note: recordPatches flag was added in Phase 1b

Existing fields remain: patchesRejected count, issuesAddressed count (backward compat).

### 1c. Update buildTimeline method (lines 535-566)
In the timeline entry construction (line 542-563), pass through the new fields from completeEvent:
- rejectedPatches: completeEvent.rejectedPatches
- formProgress: completeEvent.formProgress
- issueRefs: completeEvent.issueRefs
- patches: completeEvent.patches
Use same pattern as coercionWarnings: only include if present and non-empty.

## 2. Update programmaticFill.ts serial path

### 2a. Compute formProgressSnapshot after harness.apply (after line 780)
After stepResult = harness.apply(...) at line 780, compute:
```
const progressCounts = getProgressCounts(form, targetRoles);
const formProgressSnapshot = {
  answeredFields: progressCounts.answeredFields,
  skippedFields: progressCounts.skippedFields,
  requiredRemaining: progressCounts.emptyRequiredFields,
  optionalRemaining: progressCounts.unansweredFields - progressCounts.emptyRequiredFields,
};
```

### 2b. Include formProgressSnapshot in onTurnComplete payload (lines 794-806)
Add to the TurnProgress object passed to mergedCallbacks.onTurnComplete:
```
formProgressSnapshot,
```

## 3. Update programmaticFill.ts parallel path (runMultiTurnForItems)

### 3a. Fix patchesApplied bug (line 1299)
Currently: `patchesApplied: response.patches.length` -- reports patches generated, not applied.
Fix: track actual applied count from applyResult.

Change lines 1280-1288 to capture the actual applied count:
```
let turnPatchesApplied = 0;
if (response.patches.length > 0) {
  const applyResult = applyPatches(form, response.patches);
  turnPatchesApplied = applyResult.appliedPatches.length;
  patchesApplied += turnPatchesApplied;
  previousRejections = applyResult.rejectedPatches;
  lastCoercionWarnings = applyResult.warnings;
} else {
  previousRejections = undefined;
}
```

Then at line 1299: `patchesApplied: turnPatchesApplied,`

### 3b. Compute formProgressSnapshot in parallel path (after applyPatches, ~line 1288)
Same computation as serial path using getProgressCounts.
Note: in parallel path, import getProgressCounts is already available (defined at line 136).

### 3c. Include formProgressSnapshot in parallel onTurnComplete (lines 1296-1308)
Add formProgressSnapshot to the TurnProgress payload.

## 4. Update CLI fill.ts serial path

### 4a. Capture pre-apply issues (before line 811)
Currently, line 824 passes `issues: stepResult.issues` -- but stepResult is overwritten by harness.apply at line 811, so this is POST-apply issues.
For issueRefs, we need PRE-apply issues (what the LLM was shown).

Fix: capture before the apply call:
```
const preApplyIssues = stepResult.issues;
```
Then at line 824: `issues: preApplyIssues,`

### 4b. Fix patchesApplied in CLI path (line 818)
Currently: `patchesApplied: patches.length - rejectedPatches.length`
This is manually calculated. Better: use stepResult.patchesApplied from harness.apply result.
Change to: `patchesApplied: stepResult.patchesApplied ?? patches.length,`

### 4c. Add formProgressSnapshot to CLI serial path
After harness.apply and before collector.onTurnComplete, compute formProgressSnapshot
using the same pattern as programmaticFill serial path.
The CLI serial path uses inspect directly, not getProgressCounts. Import and use
getProgressCounts from programmaticFill, or compute inline from the existing
computeProgressSummary infrastructure already available in the CLI.
