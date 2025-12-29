---
markform:
  spec: MF/0.1
  title: Movie Research (Minimal)
  description: Quick movie lookup with just the essentials (title, year, ratings, summary).
  roles:
    - user
    - agent
  role_instructions:
    user: "Enter the movie title."
    agent: |
      Quickly identify the movie and fill in basic info from IMDB.
      This is a minimal lookup - just get the core facts.
---
{% form id="movie_research_minimal" title="Movie Research (Minimal)" %}

## Movie Research Example

{% field-group id="movie_input" title="Movie Identification" %}

What movie do you want to research? \[*This field is filled in by the user (`role="user"`).*\]

{% field kind="string" id="movie" label="Movie" role="user" required=true minLength=1 maxLength=300 %}{% /field %}
{% instructions ref="movie" %}Enter the movie title (add year or details for disambiguation).{% /instructions %}

{% /field-group %}

## About the Movie

{% field-group id="about_the_movie" title="About the Movie" %}

**Title:**

{% field kind="string" id="full_title" label="Full Title" role="agent" required=true %}{% /field %}
{% instructions ref="full_title" %}Official title, including subtitle if any.{% /instructions %}

**Release year:**

{% field kind="number" id="year" label="Release Year" role="agent" required=true min=1888 max=2030 %}{% /field %}

**IMDB:**

{% field kind="url" id="imdb_url" label="IMDB URL" role="agent" required=true %}{% /field %}

**MPAA rating:**

{% field kind="single_select" id="mpaa_rating" label="MPAA Rating" role="agent" %}
- [ ] G {% #g %}
- [ ] PG {% #pg %}
- [ ] PG-13 {% #pg_13 %}
- [ ] R {% #r %}
- [ ] NC-17 {% #nc_17 %}
- [ ] NR/Unrated {% #nr %}
{% /field %}

**IMDB rating:**

{% field kind="number" id="imdb_rating" label="IMDB Rating" role="agent" min=1.0 max=10.0 %}{% /field %}
{% instructions ref="imdb_rating" %}IMDB user rating (1.0-10.0 scale).{% /instructions %}

**Summary:**

{% field kind="string" id="logline" label="One-Line Summary" role="agent" maxLength=300 %}{% /field %}
{% instructions ref="logline" %}Brief plot summary in 1-2 sentences, no spoilers.{% /instructions %}

{% /field-group %}

{% /form %}
