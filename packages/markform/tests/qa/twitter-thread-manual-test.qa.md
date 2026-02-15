# Manual End-to-End Test: Twitter Thread Form

> **Purpose**: Validate the multi-stage content transformation workflow.
> This tests the rigorous 7-stage process from raw content to polished Twitter thread.
> 
> **NOT automated** - Run manually to verify end-to-end agent behavior on complex
> workflows.

## Overview

The Twitter Thread form demonstrates **content transformation** — a key use case for
Markform. It enforces quality through structured stages:

1. **Input** — Raw content + context
2. **Cleanup** — Edit into clean prose
3. **Extract Insights** — Identify key ideas (table)
4. **Prioritize** — Rank and assign thread roles (table)
5. **Structure** — Plan tweet positions (table)
6. **Draft** — Write tweets with char counts (table)
7. **Review & Final** — Verify quality, produce output

Each stage produces structured output that feeds the next stage.

The form template is at `examples/twitter-thread/twitter-thread.form.md`.

## Prerequisites

1. **Build the CLI** (or use `pnpm markform` which runs source directly):
   ```bash
   pnpm build
   ```

2. **Set up API keys** in `.env` at the directory where you run the CLI:
   ```bash
   ANTHROPIC_API_KEY=sk-ant-...
   # Or for OpenAI:
   # OPENAI_API_KEY=sk-...
   ```

   The CLI automatically loads `.env` files from the current working directory.
   Loading order (highest priority first): shell env vars > `.env.local` > `.env`.

Note: Output files go to `test-output/` which is gitignored.
Parent directories are created automatically.

## Sample Input Content

Use this sample content for testing.
It’s a rough transcript about Markform’s value proposition:

```text
So the thing about forms is... they're not just about collecting data, right? Like, humans
figured this out centuries ago - you give someone a blank page and they freeze up, but you
give them a form and suddenly they can produce quality output consistently.

Think about it. A surgeon doesn't just "do surgery" - they follow checklists. Pilots don't
just "fly planes" - they use procedures. The form IS the quality control mechanism.

And here's what nobody's talking about: agents have the SAME problem. You tell Claude to
"write a blog post" and you get... something. Maybe good, maybe not. But you give it a
structured form - with specific fields, validation, required outputs - and suddenly you
get consistent, high-quality results.

It's like... forms enforce operational quality for agents just as they do for humans.
That's the key insight. The form isn't just collecting data - it's providing the structure
that enables quality output.

And Markform makes this practical. You define a form in Markdown - which agents can read
and understand - and then agents fill it out step by step. Each field can have validation.
You can require certain outputs. You can enforce structure.

The meta-loop is critical too. The agent fills the form, gets feedback on what's invalid
or missing, and iterates. Just like a human would with a real form. You don't submit a tax
form with missing fields - the system rejects it and tells you what to fix.

This is going to change how we use AI for serious work. Research, analysis, content
creation, code review - any task that needs consistent quality benefits from structured
forms.
```

## Test 1: Complete Fill (Markform Content)

Fill the form end-to-end using the sample content above.
Uses `--roles "*"` to fill all fields (including user-role input fields) and
`--instructions` to provide the sample content.

### Command

```bash
pnpm markform fill examples/twitter-thread/twitter-thread.form.md \
  --model anthropic/claude-sonnet-4-5 \
  --roles "*" \
  --output test-output/twitter-filled.form.md \
  --record-fill \
  --instructions "Use this sample content about structured forms for AI agents: Forms enforce operational quality for agents just as they do for humans. When you give an agent a blank prompt, you get unpredictable output. But with structured forms — with specific fields, validation, required outputs — you get consistent, high-quality results every time. The form provides the scaffolding for quality work. Markform makes this practical: define a form in Markdown, and agents fill it step by step with validation feedback. Target audience: AI developers and technical leaders. Goal: explain why structured forms improve agent output quality. Target length: 10 tweets."
```

### Expected Output Structure

```
Filling form: .../examples/twitter-thread/twitter-thread.form.md
Agent: live (anthropic/claude-sonnet-4-5)
Turn 1: 11 issue(s): cleaned_content (missing), insights_table (missing), ...
  → X patches (tokens: ↓XXXX ↑XXX):
    cleaned_content (string) = ...
    insights_table (table) = [N rows]
    ...
Turn 2: N issue(s): ...
  → N patches (tokens: ↓XXXX ↑XXX):
    ...
  ✓ Complete
Form completed in N turn(s)
⏰ Fill time: XX.Xs
Form written to: test-output/twitter-filled.form.md

Fill completed in XX.Xs (N turns)

Tokens:  XXXXX input / XXXX output (anthropic/claude-sonnet-4-5)
Tools:   0 calls

Progress: 15/15 fields filled (100%)
Fill record written to: test-output/twitter-filled.fill.json
```

