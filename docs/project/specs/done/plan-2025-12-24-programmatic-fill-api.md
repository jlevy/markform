# Plan Spec: Programmatic Fill API

## Purpose

This is a technical design doc for adding a high-level programmatic API to markform that
enables external agentic systems to execute form-filling sessions with a single function
call. This feature exposes markform as a composable research/analysis tool that can be
invoked as a subagent within larger workflows.

## Background

**Markform** is a system for agent-friendly, human-readable, editable forms (`.form.md`)
that supports:

- Structured context, schema, and form values in one text file

- Incremental filling via CLI, AI SDK tools, or library API

- A harness loop that runs step-by-step for agent-driven form completion

**Current Integration Points:**

1. **CLI** (`markform fill`) - Interactive terminal-based filling

2. **AI SDK Tools** (`markform/ai-sdk`) - Tools for external agents to call
   (`markform_inspect`, `markform_apply`, `markform_export`)

3. **Library** (`markform`) - Core engine exports (`parseForm`, `applyPatches`, etc.)

4. **Harness** - `FormHarness` + `LiveAgent` for automated filling

**Gap:** There’s no single-function entry point that:

- Takes a form and model, runs the complete harness loop, and returns structured results

- Allows pre-filling fields with known context before the agent starts

- Supports injecting additional context into the agent’s system prompt

- Provides progress callbacks and cancellation support

**Related Docs:**

- [arch-markform-initial-design.md](../architecture/current/arch-markform-initial-design.md)

- [valid-2025-12-24-export-formats-and-prompt-composition.md](valid-2025-12-24-export-formats-and-prompt-composition.md)

## Summary of Task

Add a `fillForm()` function as the primary programmatic entry point for markform:

```typescript
import { fillForm } from 'markform';

const result = await fillForm({
  form: formMarkdown,              // string or ParsedForm
  model: 'openai/gpt-4o',          // string ID or LanguageModel
  inputContext: {                   // Pre-fill fields by ID
    company_name: 'Apple Inc.',
    tickers: 'AAPL',
  },
  systemPromptAddition: `          // Append to composed prompt
    ## Company Background
    ${companyResearchReport}
  `,
  maxTurns: 25,
  onTurnComplete: (progress) => {   // Progress callback
    console.log(`Turn ${progress.turnNumber}: ${progress.requiredIssuesRemaining} remaining`);
  },
});

if (result.status.ok) {
  console.log('Values:', result.values);  // { field_id: value, ... }
  console.log('Markdown:', result.markdown);
} else {
  console.log('Failed:', result.status.reason, result.status.message);
  console.log('Partial values:', result.values);
}
```

**Key Capabilities:**

1. **Single function call** - Encapsulates harness loop with LiveAgent

2. **Input context pre-filling** - Set known values before agent starts

3. **System prompt composition** - Inject additional context (research, instructions)

4. **Structured results** - Returns `{ isComplete, markdown, values, turns,
   remainingIssues }`

5. **Observable** - `onTurnComplete` callback for progress monitoring

6. **Cancellable** - `AbortSignal` support

## Backward Compatibility

**Compatibility Level:** Fully Backward Compatible (Additive Only)

- **Library API:** New export only; existing exports unchanged

- **CLI:** No changes to CLI behavior

- **AI SDK Tools:** No changes to existing tools

- **Types:** New types added; existing types unchanged

## Stage 1: Planning Stage

### Current State Analysis

**Existing Components:**

| Component | Location | Reusable? |
| --- | --- | --- |
| `FormHarness` | `src/harness/harness.ts` | Yes - manages step/apply loop |
| `LiveAgent` | `src/harness/liveAgent.ts` | Yes - needs `systemPromptAdditions` |
| `resolveModel()` | `src/harness/modelResolver.ts` | Yes - model ID → LanguageModel |
| `applyPatches()` | `src/engine/apply.ts` | Yes - for input context |
| `serialize()` | `src/engine/serialize.ts` | Yes - for result markdown |
| `buildSystemPrompt()` | `src/harness/liveAgent.ts` | Internal - needs export or extension |

**Gaps in Existing Code:**

1. `LiveAgent` has `systemPrompt` override but not `systemPromptAdditions` (append mode)

2. No helper to apply input context (pre-fill by field ID)

3. `buildSystemPrompt` is internal to liveAgent.ts

4. No factory function combining harness + agent

### Feature Scope

**In Scope:**

- `fillForm()` function with `FillOptions` and `FillResult` types

