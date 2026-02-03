---
markform:
  spec: MF/0.1
  title: Movie Deep Research
  description: Comprehensive movie research form with ratings, box office, cast/crew,
    technical specs, streaming availability, and cultural analysis.
  run_mode: research
  harness:
    max_patches_per_turn: 15
    max_issues_per_turn: 5
  role_instructions:
    user: Enter the movie title and optionally the year for disambiguation.
    agent: >
      Conduct comprehensive research and fill in all available fields for the specified
      movie.


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
---

<!-- form id="movie_research_deep" title="Movie Deep Research" -->

<!-- description ref="movie_research_deep" -->
Comprehensive movie research covering ratings from multiple sources, box office
performance, full cast and crew, technical specifications, streaming availability, and
cultural impact analysis.
<!-- /description -->

<!-- group id="movie_input" title="Movie Identification" -->

<!-- field kind="string" id="movie" role="user" label="Movie" maxLength=300 minLength=1 required=true --><!-- /field -->

<!-- instructions ref="movie" -->
Enter the movie title (add any details to help identify, like “Barbie 2023” or “the
Batman movie with Robert Pattinson”).
<!-- /instructions -->

<!-- /group -->

<!-- group id="title_identification" title="Title Identification" -->

<!-- field kind="string" id="full_title" label="Full Title" required=true --><!-- /field -->

<!-- instructions ref="full_title" -->
Official title including subtitle if any (e.g., “The Lord of the Rings: The Fellowship
of the Ring”).
<!-- /instructions -->

<!-- field kind="number" id="year" label="Release Year" max=2030 min=1888 required=true --><!-- /field -->

<!-- /group -->

<!-- group id="primary_sources" title="Primary Sources" -->

<!-- field kind="url" id="imdb_url" label="IMDB URL" required=true --><!-- /field -->

<!-- instructions ref="imdb_url" -->
Required. Primary source for ratings, cast, crew, technical details.
Format: https://www.imdb.com/title/tt0111161/
<!-- /instructions -->

<!-- field kind="url" id="rt_url" label="Rotten Tomatoes URL" --><!-- /field -->

<!-- instructions ref="rt_url" -->
Direct link to the movie’s Rotten Tomatoes page.
<!-- /instructions -->

<!-- field kind="url" id="metacritic_url" label="Metacritic URL" --><!-- /field -->

<!-- instructions ref="metacritic_url" -->
Direct link to the movie’s Metacritic page.
<!-- /instructions -->

<!-- /group -->

<!-- group id="box_office_sources" title="Box Office Sources" -->

<!-- field kind="url" id="boxofficemojo_url" label="Box Office Mojo URL" --><!-- /field -->

<!-- instructions ref="boxofficemojo_url" -->
Best source for budget, domestic/worldwide gross, opening weekend.
Format: https://www.boxofficemojo.com/title/tt0111161/
<!-- /instructions -->

<!-- field kind="url" id="the_numbers_url" label="The Numbers URL" --><!-- /field -->

<!-- instructions ref="the_numbers_url" -->
Alternative/supplementary box office data and profitability analysis.
<!-- /instructions -->

<!-- /group -->

<!-- group id="availability_sources" title="Availability Sources" -->

<!-- field kind="url" id="justwatch_url" label="JustWatch URL" --><!-- /field -->

<!-- instructions ref="justwatch_url" -->
Best source for current streaming availability.
Use US region. Format: https://www.justwatch.com/us/movie/the-shawshank-redemption
<!-- /instructions -->

<!-- /group -->

<!-- group id="additional_sources" title="Additional Sources" -->

<!-- field kind="url" id="letterboxd_url" label="Letterboxd URL" --><!-- /field -->

<!-- instructions ref="letterboxd_url" -->
Cinephile community ratings.
Especially useful for art/indie/cult films.
<!-- /instructions -->

<!-- field kind="url" id="wikipedia_url" label="Wikipedia URL" --><!-- /field -->

<!-- instructions ref="wikipedia_url" -->
For production history, cultural impact, comprehensive awards list.
<!-- /instructions -->

