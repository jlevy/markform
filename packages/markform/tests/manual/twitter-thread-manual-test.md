# Manual End-to-End Test: Twitter Thread Form

> **Purpose**: Validate the multi-stage content transformation workflow.
> This tests the rigorous 7-stage process from raw content to polished Twitter thread.
>
> **NOT automated** - Run manually to verify end-to-end agent behavior on complex workflows.

---

## Overview

The Twitter Thread form demonstrates **content transformation** - a key use case for Markform.
It enforces quality through structured stages:

1. **Input** - Raw content + context
2. **Cleanup** - Edit into clean prose
3. **Extract Insights** - Identify key ideas (table)
4. **Prioritize** - Rank and assign thread roles (table)
5. **Structure** - Plan tweet positions (table)
6. **Draft** - Write tweets with char counts (table)
7. **Review & Final** - Verify quality, produce output

Each stage produces structured output that feeds the next stage.

---

## Prerequisites

1. **Build the CLI**:
   ```bash
   pnpm build
   ```

2. **Set up API keys** in `.env` at repository root:
   ```bash
   ANTHROPIC_API_KEY=sk-ant-...
   # Or for OpenAI:
   # OPENAI_API_KEY=sk-...
   ```

3. **Create output directory**:
   ```bash
   mkdir -p /tmp/markform-twitter-test
   ```

---

## Sample Input Content

Use this sample content for testing. It's a rough transcript about Markform's value proposition:

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

---

## Test 1: Complete Fill with Anthropic

Fill the form end-to-end using Claude.

### Create Input File

First, create a pre-filled form with just the user input:

