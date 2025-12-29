---
markform:
  spec: MF/0.1
  title: Celebrity Deep Research
  description: Comprehensive celebrity intelligence covering biography, career, relationships, controversies, social media, and hard-to-find details.
  roles:
    - user
    - agent
  role_instructions:
    user: "Enter the celebrity's name and any disambiguation context (profession, era, etc.)."
    agent: |
      Research and fill in all fields for the specified celebrity or movie star.
      Guidelines:
      1. CORE SOURCES (always check first):
         - Wikipedia for biography, career, and verified facts
         - IMDb for complete filmography, trivia, and quotes
         - Rotten Tomatoes for critical reception and career trajectory
      2. CROSS-REFERENCE EVERYTHING - Use 3+ sources for dates, relationships, net worth
      3. USE TABLES for records - Follow the specified column format for each field
      4. SOCIAL MEDIA - Search each platform directly for verified accounts
      5. DISTINGUISH SPECULATION from verified facts - Note tabloid sources as such
      6. LEAVE EMPTY rather than guess - Don't fabricate or infer missing data
      7. INCLUDE URLS - Every claim should have a source URL when possible
      8. NOTE RECENCY - Celebrity data changes rapidly; note when info was last verified
      9. "JUICY" DETAILS - Look beyond Wikipedia: court records, NNDB, political donations, fan forums often have interesting details mainstream sources miss
      10. DECEASED CELEBRITIES - Check Find A Grave, obituaries, memorial sites
  harness_config:
    max_issues_per_turn: 5
    max_patches_per_turn: 10
---

{% form id="celebrity_deep_research" title="Celebrity Deep Research" %}

{% description ref="celebrity_deep_research" %}
A comprehensive research form for gathering intelligence on celebrities, movie stars, and entertainment figures. Covers biographical data, career history, relationships, controversies, social media presence, and hard-to-find details from specialized sources.
{% /description %}

{% documentation ref="celebrity_deep_research" %}
**Target subjects:** Actors, musicians, directors, TV personalities, social media influencers, historical entertainment figures.

**Research approach:**
1. Start with Wikipedia + IMDb for verified foundation
2. Layer in specialized databases (Rotten Tomatoes, TMDb, AllMovie)
3. Add social/gossip sources for current details
4. Mine niche sources for unique insights (NNDB, court records, fan wikis)
5. Cross-reference and note conflicting information

**Table format convention:**
Many fields request tables. Use markdown table format:
| Column1 | Column2 | Column3 |
|---------|---------|---------|
| data    | data    | data    |

**Source priority (reliability ranking):**
1. Official sources (studio bios, agency sites)
2. Wikipedia (usually well-sourced)
3. IMDb/TMDb (comprehensive but user-edited)
4. Trade publications (Variety, THR, Deadline)
5. Tabloids (TMZ, Page Six) - note as "tabloid report"
6. Fan sites/forums - note as "fan community report"
{% /documentation %}

{% field-group id="user_input" title="Subject Identification" %}

{% field kind="string" id="celebrity_name" label="Celebrity Name" role="user" required=true minLength=2 maxLength=200 %}{% /field %}

{% instructions ref="celebrity_name" %}
Enter the full professional name (e.g., "Margot Robbie", "Leonardo DiCaprio", "Timothée Chalamet").
{% /instructions %}

{% field kind="string" id="disambiguation" label="Disambiguation Context" role="user" maxLength=500 %}{% /field %}

{% instructions ref="disambiguation" %}
Optional but helpful for common names:
- Era: "1950s Hollywood actress" vs "current Netflix star"
- Profession: "the singer, not the actress"
- Known for: "from The Office" or "married to Ben Affleck"
- Birth year or nationality if known
{% /instructions %}

{% /field-group %}

{% field-group id="core_biography" title="Core Biographical Data" %}

{% description ref="core_biography" %}
Foundational biographical information. Primary source: Wikipedia biography page.
Secondary sources: IMDb bio, official studio bios, agency websites.
{% /description %}

{% field kind="string" id="full_legal_name" label="Full Legal Name" %}{% /field %}

{% instructions ref="full_legal_name" %}
Birth name if different from stage name (e.g., "Stefani Joanne Angelina Germanotta" for Lady Gaga).
Source: Wikipedia infobox, birth certificate records if public.
{% /instructions %}

{% field kind="string" id="stage_name" label="Stage/Professional Name" required=true %}{% /field %}

{% field kind="string" id="birth_date" label="Birth Date" pattern="^\\d{4}-\\d{2}-\\d{2}$" %}{% /field %}

{% instructions ref="birth_date" %}
Format: YYYY-MM-DD (e.g., 1990-07-02).
Sources: Wikipedia, IMDb bio, Famous Birthdays.
Note: Some celebrities obscure their birth year; note if disputed.
{% /instructions %}

