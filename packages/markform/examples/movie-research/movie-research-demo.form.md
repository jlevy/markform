---
markform:
  spec: MF/0.1
  title: Movie Research Demo
  description: Movie lookup with ratings from IMDB and Rotten Tomatoes.
  run_mode: research
  roles:
    - user
    - agent
  role_instructions:
    user: "Enter the movie title."
    agent: |
      Identify the movie with web searches and use imdb.com and rottentomatoes.com to fill in the ratings.

---
{% form id="movie_research_demo" %}

{% group id="movie_input" %}

## What movie do you want to research?

{% field kind="string" id="movie" label="Movie" role="user" required=true minLength=1 maxLength=300 %}{% /field %}

{% instructions ref="movie" %}Enter the movie title (add year or details for
disambiguation).{% /instructions %}

{% /group %}

{% group id="about_the_movie" title="About the Movie" %}

## Movie Ratings

Here are the ratings for the movie:

{% field kind="single_select" id="mpaa_rating" role="agent" label="MPAA Rating" %}

- [ ] G {% #g %}
- [ ] PG {% #pg %}
- [ ] PG-13 {% #pg_13 %}
- [ ] R {% #r %}
- [ ] NC-17 {% #nc_17 %}
- [ ] NR/Unrated {% #nr %}

{% /field %}

{% field kind="table" id="ratings_table" role="agent" label="Ratings" required=true columnIds=["source", "score", "votes"] columnTypes=["string", "number", "number"] minRows=0 maxRows=3 %}

| Source | Score | Votes |
|--------|-------|-------|

{% /field %}

{% instructions ref="ratings_table" %}
Fill in scores and vote counts from each source:
- IMDB: Rating (1.0-10.0 scale), vote count
- RT Critics: Tomatometer (0-100%), review count
- RT Audience: Audience Score (0-100%), rating count

{% /instructions %}

{% /group %}

{% /form %}
