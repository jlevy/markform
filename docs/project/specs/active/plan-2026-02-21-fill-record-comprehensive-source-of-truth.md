# Feature: FillRecord as Comprehensive Source of Truth

**Date:** 2026-02-21

**Author:** Joshua Levy with LLM assistance

**Status:** Draft

**Related:**

- `attic/fill-record-gaps.md` -- Gap analysis from V9 batch run
- `docs/project/specs/active/plan-2026-02-19-fill-harness-observability.md` -- Signal
  propagation, LLM metadata, error classification, event log (MF-1 through MF-5)
- `docs/project/specs/active/plan-2026-02-14-fill-record-performance-metrics.md` --
  Parallelism metrics, timing display
- `docs/project/specs/done/plan-2026-01-29-fill-record.md` -- Original FillRecord spec

## Overview

The FillRecord was designed as a summarization layer (counts, timing, aggregates).
Downstream consumers need it to be a **source of record**: comprehensive,
self-contained, and sufficient for post-hoc debugging without re-running fills.

Today, the harness’s in-memory `SessionTurn[]` captures rich per-turn data that the
FillRecord discards during serialization.
The `onTurnComplete` callback receives `TurnProgress` with full rejection details,
issues, patches, and form state -- but only persists counts.
Additionally, every `FillOptions` setting that affects fill behavior (retry limits,
parallelism, turn limits, tool choice, etc.)
is lost in the FillRecord, making it impossible to verify after the fact what
configuration was used.

This spec addresses three structural gaps:

1. **Config capture** -- snapshot all serializable `FillOptions` at fill start so every
   run is fully reproducible and debuggable
2. **Per-turn enrichment** -- persist the detail already available in `TurnProgress`
   instead of discarding it
3. **Provenance metadata** -- markform version and form content hash for batch
   reproducibility

## Goals

- Make the FillRecord self-contained: a reader should never need to consult logs, re-run
  the fill, or guess at configuration to understand what happened
- Capture all `FillOptions` settings automatically via exclude-list, so new options are
  recorded by default
- Replace per-turn counts with structured details (rejections, issues, form progress)
- Support opt-in capture of raw patches for forensic analysis
- Add version and form hash for batch reproducibility

## Non-Goals

- Cost estimation -- requires external pricing database, stays downstream
- Retry/backoff tracking within the AI SDK -- requires upstream changes (the AI SDK
  handles retries internally)
- Full context prompt capture -- already available via `captureWireFormat`
- Per-field timeline -- derivable from Tier 1/2 data, compute post-hoc
- Changes to the event log or timing breakdown -- covered by the observability and
  performance metrics specs respectively

## Background

### The Two-Record Problem

Two parallel data structures capture overlapping but different subsets of execution:

**`SessionTurn[]`** (in-memory only, never written to disk in production fills):

- Full `InspectIssue[]` shown to LLM
- All patches submitted (applied + rejected)
- `PatchRejection[]` with `{ patchIndex, message, fieldId, fieldKind, columnIds }`
- Coercion warnings
- Form state snapshot after each turn

**`FillRecord`** (persisted as `.fill.json`):

- `patchesRejected: 3` (count only, details lost)
- `issuesAddressed: 5` (count only)
- No form progress per turn (only final `formProgress`)
- No configuration settings

The data loss happens in `FillRecordCollector.onTurnComplete()`:

```typescript
patchesRejected: progress.rejectedPatches?.length ?? 0,
```

The full `PatchRejection[]` is available in `progress.rejectedPatches` but only
`.length` is persisted.

### The Config Blindness Problem

`FillOptions` has ~20 fields affecting execution: `maxTurnsTotal`, `maxRetries`,
`maxPatchesPerTurn`, `maxIssuesPerTurn`, `maxStepsPerTurn`, `targetRoles`, `fillMode`,
`enableParallel`, `maxParallelAgents`, `toolChoice`, `enableWebSearch`,
`captureWireFormat`, etc.
None are recorded in the FillRecord.