{% field kind="string" id="birth_place" label="Birth Place" %}{% /field %}

{% instructions ref="birth_place" %}
Format: City, State/Province, Country.
Source: Wikipedia, IMDb.
{% /instructions %}

{% field kind="string" id="nationality" label="Nationality/Citizenship" %}{% /field %}

{% instructions ref="nationality" %}
List all known citizenships (some celebrities hold multiple).
Source: Wikipedia, press interviews.
{% /instructions %}

{% field kind="string" id="height" label="Height" %}{% /field %}

{% instructions ref="height" %}
Format: X'Y" (X cm) - e.g., 5'7" (170 cm).
Source: IMDb, CelebrityHeights.com (surprisingly accurate), Google Knowledge Panel.
Note: Heights are often disputed/inflated.
{% /instructions %}

{% field kind="string" id="death_info" label="Death Information (if applicable)" %}{% /field %}

{% instructions ref="death_info" %}
Format: YYYY-MM-DD | Location | Cause | Age at death
Example: "2022-01-15 | Los Angeles, CA | Natural causes | 99"
Sources: Wikipedia, obituaries, Find A Grave.
Leave empty if person is living.
{% /instructions %}

{% field kind="string" id="resting_place" label="Burial/Resting Place" %}{% /field %}

{% instructions ref="resting_place" %}
For deceased: Cemetery name, location.
Source: Find A Grave (findagrave.com), Wikipedia.
{% /instructions %}

{% field kind="string_list" id="core_biography_sources" label="Core Bio Sources" %}{% /field %}