<!-- field kind="url" id="official_site_url" label="Official Website" --><!-- /field -->

<!-- instructions ref="official_site_url" -->
Studio or film’s official website, if still active.
<!-- /instructions -->

<!-- /group -->

<!-- group id="basic_details" title="Basic Details" -->

<!-- field kind="string_list" id="directors" label="Director(s)" required=true --><!-- /field -->

<!-- instructions ref="directors" -->
One director per line.
Most films have one; some have two or more co-directors.
<!-- /instructions -->

<!-- field kind="number" id="runtime_minutes" label="Runtime (minutes)" max=1000 min=1 --><!-- /field -->

<!-- field kind="single_select" id="mpaa_rating" label="MPAA Rating" -->
- [ ] G <!-- #g -->
- [ ] PG <!-- #pg -->
- [ ] PG-13 <!-- #pg_13 -->
- [ ] R <!-- #r -->
- [ ] NC-17 <!-- #nc_17 -->
- [ ] NR/Unrated <!-- #nr -->
<!-- /field -->

<!-- field kind="multi_select" id="genres" label="Genres" maxSelections=5 minSelections=1 -->
- [ ] Action <!-- #action -->
- [ ] Adventure <!-- #adventure -->
- [ ] Animation <!-- #animation -->
- [ ] Biography <!-- #biography -->
- [ ] Comedy <!-- #comedy -->
- [ ] Crime <!-- #crime -->
- [ ] Documentary <!-- #documentary -->
- [ ] Drama <!-- #drama -->
- [ ] Family <!-- #family -->
- [ ] Fantasy <!-- #fantasy -->
- [ ] Film-Noir <!-- #film_noir -->
- [ ] History <!-- #history -->
- [ ] Horror <!-- #horror -->
- [ ] Music <!-- #music -->
- [ ] Musical <!-- #musical -->
- [ ] Mystery <!-- #mystery -->
- [ ] Romance <!-- #romance -->
- [ ] Sci-Fi <!-- #sci_fi -->
- [ ] Sport <!-- #sport -->
- [ ] Thriller <!-- #thriller -->
- [ ] War <!-- #war -->
- [ ] Western <!-- #western -->
<!-- /field -->

<!-- instructions ref="genres" -->
Select all applicable genres from IMDB (up to 5).
<!-- /instructions -->

<!-- field kind="string" id="original_language" label="Original Language" --><!-- /field -->

<!-- field kind="string_list" id="countries" label="Countries" --><!-- /field -->

<!-- instructions ref="countries" -->
Production countries, one per line.
<!-- /instructions -->

<!-- /group -->

<!-- group id="cast_crew" title="Cast & Crew" -->

<!-- field kind="table" id="lead_cast" columnIds=["actor_name", "character_name"] columnLabels=["Actor Name", "Character Name"] columnTypes=["string", "string"] label="Lead Cast" maxRows=10 minRows=1 --><!-- /field -->

<!-- instructions ref="lead_cast" -->
Top-billed cast members with their character names.
Example: Leonardo DiCaprio | Dom Cobb
<!-- /instructions -->

<!-- field kind="string_list" id="writers" label="Writers" --><!-- /field -->

<!-- instructions ref="writers" -->
Screenplay and story credits.
Format: Name (credit type) Example: “Christopher Nolan (written by)”
<!-- /instructions -->

<!-- field kind="string" id="cinematographer" label="Cinematographer" --><!-- /field -->

<!-- field kind="string" id="composer" label="Composer" --><!-- /field -->

<!-- instructions ref="composer" -->
Film score composer (not soundtrack songs).
<!-- /instructions -->

<!-- field kind="string_list" id="producers" label="Producers" maxItems=5 --><!-- /field -->

<!-- instructions ref="producers" -->
Key producers (limit to main credited producers).
Format: Name (producer type) Example: “Emma Thomas (producer)”
<!-- /instructions -->

<!-- /group -->

<!-- group id="ratings" title="Ratings" -->