When debugging a batch run, there’s no way to confirm what settings were used.
Every new option (e.g., PR #162’s `maxRetries`) widens this gap.

## Design

### FR-1. Config Snapshot (`config` top-level field)

**Priority:** High (structural fix that prevents future iteration)

Snapshot all serializable `FillOptions` at fill start using an **exclude-list** pattern.
New options are captured by default unless explicitly excluded.

**Type definition:**

```typescript
// Exclude non-serializable and already-captured fields
type FillConfigSnapshot = Omit<
  FillOptions,
  // Non-serializable
  | 'form'
  | 'model'
  | 'signal'
  | 'callbacks'
  | '_testAgent'
  | 'providers'
  | 'additionalTools'
  // Already captured elsewhere in FillRecord
  | 'inputContext'
>;
```

Using `Omit<FillOptions, ...>` means when someone adds a new field to `FillOptions`
(like `maxRetries`), it automatically appears in the config snapshot.
Only non-serializable types (`AbortSignal`, `Tool`, `Agent`, `LanguageModel`) and fields
already captured elsewhere need to be excluded.

**Schema:**

```typescript
// In FillRecordSchema, new top-level field
config: z.object({
  maxTurnsTotal: z.number().int().positive().optional(),
  maxTurnsThisCall: z.number().int().positive().optional(),
  startingTurnNumber: z.number().int().nonnegative().optional(),
  maxPatchesPerTurn: z.number().int().positive().optional(),
  maxIssuesPerTurn: z.number().int().positive().optional(),
  maxStepsPerTurn: z.number().int().positive().optional(),
  maxRetries: z.number().int().nonnegative().optional(),
  targetRoles: z.array(z.string()).optional(),
  fillMode: z.string().optional(),
  enableParallel: z.boolean().optional(),
  maxParallelAgents: z.number().int().positive().optional(),
  enableWebSearch: z.boolean().optional(),
  captureWireFormat: z.boolean().optional(),
  recordFill: z.boolean().optional(),
  toolChoice: z.string().optional(),
  systemPromptAddition: z.string().optional(),
  recordPatches: z.boolean().optional(),  // FR-4, opt-in
}).optional(),
```

The Zod schema is intentionally permissive (all fields optional) since the TypeScript
`FillConfigSnapshot` type provides compile-time safety.
The schema validates stored records, which may come from older versions.

**Implementation:**

1. Add `config?: FillConfigSnapshot` to `FillRecordCollectorOptions`
2. Pass sanitized `FillOptions` when constructing the collector in `programmaticFill.ts`
3. Include `config` in `getRecord()` output

### FR-2. Per-Turn Rejection Details

**Priority:** High (most critical gap from V9 batch analysis)

Replace `patchesRejected: number` with `rejectedPatches: PatchRejection[]` in timeline
entries.

**Changes:**

1. **`fillRecord.ts`** -- Add `rejectedPatches` to `TimelineEntrySchema`:

   ```typescript
   rejectedPatches: z.array(PatchRejectionSchema).optional(),
   ```

   Keep `patchesRejected: number` for backward compatibility and quick access.

2. **`fillRecordCollector.ts`** -- Store full rejections in `turn_complete` event:

   ```typescript
   // In onTurnComplete():
   const rejections = progress.rejectedPatches;
   this.events.push({
     type: 'turn_complete',
     // ...existing fields...
     rejectedPatches: rejections?.length ? rejections : undefined,
   });
   ```

3. **`fillRecordCollector.ts`** -- Pass rejections through to timeline builder in
   `buildTimeline()`.

**Size impact:** Negligible.
Rejections are sparse (only on turns with validation failures) and each `PatchRejection`
is ~5 fields.

### FR-3. Per-Turn Form Progress Snapshot

**Priority:** High (enables tracking fill velocity and identifying stalls)

Add a per-turn form progress snapshot to timeline entries.
Currently only the final `formProgress` is in the FillRecord.

**Changes:**

1. **`fillRecord.ts`** -- Add `formProgress` to `TimelineEntrySchema`:

   ```typescript
   formProgress: z.object({
     answeredFields: z.number().int().nonnegative(),
     skippedFields: z.number().int().nonnegative(),
     requiredRemaining: z.number().int().nonnegative(),
     optionalRemaining: z.number().int().nonnegative(),
   }).optional(),
   ```

2. **`harnessTypes.ts`** -- Add form progress counts to `TurnProgress` (or derive from
   existing data). The harness already has the form state after each turn via
   `getProgressCounts()`.

3. **`fillRecordCollector.ts`** -- Accept and store per-turn progress in
   `onTurnComplete()` and pass through to timeline.

4. **`programmaticFill.ts`** -- Compute and include form progress when building
   `TurnProgress`.

### FR-4. Opt-In Raw Patches Per Turn (`recordPatches`)

**Priority:** Medium (significant size impact, opt-in)

Add `recordPatches: boolean` to `FillOptions`. When enabled, store the raw `Patch[]`
submitted by the LLM each turn.

**Changes:**

1. **`harnessTypes.ts`** -- Add `recordPatches?: boolean` to `FillOptions`

2. **`fillRecord.ts`** -- Add `patches` to `TimelineEntrySchema`:

   ```typescript
   patches: z.array(PatchSchema).optional(),
   ```

3. **`fillRecordCollector.ts`** -- Conditionally store patches based on option

4. **`programmaticFill.ts`** -- Pass `recordPatches` flag through

**Size impact:** Significant when enabled (~36 turns x ~50 patches = ~1800 patch objects
for a large form). This is why it’s opt-in.

### FR-5. Per-Turn Issue Field IDs

**Priority:** Medium (enables understanding what the LLM was asked to do)

Replace `issuesAddressed: number` with a compact representation.
Full `InspectIssue[]` is too large; field IDs + count is sufficient.

**Changes:**

1. **`fillRecord.ts`** -- Add `issueFieldIds` to `TimelineEntrySchema`:

   ```typescript
   issueFieldIds: z.array(z.string()).optional(),
   ```

   Keep `issuesAddressed: number` for backward compatibility.

2. **`fillRecordCollector.ts`** -- Store issue field IDs in `turn_complete` event:

   ```typescript
   issueFieldIds: progress.issues?.map(i => i.ref),
   ```

3. **`fillRecordCollector.ts`** -- Pass through to timeline builder.

**Size impact:** Negligible.
Array of short strings, one per issue.

### FR-6. Provenance Metadata

**Priority:** Medium (essential for batch reproducibility)

Add top-level fields for markform version and form content hash.

**Changes:**

1. **`fillRecord.ts`** -- Add to `FillRecordSchema`:

   ```typescript
   markformVersion: z.string().optional(),
   formSha256: z.string().optional(),
   ```

2. **`fillRecordCollector.ts`** -- Accept and store in constructor/`getRecord()`.
   `markformVersion` comes from `package.json` version.
   `formSha256` is computed from the form markdown (already available in the harness
   transcript’s `after.markdownSha256`).

3. **`programmaticFill.ts`** -- Pass version and hash when constructing collector.

## Implementation Plan

### Phase 1: Config Snapshot and Provenance (FR-1, FR-6)

These are the structural changes that prevent future iteration.

Files: `harnessTypes.ts`, `fillRecord.ts`, `fillRecordCollector.ts`,
`programmaticFill.ts`

- [ ] Define `FillConfigSnapshot` type using `Omit<FillOptions, ...>` in
  `harnessTypes.ts`
- [ ] Add `config?: FillConfigSnapshot` to `FillRecordCollectorOptions`
- [ ] Add `FillConfigSchema` to `FillRecordSchema` in `fillRecord.ts`
- [ ] Add `markformVersion` and `formSha256` fields to `FillRecordSchema`
- [ ] Pass sanitized config when constructing collector in `programmaticFill.ts`
- [ ] Compute and pass `formSha256` from form markdown
- [ ] Read and pass `markformVersion` from package metadata
- [ ] Include `config`, `markformVersion`, `formSha256` in `getRecord()` output
- [ ] Also pass config in CLI fill command’s collector construction (`fill.ts`)

### Phase 2: Per-Turn Enrichment (FR-2, FR-3, FR-5)

Persist detail already available in `TurnProgress`.

Files: `fillRecord.ts`, `fillRecordCollector.ts`, `programmaticFill.ts`

- [ ] Add `rejectedPatches` array to `TimelineEntrySchema` (keep `patchesRejected`
  count)
- [ ] Add `formProgress` per-turn snapshot to `TimelineEntrySchema`
- [ ] Add `issueFieldIds` array to `TimelineEntrySchema` (keep `issuesAddressed` count)
- [ ] Update `TurnCompleteEvent` interface to carry rejection details, form progress,
  and issue field IDs
- [ ] Update `onTurnComplete()` to store full rejections, form progress, and issue refs
- [ ] Update `buildTimeline()` to pass new fields through to `TimelineEntry`
- [ ] Extend `TurnProgress` to include per-turn form progress counts (or compute them in
  `programmaticFill.ts` before calling `onTurnComplete`)
- [ ] Update `EventTurnCompleteSchema` Zod schema to include new fields

### Phase 3: Opt-In Patches (FR-4)

Files: `harnessTypes.ts`, `fillRecord.ts`, `fillRecordCollector.ts`,
`programmaticFill.ts`, `fill.ts` (CLI)

- [ ] Add `recordPatches?: boolean` to `FillOptions`
- [ ] Add `patches` array to `TimelineEntrySchema`
- [ ] Add `recordPatches` flag to `FillRecordCollectorOptions`
- [ ] Conditionally store patches in `onTurnComplete()` based on flag
- [ ] Pass through to timeline builder
- [ ] Add `--record-patches` CLI flag to `fill` command
- [ ] Include `recordPatches` in config snapshot (automatic via FR-1)

### Phase 4: Tests and Validation

- [ ] Add unit tests for config snapshot: verify all serializable FillOptions fields
  appear in FillRecord `config`
- [ ] Add unit test verifying that adding a new serializable field to FillOptions causes
  a type error if not handled (compile-time check via `FillConfigSnapshot`)
- [ ] Add unit tests for rejection details: verify `rejectedPatches` array in timeline
  entries
- [ ] Add unit tests for per-turn form progress: verify `formProgress` snapshot per turn
- [ ] Add unit tests for issue field IDs: verify `issueFieldIds` in timeline entries
- [ ] Add unit tests for `recordPatches` opt-in: verify patches appear when enabled,
  absent when disabled
- [ ] Add unit tests for `markformVersion` and `formSha256`
- [ ] Update golden tests if FillRecord schema changes affect snapshots
  (`pnpm --filter markform test:golden:regen`)
- [ ] Update tryscript tests if CLI output changes (`pnpm test:tryscript:update`)
- [ ] Run full validation: `pnpm precommit`

## Backward Compatibility

All new fields are optional in the Zod schema.
Existing FillRecords parse unchanged.
The `patchesRejected` count and `issuesAddressed` count are retained alongside the new
detail arrays for consumers that only need counts.

The config snapshot uses `Omit<FillOptions, ...>` so it evolves with FillOptions.
The Zod schema for config is permissive (all optional) to handle records from older
versions.

## Size Impact

| Change | Impact | Default |
| --- | --- | --- |
| Config snapshot | ~200-500 bytes | Always on |
| Rejection details | Negligible (sparse) | Always on |
| Form progress per turn | ~80 bytes/turn | Always on |
| Issue field IDs | ~50-200 bytes/turn | Always on |
| markformVersion + formSha256 | ~100 bytes | Always on |
| Raw patches (FR-4) | ~50KB+ for large forms | Opt-in |

For a typical 30-turn fill with a 15K-line fill.json, the always-on additions add
roughly 5-10KB (~3-7%). Raw patches are the only item with significant size impact,
hence opt-in.

## Testing Strategy

- **Unit tests**: Verify each new field appears in FillRecord for known inputs
- **Config snapshot type safety**: Verify at compile time that new FillOptions fields
  flow through (the `Omit` pattern ensures this)
- **Golden tests**: Regenerate snapshots; verify new fields appear in golden output
- **Tryscript tests**: Update CLI golden output if summary format changes
- **Manual QA**: Run a live fill with `--record-fill`, inspect `.fill.json` for:
  - `config` section with all settings
  - `rejectedPatches` arrays on turns with validation failures
  - `formProgress` on every timeline entry
  - `issueFieldIds` on every timeline entry
  - `markformVersion` and `formSha256` at top level

## Open Questions

1. **Should `systemPromptAddition` be included in config snapshot?** It could be large
   if the caller provides a multi-paragraph addition.
   Options: (a) always include, (b) truncate to first N chars, (c) include a hash
   instead. Recommendation: (a) always include -- it’s usually short and is critical for
   debugging.

2. **Should `inputContext` be in the config snapshot?** It’s the pre-fill values, which
   could be large. Currently excluded because it’s a data payload, not a configuration
   setting. But it’s useful for reproducibility.
   Options: (a) exclude (current), (b) include, (c) include just the field IDs that were
   pre-filled. Recommendation: (c) include just the field IDs.

## References

- `attic/fill-record-gaps.md` -- Original gap analysis
- `packages/markform/src/harness/fillRecord.ts` -- FillRecord schema
- `packages/markform/src/harness/fillRecordCollector.ts` -- Event collector
- `packages/markform/src/harness/harnessTypes.ts` -- `FillOptions`, `TurnProgress`,
  `FillCallbacks`
- `packages/markform/src/harness/programmaticFill.ts` -- Fill loop, collector
  construction
- PR #162 (`feat/fill-options-max-retries`) -- Example of new FillOptions field
