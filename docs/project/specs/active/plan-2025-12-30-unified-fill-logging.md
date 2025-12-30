# Plan: Unified Fill Logging Architecture

## Summary

Consolidate and unify logging across all CLI commands that run agent fills (fill, run, examples)
using an expanded FillCallbacks architecture. This enables consistent CLI output and allows API
consumers to receive detailed progress information via injected callbacks.

## Verbosity Levels

**Important:** The detailed turn/patch logging that `fill.ts` currently has should be the **default**
behavior for all CLI commands (fill, run, examples). This includes:

| Level | What's Shown |
|-------|--------------|
| **Default** | Turn numbers, issues per turn (field IDs + issue types), patches per turn (field ID + value), completion status |
| **--verbose** | All default output PLUS: token counts, tool call start/end with timing, full prompt/response sizes, detailed stats, LLM call metadata |
| **--quiet** | Minimal output: just final success/failure and output paths |

The current problem is that `run.ts` and `examples.ts` show less detail than `fill.ts` by default.
After this work, all three commands should show the same detailed output by default.

## Problem

### Current State Issues

1. **Duplicate Logging Logic**
   - `fill.ts` (lines 433-548) has detailed per-turn logging using `logInfo`/`logVerbose`
   - `run.ts` `runAgentFillWorkflow` (lines 378-456) duplicates this with raw `console.log`
   - Inconsistent formatting between commands

2. **Incomplete Callback Information**
   - `TurnProgress` only has counts: `patchesApplied`, `issuesShown`, `requiredIssuesRemaining`
   - No access to actual `InspectIssue[]` or `Patch[]` data in callbacks
   - API consumers can't log patch details without implementing their own harness loop

3. **Context Not Passed to Workflows**
   - `runAgentFillWorkflow` in run.ts doesn't receive command context (`ctx`)
   - Can't use `logInfo`/`logVerbose` properly
   - Hardcodes `{ verbose: false }` in `logTiming` calls (lines 311, 454)

4. **CLI-Tied Logging**
   - Logging is mixed into command implementations
   - Not reusable by API consumers who want similar feedback

### Files Affected

| File | Issue |
|------|-------|
| [fill.ts](packages/markform/src/cli/commands/fill.ts) | Manual turn/patch logging (lines 433-548) |
| [run.ts](packages/markform/src/cli/commands/run.ts) | Duplicate logging, no ctx (lines 378-456) |
| [examples.ts](packages/markform/src/cli/commands/examples.ts) | Calls runForm, inherits run.ts issues |
| [harnessTypes.ts](packages/markform/src/harness/harnessTypes.ts) | TurnProgress lacks detail |
| [programmaticFill.ts](packages/markform/src/harness/programmaticFill.ts) | Uses callbacks, but limited info |
| [fillCallbacks.ts](packages/markform/src/cli/lib/fillCallbacks.ts) | Only tool callbacks, no turn logging |

## Solution

### 1. Expand FillCallbacks Interface

Add new callbacks to provide complete information:

```typescript
// In harnessTypes.ts
export interface FillCallbacks {
  // Existing callbacks
  onTurnStart?(turn: { turnNumber: number; issuesCount: number }): void;
  onTurnComplete?(progress: TurnProgress): void;
  onToolStart?(call: { name: string; input: unknown }): void;
  onToolEnd?(call: { name: string; output: unknown; durationMs: number; error?: string }): void;
  onLlmCallStart?(call: { model: string }): void;
  onLlmCallEnd?(call: { model: string; inputTokens: number; outputTokens: number }): void;

  // NEW: Called after inspect identifies issues for this turn
  onIssuesIdentified?(info: {
    turnNumber: number;
    issues: InspectIssue[];
  }): void;

  // NEW: Called after LLM generates patches (before applying)
  onPatchesGenerated?(info: {
    turnNumber: number;
    patches: Patch[];
    stats?: TurnStats;
  }): void;
}
```

### 2. Expand TurnProgress

