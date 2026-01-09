---
cwd: ../..
env:
  NO_COLOR: "1"
  FORCE_COLOR: "0"
  CLI: ./dist/bin.mjs
timeout: 30000
---

# CLI Integration Tests

Additional CLI integration tests covering format options, flags, and error handling.
Complements commands.tryscript.md with deeper coverage of specific options.

---

## Help and Version

# Test: --help shows usage and commands

```console
$ $CLI --help
Usage: markform [options] [command]
...
Commands:
...
? 0
```

# Test: --version shows semver

```console
$ $CLI --version
[..]
? 0
```

---

## Inspect Command Options

# Test: inspect with --format json

```console
$ $CLI inspect --format json examples/simple/simple.form.md | head -5
{
  "title": "Simple Test Form",
  "structure": {
    "group_count": 8,
    "field_count": 21,
? 0
```

---

## Validate Command Options

# Test: validate with --verbose shows details

```console
$ $CLI validate --verbose examples/simple/simple.form.md
Reading file: examples/simple/simple.form.md
Parsing form...
Running validation...
Form Validation Report
Title: Simple Test Form

Form State: ◌ empty

Structure:
  Groups: 8
  Fields: 21
  Options: 15

Progress:
  Total fields: 21
  Required: 12
  AnswerState: answered=0, skipped=0, aborted=0, unanswered=21
  Validity: valid=21, invalid=0
  Value: filled=0, empty=21
  Empty required: 12

Issues (21):
  P1 (required) [field] age: Required field "Age" is empty
  P1 (required) [field] categories: Required field "Categories" has no selections
  P1 (required) [field] confirmations: All items in "Confirmations (Explicit Mode)" must be answered (2 unfilled)
  P1 (required) [field] email: Required field "Email" is empty
  P1 (required) [field] event_date: Required field "Event Date" is empty
  P1 (required) [field] founded_year: Required field "Founded Year" is empty
  P1 (required) [field] name: Required field "Name" is empty
  P1 (required) [field] priority: Required field "Priority" has no selection
  P1 (required) [field] tags: Required field "Tags" is empty
  P1 (required) [field] tasks_multi: All items in "Tasks (Multi Mode)" must be completed
  P1 (required) [field] tasks_simple: All items in "Agreements (Simple Mode)" must be checked (2 unchecked)
  P1 (required) [field] website: Required field "Website" is empty
  P3 (recommended) [field] notes: Optional field not yet addressed
  P3 (recommended) [field] optional_date: Optional field not yet addressed
  P3 (recommended) [field] optional_number: Optional field not yet addressed
  P3 (recommended) [field] optional_year: Optional field not yet addressed
  P3 (recommended) [field] project_tasks: Optional field not yet addressed
  P3 (recommended) [field] references: Optional field not yet addressed
  P3 (recommended) [field] related_url: Optional field not yet addressed
  P3 (recommended) [field] score: Optional field not yet addressed
  P3 (recommended) [field] team_members: Optional field not yet addressed
? 0
```

---

## Status Command Options

# Test: status with --format json

```console
$ $CLI status --format json examples/simple/simple.form.md | head -10
{
  "path": "examples/simple/simple.form.md",
  "run_mode": "interactive",
  "run_mode_source": "explicit",
  "overall": {
    "total": 21,
    "answered": 0,
    "skipped": 0,
    "aborted": 0,
    "unanswered": 21
? 0
```

---

## Dump Command

# Test: dump shows field values (empty form)

```console
$ $CLI dump examples/simple/simple.form.md | head -5
name: (unanswered)
email: (unanswered)
...
? 0
```

---

## Export Command Options

# Test: export --format yaml

```console
$ $CLI export --format yaml examples/simple/simple.form.md | head -3
schema:
  id: simple_test
...
? 0
```

# Test: export --format json

```console
$ $CLI export --format json examples/simple/simple.form.md | head -3
{
  "schema": {
...
? 0
```

---

## Schema Command Options

# Test: schema generates JSON Schema

```console
$ $CLI schema examples/simple/simple.form.md | head -5
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "simple_test",
  "type": "object",
...
? 0
```

# Test: schema --pure excludes x-markform extensions

