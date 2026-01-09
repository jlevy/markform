---
cwd: ../..
env:
  NO_COLOR: "1"
  FORCE_COLOR: "0"
  CLI: ./dist/bin.mjs
timeout: 30000
---

# Markform CLI Command Tests

This file tests all Markform CLI commands for correct output and exit codes.

---

## Global Options

# Test: --version shows version number

```console
$ $CLI --version
[..]
? 0
```

# Test: --help shows usage summary

```console
$ $CLI --help
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
...
  help [command]              display help for command
? 0
```

---

## Inspection Commands

# Test: status shows fill progress

```console
$ $CLI status examples/simple/simple.form.md
Form Status: simple.form.md

Overall: 0/21 fields filled (0%)
  ✓ Complete: 0
  ○ Empty: 21

By Role:
  user: 0/21 filled (0%) ← needs attention

Run Mode: interactive (explicit)
Suggested: markform fill simple.form.md --interactive
? 0
```

# Test: validate shows issues

```console
$ $CLI validate examples/simple/simple.form.md
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
...
? 0
```

# Test: inspect shows form structure

```console
$ $CLI inspect examples/simple/simple.form.md
Form Inspection Report
Title: Simple Test Form

Form State: ◌ empty

Structure:
  Groups: 8
  Fields: 21
  Options: 15

Progress:
...
Form Content:
...
Issues (21):
...
? 0
```

# Test: dump shows field values

```console
$ $CLI dump examples/simple/simple-mock-filled.form.md
name: "Alice Johnson"
email: "alice@example.com"
age: 32
score: 87.5
tags: [typescript, testing, forms]
priority: medium
categories: [frontend, backend]
tasks_multi: research:done, design:done, implement:done, test:na
tasks_simple: read_guidelines:done, agree_terms:done
confirmations: backed_up:yes, notified:no
website: "https://alice.dev"
references: [https://docs.example.com/guide, https://github.com/example/project, https://medium.com/article-about-forms]
event_date: 2025-06-15
founded_year: 2020
team_members: (2 rows)
project_tasks: (unanswered)
notes: "This is a test note."
optional_number: (unanswered)
related_url: "https://markform.dev/docs"
optional_date: (unanswered)
optional_year: (unanswered)
? 0
```

---

## Documentation Commands

# Test: readme displays README

```console
$ $CLI readme | head -5
# Markform

[![CI](https://github.com/jlevy/markform/actions/workflows/ci.yml/badge.svg)][..]
...
? 0
```

# Test: docs shows syntax reference

```console
$ $CLI docs | head -10
<!--
SPDX-License-Identifier: CC-BY-4.0

Markform Quick Reference - Licensed under Creative Commons Attribution 4.0 International
https://creativecommons.org/licenses/by/4.0/

You may freely implement this specification in your own software under any license.
The reference implementation at https://github.com/jlevy/markform is separately
licensed under AGPL-3.0-or-later. Contact the author for commercial licensing options.
-->
? 0
```

---

## Export Commands

# Test: export --format yaml

```console
$ $CLI export examples/simple/simple.form.md --format yaml | head -15
schema:
  id: simple_test
  title: Simple Test Form
  groups:
    - id: basic_fields
      title: Basic Fields
      children:
        - id: name
          kind: string
          label: Name
          required: true
          placeholder: Enter your name
          examples:
            - John Smith
            - Jane Doe
? 0
```

# Test: schema generates JSON Schema

```console
$ $CLI schema examples/simple/simple.form.md | head -10
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "simple_test",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "title": "Name",
      "minLength": 2,
      "maxLength": 50,
? 0
```

---

## Utility Commands

# Test: examples --list shows available examples

```console
$ $CLI examples --list
Available examples:
...
? 0
```

# Test: models lists available providers

```console
$ $CLI models
anthropic/
  env: ANTHROPIC_API_KEY
  models:
...
? 0
```

---

## Report Command

# Test: report generates filtered markdown

```console
$ $CLI report examples/simple/simple-mock-filled.form.md | head -13
# Simple Test Form

A fully interactive form demonstrating all Markform v0.1 field types.
Fill all fields using interactive prompts - no LLM API key needed.

## Basic Fields

**Name:**
Alice Johnson

**Email:**
alice@example.com
? 0
```

# Test: report --help shows command options

```console
$ $CLI report --help
Usage: markform report [options] <file>

Generate filtered markdown report (excludes instructions, report=false elements)
...
? 0
```

---

## Render Command

# Test: render --help shows command options

```console
$ $CLI render --help
Usage: markform render [options] <file>

Render a form as static HTML output
...
? 0
```

# Test: render --dry-run shows what would be done

```console
$ $CLI render examples/simple/simple.form.md --dry-run
[DRY RUN] Would write HTML to: [..]simple.form.html
? 0
```

---

## Spec Command

# Test: spec shows specification

```console
$ $CLI spec | head -10
<!--
SPDX-License-Identifier: CC-BY-4.0

Markform Specification - Licensed under Creative Commons Attribution 4.0 International
https://creativecommons.org/licenses/by/4.0/

You may freely implement this specification in your own software under any license.
The reference implementation at https://github.com/jlevy/markform is separately
licensed under AGPL-3.0-or-later. Contact the author for commercial licensing options.
-->
? 0
```

---

## APIs Command

# Test: apis shows API documentation

```console
$ $CLI apis | head -5
# Markform APIs

Markform provides TypeScript APIs for parsing, validating, and manipulating forms
programmatically.
? 0
```
