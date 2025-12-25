---
markform:
  markform_version: "0.1.0"
  roles:
    - user
    - agent
  role_instructions:
    user: "Enter the name of the startup company you want to research."
    agent: |
      Research and fill in all company information for the specified startup.
      Guidelines:
      1. Start with Crunchbase - The company's Crunchbase page is the primary source
      2. Verify with company website and press releases
      3. Use official formats - Dates as YYYY-MM-DD, funding as USD amounts
      4. Fill funding rounds chronologically - Most recent first
      5. Include all relevant URLs - Website, LinkedIn, press coverage
      6. Leave unknown fields empty - Don't guess or fabricate information
      7. Keep descriptions concise - Aim for 100-200 words max
---

{% form id="startup_research" title="Startup Research Form" %}

{% description ref="startup_research" %}
A comprehensive research form for startup companies. This form demonstrates URL field types
for capturing company websites, funding sources, press coverage, and other web references.
The user provides the company name, and the agent researches and fills all remaining fields.
{% /description %}

{% documentation ref="startup_research" %}
**Workflow:**
1. User enters the startup company name
2. Agent researches and fills company information
3. Agent includes all relevant URLs (website, LinkedIn, press, funding sources)
4. Agent provides source citations

**Data Sources:**
- Crunchbase profiles
- Company websites
- Press releases
- LinkedIn company pages
- Tech news publications
{% /documentation %}

{% field-group id="basic_info" title="Company Information" %}

{% string-field id="company_name" label="Company Name" role="user" required=true minLength=2 maxLength=200 %}
```value
Anthropic
```
{% /string-field %}

{% instructions ref="company_name" %}
Enter the official name of the startup company you want to research (e.g., "Stripe", "OpenAI").
{% /instructions %}

{% url-field id="company_website" label="Company Website" required=true %}
```value
https://www.anthropic.com
```
{% /url-field %}

{% instructions ref="company_website" %}
The official company website URL.
{% /instructions %}

{% url-field id="linkedin_page" label="LinkedIn Company Page" %}
```value
https://www.linkedin.com/company/anthropic
```
{% /url-field %}

{% instructions ref="linkedin_page" %}
LinkedIn company page URL if available.
{% /instructions %}

{% string-field id="founded_date" label="Founded Date" pattern="^\\d{4}(-\\d{2}(-\\d{2})?)?$" %}
```value
2021
```
{% /string-field %}

{% instructions ref="founded_date" %}
Format: YYYY, YYYY-MM, or YYYY-MM-DD (e.g., 2010, 2010-06, 2010-06-15)
{% /instructions %}

{% string-field id="headquarters" label="Headquarters Location" %}
```value
San Francisco, California
```
{% /string-field %}

{% instructions ref="headquarters" %}
Format: City, State/Country (e.g., "San Francisco, California")
{% /instructions %}

{% string-field id="company_description" label="Company Description" multiline=true maxLength=1000 %}
```value
Anthropic is an AI safety company focused on building reliable, interpretable, and steerable AI systems. Founded by former members of OpenAI, the company develops large language models with an emphasis on safety research and alignment. Their flagship product is Claude, an AI assistant designed to be helpful, harmless, and honest.
```
{% /string-field %}

{% instructions ref="company_description" %}
Brief description of what the company does. 100-200 words max.
{% /instructions %}

{% /field-group %}

{% field-group id="funding_info" title="Funding Information" %}

{% string-field id="total_funding" label="Total Funding Raised" pattern="^\\$[0-9]+(\\.[0-9]+)?(K|M|B)?$" %}
```value
$7.6B
```
{% /string-field %}

{% instructions ref="total_funding" %}
Format: $X.XB, $XXM, or $XXK (e.g., "$1.5B", "$50M", "$500K")
{% /instructions %}

{% string-field id="latest_valuation" label="Latest Valuation" pattern="^\\$[0-9]+(\\.[0-9]+)?(K|M|B)?$" %}
```value
$18.4B
```
{% /string-field %}

{% instructions ref="latest_valuation" %}
Format: $X.XB, $XXM, or $XXK (e.g., "$10B")
{% /instructions %}

