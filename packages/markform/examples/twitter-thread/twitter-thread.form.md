---
markform:
  spec: MF/0.1
  title: Content to Twitter Thread
  description: Transform raw content into an engaging Twitter/X thread through structured analysis, prioritization, and iterative refinement.
  run_mode: fill
  roles:
    - user
    - agent
  role_instructions:
    user: |
      Provide your raw content and any context about your audience and goals.
      The content can be a transcript, blog draft, notes, or any text.
    agent: |
      Transform the input into a compelling Twitter thread. Work through each stage in order—do not skip stages.

      STAGE 1 - CLEANUP: Edit raw content into clean prose. Fix errors, remove filler.

      STAGE 2 - EXTRACT INSIGHTS: Identify every key insight, claim, or idea worth sharing.
      Use the insights table to capture each one with why it matters.

      STAGE 3 - PRIORITIZE: Rank insights by impact. Identify which works as the hook,
      which are supporting points, which are examples. Not everything needs to be included.

      STAGE 4 - STRUCTURE: Plan the thread flow. Map ranked insights to tweet positions.
      Consider: hook → context → main points → examples → conclusion/CTA.

      STAGE 5 - DRAFT: Write each tweet with character count. Stay under 280 chars.
      Include thread numbering (1/, 2/, etc.).

      STAGE 6 - REVIEW: Compare drafts against structure plan. Check each tweet for:
      - Character limit compliance
      - Clarity and punch
      - Flow from previous tweet
      - Standalone readability

      STAGE 7 - FINAL: Produce polished, copy-paste ready output. Verify all checks pass.

      Key principles:
      - The hook determines if anyone reads the rest
      - One idea per tweet—don't cram
      - Each tweet should make sense if quoted alone
      - End with value (summary, CTA, or invitation to discuss)
  harness_config:
    max_issues_per_turn: 5
    max_patches_per_turn: 15
---
<!-- form id="twitter_thread" title="Content to Twitter Thread" -->

<!-- description ref="twitter_thread" -->
A rigorous content transformation workflow: raw text → insights → prioritization → structure → drafts → review → final thread. Each stage enforces quality through structured tables and validation.
<!-- /description -->

<!-- group id="input" title="Input: Raw Content" -->

## Source Content

<!-- field kind="string" id="raw_content" label="Raw Content" role="user" required=true minLength=200 --><!-- /field -->

<!-- instructions ref="raw_content" -->
Paste your raw content. This can be:
- A rough transcript (talk, podcast, voice memo)
- A blog post or article draft
- Meeting notes, brainstorm, or research notes
- Any text you want to transform

Aim for at least a few paragraphs. More content = richer thread options.
<!-- /instructions -->

<!-- field kind="string" id="target_audience" label="Target Audience" role="user" maxLength=200 --><!-- /field -->

<!-- instructions ref="target_audience" -->
Who is this thread for? Examples:
- "Startup founders building AI products"
- "Developers learning system design"
- "Product managers in B2B SaaS"

Helps tailor tone, examples, and assumed knowledge level.
<!-- /instructions -->

<!-- field kind="string" id="thread_goal" label="Thread Goal" role="user" maxLength=300 --><!-- /field -->

<!-- instructions ref="thread_goal" -->
What should readers take away? Examples:
- "Understand why structured forms improve AI agent reliability"
- "Learn the 5 key principles of good API design"
- "See why this approach to X is underrated"
<!-- /instructions -->

<!-- field kind="number" id="target_length" label="Target Thread Length" role="user" min=5 max=20 integer=true --><!-- /field -->

<!-- instructions ref="target_length" -->
Desired number of tweets (5-20). Typical threads:
- 5-7 tweets: Quick insight or single concept
- 8-12 tweets: Moderate depth, multiple points
- 12-20 tweets: Deep dive, comprehensive coverage
<!-- /instructions -->

<!-- /group -->

<!-- group id="cleanup" title="Stage 1: Content Cleanup" -->

## Cleaned Content

<!-- field kind="string" id="cleaned_content" label="Cleaned Content" role="agent" required=true minLength=100 --><!-- /field -->

<!-- instructions ref="cleaned_content" -->
Edit the raw content into clean, readable prose:
- Fix transcription errors, typos, and grammatical issues
- Remove filler words (um, uh, like, you know, basically)
- Improve sentence flow and clarity
- Preserve the author's voice and distinctive phrases
- Don't add new ideas—just clean what's there
<!-- /instructions -->

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

