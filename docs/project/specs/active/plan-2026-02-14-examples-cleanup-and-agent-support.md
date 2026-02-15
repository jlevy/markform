---
title: Examples Cleanup and Agent Support
description: Clean up example directories, register quality examples, and add agent-friendly output to the examples command
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: Examples Cleanup and Agent Support

**Date:** 2026-02-14

**Status:** Implemented

## Overview

The examples system has 9 directories but only 4 registered in the CLI. Some directories
are empty or redundant, descriptions have bugs, and the `--list` output lacks structured
format support for agents.
This spec covers cleanup, registering high-quality examples, and adding `--format=json`
support so agents can programmatically discover and use examples.

## Goals

- Present two clear getting-started paths in the README for new users
- Clean up unused/redundant example directories
- Register high-quality examples that demonstrate diverse Markform use cases
- Make `markform examples --list` agent-friendly with JSON output
- Update SKILL.md so agents can discover examples without running the CLI
- Cross-reference the QA playbook and examples so they work as a unified experience

## Non-Goals

- Redesigning the interactive examples flow (it works fine for humans)
- Moving test fixture examples (`rejection-test`, `plan-document`, `parallel`) to a
  different directory
- Adding new example forms beyond what already exists

## Background

The examples system was built for interactive human use.
The QA playbook (`markform-full-walkthrough.qa.md`) was recently created as an
end-to-end agent walkthrough.
These two paths into Markform should complement each other: examples for focused demos
of specific features, the QA playbook for a comprehensive tour.

Currently `--name` and `--list` flags already work non-interactively, but `--list` only
produces human-readable output with ANSI colors.
Agents need structured JSON to programmatically select and copy examples.

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

### The new user perspective

A new user discovering Markform needs clear options for getting started.
There are three paths, from quickest to most thorough:

1. **Run an example automatically**: `markform examples` → `markform run`. An LLM fills
   a bundled form end to end.
   Quick way to see what Markform produces.
   Requires an API key.

2. **Agent-guided tour of an example**: A coding agent (like Claude Code) walks the user
   through running a specific bundled example, explaining each step: copying the form,
   inspecting it, filling it, validating, and exporting.
   The agent uses the CLI non-interactively (`--name`, `--list`) and narrates.
   Requires an API key for the fill step.

3. **End-to-end walkthrough playbook**: A coding agent follows the QA playbook
   (`markform-full-walkthrough.qa.md`) to design a research form from scratch, fill it
   with real data, validate, export, and browse.
   The most thorough tour of all features.
   Requires an API key and web search access.

The README currently only shows option 1 ("Quick Start" → `npx markform examples`).
Options 2 and 3 don’t exist in the README.

The SKILL.md currently mentions `markform examples` and `markform fill` but doesn’t list
specific examples, doesn’t mention the walkthrough playbook, and doesn’t mention API key
requirements. An agent reading the skill should be able to help the user set up their
environment and choose the right getting-started path.

### Approach

Minimal changes: update the README with both paths, delete cruft, register one new
example, add JSON output to `--list`, update docs.

### Components

1. **README** (`packages/markform/README.md`): Update Quick Start to present all three
   getting-started paths
2. **SKILL.md** (`docs/skill/SKILL.md`): Add getting-started section with all three
   paths, examples table, API key setup, and a reference to the walkthrough playbook.
   An agent reading this should be self-sufficient to guide a new user.
3. **Example registry** (`src/cli/examples/exampleRegistry.ts`): Add `twitter-thread`,
   reorder for natural complexity ramp
4. **Examples command** (`src/cli/commands/examples.ts`): Add `--format=json` to
   `--list` using existing `formatOutput()` pattern
5. **QA playbook**: Add cross-reference to examples
6. **Parallel example**: Fix description bug

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

- [x] Update README Quick Start to present all three getting-started paths: (1)
  automated `markform examples` + `markform run`, (2) agent-guided example tour, (3)
  end-to-end walkthrough playbook
- [x] Delete `examples/earnings-analysis/` (empty directory)
- [x] Delete `examples/startup-research/` (redundant with startup-deep-research)
- [x] Update `tests/qa/live-fill-manual-test.qa.md` reference from startup-research to
  startup-deep-research
- [x] Fix `examples/parallel/parallel-research.form.md` description: fill in blank
  template variables (`parallel` and `order`)
- [x] Add `twitter-thread` to `EXAMPLE_DEFINITIONS` in `exampleRegistry.ts` (type:
  `fill`)
- [x] Reorder `EXAMPLE_DEFINITIONS` for complexity ramp: movie-research-demo, simple,
  twitter-thread, movie-deep-research, startup-deep-research
- [x] Add `--format=json` support to `printExamplesList()` using existing
  `formatOutput()` pattern
- [x] Move `getCommandContext(cmd)` before the `--list` check in the action handler
- [x] Add cross-reference note in console `--list` output pointing to the QA playbook
- [x] Add examples cross-reference tip in QA playbook Phase 3.2
- [x] Update SKILL.md: add “Getting Started” section with all three paths, examples
  table with descriptions, API key setup (providers, env vars, `markform models`), and
  reference to walkthrough playbook.
  An agent reading this should be able to guide a new user through setup and choose the
  right path.

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

- QA playbook: `packages/markform/tests/qa/markform-full-walkthrough.qa.md`
- Example registry: `packages/markform/src/cli/examples/exampleRegistry.ts`
- Examples command: `packages/markform/src/cli/commands/examples.ts`
- SKILL.md: `packages/markform/docs/skill/SKILL.md`
- README: `packages/markform/README.md`
