---
cwd: ../..
env:
  NO_COLOR: "1"
  FORCE_COLOR: "0"
  CLI: ./dist/bin.mjs
timeout: 30000
---

# Markform CLI Logging Tests

Tests for CLI logging at different verbosity levels, trace file output, and debug mode.

---

## Setup

# Test: setup creates test forms

```console
$ cp examples/startup-research/startup-research.form.md /tmp/logging-test.form.md && echo "Form copied"
Form copied
? 0
```

---

## Default Logging Level

# Test: fill with mock shows turn and patch info

```console
$ $CLI fill /tmp/logging-test.form.md --mock --mock-source examples/startup-research/startup-research-mock-filled.form.md --max-turns 1 -o /tmp/logging-out.form.md 2>&1 | grep -E "(Turn|patches|Filling|Agent:)" | head -4
Filling form: /tmp/logging-test.form.md
Agent: mock
Turn 1: 10 issue(s): company_website (missing), company_description (unanswered), competitors (unanswered), crunchbase_url (unanswered), employee_count (unanswered), +5 more
  → 9 patches:
? 0
```

---

## Verbose Mode Shows Config

# Test: fill with --verbose shows config details

```console
$ $CLI fill /tmp/logging-test.form.md --mock --mock-source examples/startup-research/startup-research-mock-filled.form.md --max-turns 1 -o /tmp/logging-verbose.form.md --verbose 2>&1 | grep -E "Max turns|Max patches|Target roles" | head -3
Max turns: 100
Max patches per turn: 20
...
? 0
```

---

## Quiet Mode

# Test: fill with --quiet suppresses turn info

```console
$ $CLI fill /tmp/logging-test.form.md --mock --mock-source examples/startup-research/startup-research-mock-filled.form.md --max-turns 1 -o /tmp/logging-quiet.form.md --quiet 2>&1 | grep -c "Turn 1"
12
? 0
```

---

## Trace File Output

# Test: fill with --trace creates trace file

```console
$ rm -f /tmp/test-trace.log && $CLI fill /tmp/logging-test.form.md --mock --mock-source examples/startup-research/startup-research-mock-filled.form.md --max-turns 1 -o /tmp/logging-trace.form.md --trace /tmp/test-trace.log 2>&1 > /dev/null ; test -f /tmp/test-trace.log && echo "trace file created"
trace file created
? 0
```

# Test: trace file has header with timestamp

```console
$ head -2 /tmp/test-trace.log
# Markform Trace Log
# Started: ...
? 0
```

# Test: trace file contains filling info

```console
$ grep -c "Filling form" /tmp/test-trace.log
1
? 0
```

---

## Output File Verification

# Test: output form is created

```console
$ test -f /tmp/logging-out.form.md && echo "output file exists"
output file exists
? 0
```

---

## User Role Fill with Simple Form

# Test: fill user role fields shows patches

```console
$ cp examples/simple/simple.form.md /tmp/simple-test.form.md && $CLI fill /tmp/simple-test.form.md --mock --mock-source examples/simple/simple-mock-filled.form.md --max-turns 1 --roles user -o /tmp/simple-out.form.md 2>&1 | grep -E "(Turn|patch)" | head -2
Turn 1: 10 issue(s): age (missing), categories (missing), confirmations (missing), email (missing), event_date (missing), +5 more
  → 10 patches:
? 0
```

# Test: user role fill produces filled output with values

```console
$ grep "Alice Johnson" /tmp/simple-out.form.md | head -1
Alice Johnson
? 0
```

---

## Cleanup

# Test: cleanup temp files

```console
$ rm -f /tmp/logging-test.form.md /tmp/logging-out.form.md /tmp/logging-quiet.form.md /tmp/logging-verbose.form.md /tmp/logging-trace.form.md /tmp/test-trace.log /tmp/simple-test.form.md /tmp/simple-out.form.md && echo "Cleaned up"
Cleaned up
? 0
```
