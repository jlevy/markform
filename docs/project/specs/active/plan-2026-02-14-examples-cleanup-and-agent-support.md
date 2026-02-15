---
title: Examples Cleanup and Agent Support
description: Clean up example directories, register quality examples, and add agent-friendly output to the examples command
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: Examples Cleanup and Agent Support

**Date:** 2026-02-14

**Status:** Draft

## Overview

The examples system has 9 directories but only 4 registered in the CLI. Some directories
are empty or redundant, descriptions have bugs, and the `--list` output lacks structured
format support for agents. This spec covers cleanup, registering high-quality examples,
and adding `--format=json` support so agents can programmatically discover and use
examples.

## Goals

- Clean up unused/redundant example directories
- Register high-quality examples that demonstrate diverse Markform use cases
- Make `markform examples --list` agent-friendly with JSON output
- Update SKILL.md so agents can discover examples without running the CLI
- Harmonize the QA playbook and examples as a unified getting-started experience

## Non-Goals

- Redesigning the interactive examples flow (it works fine for humans)
- Moving test fixture examples (`rejection-test`, `plan-document`, `parallel`) to a
  different directory
- Adding new example forms beyond what already exists

## Background

The examples system was built for interactive human use. The QA playbook
(`markform-full-walkthrough.qa.md`) was recently created as an end-to-end agent
walkthrough. These two paths into Markform should complement each other: examples for
focused demos of specific features, the QA playbook for a comprehensive tour.

Currently `--name` and `--list` flags already work non-interactively, but `--list` only
produces human-readable output with ANSI colors. Agents need structured JSON to
programmatically select and copy examples.

### Current state

| Directory | Registered | Status |
| --- | --- | --- |
| `movie-research/` (demo + deep) | yes (2) | Good |
| `simple/` | yes | Good |
| `startup-deep-research/` | yes | Good |
| `startup-research/` | no | Redundant with startup-deep-research |
| `twitter-thread/` | no | High quality, should register |
| `parallel/` | no | Test fixture, has description bug |
| `plan-document/` | no | Test fixture |
| `rejection-test/` | no | Internal test fixture |
| `earnings-analysis/` | no | Empty directory |

## Design

### Approach

Minimal changes: delete cruft, register one new example, add JSON output to `--list`,
update docs.

### Components

1. **Example registry** (`src/cli/examples/exampleRegistry.ts`): Add `twitter-thread`,
   reorder for natural complexity ramp
2. **Examples command** (`src/cli/commands/examples.ts`): Add `--format=json` to `--list`
   using existing `formatOutput()` pattern
3. **SKILL.md** (`docs/skill/SKILL.md`): Add examples discovery table
4. **QA playbook**: Add cross-reference to examples
5. **Parallel example**: Fix description bug

### API Changes

`markform examples --list --format=json` now returns structured output:

```json
[
  {
    "id": "movie-research-demo",
    "filename": "movie-research-demo.form.md",
    "type": "research",
    "title": "Movie Research Demo",
    "description": "Movie lookup with ratings from IMDB and Rotten Tomatoes."
  }
]
```

## Implementation Plan

### Phase 1: Cleanup, Registration, and Agent Support

- [ ] Delete `examples/earnings-analysis/` (empty directory)
- [ ] Delete `examples/startup-research/` (redundant with startup-deep-research)
- [ ] Update `tests/qa/live-fill-manual-test.qa.md` reference from startup-research to
  startup-deep-research
- [ ] Fix `examples/parallel/parallel-research.form.md` description: fill in blank
  template variables (`parallel` and `order`)
- [ ] Add `twitter-thread` to `EXAMPLE_DEFINITIONS` in `exampleRegistry.ts` (type:
  `fill`)
- [ ] Reorder `EXAMPLE_DEFINITIONS` for complexity ramp: movie-research-demo, simple,
  twitter-thread, movie-deep-research, startup-deep-research
- [ ] Add `--format=json` support to `printExamplesList()` using existing
  `formatOutput()` pattern
- [ ] Move `getCommandContext(cmd)` before the `--list` check in the action handler
- [ ] Add cross-reference note in console `--list` output pointing to the QA playbook
- [ ] Add examples cross-reference tip in QA playbook Phase 3.2
- [ ] Update SKILL.md with examples table and agent-friendly usage patterns

## Testing Strategy

- `pnpm test`: All existing tests pass (examples.test.ts validates all registered
  examples parse correctly with valid frontmatter)
- `pnpm build`: Compiles
- Manual: `markform examples --list` shows 5 examples
- Manual: `markform examples --list --format=json` returns valid JSON array
- Manual: `markform examples --name twitter-thread --forms-dir /tmp/test` copies
  successfully

## Open Questions

None.

## References

- Plan file: `.claude/plans/fizzy-fluttering-raccoon.md`
- QA playbook: `packages/markform/tests/qa/markform-full-walkthrough.qa.md`
- Example registry: `packages/markform/src/cli/examples/exampleRegistry.ts`
- Examples command: `packages/markform/src/cli/commands/examples.ts`
