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
  serialize,
  validate,
  inspect,
  applyPatches,
} from 'markform';
```

### parseForm(content: string): ParsedForm

Parse a `.form.md` file into a structured form object.

### serialize(form: ParsedForm, options?: SerializeOptions): string

Convert a parsed form back to Markdown.

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
| `set_string_list` | string_list | `{ "op": "set_string_list", "fieldId": "tags", "items": ["a", "b"] }` |
| `set_single_select` | single_select | `{ "op": "set_single_select", "fieldId": "rating", "selected": "high" }` |
| `set_multi_select` | multi_select | `{ "op": "set_multi_select", "fieldId": "cats", "selected": ["a", "b"] }` |
| `set_checkboxes` | checkboxes | `{ "op": "set_checkboxes", "fieldId": "tasks", "values": {"item1": "done"} }` |
| `set_url` | url | `{ "op": "set_url", "fieldId": "website", "value": "https://..." }` |
| `set_url_list` | url_list | `{ "op": "set_url_list", "fieldId": "sources", "items": ["https://..."] }` |
| `set_date` | date | `{ "op": "set_date", "fieldId": "deadline", "value": "2024-06-15" }` |
| `set_year` | year | `{ "op": "set_year", "fieldId": "founded", "value": 2015 }` |
| `clear_field` | any | `{ "op": "clear_field", "fieldId": "name" }` |
| `skip_field` | optional | `{ "op": "skip_field", "fieldId": "notes", "reason": "Not applicable" }` |
| `abort_field` | any | `{ "op": "abort_field", "fieldId": "data", "reason": "Unable to find" }` |

### Checkbox Values

For `set_checkboxes`, values depend on the checkbox mode:

- **multi** (default): `todo`, `done`, `incomplete`, `active`, `na`

- **simple**: `todo`, `done`

- **explicit**: `unfilled`, `yes`, `no`

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
  targetRoles: ['agent'],
});
```

### FillCallbacks

Optional callbacks for observing form-filling execution in real-time.
All callbacks are optional and errors in callbacks don't abort filling.

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
