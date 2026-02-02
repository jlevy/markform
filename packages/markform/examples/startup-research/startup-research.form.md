---
markform:
  spec: MF/0.1
  run_mode: research
  role_instructions:
    user: Enter the name of the startup company you want to research.
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

<!-- form id="startup_research" title="Startup Research Form" -->

<!-- description ref="startup_research" -->
A comprehensive research form for startup companies.
This form demonstrates URL field types for capturing company websites, funding sources,
press coverage, and other web references.
The user provides the company name, and the agent researches and fills all remaining
fields.
<!-- /description -->

<!-- group id="basic_info" title="Company Information" -->

<!-- field kind="string" id="company_name" role="user" label="Company Name" maxLength=200 minLength=2 required=true --><!-- /field -->

<!-- instructions ref="company_name" -->
Enter the official name of the startup company you want to research (e.g., “Stripe”,
“OpenAI”).
<!-- /instructions -->

<!-- field kind="url" id="company_website" label="Company Website" required=true --><!-- /field -->

<!-- instructions ref="company_website" -->
The official company website URL.
<!-- /instructions -->

<!-- field kind="url" id="linkedin_page" label="LinkedIn Company Page" --><!-- /field -->

<!-- instructions ref="linkedin_page" -->
LinkedIn company page URL if available.
<!-- /instructions -->

<!-- field kind="string" id="founded_date" label="Founded Date" pattern="^\\d{4}(-\\d{2}(-\\d{2})?)?$" --><!-- /field -->

<!-- instructions ref="founded_date" -->
Format: YYYY, YYYY-MM, or YYYY-MM-DD (e.g., 2010, 2010-06, 2010-06-15)
<!-- /instructions -->

<!-- field kind="string" id="headquarters" label="Headquarters Location" --><!-- /field -->

<!-- instructions ref="headquarters" -->
Format: City, State/Country (e.g., “San Francisco, California”)
<!-- /instructions -->

<!-- field kind="string" id="company_description" label="Company Description" maxLength=1000 multiline=true --><!-- /field -->

<!-- instructions ref="company_description" -->
Brief description of what the company does.
100-200 words max.
<!-- /instructions -->

<!-- /group -->

<!-- group id="funding_info" title="Funding Information" -->

<!-- field kind="string" id="total_funding" label="Total Funding Raised" pattern="^\\$[0-9]+(\\.[0-9]+)?(K|M|B)?$" --><!-- /field -->

<!-- instructions ref="total_funding" -->
Format: $X.XB, $XXM, or $XXK (e.g., “$1.5B”, “$50M”, “$500K”)
<!-- /instructions -->

<!-- field kind="string" id="latest_valuation" label="Latest Valuation" pattern="^\\$[0-9]+(\\.[0-9]+)?(K|M|B)?$" --><!-- /field -->

<!-- instructions ref="latest_valuation" -->
Format: $X.XB, $XXM, or $XXK (e.g., “$10B”)
<!-- /instructions -->

<!-- field kind="single_select" id="funding_stage" label="Funding Stage" -->
- [ ] Pre-seed <!-- #pre_seed -->
- [ ] Seed <!-- #seed -->
- [ ] Series A <!-- #series_a -->
- [ ] Series B <!-- #series_b -->
- [ ] Series C <!-- #series_c -->
- [ ] Series D+ <!-- #series_d_plus -->
- [ ] Public <!-- #public -->
<!-- /field -->

<!-- field kind="table" id="funding_rounds" columnIds=["round_type", "date", "amount", "lead_investors", "source_url"] columnLabels=["Round Type", "Date", "Amount", "Lead Investor(s)", "Source URL"] columnTypes=["string", "string", "string", "string", "url"] label="Funding Rounds" maxRows=10 minRows=0 --><!-- /field -->

<!-- instructions ref="funding_rounds" -->
List funding rounds, most recent first.
Date format: YYYY-MM. Example: Series B | 2023-06 | $50M | Sequoia Capital |
https://techcrunch.com/...
<!-- /instructions -->

<!-- /group -->

<!-- group id="people" title="Key People" -->

<!-- field kind="table" id="founders" columnIds=["name", "title", "linkedin"] columnLabels=["Name", "Title", "LinkedIn URL"] columnTypes=["string", "string", "url"] label="Founders" maxRows=5 minRows=1 --><!-- /field -->

<!-- instructions ref="founders" -->
List founders and co-founders.
Include name, current title, and LinkedIn profile URL.
<!-- /instructions -->

<!-- field kind="number" id="employee_count" integer=true label="Employee Count" min=1 --><!-- /field -->

<!-- instructions ref="employee_count" -->
Approximate number of employees.
<!-- /instructions -->

<!-- /group -->

<!-- group id="market_info" title="Market & Industry" -->

<!-- field kind="multi_select" id="industry_sectors" label="Industry Sectors" maxSelections=5 minSelections=1 -->
- [ ] AI/ML <!-- #ai_ml -->
- [ ] FinTech <!-- #fintech -->
- [ ] HealthTech <!-- #healthtech -->
- [ ] EdTech <!-- #edtech -->
- [ ] SaaS <!-- #saas -->
- [ ] E-commerce <!-- #ecommerce -->
- [ ] Security <!-- #security -->
- [ ] Developer Tools <!-- #devtools -->
- [ ] Climate Tech <!-- #climatetech -->
- [ ] Other <!-- #other -->
<!-- /field -->

<!-- field kind="table" id="competitors" columnIds=["company_name", "website", "one_liner"] columnLabels=["Company Name", "Website", "One-liner"] columnTypes=["string", "url", "string"] label="Key Competitors" maxRows=5 minRows=0 --><!-- /field -->

<!-- instructions ref="competitors" -->
List main competitors with their website and a brief description.
<!-- /instructions -->

<!-- /group -->

<!-- group id="press_coverage" title="Press & Coverage" -->

<!-- field kind="table" id="press_articles" columnIds=["title", "publication", "date", "url"] columnLabels=["Title", "Publication", "Date", "URL"] columnTypes=["string", "string", "date", "url"] label="Press Coverage" maxRows=10 minRows=1 --><!-- /field -->

<!-- instructions ref="press_articles" -->
Notable press articles, reviews, or coverage about the company.
<!-- /instructions -->

<!-- field kind="url" id="crunchbase_url" label="Crunchbase Profile" --><!-- /field -->

<!-- instructions ref="crunchbase_url" -->
Crunchbase company profile URL.
<!-- /instructions -->

<!-- field kind="url" id="pitchbook_url" label="PitchBook Profile" --><!-- /field -->

<!-- instructions ref="pitchbook_url" -->
PitchBook company profile URL if available.
<!-- /instructions -->

<!-- /group -->

<!-- group id="sources_section" title="Research Sources" -->

<!-- field kind="url_list" id="sources" label="Source URLs" minItems=1 uniqueItems=true --><!-- /field -->

<!-- instructions ref="sources" -->
List all source URLs used for this research.
Include Crunchbase, company website, and any additional sources consulted.
<!-- /instructions -->

<!-- /group -->

<!-- /form -->



