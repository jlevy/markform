---
markform:
  spec: MF/0.1
  title: Company Quarterly Analysis
  description: Financial analysis with one user field (company) and agent-filled quarterly analysis sections.
  roles:
    - user
    - agent
  role_instructions:
    user: "Enter company identification (legal name, ticker, fiscal year) and the quarter you want analyzed."
    agent: "Complete the company profile and quarterly analysis based on the provided company context."
  harness_config:
    max_issues_per_turn: 5
    max_patches_per_turn: 10
---

{% form id="company_analysis" title="Company Quarterly Analysis Worksheet" %}

{% description ref="company_analysis" %}
This worksheet supports systematic research on a company for a given quarter.
It has two parts: a relatively static company profile, and a period-specific analysis section.
{% /description %}

{% documentation ref="company_analysis" %}
**Part 1: Company Profile** — Foundational information that changes slowly.
Update as needed but expect most content to persist quarter-to-quarter.

**Part 2: Quarterly Analysis** — Period-specific analysis.
Complete fresh each quarter.
{% /documentation %}

<!-- PART 1: COMPANY PROFILE -->

{% field-group id="identity_structure" title="1. Identity and Structure" %}

{% field kind="string" id="company_legal_name" label="Company legal name" role="user" required=true %}{% /field %}

{% field kind="string_list" id="tickers" label="Ticker(s)" role="user" required=true minItems=1 %}{% /field %}

{% instructions ref="tickers" %}
List at least one ticker symbol. Add multiple if the company trades on different exchanges.
{% /instructions %}

{% field kind="string" id="hq_regions" label="HQ / key operating regions" required=true %}{% /field %}

{% field kind="string" id="fiscal_year_end" label="Fiscal year end" role="user" required=true pattern="^(0[1-9]|1[0-2])(-(0[1-9]|[12][0-9]|3[01]))?$|^(January|February|March|April|May|June|July|August|September|October|November|December)$" %}{% /field %}

{% instructions ref="fiscal_year_end" %}
Enter month name (e.g., December) or MM-DD format (e.g., 12-31).
{% /instructions %}

