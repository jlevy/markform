# Markform APIs

Markform provides TypeScript APIs for parsing, validating, and manipulating forms
programmatically.

## CLI

The `markform` CLI is self-documenting:

```bash
markform --help              # List all commands
markform <command> --help    # Help for specific command
markform docs                # Form syntax quick reference
markform spec                # Full specification
markform apis                # This document
```

**Form syntax:** See [markform-reference.md](markform-reference.md) for the quick
reference on form syntax, field kinds, and attributes.

## Project Installation

```bash
npm install markform
```

## Core Engine API

Import from the main package:

```typescript
import {
  parseForm,
  serializeForm,
  serializeReport,
  validate,
  inspect,
  applyPatches,
} from 'markform';
```

### parseForm(content: string): ParsedForm

Parse a `.form.md` file into a structured form object.

### serializeForm(form: ParsedForm, options?: SerializeOptions): string

Convert a parsed form back to Markdown.

### serializeReport(form: ParsedForm): string

Generate a filtered markdown report suitable for sharing.
Produces clean, readable markdown with:

- Fields and groups with `report=false` excluded

- Documentation blocks with `report=false` excluded

- Instructions blocks excluded by default (unless `report=true`)

This is useful for generating shareable reports from completed forms without internal
instructions or agent-only content.

### validate(form: ParsedForm, options?: ValidateOptions): ValidateResult

Validate form syntax and constraints.

### inspect(form: ParsedForm, options?: InspectOptions): InspectResult

Get form state including structure, progress, and validation issues.

### applyPatches(form: ParsedForm, patches: Patch[]): ApplyResult

Apply value changes to a form.
Modifies the form in place.

## Vercel AI SDK Integration

Import from the ai-sdk subpath:

```typescript
import {
  createMarkformTools,
  MarkformSessionStore
} from 'markform/ai-sdk';
```

### MarkformSessionStore

Session store for managing form state during AI interactions.

```typescript
const store = new MarkformSessionStore(parsedForm);
```

### createMarkformTools(options): MarkformToolSet

Create AI SDK compatible tools for agent-driven form filling.

```typescript
import { generateText } from 'ai';

const tools = createMarkformTools({ sessionStore: store });
const { text } = await generateText({
  model: yourModel,
  tools,
  prompt: 'Fill out this form...',
});
```

**Available tools:**

| Tool | Description |
| --- | --- |
| `markform_inspect` | Get form state, structure, progress, issues |
| `markform_apply` | Apply patches to update field values |
| `markform_export` | Export schema and values as JSON |
| `markform_get_markdown` | Get canonical Markdown representation |

See [vercelAiSdkTools.ts](../packages/markform/src/integrations/vercelAiSdkTools.ts) for
full details.

### Patch Operations

Use `markform_apply` with an array of patches.
Each patch has an `op` and `fieldId`.

| Operation | Fields | Value Format |
| --- | --- | --- |
| `set_string` | string | `{ "op": "set_string", "fieldId": "name", "value": "Alice" }` |
| `set_number` | number | `{ "op": "set_number", "fieldId": "age", "value": 25 }` |
| `set_string_list` | string_list | `{ "op": "set_string_list", "fieldId": "tags", "value": ["a", "b"] }` |
| `set_single_select` | single_select | `{ "op": "set_single_select", "fieldId": "rating", "value": "high" }` |
| `set_multi_select` | multi_select | `{ "op": "set_multi_select", "fieldId": "cats", "value": ["a", "b"] }` |
| `set_checkboxes` | checkboxes | `{ "op": "set_checkboxes", "fieldId": "tasks", "value": {"item1": "done"} }` |
| `set_url` | url | `{ "op": "set_url", "fieldId": "website", "value": "https://..." }` |
| `set_url_list` | url_list | `{ "op": "set_url_list", "fieldId": "sources", "value": ["https://..."] }` |
| `set_date` | date | `{ "op": "set_date", "fieldId": "deadline", "value": "2024-06-15" }` |
| `set_year` | year | `{ "op": "set_year", "fieldId": "founded", "value": 2015 }` |
| `set_table` | table | `{ "op": "set_table", "fieldId": "data", "value": [{"col1": "v1"}] }` |
| `append_table` | table | `{ "op": "append_table", "fieldId": "data", "value": [{"col1": "v2"}] }` |
| `delete_table` | table | `{ "op": "delete_table", "fieldId": "data", "value": [0, 2] }` |
| `append_string_list` | string_list | `{ "op": "append_string_list", "fieldId": "tags", "value": ["c"] }` |
| `delete_string_list` | string_list | `{ "op": "delete_string_list", "fieldId": "tags", "value": ["a"] }` |
| `append_url_list` | url_list | `{ "op": "append_url_list", "fieldId": "sources", "value": ["https://new"] }` |
| `delete_url_list` | url_list | `{ "op": "delete_url_list", "fieldId": "sources", "value": ["https://old"] }` |
| `clear_field` | any | `{ "op": "clear_field", "fieldId": "name" }` |
| `skip_field` | optional | `{ "op": "skip_field", "fieldId": "notes", "reason": "Not applicable" }` |
| `abort_field` | any | `{ "op": "abort_field", "fieldId": "data", "reason": "Unable to find" }` |