### Verification Checklist

- [ ] Form completes without errors
- [ ] All 15 fields are filled
- [ ] All 7 checkboxes in final checklist are checked
- [ ] Tables have appropriate number of rows (insights: 5+, drafts: ~10)
- [ ] Character counts in drafts table are accurate and ≤280
- [ ] Final thread is copy-paste ready
- [ ] Sidecar `.fill.json` file created

## Test 2: Stage-by-Stage Verification

After filling, verify the quality of each stage’s output.

### Check Form Status

```bash
pnpm markform status test-output/twitter-filled.form.md
```

### Inspect Filled Form

```bash
pnpm markform inspect test-output/twitter-filled.form.md
```

### View in Browser

```bash
pnpm markform serve test-output/twitter-filled.form.md
```

### Stage Quality Checks

#### Stage 1: Cleanup

- [ ] Raw content is cleaned but meaning is preserved
- [ ] Filler words removed ("like", “you know”, etc.)
- [ ] Typos and grammar fixed

#### Stage 2: Extract Insights

- [ ] At least 5 distinct insights identified
- [ ] Each has a clear “why it matters”
- [ ] Types are appropriate (thesis, supporting, example, etc.)

#### Stage 3: Prioritize

- [ ] Insights ranked by impact (1 = highest)
- [ ] Hook identified (exactly 1 with role="hook")
- [ ] CTA identified (exactly 1 with role="cta")
- [ ] Some insights marked “no” for include

#### Stage 4: Structure

- [ ] Tweet positions match target length (~10)
- [ ] Roles follow good thread structure (hook → context → points → conclusion)
- [ ] Each tweet maps to a prioritized insight

#### Stage 5: Draft

- [ ] Each tweet has thread number prefix (1/, 2/, etc.)
- [ ] All character counts are ≤280
- [ ] Character counts are accurate

#### Stage 6: Review

- [ ] All tweets marked “yes” for ≤280
- [ ] Most tweets marked “yes” for clarity and flow
- [ ] Revision notes explain any changes made

#### Stage 7: Final

- [ ] Final thread is formatted for copy-paste
- [ ] Tweet count matches target (~10)
- [ ] All 7 quality checkboxes checked

## Test 3: Alternative Input (Technical Blog)

Test with different content to verify form generality.

### Command

```bash
pnpm markform fill examples/twitter-thread/twitter-thread.form.md \
  --model anthropic/claude-sonnet-4-5 \
  --roles "*" \
  --output test-output/twitter-technical-filled.form.md \
  --record-fill \
  --instructions "Use this content about API error design: The most important thing I learned about API design this year is that errors should be first-class citizens. Most APIs treat errors as an afterthought — generic 500s or vague 'something went wrong' messages. But great APIs treat errors as part of the contract: each error has a unique code, is documented, and has a clear path to resolution. Stripe does this brilliantly — specific error codes, human-readable messages, fix suggestions. Every time you catch an exception and rethrow a generic error, you're destroying information. So now I design errors first: before the happy path, I write out all failure modes, give each a code, document causes and resolutions, then implement success. Errors aren't exceptions to handle — they're contracts to fulfill. Target audience: backend developers and API designers. Goal: convince developers to treat errors as first-class API design concerns. Target length: 8 tweets."
```

### Verification

- [ ] Form completes successfully
- [ ] Output quality is comparable to Test 1
- [ ] Content is specific to API design (not generic)

## Test 4: Character Count Verification

Verify the agent accurately counted characters in the drafts.

```bash
# Extract the final thread and count characters per tweet
pnpm markform dump test-output/twitter-filled.form.md --format json | \
  jq -r '.final_thread' | \
  grep "^[0-9]\+/" | \
  while read -r line; do
    chars=$(echo -n "$line" | wc -c)
    echo "[$chars chars] $line"
  done
```

All tweets should show ≤280 characters.

## Cleanup

```bash
rm -rf test-output/twitter-*
```

## Regression Checklist

Before release, verify:

- [ ] Test 1: Complete fill succeeds with all 15 fields filled
- [ ] Test 2: Each stage produces appropriate structured output
- [ ] Test 3: Form works with different content domains
- [ ] Test 4: Character counts are accurate (all ≤280)

**Key quality indicators:**
- Tables have appropriate row counts
- Final thread matches target length
- All quality checkboxes pass
- Output is genuinely copy-paste ready

## Notes

- This form tests complex multi-stage workflows
- Expect 2-4 turns for completion (stage-by-stage processing)
- Quality of output depends on model capability
- Character counting accuracy varies by model
- Focus on structural completion, not creative quality