```bash
cat > /tmp/markform-twitter-test/twitter-input.form.md << 'HEREDOC'
---
markform:
  spec: MF/0.1
  title: Content to Twitter Thread
  description: Transform raw content into an engaging Twitter/X thread through structured analysis, prioritization, and iterative refinement.
  run_mode: fill
  roles:
    - user
    - agent
---
<!-- form id="twitter_thread" title="Content to Twitter Thread" -->

<!-- group id="input" title="Input: Raw Content" -->

## Source Content

<!-- field kind="string" id="raw_content" label="Raw Content" role="user" required=true minLength=200 -->
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
<!-- /field -->

<!-- field kind="string" id="target_audience" label="Target Audience" role="user" maxLength=200 -->
AI developers and technical leaders building agent-based applications
<!-- /field -->

<!-- field kind="string" id="thread_goal" label="Thread Goal" role="user" maxLength=300 -->
Explain why structured forms dramatically improve AI agent output quality and introduce Markform as a solution
<!-- /field -->

<!-- field kind="number" id="target_length" label="Target Thread Length" role="user" min=5 max=20 integer=true -->
10
<!-- /field -->

<!-- /group -->

<!-- group id="cleanup" title="Stage 1: Content Cleanup" -->

## Cleaned Content

<!-- field kind="string" id="cleaned_content" label="Cleaned Content" role="agent" required=true minLength=100 --><!-- /field -->

<!-- /group -->

<!-- group id="insights" title="Stage 2: Extract Insights" -->

## Key Insights

Extract every insight, claim, or idea worth sharing.

<!-- field kind="table" id="insights_table" label="Insights" role="agent" required=true
   columnIds=["insight", "why_matters", "type"]
   columnLabels=["Insight/Claim", "Why It Matters", "Type"]
   columnTypes=["string", "string", "string"]
   minRows=5 maxRows=20 -->

| Insight/Claim | Why It Matters | Type |
|---------------|----------------|------|

<!-- /field -->

<!-- /group -->

<!-- group id="prioritize" title="Stage 3: Prioritize & Rank" -->

## Prioritization

Not every insight makes the thread. Rank by impact and assign roles.

<!-- field kind="table" id="priority_table" label="Ranked Insights" role="agent" required=true
   columnIds=["rank", "insight_summary", "role", "include"]
   columnLabels=["Rank", "Insight (summary)", "Thread Role", "Include?"]
   columnTypes=["number", "string", "string", "string"]
   minRows=5 maxRows=15 -->

| Rank | Insight (summary) | Thread Role | Include? |
|------|-------------------|-------------|----------|

<!-- /field -->

<!-- field kind="string" id="hook_strategy" label="Hook Strategy" role="agent" required=true maxLength=400 --><!-- /field -->

<!-- /group -->

<!-- group id="structure" title="Stage 4: Thread Structure" -->

## Thread Plan

Map the prioritized insights into a tweet-by-tweet structure.

<!-- field kind="table" id="structure_table" label="Thread Structure" role="agent" required=true
   columnIds=["tweet_num", "role", "content_plan", "source_insight"]
   columnLabels=["#", "Role", "Content Plan", "From Insight"]
   columnTypes=["number", "string", "string", "string"]
   minRows=5 maxRows=20 -->

| # | Role | Content Plan | From Insight |
|---|------|--------------|--------------|

<!-- /field -->

<!-- /group -->

<!-- group id="drafts" title="Stage 5: Draft Tweets" -->

## Tweet Drafts

Write each tweet following the structure plan.

<!-- field kind="table" id="drafts_table" label="Tweet Drafts" role="agent" required=true
   columnIds=["tweet_num", "draft_content", "char_count", "issues"]
   columnLabels=["#", "Draft Content", "Chars", "Issues"]
   columnTypes=["number", "string", "number", "string"]
   minRows=5 maxRows=20 -->

| # | Draft Content | Chars | Issues |
|---|---------------|-------|--------|

<!-- /field -->

<!-- /group -->

<!-- group id="review" title="Stage 6: Review & Refine" -->

## Review Checklist

Verify each tweet against quality criteria.

<!-- field kind="table" id="review_table" label="Tweet Review" role="agent" required=true
   columnIds=["tweet_num", "under_280", "clear", "flows", "standalone", "revision_needed"]
   columnLabels=["#", "≤280?", "Clear?", "Flows?", "Standalone?", "Revision"]
   columnTypes=["number", "string", "string", "string", "string", "string"]
   minRows=5 maxRows=20 -->

| # | ≤280? | Clear? | Flows? | Standalone? | Revision |
|---|-------|--------|--------|-------------|----------|

<!-- /field -->

<!-- field kind="string" id="revision_notes" label="Revision Notes" role="agent" maxLength=500 --><!-- /field -->

<!-- /group -->

<!-- group id="final" title="Stage 7: Final Thread" -->

## Final Output

The polished, copy-paste ready thread.

<!-- field kind="string" id="final_thread" label="Final Thread" role="agent" required=true --><!-- /field -->

<!-- field kind="number" id="total_tweets" label="Total Tweet Count" role="agent" required=true min=5 max=20 integer=true --><!-- /field -->

<!-- field kind="checkboxes" id="final_checklist" label="Final Quality Checklist" role="agent" checkboxMode="simple" required=true -->

- [ ] Hook grabs attention and is specific to the content <!-- #hook_quality -->
- [ ] Every tweet is under 280 characters <!-- #char_limit -->
- [ ] Thread has clear narrative arc (setup → points → conclusion) <!-- #narrative_arc -->
- [ ] Each tweet flows naturally from the previous one <!-- #flow_quality -->
- [ ] Each tweet makes sense if read in isolation <!-- #standalone -->
- [ ] Ends with clear CTA or memorable summary <!-- #ending_quality -->
- [ ] No filler tweets—every tweet adds value <!-- #no_filler -->

<!-- /field -->

<!-- /group -->

<!-- /form -->
HEREDOC
```

### Run the Fill

```bash
./dist/bin.mjs fill /tmp/markform-twitter-test/twitter-input.form.md \
  --model anthropic/claude-sonnet-4-5 \
  --output /tmp/markform-twitter-test/twitter-filled.form.md \
  --record-fill
```