<!-- field kind="table" id="ratings_table" columnIds=["source", "score", "votes"] columnLabels=["Source", "Score", "Votes"] columnTypes=["string", "number", "number"] label="Ratings" maxRows=6 minRows=0 required=true --><!-- /field -->

<!-- instructions ref="ratings_table" -->
Fill in scores and vote/review counts from each source:IMDB: Rating (1.0-10.0 scale), vote countRT Critics: Tomatometer (0-100%), review countRT Audience: Audience Score (0-100%), rating countMetacritic: Metascore (0-100)Letterboxd: Rating (0.5-5.0 scale)CinemaScore: Grade (A+ to F), leave votes empty
<!-- /instructions -->

<!-- field kind="string" id="rt_consensus" label="Critics Consensus" maxLength=500 --><!-- /field -->

<!-- instructions ref="rt_consensus" -->
The official Rotten Tomatoes critics consensus statement, if available.
<!-- /instructions -->

<!-- /group -->

<!-- group id="box_office" title="Box Office" -->

<!-- field kind="number" id="budget_millions" label="Budget ($M)" min=0 --><!-- /field -->

<!-- instructions ref="budget_millions" -->
Production budget in millions USD. Example: 200 for $200M.
<!-- /instructions -->

<!-- field kind="number" id="box_office_domestic_millions" label="Domestic Gross ($M)" min=0 --><!-- /field -->

<!-- instructions ref="box_office_domestic_millions" -->
US/Canada theatrical gross in millions USD.
<!-- /instructions -->

<!-- field kind="number" id="box_office_worldwide_millions" label="Worldwide Gross ($M)" min=0 --><!-- /field -->

<!-- instructions ref="box_office_worldwide_millions" -->
Global theatrical gross in millions USD.
<!-- /instructions -->

<!-- field kind="number" id="opening_weekend_millions" label="Opening Weekend ($M)" min=0 --><!-- /field -->

<!-- instructions ref="opening_weekend_millions" -->
US opening weekend gross in millions USD.
<!-- /instructions -->

<!-- /group -->

<!-- group id="technical_specs" title="Technical Specifications" -->

<!-- field kind="single_select" id="aspect_ratio" label="Aspect Ratio" -->
- [ ] 1.33:1 (Academy) <!-- #ratio_133 -->
- [ ] 1.66:1 <!-- #ratio_166 -->
- [ ] 1.78:1 (16:9) <!-- #ratio_178 -->
- [ ] 1.85:1 (Flat) <!-- #ratio_185 -->
- [ ] 2.00:1 (Univisium) <!-- #ratio_200 -->
- [ ] 2.20:1 (70mm) <!-- #ratio_220 -->
- [ ] 2.35:1 (Scope) <!-- #ratio_235 -->
- [ ] 2.39:1 (Scope) <!-- #ratio_239 -->
- [ ] 2.76:1 (Ultra Panavision) <!-- #ratio_276 -->
- [ ] 1.43:1 (IMAX) <!-- #ratio_143 -->
- [ ] 1.90:1 (IMAX Digital) <!-- #ratio_190 -->
- [ ] Variable <!-- #ratio_variable -->
<!-- /field -->

<!-- field kind="single_select" id="color_format" label="Color" -->
- [ ] Color <!-- #color -->
- [ ] Black & White <!-- #bw -->
- [ ] Mixed/Partial Color <!-- #mixed -->
<!-- /field -->

<!-- field kind="string" id="sound_mix" label="Sound Mix" --><!-- /field -->

<!-- instructions ref="sound_mix" -->
Primary sound format (e.g., “Dolby Atmos”, “DTS”, “Dolby Digital”).
<!-- /instructions -->

<!-- field kind="string" id="camera" label="Camera" --><!-- /field -->

<!-- instructions ref="camera" -->
Primary camera system used (e.g., “Arri Alexa 65”, “IMAX 15-perf”, “Panavision
Panaflex”).
<!-- /instructions -->

<!-- /group -->

<!-- group id="streaming_availability" title="Streaming Availability (US)" -->