### Checkbox Values

For `set_checkboxes`, values depend on the checkbox mode:

- **multi** (default): `todo`, `done`, `incomplete`, `active`, `na`

- **simple**: `todo`, `done`

- **explicit**: `unfilled`, `yes`, `no`

**Boolean coercion:** When using `fillForm()` with `inputContext`, boolean values
`true`/`false` are automatically coerced to checkbox strings:

- **multi/simple modes**: `true` → `"done"`, `false` → `"todo"`

- **explicit mode**: `true` → `"yes"`, `false` → `"no"`

This allows simpler programmatic API usage while maintaining the canonical string
representation.

## Form Harness API

The harness manages step-by-step form filling sessions.

```typescript
import { FormHarness, createHarness, fillForm } from 'markform';
```

### fillForm(options: FillOptions): Promise<FillResult>

High-level API for filling a form with an AI model.

```typescript
const result = await fillForm({
  form: parsedForm,
  model: 'anthropic/claude-sonnet-4-5',
  enableWebSearch: true,
  captureWireFormat: false,
  targetRoles: ['agent'],
});
```

**FillOptions fields:**

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `form` | `string \| ParsedForm` | (required) | Form markdown or parsed form |
| `model` | `string \| LanguageModel` | (required) | Model identifier or instance |
| `enableWebSearch` | `boolean` | (required) | Enable provider web search tools |
| `captureWireFormat` | `boolean` | (required) | Capture full LLM request/response |
| `inputContext` | `InputContext` | `undefined` | Pre-fill fields by ID |
| `systemPromptAddition` | `string` | `undefined` | Additional system prompt context |
| `maxTurnsTotal` | `number` | `100` | Maximum TOTAL turns across all calls (safety limit) |
| `maxTurnsThisCall` | `number` | `undefined` | Per-call turn limit for resumable fills |
| `startingTurnNumber` | `number` | `0` | Starting turn for progress tracking |
| `maxPatchesPerTurn` | `number` | `20` | Maximum patches per turn |
| `maxIssuesPerTurn` | `number` | `10` | Maximum issues shown per turn |
| `maxStepsPerTurn` | `number` | `20` | Maximum AI SDK steps (tool call rounds) per turn |
| `targetRoles` | `string[]` | `['agent']` | Roles to fill |
| `fillMode` | `FillMode` | `'continue'` | `'continue'` or `'overwrite'` |
| `enableParallel` | `boolean` | `false` | Enable parallel execution for forms with `parallel` batches |
| `maxParallelAgents` | `number` | `4` | Max concurrent agents for parallel batches |
| `callbacks` | `FillCallbacks` | `undefined` | Progress callbacks |
| `signal` | `AbortSignal` | `undefined` | Cancellation signal |
| `additionalTools` | `Record<string, Tool>` | `undefined` | Custom tools for agent |
| `recordFill` | `boolean` | (required) | Collect detailed FillRecord with timeline and stats |

### Parallel Execution

When a form uses `parallel` attributes on groups, you can enable concurrent execution:

```typescript
const result = await fillForm({
  form: formMarkdown,
  model: 'anthropic/claude-sonnet-4-5',
  enableWebSearch: true,
  captureWireFormat: false,
  enableParallel: true,
  maxParallelAgents: 4,
  callbacks: {
    onOrderLevelStart: ({ order }) => console.log(`Order ${order} starting`),
    onBatchStart: ({ batchId }) => console.log(`Batch ${batchId} starting`),
    onBatchComplete: ({ batchId, patchesApplied }) =>
      console.log(`Batch ${batchId}: ${patchesApplied} patches`),
  },
});
```

**Behavior:**
- `enableParallel: false` (default): All fields filled serially, `parallel` attributes
  ignored. The `order` attribute still controls issue filtering.