{% field kind="single_select" id="reporting_cadence" label="Reporting cadence" required=true %}
- [ ] Yearly {% #yearly %}
- [ ] Quarterly {% #quarterly %}
- [ ] Monthly {% #monthly %}
{% /field %}

{% field kind="multi_select" id="business_model_type" label="Business model type" required=true minSelections=1 %}
- [ ] One-time hardware {% #one_time_hardware %}
- [ ] Recurring subscription {% #recurring_subscription %}
- [ ] Usage-based {% #usage_based %}
- [ ] Advertising {% #advertising %}
- [ ] Marketplace / take rate {% #marketplace %}
- [ ] Licensing {% #licensing %}
- [ ] Services / consulting {% #services %}
- [ ] Financial / credit {% #financial %}
{% /field %}

{% instructions ref="business_model_type" %}
Check all that apply. At least one is required.
{% /instructions %}

{% field kind="string" id="business_model_other" label="Other business model (if applicable)" %}{% /field %}

{% instructions ref="business_model_other" %}
Describe any other business model types not covered above.
{% /instructions %}

{% field kind="string_list" id="subsidiaries" label="Subsidiaries / key entities" minItems=0 %}{% /field %}

{% field kind="string" id="company_summary" label="One-paragraph summary (plain English)" required=true validate=[{id: "min_words", min: 100}] %}{% /field %}

{% instructions ref="company_summary" %}
Provide a plain-English summary of what the company does. Minimum 100 words (approximately 400 characters).
{% /instructions %}

{% /field-group %}

{% field-group id="history_evolution" title="2. History and Evolution" %}

{% field kind="string_list" id="timeline_pivots" label="Timeline (key pivots)" required=true minItems=8 maxItems=12 %}{% /field %}

{% instructions ref="timeline_pivots" %}
List 8-12 key pivotal moments in the company's history. One event per line.
{% /instructions %}

{% field kind="string" id="transformative_acquisitions" label="Transformative acquisitions / divestitures" %}{% /field %}

{% field kind="string" id="leadership_changes" label="Leadership changes that mattered" %}{% /field %}

{% field kind="string" id="past_crises" label="Past crises and responses" %}{% /field %}

{% field kind="string" id="strategic_move_analysis" label="What single strategic move best explains the current model?" required=true validate=[{id: "min_words", min: 50}] %}{% /field %}

{% instructions ref="strategic_move_analysis" %}
Analyst prompt: Explain the strategic move that best explains the current business model. Minimum 50 words.
{% /instructions %}

{% /field-group %}

{% field-group id="operations_distribution" title="3. Operations and Distribution" %}

{% field kind="string" id="core_operating_activities" label="Core operating activities (R&D, manufacturing, distribution)" required=true %}{% /field %}

{% field kind="string" id="key_locations" label="Key locations (R&D hubs, manufacturing, data centers)" %}{% /field %}

{% field kind="multi_select" id="distribution_model" label="Distribution model" required=true minSelections=1 %}
- [ ] Direct (online / retail / salesforce) {% #direct %}
- [ ] Channel / resellers {% #channel %}
- [ ] Carrier / VARs {% #carrier_vars %}
- [ ] Marketplace / app store {% #marketplace_appstore %}
- [ ] OEM / embedded {% #oem_embedded %}
{% /field %}

{% field kind="string" id="distribution_model_other" label="Other distribution model (if applicable)" %}{% /field %}

{% field kind="string" id="direct_indirect_mix" label="Mix of direct vs indirect (if disclosed)" %}{% /field %}

{% instructions ref="direct_indirect_mix" %}
Enter percentages that should sum to 100% (e.g., "Direct: 60%, Indirect: 40%").
{% /instructions %}

{% field kind="string" id="key_partners" label="Key partners required to deliver the product" %}{% /field %}

{% field kind="string" id="capacity_constraints" label="Capacity constraints / bottlenecks" %}{% /field %}

{% /field-group %}

{% field-group id="offerings_primary" title="4.1 Offerings - Primary Family" %}

{% description ref="offerings_primary" %}
Tie every revenue line to something someone buys. Use "families," not SKUs.
This section ideally uses repeating groups (future feature). For now, model one offering family.
{% /description %}

{% field kind="string" id="offering_1_name" label="Offering family name" required=true %}{% /field %}

{% field kind="string" id="offering_1_value_prop" label="Value proposition (1 sentence)" required=true maxLength=250 %}{% /field %}

{% instructions ref="offering_1_value_prop" %}
Maximum 50 words. Describe the core value in one sentence.
{% /instructions %}

{% field kind="single_select" id="offering_1_delivery" label="Delivery type" required=true %}
- [ ] Physical {% #physical %}
- [ ] Digital {% #digital %}
- [ ] Hybrid {% #hybrid %}
{% /field %}

{% field kind="single_select" id="offering_1_revenue_type" label="Revenue type" required=true %}
- [ ] One-time {% #one_time %}
- [ ] Subscription {% #subscription %}
- [ ] Usage-based {% #usage %}
- [ ] Take-rate {% #take_rate %}
- [ ] Advertising {% #ads %}
{% /field %}

{% field kind="string_list" id="offering_1_kpis" label="Primary KPIs" required=true minItems=1 maxItems=5 %}{% /field %}

{% /field-group %}

{% field-group id="offerings_bundles" title="4.2 Offerings - Bundles and Cross-Sell" %}

{% field kind="string" id="what_is_bundled" label="What is bundled?" %}{% /field %}

{% field kind="string" id="attach_paths" label="Attach paths (what gets added after first purchase)" %}{% /field %}

{% field kind="string" id="cannibalization_risks" label="Cannibalization risks" %}{% /field %}

{% /field-group %}

{% field-group id="pricing_structure" title="5.1 Pricing Structure" %}

{% description ref="pricing_structure" %}
Make "pricing power" concrete.
{% /description %}

{% field kind="string" id="pricing_offering_name" label="Offering family" required=true %}{% /field %}

{% field kind="string" id="list_price_range" label="List price / typical range" required=true %}{% /field %}

{% instructions ref="list_price_range" %}
Include currency and range (e.g., "$99-$499 USD" or "€50/month").
{% /instructions %}

{% field kind="multi_select" id="discounting_norms" label="Discounting norms" %}
- [ ] None {% #none %}
- [ ] Seasonal {% #seasonal %}
- [ ] Channel promos {% #channel_promos %}
- [ ] Enterprise {% #enterprise %}
- [ ] Bundles {% #bundles %}
{% /field %}

{% field kind="string" id="contract_length" label="Contract length (B2B)" %}{% /field %}

{% field kind="string" id="contract_renewal" label="Renewal terms" %}{% /field %}

{% field kind="string" id="contract_escalators" label="Price escalators" %}{% /field %}

{% field kind="string" id="payer_vs_user" label="Who pays vs who uses" %}{% /field %}

{% field kind="string" id="arpu_asp_drivers" label="ARPU/ASP drivers" %}{% /field %}

{% field kind="string" id="pricing_changes_recent" label="Pricing changes last 12-18 months" %}{% /field %}

{% /field-group %}

{% field-group id="pricing_margins" title="5.2 Margin and Cost Structure" %}

{% field kind="string" id="primary_cost_drivers" label="Primary cost drivers (COGS, hosting, labor, content, etc.)" required=true %}{% /field %}

{% field kind="string" id="gross_margin_drivers" label="Gross margin drivers (pricing, mix, utilization, scale, FX)" %}{% /field %}

{% field kind="string" id="contribution_margin_framework" label="Contribution margin framework (if applicable)" %}{% /field %}

{% field kind="number" id="cac" label="Customer Acquisition Cost (CAC)" %}{% /field %}

{% field kind="string" id="payback_period" label="Payback period" %}{% /field %}

{% field kind="number" id="ltv" label="Lifetime Value (LTV)" %}{% /field %}

{% field kind="number" id="churn_rate" label="Churn rate (%)" min=0 max=100 %}{% /field %}

{% field kind="string" id="operating_leverage" label="Operating leverage (fixed vs variable costs)" %}{% /field %}

{% field kind="string" id="margin_risks" label="Biggest margin risks" %}{% /field %}

{% /field-group %}

{% field-group id="customers_segmentation" title="6.1 Customer Segmentation" %}

{% field kind="string" id="segment_1" label="Segment 1 (size, needs, willingness to pay)" required=true %}{% /field %}

{% field kind="string" id="segment_2" label="Segment 2" required=true %}{% /field %}

{% field kind="string" id="segment_3" label="Segment 3" %}{% /field %}

{% field kind="string" id="geography_mix" label="Geography mix" required=true %}{% /field %}

{% instructions ref="geography_mix" %}
Enter percentages that should sum to 100% (e.g., "Americas: 55%, EMEA: 30%, APAC: 15%").
{% /instructions %}

{% field kind="string" id="buyer_user_influencer" label="Buyer vs user vs influencer" %}{% /field %}

{% /field-group %}

{% field-group id="customers_buying" title="6.2 Buying Motion" %}

{% field kind="string" id="purchase_trigger" label="What triggers purchase?" required=true %}{% /field %}

{% field kind="string" id="decision_cycle_length" label="Decision cycle length" %}{% /field %}

{% field kind="string" id="replacement_upgrade_cycle" label="Replacement/upgrade cycle (if relevant)" %}{% /field %}

{% field kind="string" id="retention_churn_drivers" label="Retention/churn drivers (if recurring)" %}{% /field %}

{% /field-group %}

{% field-group id="customers_concentration" title="6.3 Concentration and Notable Customers" %}

{% field kind="number" id="top_customer_concentration" label="Customer concentration risk (top customer %)" min=0 max=100 %}{% /field %}

{% field kind="string" id="notable_customers" label="Notable customers / logos (B2B)" %}{% /field %}

{% field kind="string" id="channel_dependencies" label="Channel partner dependencies" %}{% /field %}

{% /field-group %}

{% field-group id="market_competition" title="7. Market and Competition" %}

{% field kind="string" id="primary_markets" label="Primary markets competed in" required=true %}{% /field %}

{% field kind="string" id="tam_sam_som" label="TAM/SAM/SOM (and confidence)" %}{% /field %}

{% instructions ref="tam_sam_som" %}
Include currency values with confidence level (e.g., "TAM: $50B (high), SAM: $10B (medium), SOM: $500M (low)").
{% /instructions %}

{% field kind="string" id="market_growth_cyclicality" label="Market growth rate and cyclicality" %}{% /field %}

{% field kind="string" id="competitors" label="Competitors by category (direct + substitutes)" required=true %}{% /field %}

{% field kind="string_list" id="basis_of_competition" label="Basis of competition (ranked top 5)" required=true minItems=5 maxItems=5 %}{% /field %}

{% instructions ref="basis_of_competition" %}
List exactly 5 competitive factors, ranked by importance. First item is most important.
{% /instructions %}

{% field kind="multi_select" id="moat_diagnosis" label="Moat diagnosis" %}
- [ ] Switching costs {% #switching_costs %}
- [ ] Network effects {% #network_effects %}
- [ ] Brand {% #brand %}
- [ ] Scale / cost advantage {% #scale %}
- [ ] IP {% #ip %}
- [ ] Regulatory barriers {% #regulatory %}
- [ ] Distribution advantage {% #distribution %}
- [ ] Ecosystem {% #ecosystem %}
- [ ] Data advantage {% #data %}
{% /field %}

{% field kind="string" id="moat_explanation" label="Moat explanation" validate=[{id: "required_if", when: "moat_diagnosis"}] %}{% /field %}

{% instructions ref="moat_explanation" %}
Required if any moat is checked above. Explain why these moats apply. Minimum 25 words.
{% /instructions %}

{% field kind="string" id="competitive_risks" label="Competitive risks (price wars, bundling, platform shifts)" %}{% /field %}

{% /field-group %}

{% field-group id="supply_constraints" title="8.1 Supply Constraints" %}

{% field kind="string" id="key_inputs_suppliers" label="Key inputs / suppliers / single-source dependencies" required=true %}{% /field %}

{% field kind="string" id="manufacturing_model" label="Manufacturing/fulfillment model" %}{% /field %}

{% field kind="string" id="critical_commodities" label="Critical commodities / bottlenecks" %}{% /field %}

{% field kind="string" id="logistics_inventory_risks" label="Logistics and inventory risks" %}{% /field %}

{% field kind="string" id="geopolitical_choke_points" label="Geopolitical choke points" %}{% /field %}

{% /field-group %}

{% field-group id="macro_sensitivity" title="8.2 Macro Sensitivity" %}

{% field kind="string_list" id="macro_variables" label="Top 5 macro variables that historically mattered" required=true minItems=5 maxItems=5 %}{% /field %}

{% instructions ref="macro_variables" %}
List exactly 5 macro variables, ranked by importance.
{% /instructions %}

{% field kind="string" id="transmission_mechanism" label="Transmission mechanism (how each impacts revenue/margin/cash)" required=true validate=[{id: "min_words", min: 50}] %}{% /field %}

{% instructions ref="transmission_mechanism" %}
Minimum 50 words. Explain how each macro variable impacts the business.
{% /instructions %}

{% field kind="string" id="historical_episodes" label="Historical episodes (recession/inflation/FX/supply shock)" %}{% /field %}

{% field kind="string" id="leading_indicators" label="Leading indicators to monitor pre-earnings" %}{% /field %}

{% /field-group %}

{% field-group id="financial_history" title="9. Financial History" %}

{% field kind="string" id="trend_summary" label="3-5 year trend summary (revenue, margin, EPS, FCF)" required=true validate=[{id: "min_words", min: 75}] %}{% /field %}

{% instructions ref="trend_summary" %}
Minimum 75 words. Cover revenue, margin, EPS, and free cash flow trends.
{% /instructions %}

{% field kind="string" id="capital_return_policy" label="Capital return policy (buybacks/dividends)" %}{% /field %}

{% field kind="string" id="major_inflection_points" label="Major inflection points (product cycles, pricing shifts, regulation)" %}{% /field %}

{% field kind="string" id="stock_performance_context" label="Stock performance context (vs index/peers)" %}{% /field %}

{% field kind="string" id="multiples_vs_history" label="Multiples context vs history" %}{% /field %}

{% /field-group %}

{% field-group id="open_questions_profile" title="10. Open Questions" %}

{% field kind="string_list" id="unanswered_questions" label="Top unanswered questions (ranked by impact)" minItems=0 maxItems=10 %}{% /field %}

{% field kind="string" id="how_to_answer" label="How to answer (data / calls / sources)" %}{% /field %}

{% field kind="string" id="deadline" label="Deadline (before earnings, next quarter, etc.)" pattern="^\\d{4}-\\d{2}-\\d{2}$|^[A-Za-z].*$" %}{% /field %}

{% instructions ref="deadline" %}
Enter a date (YYYY-MM-DD format) or descriptive text (e.g., "Before Q2 earnings").
{% /instructions %}

{% /field-group %}

<!-- PART 2: QUARTERLY ANALYSIS -->

{% field-group id="quarterly_cover" title="Q1. Cover Sheet" %}

{% description ref="quarterly_cover" %}
This section is period-specific. Complete fresh each quarter.
{% /description %}

{% instructions ref="quarterly_cover" %}
**Recommended Operating Cadence:**
- **T-21 to T-14:** Refresh model + read filings; pick "what matters this quarter"
- **T-14 to T-7:** Build expectations stack; peer read-across; gather alt data / checks
- **T-7 to T-2:** Base/Bull/Bear scenarios + probabilities; pre-mortem; draft trade structure
- **T-1:** Confirm options pricing + positioning; finalize risks and stops
- **Earnings day:** Watchlist + rapid interpretation plan
- **T+1 to T+2:** Post-mortem; update model; document learnings
{% /instructions %}

{% field kind="string" id="pre_earnings_thesis" label="One-sentence thesis (pre-earnings)" required=true maxLength=250 %}{% /field %}

{% instructions ref="pre_earnings_thesis" %}
Maximum 50 words. State your core thesis before the earnings release.
{% /instructions %}

{% field kind="string_list" id="what_matters_top_3" label="What matters this quarter (top 3 drivers)" required=true minItems=3 maxItems=3 %}{% /field %}

{% /field-group %}

{% field-group id="sources_log" title="Q2.1 Sourcing Log" %}

{% description ref="sources_log" %}
Check what you actually used. Fill the log as you go.
{% /description %}

{% instructions ref="sources_log" %}
Maintain a log of sources accessed. Record: Date accessed, Source name, Type/tier, Link or file path, Key takeaways. At least 3 sources required.
{% /instructions %}

{% field kind="table" id="sources_accessed" label="Sources Accessed" required=true minRows=3
   columnIds=["date", "source", "type", "link", "takeaways"]
   columnTypes=[{type: "date", required: true}, {type: "string", required: true}, {type: "string", required: true}, {type: "url", required: true}, {type: "string", required: true}] %}
| Date | Source | Type | Link | Takeaways |
|------|--------|------|------|-----------|
{% /field %}

{% /field-group %}

{% field-group id="sources_sec" title="Q2.2 SEC / Regulatory Documents" %}

{% field kind="checkboxes" id="sec_docs_reviewed" label="SEC documents reviewed" checkboxMode="simple" %}
- [ ] 10-K (latest) {% #ten_k %}
- [ ] 10-Q (latest) {% #ten_q %}
- [ ] 8-K earnings release (current quarter) {% #eight_k_current %}
- [ ] Prior quarter 8-K earnings release {% #eight_k_prior %}
- [ ] Proxy (DEF 14A) {% #proxy %}
- [ ] S-1 / 20-F / 6-K (if applicable) {% #s1_20f_6k %}
- [ ] Insider trading filings (Forms 3/4/5) {% #insider_filings %}
- [ ] 13D/13G {% #thirteen_d_g %}
- [ ] 13F read-through (if relevant) {% #thirteen_f %}
{% /field %}

{% /field-group %}

{% field-group id="sources_company" title="Q2.3 Company Communications" %}

{% field kind="checkboxes" id="company_comms_reviewed" label="Company communications reviewed" checkboxMode="simple" %}
- [ ] Earnings press release {% #earnings_pr %}
- [ ] Earnings call webcast/transcript {% #earnings_call %}
- [ ] Prepared remarks + Q&A notes {% #prepared_remarks %}
- [ ] Investor presentation / slide deck {% #investor_deck %}
- [ ] Investor day materials (last 18 months) {% #investor_day %}
- [ ] Product announcements / pricing updates {% #product_announcements %}
- [ ] Guidance updates / pre-announcements {% #guidance_updates %}
{% /field %}

{% /field-group %}

{% field-group id="sources_external" title="Q2.4 External / Market Sources" %}

{% field kind="checkboxes" id="external_sources_reviewed" label="External sources reviewed" checkboxMode="simple" %}
- [ ] Sell-side consensus snapshot {% #sellside_consensus %}
- [ ] Key sell-side notes {% #sellside_notes %}
- [ ] Relevant news (top 3 links) {% #relevant_news %}
- [ ] Industry data {% #industry_data %}
- [ ] Peer earnings read-across {% #peer_readacross %}
- [ ] Options market data (implied move/IV/skew) {% #options_data %}
- [ ] Short interest / borrow / CTB {% #short_interest %}
- [ ] Alternative data (traffic/app downloads/card spend) {% #alt_data %}
{% /field %}

{% field kind="string" id="sellside_consensus_source" label="Sell-side consensus source" %}{% /field %}

{% field kind="string" id="sellside_analyst_names" label="Key sell-side analyst names" %}{% /field %}

{% field kind="string" id="news_links" label="Relevant news links (top 3)" %}{% /field %}

{% field kind="string" id="industry_data_source" label="Industry data source" %}{% /field %}

{% field kind="string" id="peer_tickers" label="Peer earnings tickers" %}{% /field %}

{% field kind="string" id="options_data_source" label="Options market data source" %}{% /field %}

{% field kind="string" id="short_interest_source" label="Short interest data source" %}{% /field %}

{% field kind="string" id="alt_data_source" label="Alternative data source" %}{% /field %}

{% field kind="string" id="other_sources" label="Other sources used" %}{% /field %}

{% /field-group %}

{% field-group id="sources_experts" title="Q2.5 Key Experts and Analysts" %}

{% field kind="table" id="experts_list" label="Key Experts" minRows=0
   columnIds=["name", "angle", "lead_time", "hit_rate", "tier"]
   columnTypes=["string", "string", "string", "string", "string"] %}
| Name | Angle | Lead Time | Hit Rate | Tier |
|------|-------|-----------|----------|------|
{% /field %}

{% instructions ref="experts_list" %}
Track key experts covering this company with their specialization and track record.
{% /instructions %}

{% /field-group %}

{% field-group id="business_snapshot" title="Q3. Business Model Snapshot" %}

{% field kind="string" id="how_makes_money" label="How the company makes money" required=true validate=[{id: "min_words", min: 25}, {id: "max_words", max: 75}] %}{% /field %}

{% instructions ref="how_makes_money" %}
2-4 sentences; 25-75 words explaining how the company generates revenue.
{% /instructions %}

{% field kind="string_list" id="revenue_segments" label="Revenue segments (Segment: X%)" required=true minItems=1 validate=[{id: "sum_to_percent_list", target: 100}] %}{% /field %}

{% instructions ref="revenue_segments" %}
List each segment with percentage of revenue. Format: "Segment Name: XX%". Percentages should sum to 100%.
{% /instructions %}

{% field kind="single_select" id="price_changes_recently" label="Price changes recently?" required=true %}
- [ ] Yes {% #yes %}
- [ ] No {% #no %}
{% /field %}

{% field kind="string" id="price_change_details" label="Price change details (if Yes)" validate=[{id: "required_if_equals", when: "price_changes_recently", equals: "yes"}] %}{% /field %}

{% field kind="string" id="volume_demand_indicators" label="Volume/demand indicators" %}{% /field %}

{% field kind="string" id="mix_shift_risk" label="Mix shift risk" %}{% /field %}

{% field kind="string_list" id="key_kpis_quarterly" label="Key KPIs to track this quarter (KPI: why it matters)" required=true minItems=3 maxItems=8 validate=[{id: "item_format", pattern: "^.+:.+$", example: "Revenue Growth: tracks core business momentum"}] %}{% /field %}

{% instructions ref="key_kpis_quarterly" %}
Format: "KPI Name: Why it matters this quarter". 3-8 KPIs required.
{% /instructions %}

{% /field-group %}

{% field-group id="quant_income" title="Q4.1 Income Statement" %}

{% field kind="number" id="revenue" label="Revenue" required=true %}{% /field %}

{% field kind="number" id="revenue_yoy_pct" label="Revenue YoY %" %}{% /field %}

{% field kind="number" id="revenue_qoq_pct" label="Revenue QoQ %" %}{% /field %}

{% field kind="number" id="gross_margin_pct" label="Gross margin %" min=0 max=100 %}{% /field %}

{% field kind="number" id="gross_margin_yoy_bps" label="Gross margin YoY (bps)" %}{% /field %}

{% field kind="number" id="gross_margin_qoq_bps" label="Gross margin QoQ (bps)" %}{% /field %}

{% field kind="number" id="op_margin_pct" label="Operating margin %" %}{% /field %}

{% field kind="number" id="eps_diluted" label="Diluted EPS" required=true %}{% /field %}

{% field kind="string" id="key_expense_drivers" label="Key expense drivers (R&D, SG&A)" %}{% /field %}

{% field kind="string" id="one_time_items" label="One-time items / adjustments" %}{% /field %}

{% /field-group %}

{% field-group id="quant_balance" title="Q4.2 Balance Sheet / Liquidity" %}

{% field kind="number" id="cash_equivalents" label="Cash & equivalents" %}{% /field %}

{% field kind="number" id="net_debt" label="Net debt (negative for net cash)" %}{% /field %}

{% field kind="string" id="working_capital_changes" label="Working capital changes affecting earnings quality" %}{% /field %}

{% field kind="string" id="covenant_refinancing" label="Covenant / refinancing / maturity wall" %}{% /field %}

{% /field-group %}

{% field-group id="quant_cashflow" title="Q4.3 Cash Flow and Capital Return" %}

{% field kind="number" id="operating_cash_flow" label="Operating cash flow" %}{% /field %}

{% field kind="number" id="free_cash_flow" label="Free cash flow" %}{% /field %}

{% field kind="string" id="fcf_definition" label="FCF definition used" %}{% /field %}

{% field kind="string" id="buybacks" label="Buybacks (amount or share count)" %}{% /field %}

{% field kind="string" id="dividends" label="Dividends (amount or per-share)" %}{% /field %}

{% field kind="string" id="sbc_trend" label="Stock-based comp trend" %}{% /field %}

{% /field-group %}

{% field-group id="quant_quality" title="Q4.4 Quality Checks" %}

{% field kind="single_select" id="unusual_accruals" label="Unusual accruals / reserve releases?" required=true %}
- [ ] Yes {% #yes %}
- [ ] No {% #no %}
{% /field %}

{% field kind="single_select" id="working_capital_pullforward" label="Working capital pull-forward?" required=true %}
- [ ] Yes {% #yes %}
- [ ] No {% #no %}
{% /field %}

{% field kind="multi_select" id="margin_change_drivers" label="Margin change drivers" %}
- [ ] Mix {% #mix %}
- [ ] Cost {% #cost %}
- [ ] FX {% #fx %}
- [ ] Other {% #other %}
{% /field %}

{% field kind="string" id="margin_change_notes" label="Margin change notes" %}{% /field %}

{% /field-group %}

{% field-group id="expect_guidance" title="Q5.1 Company Guidance" %}

{% field kind="string" id="guidance_revenue" label="Revenue guidance" %}{% /field %}

{% field kind="string" id="guidance_margin" label="Margin guidance" %}{% /field %}

{% field kind="string" id="guidance_eps" label="EPS/Op income guidance" %}{% /field %}

{% field kind="string" id="guidance_kpi" label="KPI guidance" %}{% /field %}

{% field kind="string" id="guidance_qualitative" label="Qualitative guidance" %}{% /field %}

{% /field-group %}

{% field-group id="expect_consensus" title="Q5.2 Street Consensus" %}

{% field kind="string" id="consensus_as_of" label="Consensus as-of date" required=true pattern="^\\d{4}-\\d{2}-\\d{2}$" %}{% /field %}

{% field kind="string" id="consensus_source" label="Consensus source" required=true %}{% /field %}

{% field kind="number" id="consensus_revenue" label="Consensus revenue" %}{% /field %}

{% field kind="number" id="consensus_eps" label="Consensus EPS" %}{% /field %}

{% field kind="string" id="consensus_kpis" label="Consensus key KPIs" %}{% /field %}

{% /field-group %}

{% field-group id="expect_estimate" title="Q5.3 Your Estimate (Base)" %}

{% field kind="number" id="estimate_revenue" label="Your revenue estimate" required=true %}{% /field %}

{% field kind="number" id="estimate_eps" label="Your EPS estimate" required=true %}{% /field %}

{% field kind="string" id="estimate_kpis" label="Your KPI estimates" %}{% /field %}

{% field kind="number" id="variance_vs_consensus" label="Variance vs consensus (%)" %}{% /field %}

{% /field-group %}

{% field-group id="expect_whisper" title="Q5.4 Whisper / Buyside Bar" %}

{% instructions ref="expect_whisper" %}
Only fill if evidence-based.
{% /instructions %}

{% field kind="number" id="whisper_revenue" label="Whisper revenue" %}{% /field %}

{% field kind="number" id="whisper_eps" label="Whisper EPS" %}{% /field %}

{% field kind="string" id="whisper_evidence" label="Whisper evidence" validate=[{id: "required_if", when: "whisper_revenue"}, {id: "required_if", when: "whisper_eps"}] %}{% /field %}

{% instructions ref="whisper_evidence" %}
Required if whisper values are provided. Explain the source of whisper estimates.
{% /instructions %}

{% /field-group %}

{% field-group id="expect_market" title="Q5.5 Market-Implied" %}

{% field kind="number" id="options_implied_move" label="Options implied move 1-day (%)" %}{% /field %}

{% field kind="single_select" id="skew_indicates" label="Skew indicates" %}
- [ ] Upside pay-up {% #upside %}
- [ ] Downside pay-up {% #downside %}
- [ ] Neutral {% #neutral %}
{% /field %}

{% field kind="string" id="unusual_oi_flows" label="Unusual open interest / flows" %}{% /field %}

{% /field-group %}

{% field-group id="driver_1" title="Q6.1 Driver Model - Driver 1" %}

{% description ref="driver_1" %}
Simple, explicit, testable assumptions. At least 2 drivers required.
{% /description %}

{% field kind="string" id="driver_1_name" label="Driver name" required=true %}{% /field %}

{% field kind="string" id="driver_1_indicators" label="Leading indicators observed (what/when/source)" required=true %}{% /field %}

{% field kind="string" id="driver_1_assumption" label="Assumption (base)" required=true %}{% /field %}

{% field kind="string" id="driver_1_sensitivity" label="Sensitivity: if +/-X%, EPS impact = Y" %}{% /field %}

{% field kind="string" id="driver_1_what_breaks" label="What breaks this assumption" %}{% /field %}

{% /field-group %}

{% field-group id="driver_2" title="Q6.2 Driver Model - Driver 2" %}

{% field kind="string" id="driver_2_name" label="Driver name" required=true %}{% /field %}

{% field kind="string" id="driver_2_indicators" label="Leading indicators observed" required=true %}{% /field %}

{% field kind="string" id="driver_2_assumption" label="Assumption (base)" required=true %}{% /field %}

{% field kind="string" id="driver_2_sensitivity" label="Sensitivity" %}{% /field %}

{% field kind="string" id="driver_2_what_breaks" label="What breaks this assumption" %}{% /field %}

{% /field-group %}

{% field-group id="driver_3" title="Q6.3 Driver Model - Driver 3 (optional)" %}

{% field kind="string" id="driver_3_name" label="Driver name" %}{% /field %}

{% field kind="string" id="driver_3_indicators" label="Leading indicators observed" %}{% /field %}

{% field kind="string" id="driver_3_assumption" label="Assumption (base)" %}{% /field %}

{% field kind="string" id="driver_3_sensitivity" label="Sensitivity" %}{% /field %}

{% field kind="string" id="driver_3_what_breaks" label="What breaks this assumption" %}{% /field %}

{% /field-group %}

{% field-group id="driver_margin_bridge" title="Q6.4 Margin Bridge" %}

{% instructions ref="driver_margin_bridge" %}
All margin impacts should sum to total margin change.
{% /instructions %}

{% field kind="number" id="margin_mix_bps" label="Mix impact (bps)" %}{% /field %}

{% field kind="number" id="margin_pricing_bps" label="Pricing impact (bps)" %}{% /field %}

{% field kind="number" id="margin_input_costs_bps" label="Input costs impact (bps)" %}{% /field %}

{% field kind="number" id="margin_fx_bps" label="FX impact (bps)" %}{% /field %}

{% field kind="number" id="margin_one_offs_bps" label="One-offs impact (bps)" %}{% /field %}

{% /field-group %}

{% field-group id="scenario_base" title="Q7.1 Scenarios - Base Case" validate=[{id: "sum_to", fields: ["base_probability", "bull_probability", "bear_probability"], target: 100}] %}

{% instructions ref="scenario_base" %}
Probabilities across Base/Bull/Bear should sum to 100%.
{% /instructions %}

{% field kind="number" id="base_probability" label="Probability (%)" required=true min=0 max=100 %}{% /field %}

{% field kind="number" id="base_revenue" label="Revenue" required=true %}{% /field %}

{% field kind="number" id="base_eps" label="EPS" required=true %}{% /field %}

{% field kind="string" id="base_key_kpi" label="Key KPI" %}{% /field %}

{% field kind="string" id="base_narrative" label="Narrative (1-2 sentences)" required=true maxLength=250 %}{% /field %}

{% field kind="string" id="base_stock_reaction" label="Expected stock reaction and why" required=true %}{% /field %}

{% /field-group %}

{% field-group id="scenario_bull" title="Q7.2 Scenarios - Bull Case" %}

{% field kind="number" id="bull_probability" label="Probability (%)" required=true min=0 max=100 %}{% /field %}

{% field kind="number" id="bull_revenue" label="Revenue" required=true %}{% /field %}

{% field kind="number" id="bull_eps" label="EPS" required=true %}{% /field %}

{% field kind="string" id="bull_key_kpi" label="Key KPI" %}{% /field %}

{% field kind="string" id="bull_what_surprises" label="What surprises?" required=true %}{% /field %}

{% field kind="string" id="bull_reaction" label="Expected reaction" required=true %}{% /field %}

{% /field-group %}

{% field-group id="scenario_bear" title="Q7.3 Scenarios - Bear Case" %}

{% field kind="number" id="bear_probability" label="Probability (%)" required=true min=0 max=100 %}{% /field %}

{% field kind="number" id="bear_revenue" label="Revenue" required=true %}{% /field %}

{% field kind="number" id="bear_eps" label="EPS" required=true %}{% /field %}

{% field kind="string" id="bear_key_kpi" label="Key KPI" %}{% /field %}

{% field kind="string" id="bear_what_breaks" label="What breaks?" required=true %}{% /field %}

{% field kind="string" id="bear_reaction" label="Expected reaction" required=true %}{% /field %}

{% /field-group %}

{% field-group id="scenario_triggers" title="Q7.4 Surprise Triggers" %}

{% field kind="string_list" id="surprise_triggers" label="Key surprise triggers (ranked)" required=true minItems=2 %}{% /field %}

{% /field-group %}

{% field-group id="mgmt_risks" title="Q8. Management and Risks" %}

{% field kind="single_select" id="management_tone" label="Management tone last quarter" required=true %}
- [ ] Confident {% #confident %}
- [ ] Cautious {% #cautious %}
- [ ] Defensive {% #defensive %}
- [ ] Mixed {% #mixed %}
{% /field %}

{% field kind="string_list" id="key_commitments" label="Key commitments/promises to track" required=true minItems=1 %}{% /field %}

{% field kind="string_list" id="top_5_risks" label="Top 5 risks into this print (specific, not generic)" required=true minItems=5 maxItems=5 %}{% /field %}

{% field kind="string" id="regulatory_legal_watch" label="Regulatory/legal watch items" %}{% /field %}

{% field kind="string" id="competitive_threats" label="Competitive threats / share shifts" %}{% /field %}

{% field kind="string" id="macro_sensitivities" label="Macro sensitivities (rates, FX, commodities, consumer)" %}{% /field %}

{% /field-group %}

{% field-group id="valuation" title="Q9. Valuation and Reaction" %}

{% field kind="multi_select" id="valuation_metrics" label="Valuation metrics used" required=true minSelections=1 %}
- [ ] P/E {% #pe %}
- [ ] EV/EBITDA {% #ev_ebitda %}
- [ ] EV/Sales {% #ev_sales %}
- [ ] FCF yield {% #fcf_yield %}
- [ ] SOTP {% #sotp %}
{% /field %}

{% field kind="string" id="valuation_other" label="Other valuation metric" %}{% /field %}

{% field kind="single_select" id="valuation_vs_history" label="Current vs historical range" required=true %}
- [ ] Cheap {% #cheap %}
- [ ] Mid {% #mid %}
- [ ] Expensive {% #expensive %}
{% /field %}

{% field kind="string" id="valuation_why" label="Why (valuation rationale)" required=true minLength=60 %}{% /field %}

{% instructions ref="valuation_why" %}
Required. Explain your valuation assessment. Minimum 15 words.
{% /instructions %}

{% field kind="number" id="avg_earnings_move" label="Avg earnings move last 8 quarters (%)" %}{% /field %}

{% field kind="multi_select" id="reaction_drivers" label="What typically drives reaction" %}
- [ ] Revenue {% #revenue %}
- [ ] Margin {% #margin %}
- [ ] Guidance {% #guidance %}
- [ ] KPI {% #kpi %}
- [ ] Other {% #other %}
{% /field %}

{% field kind="string" id="reaction_notes" label="Reaction pattern notes" %}{% /field %}

{% field kind="string" id="short_interest_trend" label="Short interest trend" %}{% /field %}

{% field kind="string" id="flow_sentiment" label="Flow / sentiment" %}{% /field %}

{% field kind="string" id="crowded_factor" label="Crowded factor exposure" %}{% /field %}

{% /field-group %}

{% /form %}
