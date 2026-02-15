# Plan Spec: FillRecord Performance & Concurrency Metrics

**Date:** 2026-02-14

**Author:** Joshua Levy with LLM assistance

**Status:** Draft

**Related:**
- `attic/markform-fill-record-analysis.md` — Arena usage analysis and upstream proposals
- `docs/project/specs/done/plan-2026-01-29-fill-record.md` — Original FillRecord spec
- `docs/project/specs/done/plan-2026-01-30-fill-record-visualization.md` — HTML
  dashboard

## Overview

Enrich FillRecord with computed performance and concurrency metrics that downstream
consumers (Arena, dataroom browser, batch pipelines) currently compute independently.
All raw data already exists in the FillRecord — these changes add derived fields and
improve the text/HTML summaries so that key insights are immediately visible without
requiring consumers to reinvent the same calculations.

The single most impactful metric is **effective parallelism** — a ratio showing how much
concurrent work happened relative to wall-clock time.
Every downstream consumer computes this independently today.

## Goals

- Make wall-clock time, total work time, and effective parallelism immediately visible
  in both text and HTML summaries
- Enrich the non-verbose text summary with timing and rate info (currently requires
  `--verbose` to see any timing breakdown)
- Show s/field and s/turn rates in the summary for immediate sense of fill speed
- Add aggregate average tool duration to ToolSummary (per-tool avg exists but no
  aggregate)
- Show parallel execution details in verbose summary when applicable

## Non-Goals

- Tool failure tiering (critical vs.
  warning thresholds) — policy choice, stays downstream
- Called vs. uncalled tool reporting — requires external tool configuration list
- Cost estimation — requires pricing database, stays downstream
- Max-turns false positive suppression — consumer-specific heuristic

## Background

Arena wraps Markform’s `fillForm()` with `recordFill: true` and consumes FillRecord in
three places: CLI display, batch pipeline storage, and dataroom visualization.
A detailed gap analysis (`attic/markform-fill-record-analysis.md`) identified several
metrics that Arena computes from raw FillRecord data that should live upstream:

| Metric | How Arena Computes It | Why Upstream |
| --- | --- | --- |
| Avg concurrency | `(llmTimeMs + toolTimeMs) / totalMs` | Every consumer reinvents this |
| Avg tool duration | `totalDurationMs / totalCalls` | Per-tool avg exists; aggregate doesn't |

Rate metrics like s/field and s/turn are trivially derived from existing fields
(`durationMs / answeredFields`, `durationMs / totalTurns`) and belong in the display
layer, not the schema.

Additionally, the non-verbose text summary (`formatFillRecordSummary`) currently omits
all timing and parallelism information, forcing consumers to either use verbose mode or
compute their own display.

### Key Insight: Timing Values Under Parallelism

`llmTimeMs` and `toolTimeMs` are **sums of individual durations** (not de-overlapped
wall-clock segments).
They represent “total work time” and can exceed wall-clock `totalMs` when operations run
concurrently. This is the foundation of the concurrency metric:
`effectiveParallelism = totalWorkMs / totalMs`. A value of 2.1x means that on average,
2.1 units of work were happening simultaneously.

## Design

### 1. Add `effectiveParallelism` to `TimingBreakdown`

Add a single computed field:

```typescript
// In TimingBreakdownSchema
effectiveParallelism: z.number().nonnegative(),  // (llmTimeMs + toolTimeMs) / totalMs
```

**Why:** All raw data already exists.
This one-line ratio is the single metric every consumer computes downstream.
It’s not obvious from the existing fields that `llmTimeMs + toolTimeMs` can exceed
`totalMs`, so making it explicit is self-documenting.

**Interpretation:**
- `< 1.0x` — idle time / overhead between operations (common in serial mode)
- `1.0x` — all time spent doing useful work, no idle gaps
- `> 1.0x` — parallelism, multiple operations overlapping in time

**Computed in:** `calculateTimingBreakdown()` in `fillRecordCollector.ts`.

### 2. Add `avgDurationMs` to `ToolSummary`

```typescript
// In ToolSummarySchema
avgDurationMs: z.number().nonnegative(),  // totalDurationMs / totalCalls
```

Uses milliseconds consistent with all other duration fields in the schema (`totalMs`,
`llmTimeMs`, `toolTimeMs`, `totalDurationMs`, per-tool `timing.avgMs`, etc.).

**Why:** The per-tool `timing.avgMs` already exists, but there’s no aggregate average
across all tools. Arena computes this as `totalDurationMs / totalCalls`. It’s a useful
single number for “how expensive are tool calls on average?”

**Computed in:** `calculateToolSummary()` in `fillRecordCollector.ts`.

### 3. Display-Only Rate Metrics (No Schema Changes)

The summary formatter computes **s/field** and **s/turn** at display time:

- `s/field = (durationMs / answeredFields) / 1000`
- `s/turn = (durationMs / totalTurns) / 1000`

These are trivially derived from existing FillRecord fields (`durationMs`,
`formProgress.answeredFields`, `execution.totalTurns`) and do not warrant schema
additions. They belong in the display layer only.

**Significant figures:** Format with appropriate precision — use 1 decimal for values
> = 10s (e.g., `12.3s/field`), 2 decimals for values >= 1s (e.g., `3.45s/field`), and ms
> for sub-second values (e.g., `450ms/field`).

### 4. Enrich Non-Verbose `formatFillRecordSummary`

