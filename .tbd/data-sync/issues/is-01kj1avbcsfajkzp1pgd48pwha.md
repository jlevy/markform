---
type: is
id: is-01kj1avbcsfajkzp1pgd48pwha
title: "Phase 1b: Config snapshot + provenance wiring (FR-1, FR-6)"
kind: task
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-02-21-fill-record-comprehensive-source-of-truth.md
labels: []
dependencies:
  - type: blocks
    target: is-01kj1avqsvvs91f3basxqme7qh
parent_id: is-01kj166gy9tgxd8203jhdfy7kp
created_at: 2026-02-22T00:09:06.199Z
updated_at: 2026-02-22T00:24:37.736Z
---
Wire config snapshot and provenance into collector and fill paths.
Reference: plan-2026-02-21-fill-record-comprehensive-source-of-truth.md, FR-1 and FR-6.

## 1. Update fillRecordCollector.ts

### 1a. Extend FillRecordCollectorOptions (lines 134-152)
Add after customData: config, markformVersion, inputFormSha256, fillRecordSchemaVersion, recordPatches fields.

### 1b. Add private fields in class (lines 166-198)
Add private readonly fields for config, markformVersion, inputFormSha256, fillRecordSchemaVersion, recordPatches. Initialize from options in constructor body.

### 1c. Update getRecord return (lines 375-399)
Add to the return object after form: markformVersion, inputFormSha256, fillRecordSchemaVersion, config.

## 2. Update programmaticFill.ts

### 2a. Add imports
- import sha256 from js-sha256
- import VERSION from ../version.js
- import FillConfigSnapshot from harnessTypes

### 2b. Compute inputFormSha256 early
After form is parsed/cloned (line 452) and BEFORE inputContext is applied (line 519): compute inputFormSha256 = sha256 of serializeForm of form. This captures the template hash, not the partially-filled state.

### 2c. Resolve defaults earlier
Currently maxTurnsTotal etc are resolved at lines 555-559 (serial path only). Move default resolution to before collector creation (line 512) so both serial and parallel paths use resolved values for the config snapshot.

New block after inputContext application, before parallel branch:
- maxTurnsTotal = options.maxTurnsTotal ?? DEFAULT_MAX_TURNS
- startingTurnNumber = options.startingTurnNumber ?? 0
- maxPatchesPerTurn = options.maxPatchesPerTurn ?? DEFAULT_MAX_PATCHES_PER_TURN
- maxIssuesPerTurn = options.maxIssuesPerTurn ?? DEFAULT_MAX_ISSUES_PER_TURN
- targetRoles = options.targetRoles ?? [AGENT_ROLE]

### 2d. Build effective config snapshot
After resolving defaults, build FillConfigSnapshot object with all resolved values. Include prefillFieldIds from Object.keys of inputContext if provided.

### 2e. Update createCollectorIfNeeded
Add config and inputFormSha256 parameters. Pass config, markformVersion: VERSION, inputFormSha256, fillRecordSchemaVersion: 1, recordPatches to FillRecordCollector constructor.

### 2f. Remove duplicate default resolution
Lines 555-559 in serial path now use the earlier-resolved variables instead of re-resolving.

## 3. Update CLI fill.ts

### 3a. Parallel path (lines 391-428)
The parallel path calls fillForm which handles collector internally. Just add recordPatches to FillOptions if CLI flag present.

### 3b. Serial path collectors (lines 518-553)
Both mock and live collector constructions need config/provenance:
- Import VERSION from ../../version.js and sha256 from js-sha256
- Compute inputFormSha256 before collector creation
- Build config snapshot from resolved harness config + CLI options
- Pass config, markformVersion, inputFormSha256, fillRecordSchemaVersion: 1 to FillRecordCollector
