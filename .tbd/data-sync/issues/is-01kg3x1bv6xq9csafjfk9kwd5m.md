---
close_reason: null
closed_at: 2025-12-28T03:54:40.289Z
created_at: 2025-12-28T03:40:50.931Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.471Z
    original_id: markform-322
id: is-01kg3x1bv6xq9csafjfk9kwd5m
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Docs: Add CLI help-after-error pattern to typescript-cli-tool-rules.md"
type: is
updated_at: 2025-12-28T03:54:40.289Z
version: 1
---
## Summary

Add a new recommendation to `docs/general/agent-rules/typescript-cli-tool-rules.md` for showing help after CLI errors, particularly for missing required arguments.

## New Section to Add

Add the following section under "## Recommended Patterns" after the existing patterns:

```markdown
### Show Help After Errors

Configure Commander.js to display help after usage errors. This helps users understand what went wrong and how to correctly use the command.

```ts
// In program setup (affects all commands)
const program = new Command()
  .name('my-cli')
  .showHelpAfterError()  // Show full help after errors
  // ... other options

// Or with a custom hint message (more concise)
program.showHelpAfterError('(add --help for additional information)');
```

This provides a better user experience when required arguments are missing or options are invalid:

```
$ my-cli research
error: missing required argument 'input'

Usage: my-cli research [options] <input>

Fill a form using a web-search-enabled model

Options:
  --model <provider/model>  Model to use (required)
  -h, --help                display help for command
```

When configured on the root program, this behavior propagates to all subcommands automatically.
```

## Location

Add this section after the "Avoid Single-Letter Option Aliases" section (around line 620) in the "Recommended Patterns" area.
