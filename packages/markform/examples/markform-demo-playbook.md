# Markform End-to-End Example: S&P 500 Company Research

## About This Playbook

### Purpose

This playbook walks an agent through a complete Markform workflow to demonstrate its
features: from a research idea to a validated, filled, exported structured report with
typed JSON/YAML data and a JSON Schema.

### Playbook Format

**If you’re a human:** You can read this to get a sense for how you and agents can use
Markform.

**If you’re an agent:** Follow this playbook step by step.

This playbook works in two ways:

1. **Agent instructions:** Steps an agent can follow start to finish.
2. **User narration:** “Tell the user” blocks keep the user informed at each phase.

Notes:
- An agent must have access to use `markform` as a CLI.
- Commands give output and/or errors.
  For example, every `markform set` command should output `Form updated: <path>`.
- An agent or the user can review the result.

### Playbook Scope

**Scenario:** Research an S&P 500 company (default: Apple Inc.). The user provides a
company name; the agent designs a form from scratch, fills it with researched data,
validates, and exports.

This playbook has the agent *manually* fill each field the granular `next` → `set` loop,
researching data along the way.
This exercises all CLI operations and `set` capabilities.

Markform also supports fully automated filling via `markform fill`, where an LLM drives
the `next` → `set` loop autonomously.
That’s out of scope here — this playbook is about the agent researching and filling each
field itself. Run `markform examples` to see automated filling in action.

## Phase 0: Prerequisites

Before proceeding, confirm you have what’s needed:

1. **Shell access** to run `npm` and `markform` CLI commands
2. **Web search** or other research tools to look up company data
3. **File read/write** access to create and edit form files in `/tmp/markform-qa/`

If anything is missing, tell the user what’s needed before continuing.

### Choose the Company

If the user has already specified a company, skip to Phase 1.

Otherwise:

> **Tell the user:** "I have a playbook that walks through Markform, a CLI for
> structured, validated forms.
> I’ll design a research form for an S&P 500 company, fill it with real data, validate
> it, and export the results.
> 
> Is there a company you’d like me to research?
> If you aren’t sure, I’ll just pick Apple (AAPL) as an example."

Wait for the user’s response.
Use their chosen company (default: Apple Inc.).

## Phase 1: Install Markform

> **Tell the user:** “I’ll install (or update) Markform: a CLI for structured, validated
> forms that agents fill via tool calls.”

```bash
npm install -g markform@latest
markform --version
```

> **Tell the user:** “Markform [version] is installed.”

## Phase 2: Define the Research Scope

> **Tell the user:** “We’ll build a structured research form for an S&P 500 company.
> Unlike free-form notes, a form ensures revenue is a number, the ticker matches a
> pattern, segments are a typed table, and URLs are validated: all enforced
> automatically. Let me outline what to capture.”

Draft a plain markdown outline of research questions covering at least these areas:

1. **Identification:** Company name, ticker, GICS sector, headquarters, founding year,
   website
2. **Financials:** Fiscal year, revenue, net income, market cap, employee count
3. **Business segments:** Revenue breakdown by segment with percentages
4. **Leadership:** Key executives with name, title, year appointed
5. **Competitive position:** Competitors, competitive moats, market position summary
6. **Sources & verification:** Source URLs, research date, verification checklist, notes
7. **Source provenance:** A comprehensive table of all sources consulted during
   research, with four columns: source name, what information it was used for, notes on
   source quality or reliability, and URL. This turns the form into a verifiable audit
   trail — every fact is traceable back to its origin.

Save as `/tmp/markform-qa/research-outline.md`.

> **Tell the user:** "I’ve saved the research outline to
> `/tmp/markform-qa/research-outline.md`. Next I’ll convert it into a Markform: a
> structured form with typed, validated fields."

## Phase 3: Build the Markform

### Step 3.1: Learn the Syntax

> **Tell the user:** “I’ll read the Markform reference to learn how to turn this outline
> into a validated form.”

```bash
markform docs
```

Read the full output.
It covers file structure, all 11 field kinds, validation rules, CLI commands, and
includes a complete example form.

### Step 3.2: Study an Example

```bash
markform examples --name simple --forms-dir /tmp/markform-qa/ref
```

Read the example form to see how field kinds, groups, and validation look in practice.

> **Tip:** Run `markform examples --list` to see all bundled examples.
> You can copy any example with `markform examples --name <id>` for additional
> reference.

### Step 3.3: Convert to Markform

> **Tell the user:** “I’ll convert the outline into a Markform using the field kinds and
> validation rules described in the docs.”

Convert the research outline into `/tmp/markform-qa/sp500-research.form.md`. Use the
“Form Design Guide” and “Best Practices” sections from `markform docs` as reference for
choosing field kinds, adding validation, and structuring the form.

The last field in the form should be a source provenance table — a comprehensive list of
sources with four columns: source name, information used, notes on quality, and URL. Use
a `url`-typed column for the URL so it gets validated.
This table is `required` — no research report is complete without attribution.

### Step 3.4: Validate and Fix

> **Tell the user:** “I’ll validate the form structure and fix any issues.”

```bash
markform validate /tmp/markform-qa/sp500-research.form.md
```

If issues appear beyond `required_missing` (expected: the form is empty), fix the
`.form.md` and re-validate.
Repeat until clean.

```bash
markform inspect /tmp/markform-qa/sp500-research.form.md
```

> **Tell the user:** “Form structure is valid: [N] fields across [N] groups, ready to
> fill.”

## Phase 4: Fill the Form

The core workflow: run `next` to see what to fill, use `set` to fill it, repeat.

