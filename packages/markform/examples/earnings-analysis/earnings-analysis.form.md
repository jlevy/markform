---
markform:
  spec: MF/0.1
  title: Earnings Analysis
  description: Company earnings analysis with key metrics, outlook, and custom validators.
  roles:
    - user
    - agent
  role_instructions:
    user: "Enter the company name and ticker symbol."
    agent: |
      Research the company and fill in the key financial metrics and analysis.
      Focus on the most recent quarterly results and forward outlook.
---
{% form id="earnings_analysis" title="Earnings Analysis" %}

## Company Earnings Analysis

{% field-group id="company_input" title="Company Identification" %}

Which company do you want to analyze? \[*This field is filled in by the user (`role="user"`).*\]

{% field kind="string" id="company" label="Company" role="user" required=true minLength=1 maxLength=300 %}{% /field %}
{% instructions ref="company" %}Enter the company name and ticker symbol (e.g., "Apple (AAPL)" or "Microsoft MSFT").{% /instructions %}

{% /field-group %}

## Company Overview

{% field-group id="company_overview" title="Company Overview" %}

**Company name:**

{% field kind="string" id="company_name" label="Company Name" role="agent" required=true %}{% /field %}
{% instructions ref="company_name" %}Official company name.{% /instructions %}

**Ticker symbol:**

{% field kind="string" id="ticker" label="Ticker Symbol" role="agent" required=true %}{% /field %}

**Exchange:**

{% field kind="string" id="exchange" label="Exchange" role="agent" %}{% /field %}
{% instructions ref="exchange" %}Primary stock exchange (e.g., NYSE, NASDAQ).{% /instructions %}

**Sector:**

{% field kind="string" id="sector" label="Sector" role="agent" %}{% /field %}

**Business summary:**

{% field kind="string" id="business_summary" label="Business Summary" role="agent" maxLength=500 validate=[{id: "min_words", min: 20}] %}{% /field %}
{% instructions ref="business_summary" %}Brief description of what the company does. Minimum 20 words.{% /instructions %}

**Revenue segments:**

{% field kind="string_list" id="revenue_segments" label="Revenue Segments" role="agent" minItems=1 validate=[{id: "sum_to_percent_list", target: 100}] %}{% /field %}
{% instructions ref="revenue_segments" %}List each segment with percentage of revenue. Format: "Segment Name: XX%". Should sum to 100%.{% /instructions %}

{% /field-group %}

## Recent Earnings

{% field-group id="recent_earnings" title="Recent Earnings" %}

**Fiscal quarter:**

{% field kind="string" id="fiscal_quarter" label="Fiscal Quarter" role="agent" required=true %}{% /field %}
{% instructions ref="fiscal_quarter" %}Most recent reported quarter (e.g., "Q3 FY2024" or "Q4 2024").{% /instructions %}

**Revenue:**

{% field kind="number" id="revenue" label="Revenue (millions)" role="agent" %}{% /field %}
{% instructions ref="revenue" %}Total revenue in millions USD.{% /instructions %}

**Revenue growth YoY:**

{% field kind="number" id="revenue_growth" label="Revenue Growth YoY (%)" role="agent" min=-100 max=1000 %}{% /field %}

**EPS:**

{% field kind="number" id="eps" label="Earnings Per Share" role="agent" %}{% /field %}
{% instructions ref="eps" %}Diluted EPS for the quarter.{% /instructions %}

**Beat/miss consensus:**

{% field kind="single_select" id="beat_miss" label="Beat/Miss Consensus" role="agent" %}
- [ ] Beat {% #beat %}
- [ ] Met {% #met %}
- [ ] Missed {% #missed %}
{% /field %}

**Beat/miss details:**

{% field kind="string" id="beat_miss_details" label="Beat/Miss Details" role="agent" validate=[{id: "required_if_set", when: "beat_miss"}] %}{% /field %}
{% instructions ref="beat_miss_details" %}Required if beat/miss is selected. Explain the variance from consensus.{% /instructions %}

{% /field-group %}

## Key Metrics

{% field-group id="key_metrics" title="Key Metrics" %}

**Gross margin:**

{% field kind="number" id="gross_margin" label="Gross Margin (%)" role="agent" min=0 max=100 %}{% /field %}

**Operating margin:**

{% field kind="number" id="operating_margin" label="Operating Margin (%)" role="agent" min=-100 max=100 %}{% /field %}

**Market cap:**

{% field kind="number" id="market_cap" label="Market Cap (billions)" role="agent" %}{% /field %}
{% instructions ref="market_cap" %}Current market capitalization in billions USD.{% /instructions %}

**P/E ratio:**

{% field kind="number" id="pe_ratio" label="P/E Ratio" role="agent" %}{% /field %}
{% instructions ref="pe_ratio" %}Trailing twelve month P/E ratio.{% /instructions %}

{% /field-group %}

## Outlook

{% field-group id="outlook" title="Outlook" %}

**Guidance:**

{% field kind="string" id="guidance" label="Forward Guidance" role="agent" maxLength=500 %}{% /field %}
{% instructions ref="guidance" %}Summary of company's forward guidance for next quarter/year.{% /instructions %}

**Key risks:**

{% field kind="string_list" id="key_risks" label="Key Risks" role="agent" minItems=0 maxItems=5 %}{% /field %}
{% instructions ref="key_risks" %}Primary risks or concerns (up to 5).{% /instructions %}

**Analyst sentiment:**

{% field kind="single_select" id="analyst_sentiment" label="Analyst Sentiment" role="agent" %}
- [ ] Bullish {% #bullish %}
- [ ] Neutral {% #neutral %}
- [ ] Bearish {% #bearish %}
{% /field %}

**Sentiment rationale:**

{% field kind="string" id="sentiment_rationale" label="Sentiment Rationale" role="agent" validate=[{id: "required_if_set", when: "analyst_sentiment"}, {id: "min_words", min: 10}] %}{% /field %}
{% instructions ref="sentiment_rationale" %}Required if sentiment is selected. Explain why (minimum 10 words).{% /instructions %}

**Summary:**

{% field kind="string" id="summary" label="One-Line Summary" role="agent" maxLength=300 validate=[{id: "min_words", min: 10}, {id: "max_words", max: 50}] %}{% /field %}
{% instructions ref="summary" %}Brief overall assessment (10-50 words).{% /instructions %}

{% /field-group %}

{% /form %}
