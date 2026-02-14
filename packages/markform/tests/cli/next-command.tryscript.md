---
cwd: ../..
env:
  NO_COLOR: "1"
  FORCE_COLOR: "0"
  CLI: ./dist/bin.mjs
timeout: 30000
---

# Next Command Tests

Tests for the `next` command (field advisor for CLI-driven form filling).

---

## Help and Basic Output

# Test: next --help shows command options

```console
$ $CLI next --help
Usage: markform next [options] <file>
...
? 0
```

# Test: next shows issues for empty form

```console
$ $CLI next examples/simple/simple.form.md 2>&1 | head -3
State: empty (0/21 fields filled, 12 required remaining)

Next fields to fill (10 issues, budget: 10):
? 0
```

# Test: next includes set_example in output

```console
$ $CLI next examples/simple/simple.form.md 2>&1 | grep "markform set" | head -3
     -> markform set examples/simple/simple.form.md age 42
     -> markform set examples/simple/simple.form.md categories '["frontend", "backend", "database", "devops"]'
[..]
? 0
```

---

## JSON Output

# Test: next --format json produces valid JSON

```console
$ $CLI next --format json examples/simple/simple.form.md | head -8
{
  "is_complete": false,
  "form_state": "empty",
  "step_budget": 10,
  "progress": {
    "total_fields": 21,
    "required_fields": 12,
    "filled_fields": 0,
? 0
```

# Test: next --format json includes enriched field metadata

```console
$ $CLI next --format json examples/simple/simple.form.md | grep -A 5 '"field":' | head -6
      "field": {
        "kind": "number",
        "label": "Age",
        "required": true
      }
    },
? 0
```

# Test: next --format json includes options for select fields

```console
$ $CLI next --format json examples/simple/simple.form.md | grep -A 3 '"options":' | head -4
        "options": [
          "frontend",
          "backend",
          "database",
? 0
```

---

## Filtering

# Test: next --max-issues limits output count

```console
$ $CLI next --max-issues 2 examples/simple/simple.form.md 2>&1 | head -2
State: empty (0/21 fields filled, 12 required remaining)

? 0
```

# Test: next --max-issues 2 shows only 2 issues in JSON

```console
$ $CLI next --max-issues 2 --format json examples/simple/simple.form.md | grep '"ref":' | wc -l
2
? 0
```

---

## Complete Form

# Test: next on partially filled form shows remaining issues

```console
$ $CLI set examples/simple/simple.form.md --values '{"name":"Test","email":"test@test.com","age":"30","priority":"high","website":"https://example.com","event_date":"2024-01-15","founded_year":"2024"}' -o /tmp/next-test-partial.form.md 2>&1 && echo "SETUP_OK"
Form updated: /tmp/next-test-partial.form.md
SETUP_OK
? 0
```

# Test: next shows fewer issues after filling some fields

```console
$ $CLI next --format json /tmp/next-test-partial.form.md | grep '"form_state":'
  "form_state": "incomplete",
? 0
```

# Test: next filled_fields count is updated

```console
$ $CLI next --format json /tmp/next-test-partial.form.md | grep '"filled_fields":'
    "filled_fields": 7,
? 0
```

---

## Error Handling

# Test: next nonexistent file returns error

```console
$ $CLI next nonexistent-file.form.md 2>&1
Error: [..]
? 1
```
