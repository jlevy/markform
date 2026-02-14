---
cwd: ../..
env:
  NO_COLOR: "1"
  FORCE_COLOR: "0"
  CLI: ./dist/bin.mjs
  FORM: /tmp/golden-session-form.form.md
timeout: 30000
---

# Golden Session: Multi-Turn CLI Form Filling

Demonstrates a complete `next` → `set` → `next` → `set` loop using the CLI.
The test fills the simple form across multiple turns, showing internal state
at each step, progressing from empty → incomplete → complete.

---

## Turn 0: Initialize — copy form and inspect initial state

# Test: copy form to working file

```console
$ cp examples/simple/simple.form.md $FORM && echo "OK"
OK
? 0
```

# Test: initial state is empty with 21 fields

```console
$ $CLI next --format json $FORM | grep -E '"(is_complete|form_state|total_fields|filled_fields|empty_required_fields)"'
  "is_complete": false,
  "form_state": "empty",
    "total_fields": 21,
    "filled_fields": 0,
    "empty_required_fields": 12
? 0
```

# Test: initial next shows 10 issues (default cap)

```console
$ $CLI next --format json $FORM | grep '"ref":' | wc -l
10
? 0
```

---

## Turn 1: Fill string/number fields (name, email, age)

# Test: set name, email, age via batch

```console
$ $CLI set $FORM --values '{"name":"Alice Johnson","email":"alice@example.com","age":"28"}' 2>&1
Form updated: /tmp/golden-session-form.form.md
? 0
```

# Test: dump shows filled fields after turn 1

```console
$ $CLI dump $FORM | head -3
name: "Alice Johnson"
email: "alice@example.com"
age: 28
? 0
```

# Test: progress after turn 1 — 3 filled

```console
$ $CLI next --format json $FORM | grep -E '"(form_state|filled_fields|empty_required_fields)"'
  "form_state": "incomplete",
    "filled_fields": 3,
    "empty_required_fields": 9
? 0
```

---

## Turn 2: Fill select/checkbox fields (priority, categories, tasks)

# Test: set priority (single_select)

```console
$ $CLI set $FORM priority high 2>&1
Form updated: /tmp/golden-session-form.form.md
? 0
```

# Test: set categories (multi_select)

```console
$ $CLI set $FORM categories '["frontend","backend"]' 2>&1
Form updated: /tmp/golden-session-form.form.md
? 0
```

# Test: set tasks_simple (checkboxes - simple mode)

```console
$ $CLI set $FORM tasks_simple '{"read_guidelines":true,"agree_terms":true}' 2>&1
Form updated: /tmp/golden-session-form.form.md
? 0
```

# Test: set tasks_multi (checkboxes - multi mode)

```console
$ $CLI set $FORM tasks_multi '{"research":"done","design":"done","implement":"done","test":"done"}' 2>&1
Form updated: /tmp/golden-session-form.form.md
? 0
```

# Test: set confirmations (checkboxes - explicit mode)

```console
$ $CLI set $FORM confirmations '{"backed_up":"yes","notified":"yes"}' 2>&1
Form updated: /tmp/golden-session-form.form.md
? 0
```

# Test: progress after turn 2 — 8 filled

```console
$ $CLI next --format json $FORM | grep -E '"(form_state|filled_fields|empty_required_fields)"'
  "form_state": "incomplete",
    "filled_fields": 8,
    "empty_required_fields": 4
? 0
```

---

## Turn 3: Fill remaining required fields (tags, website, dates)

# Test: set tags (string_list)

```console
$ $CLI set $FORM tags '["typescript","markform","cli"]' 2>&1
Form updated: /tmp/golden-session-form.form.md
? 0
```

# Test: set website (url)

```console
$ $CLI set $FORM website "https://markform.dev" 2>&1
Form updated: /tmp/golden-session-form.form.md
? 0
```

# Test: set event_date (date)

```console
$ $CLI set $FORM event_date "2024-06-15" 2>&1
Form updated: /tmp/golden-session-form.form.md
? 0
```

# Test: set founded_year (year)

```console
$ $CLI set $FORM founded_year 2020 2>&1
Form updated: /tmp/golden-session-form.form.md
? 0
```

# Test: all required fields filled — only optional remain

```console
$ $CLI next --format json $FORM | grep -E '"(form_state|filled_fields|empty_required_fields)"'
  "form_state": "complete",
    "filled_fields": 12,
    "empty_required_fields": 0
? 0
```

# Test: remaining issues are all P3 recommended