### Expected Output Structure

```
Filling form: /tmp/markform-twitter-test/twitter-input.form.md
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
Form written to: /tmp/markform-twitter-test/twitter-filled.form.md

Fill completed in XX.Xs (N turns)

Tokens:  XXXXX input / XXXX output (anthropic/claude-sonnet-4-5)
Tools:   0 calls

Progress: 15/15 fields filled (100%)
Fill record written to: /tmp/markform-twitter-test/twitter-filled.fill.json
```

### Verification Checklist

- [ ] Form completes without errors
- [ ] All 15 fields are filled
- [ ] All 7 checkboxes in final checklist are checked
- [ ] Tables have appropriate number of rows (insights: 5+, drafts: ~10)
- [ ] Character counts in drafts table are accurate and ≤280
- [ ] Final thread is copy-paste ready

---

## Test 2: Stage-by-Stage Verification

After filling, verify the quality of each stage's output.

### Check Form Status

```bash
./dist/bin.mjs status /tmp/markform-twitter-test/twitter-filled.form.md
```

### Inspect Filled Form

```bash
./dist/bin.mjs inspect /tmp/markform-twitter-test/twitter-filled.form.md
```

### View in Browser

```bash
./dist/bin.mjs browse /tmp/markform-twitter-test/twitter-filled.form.md --open
```

### Stage Quality Checks

#### Stage 1: Cleanup
- [ ] Raw content is cleaned but meaning is preserved
- [ ] Filler words removed ("like", "you know", etc.)
- [ ] Typos and grammar fixed

#### Stage 2: Extract Insights
- [ ] At least 5 distinct insights identified
- [ ] Each has a clear "why it matters"
- [ ] Types are appropriate (thesis, supporting, example, etc.)

#### Stage 3: Prioritize
- [ ] Insights ranked by impact (1 = highest)
- [ ] Hook identified (exactly 1 with role="hook")
- [ ] CTA identified (exactly 1 with role="cta")
- [ ] Some insights marked "no" for include

#### Stage 4: Structure
- [ ] Tweet positions match target length (~10)
- [ ] Roles follow good thread structure (hook → context → points → conclusion)
- [ ] Each tweet maps to a prioritized insight

#### Stage 5: Draft
- [ ] Each tweet has thread number prefix (1/, 2/, etc.)
- [ ] All character counts are ≤280
- [ ] Character counts are accurate

#### Stage 6: Review
- [ ] All tweets marked "yes" for ≤280
- [ ] Most tweets marked "yes" for clarity and flow
- [ ] Revision notes explain any changes made

#### Stage 7: Final
- [ ] Final thread is formatted for copy-paste
- [ ] Tweet count matches target (~10)
- [ ] All 7 quality checkboxes checked

---

## Test 3: Manual Character Count Verification

Verify the agent accurately counted characters in the drafts.

```bash
# Extract the final thread and count characters per tweet
cat /tmp/markform-twitter-test/twitter-filled.form.md | \
  grep -A 1000 "## Final Output" | \
  grep "^[0-9]\+/" | \
  while read -r line; do
    chars=$(echo -n "$line" | wc -c)
    echo "[$chars chars] $line"
  done
```

All tweets should show ≤280 characters.

---

## Test 4: Alternative Input - Technical Blog

Test with different content to verify form generality.

### Create Technical Input

