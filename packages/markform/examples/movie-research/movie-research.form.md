---
markform:
  spec: MF/0.1
  title: Movie Research
  description: Quick movie research form pulling ratings and key stats from IMDB, Rotten Tomatoes, and Metacritic.
  roles:
    - user
    - agent
  role_instructions:
    user: "Enter the movie title and optionally the year for disambiguation."
    agent: |
      Research and fill in all fields for the specified movie.
      Guidelines:
      1. PRIMARY SOURCES:
         - IMDB (imdb.com) for ratings, runtime, and technical details
         - Rotten Tomatoes (rottentomatoes.com) for Tomatometer and Audience Score
         - Metacritic (metacritic.com) for Metascore
      2. Use the EXACT numeric scores from each source - don't average or interpret
      3. Note if any scores are unavailable (older films may lack some metrics)
      4. Include source URLs for verification
  harness_config:
    max_issues_per_turn: 3
    max_patches_per_turn: 8
---

{% form id="movie_research" title="Movie Research" %}

{% description ref="movie_research" %}
A focused research form for gathering ratings and key statistics for any film. Pulls from IMDB, Rotten Tomatoes, and Metacritic.
{% /description %}

{% field-group id="movie_input" title="Movie Identification" %}

{% string-field id="movie" label="Movie" role="user" required=true minLength=1 maxLength=300 %}{% /string-field %}

{% instructions ref="movie" %}
Enter the movie title (add any details to help identify, like "Barbie 2023" or "the Batman movie with Robert Pattinson")
{% /instructions %}

{% /field-group %}

{% field-group id="basic_info" title="Basic Information" %}

{% string-field id="full_title" label="Full Title" required=true %}{% /string-field %}

{% instructions ref="full_title" %}
Look up what film the user had in mind and fill in the official title including subtitle if any (e.g., "The Lord of the Rings: The Fellowship of the Ring").
{% /instructions %}

{% string-list id="directors" label="Director(s)" required=true %}{% /string-list %}

{% instructions ref="directors" %}
One director per line. Most films have one; some have two or more co-directors.
{% /instructions %}

{% number-field id="year" label="Release Year" required=true min=1888 max=2030 %}{% /number-field %}

{% number-field id="runtime_minutes" label="Runtime (minutes)" min=1 max=1000 %}{% /number-field %}

{% single-select id="mpaa_rating" label="MPAA Rating" %}
- [ ] G {% #g %}
- [ ] PG {% #pg %}
- [ ] PG-13 {% #pg_13 %}
- [ ] R {% #r %}
- [ ] NC-17 {% #nc_17 %}
- [ ] NR/Unrated {% #nr %}
{% /single-select %}

{% /field-group %}

{% field-group id="imdb" title="IMDB" %}

{% url-field id="imdb_url" label="IMDB URL" %}{% /url-field %}

{% instructions ref="imdb_url" %}
Direct link to the movie's IMDB page (e.g., https://www.imdb.com/title/tt0111161/).
{% /instructions %}

{% number-field id="imdb_rating" label="IMDB Rating" min=1.0 max=10.0 %}{% /number-field %}

{% instructions ref="imdb_rating" %}
IMDB user rating (1.0-10.0 scale).
{% /instructions %}

{% number-field id="imdb_votes" label="IMDB Vote Count" min=0 %}{% /number-field %}

{% instructions ref="imdb_votes" %}
Number of IMDB user votes (e.g., 2800000 for a popular film).
{% /instructions %}

{% /field-group %}

{% field-group id="rotten_tomatoes" title="Rotten Tomatoes" %}

{% url-field id="rt_url" label="Rotten Tomatoes URL" %}{% /url-field %}

{% instructions ref="rt_url" %}
Direct link to the movie's Rotten Tomatoes page.
{% /instructions %}

{% number-field id="rt_critics_score" label="Tomatometer (Critics)" min=0 max=100 %}{% /number-field %}

{% instructions ref="rt_critics_score" %}
Tomatometer percentage (0-100).
{% /instructions %}

{% number-field id="rt_critics_count" label="Critics Review Count" min=0 %}{% /number-field %}

{% number-field id="rt_audience_score" label="Audience Score" min=0 max=100 %}{% /number-field %}

{% instructions ref="rt_audience_score" %}
Audience Score percentage (0-100).
{% /instructions %}

{% /field-group %}

{% field-group id="metacritic" title="Metacritic" %}

{% url-field id="metacritic_url" label="Metacritic URL" %}{% /url-field %}

{% instructions ref="metacritic_url" %}
Direct link to the movie's Metacritic page.
{% /instructions %}

{% number-field id="metacritic_score" label="Metacritic Score" min=0 max=100 %}{% /number-field %}

{% instructions ref="metacritic_score" %}
Metascore (0-100 scale). Leave empty if not available.
{% /instructions %}

{% /field-group %}

{% field-group id="summary" title="Summary" %}

{% string-field id="logline" label="One-Line Summary" maxLength=300 %}{% /string-field %}

{% instructions ref="logline" %}
Brief plot summary in 1-2 sentences, no spoilers.
{% /instructions %}

{% string-list id="notable_awards" label="Notable Awards" %}{% /string-list %}

{% instructions ref="notable_awards" %}
Major awards won. One per line.
Format: Award | Category | Year
Example: "Oscar | Best Picture | 1995"
{% /instructions %}

{% /field-group %}

{% /form %}