- `InputContext` type and pre-fill logic

- `systemPromptAdditions` support in LiveAgent

- `TurnProgress` callback type

- `AbortSignal` cancellation support

- Export from main `markform` entry point

**Out of Scope (Explicit Non-Goals):**

- Changes to CLI behavior

- Changes to AI SDK tools

- Streaming/incremental results

- Concurrent fill sessions with shared state

- Web/MCP server integration

- Custom validators in programmatic API

### Acceptance Criteria

1. `fillForm()` is exported from `markform` package

2. Can fill a form with just `{ form, model }` (sensible defaults)

3. `inputContext` pre-fills fields before agent starts

4. `systemPromptAddition` is appended to composed system prompt

5. `FillResult.values` contains all field values keyed by ID

6. `onTurnComplete` is called after each harness turn

7. `signal.abort()` stops execution and returns partial result

8. Existing tests continue to pass

9. New unit tests cover fillForm scenarios

10. Value coercion layer has comprehensive unit tests

### Testing Plan

Tests have been implemented. See the validation spec for full coverage details.

#### 1. Value Coercion Layer Tests (`tests/unit/valueCoercion.test.ts`)

**`findFieldById()` tests:**

- [x] Returns field when found via idIndex

- [x] Returns undefined for non-existent field ID

- [x] Works with fields in nested groups

**`coerceToFieldPatch()` tests per field kind:**

| Field Kind | Test Cases |
| --- | --- |
| `string` | accepts string, coerces number→string, coerces boolean→string, rejects array, rejects object |
| `number` | accepts number, coerces numeric string→number, rejects non-numeric string, rejects array |
| `string_list` | accepts string[], coerces single string→[string], rejects non-array non-string |
| `single_select` | accepts valid option ID, rejects invalid option ID |
| `multi_select` | accepts string[], coerces string→[string], rejects invalid option IDs |
| `checkboxes` | accepts Record<string, CheckboxValue>, rejects wrong structure |

**Coercion warnings:**

- [x] Returns warning when coercing number to string

- [x] Returns warning when coercing string to number

- [x] Returns warning when coercing string to array

**`coerceInputContext()` tests:**

- [x] Returns patches for valid input context

- [x] Collects warnings from multiple coercions

- [x] Collects errors for missing fields

- [x] Collects errors for incompatible types

- [x] Skips null values (clear field)

- [x] Handles empty input context

#### 2. Programmatic Fill API Tests (`tests/unit/harness/programmaticFill.test.ts`)

**Basic functionality (use MockAgent for determinism):**

- [x] Fills form with minimal options `{ form, model }`

- [x] Returns `status.ok: true` when form completes

- [x] Returns correct `values` map keyed by field ID

- [x] Returns serialized `markdown`

- [x] Returns `turns` count

**Input context:**

- [x] Pre-fills fields from inputContext before agent runs

- [x] Fails fast with `status.ok: false, reason: 'error'` on invalid field ID

- [x] Fails fast on incompatible type (e.g., object for string field)

- [x] Includes `inputContextWarnings` for coerced values

