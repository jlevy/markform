---
markform:
  spec: MF/0.1
  title: Content to Twitter Thread
  description: Transform raw content (transcript, blog, notes) into an engaging Twitter/X thread.
  run_mode: fill
  roles:
    - user
    - agent
  role_instructions:
    user: "Paste your raw content - a transcript, blog post, notes, or any text you want to turn into a Twitter thread."
    agent: |
      Transform the input content into an engaging Twitter/X thread. Work through each stage in order:

      1. CLEANUP: Edit the raw content into clean, readable prose. Fix transcription errors, remove filler words, improve flow.

      2. ANALYSIS: Identify the key points, main themes, and what makes this content valuable to readers. Consider the hook (what grabs attention) and the payoff (what readers learn).

      3. STRUCTURE: Plan the thread flow. Each tweet should have one clear point. First tweet is the hook, last tweet is the call-to-action or summary.

      4. DRAFT: Write each tweet. Stay under 280 characters per tweet. Use thread numbering (1/, 2/, etc.). Make each tweet standalone but connected.

      5. FORMAT: Produce the final thread in copy-paste ready format.

      Guidelines:
      - Hooks matter: The first tweet determines if people read the rest
      - One idea per tweet: Don't cram multiple points into one tweet
      - Use line breaks within tweets for readability
      - End with value: Summary, call-to-action, or invitation to discuss
  harness_config:
    max_issues_per_turn: 5
    max_patches_per_turn: 12
---

{% form id="twitter_thread" title="Content to Twitter Thread" %}

{% description ref="twitter_thread" %}
A content transformation workflow that converts raw text (transcripts, blog posts, notes, dictation) into a polished Twitter/X thread. Demonstrates multi-stage processing with validation at each step.
{% /description %}

{% group id="input" title="Raw Content Input" %}

{% field kind="string" id="raw_content" label="Raw Content" role="user" required=true minLength=200 %}{% /field %}

{% instructions ref="raw_content" %}
Paste your raw content here. This can be:
- A rough transcript from a talk or podcast
- A blog post or article draft
- Meeting notes or brainstorm
- Voice memo transcription
- Any text you want to transform into a thread

The more content you provide, the richer the thread can be. Aim for at least a few paragraphs.
{% /instructions %}

{% field kind="string" id="target_audience" label="Target Audience" role="user" maxLength=200 %}{% /field %}

{% instructions ref="target_audience" %}
Optional: Who is this thread for? (e.g., "startup founders", "developers learning React", "product managers"). Helps tailor the tone and focus.
{% /instructions %}

{% field kind="string" id="thread_goal" label="Thread Goal" role="user" maxLength=200 %}{% /field %}

{% instructions ref="thread_goal" %}
Optional: What should readers take away? (e.g., "understand why forms matter for AI agents", "learn 5 key principles of good API design").
{% /instructions %}

{% /group %}

{% group id="cleanup" title="Stage 1: Content Cleanup" %}

{% description ref="cleanup" %}
Clean up the raw content into readable prose before extracting insights.
{% /description %}

{% field kind="string" id="cleaned_content" label="Cleaned Content" role="agent" required=true minLength=100 %}{% /field %}

{% instructions ref="cleaned_content" %}
Edit the raw content into clean, readable prose:
- Fix obvious transcription errors or typos
- Remove filler words (um, uh, like, you know)
- Improve sentence flow and clarity
- Keep the author's voice and key phrases
- Don't add new ideas—just clean up what's there
{% /instructions %}

{% /group %}

{% group id="analysis" title="Stage 2: Content Analysis" %}

{% description ref="analysis" %}
Analyze the cleaned content to identify what makes it valuable and how to structure the thread.
{% /description %}

{% field kind="string" id="core_thesis" label="Core Thesis" role="agent" required=true maxLength=280 %}{% /field %}

{% instructions ref="core_thesis" %}
What's the single most important point? This often becomes the hook or summary. Write it in ≤280 characters (tweet-length).
{% /instructions %}

{% field kind="string_list" id="key_points" label="Key Points" role="agent" required=true minItems=3 maxItems=12 %}{% /field %}

{% instructions ref="key_points" %}
List the key points to cover in the thread. One point per line. These will roughly map to individual tweets. Order them for narrative flow.
{% /instructions %}

