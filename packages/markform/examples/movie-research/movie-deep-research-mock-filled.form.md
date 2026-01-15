---
markform:
  spec: MF/0.1
  title: Movie Deep Research
  description: Comprehensive movie research form with ratings, box office, cast/crew, technical specs, streaming availability, and cultural analysis.
  run_mode: research
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
{% form id="movie_research_deep" title="Movie Deep Research" %}

{% description ref="movie_research_deep" %}
Comprehensive movie research covering ratings from multiple sources, box office
performance, full cast and crew, technical specifications, streaming availability, and
cultural impact analysis.
{% /description %}

{% group id="movie_input" title="Movie Identification" %}

{% field kind="string" id="movie" label="Movie" role="user" required=true minLength=1 maxLength=300 %}
```value
The Shawshank Redemption
```
{% /field %}

{% instructions ref="movie" %}
Enter the movie title (add any details to help identify, like “Barbie 2023” or “the
Batman movie with Robert Pattinson”).
{% /instructions %}

{% /group %}

## Title Identification

{% group id="title_identification" title="Title Identification" %}

{% field kind="string" id="full_title" label="Full Title" role="agent" required=true %}
```value
The Shawshank Redemption
```
{% /field %}

{% instructions ref="full_title" %}
Official title including subtitle if any (e.g., “The Lord of the Rings: The Fellowship
of the Ring”).
{% /instructions %}

{% field kind="number" id="year" label="Release Year" role="agent" required=true min=1888 max=2030 %}
```value
1994
```
{% /field %}

{% /group %}

## Sources

{% group id="primary_sources" title="Primary Sources" %}

{% field kind="url" id="imdb_url" label="IMDB URL" role="agent" required=true %}
```value
https://www.imdb.com/title/tt0111161/
```
{% /field %}

{% instructions ref="imdb_url" %}
Required. Primary source for ratings, cast, crew, technical details.
Format: https://www.imdb.com/title/tt0111161/
{% /instructions %}

{% field kind="url" id="rt_url" label="Rotten Tomatoes URL" role="agent" %}
```value
https://www.rottentomatoes.com/m/shawshank_redemption
```
{% /field %}

{% instructions ref="rt_url" %}
Direct link to the movie’s Rotten Tomatoes page.
{% /instructions %}

{% field kind="url" id="metacritic_url" label="Metacritic URL" role="agent" %}
```value
https://www.metacritic.com/movie/the-shawshank-redemption/
```
{% /field %}

{% instructions ref="metacritic_url" %}
Direct link to the movie’s Metacritic page.
{% /instructions %}

{% /group %}

{% group id="box_office_sources" title="Box Office Sources" %}

{% field kind="url" id="boxofficemojo_url" label="Box Office Mojo URL" role="agent" %}
```value
https://www.boxofficemojo.com/title/tt0111161/
```
{% /field %}

{% instructions ref="boxofficemojo_url" %}
Best source for budget, domestic/worldwide gross, opening weekend.
Format: https://www.boxofficemojo.com/title/tt0111161/
{% /instructions %}

{% field kind="url" id="the_numbers_url" label="The Numbers URL" role="agent" %}
```value
https://www.the-numbers.com/movie/Shawshank-Redemption-The
```
{% /field %}

{% instructions ref="the_numbers_url" %}
Alternative/supplementary box office data and profitability analysis.
{% /instructions %}

{% /group %}

{% group id="availability_sources" title="Availability Sources" %}

{% field kind="url" id="justwatch_url" label="JustWatch URL" role="agent" %}
```value
https://www.justwatch.com/us/movie/the-shawshank-redemption
```
{% /field %}

{% instructions ref="justwatch_url" %}
Best source for current streaming availability.
Use US region. Format: https://www.justwatch.com/us/movie/the-shawshank-redemption
{% /instructions %}

{% /group %}

{% group id="additional_sources" title="Additional Sources" %}

{% field kind="url" id="letterboxd_url" label="Letterboxd URL" role="agent" %}
```value
https://letterboxd.com/film/the-shawshank-redemption/
```
{% /field %}

{% instructions ref="letterboxd_url" %}
Cinephile community ratings.
Especially useful for art/indie/cult films.
{% /instructions %}

{% field kind="url" id="wikipedia_url" label="Wikipedia URL" role="agent" %}
```value
https://en.wikipedia.org/wiki/The_Shawshank_Redemption
```
{% /field %}

