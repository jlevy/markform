---
markform:
  spec: MF/0.1
  title: Movie Research (Deep)
  description: Comprehensive movie research form with ratings, box office, cast/crew, technical specs, streaming availability, and cultural analysis.
  roles:
    - user
    - agent
  role_instructions:
    user: "Enter the movie title and optionally the year for disambiguation."
    agent: |
      Conduct comprehensive research and fill in all available fields for the specified movie.

      WORKFLOW - Complete in this order:
      1. IDENTIFY - Confirm the movie title and year
      2. SOURCES - Find all source URLs first (verify correct movie on each site)
      3. BASIC DATA - Fill ratings, cast, crew from IMDB
      4. ADDITIONAL RATINGS - RT, Metacritic, Letterboxd scores
      5. BOX OFFICE - Financial data from Box Office Mojo
      6. STREAMING - Current availability from JustWatch
      7. DEEP ANALYSIS - Technical specs, awards, cultural context

      SOURCE MAPPING:
      - IMDB: Core data, cast, crew, technical specs, awards
      - Rotten Tomatoes: Tomatometer, Audience Score, Critics Consensus
      - Metacritic: Metascore
      - Box Office Mojo: Budget, domestic/worldwide gross, opening weekend
      - JustWatch: Current streaming platforms (use US region)
      - Letterboxd: Cinephile community rating
      - Wikipedia: Cultural impact, production history

      GUIDELINES:
      - Use EXACT scores from each source - don't average or interpret
      - Skip fields if data unavailable (older films may lack some metrics)
      - For box office, use millions (e.g., 100.5 for $100.5M)
      - Add notes for any missing, confusing, or unclear information
  harness_config:
    max_issues_per_turn: 5
    max_patches_per_turn: 15
---

{% form id="movie_research_deep" title="Movie Research (Deep)" %}

{% description ref="movie_research_deep" %}
Comprehensive movie research covering ratings from multiple sources, box office performance, full cast and crew, technical specifications, streaming availability, and cultural impact analysis.
{% /description %}

{% field-group id="movie_input" title="Movie Identification" %}

{% string-field id="movie" label="Movie" role="user" required=true minLength=1 maxLength=300 %}{% /string-field %}

{% instructions ref="movie" %}
Enter the movie title (add any details to help identify, like "Barbie 2023" or "the Batman movie with Robert Pattinson").
{% /instructions %}

{% /field-group %}

## Title Identification

{% field-group id="title_identification" title="Title Identification" %}

{% string-field id="full_title" label="Full Title" role="agent" required=true %}{% /string-field %}

{% instructions ref="full_title" %}
Official title including subtitle if any (e.g., "The Lord of the Rings: The Fellowship of the Ring").
{% /instructions %}

{% number-field id="year" label="Release Year" role="agent" required=true min=1888 max=2030 %}{% /number-field %}

{% /field-group %}

## Sources

{% field-group id="primary_sources" title="Primary Sources" %}

{% url-field id="imdb_url" label="IMDB URL" role="agent" required=true %}{% /url-field %}

{% instructions ref="imdb_url" %}
Required. Primary source for ratings, cast, crew, technical details.
Format: https://www.imdb.com/title/tt0111161/
{% /instructions %}

{% url-field id="rt_url" label="Rotten Tomatoes URL" role="agent" %}{% /url-field %}

{% instructions ref="rt_url" %}
Direct link to the movie's Rotten Tomatoes page.
{% /instructions %}

{% url-field id="metacritic_url" label="Metacritic URL" role="agent" %}{% /url-field %}

{% instructions ref="metacritic_url" %}
Direct link to the movie's Metacritic page.
{% /instructions %}

{% /field-group %}

{% field-group id="box_office_sources" title="Box Office Sources" %}

{% url-field id="boxofficemojo_url" label="Box Office Mojo URL" role="agent" %}{% /url-field %}

{% instructions ref="boxofficemojo_url" %}
Best source for budget, domestic/worldwide gross, opening weekend.
Format: https://www.boxofficemojo.com/title/tt0111161/
{% /instructions %}

{% url-field id="the_numbers_url" label="The Numbers URL" role="agent" %}{% /url-field %}

{% instructions ref="the_numbers_url" %}
Alternative/supplementary box office data and profitability analysis.
{% /instructions %}

{% /field-group %}

{% field-group id="availability_sources" title="Availability Sources" %}

{% url-field id="justwatch_url" label="JustWatch URL" role="agent" %}{% /url-field %}

{% instructions ref="justwatch_url" %}
Best source for current streaming availability. Use US region.
Format: https://www.justwatch.com/us/movie/the-shawshank-redemption
{% /instructions %}