```console
$ $CLI next --format json $FORM | grep '"severity":' | sort -u
      "severity": "recommended",
? 0
```

---

## Turn 4: Skip optional fields and complete

# Test: skip remaining optional fields

```console
$ $CLI set $FORM score --skip --reason "N/A" 2>&1 && $CLI set $FORM references --skip --reason "N/A" 2>&1 && $CLI set $FORM team_members --skip --reason "N/A" 2>&1 && $CLI set $FORM project_tasks --skip --reason "N/A" 2>&1 && $CLI set $FORM notes --skip --reason "N/A" 2>&1 && $CLI set $FORM optional_number --skip --reason "N/A" 2>&1 && $CLI set $FORM related_url --skip --reason "N/A" 2>&1 && $CLI set $FORM optional_date --skip --reason "N/A" 2>&1 && $CLI set $FORM optional_year --skip --reason "N/A" 2>&1 && echo "ALL_SKIPPED"
Form updated: /tmp/golden-session-form.form.md
Form updated: /tmp/golden-session-form.form.md
Form updated: /tmp/golden-session-form.form.md
Form updated: /tmp/golden-session-form.form.md
Form updated: /tmp/golden-session-form.form.md
Form updated: /tmp/golden-session-form.form.md
Form updated: /tmp/golden-session-form.form.md
Form updated: /tmp/golden-session-form.form.md
Form updated: /tmp/golden-session-form.form.md
ALL_SKIPPED
? 0
```

# Test: form is now complete

```console
$ $CLI next --format json $FORM | grep -E '"(is_complete|form_state)"'
  "is_complete": true,
  "form_state": "complete",
? 0
```

# Test: validate confirms completion

```console
$ $CLI validate $FORM 2>&1 | grep "Form State:"
Form State: ✓ complete
? 0
```

---

## Verification: Final form state

# Test: dump shows all values and states

```console
$ $CLI dump $FORM
name: "Alice Johnson"
email: "alice@example.com"
age: 28
score: [skipped] N/A
tags: [typescript, markform, cli]
priority: high
categories: [frontend, backend]
tasks_multi: research:done, design:done, implement:done, test:done
tasks_simple: read_guidelines:done, agree_terms:done
confirmations: backed_up:yes, notified:yes
website: "https://markform.dev"
references: [skipped] N/A
event_date: 2024-06-15
founded_year: 2020
team_members: [skipped] N/A
project_tasks: [skipped] N/A
notes: [skipped] N/A
optional_number: [skipped] N/A
related_url: [skipped] N/A
optional_date: [skipped] N/A
optional_year: [skipped] N/A
? 0
```

# Test: status shows all answered/skipped

```console
$ $CLI status --format json $FORM | grep '"answered":' | head -1
    "answered": 12,
? 0
```

# Test: status shows no unanswered

```console
$ $CLI status --format json $FORM | grep '"unanswered":' | head -1
    "unanswered": 0
? 0
```

---

## Bonus: Append and Delete operations

# Test: append a table row

```console
$ $CLI set $FORM team_members --clear 2>&1 && $CLI set $FORM team_members --append '{"name":"Bob","role":"Developer"}' 2>&1 && echo "OK"
Form updated: /tmp/golden-session-form.form.md
Form updated: /tmp/golden-session-form.form.md
OK
? 0
```

# Test: append a second row and then delete the first

```console
$ $CLI set $FORM team_members --append '{"name":"Carol","role":"Designer"}' 2>&1 && $CLI set $FORM team_members --delete 0 2>&1 && echo "OK"
Form updated: /tmp/golden-session-form.form.md
Form updated: /tmp/golden-session-form.form.md
OK
? 0
```

# Test: append to string_list

```console
$ $CLI set $FORM tags --append "golden-test" 2>&1 && $CLI dump $FORM | grep "^tags:"
Form updated: /tmp/golden-session-form.form.md
tags: [typescript, markform, cli, golden-test]
? 0
```

# Test: delete from string_list

```console
$ $CLI set $FORM tags --delete 3 2>&1 && $CLI dump $FORM | grep "^tags:"
Form updated: /tmp/golden-session-form.form.md
tags: [typescript, markform, cli]
? 0
```

---

## Bonus: Report and inspect

# Test: set --report shows JSON report

```console
$ $CLI set $FORM name "Alice Updated" --report --format json | grep '"apply_status":'
  "apply_status": "applied",
? 0
```

# Test: inspect shows complete structure

```console
$ $CLI inspect --format json $FORM | grep '"field_count":'
    "field_count": 21,
? 0
```