{% instructions ref="wikipedia_url" %}
For production history, cultural impact, comprehensive awards list.
{% /instructions %}

{% field kind="url" id="official_site_url" label="Official Website" role="agent" %}{% /field %}

{% instructions ref="official_site_url" %}
Studio or film’s official website, if still active.
{% /instructions %}

{% /group %}

## Basic Details

{% group id="basic_details" title="Basic Details" %}

{% field kind="string_list" id="directors" label="Director(s)" role="agent" required=true %}
```value
Frank Darabont
```
{% /field %}

{% instructions ref="directors" %}
One director per line.
Most films have one; some have two or more co-directors.
{% /instructions %}

{% field kind="number" id="runtime_minutes" label="Runtime (minutes)" role="agent" min=1 max=1000 %}
```value
142
```
{% /field %}

{% field kind="single_select" id="mpaa_rating" label="MPAA Rating" role="agent" %}

- [ ] G {% #g %}
- [ ] PG {% #pg %}
- [ ] PG-13 {% #pg_13 %}
- [x] R {% #r %}
- [ ] NC-17 {% #nc_17 %}
- [ ] NR/Unrated {% #nr %}

{% /field %}

{% field kind="multi_select" id="genres" label="Genres" role="agent" minSelections=1 maxSelections=5 %}

- [ ] Action {% #action %}
- [ ] Adventure {% #adventure %}
- [ ] Animation {% #animation %}
- [ ] Biography {% #biography %}
- [ ] Comedy {% #comedy %}
- [ ] Crime {% #crime %}
- [ ] Documentary {% #documentary %}
- [x] Drama {% #drama %}
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

{% /field %}

{% instructions ref="genres" %}
Select all applicable genres from IMDB (up to 5).
{% /instructions %}

{% field kind="string" id="original_language" label="Original Language" role="agent" %}
```value
English
```
{% /field %}

{% field kind="string_list" id="countries" label="Countries" role="agent" %}
```value
United States
```
{% /field %}

{% instructions ref="countries" %}
Production countries, one per line.
{% /instructions %}

{% /group %}

## Cast & Crew

{% group id="cast_crew" title="Cast & Crew" %}

{% field kind="table" id="lead_cast" label="Lead Cast" role="agent" minRows=1 maxRows=10 columnIds=["actor_name", "character_name"] columnTypes=["string", "string"] %}

| Actor Name | Character Name |
|------------|----------------|
| Tim Robbins | Andy Dufresne |
| Morgan Freeman | Ellis Boyd ‘Red’ Redding |
| Bob Gunton | Warden Samuel Norton |
| William Sadler | Heywood |
| Clancy Brown | Captain Byron Hadley |

{% /field %}

{% instructions ref="lead_cast" %}
Top-billed cast members with their character names.
Example: Leonardo DiCaprio | Dom Cobb
{% /instructions %}

{% field kind="string_list" id="writers" label="Writers" role="agent" %}
```value
Stephen King (short story)
Frank Darabont (screenplay)
```
{% /field %}

{% instructions ref="writers" %}
Screenplay and story credits.
Format: Name (credit type) Example: “Christopher Nolan (written by)”
{% /instructions %}

{% field kind="string" id="cinematographer" label="Cinematographer" role="agent" %}
```value
Roger Deakins
```
{% /field %}

{% field kind="string" id="composer" label="Composer" role="agent" %}
```value
Thomas Newman
```
{% /field %}

{% instructions ref="composer" %}
Film score composer (not soundtrack songs).
{% /instructions %}

{% field kind="string_list" id="producers" label="Producers" role="agent" maxItems=5 %}
```value
Niki Marvin (producer)
```
{% /field %}

{% instructions ref="producers" %}
Key producers (limit to main credited producers).
Format: Name (producer type) Example: “Emma Thomas (producer)”
{% /instructions %}

{% /group %}

## Ratings

{% group id="ratings" title="Ratings" %}

{% field kind="table" id="ratings_table" label="Ratings" role="agent" required=true columnIds=["source", "score", "votes"] columnTypes=["string", "number", "number"] minRows=0 maxRows=6 %}

| Source | Score | Votes |
|--------|-------|-------|
| IMDB | 9.3 | 2800000 |
| RT Critics | 91 | 89 |
| RT Audience | 98 | 1200000 |
| Metacritic | 82 | |
| Letterboxd | 4.5 | |

{% /field %}
{% instructions ref="ratings_table" %}
Fill in scores and vote/review counts from each source:
- IMDB: Rating (1.0-10.0 scale), vote count
- RT Critics: Tomatometer (0-100%), review count
- RT Audience: Audience Score (0-100%), rating count
- Metacritic: Metascore (0-100)
- Letterboxd: Rating (0.5-5.0 scale)
- CinemaScore: Grade (A+ to F), leave votes empty

{% /instructions %}

{% field kind="string" id="rt_consensus" label="Critics Consensus" role="agent" maxLength=500 %}
```value
The Shawshank Redemption is an uplifting, deeply satisfying prison drama with sensitive direction and fine performances.
```
{% /field %}
{% instructions ref="rt_consensus" %}
The official Rotten Tomatoes critics consensus statement, if available.
{% /instructions %}

{% /group %}

## Box Office

{% group id="box_office" title="Box Office" %}

{% field kind="number" id="budget_millions" label="Budget ($M)" role="agent" min=0 %}
```value
25
```
{% /field %}

{% instructions ref="budget_millions" %}
Production budget in millions USD. Example: 200 for $200M.
{% /instructions %}

{% field kind="number" id="box_office_domestic_millions" label="Domestic Gross ($M)" role="agent" min=0 %}
```value
58.3
```
{% /field %}

{% instructions ref="box_office_domestic_millions" %}
US/Canada theatrical gross in millions USD.
{% /instructions %}

{% field kind="number" id="box_office_worldwide_millions" label="Worldwide Gross ($M)" role="agent" min=0 %}
```value
73.3
```
{% /field %}

{% instructions ref="box_office_worldwide_millions" %}
Global theatrical gross in millions USD.
{% /instructions %}

{% field kind="number" id="opening_weekend_millions" label="Opening Weekend ($M)" role="agent" min=0 %}
```value
0.727
```
{% /field %}

{% instructions ref="opening_weekend_millions" %}
US opening weekend gross in millions USD.
{% /instructions %}

{% /group %}

## Technical Specifications

{% group id="technical_specs" title="Technical Specifications" %}

{% field kind="single_select" id="aspect_ratio" label="Aspect Ratio" role="agent" %}

- [ ] 1.33:1 (Academy) {% #ratio_133 %}
- [ ] 1.66:1 {% #ratio_166 %}
- [ ] 1.78:1 (16:9) {% #ratio_178 %}
- [x] 1.85:1 (Flat) {% #ratio_185 %}
- [ ] 2.00:1 (Univisium) {% #ratio_200 %}
- [ ] 2.20:1 (70mm) {% #ratio_220 %}
- [ ] 2.35:1 (Scope) {% #ratio_235 %}
- [ ] 2.39:1 (Scope) {% #ratio_239 %}
- [ ] 2.76:1 (Ultra Panavision) {% #ratio_276 %}
- [ ] 1.43:1 (IMAX) {% #ratio_143 %}
- [ ] 1.90:1 (IMAX Digital) {% #ratio_190 %}
- [ ] Variable {% #ratio_variable %}

{% /field %}

{% field kind="single_select" id="color_format" label="Color" role="agent" %}

- [x] Color {% #color %}
- [ ] Black & White {% #bw %}
- [ ] Mixed/Partial Color {% #mixed %}

{% /field %}

{% field kind="string" id="sound_mix" label="Sound Mix" role="agent" %}
```value
Dolby Digital
```
{% /field %}

{% instructions ref="sound_mix" %}
Primary sound format (e.g., “Dolby Atmos”, “DTS”, “Dolby Digital”).
{% /instructions %}

{% field kind="string" id="camera" label="Camera" role="agent" %}
```value
Arriflex 535
```
{% /field %}

{% instructions ref="camera" %}
Primary camera system used (e.g., “Arri Alexa 65”, “IMAX 15-perf”, “Panavision
Panaflex”).
{% /instructions %}

{% /group %}

## Streaming Availability

{% group id="streaming_availability" title="Streaming Availability (US)" %}

{% field kind="multi_select" id="streaming_subscription" label="Streaming (Subscription)" role="agent" %}

- [ ] Netflix {% #netflix %}
- [ ] Amazon Prime Video {% #prime %}
- [ ] Disney+ {% #disney %}
- [x] Max (HBO) {% #max %}
- [ ] Hulu {% #hulu %}
- [ ] Apple TV+ {% #apple %}
- [ ] Paramount+ {% #paramount %}
- [ ] Peacock {% #peacock %}
- [ ] MGM+ {% #mgm %}
- [ ] Criterion Channel {% #criterion %}
- [ ] MUBI {% #mubi %}
- [ ] Tubi (Free) {% #tubi %}
- [ ] Pluto TV (Free) {% #pluto %}

{% /field %}

{% instructions ref="streaming_subscription" %}
Select all platforms where this film is currently available to stream (subscription or
free). Check JustWatch for current availability.
{% /instructions %}

{% field kind="checkboxes" id="availability_flags" label="Other Availability" role="agent" checkboxMode="simple" %}

- [x] Available for digital rental {% #rental %}
- [x] Available for digital purchase {% #purchase %}
- [x] Physical media (Blu-ray/DVD) {% #physical %}
- [x] 4K UHD available {% #uhd_4k %}

{% /field %}

{% /group %}

## Content & Themes

{% group id="content_themes" title="Content & Themes" %}

{% field kind="checkboxes" id="content_warnings" label="Content Warnings" role="agent" checkboxMode="simple" %}

- [x] Intense violence {% #violence %}
- [ ] Gore/disturbing imagery {% #gore %}
- [x] Sexual content {% #sexual %}
- [ ] Nudity {% #nudity %}
- [x] Strong language {% #language %}
- [ ] Drug/alcohol use {% #drugs %}
- [ ] Frightening scenes {% #frightening %}
- [ ] Flashing/strobe effects {% #flashing %}

{% /field %}

{% instructions ref="content_warnings" %}
Check any content warnings that apply.
Use IMDB Parents Guide as reference.
{% /instructions %}

{% field kind="string_list" id="themes" label="Key Themes" role="agent" maxItems=5 %}
```value
Hope
Redemption
Friendship
Perseverance
Institutionalization
```
{% /field %}

{% instructions ref="themes" %}
Major themes explored in the film (e.g., “redemption”, “family”, “identity”, “war”).
{% /instructions %}

{% /group %}

## Summary & Legacy

{% group id="summary" title="Summary" %}

{% field kind="string" id="logline" label="One-Line Summary" role="agent" maxLength=300 %}
```value
A banker wrongly convicted of murder forms an unlikely friendship with a fellow inmate while quietly working on a decades-long plan for freedom.
```
{% /field %}

{% instructions ref="logline" %}
Brief plot summary in 1-2 sentences, no spoilers.
{% /instructions %}

{% field kind="table" id="notable_awards" label="Notable Awards" role="agent" columnIds=["award", "category", "year"] columnTypes=["string", "string", "year"] %}

| Award | Category | Year |
|-------|----------|------|
| Saturn Award | Best Action/Adventure/Thriller Film | 1995 |
| PGA Award | Motion Picture Producer of the Year | 1995 |

{% /field %}

{% instructions ref="notable_awards" %}
Major awards won. Example: Oscar | Best Picture | 1995
{% /instructions %}

{% field kind="table" id="notable_quotes" label="Notable Critic Quotes" role="agent" maxRows=3 columnIds=["quote", "critic", "publication"] columnTypes=["string", "string", "string"] %}

| Quote | Critic | Publication |
|-------|--------|-------------|
| A movie about time, patience and loyalty — not exciting qualities, perhaps, but they
grow on you during the subterranean progress of this story.
| Roger Ebert | Chicago Sun-Times |
| A beautifully crafted film that celebrates the triumph of the human spirit.
| James Berardinelli | ReelViews |

{% /field %}

{% instructions ref="notable_quotes" %}
2-3 memorable critic quotes that capture reception.
{% /instructions %}

{% /group %}

{% group id="cultural_legacy" title="Cultural Legacy" %}

{% field kind="string" id="cultural_impact" label="Cultural Impact" role="agent" maxLength=500 %}
```value
Despite modest box office performance, The Shawshank Redemption became one of the most beloved films of all time through home video and cable television, consistently ranking as the #1 film on IMDB's Top 250 list for over two decades.
```
{% /field %}

{% instructions ref="cultural_impact" %}
Brief description of the film’s cultural significance, influence, or legacy (1-3
sentences). Leave empty for recent releases without established legacy.
{% /instructions %}

{% field kind="string_list" id="similar_films" label="Similar Films" role="agent" maxItems=5 %}
```value
The Green Mile
Escape from Alcatraz
Cool Hand Luke
A Prophet
The Count of Monte Cristo
```
{% /field %}

{% instructions ref="similar_films" %}
Films with similar themes, style, or appeal.
One per line.
{% /instructions %}

{% /group %}

{% /form %}
