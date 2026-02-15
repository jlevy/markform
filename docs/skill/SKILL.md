---
name: markform
description: >-
  Markdown-based form system for structured data collection by AI agents and humans.
  Inspect, fill, validate, and export .form.md files with typed fields and role-based workflows.
  Use when working with .form.md files, filling forms, validating fields, exporting data,
  or when the user mentions markform, forms, form filling, structured data, or field validation.
allowed-tools: Bash(markform:*)
---
# Markform Agent Skill

Markform is structured Markdown for forms.
Files combine YAML frontmatter with HTML comment tags to define typed, validated fields.
Forms render cleanly on GitHub since structure is hidden in comments.

## Getting Started

There are three ways to help a user get started with Markform:

1. **Run an example automatically:** `markform examples` copies bundled forms, then
   `markform run <form>` fills one end-to-end with an LLM. Quickest demo.
2. **Agent-guided example tour:** Walk the user through a specific bundled example step
   by step—copy it, inspect the structure, fill fields, validate, and export.
   Use `markform examples --list` to pick an example, then `--name <id>` to copy it.
3. **End-to-end walkthrough playbook:** Follow `examples/markform-demo-playbook.md` to
   design a research form from scratch, fill it with real data, validate, export, and
   browse. The most thorough tour of all Markform features.

### API Key Setup

Automated filling (`markform fill --model`, `markform run`) requires an LLM API key.
Set one of these environment variables (or add to `.env`):

- `OPENAI_API_KEY` — for OpenAI models (e.g., `openai/gpt-4o`)
- `ANTHROPIC_API_KEY` — for Anthropic models (e.g.,
  `anthropic/claude-sonnet-4-5-20250929`)

Run `markform models` to see available providers and configured keys.

### Bundled Examples

| Example | Type | Description |
| --- | --- | --- |
| `movie-research-demo` | research | Quick movie ratings lookup (IMDB, Rotten Tomatoes) |
| `simple` | fill | Interactive demo of all field types |
| `twitter-thread` | fill | Multi-stage content-to-Twitter-thread transformation |
| `movie-deep-research` | research | Comprehensive movie analysis with multiple sources |
| `startup-deep-research` | research | Startup intelligence: funding, team, market, press |

```bash
markform examples --list                        # See all examples
markform examples --list --format=json          # Structured output for agents
markform examples --name <id> --forms-dir ./    # Copy a specific example
```

## What Markform Does

1. **Structured Forms:** Define typed fields (string, number, select, table, etc.)
   in Markdown with validation constraints
2. **Role-Based Filling:** Separate fields for humans (`role="user"`) and AI agents
   (`role="agent"`)
3. **Incremental Filling:** Fill fields one at a time with immediate validation
4. **Agent-Driven Workflows:** AI agents fill forms via CLI or programmatic API
5. **Multi-Format Export:** Export filled data as JSON, YAML, or Markdown

## Core CLI Commands

| Command | Purpose |
| --- | --- |
| `markform inspect <form>` | Show form structure, progress, and issues |
| `markform validate <form>` | Check for constraint violations and errors |
| `markform set <form> <field> "value"` | Set a field value (auto-coerced) |
| `markform set <form> --values '{"k":"v"}'` | Batch set multiple fields |
| `markform next <form>` | Recommend the next field to fill |
| `markform fill <form> --interactive` | Interactive prompts for user fields |
| `markform fill <form> --model <model>` | AI agent fills form fields |
| `markform export <form> --format=json` | Export values as JSON |
| `markform export <form> --format=yaml` | Export values as YAML |
| `markform export <form> --format=markdown` | Full rendered markdown (includes instructions) |
| `markform report <form>` | Clean report markdown (values only, no instructions) |
| `markform schema <form>` | Export JSON Schema for form structure |
| `markform dump <form>` | Quick dump of current field values |
| `markform status <form>` | Show fill progress per role |
| `markform docs` | Show Markform syntax reference |
| `markform examples` | Copy built-in example forms |
| `markform serve <form>` | Web UI for browsing and editing |

## Agent Workflow

When working with markform files:

1. **Inspect first:** `markform inspect form.md` to understand the form structure, see
   which fields exist, their types, constraints, and current fill progress
2. **Check what’s next:** `markform next form.md` to see which field should be filled
   next (respects priority, order, and role)
3. **Set values:** `markform set form.md field_id "value"` to fill fields one at a time,
   or use `--values` for batch updates
4. **Validate:** `markform validate form.md` to check all constraints are met
5. **Export:** `markform export form.md --format=json` to extract filled data

## Setting Field Values

The `set` command is the primary way to fill fields.
It auto-coerces values to the correct type:

```bash
# String fields
markform set form.md name "Alice Smith"

# Number fields (auto-coerced from string)
markform set form.md age 30

# Single select (by option ID)
markform set form.md rating high

# Multi select (JSON array of option IDs)
markform set form.md categories '["frontend","backend"]'

# Checkboxes (JSON object of {itemId: value})
markform set form.md tasks '{"research":"done","testing":"done"}'

# Table (append rows as JSON)
markform set form.md team --append '[{"name": "Alice", "title": "Engineer"}]'

# Batch set multiple fields
markform set form.md --values '{"name": "Alice", "age": 30, "rating": "high"}'

# Special operations
markform set form.md field_id --clear    # Clear a field value
markform set form.md field_id --skip     # Skip (mark as skipped)
markform set form.md field_id --abort    # Abort (mark as aborted)
```

## Global Options

All commands support:

| Option | Description |
| --- | --- |
| `--format <fmt>` | Output format: console, json, yaml, plaintext, markform, markdown |
| `--verbose` | Enable verbose/debug output |
| `--quiet` | Suppress non-essential output |
| `--dry-run` | Show what would be done without changes |
| `--overwrite` | Overwrite existing field values |

## File Conventions

| Extension | Purpose |
| --- | --- |
| `.form.md` | Markform source and filled forms |
| `.fill.json` | Execution metadata (sidecar, auto-generated) |
| `.report.md` | Filtered human-readable output |
| `.schema.json` | JSON Schema export |

## More Information

- Syntax reference: `markform docs`
- Full specification: `markform spec`
- API documentation: `markform apis`
- Example forms: `markform examples`
- End-to-end walkthrough: `examples/markform-demo-playbook.md`