- [x] Agent sees pre-filled values (doesn't try to fill them again)

**System prompt addition:**

- [x] `systemPromptAddition` is appended to composed prompt

- [x] Form instructions are preserved (not overridden)

**Progress callback:**

- [x] `onTurnComplete` called after each turn

- [x] `TurnProgress` contains correct values

- [x] Callback errors don't abort fill (warning logged)

**Cancellation:**

- [x] `signal.abort()` returns partial result with `reason: 'cancelled'`

- [x] Partial `values` and `markdown` are returned

**Max turns:**

- [x] Returns `status.ok: false, reason: 'max_turns'` when limit reached

- [x] `remainingIssues` populated when not complete

**Fill modes:**

- [x] `fillMode: 'continue'` skips already-filled fields

- [ ] `fillMode: 'overwrite'` re-fills all target role fields (not yet tested)

#### 3. LiveAgent Enhancement Tests (`tests/unit/liveAgent.test.ts`)

- [x] `systemPromptAddition` is appended to composed prompt (tested via programmaticFill tests)

- [x] Null/undefined `systemPromptAddition` doesn't affect prompt

#### 4. Integration Tests (`tests/integration/programmaticFill.test.ts`)

**End-to-end with MockAgent:**

- [x] Complete fill of simple.form.md using mock values

- [x] Complete fill of political-research.form.md with inputContext for user fields

- [x] Verify round-trip: fillForm result can be re-parsed

**Error scenarios:**

- [ ] Form parse error returns appropriate error

- [ ] Model resolution error returns appropriate error

## Stage 2: Architecture Stage

### Module Structure

```
packages/markform/src/
├── engine/
│   ├── values.ts           # NEW: unified value coercion layer
│   └── ...                 # existing engine modules
├── harness/
│   ├── harness.ts          # FormHarness (unchanged)
│   ├── liveAgent.ts        # LiveAgent + systemPromptAddition
│   ├── mockAgent.ts        # MockAgent (unchanged)
│   ├── modelResolver.ts    # resolveModel (unchanged)
│   ├── programmaticFill.ts # NEW: fillForm(), types
│   └── index.ts            # Add new exports
├── index.ts                # Add fillForm export
└── ...
```

### Type Definitions

#### Value Coercion Layer (`src/engine/values.ts`)

```typescript
// =============================================================================
// Raw Input Types (what external callers provide)
// =============================================================================

/** Raw value that can be coerced to a field value */
export type RawFieldValue =
  | string
  | number
  | boolean
  | string[]
  | Record<string, unknown>   // for checkboxes
  | null;

/** Input context is a map of field IDs to raw values */
export type InputContext = Record<string, RawFieldValue>;

// =============================================================================
// Coercion Results
// =============================================================================

export type CoercionResult =
  | { ok: true; patch: Patch }
  | { ok: true; patch: Patch; warning: string }  // coerced with warning
  | { ok: false; error: string };

export interface CoerceInputContextResult {
  patches: Patch[];
  warnings: string[];  // non-fatal (e.g., "coerced '123' to number for field X")
  errors: string[];    // fatal (e.g., "field 'foo' not found")
}

// =============================================================================
// Coercion Functions
// =============================================================================

/** Find field by ID using idIndex (single source of truth) */
export function findFieldById(form: ParsedForm, fieldId: string): Field | undefined;

/** Coerce a raw value to a Patch for a specific field */
export function coerceToFieldPatch(
  form: ParsedForm,
  fieldId: string,
  rawValue: RawFieldValue
): CoercionResult;

/** Coerce an entire InputContext to patches */
export function coerceInputContext(
  form: ParsedForm,
  inputContext: InputContext
): CoerceInputContextResult;
```

**Coercion Rules:**

| Field Kind | Accepts | Coerces | Rejects |
| --- | --- | --- | --- |
| `string` | string | number→string, boolean→"true"/"false" | array, object |
| `number` | number | numeric string→number | non-numeric, array, object |
| `string_list` | string[] | string→[string] | non-array non-string |
| `single_select` | string (option ID) | - | invalid option ID |
| `multi_select` | string[] | string→[string] | invalid option IDs |
| `checkboxes` | Record<string, CheckboxValue> | - | wrong structure |

#### Fill API Types (`src/harness/programmaticFill.ts`)

```typescript
export interface FillOptions {
  form: string | ParsedForm;
  model: string | LanguageModel;
  inputContext?: InputContext;
  systemPromptAddition?: string;  // Appended to composed prompt (never overrides)
  maxTurns?: number;              // Default: 100
  maxPatchesPerTurn?: number;     // Default: 20
  maxIssues?: number;             // Default: 10
  targetRoles?: string[];         // Default: ['agent']
  fillMode?: 'continue' | 'overwrite';
  onTurnComplete?: (progress: TurnProgress) => void;
  signal?: AbortSignal;
}

export interface TurnProgress {
  turnNumber: number;
  issuesShown: number;
  patchesApplied: number;
  requiredIssuesRemaining: number;
  isComplete: boolean;
}

export type FillStatus =
  | { ok: true }
  | { ok: false; reason: 'max_turns' | 'cancelled' | 'error'; message?: string };

export interface FillResult {
  status: FillStatus;
  markdown: string;                      // Always present (may be partial)
  values: Record<string, FieldValue>;    // Always present (may be partial)
  form: ParsedForm;                      // Always present
  turns: number;
  totalPatches: number;
  inputContextWarnings?: string[];       // Warnings from input context coercion
  remainingIssues?: Array<{              // Present if not complete
    ref: string;
    message: string;
    severity: 'required' | 'recommended';
    priority: number;  // 1-5 (P1-P5)
  }>;
}
```

### LiveAgent Enhancement

Add `systemPromptAddition` to `LiveAgentConfig`:

```typescript
export interface LiveAgentConfig {
  model: LanguageModel;
  maxStepsPerTurn?: number;
  systemPromptAddition?: string;  // NEW: appended to composed prompt
  targetRole?: string;
}
```

Note: We removed the previous `systemPrompt` full override option.
The form’s built-in instructions (from doc blocks and role instructions) should always
be used; callers can only append additional context.

### Input Context Application

Uses the coercion layer to convert raw values to typed patches:

```typescript
// In fillForm():
let inputContextWarnings: string[] = [];

if (options.inputContext) {
  const coercionResult = coerceInputContext(form, options.inputContext);

  // Fail fast on errors (field not found, incompatible types)
  if (coercionResult.errors.length > 0) {
    return {
      status: { ok: false, reason: 'error', message: coercionResult.errors.join('; ') },
      markdown: serialize(form),
      values: form.valuesByFieldId,
      form,
      turns: 0,
      totalPatches: 0,
      inputContextWarnings: coercionResult.warnings,
    };
  }

  // Apply coerced patches
  applyPatches(form, coercionResult.patches);
  totalPatches = coercionResult.patches.length;
  inputContextWarnings = coercionResult.warnings;
}
```

### Core Algorithm

```typescript
export async function fillForm(options: FillOptions): Promise<FillResult> {
  // 1. Parse form if string
  const form = typeof options.form === 'string'
    ? parseForm(options.form)
    : structuredClone(options.form);

  // 2. Resolve model if string
  const model = typeof options.model === 'string'
    ? (await resolveModel(options.model)).model
    : options.model;

  // 3. Apply input context using coercion layer
  let totalPatches = 0;
  let inputContextWarnings: string[] = [];

  if (options.inputContext) {
    const coercionResult = coerceInputContext(form, options.inputContext);

    if (coercionResult.errors.length > 0) {
      // Fail fast on input context errors
      return buildErrorResult(form, coercionResult.errors, coercionResult.warnings);
    }

    applyPatches(form, coercionResult.patches);
    totalPatches = coercionResult.patches.length;
    inputContextWarnings = coercionResult.warnings;
  }

  // 4. Create harness + agent
  const harness = createHarness(form, { maxTurns, targetRoles, ... });
  const agent = createLiveAgent({
    model,
    systemPromptAddition: options.systemPromptAddition,
    targetRole: (options.targetRoles ?? [AGENT_ROLE])[0],
  });

  // 5. Run harness loop
  let stepResult = harness.step();
  while (!stepResult.isComplete && !harness.hasReachedMaxTurns()) {
    if (options.signal?.aborted) {
      return buildResult(form, harness, totalPatches, 'cancelled');
    }

    const patches = await agent.generatePatches(
      stepResult.issues, form, options.maxPatchesPerTurn
    );
    stepResult = harness.apply(patches, stepResult.issues);
    totalPatches += patches.length;

    options.onTurnComplete?.({ turnNumber, issuesShown, ... });

    if (!stepResult.isComplete) {
      stepResult = harness.step();
    }
  }

  // 6. Determine status
  if (stepResult.isComplete) {
    return buildResult(form, harness, totalPatches, 'ok');
  } else {
    return buildResult(form, harness, totalPatches, 'max_turns');
  }
}
```

## Stage 3: Refine Architecture

### Reusable Components Identified

| Component | File | Reuse Strategy |
| --- | --- | --- |
| `FormHarness` | harness.ts | Use directly via `createHarness()` |
| `LiveAgent` | liveAgent.ts | Extend config, use via `createLiveAgent()` |
| `resolveModel()` | modelResolver.ts | Use directly |
| `applyPatches()` | apply.ts | Use for applying coerced patches |
| `parseForm()` | parse.ts | Use for string forms |
| `serialize()` | serialize.ts | Use for result markdown |
| `idIndex` | ParsedForm | Use for field lookup (not iteration) |
| `AGENT_ROLE` | settings.ts | Use for defaults |

### Consolidation: Unified Value Coercion Layer

**Current Duplication (to be consolidated):**

| Location | Function | Issue |
| --- | --- | --- |
| `apply.ts:50-59` | `findField()` | Iterates groups |
| `liveAgent.ts:272-280` | `findField()` | Duplicate, iterates groups |
| `interactivePrompts.ts:51-59` | `getFieldById()` | Duplicate, iterates groups |
| `mockAgent.ts:133-196` | `createPatch()` | Creates patches from FieldValue |

**New Single Source of Truth:** `src/engine/values.ts`

- `findFieldById()` - uses `idIndex` for validation, then retrieves Field object

- `coerceToFieldPatch()` - raw value → typed Patch with validation

- `coerceInputContext()` - batch coercion with warnings/errors

**Refactoring Opportunities (future):**

- `apply.ts` can use `findFieldById()` from values.ts

- `liveAgent.ts` can use `findFieldById()` from values.ts

- `mockAgent.ts` can use coercion helpers

- `interactivePrompts.ts` can use coercion helpers

### Files to Modify

| File | Change |
| --- | --- |
| `src/engine/values.ts` | **NEW:** `findFieldById()`, `coerceToFieldPatch()`, `coerceInputContext()`, types |
| `src/harness/liveAgent.ts` | Add `systemPromptAddition` to config, append in `generatePatches` |
| `src/harness/programmaticFill.ts` | **NEW:** `fillForm()` using coercion layer |
| `src/harness/index.ts` | Export new types/functions |
| `src/index.ts` | Export `fillForm`, `FillOptions`, `FillResult`, coercion types |
| `src/engine/apply.ts` | (optional) Refactor to use `findFieldById()` |

## Open Questions and Clarifications Needed

### Resolved Questions

1. **InputContext and Roles** ✅ RESOLVED

   - **Decision:** Allow any field by ID; caller decides what to pre-fill

   - Role attribute is not enforced; `inputContext` works on any field

2. **System Prompt Override vs Addition** ✅ RESOLVED

   - **Decision:** Only `systemPromptAddition` (append mode); no full override

   - Form’s built-in instructions should always be preserved

   - Callers can only add context, not replace core instructions

3. **Return Type for Partial Fills** ✅ RESOLVED

   - **Decision:** Always return form state with explicit status

   - `FillStatus` indicates success or failure reason (`max_turns`, `cancelled`,
     `error`)

   - `markdown`, `values`, `form` always present (may be partial)

### Design Questions (Can Defer)

4. **Export Location**

   - Should `fillForm` be in `markform` or `markform/harness` subpath?

   - **Recommendation:** Export from main `markform` for simplicity

5. **Concurrent Fills**

   - Is there a use case for multiple concurrent fills sharing state?

   - **Recommendation:** Out of scope; each fill is independent

6. **Callback Error Handling**

   - Should errors in `onTurnComplete` abort the fill?

   - **Recommendation:** No; log warning but continue

### Implementation Questions (Resolved)

7. **Field Type Coercion** ✅ RESOLVED

   - **Decision:** New `src/engine/values.ts` coercion layer handles this

   - Coerce where reasonable (number→string, numeric string→number)

   - Return warnings for coercions, errors for incompatible types

   - See Coercion Rules table in Type Definitions section

8. **Nested Field Lookup** ✅ RESOLVED

   - **Decision:** `findFieldById()` uses `idIndex` for validation

   - Single source of truth in `src/engine/values.ts`

   - Consolidates duplicated `findField()` implementations

9. **Testing Strategy**

   - Should we add integration tests with mocked LLM responses?

   - **Recommendation:** Yes; use MockAgent for deterministic testing

## Possible Issues

1. **Deep Clone Performance**

   - `structuredClone(form)` may be slow for large forms

   - Consider lazy cloning or making ParsedForm immutable operations

2. **Abort Signal Timing**

   - Signal is checked at loop start; long LLM calls won’t be interrupted

   - May need to pass signal to AI SDK generateText call

3. **Memory for Large Session Transcripts**

   - `harness.getTurns()` accumulates all turns

   - For very long sessions, memory usage could grow

## Revision History

| Date | Author | Changes |
| --- | --- | --- |
| 2025-12-24 | Claude | Initial draft from proposal review |
| 2025-12-24 | Claude | Resolved: inputContext works on any field by ID |
| 2025-12-24 | Claude | Resolved: removed systemPrompt override, only systemPromptAddition (append) |
| 2025-12-24 | Claude | Resolved: FillStatus with ok/error pattern, always return form state |
| 2025-12-24 | Claude | Added: unified value coercion layer (`src/engine/values.ts`) |
| 2025-12-24 | Claude | Added: `RawFieldValue`, `CoercionResult`, `CoerceInputContextResult` types |
| 2025-12-24 | Claude | Added: `findFieldById()` using idIndex, consolidates duplicated lookups |
| 2025-12-24 | Claude | Added: `inputContextWarnings` to FillResult |
| 2025-12-24 | Claude | Added: comprehensive Testing Plan with checkboxes for progress tracking |
