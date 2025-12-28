---
markform:
  spec: MF/0.1
  title: Movie Research (Minimal)
  description: Quick movie lookup - just the essentials (title, year, rating, summary).
  roles:
    - user
    - agent
  role_instructions:
    user: "Enter the movie title."
    agent: |
      Quickly identify the movie and fill in basic info from IMDB.
      This is a minimal lookup - just get the core facts.
  harness_config:
    max_issues_per_turn: 3
    max_patches_per_turn: 8
---

{% form id="movie_research_minimal" title="Movie Research (Minimal)" %}

{% description ref="movie_research_minimal" %}
A quick movie lookup for essential info: title, year, rating, and a brief summary.
{% /description %}

{% string-field id="movie" label="Movie" role="user" required=true minLength=1 maxLength=300 %}{% /string-field %}

{% instructions ref="movie" %}
Enter the movie title (add year or details if needed for disambiguation).
{% /instructions %}

{% field-group id="title_identification" title="Basic Info" %}

{% string-field id="full_title" label="Full Title" role="agent" required=true %}{% /string-field %}

{% instructions ref="full_title" %}
Official title including subtitle if any.
{% /instructions %}

{% number-field id="year" label="Release Year" role="agent" required=true min=1888 max=2030 %}{% /number-field %}

{% url-field id="imdb_url" label="IMDB URL" role="agent" required=true %}{% /url-field %}

{% /field-group %}

{% field-group id="ratings" title="Ratings" %}

{% single-select id="mpaa_rating" label="MPAA Rating" role="agent" %}
- [ ] G {% #g %}
- [ ] PG {% #pg %}
- [ ] PG-13 {% #pg_13 %}
- [ ] R {% #r %}
- [ ] NC-17 {% #nc_17 %}
- [ ] NR/Unrated {% #nr %}
{% /single-select %}

{% number-field id="imdb_rating" label="IMDB Rating" role="agent" min=1.0 max=10.0 %}{% /number-field %}

{% instructions ref="imdb_rating" %}
IMDB user rating (1.0-10.0 scale).
{% /instructions %}

{% string-field id="logline" label="One-Line Summary" role="agent" maxLength=300 %}{% /string-field %}

{% instructions ref="logline" %}
Brief plot summary in 1-2 sentences, no spoilers.
{% /instructions %}

{% /field-group %}

{% /form %}
