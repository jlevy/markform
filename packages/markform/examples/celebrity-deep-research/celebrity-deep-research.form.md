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

{% string-field id="celebrity_name" label="Celebrity Name" role="user" required=true minLength=2 maxLength=200 %}{% /string-field %}

{% instructions ref="celebrity_name" %}
Enter the full professional name (e.g., "Margot Robbie", "Leonardo DiCaprio", "Timothée Chalamet").
{% /instructions %}

{% string-field id="disambiguation" label="Disambiguation Context" role="user" maxLength=500 %}{% /string-field %}

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

{% string-field id="full_legal_name" label="Full Legal Name" %}{% /string-field %}

{% instructions ref="full_legal_name" %}
Birth name if different from stage name (e.g., "Stefani Joanne Angelina Germanotta" for Lady Gaga).
Source: Wikipedia infobox, birth certificate records if public.
{% /instructions %}

{% string-field id="stage_name" label="Stage/Professional Name" required=true %}{% /string-field %}

{% string-field id="birth_date" label="Birth Date" pattern="^\\d{4}-\\d{2}-\\d{2}$" %}{% /string-field %}

{% instructions ref="birth_date" %}
Format: YYYY-MM-DD (e.g., 1990-07-02).
Sources: Wikipedia, IMDb bio, Famous Birthdays.
Note: Some celebrities obscure their birth year; note if disputed.
{% /instructions %}

{% string-field id="birth_place" label="Birth Place" %}{% /string-field %}

{% instructions ref="birth_place" %}
Format: City, State/Province, Country.
Source: Wikipedia, IMDb.
{% /instructions %}

{% string-field id="nationality" label="Nationality/Citizenship" %}{% /string-field %}

{% instructions ref="nationality" %}
List all known citizenships (some celebrities hold multiple).
Source: Wikipedia, press interviews.
{% /instructions %}

{% string-field id="height" label="Height" %}{% /string-field %}

{% instructions ref="height" %}
Format: X'Y" (X cm) - e.g., 5'7" (170 cm).
Source: IMDb, CelebrityHeights.com (surprisingly accurate), Google Knowledge Panel.
Note: Heights are often disputed/inflated.
{% /instructions %}

{% string-field id="death_info" label="Death Information (if applicable)" %}{% /string-field %}

{% instructions ref="death_info" %}
Format: YYYY-MM-DD | Location | Cause | Age at death
Example: "2022-01-15 | Los Angeles, CA | Natural causes | 99"
Sources: Wikipedia, obituaries, Find A Grave.
Leave empty if person is living.
{% /instructions %}

{% string-field id="resting_place" label="Burial/Resting Place" %}{% /string-field %}

{% instructions ref="resting_place" %}
For deceased: Cemetery name, location.
Source: Find A Grave (findagrave.com), Wikipedia.
{% /instructions %}

{% string-list id="core_biography_sources" label="Core Bio Sources" %}{% /string-list %}

