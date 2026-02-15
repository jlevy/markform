# Feature: Claude Code Skill Integration

**Date:** 2026-02-14

**Author:** Claude (with human direction)

**Status:** Draft

## Overview

Add Claude Code skill integration to markform so it can install itself as a skill in
Claude Code projects.
This includes a bundled `SKILL.md` file, a `skill` CLI subcommand that outputs the skill
content, and a `setup` command that installs the skill file and hooks into a project’s
`.claude/` directory.

## Goals

- Write a clean, useful SKILL.md that teaches agents how to use markform effectively
- Bundle SKILL.md with the CLI distribution (accessible at runtime)
- Add `markform skill` subcommand that outputs skill content to stdout
- Add `markform setup` subcommand with `--auto` (non-interactive) and `--interactive`
  modes that installs the skill into `.claude/skills/markform/`
- Install `markform skill` as a Claude Code slash-command skill (so it appears alongside
  tbd in the skill list)
- Keep the implementation simple — markform is not as extensive as tbd

## Non-Goals

- Multi-agent integration (Cursor, Codex) — just Claude Code for now
- Prime command or dashboard — the skill command is sufficient
- PreCompact hooks or session management hooks — keep it minimal
- DocCache shadowing or tiered skill files (brief vs full) — one skill file is enough
- Dynamic shortcut/guideline directory generation — markform doesn’t have these

## Background

The tbd CLI provides a reference implementation of the “CLI as Skill” pattern for Claude
Code. Markform can follow the same patterns in a simplified form.
The key insight is that a CLI can install itself as a Claude Code skill, making agents
aware of its capabilities and teaching them how to use it effectively.

Key patterns from tbd’s `cli-agent-skill-patterns` guideline that apply:

1. **Bundled documentation** — SKILL.md ships with the CLI in `dist/docs/`
2. **`skill` subcommand** — outputs skill content to stdout (for agent inspection)
3. **`setup --auto`** — non-interactive install for agents
4. **Setup idempotency** — safe to run repeatedly
5. **“DO NOT EDIT” markers** — in generated skill files
6. **Description optimization** — two-part rule (what + when) for skill activation

## Design

### Approach

Three deliverables, built incrementally:

1. **SKILL.md content** — a markdown file with YAML frontmatter describing markform’s
   capabilities, commands, and usage patterns for agents
2. **`skill` command** — reads and outputs the bundled SKILL.md
3. **`setup` command** — copies SKILL.md to `.claude/skills/markform/SKILL.md` and
   optionally installs a SessionStart hook

### SKILL.md Content Structure

```
---
name: markform
description: >-
  Markdown-based form system for structured data collection by AI agents and humans.
  Use when working with .form.md files, filling forms, validating data, or when the
  user mentions markform, forms, form filling, structured data, or field validation.
allowed-tools: Bash(markform:*)
---
# Markform — Agent Skill

## What Markform Does
[Capabilities overview]

## Core Commands
[Command reference table]

## Common Workflows
[Agent-oriented workflow guidance]
```

Target: under 300 lines, under 2000 tokens.

### `skill` Command

Simple command following the existing `docs.ts` pattern:

- Loads SKILL.md from bundled location (dist/) or dev location (docs/)
- Outputs raw content to stdout (no terminal formatting — this is for agents)
- No flags needed (single skill file, no brief mode)

### `setup` Command

Two modes:

- `markform setup --auto` — non-interactive, for agents:
  1. Create `.claude/skills/markform/` directory
  2. Write SKILL.md with “DO NOT EDIT” marker
  3. Print confirmation
- `markform setup --interactive` — guided, for humans:
  1. Same as auto, but with prompts/confirmations via @clack/prompts
  2. Explain what’s being installed

Both modes are idempotent — safe to run repeatedly.

**No hooks installation** — keep it simple.
Just the skill file.

### File Locations

**Source (in repo):**
```
packages/markform/docs/skill/SKILL.md       # Source skill content
```

**Bundled (after build):**
```
packages/markform/dist/docs/skill/SKILL.md   # Copied during build
```

**Installed (in user project):**
```
.claude/skills/markform/SKILL.md              # Installed by setup
```

### Build Integration

Add a postbuild step (or extend existing build) to copy `docs/skill/SKILL.md` to
`dist/docs/skill/SKILL.md` so it’s available in the published package.

### Loading Strategy

Follow the same pattern as existing `docs.ts` command:

```typescript
function getSkillPath(): string {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const dirName = thisDir.split(/[/\\]/).pop();
  if (dirName === 'dist') {
    return join(dirname(thisDir), 'docs', 'skill', 'SKILL.md');
  }
  // Dev fallback
  return join(/* traverse to package root */, 'docs', 'skill', 'SKILL.md');
}
```

## Implementation Plan

### Phase 1: Skill Content & Commands

- [ ] Write `docs/skill/SKILL.md` with agent-oriented markform documentation
- [ ] Add build step to copy skill docs to `dist/docs/skill/`
- [ ] Implement `skill` command (`src/cli/commands/skill.ts`)
- [ ] Implement `setup` command (`src/cli/commands/setup.ts`)
- [ ] Register both commands in `cli.ts`
- [ ] Test: `markform skill` outputs valid SKILL.md content
- [ ] Test: `markform setup --auto` creates `.claude/skills/markform/SKILL.md`
- [ ] Test: `markform setup --auto` is idempotent (run twice, same result)

## Testing Strategy

- Manual: run `markform skill` and verify output is clean SKILL.md
- Manual: run `markform setup --auto` in a test directory, verify file created
- CLI e2e: add tryscript test for `markform skill` output
- Verify bundled path works after `pnpm build` with `pnpm markform:bin skill`

## Open Questions

- Should setup install any hooks (SessionStart to run `markform skill`)? Current answer:
  no, keep it simple. Users/agents can add hooks manually if desired.
- Should the skill file reference tbd integration (since the project uses tbd)?
  Current answer: no, keep markform skill self-contained.

## References

- tbd CLI agent skill patterns guideline (loaded in context)
- tbd source code: `attic/tbd/packages/tbd/src/cli/commands/skill.ts`
- tbd source code: `attic/tbd/packages/tbd/src/cli/commands/setup.ts`
- Markform existing doc commands: `packages/markform/src/cli/commands/docs.ts`
