---
cwd: ../..
env:
  NO_COLOR: "1"
  FORCE_COLOR: "0"
  CLI: ./dist/bin.mjs
timeout: 30000
---

# Set Command Tests

Tests for the `set` command with auto-coercion, batch mode, meta ops, and append/delete.

---

## Basic Set Operations

# Test: set --help shows command options

```console
$ $CLI set --help
Usage: markform set [options] <file> [fieldId] [value]
...
? 0
```

# Test: set a string field

```console
$ $CLI set examples/simple/simple.form.md name "Alice" -o /tmp/set-test-string.form.md 2>&1 && $CLI dump /tmp/set-test-string.form.md | head -1
Form updated: /tmp/set-test-string.form.md
name: "Alice"
? 0
```

# Test: set a number field (coerced from string)

```console
$ $CLI set examples/simple/simple.form.md age 25 -o /tmp/set-test-number.form.md 2>&1 && $CLI dump /tmp/set-test-number.form.md | grep "^age:"
Form updated: /tmp/set-test-number.form.md
age: 25
? 0
```

# Test: set a single select field

```console
$ $CLI set examples/simple/simple.form.md priority high -o /tmp/set-test-select.form.md 2>&1 && $CLI dump /tmp/set-test-select.form.md | grep "^priority:"
Form updated: /tmp/set-test-select.form.md
priority: high
? 0
```

---

## Batch Mode

# Test: set --values with multiple fields

```console
$ $CLI set examples/simple/simple.form.md --values '{"name":"Bob","age":"30","priority":"high"}' -o /tmp/set-test-batch.form.md 2>&1 && $CLI dump /tmp/set-test-batch.form.md | grep -E "^(name|age|priority):"
Form updated: /tmp/set-test-batch.form.md
name: "Bob"
age: 30
priority: high
? 0
```

# Test: set --values rejects positional fieldId

```console
$ $CLI set examples/simple/simple.form.md somefield --values '{"name":"X"}' 2>&1
Error: Cannot use --values with positional fieldId/value arguments
? 1
```

# Test: set --values with invalid JSON

```console
$ $CLI set examples/simple/simple.form.md --values 'not json' 2>&1
Error: Invalid JSON in --values option
? 1
```

---

## Meta Operations

# Test: set --clear clears a field

```console
$ $CLI set examples/simple/simple.form.md name --clear -o /tmp/set-test-clear.form.md 2>&1 && echo "OK"
Form updated: /tmp/set-test-clear.form.md
OK
? 0
```

# Test: set --skip marks field as skipped

```console
$ $CLI set examples/simple/simple.form.md notes --skip --reason "Not applicable" -o /tmp/set-test-skip.form.md 2>&1 && $CLI dump /tmp/set-test-skip.form.md | grep "^notes:"
Form updated: /tmp/set-test-skip.form.md
notes: [skipped] Not applicable
? 0
```

# Test: set --abort marks field as aborted

```console
$ $CLI set examples/simple/simple.form.md notes --abort --reason "Cannot determine" -o /tmp/set-test-abort.form.md 2>&1 && $CLI dump /tmp/set-test-abort.form.md | grep "^notes:"
Form updated: /tmp/set-test-abort.form.md
notes: [aborted] Cannot determine
? 0
```

---

## Append and Delete

# Test: set --append adds items to a string_list

```console
$ $CLI set examples/simple/simple.form.md tags --append "tag1" -o /tmp/set-test-append.form.md 2>&1 && $CLI dump /tmp/set-test-append.form.md | grep "^tags:"
Form updated: /tmp/set-test-append.form.md
tags: [tag1]
? 0
```

# Test: set --append adds rows to a table

```console
$ $CLI set examples/simple/simple.form.md team_members --append '{"name":"Alice","role":"Lead"}' -o /tmp/set-test-append-table.form.md 2>&1 && echo "OK"
Form updated: /tmp/set-test-append-table.form.md
OK
? 0
```

# Test: set --delete removes item from string_list

```console
$ $CLI set examples/simple/simple.form.md tags --append "toDelete" -o /tmp/set-test-del-prep.form.md 2>&1 && $CLI set /tmp/set-test-del-prep.form.md tags --delete 0 2>&1 && $CLI dump /tmp/set-test-del-prep.form.md | grep "^tags:"
Form updated: /tmp/set-test-del-prep.form.md
Form updated: /tmp/set-test-del-prep.form.md
tags: (unanswered)
? 0
```

---

## Error Handling

# Test: set without fieldId or --values shows error

```console
$ $CLI set examples/simple/simple.form.md 2>&1
Error: Either <fieldId> or --values is required
? 1
```

# Test: set with fieldId but no value shows error

```console
$ $CLI set examples/simple/simple.form.md name 2>&1
Error: No value provided. Use <value>, --clear, --skip, --abort, --append, or --delete
? 1
```

# Test: set nonexistent field shows error

```console
$ $CLI set examples/simple/simple.form.md nonexistent_field "value" 2>&1
Error: [..]
? 1
```

# Test: set --append on unsupported field type shows error

```console
$ $CLI set examples/simple/simple.form.md name --append "value" 2>&1
Error: --append is not supported for string fields (only table, string_list, url_list)
? 1
```

# Test: set --delete with negative index shows error

```console
$ $CLI set examples/simple/simple.form.md tags --delete -1 2>&1
Error: --delete requires a non-negative integer index, got "-1"
? 1
```

# Test: set --delete on unsupported field type shows error

```console
$ $CLI set examples/simple/simple.form.md name --delete 0 2>&1
Error: --delete is not supported for string fields (only table, string_list, url_list)
? 1
```

# Test: set --values rejects non-object JSON

```console
$ $CLI set examples/simple/simple.form.md --values '"just a string"' 2>&1
Error: --values must be a JSON object
? 1
```

# Test: set type mismatch reports patch rejection

```console
$ $CLI set examples/simple/simple.form.md age "not_a_number" 2>&1
Error: [..]
? 1
```

# Test: set on nonexistent file shows error

```console
$ $CLI set /tmp/nonexistent-form-12345.form.md name "Alice" 2>&1
Error: [..]
? 1
```

---

## Report Mode

# Test: set --report outputs JSON report

```console
$ $CLI set examples/simple/simple.form.md name "ReportTest" --report --format json -o /tmp/set-test-report.json 2>&1 && grep "apply_status" /tmp/set-test-report.json
Report written to /tmp/set-test-report.json
  "apply_status": "applied",
? 0
```

---

## Dry Run

# Test: set --dry-run shows what would change

```console
$ $CLI set examples/simple/simple.form.md name "DryRun" --dry-run 2>&1 | grep "DRY RUN"
[DRY RUN] Would apply 1 patches to examples/simple/simple.form.md
? 0
```