{% instructions ref="core_biography_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="personal_details" title="Personal Details & Background" %}

{% description ref="personal_details" %}
Personal background often reveals interesting context.
Sources: NNDB.com (excellent for religion/politics/causes), Wikipedia Personal Life section, in-depth magazine profiles.
{% /description %}

{% string-field id="ethnicity_ancestry" label="Ethnicity/Ancestry" %}{% /string-field %}

{% instructions ref="ethnicity_ancestry" %}
Ethnic background and known ancestry.
Sources: Wikipedia, celebrity interviews, Ancestry.com findings if public, NNDB.
Handle sensitively; only include what the celebrity has publicly discussed.
{% /instructions %}

{% string-field id="religion" label="Religion/Spiritual Beliefs" %}{% /string-field %}

{% instructions ref="religion" %}
Religious upbringing and current beliefs if publicly stated.
Source: NNDB.com (tracks this specifically), Wikipedia, magazine interviews.
Example: "Raised Catholic, currently practices Kabbalah"
{% /instructions %}

{% string-field id="political_affiliation" label="Political Affiliation/Views" %}{% /string-field %}

{% instructions ref="political_affiliation" %}
Known political views, party affiliation, endorsements.
Sources: 
- NNDB.com (categorizes political leanings)
- OpenSecrets.org / FEC filings (actual donation records)
- Wikipedia, press statements, social media posts
Example: "Democrat; donated $50K to Obama 2012 per FEC; publicly endorsed Biden 2020"
{% /instructions %}

{% string-list id="causes_activism" label="Causes & Activism" %}{% /string-list %}

{% instructions ref="causes_activism" %}
One cause per line.
Format: Cause | Role/Involvement | Source
Example: "Climate Change | Founded Earth Alliance with DiCaprio | earthalliance.org"
Sources: NNDB.com, Charity Navigator (for their foundations), Wikipedia, press.
{% /instructions %}

{% string-list id="education" label="Education History" %}{% /string-list %}

{% instructions ref="education" %}
One institution per line, chronological.
Format: Institution | Degree/Program | Years | Notes
Example: "Yale University | Drama (incomplete) | 2000-2002 | Left to pursue acting"
Sources: Wikipedia, LinkedIn (if they have one), university alumni lists, IMDb bio.
{% /instructions %}

{% string-list id="personal_details_sources" label="Personal Details Sources" %}{% /string-list %}

{% instructions ref="personal_details_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="family_relationships" title="Family & Relationships" %}

{% description ref="family_relationships" %}
Relationship history is a core area of celebrity coverage.
Sources: Wikipedia, WhosDatedWho.com, tabloids (note if tabloid-sourced), court records for divorces.
{% /description %}

{% string-field id="parents" label="Parents" %}{% /string-field %}

{% instructions ref="parents" %}
Format: Father: Name (occupation) | Mother: Name (occupation)
Note if parents were also in entertainment industry.
Sources: Wikipedia, IMDb bio.
{% /instructions %}

{% string-list id="siblings" label="Siblings" %}{% /string-list %}

{% instructions ref="siblings" %}
One sibling per line.
Format: Name | Relationship | Notable info (if any)
Example: "Jake Gyllenhaal | Brother | Actor, Oscar nominee"
{% /instructions %}

{% string-list id="marriages" label="Marriage History" %}{% /string-list %}

{% instructions ref="marriages" %}
One marriage per line, chronological.
Format: Spouse Name | Wedding Date | Divorce Date (or "present") | Duration | Source
Example: "Brad Pitt | 2000-07-29 | 2005-01-07 | 4.5 years | Court records"
Sources: Wikipedia, WhosDatedWho, court records for divorces.
{% /instructions %}

{% string-list id="children" label="Children" %}{% /string-list %}

{% instructions ref="children" %}
One child per line.
Format: Name | Birth Year | Other Parent | Notes
Example: "Shiloh Jolie-Pitt | 2006 | Brad Pitt | Biological child"
Note: Some celebrities keep children very private; respect when info is intentionally hidden.
{% /instructions %}

{% string-list id="notable_relationships" label="Notable Dating History" %}{% /string-list %}

{% instructions ref="notable_relationships" %}
Significant relationships (not marriages), most recent first. One per line.
Format: Partner Name | Approximate Dates | Reliability
Example: "Taylor Swift | 2016-2017 | Confirmed via paparazzi/social media"
Sources: WhosDatedWho.com, tabloids (note reliability), press confirmations.
Note if "rumored only" vs "confirmed."
{% /instructions %}

{% string-list id="family_relationships_sources" label="Family & Relationships Sources" %}{% /string-list %}

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

{% string-field id="primary_profession" label="Primary Profession(s)" required=true %}{% /string-field %}

{% instructions ref="primary_profession" %}
Main profession(s) in entertainment.
Example: "Actor, Producer, Director" or "Singer, Actress, Dancer"
Source: IMDb, Wikipedia lead paragraph.
{% /instructions %}

{% string-field id="career_start" label="Career Start Year" pattern="^\\d{4}$" %}{% /string-field %}

{% instructions ref="career_start" %}
Year of first professional credit.
Source: IMDb earliest credit.
{% /instructions %}

{% string-field id="breakthrough_role" label="Breakthrough Role" %}{% /string-field %}

{% instructions ref="breakthrough_role" %}
Format: "Project Title" (Year) as Character Name
Example: "Titanic (1997) as Jack Dawson"
Source: Wikipedia, IMDb, press retrospectives.
{% /instructions %}

{% string-field id="notable_films_table" label="Notable Film Credits (Table)" maxLength=5000 %}{% /string-field %}

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

{% string-field id="notable_tv_table" label="Notable TV Credits (Table)" maxLength=5000 %}{% /string-field %}

{% instructions ref="notable_tv_table" %}
Significant TV appearances. Use markdown table:

| Years | Series | Role | Episodes | Notes |
|-------|--------|------|----------|-------|
| 2019-2023 | Euphoria | Rue | 18 | Lead role, Emmy winner |

Sources: IMDb, TV Guide archives.
{% /instructions %}

{% string-field id="upcoming_projects" label="Upcoming/In Production Projects" maxLength=1000 %}{% /string-field %}

{% instructions ref="upcoming_projects" %}
Announced future projects.
Sources: IMDb "In Development", Variety/THR/Deadline announcements, Production Weekly.
Note status: Filming, Post-production, Announced.
{% /instructions %}

{% string-field id="box_office_stats" label="Career Box Office Statistics" %}{% /string-field %}

{% instructions ref="box_office_stats" %}
Format: Total Gross | # Films | Average | Highest | Source
Example: "$10.2B total | 35 films | $291M avg | Barbie ($1.4B) | Box Office Mojo"
Source: Box Office Mojo actor page, The Numbers.
{% /instructions %}

{% string-list id="filmography_career_sources" label="Filmography Sources" %}{% /string-list %}

{% instructions ref="filmography_career_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="critical_reception" title="Critical Reception & Ratings" %}

{% description ref="critical_reception" %}
Aggregate critic and audience scores.
Sources: Rotten Tomatoes career page, Metacritic, Letterboxd (for film community sentiment).
{% /description %}

{% string-field id="rt_career_stats" label="Rotten Tomatoes Career Stats" %}{% /string-field %}

{% instructions ref="rt_career_stats" %}
Format: Avg Tomatometer | # Fresh films | # Rotten films | Notable scores
Example: "68% average | 25 Fresh | 12 Rotten | Best: Lady Bird (99%), Worst: Movie 43 (4%)"
Source: rottentomatoes.com/celebrity/
{% /instructions %}

{% string-field id="letterboxd_rating" label="Letterboxd Average Rating" %}{% /string-field %}

{% instructions ref="letterboxd_rating" %}
Average rating across their filmography on Letterboxd.
Format: X.X/5 | Most-logged film | Highest-rated film
Source: letterboxd.com (search actor name).
{% /instructions %}

{% string-list id="critical_reception_sources" label="Critical Reception Sources" %}{% /string-list %}

{% instructions ref="critical_reception_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="awards_recognition" title="Awards & Recognition" %}

{% description ref="awards_recognition" %}
Complete awards history including nominations and wins.
Sources: IMDb Awards page, Oscars.org, Emmy database, Wikipedia filmography tables.
{% /description %}

{% string-field id="major_awards_summary" label="Major Awards Summary" %}{% /string-field %}

{% instructions ref="major_awards_summary" %}
Quick summary of biggest wins.
Format: # Oscar wins/noms | # Emmy wins/noms | # Grammy wins/noms | # Golden Globe wins/noms | Other notable
Example: "3 Oscar noms (1 win) | 0 Emmy | 0 Grammy | 4 GG noms (2 wins) | SAG Ensemble winner"
{% /instructions %}

{% string-field id="oscar_history" label="Academy Award History (Table)" maxLength=3000 %}{% /string-field %}

{% instructions ref="oscar_history" %}
Use markdown table:

| Year | Category | Film | Result |
|------|----------|------|--------|
| 2024 | Best Actress | Poor Things | Won |
| 2019 | Best Actress | The Favourite | Nominated |

Source: Oscars.org, IMDb Awards.
{% /instructions %}

{% string-field id="other_major_awards" label="Other Major Awards (Table)" maxLength=3000 %}{% /string-field %}

{% instructions ref="other_major_awards" %}
Emmy, Grammy, Tony, Golden Globe, SAG, BAFTA, Cannes, etc.
Use markdown table:

| Year | Award | Category | Project | Result |
|------|-------|----------|---------|--------|
| 2023 | Emmy | Outstanding Lead Actress | The White Lotus | Won |

Sources: Respective award databases, IMDb Awards.
{% /instructions %}

{% string-list id="notable_honors" label="Other Honors & Recognition" %}{% /string-list %}

{% instructions ref="notable_honors" %}
Non-award honors, one per line.
Examples: Hollywood Walk of Fame star, Kennedy Center Honor, Presidential Medal, Honorary degrees, etc.
{% /instructions %}

{% string-list id="awards_recognition_sources" label="Awards Sources" %}{% /string-list %}

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

{% string-field id="estimated_net_worth" label="Estimated Net Worth" %}{% /string-field %}

{% instructions ref="estimated_net_worth" %}
Format: $XXM-$XXM (Source, Date)
Example: "$400M-$450M (CelebrityNetWorth, 2024; Forbes estimates $380M)"
Note: Always include source and date; these estimates vary wildly.
{% /instructions %}

{% string-list id="known_salaries" label="Known Salary/Earnings" %}{% /string-list %}

{% instructions ref="known_salaries" %}
Reported salaries per project, one per line.
Format: Project | Amount | Year | Source
Example: "Barbie | $12.5M + $50M backend | 2023 | Variety"
Sources: Variety, THR salary reports, leaked studio documents.
{% /instructions %}

{% string-field id="forbes_rankings" label="Forbes Celebrity 100 History" %}{% /string-field %}

{% instructions ref="forbes_rankings" %}
Historical Forbes Celebrity 100 rankings if available.
Format: Year: Rank, Earnings
Example: "2023: #8, $59M | 2022: #12, $42M"
Source: Forbes.com Celebrity 100 lists.
{% /instructions %}

{% string-list id="business_ventures" label="Business Ventures & Companies" %}{% /string-list %}

{% instructions ref="business_ventures" %}
Companies owned, founded, or invested in. One per line.
Format: Company | Role | Industry | Status | Source
Example: "Honest Company | Co-founder | Consumer goods | IPO 2021, now private | SEC filings"
Sources: Forbes, SEC EDGAR (for public companies), Crunchbase, press releases.
{% /instructions %}

{% string-list id="endorsements" label="Major Endorsements & Sponsorships" %}{% /string-list %}

{% instructions ref="endorsements" %}
Brand deals and endorsements. One per line.
Format: Brand | Type | Approximate Value (if known) | Years | Source
Example: "Chanel No. 5 | Global Ambassador | $5M/year | 2020-present | Variety"
Sources: Press releases, Variety/THR business coverage, social media sponsored posts.
{% /instructions %}

{% string-list id="real_estate" label="Known Real Estate Holdings" %}{% /string-list %}

{% instructions ref="real_estate" %}
Significant property purchases/sales. One per line.
Format: Property | Location | Purchase Price | Year | Source
Example: "$25M mansion | Beverly Hills, CA | $25M | 2021 | Variety Dirt"
Sources: Variety Dirt column, real estate news, property records.
{% /instructions %}

{% string-list id="financial_business_sources" label="Financial & Business Sources" %}{% /string-list %}

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

{% string-list id="legal_cases" label="Legal Cases & Lawsuits" %}{% /string-list %}

{% instructions ref="legal_cases" %}
Court cases, lawsuits, legal proceedings. One per line.
Format: Case Type | Year | Parties | Outcome | Source
Example: "Divorce | 2016-2019 | Jolie v. Pitt | Settled | Court records, TMZ"
Example: "Defamation | 2022 | Depp v. Heard | Depp won $10.35M | Fairfax County Court"
Sources: 
- PACER (pacer.gov) for federal cases
- State court record searches
- The Smoking Gun (thesmokinggun.com) - publishes actual legal documents
- Court Listener (courtlistener.com) - free federal case search
{% /instructions %}

{% string-list id="arrests_charges" label="Arrests & Criminal Charges" %}{% /string-list %}

{% instructions ref="arrests_charges" %}
Criminal matters if any. One per line.
Format: Year | Charge | Location | Outcome | Source
Example: "2007 | DUI | Los Angeles | Plea deal, probation | TMZ, court records"
Sources: The Smoking Gun (has mugshots/records), court records, news archives.
{% /instructions %}

{% string-list id="controversies" label="Public Controversies" %}{% /string-list %}

{% instructions ref="controversies" %}
Non-legal controversies. One per line.
Format: Year | Issue | Brief Description | Outcome | Source Reliability
Example: "2021 | Workplace behavior | Accusations of diva behavior on set | Denied by rep | Tabloid reports (low reliability)"
Sources: Wikipedia Controversies section, press, tabloids.
Always note source reliability (high/medium/low).
{% /instructions %}

{% string-field id="metoo_related" label="MeToo/Harassment Allegations" %}{% /string-field %}

{% instructions ref="metoo_related" %}
If applicable, summarize any MeToo-era allegations or involvement.
Note: Handle with appropriate seriousness. Include outcomes of any investigations.
Sources: Major news outlets, court records if any.
{% /instructions %}

{% string-list id="controversies_legal_sources" label="Controversies & Legal Sources" %}{% /string-list %}

{% instructions ref="controversies_legal_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="social_media" title="Social Media Presence" %}

{% description ref="social_media" %}
Search each platform directly for verified accounts. Note follower counts, engagement, and activity level.
{% /description %}

{% string-field id="instagram" label="Instagram" %}{% /string-field %}

{% instructions ref="instagram" %}
Format: @handle | Followers | Verified? | Activity | URL
Example: "@margotrobbie | 28.5M followers | Verified | ~2 posts/week | instagram.com/margotrobbie"
Source: Search instagram.com directly. Look for blue verification badge.
{% /instructions %}

{% string-field id="twitter_x" label="Twitter/X" %}{% /string-field %}

{% instructions ref="twitter_x" %}
Format: @handle | Followers | Verified? | Activity | URL
Example: "@RealHughJackman | 15M followers | Verified | Active daily | x.com/RealHughJackman"
Source: Search x.com directly.
{% /instructions %}

{% string-field id="tiktok" label="TikTok" %}{% /string-field %}

{% instructions ref="tiktok" %}
Format: @handle | Followers | Verified? | Activity | URL
Or "No official account found"
Source: Search tiktok.com directly.
{% /instructions %}

{% string-field id="youtube" label="YouTube" %}{% /string-field %}

{% instructions ref="youtube" %}
Format: Channel Name | Subscribers | Videos | URL
Example: "Will Smith | 9.7M subscribers | 500+ videos | youtube.com/@willsmith"
Or "No official channel" if none exists.
Source: Search youtube.com.
{% /instructions %}

{% string-field id="facebook" label="Facebook" %}{% /string-field %}

{% instructions ref="facebook" %}
Format: Page Name | Followers | Verified? | URL
Source: Search facebook.com.
{% /instructions %}

{% string-field id="threads" label="Threads" %}{% /string-field %}

{% instructions ref="threads" %}
Format: @handle | Followers | URL
Or "Not on Threads"
Source: Search threads.net.
{% /instructions %}

{% string-field id="other_platforms" label="Other Platforms (Twitch, Patreon, OnlyFans, etc.)" %}{% /string-field %}

{% instructions ref="other_platforms" %}
Any other notable platform presence.
Format: Platform | Handle | Followers | URL
{% /instructions %}

{% string-list id="social_media_sources" label="Social Media Sources" %}{% /string-list %}

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

{% string-field id="reddit_presence" label="Reddit Presence" %}{% /string-field %}

{% instructions ref="reddit_presence" %}
Format: Subreddit(s) | Members | Activity Level | URL
Example: "r/TaylorSwift | 500K members | Very active | reddit.com/r/taylorswift"
Also note if subject has done AMAs.
Source: Search reddit.com.
{% /instructions %}

{% string-field id="fan_wiki" label="Fan Wiki/Fandom Page" %}{% /string-field %}

{% instructions ref="fan_wiki" %}
Dedicated fan wikis often have exhaustive detail.
Format: Wiki Name | URL | Quality Notes
Example: "Swiftie Wiki | taylor-swift.fandom.com | Extremely detailed, every concert/appearance logged"
Source: Search [celebrity name] fandom.com or wikia.
{% /instructions %}

{% string-list id="fan_community_sentiment" label="Fan Community Sentiment" %}{% /string-list %}

{% instructions ref="fan_community_sentiment" %}
General reputation within fan communities. One community per line.
Format: Community | General Sentiment | Notable Discussion Points
Example: "ONTD | Mixed | Praised for talent, criticized for PR relationships"
Example: "r/movies | Positive | Consistently praised for range, box office draw"
Sources: ONTD (ohnotheydidnt.livejournal.com), Lipstick Alley, Data Lounge, r/entertainment, r/movies.
Note: These are fan opinions, not facts.
{% /instructions %}

{% string-list id="nicknames_memes" label="Nicknames, Memes & Cultural References" %}{% /string-list %}

{% instructions ref="nicknames_memes" %}
Notable nicknames, viral memes, or cultural references. One per line.
Example: "Leo pointing at TV meme | Once Upon a Time scene | Ubiquitous internet meme"
Example: "J.Lo | Common nickname since early career"
{% /instructions %}

{% string-list id="fan_community_sources" label="Fan Community Sources" %}{% /string-list %}

{% instructions ref="fan_community_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="interviews_appearances" title="Media Appearances & Interviews" %}

{% description ref="interviews_appearances" %}
Notable interviews and media appearances.
Sources: YouTube (talk show archives), podcast platforms, major publications.
{% /description %}

{% string-list id="notable_interviews" label="Notable Interviews" %}{% /string-list %}

{% instructions ref="notable_interviews" %}
Most revealing or significant interviews. One per line.
Format: Outlet/Show | Date | Topic/Significance | URL
Example: "WTF with Marc Maron | 2019-06 | Candid about childhood trauma | youtube.com/..."
Example: "Vanity Fair Profile | 2023-08 | Cover story, career retrospective | vanityfair.com/..."
Prioritize: Long-form podcasts (Maron, Armchair Expert, Fresh Air), major magazine profiles.
{% /instructions %}

{% string-list id="talk_show_appearances" label="Notable Talk Show Appearances" %}{% /string-list %}

{% instructions ref="talk_show_appearances" %}
Memorable talk show moments. One per line.
Format: Show | Date | Notable moment | URL if available
Example: "Graham Norton | 2023-07 | Viral story about meeting the Queen | youtube.com/..."
Source: YouTube archives of Fallon, Kimmel, Colbert, Graham Norton, etc.
{% /instructions %}

{% string-field id="podcast_appearances" label="Podcast Appearances Summary" maxLength=2000 %}{% /string-field %}

{% instructions ref="podcast_appearances" %}
Overview of podcast appearances.
Sources: Spotify, Apple Podcasts - search for celebrity name.
Notable shows to check: WTF with Marc Maron, Armchair Expert, SmartLess, Conan O'Brien Needs a Friend.
{% /instructions %}

{% string-list id="interviews_appearances_sources" label="Media Appearances Sources" %}{% /string-list %}

{% instructions ref="interviews_appearances_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="specialized_sources" title="Specialized & Lesser-Known Sources" %}

{% description ref="specialized_sources" %}
These sources often contain information missed by mainstream coverage.
Take time to check each one - they frequently reveal unique details.
{% /description %}

{% string-field id="nndb_summary" label="NNDB Profile Summary" %}{% /string-field %}

{% instructions ref="nndb_summary" %}
NNDB (Notable Names Database) tracks: religion, politics, causes, sexual orientation, relationships.
Source: nndb.com - search for celebrity name.
Summarize key findings not covered elsewhere.
{% /instructions %}

{% string-field id="political_donations" label="Political Donation History" %}{% /string-field %}

{% instructions ref="political_donations" %}
Search FEC records for political contributions.
Format: Total donated | Notable recipients | Time period
Example: "$150K since 2008 | Obama, Clinton, Biden campaigns | per FEC"
Sources: 
- OpenSecrets.org (opensecrets.org/donor-lookup)
- FEC.gov individual contributor search
{% /instructions %}

{% string-field id="behind_the_voice" label="Voice Acting Credits" %}{% /string-field %}

{% instructions ref="behind_the_voice" %}
For actors: voice acting work often overlooked.
Source: behindthevoiceactors.com
Format: # Voice credits | Notable roles
{% /instructions %}

{% string-field id="theater_credits" label="Theater/Broadway Credits" %}{% /string-field %}

{% instructions ref="theater_credits" %}
Stage work often overlooked in film star coverage.
Sources: Playbill archives (playbill.com), BroadwayWorld (broadwayworld.com), IBDB (Internet Broadway Database).
{% /instructions %}

{% string-field id="discography_music" label="Music/Discography (if applicable)" %}{% /string-field %}

{% instructions ref="discography_music" %}
For actor-musicians or musicians-turned-actors.
Source: Discogs.com, AllMusic.
{% /instructions %}

{% string-field id="wayback_findings" label="Historical Website/Social Media (Wayback Machine)" %}{% /string-field %}

{% instructions ref="wayback_findings" %}
Old website content, deleted social media posts, early career materials.
Source: web.archive.org - search for their old personal sites, early social media.
Example: "2005 MySpace page shows pre-fame persona, early demo recordings"
{% /instructions %}

{% string-field id="ancestry_findings" label="Ancestry/Family History" %}{% /string-field %}

{% instructions ref="ancestry_findings" %}
Notable genealogical findings.
Sources: Geni.com, FamilySearch.org, Ancestry (if publicly discussed).
Example: "Related to British royalty through maternal line (per Finding Your Roots appearance)"
{% /instructions %}

{% string-list id="specialized_sources_urls" label="Specialized Sources" %}{% /string-list %}

{% instructions ref="specialized_sources_urls" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="deceased_specific" title="For Deceased Celebrities" %}

{% description ref="deceased_specific" %}
Only fill if the subject is deceased.
{% /description %}

{% string-field id="find_a_grave" label="Find A Grave Entry" %}{% /string-field %}

{% instructions ref="find_a_grave" %}
Format: Memorial ID | Cemetery | Location | URL
Source: findagrave.com
{% /instructions %}

{% string-list id="obituary_sources" label="Notable Obituaries" %}{% /string-list %}

{% instructions ref="obituary_sources" %}
Major obituaries and tributes. One per line.
Format: Publication | Headline | URL
Example: "New York Times | 'Actor Who Defined a Generation' | nytimes.com/..."
{% /instructions %}

{% string-field id="legacy_assessment" label="Legacy Assessment" maxLength=1000 %}{% /string-field %}

{% instructions ref="legacy_assessment" %}
How is this person remembered? Cultural impact, ongoing influence.
Sources: Retrospective articles, academic assessments, AFI tributes.
{% /instructions %}

{% string-list id="deceased_specific_sources" label="Deceased Celebrity Sources" %}{% /string-list %}

{% instructions ref="deceased_specific_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="trivia_quotes" title="Trivia & Memorable Quotes" %}

{% description ref="trivia_quotes" %}
The "juicy details" section - interesting facts that make profiles memorable.
Sources: IMDb Trivia, interviews, biographies.
{% /description %}

{% string-list id="interesting_trivia" label="Interesting Trivia" %}{% /string-list %}

{% instructions ref="interesting_trivia" %}
Unusual, surprising, or lesser-known facts. One per line.
Examples:
- "Almost cast as Batman before [other actor]"
- "Was a licensed pilot before acting career"
- "Roommates with [other celebrity] in early career"
Source: IMDb Trivia section, interviews, biographies.
Prioritize: Surprising facts, near-misses on iconic roles, unusual skills, celebrity connections.
{% /instructions %}

{% string-list id="notable_quotes" label="Notable Quotes" %}{% /string-list %}

{% instructions ref="notable_quotes" %}
Memorable quotes by the celebrity. One per line.
Format: "Quote text" - Context/Source
Example: "I'd rather be hated for who I am than loved for who I'm not." - 2010 Vanity Fair interview
Sources: IMDb Quotes, Brainy Quote, notable interviews.
{% /instructions %}

{% string-list id="trivia_quotes_sources" label="Trivia & Quotes Sources" %}{% /string-list %}

{% instructions ref="trivia_quotes_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="research_metadata" title="Research Metadata" %}

{% string-field id="research_date" label="Research Date" required=true pattern="^\\d{4}-\\d{2}-\\d{2}$" %}{% /string-field %}

{% instructions ref="research_date" %}
Date research was conducted (YYYY-MM-DD). Critical for celebrity research as information changes rapidly.
{% /instructions %}

{% string-field id="research_limitations" label="Research Limitations & Notes" maxLength=2000 %}{% /string-field %}

{% instructions ref="research_limitations" %}
Note any limitations:
- Paywalled sources not accessed (The Information, PitchBook)
- Subject is private/limited public info
- Conflicting information found (note specifics)
- Non-English sources not reviewed
- Recent events may not be reflected
- Certain sections incomplete due to [reason]
{% /instructions %}

{% string-field id="confidence_assessment" label="Overall Research Confidence" %}{% /string-field %}

{% instructions ref="confidence_assessment" %}
Rate overall confidence: High / Medium / Low
With explanation of why.
Example: "High - Major celebrity with extensive public record and multiple reliable sources"
Example: "Medium - Some tabloid-sourced claims could not be independently verified"
{% /instructions %}

{% /field-group %}

{% /form %}