{% single-select id="funding_stage" label="Funding Stage" %}
- [ ] Pre-seed {% #pre_seed %}
- [ ] Seed {% #seed %}
- [ ] Series A {% #series_a %}
- [ ] Series B {% #series_b %}
- [ ] Series C {% #series_c %}
- [x] Series D+ {% #series_d_plus %}
- [ ] Public {% #public %}
{% /single-select %}

{% string-list id="key_investors" label="Key Investors" maxItems=10 %}
```value
Google
Spark Capital
Salesforce Ventures
Amazon
Sound Ventures
```
{% /string-list %}

{% instructions ref="key_investors" %}
List notable investors (VCs, angels), one per line.
{% /instructions %}

{% url-list id="funding_announcements" label="Funding Announcement URLs" maxItems=5 uniqueItems=true %}
```value
https://www.anthropic.com/news/anthropic-raises-series-c
https://techcrunch.com/2023/09/25/amazon-to-invest-up-to-4-billion-in-anthropic/
```
{% /url-list %}

{% instructions ref="funding_announcements" %}
URLs to press releases or articles about funding rounds.
{% /instructions %}

{% /field-group %}

{% field-group id="people" title="Key People" %}

{% string-field id="ceo" label="CEO / Founder" %}
```value
Dario Amodei
```
{% /string-field %}

{% instructions ref="ceo" %}
Name of CEO or primary founder.
{% /instructions %}

{% url-field id="ceo_linkedin" label="CEO LinkedIn" %}
```value
https://www.linkedin.com/in/dario-amodei
```
{% /url-field %}

{% instructions ref="ceo_linkedin" %}
LinkedIn profile URL of the CEO/founder.
{% /instructions %}

{% string-list id="founders" label="Founders" maxItems=5 %}
```value
Dario Amodei
Daniela Amodei
Tom Brown
Chris Olah
Sam McCandlish
```
{% /string-list %}

{% instructions ref="founders" %}
List all founders, one per line.
{% /instructions %}

{% number-field id="employee_count" label="Employee Count" min=1 integer=true %}
```value
1000
```
{% /number-field %}

{% instructions ref="employee_count" %}
Approximate number of employees.
{% /instructions %}

{% /field-group %}

{% field-group id="market_info" title="Market & Industry" %}

{% multi-select id="industry_sectors" label="Industry Sectors" minSelections=1 maxSelections=5 %}
- [x] AI/ML {% #ai_ml %}
- [ ] FinTech {% #fintech %}
- [ ] HealthTech {% #healthtech %}
- [ ] EdTech {% #edtech %}
- [x] SaaS {% #saas %}
- [ ] E-commerce {% #ecommerce %}
- [x] Security {% #security %}
- [x] Developer Tools {% #devtools %}
- [ ] Climate Tech {% #climatetech %}
- [ ] Other {% #other %}
{% /multi-select %}

{% string-list id="competitors" label="Competitors" maxItems=5 %}
```value
OpenAI
Google DeepMind
Cohere
Mistral AI
```
{% /string-list %}

{% instructions ref="competitors" %}
List main competitors, one per line.
{% /instructions %}

{% url-list id="competitor_urls" label="Competitor Website URLs" maxItems=5 uniqueItems=true %}
```value
https://openai.com
https://deepmind.google
https://cohere.com
https://mistral.ai
```
{% /url-list %}

{% instructions ref="competitor_urls" %}
Website URLs of main competitors.
{% /instructions %}

{% /field-group %}

{% field-group id="press_coverage" title="Press & Coverage" %}

{% url-list id="press_articles" label="Press Coverage URLs" minItems=1 maxItems=10 uniqueItems=true %}
```value
https://www.wired.com/story/anthropic-ai-claude-chatgpt-rival/
https://www.nytimes.com/2023/03/14/technology/anthropic-ai-chatbot.html
https://www.forbes.com/sites/alexkonrad/2023/09/25/anthropic-ai-amazon-investment/
```
{% /url-list %}

{% instructions ref="press_articles" %}
URLs to major press articles, reviews, or coverage about the company.
{% /instructions %}

{% url-field id="crunchbase_url" label="Crunchbase Profile" %}
```value
https://www.crunchbase.com/organization/anthropic
```
{% /url-field %}

{% instructions ref="crunchbase_url" %}
Crunchbase company profile URL.
{% /instructions %}

{% url-field id="pitchbook_url" label="PitchBook Profile" %}{% /url-field %}

{% instructions ref="pitchbook_url" %}
PitchBook company profile URL if available.
{% /instructions %}

{% /field-group %}

{% field-group id="sources_section" title="Research Sources" %}

{% url-list id="sources" label="Source URLs" minItems=1 uniqueItems=true %}
```value
https://www.crunchbase.com/organization/anthropic
https://www.anthropic.com
https://www.linkedin.com/company/anthropic
https://en.wikipedia.org/wiki/Anthropic
```
{% /url-list %}

{% instructions ref="sources" %}
List all source URLs used for this research. Include Crunchbase, company website, and any additional sources consulted.
{% /instructions %}

{% /field-group %}

{% /form %}
