---
markform:
  spec: MF/0.1
  title: Startup Deep Research
  description: Comprehensive startup intelligence gathering with company info, founders, funding, competitors, social media, and community presence.
  roles:
    - user
    - agent
  role_instructions:
    user: "Enter the startup name and any clarifying details (website, founder names, etc.)."
    agent: |
      Research and fill in all fields for the specified startup.
      Guidelines:
      1. Start with the company website and Crunchbase for basic info
      2. Cross-reference funding data with multiple sources (Crunchbase, PitchBook, press releases)
      3. Search Hacker News via hn.algolia.com for discussions and launches
      4. Check Product Hunt for product launches
      5. Use LinkedIn for founder backgrounds
      6. Search each social media platform directly for official accounts
      7. Include source URLs for every piece of information
      8. Leave unknown fields empty - don't guess or fabricate
      9. Keep descriptions concise (50-150 words max)
  harness_config:
    max_issues_per_turn: 5
    max_patches_per_turn: 10
---

{% form id="startup_deep_research" title="Startup Deep Research" %}

{% description ref="startup_deep_research" %}
A comprehensive research form for gathering intelligence on startups including company basics, founders, funding, competitors, social media presence, and community signals.
{% /description %}

{% field-group id="user_input" title="Company to Research" %}

{% string-field id="company_name" label="Company Name" role="user" required=true minLength=1 maxLength=200 %}{% /string-field %}

{% instructions ref="company_name" %}
Enter the startup name exactly as it's commonly known (e.g., "Stripe", "Notion", "Figma").
{% /instructions %}

{% string-field id="additional_context" label="Additional Context" role="user" maxLength=1000 %}{% /string-field %}

{% instructions ref="additional_context" %}
Optional but helpful: Include any details or sources you already have to aid research:
- Website URL or social media links
- Founder names or key people you know of
- Approximate founding year or location
- Links to articles, posts, or announcements you've seen
- Any context to disambiguate (e.g., "the AI code assistant, not the cosmetics brand")
- Specific aspects you're most interested in researching

The more context you provide, the more accurate and relevant the research will be.
{% /instructions %}

{% /field-group %}

{% field-group id="basic_info" title="Company Overview" %}

{% string-field id="website" label="Website URL" %}{% /string-field %}

{% instructions ref="website" %}
Primary company website.
Source: Direct web search or crunchbase.com.
{% /instructions %}

{% string-field id="one_liner" label="One-Line Description" maxLength=200 %}{% /string-field %}

{% instructions ref="one_liner" %}
Brief description of what the company does.
Source: Company website tagline, crunchbase.com summary, or linkedin.com/company page.
{% /instructions %}

{% string-field id="founded_date" label="Founded Date" pattern="^\\d{4}(-\\d{2})?(-\\d{2})?$" %}{% /string-field %}

{% instructions ref="founded_date" %}
Format: YYYY or YYYY-MM or YYYY-MM-DD.
Source: crunchbase.com, company About page, or press releases.
{% /instructions %}

{% string-field id="headquarters" label="Headquarters" %}{% /string-field %}

{% instructions ref="headquarters" %}
Format: City, State/Country.
Source: crunchbase.com, linkedin.com/company page, or website footer.
{% /instructions %}

{% string-field id="company_status" label="Company Status" %}{% /string-field %}

{% instructions ref="company_status" %}
Current status: Active, Acquired (by whom, when), IPO (ticker, date), Shutdown, etc.
Source: crunchbase.com, press releases.
{% /instructions %}

{% string-field id="employee_count" label="Employee Count" %}{% /string-field %}

{% instructions ref="employee_count" %}
Approximate headcount or range (e.g., "50-100", "500+").
Source: linkedin.com/company page, crunchbase.com, or company website.
{% /instructions %}

{% string-field id="description" label="Company Description" maxLength=1000 %}{% /string-field %}

{% instructions ref="description" %}
2-3 paragraph summary of the company, product, and market.
Source: Company website About page, crunchbase.com, Wikipedia if notable.
{% /instructions %}

{% string-list id="basic_info_sources" label="Company Overview Sources" %}{% /string-list %}