<!-- instructions ref="insights_table" -->
For each insight from the cleaned content:
- **Insight/Claim**: The core idea in one sentence
- **Why It Matters**: Why should readers care? What's the payoff?
- **Type**: categorize as one of:
  - `thesis` - central argument
  - `supporting` - backs up the thesis
  - `example` - concrete illustration
  - `context` - background/setup
  - `contrarian` - challenges assumptions
  - `actionable` - something readers can do

Be thorough—extract MORE than you'll use. You'll prioritize in the next stage.
<!-- /instructions -->

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

<!-- instructions ref="priority_table" -->
Take insights from Stage 2 and prioritize:
- **Rank**: 1 = highest impact, most compelling
- **Insight**: Brief summary (reference the insight)
- **Thread Role**: Where it fits in the thread:
  - `hook` - attention-grabbing opener (need exactly 1)
  - `context` - setup/background
  - `main_point` - core argument support
  - `example` - concrete illustration
  - `pivot` - transition or "but here's the thing"
  - `summary` - ties it together
  - `cta` - call to action (need exactly 1)
- **Include?**: `yes` or `no` (cut ruthlessly—not everything fits)

Total "yes" should roughly match target thread length.
<!-- /instructions -->

<!-- field kind="string" id="hook_strategy" label="Hook Strategy" role="agent" required=true maxLength=400 --><!-- /field -->

<!-- instructions ref="hook_strategy" -->
What's the hook strategy? Choose one:
- **Contrarian**: "Most people think X, but actually Y"
- **Promise**: "Here's how to do X in N steps"
- **Story**: "Last week I learned something that changed how I think about X"
- **Bold claim**: "X is the most underrated skill in Y"
- **Question**: "Why do most X fail at Y?"

Write out your specific hook angle for this thread.
<!-- /instructions -->

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

<!-- instructions ref="structure_table" -->
Plan each tweet position:
- **#**: Tweet number (1, 2, 3...)
- **Role**: hook, context, main_point, example, pivot, summary, cta
- **Content Plan**: What this tweet will say (not the final text, just the plan)
- **From Insight**: Which insight from the priority table this uses (or "new" if synthesized)

This is your blueprint. Drafting should follow this plan.
<!-- /instructions -->

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

<!-- instructions ref="drafts_table" -->
Write each tweet:
- **#**: Tweet number, must include "N/" prefix in the content
- **Draft Content**: The tweet text (must be ≤280 characters)
- **Chars**: Character count (be accurate!)
- **Issues**: Note any problems: "too long", "weak hook", "unclear", "missing link to previous"

Rules:
- Hard limit: 280 characters per tweet
- Include thread number prefix (1/, 2/, etc.)
- Each tweet should make sense if quoted alone
- Line breaks within tweets are fine for readability
<!-- /instructions -->

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

<!-- instructions ref="review_table" -->
Review each tweet:
- **≤280?**: Is it under 280 characters? (yes/no)
- **Clear?**: Is the point immediately clear? (yes/no)
- **Flows?**: Does it connect naturally from the previous tweet? (yes/no/na for #1)
- **Standalone?**: Would it make sense if someone only saw this tweet? (yes/no)
- **Revision**: What needs fixing? Leave blank if good, otherwise note the issue.

If any issues exist, address them before finalizing.
<!-- /instructions -->

<!-- field kind="string" id="revision_notes" label="Revision Notes" role="agent" maxLength=500 --><!-- /field -->

<!-- instructions ref="revision_notes" -->
If any tweets needed revision based on the review, note what you changed.
Leave blank if no revisions were needed.
<!-- /instructions -->

<!-- /group -->

<!-- group id="final" title="Stage 7: Final Thread" -->

## Final Output

The polished, copy-paste ready thread.

<!-- field kind="string" id="final_thread" label="Final Thread" role="agent" required=true --><!-- /field -->

<!-- instructions ref="final_thread" -->
Produce the final thread in copy-paste format:

1/ [First tweet]

2/ [Second tweet]

3/ [Third tweet]

...

(Double line break between each tweet for easy copying)
<!-- /instructions -->

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

<!-- instructions ref="final_checklist" -->
Verify ALL quality criteria are met before marking complete.
Do not check a box unless you've verified it's true.
<!-- /instructions -->

<!-- /group -->

<!-- /form -->
