# Markform End-to-End QA Playbook

## Purpose

This is an internal QA script for the Markform project.
It runs the demo playbook end-to-end as an automated test, then verifies all features
were exercised correctly and reports any issues found.

**This file is internal to the Markform project and is not included in the
distribution.** The user-facing playbook is
[markform-demo-playbook.md](../../examples/markform-demo-playbook.md).

## How to Run

1. Read the demo playbook at `examples/markform-demo-playbook.md` (in the package’s
   examples directory).
2. Execute it end-to-end using **Apple Inc.
   (AAPL)** as the company.
3. Do not ask the user for confirmations — proceed through all phases automatically.
4. After the demo playbook is complete, return here and continue with the QA
   verification below.

## QA Verification

After completing all phases of the demo playbook, verify the following.

### Serve Verification

**QA checkpoint:** Verify the server started and all tabs are accessible.

Start the server (with `--no-open` to skip the browser) and programmatically verify each
tab returns content:

```bash
markform serve /tmp/markform-qa/sp500-research.form.md --no-open --port 3456 &
sleep 1

# Verify each tab endpoint returns content (HTTP 200, non-empty body)
for tab in view report source values schema; do
  curl -sf http://localhost:3456/tab/$tab | head -c 100
  echo "  ← /tab/$tab OK"
done

# Verify the main page loads with tab bar
curl -sf http://localhost:3456/ | grep -q 'tab-bar' && echo "Main page: tab bar present"

# Verify hash routes are supported (page contains hashchange listener)
curl -sf http://localhost:3456/ | grep -q 'hashchange' && echo "Hash routes: supported"

kill %1 2>/dev/null
```

Each tab should return valid HTML content.
If any tab fails, it indicates missing data or a server error.

### QA Checklist

- [ ] `markform validate` → complete, no issues, `invalid=0`
- [ ] `markform dump` → all fields show values or `[skipped]`
- [ ] `markform export --format=json` → valid JSON, correct types
- [ ] `markform export --format=markdown` → full rendered form with instructions
- [ ] `markform report` → clean results only, no instructions
- [ ] `markform schema --pure` → valid JSON Schema
- [ ] `markform serve` → web UI accessible with tabs: Form, Report, Edit, Source,
  Values, Schema
- [ ] All 11 field kinds used in form design
- [ ] Validation error: `set` stored the value, `validate` shows `invalid=1`, fix
  restored `invalid=0`
- [ ] Clear + re-fill worked
- [ ] Append/delete on lists worked
- [ ] Explicit checkboxes show yes/no
- [ ] `next` → form is complete
- [ ] Markdown report rendered in chat as formatted output
- [ ] `markform serve` → opens in browser
- [ ] Serve: all tab endpoints (`/tab/view`, `/tab/report`, etc.)
  return HTTP 200
- [ ] Serve: hash routes work (URL updates on tab click)
- [ ] Source provenance table populated with at least one entry per research group

## Features Exercised

| Feature | Where |
| --- | --- |
| `docs` | Phase 3 |
| `examples` | Phase 3 |
| `validate` | Phase 3, 5 |
| `inspect` | Phase 3 |
| `next` | Phase 4 |
| `status` | Phase 4 |
| `set`: single | Phase 4 |
| `set`: batch `--values` | Phase 4 |
| `set`: `--append` (table) | Phase 4 |
| `set`: `--delete` (table) | Phase 4 |
| `set`: `--append` (list) | Phase 6 |
| `set`: `--delete` (list) | Phase 6 |
| `set`: `--clear` | Phase 6 |
| `set`: `--skip` | Phase 4 |
| `set`: `--report` | Phase 6 |
| `set`: validation error | Phase 4 |
| `dump` | Phase 5 |
| `export`: markdown | Phase 5 |
| `report` | Phase 8 |
| `export`: json | Phase 5 |
| `export`: yaml | Phase 5, 8 |
| `schema --pure` | Phase 5 |
| `serve` | Phase 8 |
| All 11 field kinds | Phase 3 |
| Source provenance table | Phase 3, 4 |

## Post-Run Review

After completing the playbook, review the run and document any issues found.
This feedback is valuable for improving both Markform and this playbook.

> **Tell the user:** “The playbook is complete.
> Before wrapping up, let me review how it went.”

Write a brief summary covering:

1. **Markform bugs or issues:** Any CLI errors, unexpected behavior, validation edge
   cases, confusing output, or missing features encountered during the run.
   Include the exact command and error message if applicable.

2. **Playbook issues:** Any steps that were unclear, out of order, missing context, or
   that didn’t work as described.
   Note if any instructions needed interpretation or if the form design guidance was
   insufficient.

3. **Suggestions:** Ideas for improving either Markform or this playbook based on the
   experience.

If no issues were found, say so — a clean run is useful signal too.

Save the review to `/tmp/markform-qa/run-review.md`.

### File Issues

If any bugs or issues were discovered, file them as tracked issues.
Create a single parent bead for the QA run, then create child beads for each individual
issue:

```bash
tbd create "QA playbook run: <company name> — issues found" --type=task
tbd create "<brief description of issue 1>" --type=bug
tbd dep add <child_id> <parent_id>
# Repeat for each issue
```

> **Tell the user:** "I’ve filed [N] issues from this run under a parent tracking bead.
> Here’s a summary: [list the issues briefly]. You can review them with `tbd list`."

If no issues were found, skip issue creation and tell the user the run was clean.
