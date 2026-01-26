---
cwd: ../..
env:
  NO_COLOR: "1"
  FORCE_COLOR: "0"
  CLI: ./dist/bin.mjs
timeout: 30000
---

# Export Command Option Tests

Tests for export command with various format and output options.

---

## Format Options

# Test: export --format json

```console
$ $CLI export examples/simple/simple.form.md --format json | head -10
{
  "schema": {
    "id": "simple_test",
    "title": "Simple Test Form",
    "groups": [
      {
        "id": "basic_fields",
        "title": "Basic Fields",
        "children": [
          {
? 0
```

# Test: export --format markform (canonical output)

```console
$ $CLI export examples/simple/simple.form.md --format markform | head -15
---
markform:
  spec: "MF/0.1"
  run_mode: "interactive"
role_instructions:
  user: "Fill in the fields you have direct knowledge of."
  agent: "Complete the remaining fields based on the provided context."
---

{% form id="simple_test" title="Simple Test Form" %}

{% description ref="simple_test" %}
A fully interactive form demonstrating all Markform v0.1 field types.
Fill all fields using interactive prompts - no LLM API key needed.
{% /description %}
? 0
```

# Test: export --format markdown (readable report)

```console
$ $CLI export examples/simple/simple-mock-filled.form.md --format markdown | grep "Alice Johnson"
Alice Johnson
? 0
```

# Test: export filled form as yaml shows schema id

```console
$ $CLI export examples/simple/simple-mock-filled.form.md --format yaml | grep "id: simple_test"
  id: simple_test
? 0
```

---

## Schema Command Options

# Test: schema --pure removes x-markform extension

```console
$ $CLI schema examples/simple/simple.form.md --pure | grep "x-markform" || echo "No x-markform found"
No x-markform found
? 0
```

# Test: schema --draft draft-07

```console
$ $CLI schema examples/simple/simple.form.md --draft draft-07 | head -3
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "simple_test",
? 0
```

# Test: schema --draft 2019-09

```console
$ $CLI schema examples/simple/simple.form.md --draft 2019-09 | head -3
{
  "$schema": "https://json-schema.org/draft/2019-09/schema",
  "$id": "simple_test",
? 0
```

# Test: schema --draft 2020-12 (default)

```console
$ $CLI schema examples/simple/simple.form.md --draft 2020-12 | head -3
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "simple_test",
? 0
```

---

## Validate Command Options

# Test: validate with --verbose shows reading messages

```console
$ $CLI validate examples/simple/simple.form.md --verbose 2>&1 | grep "Reading"
Reading file: examples/simple/simple.form.md
? 0
```

# Test: validate filled form shows fewer issues than empty form

```console
$ $CLI validate examples/simple/simple-mock-filled.form.md | grep "Issues"
Issues (4):
? 0
```

---

## Inspect Command Options

# Test: inspect --format json shows title

```console
$ $CLI inspect examples/simple/simple.form.md --format json | grep '"title": "Simple Test Form"'
  "title": "Simple Test Form",
? 0
```

# Test: inspect --format yaml shows title

```console
$ $CLI inspect examples/simple/simple.form.md --format yaml | head -1
title: Simple Test Form
? 0
```

---

## Status Command Options

# Test: status on filled form shows filled progress

```console
$ $CLI status examples/simple/simple-mock-filled.form.md | grep "Overall"
Overall: 17/21 fields filled (81%)
? 0
```

# Test: status --format json

```console
$ $CLI status examples/simple/simple.form.md --format json | head -8
{
  "path": "examples/simple/simple.form.md",
  "run_mode": "interactive",
  "run_mode_source": "explicit",
  "overall": {
    "total": 21,
    "answered": 0,
    "skipped": 0,
? 0
```