- `enableParallel: true`: Batch items run concurrently (up to `maxParallelAgents`).
  Each agent runs a multi-turn loop with rejection feedback, same as the serial path.
- If the form has no `parallel` batches, falls back to serial automatically.
- `FillResult` shape is identical regardless of serial or parallel execution.

### FillStatus

The `status` field in `FillResult` indicates success or failure:

| Status | Description |
| --- | --- |
| `{ ok: true }` | Form completed successfully |
| `{ ok: false, reason: 'max_turns' }` | Hit overall `maxTurnsTotal` safety limit |
| `{ ok: false, reason: 'batch_limit' }` | Hit `maxTurnsThisCall` per-call limit |
| `{ ok: false, reason: 'cancelled' }` | Aborted via signal |
| `{ ok: false, reason: 'error' }` | Unexpected error |

When `ok` is `false`, the status also includes:

- `message?: string` — Human-readable error description
- `error?: Error` — The original Error object with its full cause chain preserved (when the caught value was an Error instance). For `MarkformLlmError` instances, this carries `.statusCode`, `.responseBody`, `.provider`, `.model`, and `.retryable` properties. Not serialized into FillRecord — use for in-memory diagnostics and real-time error handling.

### Resumable Form Fills

For orchestrated environments with timeout constraints (e.g., Convex, AWS Step
Functions), use `maxTurnsThisCall` to limit turns per call and resume from checkpoints.

```typescript
import { fillForm } from 'markform';

// First call - limit to 2 turns
const r1 = await fillForm({
  form: formMarkdown,
  model: 'anthropic/claude-sonnet-4-5',
  enableWebSearch: false,
  captureWireFormat: false,
  maxTurnsThisCall: 2, // Stop after 2 turns
});

if (!r1.status.ok && r1.status.reason === 'batch_limit') {
  // Resume from checkpoint using r1.markdown
  const r2 = await fillForm({
    form: r1.markdown,           // Use checkpoint as input
    model: 'anthropic/claude-sonnet-4-5',
    enableWebSearch: false,
    captureWireFormat: false,
    startingTurnNumber: r1.turns, // Continue turn count
  });

  console.log('Total turns:', r2.turns);
  console.log('Status:', r2.status);
}
```

**Key points:**

- `maxTurnsThisCall` limits turns in a single call, returns `batch_limit` when reached

- `result.markdown` contains the form checkpoint (serialized state)

- `startingTurnNumber` ensures accurate progress tracking across calls

- The form itself is the state—no session storage needed

### FillCallbacks

Optional callbacks for observing form-filling execution in real-time.
All callbacks are optional and errors in callbacks don’t abort filling.

```typescript
import type { FillCallbacks } from 'markform';

const callbacks: FillCallbacks = {
  onTurnStart: ({ turnNumber, issuesCount }) => {
    console.log(`Turn ${turnNumber}: ${issuesCount} issues`);
  },
  onTurnComplete: (progress) => {
    if (progress.rejectedPatches.length > 0) {
      console.log(`Turn ${progress.turnNumber}: ${progress.rejectedPatches.length} patches rejected`);
      for (const r of progress.rejectedPatches) {
        console.log(`  - Patch ${r.patchIndex}: ${r.message}`);
      }
    } else {
      console.log(`Turn ${progress.turnNumber}: ${progress.patchesApplied} patches applied`);
    }
  },
  onToolStart: ({ name }) => {
    spinner.message(`🔧 ${name}...`);
  },
  onToolEnd: ({ name, durationMs }) => {
    console.log(`${name} completed in ${durationMs}ms`);
  },
  onLlmCallStart: ({ model }) => {
    console.log(`Calling ${model}...`);
  },
  onLlmCallEnd: ({ inputTokens, outputTokens }) => {
    console.log(`Tokens: ${inputTokens} in, ${outputTokens} out`);
  },
};

await fillForm({
  form: parsedForm,
  model: 'anthropic/claude-sonnet-4-5',
  enableWebSearch: true,
  callbacks,
});
```

| Callback | Parameters | Description |
| --- | --- | --- |
| `onTurnStart` | `{ turnNumber, issuesCount }` | Called when a turn begins |
| `onTurnComplete` | `TurnProgress` | Called when a turn completes |
| `onToolStart` | `{ name, input }` | Called before a tool executes |
| `onToolEnd` | `{ name, output, durationMs, error? }` | Called after a tool completes |
| `onLlmCallStart` | `{ model }` | Called before an LLM request |
| `onLlmCallEnd` | `{ model, inputTokens, outputTokens }` | Called after an LLM response |
| `onWebSearch` | `{ query, resultCount, provider }` | Called when a web search is performed |
| `onError` | `(error: Error, { turnNumber })` | Called when an error occurs during the fill loop |