The current non-verbose output:

```
Fill completed in 45.2s (12 turns)

Tokens:  125,432 input / 8,901 output (anthropic/claude-sonnet-4-5)
Tools:   34 calls (32 succeeded, 2 failed)

Progress: 135/139 fields filled (97%)
```

Proposed non-verbose output (additions marked with `+`):

```
Fill completed in 45.2s (12 turns, 3.77s/turn, 0.33s/field) + rates
                                                              (computed at display time)
Tokens:  125,432 input / 8,901 output (anthropic/claude-sonnet-4-5)
Tools:   34 calls (32 succeeded, 2 failed), avg 1.23s each  + avg tool duration
Timing:  62% LLM | 30% tools | 8% overhead                  + timing split

Progress: 135/139 fields filled (97%)
```

Three small additions:
1. **s/turn and s/field** on the status line — immediate sense of fill speed, computed
   at display time from existing fields
2. **Avg tool duration** on the tools line — from `avgDurationMs` in schema
3. **One-line timing split** — where time was spent (always shown, not just verbose)

### 5. Add Parallelism Info to Verbose Summary

When `execution.parallelEnabled` is true and verbose mode is on, add after the timing
line:

```
Timing:  62% LLM (28.3s) | 30% tools (14.1s) | 8% overhead (3.8s)
         Effective parallelism: 2.1x (3 threads, 2 order levels)
```

For serial fills, show the metric only if it’s meaningfully different from 1.0x
(threshold: show if `< 0.8x` to highlight overhead):

```
Timing:  62% LLM (28.3s) | 30% tools (14.1s) | 8% overhead (3.8s)
         Effective parallelism: 0.7x
```

### 6. Update HTML Dashboard

Update `fillRecordRenderer.ts` to display the new metrics in the summary cards section:

- Add an “Effective Parallelism” card when `effectiveParallelism` is available
- Add s/field and s/turn rates to the existing duration card (computed at render time)
- Show avg tool duration in the tool summary table header

## Implementation Plan

### Phase 1: Schema & Computation Changes

Files: `fillRecord.ts`, `fillRecordCollector.ts`

- [ ] Add `effectiveParallelism` field to `TimingBreakdownSchema` (dimensionless ratio)
- [ ] Add `avgDurationMs` field to `ToolSummarySchema` (milliseconds)
- [ ] Update `calculateTimingBreakdown()` to compute `effectiveParallelism`
- [ ] Update `calculateToolSummary()` to compute `avgDurationMs`

### Phase 2: Text Summary Improvements

File: `formatFillRecordSummary.ts`

- [ ] Add s/turn and s/field rates to the status line (non-verbose, computed at display
  time)
- [ ] Add avg tool duration to the tools line (non-verbose, from `avgDurationMs`)
- [ ] Show one-line timing split in non-verbose mode (move from verbose-only)
- [ ] Add effective parallelism + thread info to verbose output
- [ ] Format values with appropriate significant figures (see §3 for rules)
- [ ] Round percentage values to integers for cleaner display

### Phase 3: HTML Dashboard Updates

File: `fillRecordRenderer.ts`

- [ ] Add effective parallelism summary card
- [ ] Add s/field and s/turn rates to the duration card (computed at render time)
- [ ] Show avg tool duration in tool summary section
- [ ] Add parallelism info near the Gantt timeline when parallel execution was used

### Phase 4: Tests & Golden File Updates

- [ ] Add unit tests for new computed fields (`effectiveParallelism`, `avgDurationMs`)
- [ ] Test edge cases: zero duration, zero tool calls, zero fields, serial vs.
  parallel
- [ ] Test significant figures formatting for s/field and s/turn display
- [ ] Update tryscript CLI golden tests for new summary format
- [ ] Update golden session tests if fill record snapshots are affected
- [ ] Run `pnpm precommit` to verify everything passes

## Backward Compatibility

Not a concern for this change.
FillRecord is still evolving and downstream consumers can adapt.
Prioritize clear, consistent naming over additive-only constraints.
New fields (`effectiveParallelism`, `avgDurationMs`) will appear in `.fill.json` sidecar
files and the text/HTML summaries will show additional information.

## Testing Strategy

- **Unit tests**: Verify computed field values for known inputs (serial fill, parallel
  fill, zero-duration edge cases).
  Verify significant figures formatting.
- **Tryscript tests**: Update golden CLI output to match new summary format
- **Golden session tests**: Regenerate if FillRecord schema changes affect snapshots
- **Manual QA**: Run a live fill with `--record-fill --verbose` and verify the output
  shows all new metrics correctly

## Optional Future Improvements

These are lower priority and can be done in separate follow-up work:

- **Concurrency timeline visualization**: Show effective parallelism over time in the
  Gantt chart (not just aggregate)
- **Per-order-level timing**: Break down timing by order level to show where parallel
  execution helped most
- **FillRecord comparison mode**: Side-by-side comparison of two FillRecords (e.g.,
  serial vs. parallel, different models)

## References

- `attic/markform-fill-record-analysis.md` — Full Arena gap analysis
- `packages/markform/src/harness/fillRecord.ts` — FillRecord schema
- `packages/markform/src/harness/fillRecordCollector.ts` — Event collector
- `packages/markform/src/harness/formatFillRecordSummary.ts` — Text formatter
- `packages/markform/src/render/fillRecordRenderer.ts` — HTML dashboard renderer
