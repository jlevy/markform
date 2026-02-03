---
markform:
  spec: MF/0.1
  title: Movie Research Demo
  description: Movie lookup with ratings from IMDB and Rotten Tomatoes.
  run_mode: research
  role_instructions:
    user: Enter the movie title.
    agent: >
      Identify the movie with web searches and use imdb.com and rottentomatoes.com to
      fill in the ratings.
---

<!-- form id="movie_research_demo" -->

<!-- group id="movie_input" -->

<!-- field kind="string" id="movie" role="user" label="Movie" maxLength=300 minLength=1 required=true --><!-- /field -->

<!-- instructions ref="movie" -->
Enter the movie title (add year or details for
disambiguation).
<!-- /instructions -->

<!-- /group -->

<!-- group id="about_the_movie" title="About the Movie" -->

<!-- field kind="single_select" id="mpaa_rating" label="MPAA Rating" -->
- [ ] G <!-- #g -->
- [ ] PG <!-- #pg -->
- [ ] PG-13 <!-- #pg_13 -->
- [ ] R <!-- #r -->
- [ ] NC-17 <!-- #nc_17 -->
- [ ] NR/Unrated <!-- #nr -->
<!-- /field -->

<!-- field kind="table" id="ratings_table" columnIds=["source", "score", "votes"] columnLabels=["Source", "Score", "Votes"] columnTypes=["string", "number", "number"] label="Ratings" maxRows=3 minRows=0 required=true --><!-- /field -->

<!-- instructions ref="ratings_table" -->
Fill in scores and vote counts from each source:IMDB: Rating (1.0-10.0 scale), vote countRT Critics: Tomatometer (0-100%), review countRT Audience: Audience Score (0-100%), rating count
<!-- /instructions -->

<!-- /group -->

<!-- /form -->



