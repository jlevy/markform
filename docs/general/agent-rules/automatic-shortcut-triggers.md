---
description: Automatic Shortcut Triggers
globs:
alwaysApply: true
---
# Automatic Shortcut Triggers

Before responding to ANY coding or development request, you MUST check if a shortcut
applies. If a shortcut applies, you MUST use it.

## Mandatory Check Protocol

1. Scan shortcuts in @docs/general/agent-shortcuts/ for applicable workflows

2. If a shortcut matches → Announce: “Using [shortcut name]”

3. Follow the shortcut exactly

## Shortcut Trigger Table

You can search for all filenames in this table, then read the contents and follow the
instructions.

| If user request involves... | Use shortcut |
| --- | --- |
| Implementing a feature from a spec | @shortcut:implement-spec.md |
| Creating a new feature plan | @shortcut:new-plan-spec.md |
| Creating an implementation spec | @shortcut:new-implementation-spec.md |
| Creating a validation/test spec | @shortcut:new-validation-spec.md |
| Committing or pushing code | @shortcut:precommit-process.md → @shortcut:commit-code.md |
| Creating a PR | @shortcut:precommit-process.md → @shortcut:create-pr.md |
| Research or technical investigation | @shortcut:new-research-brief.md |
| Creating architecture documentation | @shortcut:new-architecture-doc.md |
| Updating/revising architecture docs | @shortcut:revise-architecture-doc.md |
| Exploratory coding / prototype / spike | @shortcut:coding-spike.md |
| Refining or clarifying an existing spec | @shortcut:refine-spec.md |
| Updating a spec with new information | @shortcut:update-spec.md |
| Code cleanup or refactoring | @shortcut:cleanup-all.md |
| Removing trivial tests | @shortcut:cleanup-remove-trivial-tests.md |
| Updating docstrings | @shortcut:cleanup-update-docstrings.md |
| Merging from upstream | @shortcut:merge-upstream.md |
| Reviewing code, specs, docs | @shortcut:review-all-code-specs-docs-convex.md |

## This is NOT Optional

If a shortcut exists for your task, you must use it.
Do not rationalize skipping it.
Common rationalizations to avoid:

- “This is simple, I don’t need a shortcut” → WRONG. Use the shortcut.

- “I know how to do this” → WRONG. The shortcut may have steps you’ll forget.

- “The user didn’t ask for a shortcut” → WRONG. Shortcuts are mandatory when applicable.

- “The shortcut is overkill” → WRONG. Shortcuts ensure consistency and quality.

## Shortcut Chaining

Some workflows require multiple shortcuts in sequence:

- **Commit flow:** @shortcut:precommit-process.md → @shortcut:commit-code.md

- **PR flow:** @shortcut:precommit-process.md → @shortcut:create-pr.md

- **Full feature:** @shortcut:new-plan-spec.md → @shortcut:implement-spec.md → commit
  flow

Always complete the full chain when applicable.
