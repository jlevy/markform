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

# Test: initial next shows field advisor output (console format)

```console
$ $CLI next $FORM
State: empty (0/21 fields filled, 12 required remaining)

Next fields to fill (10 issues, budget: 10):

  P1 [required] age (number)
     Required field "Age" is empty
     -> markform set /tmp/golden-session-form.form.md age 42

  P1 [required] categories (multi_select) [frontend, backend, database, devops]
     Required field "Categories" has no selections
     -> markform set /tmp/golden-session-form.form.md categories '["frontend", "backend", "database", "devops"]'

  P1 [required] confirmations (checkboxes) [backed_up, notified]
     All items in "Confirmations (Explicit Mode)" must be answered (2 unfilled)
     -> markform set /tmp/golden-session-form.form.md confirmations '{"backed_up":"done","notified":"done"}'

  P1 [required] email (string)
     Required field "Email" is empty
     -> markform set /tmp/golden-session-form.form.md email "example text"

  P1 [required] event_date (date)
     Required field "Event Date" is empty
     -> markform set /tmp/golden-session-form.form.md event_date "2024-01-15"

  P1 [required] founded_year (year)
     Required field "Founded Year" is empty
     -> markform set /tmp/golden-session-form.form.md founded_year 2024

  P1 [required] name (string)
     Required field "Name" is empty
     -> markform set /tmp/golden-session-form.form.md name "example text"

  P1 [required] priority (single_select) [low, medium, high]
     Required field "Priority" has no selection
     -> markform set /tmp/golden-session-form.form.md priority low

  P1 [required] tags (string_list)
     Required field "Tags" is empty
     -> markform set /tmp/golden-session-form.form.md tags '["item1", "item2"]'

  P1 [required] tasks_multi (checkboxes) [research, design, implement, test]
     All items in "Tasks (Multi Mode)" must be completed
     -> markform set /tmp/golden-session-form.form.md tasks_multi '{"research":"done","design":"done","implement":"done","test":"done"}'
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

# Test: dump shows full form state after turn 1

```console
$ $CLI dump $FORM
name: "Alice Johnson"
email: "alice@example.com"
age: 28
score: (unanswered)
tags: (unanswered)
priority: (unanswered)
categories: (unanswered)
tasks_multi: (unanswered)
tasks_simple: (unanswered)
confirmations: (unanswered)
website: (unanswered)
references: (unanswered)
event_date: (unanswered)
founded_year: (unanswered)
team_members: (unanswered)
project_tasks: (unanswered)
notes: (unanswered)
optional_number: (unanswered)
related_url: (unanswered)
optional_date: (unanswered)
optional_year: (unanswered)
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

# Test: all required fields filled — next shows optional fields with skip examples

```console
$ $CLI next $FORM
State: complete (12/21 fields filled, 0 required remaining)

Next fields to fill (9 issues, budget: 9):

  P3 [recommended] notes (string)
     Optional field not yet addressed
     -> markform set /tmp/golden-session-form.form.md notes "example text"
     -> markform set /tmp/golden-session-form.form.md notes --skip --reason "Not applicable"

  P3 [recommended] optional_date (date)
     Optional field not yet addressed
     -> markform set /tmp/golden-session-form.form.md optional_date "2024-01-15"
     -> markform set /tmp/golden-session-form.form.md optional_date --skip --reason "Not applicable"

  P3 [recommended] optional_number (number)
     Optional field not yet addressed
     -> markform set /tmp/golden-session-form.form.md optional_number 42
     -> markform set /tmp/golden-session-form.form.md optional_number --skip --reason "Not applicable"

  P3 [recommended] optional_year (year)
     Optional field not yet addressed
     -> markform set /tmp/golden-session-form.form.md optional_year 2024
     -> markform set /tmp/golden-session-form.form.md optional_year --skip --reason "Not applicable"

  P3 [recommended] project_tasks (table)
     Optional field not yet addressed
     -> markform set /tmp/golden-session-form.form.md project_tasks --append '{"task":"example_string","estimate_hrs":"example_number","link":"example_url"}'
     -> markform set /tmp/golden-session-form.form.md project_tasks --skip --reason "Not applicable"

  P3 [recommended] references (url_list)
     Optional field not yet addressed
     -> markform set /tmp/golden-session-form.form.md references '["https://example.com"]'
     -> markform set /tmp/golden-session-form.form.md references --skip --reason "Not applicable"

  P3 [recommended] related_url (url)
     Optional field not yet addressed
     -> markform set /tmp/golden-session-form.form.md related_url "https://example.com"
     -> markform set /tmp/golden-session-form.form.md related_url --skip --reason "Not applicable"

  P3 [recommended] score (number)
     Optional field not yet addressed
     -> markform set /tmp/golden-session-form.form.md score 42
     -> markform set /tmp/golden-session-form.form.md score --skip --reason "Not applicable"

  P3 [recommended] team_members (table)
     Optional field not yet addressed
     -> markform set /tmp/golden-session-form.form.md team_members --append '{"name":"example_string","role":"example_string","start_date":"example_date"}'
     -> markform set /tmp/golden-session-form.form.md team_members --skip --reason "Not applicable"
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

# Test: form is now fully complete (all skipped/filled)

```console
$ $CLI next $FORM
State: complete (12/21 fields filled, 0 required remaining)

Form is complete!
? 0
```

# Test: validate confirms completion

```console
$ $CLI validate $FORM 2>&1
Form Validation Report
Title: Simple Test Form

Form State: ✓ complete

Structure:
  Groups: 8
  Fields: 21
  Options: 15

Progress:
  Total fields: 21
  Required: 12
  AnswerState: answered=12, skipped=9, aborted=0, unanswered=0
  Validity: valid=21, invalid=0
  Value: filled=12, empty=9
  Empty required: 0

No issues found.
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
$ $CLI status --format json $FORM
{
  "path": "/tmp/golden-session-form.form.md",
  "run_mode": "interactive",
  "run_mode_source": "explicit",
  "overall": {
    "total": 21,
    "answered": 12,
    "skipped": 9,
    "aborted": 0,
    "unanswered": 0
  },
  "by_role": {
    "user": {
      "total": 21,
      "answered": 12,
      "skipped": 9,
      "aborted": 0,
      "unanswered": 0
    }
  },
  "suggested_command": "markform run golden-session-form.form.md"
}
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