**TurnProgress fields:**

| Field | Type | Description |
| --- | --- | --- |
| `turnNumber` | `number` | Current turn (1-indexed) |
| `issuesShown` | `number` | Issues shown to agent this turn |
| `patchesApplied` | `number` | Patches actually applied (0 if rejected) |
| `rejectedPatches` | `PatchRejection[]` | Empty if success, contains rejection details if failed |
| `requiredIssuesRemaining` | `number` | Required fields still incomplete |
| `isComplete` | `boolean` | True if form filling is done |
| `issues` | `InspectIssue[]` | Issues shown this turn |
| `patches` | `Patch[]` | Patches generated this turn |

**PatchRejection type:**

```typescript
interface PatchRejection {
  patchIndex: number;  // Index of the rejected patch
  message: string;     // Why the patch was rejected
}
```

### FillRecord

When `recordFill: true`, the `FillResult.record` contains a complete record of everything
that happened during the fill operation. Useful for cost analysis, debugging, and auditing.

```typescript
const result = await fillForm({
  form: formMarkdown,
  model: 'anthropic/claude-sonnet-4-5',
  enableWebSearch: true,
  captureWireFormat: false,
  recordFill: true,
});

if (result.record) {
  console.log(`Session: ${result.record.sessionId}`);
  console.log(`Duration: ${result.record.durationMs}ms`);
  console.log(`Tokens: ${result.record.llm.inputTokens} in, ${result.record.llm.outputTokens} out`);
  console.log(`Tool calls: ${result.record.toolSummary.totalCalls}`);
}
```

**FillRecord fields:**

| Field | Type | Description |
| --- | --- | --- |
| `sessionId` | `string` | Unique session identifier (UUID) |
| `startedAt` | `string` | ISO datetime when fill started |
| `completedAt` | `string` | ISO datetime when fill completed |
| `durationMs` | `number` | Total duration in milliseconds |
| `form` | `object` | Form metadata (id, title, structure) |
| `status` | `string` | `'completed'`, `'partial'`, `'failed'`, `'cancelled'` |
| `formProgress` | `ProgressCounts` | Final form progress counts |
| `llm` | `object` | LLM usage (provider, model, tokens) |
| `toolSummary` | `ToolSummary` | Aggregated tool statistics |
| `timingBreakdown` | `TimingBreakdown` | Time spent in LLM, tools, overhead |
| `timeline` | `TimelineEntry[]` | Turn-by-turn execution history |
| `execution` | `ExecutionMetadata` | Parallel execution details |
| `customData` | `object` | Optional client-defined data |

### formatFillRecordSummary(record, options?): string

Format a FillRecord as a human-readable text summary.

```typescript
import { formatFillRecordSummary } from 'markform';

const summary = formatFillRecordSummary(result.record, { verbose: true });
console.log(summary);
```

**Output example:**

```
Fill completed in 12.4s (5 turns)

Tokens:  2,450 input / 890 output (anthropic/claude-sonnet-4-5)
Tools:   12 calls (11 succeeded, 1 failed)
         - web_search: 5 calls, avg 1.2s, p95 2.1s
         - fill_form: 7 calls, avg 45ms

Timing:  55% LLM (6.8s) | 41% tools (5.1s) | 4% overhead (0.5s)

Progress: 18/20 fields filled (90%)
```

**CLI usage:**

The CLI provides `--record-fill` to write a sidecar `.fill.json` file:

```bash
markform fill input.form.md -o output.form.md --record-fill
# Creates: output.form.md (filled form)
#          output.fill.json (FillRecord JSON)
```

The CLI always prints a summary to stderr (use `--quiet` to suppress, `--verbose` for
more detail).

### createHarness(form, config?): FormHarness

Create a harness for manual control over the fill loop.

See [harness.ts](../packages/markform/src/harness/harness.ts) for full details.

## Research API

For research-type forms that run extended data gathering sessions.

```typescript
import { runResearch, isResearchForm } from 'markform';
```

### runResearch(options: ResearchOptions): Promise<ResearchResult>

Run a research session on a research-type form.

See [runResearch.ts](../packages/markform/src/research/runResearch.ts) for full details.

## Markdown Utilities

Utilities for working with markdown content, particularly for plan documents with
implicit checkboxes.

