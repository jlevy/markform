---
type: is
id: is-01kj1av0s0tnpnqb314qmgabwk
title: "Phase 1a: Types, schema, and version foundation"
kind: task
status: open
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-02-21-fill-record-comprehensive-source-of-truth.md
labels: []
dependencies:
  - type: blocks
    target: is-01kj1avbcsfajkzp1pgd48pwha
  - type: blocks
    target: is-01kj1btjkz8gebb54dxynv081e
parent_id: is-01kj166gy9tgxd8203jhdfy7kp
created_at: 2026-02-22T00:08:55.326Z
updated_at: 2026-02-22T00:26:14.079Z
---
Foundation for all FRs. Reference: plan-2026-02-21-fill-record-comprehensive-source-of-truth.md

## 1. Create `packages/markform/src/version.ts` (NEW FILE)
Move VERSION constant from index.ts to avoid import cycle (index.ts re-exports fillForm from programmaticFill.ts, so programmaticFill.ts cannot import from index.ts).

```typescript
declare const __MARKFORM_VERSION__: string;
export const VERSION: string =
  typeof __MARKFORM_VERSION__ !== 'undefined' ? __MARKFORM_VERSION__ : 'development';
```

## 2. Update `packages/markform/src/index.ts` (lines 8-13)
Replace inline VERSION definition with re-export:
- Remove the `declare const __MARKFORM_VERSION__` and the `export const VERSION = ...` block.
- Add: `export { VERSION } from './version.js';`

## 3. Update `packages/markform/src/harness/harnessTypes.ts`

### 3a. Add `recordPatches` to FillOptions (after `recordFill` field, ~line 533)
```typescript
  /**
   * Include raw patches in FillRecord timeline entries.
   * When enabled, each timeline entry includes the full Patch[] submitted by the LLM.
   * Off by default due to size impact and potential PII in field values.
   */
  recordPatches?: boolean;
```

### 3b. Add TurnFormProgressSnapshot interface (after TurnProgress, ~line 579)
```typescript
export interface TurnFormProgressSnapshot {
  answeredFields: number;
  skippedFields: number;
  requiredRemaining: number;
  optionalRemaining: number;
}
```

### 3c. Add formProgressSnapshot to TurnProgress (after executionId field, ~line 578)
```typescript
  /** Per-turn form progress snapshot (computed after patches applied) */
  formProgressSnapshot?: TurnFormProgressSnapshot;
```

### 3d. Add FillConfigSnapshot type alias (after FillOptions, ~line 555)
```typescript
export type FillConfigSnapshot = Omit<
  FillOptions,
  | 'form'
  | 'model'
  | 'signal'
  | 'callbacks'
  | '_testAgent'
  | 'providers'
  | 'additionalTools'
  | 'inputContext'
> & { prefillFieldIds?: string[] };
```

## 4. Update `packages/markform/src/harness/fillRecord.ts`

### 4a. Add imports from coreTypes (line 15-19)
Add `PatchRejectionSchema` and `PatchSchema` to the existing import from coreTypes.

### 4b. Add FillConfigSchema (before FillRecordSchema, ~line 350)
```typescript
export const FillConfigSchema = z.object({
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
}).passthrough().optional();
```

### 4c. Add provenance + config fields to FillRecordSchema (after durationMs, ~line 379)
```typescript
  markformVersion: z.string().optional(),
  inputFormSha256: z.string().optional(),
  fillRecordSchemaVersion: z.number().int().positive().optional(),
  config: FillConfigSchema,
```

### 4d. Add enrichment fields to TimelineEntrySchema (after coercionWarnings, ~line 165)
```typescript
  rejectedPatches: z.array(PatchRejectionSchema).optional(),
  formProgress: z.object({
    answeredFields: z.number().int().nonnegative(),
    skippedFields: z.number().int().nonnegative(),
    requiredRemaining: z.number().int().nonnegative(),
    optionalRemaining: z.number().int().nonnegative(),
  }).optional(),
  issueRefs: z.array(z.object({
    ref: z.string(),
    scope: z.string(),
    severity: z.string(),
    reason: z.string(),
  })).optional(),
  patches: z.array(PatchSchema).optional(),
```

### 4e. Add same fields to EventTurnCompleteSchema (after coercionWarnings, ~line 285)
Same four optional fields as TimelineEntrySchema above.

### 4f. Update StableFillRecord type and stripUnstableFillRecordFields()
Add new top-level fields (markformVersion, inputFormSha256, fillRecordSchemaVersion, config) to the stable record output (lines 551-574).

### 4g. Fix sessionId validation (line 373)
Change `z.string().uuid()` to `z.string()` since runtime generates `sess-<ulid>`, not UUID.

## 5. Export new types from `packages/markform/src/index.ts`
- Export `FillConfigSnapshot` and `TurnFormProgressSnapshot` from harnessTypes.ts
- Export `FillConfigSchema` from fillRecord.ts
