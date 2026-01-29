---
close_reason: null
closed_at: 2025-12-28T03:56:14.395Z
created_at: 2025-12-28T03:40:40.119Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.626Z
    original_id: markform-321
id: is-01kg3xaa389xhs7m40bck3ncw5
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "CLI: Show help after error for missing required arguments"
type: is
updated_at: 2025-12-28T03:56:14.395Z
version: 1
---
## Problem

When running subcommands like `pnpm markform research` without required arguments, the CLI shows only a terse error message:

```
error: missing required argument 'input'
```

This doesn't help users understand what they need to provide.

## Solution

Use Commander.js's built-in `showHelpAfterError()` method to automatically display the command help after error messages.

## Implementation

1. In `packages/markform/src/cli/cli.ts`, add `.showHelpAfterError()` to the main program configuration:

```typescript
function createProgram(): Command {
  const program = withColoredHelp(new Command());

  program
    .name('markform')
    .description('Agent-friendly, human-readable, editable forms')
    .version(VERSION)
    .showHelpAfterError()  // <-- Add this line
    // ... rest of options
```

2. The `.showHelpAfterError()` can be configured with either:
   - `true` (default when called) - shows full help after errors
   - A custom string message like `'(add --help for additional information)'` - shows only that hint

3. When added to the root program, this setting propagates to all subcommands automatically.

## Expected Behavior After Change

Running `pnpm markform research` without arguments should show:

```
error: missing required argument 'input'

Usage: markform research [options] <input>

Fill a form using a web-search-enabled model

Options:
  --model <provider/model>  LLM model to use (e.g., google/gemini-2.5-flash). Required.
  ...
```

## Alternatives Considered

1. **Custom string hint only**: `.showHelpAfterError('(add --help for additional information)')` - less helpful but more concise
2. **Per-command configuration**: Could configure on individual commands, but global is cleaner

## Recommendation

Use `.showHelpAfterError()` with default `true` for full help display. This is the most user-friendly approach.

## Testing

1. Run `pnpm markform research` - should show help after error
2. Run `pnpm markform fill` - should show help after error  
3. Run `pnpm markform inspect` - should show help after error
4. Run `pnpm markform --invalid-option` - should show help after error