```typescript
import {
  findAllHeadings,
  findEnclosingHeadings,
  findAllCheckboxes,
  injectCheckboxIds,
  injectHeaderIds,
} from 'markform';
```

### findAllHeadings(markdown: string): HeadingInfo[]

Find all headings in a markdown document, returned in document order.

```typescript
interface HeadingInfo {
  level: number;        // 1-6 for h1-h6
  title: string;        // Heading text (without # prefix)
  line: number;         // Line number (1-indexed)
  position: SourceRange;
}
```

### findEnclosingHeadings(markdown: string, line: number): HeadingInfo[]

Find all headings that enclose a given line position. Returns headings from innermost
(most specific) to outermost (least specific).

A heading "encloses" a line if the heading appears before the line and no heading of
equal or higher level appears between them.

### findAllCheckboxes(markdown: string): CheckboxInfo[]

Find all checkboxes in a markdown document with their enclosing heading context.

```typescript
interface CheckboxInfo {
  id?: string;                    // Existing ID from annotation
  label: string;                  // Checkbox label text
  state: CheckboxValue;           // Current state (todo, done, etc.)
  position: SourceRange;          // Source position
  enclosingHeadings: HeadingInfo[]; // Innermost first
}
```

### injectCheckboxIds(markdown: string, options): InjectIdsResult

Inject ID annotations into checkboxes that lack them.

```typescript
interface InjectCheckboxIdsOptions {
  generator: (info: CheckboxInfo, index: number) => string;
  onlyMissing?: boolean;  // Default: true
}

interface InjectIdsResult {
  markdown: string;              // Modified markdown
  injectedCount: number;         // Number of IDs added
  injectedIds: Map<string, string>; // label -> generated ID
}
```

### injectHeaderIds(markdown: string, options): InjectIdsResult

Inject ID annotations into markdown headings.

```typescript
interface InjectHeaderIdsOptions {
  generator: (info: HeadingInfo, index: number) => string;
  onlyMissing?: boolean;  // Default: true
  levels?: number[];      // Default: [1, 2, 3, 4, 5, 6]
}
```

## Rendering API

Import from the render subpath for HTML rendering functions that produce the same output
as `markform serve`:

```typescript
import {
  renderViewContent,
  renderSourceContent,
  renderMarkdownContent,
  renderYamlContent,
  renderJsonContent,
  renderFillRecordContent,
  FILL_RECORD_STYLES,
  FILL_RECORD_SCRIPTS,
  escapeHtml,
  formatDuration,
  formatTokens,
} from 'markform/render';
```

These functions produce HTML fragments (not full pages), so consumers can embed them in
their own page shell with their own layout, CSS reset, and surrounding UI.

### Content Renderers

| Function | Input | Description |
| --- | --- | --- |
| `renderViewContent(form)` | `ParsedForm` | Render a form as a read-only HTML view |
| `renderSourceContent(content)` | `string` | Render Jinja-style form source with syntax highlighting |
| `renderMarkdownContent(content)` | `string` | Render markdown as HTML |
| `renderYamlContent(content)` | `string` | Render YAML with syntax highlighting |
| `renderJsonContent(content)` | `string` | Render JSON with syntax highlighting |
| `renderFillRecordContent(record)` | `FillRecord` | Render a fill record as an interactive dashboard |

### CSS and JavaScript Constants

| Export | Description |
| --- | --- |
| `FILL_RECORD_STYLES` | `<style>` block with CSS for the fill record dashboard |
| `FILL_RECORD_SCRIPTS` | JavaScript providing `frShowTip()`, `frHideTip()`, `frCopyYaml()` for fill record interactivity |

Include `FILL_RECORD_STYLES` in your page `<head>` and `FILL_RECORD_SCRIPTS` in a
`<script>` tag when using `renderFillRecordContent()`.

### Utility Functions

| Function | Description |
| --- | --- |
| `escapeHtml(str)` | Escape HTML special characters |
| `formatDuration(ms)` | Format milliseconds as human-readable duration (e.g., `"1m 5s"`) |
| `formatTokens(count)` | Format token counts with k suffix (e.g., `"1.5k"`) |

## Type Exports

All Zod schemas and TypeScript types are exported from the main package:

```typescript
import type {
  ParsedForm,
  Field,
  FieldValue,
  Patch,
  InspectResult,
  FillCallbacks,
  FillOptions,
  FillResult,
  TurnProgress,
  // ... many more
} from 'markform';
```

See [src/index.ts](../packages/markform/src/index.ts) for the complete list of exports.