{% instructions ref="core_biography_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="personal_details" title="Personal Details & Background" %}

{% description ref="personal_details" %}
Personal background often reveals interesting context.
Sources: NNDB.com (excellent for religion/politics/causes), Wikipedia Personal Life section, in-depth magazine profiles.
{% /description %}

{% field kind="string" id="ethnicity_ancestry" label="Ethnicity/Ancestry" %}{% /field %}

{% instructions ref="ethnicity_ancestry" %}
Ethnic background and known ancestry.
Sources: Wikipedia, celebrity interviews, Ancestry.com findings if public, NNDB.
Handle sensitively; only include what the celebrity has publicly discussed.
{% /instructions %}

{% field kind="string" id="religion" label="Religion/Spiritual Beliefs" %}{% /field %}

{% instructions ref="religion" %}
Religious upbringing and current beliefs if publicly stated.
Source: NNDB.com (tracks this specifically), Wikipedia, magazine interviews.
Example: "Raised Catholic, currently practices Kabbalah"
{% /instructions %}

{% field kind="string" id="political_affiliation" label="Political Affiliation/Views" %}{% /field %}

{% instructions ref="political_affiliation" %}
Known political views, party affiliation, endorsements.
Sources: 
- NNDB.com (categorizes political leanings)
- OpenSecrets.org / FEC filings (actual donation records)
- Wikipedia, press statements, social media posts
Example: "Democrat; donated $50K to Obama 2012 per FEC; publicly endorsed Biden 2020"
{% /instructions %}

{% field kind="table" id="causes_activism" label="Causes & Activism"
   columnIds=["cause", "role_involvement", "source"]
   columnTypes=["string", "string", "string"] %}
| Cause | Role/Involvement | Source |
|-------|------------------|--------|
{% /field %}

{% instructions ref="causes_activism" %}
Example: Climate Change | Founded Earth Alliance with DiCaprio | earthalliance.org
Sources: NNDB.com, Charity Navigator (for their foundations), Wikipedia, press.
{% /instructions %}

{% field kind="table" id="education" label="Education History"
   columnIds=["institution", "degree_program", "years", "notes"]
   columnTypes=["string", "string", "string", "string"] %}
| Institution | Degree/Program | Years | Notes |
|-------------|----------------|-------|-------|
{% /field %}

{% instructions ref="education" %}
Example: Yale University | Drama (incomplete) | 2000-2002 | Left to pursue acting
Sources: Wikipedia, LinkedIn (if they have one), university alumni lists, IMDb bio.
{% /instructions %}

{% field kind="string_list" id="personal_details_sources" label="Personal Details Sources" %}{% /field %}

{% instructions ref="personal_details_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="family_relationships" title="Family & Relationships" %}

{% description ref="family_relationships" %}
Relationship history is a core area of celebrity coverage.
Sources: Wikipedia, WhosDatedWho.com, tabloids (note if tabloid-sourced), court records for divorces.
{% /description %}

{% field kind="string" id="parents" label="Parents" %}{% /field %}

{% instructions ref="parents" %}
Format: Father: Name (occupation) | Mother: Name (occupation)
Note if parents were also in entertainment industry.
Sources: Wikipedia, IMDb bio.
{% /instructions %}

{% field kind="table" id="siblings" label="Siblings"
   columnIds=["name", "relationship", "notable_info"]
   columnTypes=["string", "string", "string"] %}
| Name | Relationship | Notable Info |
|------|--------------|--------------|
{% /field %}

{% instructions ref="siblings" %}
Example: Jake Gyllenhaal | Brother | Actor, Oscar nominee
{% /instructions %}

{% field kind="table" id="marriages" label="Marriage History"
   columnIds=["spouse_name", "wedding_date", "divorce_date", "duration", "source"]
   columnTypes=["string", "date", "string", "string", "string"] %}
| Spouse Name | Wedding Date | Divorce Date | Duration | Source |
|-------------|--------------|--------------|----------|--------|
{% /field %}

{% instructions ref="marriages" %}
Chronological order. Divorce Date should be date or "present".
Example: Brad Pitt | 2000-07-29 | 2005-01-07 | 4.5 years | Court records
Sources: Wikipedia, WhosDatedWho, court records for divorces.
{% /instructions %}

{% field kind="table" id="children" label="Children"
   columnIds=["name", "birth_year", "other_parent", "notes"]
   columnTypes=["string", "year", "string", "string"] %}
| Name | Birth Year | Other Parent | Notes |
|------|------------|--------------|-------|
{% /field %}

{% instructions ref="children" %}
Example: Shiloh Jolie-Pitt | 2006 | Brad Pitt | Biological child
Note: Some celebrities keep children very private; respect when info is intentionally hidden.
{% /instructions %}

{% field kind="table" id="notable_relationships" label="Notable Dating History"
   columnIds=["partner_name", "dates", "reliability"]
   columnTypes=["string", "string", "string"] %}
| Partner Name | Dates | Reliability |
|--------------|-------|-------------|
{% /field %}

{% instructions ref="notable_relationships" %}
Significant relationships (not marriages), most recent first.
Example: Taylor Swift | 2016-2017 | Confirmed via paparazzi/social media
Sources: WhosDatedWho.com, tabloids (note reliability), press confirmations.
Note if "rumored only" vs "confirmed."
{% /instructions %}

{% field kind="string_list" id="family_relationships_sources" label="Family & Relationships Sources" %}{% /field %}

{% instructions ref="family_relationships_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="filmography_career" title="Filmography & Career" %}

{% description ref="filmography_career" %}
Comprehensive career history. Primary source: IMDb (imdb.com/name/).
Secondary: TMDb (themoviedb.org), Rotten Tomatoes, AllMovie.
For TV: also check TV Guide archives.
{% /description %}

{% field kind="string" id="primary_profession" label="Primary Profession(s)" required=true %}{% /field %}

{% instructions ref="primary_profession" %}
Main profession(s) in entertainment.
Example: "Actor, Producer, Director" or "Singer, Actress, Dancer"
Source: IMDb, Wikipedia lead paragraph.
{% /instructions %}

{% field kind="string" id="career_start" label="Career Start Year" pattern="^\\d{4}$" %}{% /field %}

{% instructions ref="career_start" %}
Year of first professional credit.
Source: IMDb earliest credit.
{% /instructions %}

{% field kind="string" id="breakthrough_role" label="Breakthrough Role" %}{% /field %}

{% instructions ref="breakthrough_role" %}
Format: "Project Title" (Year) as Character Name
Example: "Titanic (1997) as Jack Dawson"
Source: Wikipedia, IMDb, press retrospectives.
{% /instructions %}

{% field kind="string" id="notable_films_table" label="Notable Film Credits (Table)" maxLength=5000 %}{% /field %}

{% instructions ref="notable_films_table" %}
Top 10-15 most significant film roles. Use markdown table:

| Year | Title | Role | RT Score | Box Office | Notes |
|------|-------|------|----------|------------|-------|
| 2023 | Barbie | Barbie | 88% | $1.4B | Highest-grossing film of 2023 |

Columns:
- Year: Release year
- Title: Film title
- Role: Character name
- RT Score: Rotten Tomatoes critic score (or N/A)
- Box Office: Worldwide gross (from Box Office Mojo)
- Notes: Awards, significance, critical reception

Sources: IMDb filmography, Rotten Tomatoes, Box Office Mojo.
{% /instructions %}

{% field kind="string" id="notable_tv_table" label="Notable TV Credits (Table)" maxLength=5000 %}{% /field %}

{% instructions ref="notable_tv_table" %}
Significant TV appearances. Use markdown table:

| Years | Series | Role | Episodes | Notes |
|-------|--------|------|----------|-------|
| 2019-2023 | Euphoria | Rue | 18 | Lead role, Emmy winner |

Sources: IMDb, TV Guide archives.
{% /instructions %}

{% field kind="string" id="upcoming_projects" label="Upcoming/In Production Projects" maxLength=1000 %}{% /field %}

{% instructions ref="upcoming_projects" %}
Announced future projects.
Sources: IMDb "In Development", Variety/THR/Deadline announcements, Production Weekly.
Note status: Filming, Post-production, Announced.
{% /instructions %}

{% field kind="string" id="box_office_stats" label="Career Box Office Statistics" %}{% /field %}

{% instructions ref="box_office_stats" %}
Format: Total Gross | # Films | Average | Highest | Source
Example: "$10.2B total | 35 films | $291M avg | Barbie ($1.4B) | Box Office Mojo"
Source: Box Office Mojo actor page, The Numbers.
{% /instructions %}

{% field kind="string_list" id="filmography_career_sources" label="Filmography Sources" %}{% /field %}

{% instructions ref="filmography_career_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="critical_reception" title="Critical Reception & Ratings" %}

{% description ref="critical_reception" %}
Aggregate critic and audience scores.
Sources: Rotten Tomatoes career page, Metacritic, Letterboxd (for film community sentiment).
{% /description %}

{% field kind="string" id="rt_career_stats" label="Rotten Tomatoes Career Stats" %}{% /field %}

{% instructions ref="rt_career_stats" %}
Format: Avg Tomatometer | # Fresh films | # Rotten films | Notable scores
Example: "68% average | 25 Fresh | 12 Rotten | Best: Lady Bird (99%), Worst: Movie 43 (4%)"
Source: rottentomatoes.com/celebrity/
{% /instructions %}

{% field kind="string" id="letterboxd_rating" label="Letterboxd Average Rating" %}{% /field %}

{% instructions ref="letterboxd_rating" %}
Average rating across their filmography on Letterboxd.
Format: X.X/5 | Most-logged film | Highest-rated film
Source: letterboxd.com (search actor name).
{% /instructions %}

{% field kind="string_list" id="critical_reception_sources" label="Critical Reception Sources" %}{% /field %}

{% instructions ref="critical_reception_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="awards_recognition" title="Awards & Recognition" %}

{% description ref="awards_recognition" %}
Complete awards history including nominations and wins.
Sources: IMDb Awards page, Oscars.org, Emmy database, Wikipedia filmography tables.
{% /description %}

{% field kind="string" id="major_awards_summary" label="Major Awards Summary" %}{% /field %}

{% instructions ref="major_awards_summary" %}
Quick summary of biggest wins.
Format: # Oscar wins/noms | # Emmy wins/noms | # Grammy wins/noms | # Golden Globe wins/noms | Other notable
Example: "3 Oscar noms (1 win) | 0 Emmy | 0 Grammy | 4 GG noms (2 wins) | SAG Ensemble winner"
{% /instructions %}

{% field kind="string" id="oscar_history" label="Academy Award History (Table)" maxLength=3000 %}{% /field %}

{% instructions ref="oscar_history" %}
Use markdown table:

| Year | Category | Film | Result |
|------|----------|------|--------|
| 2024 | Best Actress | Poor Things | Won |
| 2019 | Best Actress | The Favourite | Nominated |

Source: Oscars.org, IMDb Awards.
{% /instructions %}

{% field kind="string" id="other_major_awards" label="Other Major Awards (Table)" maxLength=3000 %}{% /field %}

{% instructions ref="other_major_awards" %}
Emmy, Grammy, Tony, Golden Globe, SAG, BAFTA, Cannes, etc.
Use markdown table:

| Year | Award | Category | Project | Result |
|------|-------|----------|---------|--------|
| 2023 | Emmy | Outstanding Lead Actress | The White Lotus | Won |

Sources: Respective award databases, IMDb Awards.
{% /instructions %}

{% field kind="string_list" id="notable_honors" label="Other Honors & Recognition" %}{% /field %}

{% instructions ref="notable_honors" %}
Non-award honors, one per line.
Examples: Hollywood Walk of Fame star, Kennedy Center Honor, Presidential Medal, Honorary degrees, etc.
{% /instructions %}

{% field kind="string_list" id="awards_recognition_sources" label="Awards Sources" %}{% /field %}

{% instructions ref="awards_recognition_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="financial_business" title="Financial & Business Ventures" %}

{% description ref="financial_business" %}
Net worth, salary data, and business ventures.
Sources: CelebrityNetWorth (estimates only), Forbes Celebrity 100, SEC filings, Variety salary reports.
Note: Net worth figures are estimates and often disputed.
{% /description %}

{% field kind="string" id="estimated_net_worth" label="Estimated Net Worth" %}{% /field %}

{% instructions ref="estimated_net_worth" %}
Format: $XXM-$XXM (Source, Date)
Example: "$400M-$450M (CelebrityNetWorth, 2024; Forbes estimates $380M)"
Note: Always include source and date; these estimates vary wildly.
{% /instructions %}

{% field kind="table" id="known_salaries" label="Known Salary/Earnings"
   columnIds=["project", "amount", "year", "source"]
   columnTypes=["string", "string", "year", "string"] %}
| Project | Amount | Year | Source |
|---------|--------|------|--------|
{% /field %}

{% instructions ref="known_salaries" %}
Reported salaries per project.
Example: Barbie | $12.5M + $50M backend | 2023 | Variety
Sources: Variety, THR salary reports, leaked studio documents.
{% /instructions %}

{% field kind="string" id="forbes_rankings" label="Forbes Celebrity 100 History" %}{% /field %}

{% instructions ref="forbes_rankings" %}
Historical Forbes Celebrity 100 rankings if available.
Format: Year: Rank, Earnings
Example: "2023: #8, $59M | 2022: #12, $42M"
Source: Forbes.com Celebrity 100 lists.
{% /instructions %}

{% field kind="table" id="business_ventures" label="Business Ventures & Companies"
   columnIds=["company", "role", "industry", "status", "source"]
   columnTypes=["string", "string", "string", "string", "string"] %}
| Company | Role | Industry | Status | Source |
|---------|------|----------|--------|--------|
{% /field %}

{% instructions ref="business_ventures" %}
Companies owned, founded, or invested in.
Example: Honest Company | Co-founder | Consumer goods | IPO 2021, now private | SEC filings
Sources: Forbes, SEC EDGAR (for public companies), Crunchbase, press releases.
{% /instructions %}

{% field kind="table" id="endorsements" label="Major Endorsements & Sponsorships"
   columnIds=["brand", "type", "value", "years", "source"]
   columnTypes=["string", "string", "string", "string", "string"] %}
| Brand | Type | Value | Years | Source |
|-------|------|-------|-------|--------|
{% /field %}

{% instructions ref="endorsements" %}
Brand deals and endorsements.
Example: Chanel No. 5 | Global Ambassador | $5M/year | 2020-present | Variety
Sources: Press releases, Variety/THR business coverage, social media sponsored posts.
{% /instructions %}

{% field kind="table" id="real_estate" label="Known Real Estate Holdings"
   columnIds=["property", "location", "price", "year", "source"]
   columnTypes=["string", "string", "string", "year", "string"] %}
| Property | Location | Price | Year | Source |
|----------|----------|-------|------|--------|
{% /field %}

{% instructions ref="real_estate" %}
Significant property purchases/sales.
Example: $25M mansion | Beverly Hills, CA | $25M | 2021 | Variety Dirt
Sources: Variety Dirt column, real estate news, property records.
{% /instructions %}

{% field kind="string_list" id="financial_business_sources" label="Financial & Business Sources" %}{% /field %}

{% instructions ref="financial_business_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="controversies_legal" title="Controversies & Legal History" %}

{% description ref="controversies_legal" %}
This section often contains the most interesting "deep research" findings.
Sources: The Smoking Gun (legal docs), court records (PACER for federal, state court searches), TMZ, Wikipedia Controversies section.
Note tabloid vs verified sources clearly.
{% /description %}

{% field kind="table" id="legal_cases" label="Legal Cases & Lawsuits"
   columnIds=["case_type", "year", "parties", "outcome", "source"]
   columnTypes=["string", "year", "string", "string", "string"] %}
| Case Type | Year | Parties | Outcome | Source |
|-----------|------|---------|---------|--------|
{% /field %}

{% instructions ref="legal_cases" %}
Court cases, lawsuits, legal proceedings.
Example: Divorce | 2016 | Jolie v. Pitt | Settled | Court records, TMZ
Example: Defamation | 2022 | Depp v. Heard | Depp won $10.35M | Fairfax County Court
Sources: PACER, state court record searches, The Smoking Gun, Court Listener.
{% /instructions %}

{% field kind="table" id="arrests_charges" label="Arrests & Criminal Charges"
   columnIds=["year", "charge", "location", "outcome", "source"]
   columnTypes=["year", "string", "string", "string", "string"] %}
| Year | Charge | Location | Outcome | Source |
|------|--------|----------|---------|--------|
{% /field %}

{% instructions ref="arrests_charges" %}
Criminal matters if any.
Example: 2007 | DUI | Los Angeles | Plea deal, probation | TMZ, court records
Sources: The Smoking Gun (has mugshots/records), court records, news archives.
{% /instructions %}

{% field kind="table" id="controversies" label="Public Controversies"
   columnIds=["year", "issue", "description", "outcome", "reliability"]
   columnTypes=["year", "string", "string", "string", "string"] %}
| Year | Issue | Description | Outcome | Reliability |
|------|-------|-------------|---------|-------------|
{% /field %}

{% instructions ref="controversies" %}
Non-legal controversies.
Example: 2021 | Workplace behavior | Accusations of diva behavior on set | Denied by rep | Tabloid reports (low)
Sources: Wikipedia Controversies section, press, tabloids.
Always note source reliability (high/medium/low).
{% /instructions %}

{% field kind="string" id="metoo_related" label="MeToo/Harassment Allegations" %}{% /field %}

{% instructions ref="metoo_related" %}
If applicable, summarize any MeToo-era allegations or involvement.
Note: Handle with appropriate seriousness. Include outcomes of any investigations.
Sources: Major news outlets, court records if any.
{% /instructions %}

{% field kind="string_list" id="controversies_legal_sources" label="Controversies & Legal Sources" %}{% /field %}

{% instructions ref="controversies_legal_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="social_media" title="Social Media Presence" %}

{% description ref="social_media" %}
Search each platform directly for verified accounts. Note follower counts, engagement, and activity level.
{% /description %}

{% field kind="string" id="instagram" label="Instagram" %}{% /field %}

{% instructions ref="instagram" %}
Format: @handle | Followers | Verified? | Activity | URL
Example: "@margotrobbie | 28.5M followers | Verified | ~2 posts/week | instagram.com/margotrobbie"
Source: Search instagram.com directly. Look for blue verification badge.
{% /instructions %}

{% field kind="string" id="twitter_x" label="Twitter/X" %}{% /field %}

{% instructions ref="twitter_x" %}
Format: @handle | Followers | Verified? | Activity | URL
Example: "@RealHughJackman | 15M followers | Verified | Active daily | x.com/RealHughJackman"
Source: Search x.com directly.
{% /instructions %}

{% field kind="string" id="tiktok" label="TikTok" %}{% /field %}

{% instructions ref="tiktok" %}
Format: @handle | Followers | Verified? | Activity | URL
Or "No official account found"
Source: Search tiktok.com directly.
{% /instructions %}

{% field kind="string" id="youtube" label="YouTube" %}{% /field %}

{% instructions ref="youtube" %}
Format: Channel Name | Subscribers | Videos | URL
Example: "Will Smith | 9.7M subscribers | 500+ videos | youtube.com/@willsmith"
Or "No official channel" if none exists.
Source: Search youtube.com.
{% /instructions %}

{% field kind="string" id="facebook" label="Facebook" %}{% /field %}

{% instructions ref="facebook" %}
Format: Page Name | Followers | Verified? | URL
Source: Search facebook.com.
{% /instructions %}

{% field kind="string" id="threads" label="Threads" %}{% /field %}

{% instructions ref="threads" %}
Format: @handle | Followers | URL
Or "Not on Threads"
Source: Search threads.net.
{% /instructions %}

{% field kind="string" id="other_platforms" label="Other Platforms (Twitch, Patreon, OnlyFans, etc.)" %}{% /field %}

{% instructions ref="other_platforms" %}
Any other notable platform presence.
Format: Platform | Handle | Followers | URL
{% /instructions %}

{% field kind="string_list" id="social_media_sources" label="Social Media Sources" %}{% /field %}

{% instructions ref="social_media_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="fan_community" title="Fan Communities & Cultural Impact" %}

{% description ref="fan_community" %}
Fan perspective and community discussion.
Sources: Reddit, dedicated fan wikis, ONTD (Oh No They Didn't), Lipstick Alley, Data Lounge.
Note: These sources provide "insider" perspective but vary in reliability.
{% /description %}

{% field kind="string" id="reddit_presence" label="Reddit Presence" %}{% /field %}

{% instructions ref="reddit_presence" %}
Format: Subreddit(s) | Members | Activity Level | URL
Example: "r/TaylorSwift | 500K members | Very active | reddit.com/r/taylorswift"
Also note if subject has done AMAs.
Source: Search reddit.com.
{% /instructions %}

{% field kind="string" id="fan_wiki" label="Fan Wiki/Fandom Page" %}{% /field %}

{% instructions ref="fan_wiki" %}
Dedicated fan wikis often have exhaustive detail.
Format: Wiki Name | URL | Quality Notes
Example: "Swiftie Wiki | taylor-swift.fandom.com | Extremely detailed, every concert/appearance logged"
Source: Search [celebrity name] fandom.com or wikia.
{% /instructions %}

{% field kind="string_list" id="fan_community_sentiment" label="Fan Community Sentiment" %}{% /field %}

{% instructions ref="fan_community_sentiment" %}
General reputation within fan communities. One community per line.
Format: Community | General Sentiment | Notable Discussion Points
Example: "ONTD | Mixed | Praised for talent, criticized for PR relationships"
Example: "r/movies | Positive | Consistently praised for range, box office draw"
Sources: ONTD (ohnotheydidnt.livejournal.com), Lipstick Alley, Data Lounge, r/entertainment, r/movies.
Note: These are fan opinions, not facts.
{% /instructions %}

{% field kind="string_list" id="nicknames_memes" label="Nicknames, Memes & Cultural References" %}{% /field %}

{% instructions ref="nicknames_memes" %}
Notable nicknames, viral memes, or cultural references. One per line.
Example: "Leo pointing at TV meme | Once Upon a Time scene | Ubiquitous internet meme"
Example: "J.Lo | Common nickname since early career"
{% /instructions %}

{% field kind="string_list" id="fan_community_sources" label="Fan Community Sources" %}{% /field %}

{% instructions ref="fan_community_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="interviews_appearances" title="Media Appearances & Interviews" %}

{% description ref="interviews_appearances" %}
Notable interviews and media appearances.
Sources: YouTube (talk show archives), podcast platforms, major publications.
{% /description %}

{% field kind="table" id="notable_interviews" label="Notable Interviews"
   columnIds=["outlet_show", "date", "topic", "url"]
   columnTypes=["string", "string", "string", "url"] %}
| Outlet/Show | Date | Topic | URL |
|-------------|------|-------|-----|
{% /field %}

{% instructions ref="notable_interviews" %}
Most revealing or significant interviews.
Example: WTF with Marc Maron | 2019-06 | Candid about childhood trauma | https://youtube.com/...
Prioritize: Long-form podcasts (Maron, Armchair Expert, Fresh Air), major magazine profiles.
{% /instructions %}

{% field kind="table" id="talk_show_appearances" label="Notable Talk Show Appearances"
   columnIds=["show", "date", "moment", "url"]
   columnTypes=["string", "string", "string", "url"] %}
| Show | Date | Moment | URL |
|------|------|--------|-----|
{% /field %}

{% instructions ref="talk_show_appearances" %}
Memorable talk show moments.
Example: Graham Norton | 2023-07 | Viral story about meeting the Queen | https://youtube.com/...
Source: YouTube archives of Fallon, Kimmel, Colbert, Graham Norton, etc.
{% /instructions %}

{% field kind="string" id="podcast_appearances" label="Podcast Appearances Summary" maxLength=2000 %}{% /field %}

{% instructions ref="podcast_appearances" %}
Overview of podcast appearances.
Sources: Spotify, Apple Podcasts - search for celebrity name.
Notable shows to check: WTF with Marc Maron, Armchair Expert, SmartLess, Conan O'Brien Needs a Friend.
{% /instructions %}

{% field kind="string_list" id="interviews_appearances_sources" label="Media Appearances Sources" %}{% /field %}

{% instructions ref="interviews_appearances_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="specialized_sources" title="Specialized & Lesser-Known Sources" %}

{% description ref="specialized_sources" %}
These sources often contain information missed by mainstream coverage.
Take time to check each one - they frequently reveal unique details.
{% /description %}

{% field kind="string" id="nndb_summary" label="NNDB Profile Summary" %}{% /field %}

{% instructions ref="nndb_summary" %}
NNDB (Notable Names Database) tracks: religion, politics, causes, sexual orientation, relationships.
Source: nndb.com - search for celebrity name.
Summarize key findings not covered elsewhere.
{% /instructions %}

{% field kind="string" id="political_donations" label="Political Donation History" %}{% /field %}

{% instructions ref="political_donations" %}
Search FEC records for political contributions.
Format: Total donated | Notable recipients | Time period
Example: "$150K since 2008 | Obama, Clinton, Biden campaigns | per FEC"
Sources: 
- OpenSecrets.org (opensecrets.org/donor-lookup)
- FEC.gov individual contributor search
{% /instructions %}

{% field kind="string" id="behind_the_voice" label="Voice Acting Credits" %}{% /field %}

{% instructions ref="behind_the_voice" %}
For actors: voice acting work often overlooked.
Source: behindthevoiceactors.com
Format: # Voice credits | Notable roles
{% /instructions %}

{% field kind="string" id="theater_credits" label="Theater/Broadway Credits" %}{% /field %}

{% instructions ref="theater_credits" %}
Stage work often overlooked in film star coverage.
Sources: Playbill archives (playbill.com), BroadwayWorld (broadwayworld.com), IBDB (Internet Broadway Database).
{% /instructions %}

{% field kind="string" id="discography_music" label="Music/Discography (if applicable)" %}{% /field %}

{% instructions ref="discography_music" %}
For actor-musicians or musicians-turned-actors.
Source: Discogs.com, AllMusic.
{% /instructions %}

{% field kind="string" id="wayback_findings" label="Historical Website/Social Media (Wayback Machine)" %}{% /field %}

{% instructions ref="wayback_findings" %}
Old website content, deleted social media posts, early career materials.
Source: web.archive.org - search for their old personal sites, early social media.
Example: "2005 MySpace page shows pre-fame persona, early demo recordings"
{% /instructions %}

{% field kind="string" id="ancestry_findings" label="Ancestry/Family History" %}{% /field %}

{% instructions ref="ancestry_findings" %}
Notable genealogical findings.
Sources: Geni.com, FamilySearch.org, Ancestry (if publicly discussed).
Example: "Related to British royalty through maternal line (per Finding Your Roots appearance)"
{% /instructions %}

{% field kind="string_list" id="specialized_sources_urls" label="Specialized Sources" %}{% /field %}

{% instructions ref="specialized_sources_urls" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="deceased_specific" title="For Deceased Celebrities" %}

{% description ref="deceased_specific" %}
Only fill if the subject is deceased.
{% /description %}

{% field kind="string" id="find_a_grave" label="Find A Grave Entry" %}{% /field %}

{% instructions ref="find_a_grave" %}
Format: Memorial ID | Cemetery | Location | URL
Source: findagrave.com
{% /instructions %}

{% field kind="string_list" id="obituary_sources" label="Notable Obituaries" %}{% /field %}

{% instructions ref="obituary_sources" %}
Major obituaries and tributes. One per line.
Format: Publication | Headline | URL
Example: "New York Times | 'Actor Who Defined a Generation' | nytimes.com/..."
{% /instructions %}

{% field kind="string" id="legacy_assessment" label="Legacy Assessment" maxLength=1000 %}{% /field %}

{% instructions ref="legacy_assessment" %}
How is this person remembered? Cultural impact, ongoing influence.
Sources: Retrospective articles, academic assessments, AFI tributes.
{% /instructions %}

{% field kind="string_list" id="deceased_specific_sources" label="Deceased Celebrity Sources" %}{% /field %}

{% instructions ref="deceased_specific_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="trivia_quotes" title="Trivia & Memorable Quotes" %}

{% description ref="trivia_quotes" %}
The "juicy details" section - interesting facts that make profiles memorable.
Sources: IMDb Trivia, interviews, biographies.
{% /description %}

{% field kind="string_list" id="interesting_trivia" label="Interesting Trivia" %}{% /field %}

{% instructions ref="interesting_trivia" %}
Unusual, surprising, or lesser-known facts. One per line.
Examples:
- "Almost cast as Batman before [other actor]"
- "Was a licensed pilot before acting career"
- "Roommates with [other celebrity] in early career"
Source: IMDb Trivia section, interviews, biographies.
Prioritize: Surprising facts, near-misses on iconic roles, unusual skills, celebrity connections.
{% /instructions %}

{% field kind="table" id="notable_quotes" label="Notable Quotes"
   columnIds=["quote", "context_source"]
   columnTypes=["string", "string"] %}
| Quote | Context/Source |
|-------|----------------|
{% /field %}

{% instructions ref="notable_quotes" %}
Memorable quotes by the celebrity.
Example: I'd rather be hated for who I am than loved for who I'm not. | 2010 Vanity Fair interview
Sources: IMDb Quotes, Brainy Quote, notable interviews.
{% /instructions %}

{% field kind="string_list" id="trivia_quotes_sources" label="Trivia & Quotes Sources" %}{% /field %}

{% instructions ref="trivia_quotes_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="research_metadata" title="Research Metadata" %}

{% field kind="string" id="research_date" label="Research Date" required=true pattern="^\\d{4}-\\d{2}-\\d{2}$" %}{% /field %}

{% instructions ref="research_date" %}
Date research was conducted (YYYY-MM-DD). Critical for celebrity research as information changes rapidly.
{% /instructions %}

{% field kind="string" id="research_limitations" label="Research Limitations & Notes" maxLength=2000 %}{% /field %}

{% instructions ref="research_limitations" %}
Note any limitations:
- Paywalled sources not accessed (The Information, PitchBook)
- Subject is private/limited public info
- Conflicting information found (note specifics)
- Non-English sources not reviewed
- Recent events may not be reflected
- Certain sections incomplete due to [reason]
{% /instructions %}

{% field kind="string" id="confidence_assessment" label="Overall Research Confidence" %}{% /field %}

{% instructions ref="confidence_assessment" %}
Rate overall confidence: High / Medium / Low
With explanation of why.
Example: "High - Major celebrity with extensive public record and multiple reliable sources"
Example: "Medium - Some tabloid-sourced claims could not be independently verified"
{% /instructions %}

{% /field-group %}

{% /form %}