{% /field-group %}

{% field-group id="additional_sources" title="Additional Sources" %}

{% url-field id="letterboxd_url" label="Letterboxd URL" role="agent" %}{% /url-field %}

{% instructions ref="letterboxd_url" %}
Cinephile community ratings. Especially useful for art/indie/cult films.
{% /instructions %}

{% url-field id="wikipedia_url" label="Wikipedia URL" role="agent" %}{% /url-field %}

{% instructions ref="wikipedia_url" %}
For production history, cultural impact, comprehensive awards list.
{% /instructions %}

{% url-field id="official_site_url" label="Official Website" role="agent" %}{% /url-field %}

{% instructions ref="official_site_url" %}
Studio or film's official website, if still active.
{% /instructions %}

{% /field-group %}

## Basic Details

{% field-group id="basic_details" title="Basic Details" %}

{% string-list id="directors" label="Director(s)" role="agent" required=true %}{% /string-list %}

{% instructions ref="directors" %}
One director per line. Most films have one; some have two or more co-directors.
{% /instructions %}

{% number-field id="runtime_minutes" label="Runtime (minutes)" role="agent" min=1 max=1000 %}{% /number-field %}

{% single-select id="mpaa_rating" label="MPAA Rating" role="agent" %}
- [ ] G {% #g %}
- [ ] PG {% #pg %}
- [ ] PG-13 {% #pg_13 %}
- [ ] R {% #r %}
- [ ] NC-17 {% #nc_17 %}
- [ ] NR/Unrated {% #nr %}
{% /single-select %}

{% multi-select id="genres" label="Genres" role="agent" minSelections=1 maxSelections=5 %}
- [ ] Action {% #action %}
- [ ] Adventure {% #adventure %}
- [ ] Animation {% #animation %}
- [ ] Biography {% #biography %}
- [ ] Comedy {% #comedy %}
- [ ] Crime {% #crime %}
- [ ] Documentary {% #documentary %}
- [ ] Drama {% #drama %}
- [ ] Family {% #family %}
- [ ] Fantasy {% #fantasy %}
- [ ] Film-Noir {% #film_noir %}
- [ ] History {% #history %}
- [ ] Horror {% #horror %}
- [ ] Music {% #music %}
- [ ] Musical {% #musical %}
- [ ] Mystery {% #mystery %}
- [ ] Romance {% #romance %}
- [ ] Sci-Fi {% #sci_fi %}
- [ ] Sport {% #sport %}
- [ ] Thriller {% #thriller %}
- [ ] War {% #war %}
- [ ] Western {% #western %}
{% /multi-select %}

{% instructions ref="genres" %}
Select all applicable genres from IMDB (up to 5).
{% /instructions %}

{% string-field id="original_language" label="Original Language" role="agent" %}{% /string-field %}

{% string-list id="countries" label="Countries" role="agent" %}{% /string-list %}

{% instructions ref="countries" %}
Production countries, one per line.
{% /instructions %}

{% /field-group %}

## Cast & Crew

{% field-group id="cast_crew" title="Cast & Crew" %}

{% table-field id="lead_cast" label="Lead Cast" role="agent" minRows=1 maxRows=10 %}
| Actor Name | Character Name |
| string | string |
|----|----|
{% /table-field %}

{% instructions ref="lead_cast" %}
Top-billed cast members with their character names.
Example: Leonardo DiCaprio | Dom Cobb
{% /instructions %}

{% string-list id="writers" label="Writers" role="agent" %}{% /string-list %}

{% instructions ref="writers" %}
Screenplay and story credits.
Format: Name (credit type)
Example: "Christopher Nolan (written by)"
{% /instructions %}

{% string-field id="cinematographer" label="Cinematographer" role="agent" %}{% /string-field %}

{% string-field id="composer" label="Composer" role="agent" %}{% /string-field %}

{% instructions ref="composer" %}
Film score composer (not soundtrack songs).
{% /instructions %}

{% string-list id="producers" label="Producers" role="agent" maxItems=5 %}{% /string-list %}

{% instructions ref="producers" %}
Key producers (limit to main credited producers).
Format: Name (producer type)
Example: "Emma Thomas (producer)"
{% /instructions %}

{% /field-group %}

## Ratings

{% field-group id="imdb_ratings" title="IMDB Ratings" %}

{% number-field id="imdb_rating" label="IMDB Rating" role="agent" min=1.0 max=10.0 %}{% /number-field %}

{% instructions ref="imdb_rating" %}
IMDB user rating (1.0-10.0 scale).
{% /instructions %}

{% number-field id="imdb_votes" label="IMDB Vote Count" role="agent" min=0 %}{% /number-field %}

{% instructions ref="imdb_votes" %}
Number of IMDB user votes (e.g., 2800000 for a popular film).
{% /instructions %}

{% /field-group %}

{% field-group id="rotten_tomatoes_ratings" title="Rotten Tomatoes Ratings" %}

{% number-field id="rt_critics_score" label="Tomatometer (Critics)" role="agent" min=0 max=100 %}{% /number-field %}

{% instructions ref="rt_critics_score" %}
Tomatometer percentage (0-100).
{% /instructions %}

{% number-field id="rt_critics_count" label="Critics Review Count" role="agent" min=0 %}{% /number-field %}

{% number-field id="rt_audience_score" label="Audience Score" role="agent" min=0 max=100 %}{% /number-field %}

{% instructions ref="rt_audience_score" %}
Audience Score percentage (0-100).
{% /instructions %}

{% string-field id="rt_consensus" label="Critics Consensus" role="agent" maxLength=500 %}{% /string-field %}

{% instructions ref="rt_consensus" %}
The official Rotten Tomatoes critics consensus statement, if available.
{% /instructions %}

{% /field-group %}

{% field-group id="metacritic_ratings" title="Metacritic Ratings" %}

{% number-field id="metacritic_score" label="Metacritic Score" role="agent" min=0 max=100 %}{% /number-field %}

{% instructions ref="metacritic_score" %}
Metascore (0-100 scale). Leave empty if not available.
{% /instructions %}

{% /field-group %}

{% field-group id="additional_ratings" title="Additional Ratings" %}

{% number-field id="letterboxd_rating" label="Letterboxd Rating" role="agent" min=0.5 max=5.0 %}{% /number-field %}

{% instructions ref="letterboxd_rating" %}
Letterboxd average rating (0.5-5.0 scale, in 0.1 increments).
{% /instructions %}

{% string-field id="cinemascore" label="CinemaScore Grade" role="agent" pattern="^[A-F][+-]?$" %}{% /string-field %}

{% instructions ref="cinemascore" %}
Opening weekend audience grade (A+ to F). Only available for theatrical releases.
{% /instructions %}

{% /field-group %}

## Box Office

{% field-group id="box_office" title="Box Office" %}

{% number-field id="budget_millions" label="Budget ($M)" role="agent" min=0 %}{% /number-field %}

{% instructions ref="budget_millions" %}
Production budget in millions USD. Example: 200 for $200M.
{% /instructions %}

{% number-field id="box_office_domestic_millions" label="Domestic Gross ($M)" role="agent" min=0 %}{% /number-field %}

{% instructions ref="box_office_domestic_millions" %}
US/Canada theatrical gross in millions USD.
{% /instructions %}

{% number-field id="box_office_worldwide_millions" label="Worldwide Gross ($M)" role="agent" min=0 %}{% /number-field %}

{% instructions ref="box_office_worldwide_millions" %}
Global theatrical gross in millions USD.
{% /instructions %}

{% number-field id="opening_weekend_millions" label="Opening Weekend ($M)" role="agent" min=0 %}{% /number-field %}

{% instructions ref="opening_weekend_millions" %}
US opening weekend gross in millions USD.
{% /instructions %}

{% /field-group %}

## Technical Specifications

{% field-group id="technical_specs" title="Technical Specifications" %}

{% single-select id="aspect_ratio" label="Aspect Ratio" role="agent" %}
- [ ] 1.33:1 (Academy) {% #ratio_133 %}
- [ ] 1.66:1 {% #ratio_166 %}
- [ ] 1.78:1 (16:9) {% #ratio_178 %}
- [ ] 1.85:1 (Flat) {% #ratio_185 %}
- [ ] 2.00:1 (Univisium) {% #ratio_200 %}
- [ ] 2.20:1 (70mm) {% #ratio_220 %}
- [ ] 2.35:1 (Scope) {% #ratio_235 %}
- [ ] 2.39:1 (Scope) {% #ratio_239 %}
- [ ] 2.76:1 (Ultra Panavision) {% #ratio_276 %}
- [ ] 1.43:1 (IMAX) {% #ratio_143 %}
- [ ] 1.90:1 (IMAX Digital) {% #ratio_190 %}
- [ ] Variable {% #ratio_variable %}
{% /single-select %}

{% single-select id="color_format" label="Color" role="agent" %}
- [ ] Color {% #color %}
- [ ] Black & White {% #bw %}
- [ ] Mixed/Partial Color {% #mixed %}
{% /single-select %}

{% string-field id="sound_mix" label="Sound Mix" role="agent" %}{% /string-field %}

{% instructions ref="sound_mix" %}
Primary sound format (e.g., "Dolby Atmos", "DTS", "Dolby Digital").
{% /instructions %}

{% string-field id="camera" label="Camera" role="agent" %}{% /string-field %}

{% instructions ref="camera" %}
Primary camera system used (e.g., "Arri Alexa 65", "IMAX 15-perf", "Panavision Panaflex").
{% /instructions %}

{% /field-group %}

## Streaming Availability

{% field-group id="streaming_availability" title="Streaming Availability (US)" %}

{% multi-select id="streaming_subscription" label="Streaming (Subscription)" role="agent" %}
- [ ] Netflix {% #netflix %}
- [ ] Amazon Prime Video {% #prime %}
- [ ] Disney+ {% #disney %}
- [ ] Max (HBO) {% #max %}
- [ ] Hulu {% #hulu %}
- [ ] Apple TV+ {% #apple %}
- [ ] Paramount+ {% #paramount %}
- [ ] Peacock {% #peacock %}
- [ ] MGM+ {% #mgm %}
- [ ] Criterion Channel {% #criterion %}
- [ ] MUBI {% #mubi %}
- [ ] Tubi (Free) {% #tubi %}
- [ ] Pluto TV (Free) {% #pluto %}
{% /multi-select %}

{% instructions ref="streaming_subscription" %}
Select all platforms where this film is currently available to stream (subscription or free). Check JustWatch for current availability.
{% /instructions %}

{% checkboxes id="availability_flags" label="Other Availability" role="agent" checkboxMode="simple" %}
- [ ] Available for digital rental {% #rental %}
- [ ] Available for digital purchase {% #purchase %}
- [ ] Physical media (Blu-ray/DVD) {% #physical %}
- [ ] 4K UHD available {% #uhd_4k %}
{% /checkboxes %}

{% /field-group %}

## Content & Themes

{% field-group id="content_themes" title="Content & Themes" %}

{% checkboxes id="content_warnings" label="Content Warnings" role="agent" checkboxMode="simple" %}
- [ ] Intense violence {% #violence %}
- [ ] Gore/disturbing imagery {% #gore %}
- [ ] Sexual content {% #sexual %}
- [ ] Nudity {% #nudity %}
- [ ] Strong language {% #language %}
- [ ] Drug/alcohol use {% #drugs %}
- [ ] Frightening scenes {% #frightening %}
- [ ] Flashing/strobe effects {% #flashing %}
{% /checkboxes %}

{% instructions ref="content_warnings" %}
Check any content warnings that apply. Use IMDB Parents Guide as reference.
{% /instructions %}

{% string-list id="themes" label="Key Themes" role="agent" maxItems=5 %}{% /string-list %}

{% instructions ref="themes" %}
Major themes explored in the film (e.g., "redemption", "family", "identity", "war").
{% /instructions %}

{% /field-group %}

## Summary & Legacy

{% field-group id="summary" title="Summary" %}

{% string-field id="logline" label="One-Line Summary" role="agent" maxLength=300 %}{% /string-field %}

{% instructions ref="logline" %}
Brief plot summary in 1-2 sentences, no spoilers.
{% /instructions %}

{% table-field id="notable_awards" label="Notable Awards" role="agent" %}
| Award | Category | Year |
| string | string | year |
|----|----|----|
{% /table-field %}

{% instructions ref="notable_awards" %}
Major awards won.
Example: Oscar | Best Picture | 1995
{% /instructions %}

{% table-field id="notable_quotes" label="Notable Critic Quotes" role="agent" maxRows=3 %}
| Quote | Critic | Publication |
| string | string | string |
|----|----|----|
{% /table-field %}

{% instructions ref="notable_quotes" %}
2-3 memorable critic quotes that capture reception.
{% /instructions %}

{% /field-group %}

{% field-group id="cultural_legacy" title="Cultural Legacy" %}

{% string-field id="cultural_impact" label="Cultural Impact" role="agent" maxLength=500 %}{% /string-field %}

{% instructions ref="cultural_impact" %}
Brief description of the film's cultural significance, influence, or legacy (1-3 sentences).
Leave empty for recent releases without established legacy.
{% /instructions %}

{% string-list id="similar_films" label="Similar Films" role="agent" maxItems=5 %}{% /string-list %}

{% instructions ref="similar_films" %}
Films with similar themes, style, or appeal. One per line.
{% /instructions %}

{% /field-group %}

{% /form %}