```bash
cat > /tmp/markform-twitter-test/twitter-technical.form.md << 'HEREDOC'
---
markform:
  spec: MF/0.1
  title: Content to Twitter Thread
  description: Transform raw content into an engaging Twitter/X thread.
  run_mode: fill
  roles:
    - user
    - agent
---
<!-- form id="twitter_thread" title="Content to Twitter Thread" -->

<!-- group id="input" title="Input: Raw Content" -->

## Source Content

<!-- field kind="string" id="raw_content" label="Raw Content" role="user" required=true minLength=200 -->
The most important thing I learned about API design this year is that errors should be
first-class citizens. Like, most APIs treat errors as an afterthought - something you
handle with a generic 500 or a vague "something went wrong" message.

But great APIs? They treat errors as part of the contract. Each error has a unique code.
Each code is documented. Each has a clear path to resolution.

Stripe does this brilliantly. When your payment fails, you don't get "Error: payment
failed". You get a specific error code, a human-readable message, and often a suggestion
for what to fix. Their error taxonomy is extensive and consistent.

The same applies to internal APIs. Every time you catch an exception and rethrow a
generic error, you're destroying information. The caller can't make intelligent decisions.
They can't retry appropriately. They can't show useful messages to users.

So now I design errors first. Before I write the happy path, I write out all the ways
things can go wrong. I give each a code. I document the causes and resolutions. Then I
implement the success case.

It sounds backwards but it's changed how I think about robustness. Errors aren't
exceptions to handle - they're contracts to fulfill.
<!-- /field -->

<!-- field kind="string" id="target_audience" label="Target Audience" role="user" maxLength=200 -->
Backend developers and API designers
<!-- /field -->

<!-- field kind="string" id="thread_goal" label="Thread Goal" role="user" maxLength=300 -->
Convince developers to treat errors as first-class API design concerns with practical examples
<!-- /field -->

<!-- field kind="number" id="target_length" label="Target Thread Length" role="user" min=5 max=20 integer=true -->
8
<!-- /field -->

<!-- /group -->

<!-- group id="cleanup" title="Stage 1: Content Cleanup" -->

## Cleaned Content

<!-- field kind="string" id="cleaned_content" label="Cleaned Content" role="agent" required=true minLength=100 --><!-- /field -->

<!-- /group -->

<!-- group id="insights" title="Stage 2: Extract Insights" -->

## Key Insights

<!-- field kind="table" id="insights_table" label="Insights" role="agent" required=true
   columnIds=["insight", "why_matters", "type"]
   columnLabels=["Insight/Claim", "Why It Matters", "Type"]
   columnTypes=["string", "string", "string"]
   minRows=5 maxRows=20 -->

| Insight/Claim | Why It Matters | Type |
|---------------|----------------|------|

<!-- /field -->

<!-- /group -->

<!-- group id="prioritize" title="Stage 3: Prioritize & Rank" -->

## Prioritization

<!-- field kind="table" id="priority_table" label="Ranked Insights" role="agent" required=true
   columnIds=["rank", "insight_summary", "role", "include"]
   columnLabels=["Rank", "Insight (summary)", "Thread Role", "Include?"]
   columnTypes=["number", "string", "string", "string"]
   minRows=5 maxRows=15 -->

| Rank | Insight (summary) | Thread Role | Include? |
|------|-------------------|-------------|----------|

<!-- /field -->

<!-- field kind="string" id="hook_strategy" label="Hook Strategy" role="agent" required=true maxLength=400 --><!-- /field -->

<!-- /group -->

<!-- group id="structure" title="Stage 4: Thread Structure" -->

## Thread Plan

<!-- field kind="table" id="structure_table" label="Thread Structure" role="agent" required=true
   columnIds=["tweet_num", "role", "content_plan", "source_insight"]
   columnLabels=["#", "Role", "Content Plan", "From Insight"]
   columnTypes=["number", "string", "string", "string"]
   minRows=5 maxRows=20 -->

| # | Role | Content Plan | From Insight |
|---|------|--------------|--------------|

<!-- /field -->

<!-- /group -->

<!-- group id="drafts" title="Stage 5: Draft Tweets" -->

## Tweet Drafts

<!-- field kind="table" id="drafts_table" label="Tweet Drafts" role="agent" required=true
   columnIds=["tweet_num", "draft_content", "char_count", "issues"]
   columnLabels=["#", "Draft Content", "Chars", "Issues"]
   columnTypes=["number", "string", "number", "string"]
   minRows=5 maxRows=20 -->

| # | Draft Content | Chars | Issues |
|---|---------------|-------|--------|

<!-- /field -->

<!-- /group -->

<!-- group id="review" title="Stage 6: Review & Refine" -->

## Review Checklist

<!-- field kind="table" id="review_table" label="Tweet Review" role="agent" required=true
   columnIds=["tweet_num", "under_280", "clear", "flows", "standalone", "revision_needed"]
   columnLabels=["#", "≤280?", "Clear?", "Flows?", "Standalone?", "Revision"]
   columnTypes=["number", "string", "string", "string", "string", "string"]
   minRows=5 maxRows=20 -->

| # | ≤280? | Clear? | Flows? | Standalone? | Revision |
|---|-------|--------|--------|-------------|----------|

<!-- /field -->

<!-- field kind="string" id="revision_notes" label="Revision Notes" role="agent" maxLength=500 --><!-- /field -->

<!-- /group -->

<!-- group id="final" title="Stage 7: Final Thread" -->

## Final Output

<!-- field kind="string" id="final_thread" label="Final Thread" role="agent" required=true --><!-- /field -->

<!-- field kind="number" id="total_tweets" label="Total Tweet Count" role="agent" required=true min=5 max=20 integer=true --><!-- /field -->

<!-- field kind="checkboxes" id="final_checklist" label="Final Quality Checklist" role="agent" checkboxMode="simple" required=true -->

- [ ] Hook grabs attention and is specific to the content <!-- #hook_quality -->
- [ ] Every tweet is under 280 characters <!-- #char_limit -->
- [ ] Thread has clear narrative arc (setup → points → conclusion) <!-- #narrative_arc -->
- [ ] Each tweet flows naturally from the previous one <!-- #flow_quality -->
- [ ] Each tweet makes sense if read in isolation <!-- #standalone -->
- [ ] Ends with clear CTA or memorable summary <!-- #ending_quality -->
- [ ] No filler tweets—every tweet adds value <!-- #no_filler -->

<!-- /field -->

<!-- /group -->

<!-- /form -->
HEREDOC
```

