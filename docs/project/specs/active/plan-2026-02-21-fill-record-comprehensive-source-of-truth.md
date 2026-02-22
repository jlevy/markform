# Feature: FillRecord as Comprehensive Source of Truth

**Date:** 2026-02-21 (last updated 2026-02-21)

**Author:** Joshua Levy with LLM assistance

**Status:** Implemented

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

This spec addresses four structural gaps:

1. **Config capture** -- snapshot the **effective** (resolved) `FillOptions` at fill
   start so every run is fully reproducible and debuggable
2. **Per-turn enrichment** -- persist the detail already available in `TurnProgress`
   instead of discarding it
3. **Provenance metadata** -- markform version, form content hash, and schema version
   for batch reproducibility and forward compatibility
4. **Data governance** -- privacy/redaction considerations for captured config and
   patches

## Goals

- Make the FillRecord self-contained: a reader should never need to consult logs, re-run
  the fill, or guess at configuration to understand what happened
- Capture all `FillOptions` settings automatically via exclude-list, so new options are
  recorded by default
- Store the **effective** (post-default-resolution) config values, not just the raw
  caller input, so debugging shows what actually ran
- Replace per-turn counts with structured details (rejections, issues, form progress)
- Support opt-in capture of raw patches for forensic analysis
- Add version, form hash, and schema version for batch reproducibility and forward
  compatibility

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

### FR-1. Effective Config Snapshot (`config` top-level field)

**Priority:** High (structural fix that prevents future iteration)

Snapshot the **effective** (resolved after defaults) `FillOptions` at fill start using
an **exclude-list** pattern.
New options are captured by default unless explicitly excluded.