```console
$ $CLI schema --pure examples/simple/simple.form.md > /tmp/schema-test.json && ! grep -q "x-markform" /tmp/schema-test.json && echo "No x-markform found"
No x-markform found
? 0
```

---

## Documentation Commands

# Test: docs shows syntax reference

```console
$ $CLI docs | head -3
# Markform Quick Reference

**Version:** MF/0.1
? 0
```

# Test: readme shows project README

```console
$ $CLI readme | head -3
# Markform
...
? 0
```

---

## Examples Command

# Test: examples --list shows available examples

```console
$ $CLI examples --list
Available examples:

  movie-research-demo [research]
    Movie Research Demo
    Movie lookup with ratings from IMDB and Rotten Tomatoes.
    Source: ./examples/movie-research/movie-research-demo.form.md

  simple [fill]
    Simple Test Form
    Fully interactive demo - no LLM required. Demonstrates all Markform field types.
    Source: ./examples/simple/simple.form.md

  movie-deep-research [research]
    Movie Deep Research
    Comprehensive movie research form with ratings, box office, cast/crew, technical specs, streaming availability, and cultural analysis.
    Source: ./examples/movie-research/movie-deep-research.form.md

  startup-deep-research [research]
    Startup Deep Research
    Comprehensive startup intelligence gathering with company info, founders, funding, competitors, social media, and community presence.
    Source: ./examples/startup-deep-research/startup-deep-research.form.md
? 0
```

---

## Error Handling

# Test: inspect nonexistent file returns error

```console
$ $CLI inspect nonexistent-file.form.md
Error: [..]
? 1
```

# Test: invalid command returns error

```console
$ $CLI invalid-command-xyz
error: unknown command 'invalid-command-xyz'

Usage: markform [options] [command]

Agent-friendly, human-readable, editable forms

Options:
  --version                   output the version number
  --verbose                   Enable verbose output
  --quiet                     Suppress non-essential output
  --dry-run                   Show what would be done without making changes
  --format <format>           Output format: console, plaintext, yaml, json,
                              markform, markdown (default: "console")
  --forms-dir <dir>           Directory for form output (default: ./forms)
  --overwrite                 Overwrite existing field values (default:
                              continue/skip filled)
  -h, --help                  display help for command

Commands:
  readme [options]            ✨Display README documentation ← START HERE!
  docs [options]              Display concise Markform syntax reference
                              (agent-friendly)
  spec [options]              Display the Markform specification
  apis [options]              Display Markform TypeScript and AI SDK API
                              documentation
  apply [options] <file>      Apply patches to a form
  browse [options]            Browse and view files in the forms directory
  dump <file>                 Extract and display form values with state
                              (lightweight inspect)
  examples [options]          Copy bundled example forms to the forms directory
  export [options] <file>     Export form as markform (default), markdown
                              (readable), or json/yaml for structured data
  fill [options] <file>       Run an agent to autonomously fill a form
  inspect [options] <file>    Inspect a form and display its structure,
                              progress, and issues
  models [options]            List available AI providers and example models
  render [options] <file>     Render a form as static HTML output
  report [options] <file>     Generate filtered markdown report (excludes
                              instructions, report=false elements)
  research [options] <input>  Fill a form using a web-search-enabled model
  run [options] [file]        Browse and run forms from the forms directory
  schema [options] <file>     Export form structure as JSON Schema
  serve [options] <file>      Serve a file as a web page (forms are interactive,
                              others are read-only)
  status <file>               Display form fill status with per-role breakdown
  validate <file>             Validate a form and display summary and issues (no
                              form content)
  help [command]              display help for command
? 1
```

# Test: missing required argument shows help

```console
$ $CLI inspect
error: missing required argument 'file'

Usage: markform inspect [options] <file>

Inspect a form and display its structure, progress, and issues

Options:
  --roles <roles>    Filter issues by target roles (comma-separated, or '*' for
                     all; default: all)
  -h, --help         display help for command

Global Options:
  --version          output the version number
  --verbose          Enable verbose output
  --quiet            Suppress non-essential output
  --dry-run          Show what would be done without making changes
  --format <format>  Output format: console, plaintext, yaml, json, markform,
                     markdown (default: "console")
  --forms-dir <dir>  Directory for form output (default: ./forms)
  --overwrite        Overwrite existing field values (default: continue/skip
                     filled)
? 1
```