Include full detail in progress callback:

```typescript
// In harnessTypes.ts
export interface TurnProgress {
  turnNumber: number;
  issuesShown: number;
  patchesApplied: number;
  requiredIssuesRemaining: number;
  isComplete: boolean;
  stats?: TurnStats;

  // NEW: Include actual data for detailed logging
  issues: InspectIssue[];    // Issues shown this turn
  patches: Patch[];          // Patches applied this turn
}
```

### 3. Create CLI Logging Callbacks Factory

Create a factory function that produces FillCallbacks with CLI logging:

```typescript
// In packages/markform/src/cli/lib/fillLogging.ts

export interface FillLoggingOptions {
  /** Spinner handle for LLM call progress */
  spinner?: SpinnerHandle;
}

/**
 * Create FillCallbacks that produce standard CLI logging output.
 *
 * Default output (always shown unless --quiet):
 * - Turn numbers with issues list (field IDs + issue types)
 * - Patches per turn (field ID + value)
 * - Completion status
 *
 * Verbose output (--verbose flag):
 * - Token counts per turn
 * - Tool call start/end with timing
 * - Detailed stats and LLM metadata
 *
 * This is used by fill, run, and examples commands for consistent output.
 */
export function createFillLoggingCallbacks(
  ctx: CommandContext,
  options: FillLoggingOptions = {},
): FillCallbacks {
  return {
    // DEFAULT: Always show turn number and issues
    onIssuesIdentified: ({ turnNumber, issues }) => {
      logInfo(ctx, `${pc.bold(`Turn ${turnNumber}:`)} ${formatTurnIssues(issues)}`);
    },

    // DEFAULT: Always show patches with field IDs and values
    onPatchesGenerated: ({ turnNumber, patches, stats }) => {
      logInfo(ctx, `  → ${pc.yellow(String(patches.length))} patch(es):`);

      for (const patch of patches) {
        const typeName = formatPatchType(patch);
        const value = formatPatchValue(patch);
        const fieldId = 'fieldId' in patch ? patch.fieldId : '';
        if (fieldId) {
          logInfo(ctx, `    ${pc.cyan(fieldId)} ${pc.dim(`(${typeName})`)} = ${pc.green(value)}`);
        } else {
          logInfo(ctx, `    ${pc.dim(`(${typeName})`)} = ${pc.green(value)}`);
        }
      }

      // VERBOSE: Token counts and detailed stats
      if (stats && ctx.verbose) {
        logVerbose(ctx, `  Tokens: ↓${stats.inputTokens ?? 0} ↑${stats.outputTokens ?? 0}`);
        if (stats.toolCalls?.length) {
          const toolSummary = stats.toolCalls.map(t => `${t.name}(${t.count})`).join(', ');
          logVerbose(ctx, `  Tools: ${toolSummary}`);
        }
      }
    },

    // DEFAULT: Show completion status
    onTurnComplete: ({ isComplete }) => {
      if (isComplete) {
        logInfo(ctx, pc.green(`  ✓ Complete`));
      }
    },

    // VERBOSE: Tool call details
    onToolStart: ({ name }) => {
      // Web search gets spinner update even without --verbose
      if (name.includes('search')) {
        options.spinner?.message(`🔍 Web search...`);
      }
      logVerbose(ctx, `  Tool started: ${name}`);
    },

    onToolEnd: ({ name, durationMs, error }) => {
      if (error) {
        logVerbose(ctx, `  Tool ${name} failed: ${error} (${durationMs}ms)`);
      } else {
        logVerbose(ctx, `  Tool ${name} completed (${durationMs}ms)`);
      }
    },

    // VERBOSE: LLM call metadata
    onLlmCallStart: ({ model }) => {
      logVerbose(ctx, `  LLM call: ${model}`);
    },

    onLlmCallEnd: ({ model, inputTokens, outputTokens }) => {
      logVerbose(ctx, `  LLM response: ${model} (↓${inputTokens} ↑${outputTokens})`);
    },
  };
}
```

