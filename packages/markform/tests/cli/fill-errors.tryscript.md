---
cwd: ../..
env:
  NO_COLOR: "1"
  FORCE_COLOR: "0"
  CLI: ./dist/bin.mjs
timeout: 30000
---

# Fill Command Error Handling Tests

Tests for fill command validation and error handling.

---

## Option Validation Errors

# Test: --mock requires --mock-source

```console
$ $CLI fill examples/simple/simple.form.md --mock
Error: --mock requires --mock-source <file>
? 1
```

# Test: missing --model in agent mode shows providers

```console
$ $CLI fill examples/simple/simple.form.md
Error: Live agent requires --model <provider/model-id>

Available providers and example models:
...
? 1
```

# Test: --interactive conflicts with --mock

```console
$ $CLI fill examples/simple/simple.form.md --interactive --mock --mock-source examples/simple/simple-mock-filled.form.md
Error: --interactive cannot be used with --mock
? 1
```

# Test: --interactive conflicts with --model

```console
$ $CLI fill examples/simple/simple.form.md --interactive --model anthropic/claude-sonnet-4-5
Error: --interactive cannot be used with --model
? 1
```

# Test: --interactive conflicts with --mock-source

```console
$ $CLI fill examples/simple/simple.form.md --interactive --mock-source examples/simple/simple-mock-filled.form.md
Error: --interactive cannot be used with --mock-source
? 1
```

# Test: invalid --mode value

```console
$ $CLI fill examples/simple/simple.form.md --mock --mock-source examples/simple/simple-mock-filled.form.md --mode=invalid
Error: Invalid --mode: invalid. Valid modes: continue, overwrite
? 1
```

---

## Mock Mode Tests

# Test: fill --mock --dry-run shows what would be done

```console
$ $CLI fill examples/simple/simple.form.md --mock --mock-source examples/simple/simple-mock-filled.form.md --dry-run --output /tmp/test-fill-output.form.md 2>&1 | grep "DRY RUN"
[DRY RUN] Would write form to: /tmp/test-fill-output.form.md
? 0
```

# Test: fill --mock with valid source shows completion

```console
$ $CLI fill examples/simple/simple.form.md --mock --mock-source examples/simple/simple-mock-filled.form.md --output /tmp/test-fill-mock.form.md 2>&1 | grep "Expected:"
Expected: ✓ complete
? 0
```

# Test: fill --mock with --mode=overwrite runs correctly

```console
$ $CLI fill examples/simple/simple.form.md --mock --mock-source examples/simple/simple-mock-filled.form.md --output /tmp/test-fill-overwrite.form.md --mode=overwrite 2>&1 | grep "Mode:"
Mode: mock
? 0
```

# Test: fill --mock transcript shows harness config

```console
$ $CLI fill examples/simple/simple.form.md --mock --mock-source examples/simple/simple-mock-filled.form.md --output /tmp/test-fill-config.form.md 2>&1 | grep "Max turns:"
  Max turns: 100
? 0
```

---

## Missing File Errors

# Test: fill missing source file

```console
$ $CLI fill /nonexistent/form.md --mock --mock-source /also/missing.md
Error: ENOENT: no such file or directory, open '/nonexistent/form.md'
? 1
```

# Test: fill missing mock-source file

```console
$ $CLI fill examples/simple/simple.form.md --mock --mock-source /nonexistent/mock.form.md
Error: ENOENT: no such file or directory, open '/nonexistent/mock.form.md'
? 1
```

---

## FillRecord Summary Tests

# Test: fill shows summary by default

```console
$ $CLI fill examples/simple/simple.form.md --mock --mock-source examples/simple/simple-mock-filled.form.md --output /tmp/test-fill-summary.form.md 2>&1 | grep -E "Fill (completed|partial)"
Fill completed in ...
? 0
```

# Test: fill --quiet suppresses summary

```console
$ $CLI fill examples/simple/simple.form.md --mock --mock-source examples/simple/simple-mock-filled.form.md --output /tmp/test-fill-quiet.form.md --quiet 2>&1 | grep "Fill completed" | wc -l
0
? 0
```

# Test: fill --record-fill creates sidecar file

```console
$ $CLI fill examples/simple/simple.form.md --mock --mock-source examples/simple/simple-mock-filled.form.md --output /tmp/test-fill-record.form.md --record-fill 2>&1 | grep "Fill record written"
Fill record written to: /tmp/test-fill-record.fill.json
? 0
```