{% field kind="string" id="hook_angle" label="Hook Angle" role="agent" required=true maxLength=300 %}{% /field %}

{% instructions ref="hook_angle" %}
What's the hook? What will make someone stop scrolling? Options:
- Contrarian take: "Most people think X, but actually Y"
- Promise of value: "Here's how to do X in 5 steps"
- Story opener: "Last week I learned something that changed how I think about X"
- Bold claim: "X is the most underrated skill in Y"
{% /instructions %}

{% field kind="string" id="call_to_action" label="Call to Action" role="agent" maxLength=200 %}{% /field %}

{% instructions ref="call_to_action" %}
How should the thread end? Options:
- Invite discussion: "What's your experience with X?"
- Offer more: "Follow for more on Y" or "Full post linked below"
- Summarize: Restate the core insight
- Challenge: "Try this and let me know what happens"
{% /instructions %}

{% /group %}

{% group id="structure" title="Stage 3: Thread Structure" %}

{% description ref="structure" %}
Plan the thread structure before writing individual tweets.
{% /description %}

{% field kind="table" id="thread_outline" label="Thread Outline" role="agent" required=true
   columnIds=["tweet_num", "purpose", "key_content"]
   columnLabels=["#", "Purpose", "Key Content/Point"]
   columnTypes=["number", "string", "string"]
   minRows=4 maxRows=15 %}
| # | Purpose | Key Content/Point |
|---|---------|-------------------|
{% /field %}

{% instructions ref="thread_outline" %}
Plan each tweet before writing. Include:
- Tweet number (1, 2, 3...)
- Purpose: What role does this tweet play? (hook, context, point, example, summary, CTA)
- Key content: The main point or content for this tweet

Example:
| 1 | Hook | Contrarian opener about forms and AI |
| 2 | Context | Why this matters now |
| 3 | Point 1 | Forms have worked for humans for centuries |
| ... | ... | ... |
{% /instructions %}

{% /group %}

{% group id="drafts" title="Stage 4: Tweet Drafts" %}

{% description ref="drafts" %}
Write each tweet. The table enforces the character limit constraint.
{% /description %}

{% field kind="table" id="tweets" label="Tweet Drafts" role="agent" required=true
   columnIds=["tweet_num", "content", "char_count"]
   columnLabels=["#", "Tweet Content", "Chars"]
   columnTypes=["number", "string", "number"]
   minRows=4 maxRows=15 %}
| # | Tweet Content | Chars |
|---|---------------|-------|
{% /field %}

{% instructions ref="tweets" %}
Write each tweet. Rules:
- Each tweet MUST be ≤280 characters (the Chars column helps you track)
- Include the thread number prefix (1/, 2/, etc.) in the content
- Use line breaks within tweets for readability when helpful
- Each tweet should make sense on its own (people may see it quoted)
- But also connect to form a narrative

Example row:
| 1 | 1/ Most AI agents fail not because they're not smart enough, but because they lack structure.

Here's why forms are the missing piece: | 142 |
{% /instructions %}

{% /group %}

{% group id="output" title="Stage 5: Final Thread" %}

{% description ref="output" %}
The polished, copy-paste ready thread.
{% /description %}

{% field kind="string" id="final_thread" label="Formatted Thread" role="agent" required=true %}{% /field %}

{% instructions ref="final_thread" %}
Produce the final thread in copy-paste format. Format as:

1/ [First tweet text]

2/ [Second tweet text]

3/ [Third tweet text]

...

(Double line breaks between tweets for easy copying)
{% /instructions %}

{% field kind="number" id="total_tweets" label="Total Tweet Count" role="agent" required=true min=3 max=25 integer=true %}{% /field %}

{% field kind="checkboxes" id="quality_checks" label="Quality Checks" role="agent" checkboxMode="simple" required=true %}
- [ ] Hook is compelling and specific {% #hook_check %}
- [ ] Each tweet is under 280 characters {% #char_check %}
- [ ] Thread has clear narrative flow {% #flow_check %}
- [ ] Ends with clear CTA or summary {% #ending_check %}
{% /field %}

{% instructions ref="quality_checks" %}
Verify the thread meets quality standards before completing.
{% /instructions %}

{% /group %}

{% /form %}