### Step 4.1: Set the User Input

> **Tell the user:** "The company name field has `role='user'`: it’s the one
> human-provided input.
> I’ll set it to start the research."

```bash
markform set /tmp/markform-qa/sp500-research.form.md <company_name_id> "Apple Inc."
markform status /tmp/markform-qa/sp500-research.form.md
```

### Step 4.2: The next → set Loop

> **Tell the user:** "`next` is the field advisor: it prioritizes what to fill and shows
> `set` examples. I’ll follow its advice, research the data, and repeat."

```bash
markform next /tmp/markform-qa/sp500-research.form.md
```

Research accurate data and fill fields using `set`. Continue the `next` → `set` loop
until the form is complete.

As you fill each group of fields, also populate the source provenance table: append a
row for each source you consulted, recording what information it provided and its URL.
This ensures every fact in the form is traceable.

**Use each of these operations at least once during filling to show the full range of
`set` capabilities:**

| Operation | Example |
| --- | --- |
| Single set | `markform set <file> <id> "value"` |
| Batch set | `markform set <file> --values '{"a": 1, "b": "text"}'` |
| Table append | `markform set <file> <tableId> --append '{"col": "val"}'` |
| Table batch set | `markform set <file> <tableId> '[{...}, {...}]'` |
| Table delete + re-append | `--delete <index>` then `--append` replacement |
| Validation error | Set an invalid value (e.g., lowercase ticker): verify rejection |
| String list | `markform set <file> <id> '["a", "b", "c"]'` |
| Multi-select | `markform set <file> <id> '["opt1", "opt2"]'` |
| Explicit checkboxes | `markform set <file> <id> '{"item1": "yes", "item2": "no"}'` |
| Skip optional field | `markform set <file> <id> --skip --reason "..."` |

> **Tell the user:** After the validation error: “Rejected: validation catches errors
> before they enter the form.
> The original value is untouched.”

### Step 4.3: Confirm Completion

```bash
markform next /tmp/markform-qa/sp500-research.form.md
```

**Checkpoint:** Should report form complete, 0 required fields remaining.

## Phase 5: Validate and Export

> **Tell the user:** “Form is complete.
> Let me validate and export.”

```bash
markform validate /tmp/markform-qa/sp500-research.form.md
```

**Checkpoint:** Form State `complete`, `invalid=0`, no issues.

```bash
markform dump /tmp/markform-qa/sp500-research.form.md
markform export /tmp/markform-qa/sp500-research.form.md --format=markdown
markform report /tmp/markform-qa/sp500-research.form.md
markform export /tmp/markform-qa/sp500-research.form.md --format=json
markform export /tmp/markform-qa/sp500-research.form.md --format=yaml
markform schema /tmp/markform-qa/sp500-research.form.md --pure
```

> **Tell the user:** "Exported as:
> - **Markdown (export):** full rendered form including field instructions — useful as a
>   standalone document or for review
> - **Markdown (report):** clean results only, no instructions — useful as a deliverable
> - **JSON/YAML:** typed structured data for databases or APIs
> - **JSON Schema:** form structure for code generation or external validation
> 
> Every fact in the report is traceable: the source provenance table records where each
> piece of information came from, with validated URLs.
> The form doesn’t just add structure — it adds reliability."

## Phase 6: Advanced Operations

### Step 6.1: Clear and Re-fill

> **Tell the user:** “Any field can be cleared and re-filled for corrections.”

Clear a number field, verify it shows as unanswered, then set a new value.

### Step 6.2: List Append and Delete

> **Tell the user:** “Lists support incremental append and delete without replacing the
> whole list.”

Append a URL to the source list, then delete an entry by index.

### Step 6.3: Set with --report

> **Tell the user:** "`--report` returns JSON with apply status, form state, progress,
> and remaining issues after each change."

```bash
markform set /tmp/markform-qa/sp500-research.form.md <url_list_id> --append "https://example.com" --report --format json
```

### Step 6.4: Confirm Still Complete

```bash
markform next /tmp/markform-qa/sp500-research.form.md
```

**Expected:** Form is complete.

## Phase 7: Review the Source

> **Tell the user:** "The filled `.form.md` is both human-readable and
> machine-parseable. On GitHub, comment tags are invisible: it looks like a clean
> document. But every value is typed, validated, and programmatically accessible."

```bash
cat /tmp/markform-qa/sp500-research.form.md
```

## Phase 8: Present the Report

> **Tell the user:** “Here’s the completed research report.”

Generate the report and render it directly in the chat as formatted markdown:

```bash
markform report /tmp/markform-qa/sp500-research.form.md
```

Output the full markdown content to the chat window so the user sees a nicely formatted
report — headings, tables, lists — with instructions and internal markup stripped away.

Also export the structured data as YAML:

```bash
markform export /tmp/markform-qa/sp500-research.form.md --format=yaml > /tmp/markform-qa/sp500-research.yml
```

> **Tell the user:** "The structured data is also saved as YAML at
> `/tmp/markform-qa/sp500-research.yml` — ready to feed into databases, APIs, or other
> tools."

Then open the form in a web browser:

```bash
markform serve /tmp/markform-qa/sp500-research.form.md
```

> **Tell the user:** "I’ve also opened the report in your web browser.
> You can browse it in several tabs:
> - **View:** the rendered form as it appears on GitHub
> - **Edit:** an interactive version where fields can be filled in the browser
> - **Source:** the raw `.form.md` with all Markform tags visible
> - **Report:** a filtered view that strips instructions and internal markup
> - **Values:** exported field values as YAML
> - **Schema:** the JSON Schema describing the form structure"
