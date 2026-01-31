# Feature: FillRecord Visualization in Serve Command

**Date:** 2026-01-30

**Author:** Claude (with user direction)

**Status:** Draft

## Overview

Add a new "Fill Record" tab to the `markform serve` command that provides a clean,
interactive visualization of FillRecord data. This tab will show exactly what happened
during a form fill operation—tool calls, token usage, timing breakdown, and turn-by-turn
timeline—in an elegant, easy-to-understand format.

## Goals

- **Transparency**: Show users exactly what happened during form filling
- **Clean visualization**: Present complex data in an intuitive, visually appealing way
- **Lightweight**: Minimal external dependencies, fast to load from CDN
- **Interactive**: Expandable/collapsible sections for detailed exploration
- **Copy-friendly**: Allow users to copy raw JSON/YAML for debugging or integration

## Non-Goals

- **Real-time streaming**: This visualizes completed fill records, not live fills
- **Editing**: The fill record is read-only (it's historical data)
- **Cost calculation**: We show tokens, but leave cost calculation to the client
- **Comparison**: Comparing multiple fill records is out of scope

## Scope: All Fill Record Statuses

The serve command will **primarily** show completed fill records, but the visualization
must handle all four FillRecord status values:

| Status      | When It Occurs                              | Visualization Needs |
|-------------|---------------------------------------------|---------------------|
| `completed` | Form fill finished successfully             | Standard display    |
| `partial`   | Hit max_turns before completing             | Warning banner, show progress gap |
| `cancelled` | User aborted via AbortSignal                | Cancelled banner, show what was done |
| `failed`    | Error during fill (see prerequisites below) | Error banner with message |

For debugging and analysis, partial/cancelled/failed fill records are often **more
valuable** than completed ones—they show what went wrong and where.

## Background

### Current State

The `markform serve` command provides an interactive web interface for browsing forms
with multiple tabs:

| Tab    | Content                                      |
|--------|----------------------------------------------|
| View   | Read-only rendered view of form values       |
| Edit   | Interactive form for editing field values    |
| Source | Raw markdown source with syntax highlighting |
| Report | Human-readable report format                 |
| Values | YAML export of form values                   |
| Schema | JSON Schema representation                   |

The FillRecord data structure (see `plan-2026-01-29-fill-record.md`) captures complete
execution data from form fills:

- **Session metadata**: ID, timestamps, duration
- **Form info**: ID, title, structure summary
- **LLM usage**: Provider, model, token counts
- **Tool summary**: Per-tool statistics with timing percentiles
- **Timing breakdown**: LLM vs tools vs overhead
- **Timeline**: Turn-by-turn history with tool calls
- **Execution metadata**: Parallel execution threads, order levels

### Data Flow

When a form is served that has an associated `.fill.json` sidecar file:

```
example.form.md          → Form content
example.fill.json        → FillRecord data (if exists)
```

The serve command should detect the sidecar file and enable the Fill Record tab.

## Design Options

### Option A: Enhanced YAML Tree View

A syntax-highlighted YAML view with interactive tree navigation.

**Approach:**
- Render FillRecord as YAML with proper indentation
- Add expand/collapse toggles for nested sections (timeline, toolSummary)
- Use color coding for different data types (numbers, strings, timestamps)
- Keyboard navigation support

**Pros:**
- Simple implementation, reuses existing YAML rendering
- Complete data visibility—nothing hidden
- Familiar format for developers
- No external dependencies needed

**Cons:**
- Still feels like "raw data" rather than a purpose-built UI
- Timeline section can get very long
- Tool calls are hard to scan quickly

### Option B: Card-Based Dashboard

A structured dashboard with distinct sections/cards for each data category.
Organized to mirror the FillRecord data structure: **summary data first, details after**.

**Approach:**
```
┌─────────────────────────────────────────────────────────┐
│ Fill Summary (aggregated metrics)                       │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐ │
│ │ 3 turns │ │ 12.4s   │ │ 86%     │ │ 5 tool calls    │ │
│ │ Total   │ │ Duration│ │ Filled  │ │ 4 web searches  │ │
│ └─────────┘ └─────────┘ └─────────┘ └─────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ Timing Breakdown                 Token Usage            │
│ ┌──────────────────────────┐     ┌────────────────────┐ │
│ │ ████████████░░░░░░░░░░░░ │     │ Input:   2,450     │ │
│ │ LLM: 6.8s | Tools: 5.1s  │     │ Output:    890     │ │
│ │ Overhead: 0.5s           │     │ Total:   3,340     │ │
│ └──────────────────────────┘     └────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ Tool Summary (aggregated stats by tool)                 │
│ ┌───────────────┬────────┬─────────┬─────────┬────────┐ │
│ │ Tool          │ Calls  │ Success │ Avg     │ p95    │ │
│ ├───────────────┼────────┼─────────┼─────────┼────────┤ │
│ │ web_search    │ 4      │ 100%    │ 1.2s    │ 2.1s   │ │
│ │ fill_form     │ 1      │ 100%    │ 50ms    │ 50ms   │ │
│ └───────────────┴────────┴─────────┴─────────┴────────┘ │
├─────────────────────────────────────────────────────────┤
│ ▼ Timeline (detailed turn-by-turn history)              │
│   ┌─────────────────────────────────────────────────┐   │
│   │ Turn 1 • 2.1s • 5 tool calls                    │   │
│   │   ▼ web_search: "CEO of Acme Corp" → 8 results  │   │
│   │   ▼ web_search: "founded date" → 3 results      │   │
│   │   ...                                           │   │
│   └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Note:** Timing uses **absolute durations** (6.8s, 5.1s) rather than percentages for clarity.

**Pros:**
- Purpose-built UI, easier to scan quickly
- Visual hierarchy matches mental model
- Expandable timeline doesn't overwhelm
- Progress bars and metrics are visually clear

**Cons:**
- More complex implementation
- Custom CSS required
- Harder to copy full data

### Option C: D3.js Timeline Visualization

An interactive timeline using D3.js for rich data visualization.

**Approach:**
- Horizontal timeline showing turns
- Gantt-chart style bars for tool execution
- Hover for details, click to expand
- Color-coded by tool type

**Library options:**
- **D3.js** (~280KB gzipped): Full-featured, highly customizable
- **Chart.js** (~65KB gzipped): Simpler, good for basic charts
- **Frappe Gantt** (~25KB gzipped): Lightweight Gantt chart library
- **vis-timeline** (~150KB gzipped): Timeline-specific visualization

**Pros:**
- Beautiful, interactive visualizations
- Parallel execution clearly visible
- Professional appearance

**Cons:**
- Larger bundle size (even from CDN)
- Overkill for simple form fills
- Accessibility concerns
- Adds complexity for maintenance

### Option D: Hybrid Approach (Recommended)

Combine Options A and B: A card-based dashboard with expandable sections that can
reveal raw YAML/JSON data. Structure mirrors the FillRecord schema—**summary aggregates
first, detailed timeline last**.

**Approach:**

1. **Status Banner** (if non-completed):
   - For `partial`: "Fill incomplete - hit max turns (X/Y fields filled)"
   - For `cancelled`: "Fill cancelled by user"
   - For `failed`: "Fill failed: {error message}"

2. **Summary Cards** (always visible):
   - Status badge (completed/partial/failed/cancelled)
   - Total duration (absolute: "12.4s")
   - Turn count
   - Token totals (input/output)
   - Progress (fields filled/total)

3. **Timing Breakdown** (collapsible):
   - Horizontal stacked bar showing LLM/tools/overhead
   - **Absolute durations** (e.g., "LLM: 6.8s | Tools: 5.1s | Overhead: 0.5s")
   - Clearer than percentages for understanding actual time spent

4. **Tool Summary Table** (collapsible):
   - Aggregated per-tool statistics
   - Call counts, success rates, timing percentiles (avg, p95)
   - Result counts for applicable tools (web_search)

5. **Timeline Section** (collapsible, collapsed by default for long fills):
   - Turn-by-turn accordion
   - Each turn: duration, tokens, patches applied/rejected
   - Expand to see individual tool calls with inputs/outputs

6. **Raw Data Section** (collapsed by default):
   - Full YAML with syntax highlighting (reuse `renderYamlContent()` from Values tab)
   - Copy buttons for both YAML and JSON formats
   - Consistent styling with existing serve tabs

**Implementation details:**
- **No external JS libraries**: Pure HTML/CSS with vanilla JS for interactivity
- **CSS-only visualizations**: Bar charts via flexbox/grid + proportional widths
- **Semantic HTML**: Accessible, screen-reader friendly
- **Mobile responsive**: Cards stack vertically on narrow screens

## Recommended Design: Option D (Hybrid)

### Visual Mockup — Completed Fill

```
╔═══════════════════════════════════════════════════════════════════════════╗
║  Fill Record                                                    [Copy JSON]║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  ══════════════════════════ SUMMARY ══════════════════════════════════    ║
║                                                                           ║
║  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  ║
║  │ ✓ Completed │  │   12.4s     │  │  5 turns    │  │  3,340 tokens   │  ║
║  │   Status    │  │  Duration   │  │   Turns     │  │  2,450 in/890 out│ ║
║  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘║
║                                                                           ║
║  Progress                                                                 ║
║  ┌───────────────────────────────────────────────────────────────────────┐║
║  │ ████████████████████████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░ │║
║  │ 18/21 fields filled (86%)  •  3 skipped                              │║
║  └───────────────────────────────────────────────────────────────────────┘║
║                                                                           ║
║  ▼ Timing Breakdown (12.4s total)                                         ║
║  ┌───────────────────────────────────────────────────────────────────────┐║
║  │ LLM Calls    ███████████████████████████████░░░░░░░░░░░░░░░░░  6.8s  │║
║  │ Tool Exec    █████████████████████████░░░░░░░░░░░░░░░░░░░░░░░  5.1s  │║
║  │ Overhead     ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  0.5s  │║
║  └───────────────────────────────────────────────────────────────────────┘║
║                                                                           ║
║  ▼ Tool Summary                                                           ║
║  ┌───────────────────────────────────────────────────────────────────────┐║
║  │ Tool          │ Calls │ Success │  Avg   │  p95   │ Results          │║
║  │───────────────│───────│─────────│────────│────────│──────────────────│║
║  │ web_search    │   4   │  100%   │  1.2s  │  2.1s  │ 23 total, 0 empty│║
║  │ fill_form     │   1   │  100%   │  50ms  │  50ms  │ —                │║
║  └───────────────────────────────────────────────────────────────────────┘║
║                                                                           ║
║  ══════════════════════════ DETAILS ══════════════════════════════════    ║
║                                                                           ║
║  ▼ Timeline (5 turns)                                                     ║
║  ┌───────────────────────────────────────────────────────────────────────┐║
║  │ ▶ Turn 1 • Order 0 • 2.1s • 1,200 tokens                             │║
║  │   ├─ web_search "CEO of Acme Corp" → 8 results (1.3s)                │║
║  │   ├─ web_search "Acme Corp founded" → 3 results (0.8s)               │║
║  │   └─ fill_form: 3 patches applied                                    │║
║  │                                                                       │║
║  │ ▶ Turn 2 • Order 0 • 1.8s • 890 tokens                               │║
║  │   ...                                                                 │║
║  └───────────────────────────────────────────────────────────────────────┘║
║                                                                           ║
║  ▶ Raw YAML                                                    [Copy JSON]║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### Visual Mockup — Partial Fill (max_turns hit)

```
╔═══════════════════════════════════════════════════════════════════════════╗
║  Fill Record                                                    [Copy JSON]║
╠═══════════════════════════════════════════════════════════════════════════╣
║  ┌───────────────────────────────────────────────────────────────────────┐║
║  │ ⚠️  PARTIAL: Hit max turns (10) before completion                     │║
║  │     12/21 fields remain unfilled                                      │║
║  └───────────────────────────────────────────────────────────────────────┘║
║                                                                           ║
║  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  ║
║  │ ⚠ Partial   │  │   45.2s     │  │  10 turns   │  │  12,450 tokens  │  ║
║  │   Status    │  │  Duration   │  │  (max)      │  │  10.2k in/2.2k out║
║  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘║
║  ...                                                                      ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### Visual Mockup — Failed Fill

```
╔═══════════════════════════════════════════════════════════════════════════╗
║  Fill Record                                                    [Copy JSON]║
╠═══════════════════════════════════════════════════════════════════════════╣
║  ┌───────────────────────────────────────────────────────────────────────┐║
║  │ ❌ FAILED: Rate limit exceeded (429) after 3 turns                    │║
║  │    Error: API rate limit exceeded. Please retry after 60 seconds.    │║
║  └───────────────────────────────────────────────────────────────────────┘║
║                                                                           ║
║  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  ║
║  │ ❌ Failed   │  │   8.3s      │  │  3 turns    │  │  2,100 tokens   │  ║
║  │   Status    │  │  Duration   │  │  (stopped)  │  │  1.8k in/300 out │ ║
║  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘║
║  ...                                                                      ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### Components

**Design principle:** Reuse existing serve.ts rendering functions where possible for
UI consistency and reduced code.

1. **FillRecord Tab Handler** (`serve.ts`)
   - Detect `.fill.json` sidecar file when serving a form
   - Add "Fill Record" tab to tab list when sidecar exists
   - Serve rendered HTML at `/tab/fill-record`

2. **FillRecord Renderer** (new function in `serve.ts`)
   - `renderFillRecordContent(record: FillRecord): string`
   - Generates HTML with embedded CSS for the dashboard
   - Uses semantic HTML for accessibility

3. **Reused Components** (from existing serve.ts):
   - `renderYamlContent()` — For Raw YAML section (same as Values tab)
   - `escapeHtml()` — HTML escaping utility
   - Existing table styles (`.data-table`) — For tool summary table
   - Tab content container styles (`.tab-content`)

4. **New CSS Styles** (embedded, minimal additions):
   - `.fill-record-dashboard`: Main container
   - `.metric-card`: Status, duration, turns, tokens cards
   - `.status-banner`: Warning/error banner for non-completed fills
   - `.progress-bar`: Field completion progress (simple div with percentage width)
   - `.timing-bar`: Horizontal bar segments (flexbox)
   - `.timeline-accordion`: Expandable turn list

5. **JavaScript** (minimal, embedded)
   - Accordion expand/collapse for sections
   - Copy to clipboard (YAML and JSON formats)
   - No external dependencies

### API Changes

**Tab Interface Update:**
```typescript
interface Tab {
  id: 'view' | 'form' | 'source' | 'report' | 'values' | 'schema' | 'fill-record';
  label: string;
  path: string | null;
}
```

**New Functions:**
```typescript
// Check if fill record sidecar exists
function getFillRecordPath(formPath: string): string | null;

// Load and parse fill record from sidecar file
function loadFillRecord(fillRecordPath: string): Promise<FillRecord | null>;

// Render fill record as HTML dashboard
function renderFillRecordContent(record: FillRecord): string;
```

## Implementation Plan

### Phase 1: Error Finalization (Fill Record on Failure)

Code investigation reveals **gaps in partial/failed fill record handling** that must
be fixed for the visualization to be useful for debugging failed fills.

**Current State:**

| Status      | Currently Supported? | Notes |
|-------------|---------------------|-------|
| `completed` | ✅ Yes | Works correctly |
| `partial`   | ✅ Yes | Set when max_turns hit |
| `cancelled` | ✅ Yes | Set when AbortSignal fires |
| `failed`    | ✅ Yes | **Now supported** (see implementation below) |

**Tasks:**

- [x] **Gap 1: Add `failed` status support in programmaticFill** ✅
  - Wrapped agent.fillFormTool in try/catch
  - Calls `collector.setStatus('failed', errorMessage)` on caught errors
  - Returns fill record in error result when collector has data
  - Also added fill record to cancelled status returns
  - Commit: `feat: add fill record support for failed/cancelled status in fillForm`

- [ ] **Gap 2: CLI error handler must write fill record** (deferred)
  - Location: `packages/markform/src/cli/commands/fill.ts:772`
  - Would require more invasive changes to the CLI command
  - Lower priority since programmaticFill now handles errors correctly

- [ ] **Gap 3: Ensure `buildErrorResult` can include FillRecord** (deferred)
  - For early errors before collector is created, this is acceptable
  - Mid-fill errors now handled by Gap 1 fix

- [x] Add tests for partial/failed fill record generation ✅
  - Added 4 new tests in `programmaticFill.test.ts`:
    - `returns FillRecord with failed status when agent throws mid-fill`
    - `fill record captures partial data before error`
    - `cancelled status includes fill record when recordFill enabled`
    - `partial status includes fill record when max_turns hit`

### Phase 2: Core Visualization ✅ IMPLEMENTED

- [x] Add fill record sidecar detection in serve command ✅
  - Added `getFillRecordSidecarPath()` helper function
  - Checks for `.fill.json` file next to form
- [x] Extend Tab interface to include 'fill-record' tab ID ✅
- [x] Update `buildFormTabs()` to conditionally include Fill Record tab ✅
- [x] Implement `/tab/fill-record` route handler ✅
  - Loads and parses JSON from sidecar file
  - Passes FillRecord to renderer
- [x] Create `renderFillRecordContent()` function ✅
  - Status banner for non-completed fills
  - Summary cards (status, duration, turns, tokens)
  - Progress bar with percentage
  - Timing breakdown with visual bars (LLM/tools/overhead)
  - Tool summary table (call counts, success rates, timing)
  - Timeline accordion (turn-by-turn with tool calls)
  - Raw YAML section with copy button
- [x] Add CSS styles ✅ (inline styles for simplicity)
- [x] Add JavaScript for interactivity ✅
  - Using native HTML `<details>` for accordion (no JS needed)
  - Copy button using `navigator.clipboard` API

Commit: `feat: add Fill Record tab to serve command`

### Phase 3: Polish (completed 2026-01-31)

- [x] Mobile responsive layout adjustments (CSS grid with breakpoints)
- [x] Keyboard navigation for accordion (native `<details>` provides this)
- [x] Dark mode support (CSS custom properties with `prefers-color-scheme`)
- [ ] Loading states for async tab content (not needed - static content)

## Testing Strategy

1. **Manual Testing:**
   - Run `markform fill` with `--record-fill` to generate test data
   - Serve the filled form and verify Fill Record tab appears
   - Check all sections render correctly
   - Test accordion expand/collapse
   - Test JSON copy functionality

2. **Visual Regression:**
   - Screenshot comparison for consistent rendering

3. **Edge Cases:**
   - Empty timeline (mock mode with 0 turns)
   - Very long timelines (10+ turns)
   - Failed fills (status: 'failed')
   - Parallel execution (multiple execution threads)

## Rollout Plan

1. Implement behind existing feature (no flag needed—tab only shows if sidecar exists)
2. Documentation update in `docs/markform-apis.md`
3. Example in README showing fill record visualization

## Open Questions

1. **Should we support loading fill records by URL parameter?**
   e.g., `markform serve form.md --fill-record other.fill.json`

   *Recommendation:* Start with auto-detection only, add flag in future if needed.

2. **How should we handle mismatched form/fill-record pairs?**
   e.g., form.id in fill record doesn't match the served form.

   *Recommendation:* Show a warning banner but still display the data.

3. **Should the timeline show full tool inputs/outputs?**
   For web_search, showing the full query is useful. For fill_form, showing all
   patches might be verbose.

   *Recommendation:* Show query for web_search, show patch count + summary for
   fill_form. Full details available in Raw JSON section.

## Implementation Notes

### Decisions Made During Implementation

1. **CSS custom properties for theming**: Used CSS custom properties (`--fr-*` prefix)
   for all colors and spacing. This enables theming and provides automatic dark mode
   support via `@media (prefers-color-scheme: dark)`. The styles are extracted into
   a reusable `FILL_RECORD_STYLES` constant.

2. **BEM-like class naming**: All classes use `.fr-*` prefix (fill-record) with
   BEM-like naming (`.fr-card`, `.fr-badge--completed`, etc.) for maintainability
   and to avoid conflicts with serve's existing styles.

3. **Native HTML details/summary for accordions**: Used `<details>` and `<summary>`
   elements for collapsible sections instead of custom JavaScript. This provides
   accessibility and keyboard navigation out of the box.

4. **YAML for raw data**: Used YAML instead of JSON for the raw data section
   (reusing `renderYamlContent()`) for consistency with the Values tab and better
   readability.

5. **Sidecar path convention**: The fill record sidecar is expected at
   `<form-name>.fill.json` (replacing `.form.md` with `.fill.json`).

6. **Exported utilities**: `formatDuration()` and `formatTokens()` are exported
   for reuse in other visualizations or CLI output.

### Known Limitations

1. **No form/record validation**: The implementation doesn't validate that the
   fill record matches the form being served. If the form.id differs, the data
   is still displayed.

2. **No stable fill record support**: Currently only detects `.fill.json` sidecars,
   not `.fill.stable.json` variants.

3. **Copy button requires HTTPS in production**: The `navigator.clipboard` API
   requires a secure context. Works on localhost but may need fallback for
   non-HTTPS deployments.

## References

- `docs/project/specs/active/plan-2026-01-29-fill-record.md` — FillRecord data design
- `packages/markform/src/harness/fillRecord.ts` — FillRecord Zod schemas
- `packages/markform/src/cli/commands/serve.ts` — Serve command implementation
- `packages/markform/src/harness/formatFillRecordSummary.ts` — Text summary formatter