### Run Technical Input

```bash
./dist/bin.mjs fill /tmp/markform-twitter-test/twitter-technical.form.md \
  --model anthropic/claude-sonnet-4-5 \
  --output /tmp/markform-twitter-test/twitter-technical-filled.form.md \
  --record-fill
```

---

## Test 5: Fill from Template

Use the original template form and provide input interactively or via instructions.

```bash
./dist/bin.mjs fill examples/twitter-thread/twitter-thread.form.md \
  --model anthropic/claude-sonnet-4-5 \
  --roles "*" \
  --output /tmp/markform-twitter-test/twitter-template-filled.form.md \
  --record-fill \
  --instructions "Use this sample content about structured forms for AI agents: Forms enforce operational quality for agents just as they do for humans. When you give an agent a blank prompt, you get unpredictable output. But with structured forms, you get consistent, high-quality results every time. The form provides the scaffolding for quality work. Target audience: AI developers. Goal: explain why forms improve agent output. Target length: 8 tweets."
```

---

## Cleanup

```bash
rm -rf /tmp/markform-twitter-test
```

---

## Regression Checklist

Before release, verify:

- [ ] Test 1: Complete fill succeeds with all 15 fields filled
- [ ] Test 2: Each stage produces appropriate structured output
- [ ] Test 3: Character counts are accurate (all ≤280)
- [ ] Test 4: Form works with different content domains
- [ ] Test 5: Template can be filled via instructions

**Key quality indicators:**
- Tables have appropriate row counts
- Final thread matches target length
- All quality checkboxes pass
- Output is genuinely copy-paste ready

---

## Notes

- This form tests complex multi-stage workflows
- Expect 2-4 turns for completion (stage-by-stage processing)
- Quality of output depends on model capability
- Character counting accuracy varies by model
- Focus on structural completion, not creative quality
