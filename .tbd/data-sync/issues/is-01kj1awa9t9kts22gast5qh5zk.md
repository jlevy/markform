---
type: is
id: is-01kj1awa9t9kts22gast5qh5zk
title: "Phase 4: Tests and validation"
kind: task
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-02-21-fill-record-comprehensive-source-of-truth.md
labels: []
dependencies: []
parent_id: is-01kj166gy9tgxd8203jhdfy7kp
created_at: 2026-02-22T00:09:37.849Z
updated_at: 2026-02-22T00:25:52.988Z
---
Comprehensive tests for all new FillRecord fields.
Reference: plan-2026-02-21-fill-record-comprehensive-source-of-truth.md, Phase 4.

## Test files to update/create

### 1. fillRecordCollector.test.ts (packages/markform/tests/unit/harness/fillRecordCollector.test.ts)

Tests:
- Config snapshot: verify FillRecordCollectorOptions.config appears in getRecord output
- markformVersion: verify string appears at top level
- inputFormSha256: verify 64-char hex string appears at top level
- fillRecordSchemaVersion: verify equals 1
- rejectedPatches: call onTurnComplete with PatchRejection[], verify full array in timeline entry (not just count)
- formProgress: call onTurnComplete with formProgressSnapshot, verify 4-field object in timeline entry
- issueRefs: call onTurnComplete with issues, verify compact refs in timeline entry
- recordPatches enabled: call onTurnComplete with patches, verify patches array in timeline entry
- recordPatches disabled (default): call onTurnComplete with patches, verify patches absent in timeline entry
- Backward compat: verify patchesRejected count and issuesAddressed count still present alongside new detail arrays

### 2. programmaticFill.test.ts (packages/markform/tests/unit/harness/programmaticFill.test.ts)

Tests:
- Config snapshot effective values: call fillForm with some options omitted, verify config in FillRecord shows resolved defaults (e.g. maxTurnsTotal: 100)
- prefillFieldIds: call fillForm with inputContext, verify config.prefillFieldIds matches Object.keys of inputContext
- inputFormSha256: verify present and is 64-char hex string
- markformVersion: verify present
- fillRecordSchemaVersion: verify equals 1
- formProgress per turn: verify timeline entries have formProgress with correct field counts
- rejectedPatches in timeline: provide agent that generates invalid patches, verify rejectedPatches array in timeline
- issueRefs in timeline: verify issueRefs present with ref/scope/severity/reason
- recordPatches opt-in: call with recordPatches: true, verify patches in timeline; call without, verify absent

### 3. fillRecord.test.ts (packages/markform/tests/unit/cli/fillRecord.test.ts or similar)

Tests:
- FillConfigSchema passthrough: create object with known + unknown keys, verify unknown keys survive Zod parse via .passthrough
- FillRecordSchema: verify new optional fields parse correctly (config, markformVersion, etc.)
- sessionId: verify sess-ULID format passes validation (no longer uuid)

### 4. Compile-time type assertion
Add to a test file or harnessTypes.ts:
Verify FillConfigSnapshot excludes exactly the non-serializable keys using a type-level check.
If a new non-serializable field is added to FillOptions without updating the exclude list,
it should produce a TypeScript compile error.

### 5. Golden + integration tests
- Regenerate golden snapshots: pnpm --filter markform test:golden:regen
- Update tryscript tests: pnpm test:tryscript:update
- Update StableFillRecord if needed (new top-level fields should be included in stable output)

### 6. Full validation
- pnpm test:unit
- pnpm test
- pnpm precommit
