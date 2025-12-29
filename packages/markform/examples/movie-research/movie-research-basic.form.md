---
markform:
  spec: MF/0.1
  title: Movie Research (Basic)
  description: Standard movie research form pulling ratings and key stats from IMDB, Rotten Tomatoes, and Metacritic.
  roles:
    - user
    - agent
  role_instructions:
    user: "Enter the movie title and optionally the year for disambiguation."
    agent: |
      Research and fill in all fields for the specified movie.
      Guidelines:
      1. WORKFLOW - Complete sections in order:
         - First identify the movie title
         - Then find all source URLs (verify you have the right movie on each site)
         - Then fill in details (year, directors, ratings) from those sources
      2. PRIMARY SOURCES:
         - IMDB (imdb.com) for ratings, runtime, and technical details
         - Rotten Tomatoes (rottentomatoes.com) for Tomatometer and Audience Score
         - Metacritic (metacritic.com) for Metascore
      3. Use the EXACT numeric scores from each source - don't average or interpret
      4. Skip fields if any scores are unavailable (older films may lack some metrics)
      5. Use the tool to add notes if there is missing, confusing, or unclear information
         in the values you provide.
  harness_config:
    max_issues_per_turn: 3
    max_patches_per_turn: 8
---

{% form id="movie_research_basic" title="Movie Research (Basic)" %}

{% description ref="movie_research_basic" %}
Standard research form for gathering ratings and key statistics for any film. Pulls from IMDB, Rotten Tomatoes, and Metacritic.
{% /description %}

{% field-group id="movie_input" title="Movie Identification" %}

{% field kind="string" id="movie" label="Movie" role="user" required=true minLength=1 maxLength=300 %}{% /field %}

{% instructions ref="movie" %}
Enter the movie title (add any details to help identify, like "Barbie 2023" or "the Batman movie with Robert Pattinson")
{% /instructions %}

{% /field-group %}

{% field-group id="title_identification" title="Title Identification" %}

{% field kind="string" id="full_title" label="Full Title" role="agent" required=true %}{% /field %}

{% instructions ref="full_title" %}
Look up what film the user had in mind and fill in the official title including subtitle if any (e.g., "The Lord of the Rings: The Fellowship of the Ring").
{% /instructions %}

{% /field-group %}

{% field-group id="sources" title="Sources" %}

{% field kind="url" id="imdb_url" label="IMDB URL" role="agent" required=true %}{% /field %}

{% instructions ref="imdb_url" %}
Direct link to the movie's IMDB page (e.g., https://www.imdb.com/title/tt0111161/).
{% /instructions %}

{% field kind="url" id="rt_url" label="Rotten Tomatoes URL" role="agent" %}{% /field %}

{% instructions ref="rt_url" %}
Direct link to the movie's Rotten Tomatoes page.
{% /instructions %}

{% field kind="url" id="metacritic_url" label="Metacritic URL" role="agent" %}{% /field %}

{% instructions ref="metacritic_url" %}
Direct link to the movie's Metacritic page.
{% /instructions %}

{% /field-group %}

{% field-group id="basic_details" title="Basic Details" %}

{% field kind="number" id="year" label="Release Year" role="agent" required=true min=1888 max=2030 %}{% /field %}

{% field kind="string_list" id="directors" label="Director(s)" role="agent" required=true %}{% /field %}

{% instructions ref="directors" %}
One director per line. Most films have one; some have two or more co-directors.
{% /instructions %}

{% field kind="number" id="runtime_minutes" label="Runtime (minutes)" role="agent" min=1 max=1000 %}{% /field %}

{% field kind="single_select" id="mpaa_rating" label="MPAA Rating" role="agent" %}
- [ ] G {% #g %}
- [ ] PG {% #pg %}
- [ ] PG-13 {% #pg_13 %}
- [ ] R {% #r %}
- [ ] NC-17 {% #nc_17 %}
- [ ] NR/Unrated {% #nr %}
{% /field %}

{% /field-group %}

{% field-group id="imdb_ratings" title="IMDB Ratings" %}

{% field kind="number" id="imdb_rating" label="IMDB Rating" role="agent" min=1.0 max=10.0 %}{% /field %}

{% instructions ref="imdb_rating" %}
IMDB user rating (1.0-10.0 scale).
{% /instructions %}

{% field kind="number" id="imdb_votes" label="IMDB Vote Count" role="agent" min=0 %}{% /field %}

{% instructions ref="imdb_votes" %}
Number of IMDB user votes (e.g., 2800000 for a popular film).
{% /instructions %}

{% /field-group %}

{% field-group id="rotten_tomatoes_ratings" title="Rotten Tomatoes Ratings" %}

{% field kind="number" id="rt_critics_score" label="Tomatometer (Critics)" role="agent" min=0 max=100 %}{% /field %}

{% instructions ref="rt_critics_score" %}
Tomatometer percentage (0-100).
{% /instructions %}

{% field kind="number" id="rt_critics_count" label="Critics Review Count" role="agent" min=0 %}{% /field %}

{% field kind="number" id="rt_audience_score" label="Audience Score" role="agent" min=0 max=100 %}{% /field %}

{% instructions ref="rt_audience_score" %}
Audience Score percentage (0-100).
{% /instructions %}

{% /field-group %}

{% field-group id="metacritic_ratings" title="Metacritic Ratings" %}

{% field kind="number" id="metacritic_score" label="Metacritic Score" role="agent" min=0 max=100 %}{% /field %}

{% instructions ref="metacritic_score" %}
Metascore (0-100 scale). Leave empty if not available.
{% /instructions %}

{% /field-group %}

{% field-group id="summary" title="Summary" %}

{% field kind="string" id="logline" label="One-Line Summary" role="agent" maxLength=300 %}{% /field %}

{% instructions ref="logline" %}
Brief plot summary in 1-2 sentences, no spoilers.
{% /instructions %}

{% field kind="table" id="notable_awards" label="Notable Awards" role="agent"
   columnIds=["award", "category", "year"]
   columnTypes=["string", "string", "year"] %}
| Award | Category | Year |
|-------|----------|------|
{% /field %}

{% instructions ref="notable_awards" %}
Major awards won.
Example: Oscar | Best Picture | 1995
{% /instructions %}

{% /field-group %}

{% /form %}
