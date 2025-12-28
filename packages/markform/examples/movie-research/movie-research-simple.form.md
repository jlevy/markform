---
markform:
  spec: MF/0.1
  title: Movie Research (Simple)
  description: A minimal movie research form - finds basic info and IMDB rating.
  roles:
    - user
    - agent
  role_instructions:
    user: "Enter the movie title."
    agent: "Research the movie and fill in the details from IMDB."
---

{% form id="movie_research" title="Movie Research" %}

{% field-group id="input" title="Input" %}

{% string-field id="movie" label="Movie" role="user" required=true %}{% /string-field %}

{% instructions ref="movie" %}
Enter the movie title (e.g., "The Matrix" or "Barbie 2023").
{% /instructions %}

{% /field-group %}

{% field-group id="details" title="Movie Details" %}

{% string-field id="full_title" label="Full Title" role="agent" required=true %}{% /string-field %}

{% number-field id="year" label="Release Year" role="agent" min=1888 max=2030 %}{% /number-field %}

{% single-select id="mpaa_rating" label="MPAA Rating" role="agent" %}
- [ ] G {% #g %}
- [ ] PG {% #pg %}
- [ ] PG-13 {% #pg_13 %}
- [ ] R {% #r %}
- [ ] NC-17 {% #nc_17 %}
- [ ] NR/Unrated {% #nr %}
{% /single-select %}

{% url-field id="imdb_url" label="IMDB URL" role="agent" %}{% /url-field %}

{% number-field id="imdb_rating" label="IMDB Rating" role="agent" min=1.0 max=10.0 %}{% /number-field %}

{% string-field id="logline" label="Summary" role="agent" maxLength=200 %}{% /string-field %}

{% /field-group %}

{% /form %}
