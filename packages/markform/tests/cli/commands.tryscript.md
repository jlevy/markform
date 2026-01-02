---
env:
  NO_COLOR: "1"
  FORCE_COLOR: "0"
timeout: 30000
---

# Markform CLI Command Tests

This file tests all Markform CLI commands for correct output and exit codes.

---

## Global Options

### --version shows version number

```console
$ /home/user/markform/packages/markform/dist/bin.mjs --version
[..]
? 0
```

### --help shows usage summary

```console
$ /home/user/markform/packages/markform/dist/bin.mjs --help
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

### status shows fill progress

```console
$ /home/user/markform/packages/markform/dist/bin.mjs status /home/user/markform/packages/markform/examples/simple/simple.form.md
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

### validate shows issues

```console
$ /home/user/markform/packages/markform/dist/bin.mjs validate /home/user/markform/packages/markform/examples/simple/simple.form.md
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

### inspect shows form structure

```console
$ /home/user/markform/packages/markform/dist/bin.mjs inspect /home/user/markform/packages/markform/examples/simple/simple.form.md
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

### dump shows field values

```console
$ /home/user/markform/packages/markform/dist/bin.mjs dump /home/user/markform/packages/markform/examples/simple/simple-mock-filled.form.md
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

### readme displays README

```console
$ /home/user/markform/packages/markform/dist/bin.mjs readme | head -10
# Markform

[![CI](https://github.com/jlevy/markform/actions/workflows/ci.yml/badge.svg)](https://github.com/jlevy/markform/actions/workflows/ci.yml)
...
? 0
```

### docs shows syntax reference

```console
$ /home/user/markform/packages/markform/dist/bin.mjs docs | head -10
# Markform Quick Reference

**Version:** MF/0.1

Markform is structured Markdown for forms.
Files combine YAML frontmatter with [Markdoc](https://markdoc.dev/) tags to define
typed, validated fields.
...
? 0
```

---

## Export Commands

### export --format yaml

```console
$ /home/user/markform/packages/markform/dist/bin.mjs export /home/user/markform/packages/markform/examples/simple/simple.form.md --format yaml | head -15
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

### schema generates JSON Schema

```console
$ /home/user/markform/packages/markform/dist/bin.mjs schema /home/user/markform/packages/markform/examples/simple/simple.form.md | head -10
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

### examples --list shows available examples

```console
$ /home/user/markform/packages/markform/dist/bin.mjs examples --list
Available examples:
...
? 0
```

### models lists available providers

```console
$ /home/user/markform/packages/markform/dist/bin.mjs models
anthropic/
  env: ANTHROPIC_API_KEY
  models:
...
? 0
```
