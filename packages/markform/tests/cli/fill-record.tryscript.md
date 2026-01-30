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
Uses mock mode with `--roles "*"` to exercise the full fill pipeline.

---

## Summary Output

# Test: fill shows summary by default

```console
$ $CLI fill examples/simple/simple.form.md --mock --mock-source examples/simple/simple-mock-filled.form.md --roles "*" --output /tmp/test-fill-summary.form.md 2>&1 | grep -E "Fill (completed|partial)"
Fill completed in ...
? 0
```

# Test: fill --quiet suppresses summary

```console
$ $CLI fill examples/simple/simple.form.md --mock --mock-source examples/simple/simple-mock-filled.form.md --roles "*" --output /tmp/test-fill-quiet.form.md --quiet 2>&1 | grep "Fill completed" | wc -l
0
? 0
```

# Test: fill --record-fill creates sidecar file

```console
$ $CLI fill examples/simple/simple.form.md --mock --mock-source examples/simple/simple-mock-filled.form.md --roles "*" --output /tmp/test-fill-record.form.md --record-fill 2>&1 | grep "Fill record written"
Fill record written to: /tmp/test-fill-record.fill.json
? 0
```

---

## Full Output Structure

# Test: fill summary shows complete format with multiple turns

This test exercises the full fill pipeline with a non-trivial form, showing
multiple turns of patches being applied.

```console
$ $CLI fill examples/simple/simple.form.md --mock --mock-source examples/simple/simple-mock-filled.form.md --roles "*" --output /tmp/test-fill-full.form.md --record-fill
⚠️  Warning: Filling all roles including user-designated fields
Filling form: [..]
Agent: mock
Turn 1: 10 issue(s): age (missing), categories (missing), confirmations (missing), email (missing), event_date (missing), +5 more
  → 10 patches:
    age (number) = 32
    categories (multi_select) = [frontend, backend]
    confirmations (checkboxes) = backed_up:yes, notified:no
    email (string) = "alice@example.com"
    event_date (date) = "2025-06-15"
    founded_year (year) = 2020
    name (string) = "Alice Johnson"
    priority (select) = medium
    tags (string_list) = [typescript, testing, forms]
    tasks_multi (checkboxes) = research:done, design:done, implement:done, test:na
Turn 2: 10 issue(s): tasks_simple (missing), website (missing), notes (unanswered), optional_date (unanswered), optional_number (unanswered), +5 more
  → 10 patches:
    tasks_simple (checkboxes) = read_guidelines:done, agree_terms:done
    website (url) = "https://alice.dev"
    notes (string) = "This is a test note."
    optional_date (skip) = (skipped: No value in mock form)
    optional_number (skip) = (skipped: No value in mock form)
    optional_year (skip) = (skipped: No value in mock form)
    project_tasks (skip) = (skipped: No value in mock form)
    references (url_list) = [https://docs.example.com/guide, https://github.com/example/project, https://medium.com/article-about-forms]
    related_url (url) = "https://markform.dev/docs"
    score (number) = 87.5
Turn 3: 1 issue(s): team_members (unanswered)
  → 1 patches:
    team_members (table) = [2 rows]
  ✓ Complete
Form completed in 3 turn(s)
⏰ Fill time: [..]
Form written to: /tmp/test-fill-full.form.md

Fill completed in [..] (0 turns)

Tokens:  0 input / 0 output (mock/mock)
Tools:   0 calls

Progress: 17/21 fields filled (81%)
Fill record written to: /tmp/test-fill-full.fill.json
Session Transcript

Form: [..]
Mode: mock
Version: [..]

Harness Config:
  Max turns: 100
  Max patches/turn: 20
  Max issues/turn: 10

Turns (3):
  Turn 1: 10 issues → 10 patches → 2 remaining
  Turn 2: 10 issues → 10 patches → 0 remaining
  Turn 3: 1 issues → 1 patches → 0 remaining

Expected: ✓ complete
Completed form: [..]
? 0
```

---

## FillRecord JSON Sidecar Verification

# Test: --record-fill-stable creates deterministic sidecar

The `--record-fill-stable` flag outputs a FillRecord with all unstable fields
(timestamps, durations, sessionId, timeline) stripped for golden test comparisons.

```console
$ $CLI fill examples/simple/simple.form.md --mock --mock-source examples/simple/simple-mock-filled.form.md --roles "*" --output /tmp/test-fill-stable.form.md --record-fill-stable 2>&1 | grep "Fill record written"
Fill record written to: /tmp/test-fill-stable.fill.json
? 0
```

# Test: Stable FillRecord JSON has complete deterministic structure

This test verifies the stable FillRecord structure (without timing/timestamp fields).
Uses jq to show key fields and structure counts - the full JSON includes detailed
field/group/option/column maps that would make the test fragile.

```console
$ cat /tmp/test-fill-stable.fill.json | jq '{status, form: {id: .form.id, title: .form.title, structure: {fieldCount: .form.structure.fieldCount, groupCount: .form.structure.groupCount, optionCount: .form.structure.optionCount, columnCount: .form.structure.columnCount}}, formProgress: {totalFields: .formProgress.totalFields, filledFields: .formProgress.filledFields, skippedFields: .formProgress.skippedFields}, llm, toolSummary, execution}'
{
  "status": "completed",
  "form": {
    "id": "simple_test",
    "title": "Simple Test Form",
    "structure": {
      "fieldCount": 21,
      "groupCount": 8,
      "optionCount": 15,
      "columnCount": 6
    }
  },
  "formProgress": {
    "totalFields": 21,
    "filledFields": 17,
    "skippedFields": 4
  },
  "llm": {
    "provider": "mock",
    "model": "mock",
    "totalCalls": 0,
    "inputTokens": 0,
    "outputTokens": 0
  },
  "toolSummary": {
    "totalCalls": 0,
    "successfulCalls": 0,
    "failedCalls": 0,
    "successRate": 0,
    "byTool": []
  },
  "execution": {
    "totalTurns": 0,
    "parallelEnabled": false,
    "orderLevels": [],
    "executionThreads": []
  }
}
? 0
```

# Test: Stable FillRecord has no unstable fields

Verify that sessionId, timestamps, durations, timeline, and timingBreakdown are stripped.

```console
$ cat /tmp/test-fill-stable.fill.json | jq 'keys'
[
  "execution",
  "form",
  "formProgress",
  "llm",
  "status",
  "toolSummary"
]
? 0
```

---

## Output Form Verification

# Test: Output form exists and is valid

```console
$ $CLI validate /tmp/test-fill-full.form.md --format json | jq '{issues: (.issues | length), title}'
{
  "issues": 0,
  "title": "Simple Test Form"
}
? 0
```

# Test: Output form has filled fields

```console
$ $CLI status /tmp/test-fill-full.form.md --format json | jq '.overall | {total, answered, skipped}'
{
  "total": 21,
  "answered": 17,
  "skipped": 4
}
? 0
```