{% instructions ref="basic_info_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="founders_section" title="Founders & Key People" %}

{% description ref="founders_section" %}
List up to 4 founders/co-founders. Leave unused slots empty.
Sources: Company website Team/About page, linkedin.com profiles, crunchbase.com people section.
{% /description %}

{% string-field id="founder_1_name" label="Founder 1 Name" %}{% /string-field %}
{% string-field id="founder_1_title" label="Founder 1 Title" %}{% /string-field %}
{% string-field id="founder_1_linkedin" label="Founder 1 LinkedIn URL" %}{% /string-field %}
{% string-field id="founder_1_background" label="Founder 1 Background" maxLength=500 %}{% /string-field %}

{% instructions ref="founder_1_background" %}
Brief background: prior companies, notable roles, education.
{% /instructions %}

{% string-field id="founder_2_name" label="Founder 2 Name" %}{% /string-field %}
{% string-field id="founder_2_title" label="Founder 2 Title" %}{% /string-field %}
{% string-field id="founder_2_linkedin" label="Founder 2 LinkedIn URL" %}{% /string-field %}
{% string-field id="founder_2_background" label="Founder 2 Background" maxLength=500 %}{% /string-field %}

{% string-field id="founder_3_name" label="Founder 3 Name" %}{% /string-field %}
{% string-field id="founder_3_title" label="Founder 3 Title" %}{% /string-field %}
{% string-field id="founder_3_linkedin" label="Founder 3 LinkedIn URL" %}{% /string-field %}
{% string-field id="founder_3_background" label="Founder 3 Background" maxLength=500 %}{% /string-field %}

{% string-field id="founder_4_name" label="Founder 4 Name" %}{% /string-field %}
{% string-field id="founder_4_title" label="Founder 4 Title" %}{% /string-field %}
{% string-field id="founder_4_linkedin" label="Founder 4 LinkedIn URL" %}{% /string-field %}
{% string-field id="founder_4_background" label="Founder 4 Background" maxLength=500 %}{% /string-field %}

{% string-list id="founders_sources" label="Founders Sources" %}{% /string-list %}

{% instructions ref="founders_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="funding_section" title="Funding History" %}

{% string-field id="total_funding" label="Total Funding Raised" %}{% /string-field %}

{% instructions ref="total_funding" %}
Total known funding (e.g., "$150M").
Source: crunchbase.com, pitchbook.com, or press releases.
{% /instructions %}

{% string-field id="last_valuation" label="Last Known Valuation" %}{% /string-field %}

{% instructions ref="last_valuation" %}
Most recent valuation if publicly known (e.g., "$1.5B").
Source: Press releases, crunchbase.com, pitchbook.com.
{% /instructions %}

{% table-field id="funding_rounds" label="Funding Rounds" %}
| Round Type | Date | Amount | Lead Investor(s) | Source URL |
| string | string | string | string | url |
|----|----|----|----|----|
{% /table-field %}

{% instructions ref="funding_rounds" %}
Most recent first. Date format: YYYY-MM
Example: Series B | 2023-06 | $50M | Sequoia Capital | https://techcrunch.com/...
Source: crunchbase.com funding rounds, pitchbook.com, techcrunch.com, company press releases.
{% /instructions %}

{% string-list id="funding_sources" label="Funding Sources" %}{% /string-list %}

{% instructions ref="funding_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="competitors_section" title="Competitors & Market Position" %}

{% string-field id="market_category" label="Market Category" %}{% /string-field %}

{% instructions ref="market_category" %}
Primary market/category (e.g., "Developer Tools", "HR Tech", "FinTech - Payments").
Source: crunchbase.com categories, g2.com categories.
{% /instructions %}

{% table-field id="competitors" label="Key Competitors" minRows=0 maxRows=5 %}
| Company Name | Website | One-liner | Funding/Stage | Source URL |
| string | url | string | string | url |
|----|----|----|----|----|
{% /table-field %}

{% instructions ref="competitors" %}
List 3-5 main competitors.
Example: Notion | https://notion.so | All-in-one workspace | $275M Series C | https://crunchbase.com/...
Source: crunchbase.com competitors section, g2.com alternatives, company investor decks, press comparisons.
{% /instructions %}

{% string-field id="competitive_positioning" label="Competitive Positioning" maxLength=500 %}{% /string-field %}

{% instructions ref="competitive_positioning" %}
How does this company differentiate? Key advantages/disadvantages vs competitors.
Source: Company website, product pages, press interviews, g2.com reviews.
{% /instructions %}

{% string-list id="competitors_sources" label="Competitors Sources" %}{% /string-list %}

{% instructions ref="competitors_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="social_media_section" title="Social Media Presence" %}

{% description ref="social_media_section" %}
Search each platform directly for official company accounts. Note follower counts and activity level.
{% /description %}

{% string-field id="twitter_x" label="Twitter/X" %}{% /string-field %}

{% instructions ref="twitter_x" %}
Format: "@handle | Followers | Last post date | URL"
Example: "@stripe | 850K followers | Active daily | https://twitter.com/stripe"
Source: Search x.com (twitter.com) directly for company name.
{% /instructions %}

{% string-field id="linkedin_company" label="LinkedIn Company Page" %}{% /string-field %}

{% instructions ref="linkedin_company" %}
Format: "Followers | Employees on LinkedIn | URL"
Example: "500K followers | 2,500 employees | https://linkedin.com/company/stripe"
Source: Search linkedin.com/company/ for company name.
{% /instructions %}

{% string-field id="youtube" label="YouTube" %}{% /string-field %}

{% instructions ref="youtube" %}
Format: "Channel name | Subscribers | Videos | URL"
Example: "Stripe | 45K subscribers | 150 videos | https://youtube.com/@stripe"
Source: Search youtube.com for company name. Note if no official channel exists.
{% /instructions %}

{% string-field id="instagram" label="Instagram" %}{% /string-field %}

{% instructions ref="instagram" %}
Format: "@handle | Followers | URL" or "Not found"
Source: Search instagram.com for company name. Many B2B companies don't have Instagram presence.
{% /instructions %}

{% string-field id="tiktok" label="TikTok" %}{% /string-field %}

{% instructions ref="tiktok" %}
Format: "@handle | Followers | URL" or "Not found"
Source: Search tiktok.com for company name. Primarily relevant for consumer-facing companies.
{% /instructions %}

{% string-field id="facebook" label="Facebook" %}{% /string-field %}

{% instructions ref="facebook" %}
Format: "Page name | Followers | URL" or "Not found"
Source: Search facebook.com for company name.
{% /instructions %}

{% string-field id="discord" label="Discord" %}{% /string-field %}

{% instructions ref="discord" %}
Format: "Server name | Members | Invite URL" or "Not found"
Source: Check company website footer/community links, or web search "company name discord".
{% /instructions %}

{% string-field id="reddit" label="Reddit Presence" %}{% /string-field %}

{% instructions ref="reddit" %}
Format: "r/subreddit | Members | URL" or "No official subreddit"
Also note if there are significant discussions in related subreddits.
Source: Search reddit.com for company name, check for official subreddit.
{% /instructions %}

{% string-list id="social_media_sources" label="Social Media Sources" %}{% /string-list %}

{% instructions ref="social_media_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="hacker_news_section" title="Hacker News Presence" %}

{% table-field id="hn_posts" label="Notable Hacker News Posts" minRows=0 maxRows=5 %}
| Title | Date | Points | Comments | URL |
| string | date | number | number | url |
|----|----|----|----|----|
{% /table-field %}

{% instructions ref="hn_posts" %}
List top 3-5 HN posts by points/relevance.
Include: Show HN launches, funding announcements, major discussions about the company.
Source: Search hn.algolia.com for company name, product name, and founder names.
{% /instructions %}

{% string-list id="hacker_news_sources" label="Hacker News Sources" %}{% /string-list %}

{% instructions ref="hacker_news_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="product_hunt_section" title="Product Hunt Presence" %}

{% table-field id="ph_launches" label="Product Hunt Launches" %}
| Product Name | Date | Upvotes | Badges | URL |
| string | date | number | string | url |
|----|----|----|----|----|
{% /table-field %}

{% instructions ref="ph_launches" %}
Note any badges: Product of the Day/Week/Month, Golden Kitty, etc.
Source: Search producthunt.com for company name and product names.
{% /instructions %}

{% string-list id="product_hunt_sources" label="Product Hunt Sources" %}{% /string-list %}

{% instructions ref="product_hunt_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="deep_intel_section" title="Deep Intelligence Sources" %}

{% description ref="deep_intel_section" %}
Alternative sources for deeper startup intelligence beyond standard databases.
{% /description %}

{% string-field id="tech_stack" label="Tech Stack" maxLength=500 %}{% /string-field %}

{% instructions ref="tech_stack" %}
Known technologies used (frameworks, infrastructure, tools).
Source: builtwith.com, wappalyzer.com, stackshare.io, job postings, engineering blog.
{% /instructions %}

{% string-field id="github_presence" label="GitHub Presence" %}{% /string-field %}

{% instructions ref="github_presence" %}
Format: "Org URL | Public repos | Total stars | Notable repos"
Example: "github.com/stripe | 150 repos | 50K+ stars | stripe-js (5K stars)"
Source: Search github.com for company name. Check for open source projects, SDKs, developer tools.
{% /instructions %}

{% string-field id="product_reviews" label="Product Reviews (G2/Capterra)" %}{% /string-field %}

{% instructions ref="product_reviews" %}
Format: "Platform | Rating | # Reviews | URL"
Example: "G2 | 4.5/5 | 1,200 reviews | https://g2.com/products/..."
Source: g2.com, capterra.com, trustradius.com (primarily for B2B SaaS).
{% /instructions %}

{% string-field id="app_store_presence" label="App Store Presence" %}{% /string-field %}

{% instructions ref="app_store_presence" %}
Format: "iOS: Rating (# reviews) | Android: Rating (# reviews) | URLs"
Example: "iOS: 4.8 (50K reviews) | Android: 4.6 (100K reviews)"
Source: Apple App Store (apps.apple.com), Google Play Store (play.google.com). Note if no mobile apps exist.
{% /instructions %}

{% string-field id="glassdoor_rating" label="Glassdoor Rating" %}{% /string-field %}

{% instructions ref="glassdoor_rating" %}
Format: "Rating | # Reviews | CEO Approval | URL"
Example: "4.2/5 | 500 reviews | 85% CEO approval | https://glassdoor.com/..."
Source: glassdoor.com. Provides employee sentiment and culture insights.
{% /instructions %}

{% table-field id="hiring_signals" label="Hiring Signals" %}
| Department | Roles | Notable Positions |
| string | string | string |
|----|----|----|
{% /table-field %}

{% instructions ref="hiring_signals" %}
Current job openings that indicate growth areas.
Example: Engineering | 25 roles | Staff ML Engineer, Platform Lead
Source: Company careers page, linkedin.com/company/jobs, lever.co, greenhouse.io job boards.
{% /instructions %}

{% string-field id="patents" label="Patents" %}{% /string-field %}

{% instructions ref="patents" %}
Format: "# Patents filed/granted | Key patent areas | Source"
Example: "12 patents granted | NLP, recommendation systems | patents.google.com"
Source: patents.google.com, USPTO (uspto.gov), Espacenet. Search for company name and founder names.
{% /instructions %}

{% table-field id="podcast_interviews" label="Podcast/Video Interviews" %}
| Title | Podcast/Show | Date | URL |
| string | string | string | url |
|----|----|----|----|
{% /table-field %}

{% instructions ref="podcast_interviews" %}
Notable founder or exec interviews.
Example: Building Stripe | How I Built This | 2021-03 | https://youtube.com/...
Source: youtube.com, Spotify, Apple Podcasts. Search for founder names + "interview" or "podcast".
{% /instructions %}

{% string-field id="wayback_history" label="Company Evolution (Wayback)" %}{% /string-field %}

{% instructions ref="wayback_history" %}
Notable pivots or changes observed from historical website snapshots.
Example: "2019: Originally 'PaymentsAPI' focused on SMB; 2021: Rebranded, pivoted to enterprise"
Source: web.archive.org - search for company domain, review snapshots from different years.
{% /instructions %}

{% string-list id="deep_intel_sources" label="Deep Intel Sources" %}{% /string-list %}

{% instructions ref="deep_intel_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="press_section" title="Notable Press Coverage" %}

{% table-field id="press_coverage" label="Press Articles" minRows=0 maxRows=5 %}
| Title | Publication | Date | URL |
| string | string | date | url |
|----|----|----|----|
{% /table-field %}

{% instructions ref="press_coverage" %}
List 3-5 most notable press articles.
Focus on: funding announcements, major product launches, company profiles, notable interviews.
Source: techcrunch.com, theinformation.com, bloomberg.com, forbes.com, wired.com, venturebeat.com, company Press page.
{% /instructions %}

{% string-list id="press_sources" label="Press Coverage Sources" %}{% /string-list %}

{% instructions ref="press_sources" %}
URLs used as sources for this section. One URL per line.
{% /instructions %}

{% /field-group %}

{% field-group id="sources_section" title="Research Metadata" %}

{% date-field id="research_date" label="Research Date" required=true %}{% /date-field %}

{% instructions ref="research_date" %}
Date this research was conducted. Important for tracking data freshness.
{% /instructions %}

{% string-field id="research_notes" label="Research Notes" maxLength=1000 %}{% /string-field %}

{% instructions ref="research_notes" %}
Any caveats, limitations, or notes about the research (e.g., "PitchBook access unavailable", "Company is in stealth mode", "Limited public information available", "Paywalled sources not accessed").
{% /instructions %}

{% /field-group %}

{% /form %}