### 4. Update programmaticFill to Call New Callbacks

```typescript
// In programmaticFill.ts, inside the harness loop:

// Call onIssuesIdentified (new)
if (options.callbacks?.onIssuesIdentified) {
  try {
    options.callbacks.onIssuesIdentified({
      turnNumber: turnCount + 1,
      issues: stepResult.issues,
    });
  } catch { /* ignore */ }
}

// ... agent.generatePatches() ...

// Call onPatchesGenerated (new)
if (options.callbacks?.onPatchesGenerated) {
  try {
    options.callbacks.onPatchesGenerated({
      turnNumber: turnCount + 1,
      patches,
      stats,
    });
  } catch { /* ignore */ }
}
```

### 5. Update TurnProgress in onTurnComplete

```typescript
// In programmaticFill.ts:
options.callbacks.onTurnComplete({
  turnNumber: turnCount,
  issuesShown: previousStepResult.issues.length,
  patchesApplied: patches.length,
  requiredIssuesRemaining: requiredIssues.length,
  isComplete: stepResult.isComplete,
  stats,
  // NEW
  issues: previousStepResult.issues,
  patches,
});
```

### 6. Consolidate CLI Workflows

Update all CLI commands to use the logging callbacks:

```typescript
// In run.ts runAgentFillWorkflow:
async function runAgentFillWorkflow(
  form: ParsedForm,
  modelId: string,
  formsDir: string,
  filePath: string,
  isResearch: boolean,
  overwrite: boolean,
  ctx: CommandContext,  // NEW: pass context
): Promise<ExportResult> {
  // Create callbacks for logging
  const callbacks = createFillLoggingCallbacks(ctx, {
    showPatches: true,
    spinner: currentSpinner,
  });

  // Use fillForm or harness with callbacks
  // ... rest of workflow uses callbacks for all logging
}
```

## Implementation Phases

### Phase 1: Expand Types (No Breaking Changes)

1. Add new optional callbacks to `FillCallbacks`
2. Add new optional fields to `TurnProgress`
3. No breaking changes - all additions are optional

### Phase 2: Update programmaticFill

1. Call `onIssuesIdentified` in harness loop
2. Call `onPatchesGenerated` after agent response
3. Include issues/patches in `TurnProgress`

### Phase 3: Create fillLogging.ts

1. Create `createFillLoggingCallbacks()` factory
2. Consolidate formatting logic from fill.ts
3. Add tests for callback behavior

### Phase 4: Update CLI Commands

1. Update `fill.ts` to use logging callbacks (remove manual logging)
2. Update `run.ts` to accept `ctx` and use logging callbacks
3. Update `runForm()` signature to accept optional callbacks
4. Update `examples.ts` to pass callbacks through

### Phase 5: Cleanup and Tests

1. Remove duplicate logging code from fill.ts/run.ts
2. Verify consistent output across all commands
3. Add integration tests for callback-based logging

## Benefits

1. **Consistency**: All CLI commands produce identical logging format
2. **API-Friendly**: API consumers get full detail via callbacks
3. **Testable**: Logging can be tested via callback assertions
4. **Configurable**: Different consumers can implement different logging
5. **Maintainable**: Single source of truth for logging format

## Testing

1. Unit tests for `createFillLoggingCallbacks`
2. Verify callbacks receive correct data
3. Integration test comparing fill.ts vs run.ts output (should be identical)
4. Verify --verbose flag works consistently

## References

- Current FillCallbacks: [harnessTypes.ts:198-216](packages/markform/src/harness/harnessTypes.ts#L198-L216)
- Current TurnProgress: [harnessTypes.ts:278-286](packages/markform/src/harness/harnessTypes.ts#L278-L286)
- fill.ts logging: [fill.ts:433-548](packages/markform/src/cli/commands/fill.ts#L433-L548)
- run.ts logging: [run.ts:378-456](packages/markform/src/cli/commands/run.ts#L378-L456)