**Why effective config, not raw input:** `programmaticFill.ts` resolves defaults before
the fill loop (`options.maxTurnsTotal ?? DEFAULT_MAX_TURNS`, etc.). If the caller omits
`maxTurnsTotal`, the raw snapshot would show `undefined` -- useless for debugging.
Storing the resolved value (e.g., `100`) shows what actually governed the fill.

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
// In FillRecordSchema, new top-level field.
// Uses passthrough() so unknown keys from future FillOptions fields are
// preserved without requiring schema updates for each new option.
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
  recordPatches: z.boolean().optional(),
  prefillFieldIds: z.array(z.string()).optional(),
}).passthrough().optional(),
```

The `.passthrough()` is critical: it means when a new field is added to `FillOptions`
and flows through the `Omit`-based TypeScript type, it will be stored and round-tripped
through Zod even before the schema is updated to explicitly validate it.
This eliminates the drift between the TypeScript type (auto-evolving) and the Zod schema
(manually maintained).
Known fields get proper validation; unknown fields pass through as-is.

**Implementation:**

1. Add `config?: FillConfigSnapshot` to `FillRecordCollectorOptions`
2. Build the effective config **after default resolution** in `programmaticFill.ts`
   (i.e., after the `?? DEFAULT_*` lines), not from the raw `options` object
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

The per-turn snapshot reuses a subset of the canonical `ProgressCounts` fields.

**Derivation from `ProgressCounts`:**

| Per-turn field | Source | Formula |
| --- | --- | --- |
| `answeredFields` | `ProgressCounts.answeredFields` | Direct |
| `skippedFields` | `ProgressCounts.skippedFields` | Direct |
| `requiredRemaining` | `ProgressCounts.emptyRequiredFields` | Direct (fields that are both required and empty) |
| `optionalRemaining` | Derived | `unansweredFields - emptyRequiredFields` |

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

2. **`programmaticFill.ts`** -- Compute per-turn progress from the `ProgressCounts`
   returned by `getProgressCounts(form, targetRoles)` **after** each turn’s patches are
   applied. This must be called after `harness.apply()` so the form state reflects the
   turn.

3. **`TurnProgress`** -- Add optional `formProgressSnapshot` field to carry the computed
   counts through to `onTurnComplete()`.

4. **`fillRecordCollector.ts`** -- Accept and store per-turn progress in
   `onTurnComplete()` and pass through to timeline.

### FR-4. Opt-In Raw Patches Per Turn (`recordPatches`)

**Priority:** Medium (significant size impact, opt-in)

Add `recordPatches: boolean` to `FillOptions`. When enabled, store the raw `Patch[]`
submitted by the LLM each turn.

**Privacy note:** Raw patches contain field values that may include PII or sensitive
data.
Callers enabling `recordPatches` should be aware that the `.fill.json` sidecar will
contain all attempted field values, not just accepted ones.
See the Privacy & Redaction section below.

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

### FR-5. Per-Turn Issue Refs

**Priority:** Medium (enables understanding what the LLM was asked to do)

Add a compact representation of issues shown each turn.
Full `InspectIssue[]` is too large; compact structured issues are sufficient.

Note: `InspectIssue.ref` is not always a field ID -- `IssueScope` includes `form`,
`group`, `option`, `column`, and `cell`. We use the name `issueRefs` (not
`issueFieldIds`) to accurately reflect this.

**Changes:**

1. **`fillRecord.ts`** -- Add `issueRefs` to `TimelineEntrySchema`:

   ```typescript
   issueRefs: z.array(z.object({
     ref: z.string(),
     scope: z.string(),
     severity: z.string(),
     reason: z.string(),
   })).optional(),
   ```

   Keep `issuesAddressed: number` for backward compatibility.

   Each entry is a compact projection of `InspectIssue` (~4 fields vs ~7), omitting the
   human-readable `message`, `priority`, and `blockedBy` which are derivable from the
   other fields.

2. **`fillRecordCollector.ts`** -- Store compact issue refs in `turn_complete` event:

   ```typescript
   issueRefs: progress.issues?.map(i => ({
     ref: i.ref, scope: i.scope, severity: i.severity, reason: i.reason,
   })),
   ```

3. **`fillRecordCollector.ts`** -- Pass through to timeline builder.

**Size impact:** Moderate.
~4 short strings per issue, ~10 issues per turn = ~40 strings per turn.
Still much smaller than full `InspectIssue[]` (which includes long `message` strings).

### FR-6. Provenance Metadata

**Priority:** Medium (essential for batch reproducibility)

Add top-level fields for markform version, form content hash, and schema version.

**Changes:**

1. **`fillRecord.ts`** -- Add to `FillRecordSchema`:

   ```typescript
   markformVersion: z.string().optional(),
   inputFormSha256: z.string().optional(),
   fillRecordSchemaVersion: z.number().int().positive().optional(),
   ```

   **`inputFormSha256`** is the hash of the **original input form before filling**, not
   the per-turn `after.markdownSha256` from the harness transcript (which tracks the
   evolving filled form state at each turn).
   This distinction matters: `inputFormSha256` verifies the same template was used
   across a batch run; per-turn hashes track mutation.

   **`fillRecordSchemaVersion`** is an integer that increments whenever the FillRecord
   schema changes in a way that affects field semantics (added fields, renamed fields,
   changed derivation formulas).
   Starts at `1` with this spec.
   Downstream parsers can use this to handle version differences without inspecting
   individual fields.

2. **`fillRecordCollector.ts`** -- Accept and store in constructor/`getRecord()`.
   `markformVersion` comes from the build-time `VERSION` constant exported by `index.ts`
   (injected by tsdown as `__MARKFORM_VERSION__`; falls back to `'development'` in dev
   mode). Do NOT read `package.json` at runtime -- that is fragile across bundling
   contexts. `inputFormSha256` is computed from the serialized form markdown **before the
   first turn** (i.e., the pre-fill state).

3. **`programmaticFill.ts`** -- Compute `inputFormSha256` via
   `sha256(serializeForm(form))` before the fill loop begins.
   Pass version (from `VERSION`) and hash when constructing collector.

## Privacy & Redaction

The FillRecord is a diagnostic artifact, not a user-facing document.
However, it may contain sensitive data in several places:

| Field | Sensitivity | Mitigation |
| --- | --- | --- |
| `config.systemPromptAddition` | May contain proprietary instructions | Always captured; caller controls content |
| `patches` (FR-4, opt-in) | Contains attempted field values (PII, etc.) | Opt-in only via `recordPatches` |
| `rejectedPatches[].message` | May echo field values in error messages | Always-on; messages are structured errors, not raw values |
| `issueRefs[].ref` | Field IDs only, no values | Low risk |
| `eventLog` tool inputs/outputs | May contain field values | Already sanitized by `sanitizeEventLog()` |

**Policy:** No automatic redaction is applied.
Callers who handle sensitive data should:

1. Avoid enabling `recordPatches` unless the fill record will be stored securely
2. Be aware that `systemPromptAddition` is captured in the config snapshot
3. Use `customData` for any caller-specific redaction metadata

A future `redactFillRecord(record, policy)` utility could strip sensitive fields, but
this is out of scope for this spec.

## Implementation Plan

### Phase 1: Config Snapshot and Provenance (FR-1, FR-6)

These are the structural changes that prevent future iteration.

Files: `harnessTypes.ts`, `fillRecord.ts`, `fillRecordCollector.ts`,
`programmaticFill.ts`

- [ ] Define `FillConfigSnapshot` type using `Omit<FillOptions, ...>` in
  `harnessTypes.ts`
- [ ] Add `config?: FillConfigSnapshot` to `FillRecordCollectorOptions`
- [ ] Add `FillConfigSchema` (with `.passthrough()`) to `FillRecordSchema` in
  `fillRecord.ts`
- [ ] Add `markformVersion`, `inputFormSha256`, and `fillRecordSchemaVersion` fields to
  `FillRecordSchema`
- [ ] Build effective config **after default resolution** in `programmaticFill.ts`
  (after the `?? DEFAULT_*` lines, not from raw `options`)
- [ ] Compute `inputFormSha256` via `sha256(serializeForm(form))` before the fill loop
- [ ] Read `markformVersion` from the build-time `VERSION` constant in `index.ts`
- [ ] Set `fillRecordSchemaVersion: 1`
- [ ] Include `config`, `markformVersion`, `inputFormSha256`, `fillRecordSchemaVersion`
  in `getRecord()` output
- [ ] Also pass config in CLI fill command’s collector construction (`fill.ts`)
- [ ] If `inputContext` was provided, include `prefillFieldIds` (array of field IDs from
  `inputContext` keys) in the config snapshot

### Phase 2: Per-Turn Enrichment (FR-2, FR-3, FR-5)

Persist detail already available in `TurnProgress`.

Files: `fillRecord.ts`, `fillRecordCollector.ts`, `programmaticFill.ts`

- [ ] Add `rejectedPatches` array to `TimelineEntrySchema` (keep `patchesRejected`
  count)
- [ ] Add `formProgress` per-turn snapshot to `TimelineEntrySchema`
- [ ] Add `issueRefs` array to `TimelineEntrySchema` (keep `issuesAddressed` count)
- [ ] Update `TurnCompleteEvent` interface to carry rejection details, form progress,
  and issue refs
- [ ] Update `onTurnComplete()` to store full rejections, form progress, and issue refs
- [ ] Update `buildTimeline()` to pass new fields through to `TimelineEntry`
- [ ] Add `formProgressSnapshot` to `TurnProgress` in `harnessTypes.ts`
- [ ] Compute per-turn `formProgressSnapshot` in `programmaticFill.ts` by calling
  `getProgressCounts(form, targetRoles)` after `harness.apply()`, then mapping to the
  4-field snapshot using the derivation formulas in FR-3
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
  appear in FillRecord `config` with their resolved (post-default) values
- [ ] Add a compile-time type assertion that `FillConfigSnapshot` excludes exactly the
  non-serializable keys (e.g., `type _Check = Expect<Equal<keyof Omit<...>, ...>>`) so
  adding a non-serializable field to `FillOptions` without updating the exclude list
  produces a type error
- [ ] Add unit tests for rejection details: verify `rejectedPatches` array in timeline
  entries
- [ ] Add unit tests for per-turn form progress: verify `formProgress` snapshot per turn
  with correct derivation from `ProgressCounts`
- [ ] Add unit tests for issue refs: verify `issueRefs` in timeline entries with correct
  `ref`, `scope`, `severity`, `reason` fields
- [ ] Add unit tests for `recordPatches` opt-in: verify patches appear when enabled,
  absent when disabled
- [ ] Add unit tests for `markformVersion` and `inputFormSha256`
- [ ] Add unit test for `fillRecordSchemaVersion` presence
- [ ] Verify config snapshot round-trips through Zod `.passthrough()` for unknown keys
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
The Zod schema for config uses `.passthrough()` so unknown keys from future FillOptions
additions are preserved without schema updates.

The `fillRecordSchemaVersion` field enables downstream parsers to detect schema
generation and handle differences without brittle field-existence checks.

## Size Impact

| Change | Impact | Default |
| --- | --- | --- |
| Config snapshot | ~200-500 bytes | Always on |
| Rejection details | Negligible (sparse) | Always on |
| Form progress per turn | ~80 bytes/turn | Always on |
| Issue refs per turn | ~100-400 bytes/turn | Always on |
| markformVersion + inputFormSha256 + schemaVersion | ~120 bytes | Always on |
| Raw patches (FR-4) | ~50KB+ for large forms | Opt-in |

For a typical 30-turn fill with a 15K-line fill.json, the always-on additions add
roughly 5-15KB (~3-10%). Raw patches are the only item with significant size impact,
hence opt-in.

## Testing Strategy

- **Unit tests**: Verify each new field appears in FillRecord for known inputs
- **Config snapshot effective values**: Verify that omitted FillOptions produce resolved
  defaults in the config snapshot (e.g., missing `maxTurnsTotal` stores `100`)
- **Config snapshot passthrough**: Verify unknown keys survive Zod round-trip
- **Golden tests**: Regenerate snapshots; verify new fields appear in golden output
- **Tryscript tests**: Update CLI golden output if summary format changes
- **Manual QA**: Run a live fill with `--record-fill`, inspect `.fill.json` for:
  - `config` section with effective settings (resolved defaults, not `undefined`)
  - `rejectedPatches` arrays on turns with validation failures
  - `formProgress` on every timeline entry
  - `issueRefs` on every timeline entry (with `ref`, `scope`, `severity`, `reason`)
  - `markformVersion` and `inputFormSha256` at top level
  - `fillRecordSchemaVersion: 1` at top level

## Resolved Questions

1. **Should `systemPromptAddition` be in config snapshot?** Yes, always include.
   It’s usually short and critical for debugging.
   See Privacy & Redaction section for sensitivity notes.

2. **Should `inputContext` be in the config snapshot?** No -- `inputContext` is a data
   payload, not a configuration setting.
   Instead, include `prefillFieldIds: string[]` (the keys of `inputContext`) in the
   config snapshot. This provides reproducibility information (which fields were
   pre-filled) without storing potentially large values.

## References

- `attic/fill-record-gaps.md` -- Original gap analysis
- `packages/markform/src/harness/fillRecord.ts` -- FillRecord schema
- `packages/markform/src/harness/fillRecordCollector.ts` -- Event collector
- `packages/markform/src/harness/harnessTypes.ts` -- `FillOptions`, `TurnProgress`,
  `FillCallbacks`
- `packages/markform/src/harness/programmaticFill.ts` -- Fill loop, collector
  construction
- `packages/markform/src/index.ts` -- `VERSION` constant (build-time injected)
- `packages/markform/src/engine/coreTypes.ts` -- `ProgressCounts`, `InspectIssue`,
  `PatchRejection`, `IssueScope`
- PR #162 (`feat/fill-options-max-retries`) -- Example of new FillOptions field