<!-- field kind="multi_select" id="streaming_subscription" label="Streaming (Subscription)" -->
- [ ] Netflix <!-- #netflix -->
- [ ] Amazon Prime Video <!-- #prime -->
- [ ] Disney+ <!-- #disney -->
- [ ] Max (HBO) <!-- #max -->
- [ ] Hulu <!-- #hulu -->
- [ ] Apple TV+ <!-- #apple -->
- [ ] Paramount+ <!-- #paramount -->
- [ ] Peacock <!-- #peacock -->
- [ ] MGM+ <!-- #mgm -->
- [ ] Criterion Channel <!-- #criterion -->
- [ ] MUBI <!-- #mubi -->
- [ ] Tubi (Free) <!-- #tubi -->
- [ ] Pluto TV (Free) <!-- #pluto -->
<!-- /field -->

<!-- instructions ref="streaming_subscription" -->
Select all platforms where this film is currently available to stream (subscription or
free). Check JustWatch for current availability.
<!-- /instructions -->

<!-- field kind="checkboxes" id="availability_flags" checkboxMode="simple" label="Other Availability" -->
- [ ] Available for digital rental <!-- #rental -->
- [ ] Available for digital purchase <!-- #purchase -->
- [ ] Physical media (Blu-ray/DVD) <!-- #physical -->
- [ ] 4K UHD available <!-- #uhd_4k -->
<!-- /field -->

<!-- /group -->

<!-- group id="content_themes" title="Content & Themes" -->

<!-- field kind="checkboxes" id="content_warnings" checkboxMode="simple" label="Content Warnings" -->
- [ ] Intense violence <!-- #violence -->
- [ ] Gore/disturbing imagery <!-- #gore -->
- [ ] Sexual content <!-- #sexual -->
- [ ] Nudity <!-- #nudity -->
- [ ] Strong language <!-- #language -->
- [ ] Drug/alcohol use <!-- #drugs -->
- [ ] Frightening scenes <!-- #frightening -->
- [ ] Flashing/strobe effects <!-- #flashing -->
<!-- /field -->

<!-- instructions ref="content_warnings" -->
Check any content warnings that apply.
Use IMDB Parents Guide as reference.
<!-- /instructions -->

<!-- field kind="string_list" id="themes" label="Key Themes" maxItems=5 --><!-- /field -->

<!-- instructions ref="themes" -->
Major themes explored in the film (e.g., “redemption”, “family”, “identity”, “war”).
<!-- /instructions -->

<!-- /group -->

<!-- group id="summary" title="Summary" -->

<!-- field kind="string" id="logline" label="One-Line Summary" maxLength=300 --><!-- /field -->

<!-- instructions ref="logline" -->
Brief plot summary in 1-2 sentences, no spoilers.
<!-- /instructions -->

<!-- field kind="table" id="notable_awards" columnIds=["award", "category", "year"] columnLabels=["Award", "Category", "Year"] columnTypes=["string", "string", "year"] label="Notable Awards" --><!-- /field -->

<!-- instructions ref="notable_awards" -->
Major awards won. Example: Oscar | Best Picture | 1995
<!-- /instructions -->

<!-- field kind="table" id="notable_quotes" columnIds=["quote", "critic", "publication"] columnLabels=["Quote", "Critic", "Publication"] columnTypes=["string", "string", "string"] label="Notable Critic Quotes" maxRows=3 --><!-- /field -->

<!-- instructions ref="notable_quotes" -->
2-3 memorable critic quotes that capture reception.
<!-- /instructions -->

<!-- /group -->

<!-- group id="cultural_legacy" title="Cultural Legacy" -->

<!-- field kind="string" id="cultural_impact" label="Cultural Impact" maxLength=500 --><!-- /field -->

<!-- instructions ref="cultural_impact" -->
Brief description of the film’s cultural significance, influence, or legacy (1-3
sentences). Leave empty for recent releases without established legacy.
<!-- /instructions -->

<!-- field kind="string_list" id="similar_films" label="Similar Films" maxItems=5 --><!-- /field -->

<!-- instructions ref="similar_films" -->
Films with similar themes, style, or appeal.
One per line.
<!-- /instructions -->

<!-- /group -->

<!-- /form -->



