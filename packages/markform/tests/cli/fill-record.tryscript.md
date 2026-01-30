---
cwd: ../..
env:
  NO_COLOR: "1"
  FORCE_COLOR: "0"
  CLI: ./dist/bin.mjs
timeout: 30000
---

# FillRecord Summary Tests

Tests for FillRecord capture and summary output during form filling.

---

## Summary Output

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

# Test: fill summary shows complete format structure

This test demonstrates the full FillRecord summary output format including
status, tokens, tools, and progress metrics.

```console
$ $CLI fill examples/simple/simple.form.md --mock --mock-source examples/simple/simple-mock-filled.form.md --output /tmp/test-fill-full-summary.form.md
Filling form: [..]
Agent: mock
Turn 1: 0 issues
Form completed in 1 turn(s)
⏰ Fill time: [..]
Form written to: /tmp/test-fill-full-summary.form.md

Fill completed in [..] (0 turns)

Tokens:  0 input / 0 output (mock/mock)
Tools:   0 calls

Progress: 0/21 fields filled (0%)
Session Transcript

Form: [..]
Mode: mock
Version: [..]

Harness Config:
  Max turns: 100
  Max patches/turn: 20
  Max issues/turn: 10

Turns (0):

Expected: ✓ complete
Completed form: [..]
? 0
```
