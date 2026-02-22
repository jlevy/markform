---
type: is
id: is-01kj1aw076g0mmng7b7ymzzj9z
title: "Phase 3: Opt-in raw patches (FR-4)"
kind: task
status: closed
priority: 2
version: 5
spec_path: docs/project/specs/active/plan-2026-02-21-fill-record-comprehensive-source-of-truth.md
labels: []
dependencies:
  - type: blocks
    target: is-01kj1awa9t9kts22gast5qh5zk
parent_id: is-01kj166gy9tgxd8203jhdfy7kp
created_at: 2026-02-22T00:09:27.524Z
updated_at: 2026-02-22T00:48:11.602Z
closed_at: 2026-02-22T00:48:11.601Z
close_reason: Added --record-patches CLI flag and wired recordPatches through parallel and serial paths
---
Add opt-in capture of raw Patch[] submitted by LLM each turn.
Reference: plan-2026-02-21-fill-record-comprehensive-source-of-truth.md, FR-4.

Note: Schema changes (patches field in TimelineEntrySchema/EventTurnCompleteSchema) and
FillOptions.recordPatches are already added in Phase 1a. FillRecordCollectorOptions.recordPatches
and the private field are added in Phase 1b. This bead wires the conditional behavior.

## 1. Update fillRecordCollector.ts onTurnComplete (lines 221-233)
The onTurnComplete method (updated in Phase 2 to accept full details) should conditionally
include patches based on this.recordPatches flag:
```
...(this.recordPatches && progress.patches?.length && { patches: progress.patches }),
```

## 2. Update programmaticFill.ts
The progress.patches field is already populated in both serial and parallel paths
(serial: line 805, parallel: line 1304). No changes needed here -- the patches are
always available in TurnProgress, the gating is in the collector.

## 3. Add --record-patches CLI flag to fill.ts

### 3a. Add CLI option (after --record-fill-stable, ~line 187)
```
.option('--record-patches', 'Include raw patches in fill record timeline entries')
```

### 3b. Add to options type (after recordFillStable, ~line 211)
```
recordPatches?: boolean;
```

### 3c. Wire into parallel path fillForm call (lines 391-428)
Add to the FillOptions object: `recordPatches: options.recordPatches,`

### 3d. Wire into serial path collector options
Already handled by Phase 1b (recordPatches passed through to collector).
In the serial path, the CLI constructs the collector directly (not via fillForm).
Need to add `recordPatches: options.recordPatches` to both mock and live collector
construction options.

Privacy note: raw patches contain field values. This is opt-in by design.
The --record-patches flag should be documented as potentially capturing PII.
