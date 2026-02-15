# Markform End-to-End QA Playbook

## Purpose

This is an internal QA script for the Markform project.
It runs the demo playbook end-to-end as an automated test, then verifies all features
were exercised correctly and reports any issues found.

**This file is internal to the Markform project and is not included in the
distribution.** The user-facing playbook is
[markform-demo-playbook.md](../../examples/markform-demo-playbook.md).

## How to Run

1. Read the demo playbook at `examples/markform-demo-playbook.md` (in the package's
   examples directory).
2. Execute it end-to-end using **Apple Inc.
   (AAPL)** as the company, with the **step-by-step** filling approach.
3. Do not ask the user for confirmations — proceed through all phases automatically.
4. After the demo playbook is complete, return here and continue with the QA
   verification below.

## QA Verification

After completing all phases of the demo playbook, verify the following.

### Serve Verification

**QA checkpoint:** Verify the server started and the URL is accessible.
Review at least the View, Source, and Values tabs.
If automated filling was used, verify the Fill Record tab is visible and shows execution
data.

Stop the server when done (Ctrl+C).

### QA Checklist

- [ ] `markform validate` → complete, no issues, `invalid=0`
- [ ] `markform dump` → all fields show values or `[skipped]`
- [ ] `markform export --format=json` → valid JSON, correct types
- [ ] `markform export --format=markdown` → full rendered form with instructions
- [ ] `markform report` → clean results only, no instructions
- [ ] `markform schema --pure` → valid JSON Schema
- [ ] `markform serve` → web UI accessible with multiple tabs
- [ ] All 11 field kinds used in form design
- [ ] Validation error rejected, original value preserved
- [ ] Clear + re-fill worked
- [ ] Append/delete on lists worked
- [ ] Explicit checkboxes show yes/no
- [ ] `next` → form is complete
- [ ] Markdown report rendered in chat as formatted output
- [ ] `markform serve` → opens in browser
- [ ] Source provenance table populated with at least one entry per research group
- [ ] *(Automated flow)* `markform fill --model` → completes without errors
- [ ] *(Automated flow)* `.fill.json` sidecar created by `--record-fill`
- [ ] *(Automated flow)* Fill Record tab visible in `markform serve`

## Features Exercised

| Feature | Where |
| --- | --- |
| `docs` | Phase 3 |
| `examples` | Phase 3 |
| `validate` | Phase 3, 6 |
| `inspect` | Phase 3 |
| `models` | Phase 0 |
| `next` | Phase 4, 5 |
| `status` | Phase 4, 5 |
| `set`: single | Phase 4 |
| `set`: batch `--values` | Phase 4 |
| `set`: `--append` (table) | Phase 4 |
| `set`: `--delete` (table) | Phase 4 |
| `set`: `--append` (list) | Phase 7 |
| `set`: `--delete` (list) | Phase 7 |
| `set`: `--clear` | Phase 7 |
| `set`: `--skip` | Phase 4 |
| `set`: `--report` | Phase 7 |
| `set`: validation error | Phase 4 |
| `fill --model` | Phase 5 |
| `fill --record-fill` | Phase 5 |
| `dump` | Phase 6 |
| `export`: markdown | Phase 6 |
| `report` | Phase 9 |
| `export`: json | Phase 6 |
| `export`: yaml | Phase 6, 9 |
| `schema --pure` | Phase 6 |
| `serve` | Phase 9 |
| Fill Record in `serve` | Phase 9 |
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
