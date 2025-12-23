---
markform:
  markform_version: "0.1.0"
---

{% form id="company_analysis" title="Company Quarterly Analysis Worksheet" %}

{% doc ref="company_analysis" kind="description" %}
This worksheet supports systematic research on a company for a given quarter.
It has two parts: a relatively static company profile, and a period-specific analysis section.
{% /doc %}

{% doc ref="company_analysis" kind="instructions" %}
**Part 1: Company Profile** — Foundational information that changes slowly.
Update as needed but expect most content to persist quarter-to-quarter.

**Part 2: Quarterly Analysis** — Period-specific analysis.
Complete fresh each quarter.
{% /doc %}

<!-- PART 1: COMPANY PROFILE -->

{% field-group id="identity_structure" title="1. Identity and Structure" %}

{% string-field id="company_legal_name" label="Company legal name" required=true %}{% /string-field %}

{% string-list id="tickers" label="Ticker(s)" required=true minItems=1 %}{% /string-list %}

{% doc ref="tickers" kind="instructions" %}
List at least one ticker symbol. Add multiple if the company trades on different exchanges.
{% /doc %}

{% string-field id="hq_regions" label="HQ / key operating regions" required=true %}{% /string-field %}

{% string-field id="fiscal_year_end" label="Fiscal year end" required=true pattern="^(0[1-9]|1[0-2])(-[0-3][0-9])?$|^(January|February|March|April|May|June|July|August|September|October|November|December)$" %}{% /string-field %}

{% doc ref="fiscal_year_end" kind="instructions" %}
Enter month name (e.g., December) or MM-DD format (e.g., 12-31).
{% /doc %}

{% single-select id="reporting_cadence" label="Reporting cadence" required=true %}
- [ ] Yearly {% #yearly %}
- [ ] Quarterly {% #quarterly %}
- [ ] Monthly {% #monthly %}
{% /single-select %}

{% multi-select id="business_model_type" label="Business model type" required=true minSelections=1 %}
- [ ] One-time hardware {% #one_time_hardware %}
- [ ] Recurring subscription {% #recurring_subscription %}
- [ ] Usage-based {% #usage_based %}
- [ ] Advertising {% #advertising %}
- [ ] Marketplace / take rate {% #marketplace %}
- [ ] Licensing {% #licensing %}
- [ ] Services / consulting {% #services %}
- [ ] Financial / credit {% #financial %}
{% /multi-select %}

{% doc ref="business_model_type" kind="instructions" %}
Check all that apply. At least one is required.
{% /doc %}

{% string-field id="business_model_other" label="Other business model (if applicable)" %}{% /string-field %}

{% doc ref="business_model_other" kind="instructions" %}
Describe any other business model types not covered above.
{% /doc %}

{% string-list id="subsidiaries" label="Subsidiaries / key entities" minItems=0 %}{% /string-list %}

{% string-field id="company_summary" label="One-paragraph summary (plain English)" required=true validate=[{id: "min_words", min: 100}] %}{% /string-field %}

{% doc ref="company_summary" kind="instructions" %}
Provide a plain-English summary of what the company does. Minimum 100 words (approximately 400 characters).
{% /doc %}

{% /field-group %}

{% field-group id="history_evolution" title="2. History and Evolution" %}

{% string-list id="timeline_pivots" label="Timeline (key pivots)" required=true minItems=8 maxItems=12 %}{% /string-list %}

{% doc ref="timeline_pivots" kind="instructions" %}
List 8-12 key pivotal moments in the company's history. One event per line.
{% /doc %}

{% string-field id="transformative_acquisitions" label="Transformative acquisitions / divestitures" %}{% /string-field %}

{% string-field id="leadership_changes" label="Leadership changes that mattered" %}{% /string-field %}

{% string-field id="past_crises" label="Past crises and responses" %}{% /string-field %}

{% string-field id="strategic_move_analysis" label="What single strategic move best explains the current model?" required=true validate=[{id: "min_words", min: 50}] %}{% /string-field %}

{% doc ref="strategic_move_analysis" kind="instructions" %}
Analyst prompt: Explain the strategic move that best explains the current business model. Minimum 50 words.
{% /doc %}

{% /field-group %}

{% field-group id="operations_distribution" title="3. Operations and Distribution" %}

{% string-field id="core_operating_activities" label="Core operating activities (R&D, manufacturing, distribution)" required=true %}{% /string-field %}

{% string-field id="key_locations" label="Key locations (R&D hubs, manufacturing, data centers)" %}{% /string-field %}

{% multi-select id="distribution_model" label="Distribution model" required=true minSelections=1 %}
- [ ] Direct (online / retail / salesforce) {% #direct %}
- [ ] Channel / resellers {% #channel %}
- [ ] Carrier / VARs {% #carrier_vars %}
- [ ] Marketplace / app store {% #marketplace_appstore %}
- [ ] OEM / embedded {% #oem_embedded %}
{% /multi-select %}

{% string-field id="distribution_model_other" label="Other distribution model (if applicable)" %}{% /string-field %}

{% string-field id="direct_indirect_mix" label="Mix of direct vs indirect (if disclosed)" %}{% /string-field %}

{% doc ref="direct_indirect_mix" kind="instructions" %}
Enter percentages that should sum to 100% (e.g., "Direct: 60%, Indirect: 40%").
{% /doc %}

{% string-field id="key_partners" label="Key partners required to deliver the product" %}{% /string-field %}

{% string-field id="capacity_constraints" label="Capacity constraints / bottlenecks" %}{% /string-field %}

{% /field-group %}

{% field-group id="offerings_primary" title="4.1 Offerings - Primary Family" %}

{% doc ref="offerings_primary" kind="description" %}
Tie every revenue line to something someone buys. Use "families," not SKUs.
This section ideally uses repeating groups (future feature). For now, model one offering family.
{% /doc %}

{% string-field id="offering_1_name" label="Offering family name" required=true %}{% /string-field %}

{% string-field id="offering_1_value_prop" label="Value proposition (1 sentence)" required=true maxLength=250 %}{% /string-field %}

{% doc ref="offering_1_value_prop" kind="instructions" %}
Maximum 50 words. Describe the core value in one sentence.
{% /doc %}

{% single-select id="offering_1_delivery" label="Delivery type" required=true %}
- [ ] Physical {% #physical %}
- [ ] Digital {% #digital %}
- [ ] Hybrid {% #hybrid %}
{% /single-select %}

{% single-select id="offering_1_revenue_type" label="Revenue type" required=true %}
- [ ] One-time {% #one_time %}
- [ ] Subscription {% #subscription %}
- [ ] Usage-based {% #usage %}
- [ ] Take-rate {% #take_rate %}
- [ ] Advertising {% #ads %}
{% /single-select %}

{% string-list id="offering_1_kpis" label="Primary KPIs" required=true minItems=1 maxItems=5 %}{% /string-list %}

{% /field-group %}

{% field-group id="offerings_bundles" title="4.2 Offerings - Bundles and Cross-Sell" %}

{% string-field id="what_is_bundled" label="What is bundled?" %}{% /string-field %}

{% string-field id="attach_paths" label="Attach paths (what gets added after first purchase)" %}{% /string-field %}

{% string-field id="cannibalization_risks" label="Cannibalization risks" %}{% /string-field %}

{% /field-group %}

{% field-group id="pricing_structure" title="5.1 Pricing Structure" %}

{% doc ref="pricing_structure" kind="description" %}
Make "pricing power" concrete.
{% /doc %}

{% string-field id="pricing_offering_name" label="Offering family" required=true %}{% /string-field %}

{% string-field id="list_price_range" label="List price / typical range" required=true %}{% /string-field %}

{% doc ref="list_price_range" kind="instructions" %}
Include currency and range (e.g., "$99-$499 USD" or "€50/month").
{% /doc %}

{% multi-select id="discounting_norms" label="Discounting norms" %}
- [ ] None {% #none %}
- [ ] Seasonal {% #seasonal %}
- [ ] Channel promos {% #channel_promos %}
- [ ] Enterprise {% #enterprise %}
- [ ] Bundles {% #bundles %}
{% /multi-select %}

{% string-field id="contract_length" label="Contract length (B2B)" %}{% /string-field %}

{% string-field id="contract_renewal" label="Renewal terms" %}{% /string-field %}

{% string-field id="contract_escalators" label="Price escalators" %}{% /string-field %}

{% string-field id="payer_vs_user" label="Who pays vs who uses" %}{% /string-field %}

{% string-field id="arpu_asp_drivers" label="ARPU/ASP drivers" %}{% /string-field %}

{% string-field id="pricing_changes_recent" label="Pricing changes last 12-18 months" %}{% /string-field %}

{% /field-group %}

{% field-group id="pricing_margins" title="5.2 Margin and Cost Structure" %}

{% string-field id="primary_cost_drivers" label="Primary cost drivers (COGS, hosting, labor, content, etc.)" required=true %}{% /string-field %}

{% string-field id="gross_margin_drivers" label="Gross margin drivers (pricing, mix, utilization, scale, FX)" %}{% /string-field %}

{% string-field id="contribution_margin_framework" label="Contribution margin framework (if applicable)" %}{% /string-field %}

{% number-field id="cac" label="Customer Acquisition Cost (CAC)" %}{% /number-field %}

{% string-field id="payback_period" label="Payback period" %}{% /string-field %}

{% number-field id="ltv" label="Lifetime Value (LTV)" %}{% /number-field %}

{% number-field id="churn_rate" label="Churn rate (%)" min=0 max=100 %}{% /number-field %}

{% string-field id="operating_leverage" label="Operating leverage (fixed vs variable costs)" %}{% /string-field %}

{% string-field id="margin_risks" label="Biggest margin risks" %}{% /string-field %}

{% /field-group %}

{% field-group id="customers_segmentation" title="6.1 Customer Segmentation" %}

{% string-field id="segment_1" label="Segment 1 (size, needs, willingness to pay)" required=true %}{% /string-field %}

{% string-field id="segment_2" label="Segment 2" required=true %}{% /string-field %}

{% string-field id="segment_3" label="Segment 3" %}{% /string-field %}

{% string-field id="geography_mix" label="Geography mix" required=true %}{% /string-field %}

{% doc ref="geography_mix" kind="instructions" %}
Enter percentages that should sum to 100% (e.g., "Americas: 55%, EMEA: 30%, APAC: 15%").
{% /doc %}

{% string-field id="buyer_user_influencer" label="Buyer vs user vs influencer" %}{% /string-field %}

{% /field-group %}

{% field-group id="customers_buying" title="6.2 Buying Motion" %}

{% string-field id="purchase_trigger" label="What triggers purchase?" required=true %}{% /string-field %}

{% string-field id="decision_cycle_length" label="Decision cycle length" %}{% /string-field %}

{% string-field id="replacement_upgrade_cycle" label="Replacement/upgrade cycle (if relevant)" %}{% /string-field %}

{% string-field id="retention_churn_drivers" label="Retention/churn drivers (if recurring)" %}{% /string-field %}

{% /field-group %}

{% field-group id="customers_concentration" title="6.3 Concentration and Notable Customers" %}

{% number-field id="top_customer_concentration" label="Customer concentration risk (top customer %)" min=0 max=100 %}{% /number-field %}

{% string-field id="notable_customers" label="Notable customers / logos (B2B)" %}{% /string-field %}

{% string-field id="channel_dependencies" label="Channel partner dependencies" %}{% /string-field %}

{% /field-group %}

{% field-group id="market_competition" title="7. Market and Competition" %}

{% string-field id="primary_markets" label="Primary markets competed in" required=true %}{% /string-field %}

{% string-field id="tam_sam_som" label="TAM/SAM/SOM (and confidence)" %}{% /string-field %}

{% doc ref="tam_sam_som" kind="instructions" %}
Include currency values with confidence level (e.g., "TAM: $50B (high), SAM: $10B (medium), SOM: $500M (low)").
{% /doc %}

{% string-field id="market_growth_cyclicality" label="Market growth rate and cyclicality" %}{% /string-field %}

{% string-field id="competitors" label="Competitors by category (direct + substitutes)" required=true %}{% /string-field %}

{% string-list id="basis_of_competition" label="Basis of competition (ranked top 5)" required=true minItems=5 maxItems=5 %}{% /string-list %}

{% doc ref="basis_of_competition" kind="instructions" %}
List exactly 5 competitive factors, ranked by importance. First item is most important.
{% /doc %}

{% multi-select id="moat_diagnosis" label="Moat diagnosis" %}
- [ ] Switching costs {% #switching_costs %}
- [ ] Network effects {% #network_effects %}
- [ ] Brand {% #brand %}
- [ ] Scale / cost advantage {% #scale %}
- [ ] IP {% #ip %}
- [ ] Regulatory barriers {% #regulatory %}
- [ ] Distribution advantage {% #distribution %}
- [ ] Ecosystem {% #ecosystem %}
- [ ] Data advantage {% #data %}
{% /multi-select %}

{% string-field id="moat_explanation" label="Moat explanation" validate=[{id: "required_if", when: "moat_diagnosis"}] %}{% /string-field %}

{% doc ref="moat_explanation" kind="instructions" %}
Required if any moat is checked above. Explain why these moats apply. Minimum 25 words.
{% /doc %}

{% string-field id="competitive_risks" label="Competitive risks (price wars, bundling, platform shifts)" %}{% /string-field %}

{% /field-group %}

{% field-group id="supply_constraints" title="8.1 Supply Constraints" %}

{% string-field id="key_inputs_suppliers" label="Key inputs / suppliers / single-source dependencies" required=true %}{% /string-field %}

{% string-field id="manufacturing_model" label="Manufacturing/fulfillment model" %}{% /string-field %}

{% string-field id="critical_commodities" label="Critical commodities / bottlenecks" %}{% /string-field %}

{% string-field id="logistics_inventory_risks" label="Logistics and inventory risks" %}{% /string-field %}

{% string-field id="geopolitical_choke_points" label="Geopolitical choke points" %}{% /string-field %}

{% /field-group %}

{% field-group id="macro_sensitivity" title="8.2 Macro Sensitivity" %}

{% string-list id="macro_variables" label="Top 5 macro variables that historically mattered" required=true minItems=5 maxItems=5 %}{% /string-list %}

{% doc ref="macro_variables" kind="instructions" %}
List exactly 5 macro variables, ranked by importance.
{% /doc %}

{% string-field id="transmission_mechanism" label="Transmission mechanism (how each impacts revenue/margin/cash)" required=true validate=[{id: "min_words", min: 50}] %}{% /string-field %}

{% doc ref="transmission_mechanism" kind="instructions" %}
Minimum 50 words. Explain how each macro variable impacts the business.
{% /doc %}

{% string-field id="historical_episodes" label="Historical episodes (recession/inflation/FX/supply shock)" %}{% /string-field %}

{% string-field id="leading_indicators" label="Leading indicators to monitor pre-earnings" %}{% /string-field %}

{% /field-group %}

{% field-group id="financial_history" title="9. Financial History" %}

{% string-field id="trend_summary" label="3-5 year trend summary (revenue, margin, EPS, FCF)" required=true validate=[{id: "min_words", min: 75}] %}{% /string-field %}

{% doc ref="trend_summary" kind="instructions" %}
Minimum 75 words. Cover revenue, margin, EPS, and free cash flow trends.
{% /doc %}

{% string-field id="capital_return_policy" label="Capital return policy (buybacks/dividends)" %}{% /string-field %}

{% string-field id="major_inflection_points" label="Major inflection points (product cycles, pricing shifts, regulation)" %}{% /string-field %}

{% string-field id="stock_performance_context" label="Stock performance context (vs index/peers)" %}{% /string-field %}

{% string-field id="multiples_vs_history" label="Multiples context vs history" %}{% /string-field %}

{% /field-group %}

{% field-group id="open_questions_profile" title="10. Open Questions" %}

{% string-list id="unanswered_questions" label="Top unanswered questions (ranked by impact)" minItems=0 maxItems=10 %}{% /string-list %}

{% string-field id="how_to_answer" label="How to answer (data / calls / sources)" %}{% /string-field %}

{% string-field id="deadline" label="Deadline (before earnings, next quarter, etc.)" pattern="^\\d{4}-\\d{2}-\\d{2}$|^[A-Za-z].*$" %}{% /string-field %}

{% doc ref="deadline" kind="instructions" %}
Enter a date (YYYY-MM-DD format) or descriptive text (e.g., "Before Q2 earnings").
{% /doc %}

{% /field-group %}

<!-- PART 2: QUARTERLY ANALYSIS -->

{% field-group id="quarterly_cover" title="Q1. Cover Sheet" %}

{% doc ref="quarterly_cover" kind="description" %}
This section is period-specific. Complete fresh each quarter.
{% /doc %}

{% doc ref="quarterly_cover" kind="instructions" %}
**Recommended Operating Cadence:**
- **T-21 to T-14:** Refresh model + read filings; pick "what matters this quarter"
- **T-14 to T-7:** Build expectations stack; peer read-across; gather alt data / checks
- **T-7 to T-2:** Base/Bull/Bear scenarios + probabilities; pre-mortem; draft trade structure
- **T-1:** Confirm options pricing + positioning; finalize risks and stops
- **Earnings day:** Watchlist + rapid interpretation plan
- **T+1 to T+2:** Post-mortem; update model; document learnings
{% /doc %}

{% string-field id="pre_earnings_thesis" label="One-sentence thesis (pre-earnings)" required=true maxLength=250 %}{% /string-field %}

{% doc ref="pre_earnings_thesis" kind="instructions" %}
Maximum 50 words. State your core thesis before the earnings release.
{% /doc %}

{% string-list id="what_matters_top_3" label="What matters this quarter (top 3 drivers)" required=true minItems=3 maxItems=3 %}{% /string-list %}

{% /field-group %}

{% field-group id="sources_log" title="Q2.1 Sourcing Log" %}

{% doc ref="sources_log" kind="description" %}
Check what you actually used. Fill the log as you go.
{% /doc %}

{% doc ref="sources_log" kind="instructions" %}
Maintain a log of sources accessed. Record: Date accessed, Source name, Type/tier, Link or file path, Key takeaways. At least 3 sources required.
{% /doc %}

{% string-list id="sources_accessed" label="Sources accessed (Date | Source | Type | Link | Takeaways)" required=true minItems=3 validate=[{id: "item_format", pattern: "^.+\\|.+\\|.+", example: "2024-01-15 | SEC Filing | 10-K | https://... | Key takeaway"}] %}{% /string-list %}

{% /field-group %}

{% field-group id="sources_sec" title="Q2.2 SEC / Regulatory Documents" %}

{% checkboxes id="sec_docs_reviewed" label="SEC documents reviewed" checkboxMode="simple" %}
- [ ] 10-K (latest) {% #ten_k %}
- [ ] 10-Q (latest) {% #ten_q %}
- [ ] 8-K earnings release (current quarter) {% #eight_k_current %}
- [ ] Prior quarter 8-K earnings release {% #eight_k_prior %}
- [ ] Proxy (DEF 14A) {% #proxy %}
- [ ] S-1 / 20-F / 6-K (if applicable) {% #s1_20f_6k %}
- [ ] Insider trading filings (Forms 3/4/5) {% #insider_filings %}
- [ ] 13D/13G {% #thirteen_d_g %}
- [ ] 13F read-through (if relevant) {% #thirteen_f %}
{% /checkboxes %}

{% /field-group %}

{% field-group id="sources_company" title="Q2.3 Company Communications" %}

{% checkboxes id="company_comms_reviewed" label="Company communications reviewed" checkboxMode="simple" %}
- [ ] Earnings press release {% #earnings_pr %}
- [ ] Earnings call webcast/transcript {% #earnings_call %}
- [ ] Prepared remarks + Q&A notes {% #prepared_remarks %}
- [ ] Investor presentation / slide deck {% #investor_deck %}
- [ ] Investor day materials (last 18 months) {% #investor_day %}
- [ ] Product announcements / pricing updates {% #product_announcements %}
- [ ] Guidance updates / pre-announcements {% #guidance_updates %}
{% /checkboxes %}

{% /field-group %}

{% field-group id="sources_external" title="Q2.4 External / Market Sources" %}

{% checkboxes id="external_sources_reviewed" label="External sources reviewed" checkboxMode="simple" %}
- [ ] Sell-side consensus snapshot {% #sellside_consensus %}
- [ ] Key sell-side notes {% #sellside_notes %}
- [ ] Relevant news (top 3 links) {% #relevant_news %}
- [ ] Industry data {% #industry_data %}
- [ ] Peer earnings read-across {% #peer_readacross %}
- [ ] Options market data (implied move/IV/skew) {% #options_data %}
- [ ] Short interest / borrow / CTB {% #short_interest %}
- [ ] Alternative data (traffic/app downloads/card spend) {% #alt_data %}
{% /checkboxes %}

{% string-field id="sellside_consensus_source" label="Sell-side consensus source" %}{% /string-field %}

{% string-field id="sellside_analyst_names" label="Key sell-side analyst names" %}{% /string-field %}

{% string-field id="news_links" label="Relevant news links (top 3)" %}{% /string-field %}

{% string-field id="industry_data_source" label="Industry data source" %}{% /string-field %}

{% string-field id="peer_tickers" label="Peer earnings tickers" %}{% /string-field %}

{% string-field id="options_data_source" label="Options market data source" %}{% /string-field %}

{% string-field id="short_interest_source" label="Short interest data source" %}{% /string-field %}

{% string-field id="alt_data_source" label="Alternative data source" %}{% /string-field %}

{% string-field id="other_sources" label="Other sources used" %}{% /string-field %}

{% /field-group %}

{% field-group id="sources_experts" title="Q2.5 Key Experts and Analysts" %}

{% string-list id="experts_list" label="Key experts (Name | Angle | Lead time | Hit rate | Tier)" minItems=0 validate=[{id: "item_format", pattern: "^.+\\|.+\\|.+\\|.+\\|.+", example: "Jane Doe | Supply chain | 2 weeks | High | Tier 1"}] %}{% /string-list %}

{% doc ref="experts_list" kind="instructions" %}
Format each entry as: Name | Angle | Typical lead time | Hit rate assessment | Tier
{% /doc %}

{% /field-group %}

{% field-group id="business_snapshot" title="Q3. Business Model Snapshot" %}

{% string-field id="how_makes_money" label="How the company makes money" required=true minLength=100 maxLength=300 %}{% /string-field %}

{% doc ref="how_makes_money" kind="instructions" %}
2-4 sentences; 25-75 words explaining how the company generates revenue.
{% /doc %}

{% string-list id="revenue_segments" label="Revenue segments (Segment: X%)" required=true minItems=1 validate=[{id: "sum_to_percent_list", target: 100}] %}{% /string-list %}

{% doc ref="revenue_segments" kind="instructions" %}
List each segment with percentage of revenue. Format: "Segment Name: XX%". Percentages should sum to 100%.
{% /doc %}

{% single-select id="price_changes_recently" label="Price changes recently?" required=true %}
- [ ] Yes {% #yes %}
- [ ] No {% #no %}
{% /single-select %}

{% string-field id="price_change_details" label="Price change details (if Yes)" validate=[{id: "required_if_equals", when: "price_changes_recently", equals: "yes"}] %}{% /string-field %}

{% string-field id="volume_demand_indicators" label="Volume/demand indicators" %}{% /string-field %}

{% string-field id="mix_shift_risk" label="Mix shift risk" %}{% /string-field %}

{% string-list id="key_kpis_quarterly" label="Key KPIs to track this quarter (KPI: why it matters)" required=true minItems=3 maxItems=8 validate=[{id: "item_format", pattern: "^.+:.+$", example: "Revenue Growth: tracks core business momentum"}] %}{% /string-list %}

{% doc ref="key_kpis_quarterly" kind="instructions" %}
Format: "KPI Name: Why it matters this quarter". 3-8 KPIs required.
{% /doc %}

{% /field-group %}

{% field-group id="quant_income" title="Q4.1 Income Statement" %}

{% number-field id="revenue" label="Revenue" required=true %}{% /number-field %}

{% number-field id="revenue_yoy_pct" label="Revenue YoY %" %}{% /number-field %}

{% number-field id="revenue_qoq_pct" label="Revenue QoQ %" %}{% /number-field %}

{% number-field id="gross_margin_pct" label="Gross margin %" min=0 max=100 %}{% /number-field %}

{% number-field id="gross_margin_yoy_bps" label="Gross margin YoY (bps)" %}{% /number-field %}

{% number-field id="gross_margin_qoq_bps" label="Gross margin QoQ (bps)" %}{% /number-field %}

{% number-field id="op_margin_pct" label="Operating margin %" %}{% /number-field %}

{% number-field id="eps_diluted" label="Diluted EPS" required=true %}{% /number-field %}

{% string-field id="key_expense_drivers" label="Key expense drivers (R&D, SG&A)" %}{% /string-field %}

{% string-field id="one_time_items" label="One-time items / adjustments" %}{% /string-field %}

{% /field-group %}

{% field-group id="quant_balance" title="Q4.2 Balance Sheet / Liquidity" %}

{% number-field id="cash_equivalents" label="Cash & equivalents" %}{% /number-field %}

{% number-field id="net_debt" label="Net debt (negative for net cash)" %}{% /number-field %}

{% string-field id="working_capital_changes" label="Working capital changes affecting earnings quality" %}{% /string-field %}

{% string-field id="covenant_refinancing" label="Covenant / refinancing / maturity wall" %}{% /string-field %}

{% /field-group %}

{% field-group id="quant_cashflow" title="Q4.3 Cash Flow and Capital Return" %}

{% number-field id="operating_cash_flow" label="Operating cash flow" %}{% /number-field %}

{% number-field id="free_cash_flow" label="Free cash flow" %}{% /number-field %}

{% string-field id="fcf_definition" label="FCF definition used" %}{% /string-field %}

{% string-field id="buybacks" label="Buybacks (amount or share count)" %}{% /string-field %}

{% string-field id="dividends" label="Dividends (amount or per-share)" %}{% /string-field %}

{% string-field id="sbc_trend" label="Stock-based comp trend" %}{% /string-field %}

{% /field-group %}

{% field-group id="quant_quality" title="Q4.4 Quality Checks" %}

{% single-select id="unusual_accruals" label="Unusual accruals / reserve releases?" required=true %}
- [ ] Yes {% #yes %}
- [ ] No {% #no %}
{% /single-select %}

{% single-select id="working_capital_pullforward" label="Working capital pull-forward?" required=true %}
- [ ] Yes {% #yes %}
- [ ] No {% #no %}
{% /single-select %}

{% multi-select id="margin_change_drivers" label="Margin change drivers" %}
- [ ] Mix {% #mix %}
- [ ] Cost {% #cost %}
- [ ] FX {% #fx %}
- [ ] Other {% #other %}
{% /multi-select %}

{% string-field id="margin_change_notes" label="Margin change notes" %}{% /string-field %}

{% /field-group %}

{% field-group id="expect_guidance" title="Q5.1 Company Guidance" %}

{% string-field id="guidance_revenue" label="Revenue guidance" %}{% /string-field %}

{% string-field id="guidance_margin" label="Margin guidance" %}{% /string-field %}

{% string-field id="guidance_eps" label="EPS/Op income guidance" %}{% /string-field %}

{% string-field id="guidance_kpi" label="KPI guidance" %}{% /string-field %}

{% string-field id="guidance_qualitative" label="Qualitative guidance" %}{% /string-field %}

{% /field-group %}

{% field-group id="expect_consensus" title="Q5.2 Street Consensus" %}

{% string-field id="consensus_as_of" label="Consensus as-of date" required=true pattern="^\\d{4}-\\d{2}-\\d{2}$" %}{% /string-field %}

{% string-field id="consensus_source" label="Consensus source" required=true %}{% /string-field %}

{% number-field id="consensus_revenue" label="Consensus revenue" %}{% /number-field %}

{% number-field id="consensus_eps" label="Consensus EPS" %}{% /number-field %}

{% string-field id="consensus_kpis" label="Consensus key KPIs" %}{% /string-field %}

{% /field-group %}

{% field-group id="expect_estimate" title="Q5.3 Your Estimate (Base)" %}

{% number-field id="estimate_revenue" label="Your revenue estimate" required=true %}{% /number-field %}

{% number-field id="estimate_eps" label="Your EPS estimate" required=true %}{% /number-field %}

{% string-field id="estimate_kpis" label="Your KPI estimates" %}{% /string-field %}

{% number-field id="variance_vs_consensus" label="Variance vs consensus (%)" %}{% /number-field %}

{% /field-group %}

{% field-group id="expect_whisper" title="Q5.4 Whisper / Buyside Bar" %}

{% doc ref="expect_whisper" kind="instructions" %}
Only fill if evidence-based.
{% /doc %}

{% number-field id="whisper_revenue" label="Whisper revenue" %}{% /number-field %}

{% number-field id="whisper_eps" label="Whisper EPS" %}{% /number-field %}

{% string-field id="whisper_evidence" label="Whisper evidence" validate=[{id: "required_if", when: "whisper_revenue"}, {id: "required_if", when: "whisper_eps"}] %}{% /string-field %}

{% doc ref="whisper_evidence" kind="instructions" %}
Required if whisper values are provided. Explain the source of whisper estimates.
{% /doc %}

{% /field-group %}

{% field-group id="expect_market" title="Q5.5 Market-Implied" %}

{% number-field id="options_implied_move" label="Options implied move 1-day (%)" %}{% /number-field %}

{% single-select id="skew_indicates" label="Skew indicates" %}
- [ ] Upside pay-up {% #upside %}
- [ ] Downside pay-up {% #downside %}
- [ ] Neutral {% #neutral %}
{% /single-select %}

{% string-field id="unusual_oi_flows" label="Unusual open interest / flows" %}{% /string-field %}

{% /field-group %}

{% field-group id="driver_1" title="Q6.1 Driver Model - Driver 1" %}

{% doc ref="driver_1" kind="description" %}
Simple, explicit, testable assumptions. At least 2 drivers required.
{% /doc %}

{% string-field id="driver_1_name" label="Driver name" required=true %}{% /string-field %}

{% string-field id="driver_1_indicators" label="Leading indicators observed (what/when/source)" required=true %}{% /string-field %}

{% string-field id="driver_1_assumption" label="Assumption (base)" required=true %}{% /string-field %}

{% string-field id="driver_1_sensitivity" label="Sensitivity: if +/-X%, EPS impact = Y" %}{% /string-field %}

{% string-field id="driver_1_what_breaks" label="What breaks this assumption" %}{% /string-field %}

{% /field-group %}

{% field-group id="driver_2" title="Q6.2 Driver Model - Driver 2" %}

{% string-field id="driver_2_name" label="Driver name" required=true %}{% /string-field %}

{% string-field id="driver_2_indicators" label="Leading indicators observed" required=true %}{% /string-field %}

{% string-field id="driver_2_assumption" label="Assumption (base)" required=true %}{% /string-field %}

{% string-field id="driver_2_sensitivity" label="Sensitivity" %}{% /string-field %}

{% string-field id="driver_2_what_breaks" label="What breaks this assumption" %}{% /string-field %}

{% /field-group %}

{% field-group id="driver_3" title="Q6.3 Driver Model - Driver 3 (optional)" %}

{% string-field id="driver_3_name" label="Driver name" %}{% /string-field %}

{% string-field id="driver_3_indicators" label="Leading indicators observed" %}{% /string-field %}

{% string-field id="driver_3_assumption" label="Assumption (base)" %}{% /string-field %}

{% string-field id="driver_3_sensitivity" label="Sensitivity" %}{% /string-field %}

{% string-field id="driver_3_what_breaks" label="What breaks this assumption" %}{% /string-field %}

{% /field-group %}

{% field-group id="driver_margin_bridge" title="Q6.4 Margin Bridge" %}

{% doc ref="driver_margin_bridge" kind="instructions" %}
All margin impacts should sum to total margin change.
{% /doc %}

{% number-field id="margin_mix_bps" label="Mix impact (bps)" %}{% /number-field %}

{% number-field id="margin_pricing_bps" label="Pricing impact (bps)" %}{% /number-field %}

{% number-field id="margin_input_costs_bps" label="Input costs impact (bps)" %}{% /number-field %}

{% number-field id="margin_fx_bps" label="FX impact (bps)" %}{% /number-field %}

{% number-field id="margin_one_offs_bps" label="One-offs impact (bps)" %}{% /number-field %}

{% /field-group %}

{% field-group id="scenario_base" title="Q7.1 Scenarios - Base Case" validate=[{id: "sum_to", fields: ["base_probability", "bull_probability", "bear_probability"], target: 100}] %}

{% doc ref="scenario_base" kind="instructions" %}
Probabilities across Base/Bull/Bear should sum to 100%.
{% /doc %}

{% number-field id="base_probability" label="Probability (%)" required=true min=0 max=100 %}{% /number-field %}

{% number-field id="base_revenue" label="Revenue" required=true %}{% /number-field %}

{% number-field id="base_eps" label="EPS" required=true %}{% /number-field %}

{% string-field id="base_key_kpi" label="Key KPI" %}{% /string-field %}

{% string-field id="base_narrative" label="Narrative (1-2 sentences)" required=true maxLength=250 %}{% /string-field %}

{% string-field id="base_stock_reaction" label="Expected stock reaction and why" required=true %}{% /string-field %}

{% /field-group %}

{% field-group id="scenario_bull" title="Q7.2 Scenarios - Bull Case" %}

{% number-field id="bull_probability" label="Probability (%)" required=true min=0 max=100 %}{% /number-field %}

{% number-field id="bull_revenue" label="Revenue" required=true %}{% /number-field %}

{% number-field id="bull_eps" label="EPS" required=true %}{% /number-field %}

{% string-field id="bull_key_kpi" label="Key KPI" %}{% /string-field %}

{% string-field id="bull_what_surprises" label="What surprises?" required=true %}{% /string-field %}

{% string-field id="bull_reaction" label="Expected reaction" required=true %}{% /string-field %}

{% /field-group %}

{% field-group id="scenario_bear" title="Q7.3 Scenarios - Bear Case" %}

{% number-field id="bear_probability" label="Probability (%)" required=true min=0 max=100 %}{% /number-field %}

{% number-field id="bear_revenue" label="Revenue" required=true %}{% /number-field %}

{% number-field id="bear_eps" label="EPS" required=true %}{% /number-field %}

{% string-field id="bear_key_kpi" label="Key KPI" %}{% /string-field %}

{% string-field id="bear_what_breaks" label="What breaks?" required=true %}{% /string-field %}

{% string-field id="bear_reaction" label="Expected reaction" required=true %}{% /string-field %}

{% /field-group %}

{% field-group id="scenario_triggers" title="Q7.4 Surprise Triggers" %}

{% string-list id="surprise_triggers" label="Key surprise triggers (ranked)" required=true minItems=2 %}{% /string-list %}

{% /field-group %}

{% field-group id="mgmt_risks" title="Q8. Management and Risks" %}

{% single-select id="management_tone" label="Management tone last quarter" required=true %}
- [ ] Confident {% #confident %}
- [ ] Cautious {% #cautious %}
- [ ] Defensive {% #defensive %}
- [ ] Mixed {% #mixed %}
{% /single-select %}

{% string-list id="key_commitments" label="Key commitments/promises to track" required=true minItems=1 %}{% /string-list %}

{% string-list id="top_5_risks" label="Top 5 risks into this print (specific, not generic)" required=true minItems=5 maxItems=5 %}{% /string-list %}

{% string-field id="regulatory_legal_watch" label="Regulatory/legal watch items" %}{% /string-field %}

{% string-field id="competitive_threats" label="Competitive threats / share shifts" %}{% /string-field %}

{% string-field id="macro_sensitivities" label="Macro sensitivities (rates, FX, commodities, consumer)" %}{% /string-field %}

{% /field-group %}

{% field-group id="valuation" title="Q9. Valuation and Reaction" %}

{% multi-select id="valuation_metrics" label="Valuation metrics used" required=true minSelections=1 %}
- [ ] P/E {% #pe %}
- [ ] EV/EBITDA {% #ev_ebitda %}
- [ ] EV/Sales {% #ev_sales %}
- [ ] FCF yield {% #fcf_yield %}
- [ ] SOTP {% #sotp %}
{% /multi-select %}

{% string-field id="valuation_other" label="Other valuation metric" %}{% /string-field %}

{% single-select id="valuation_vs_history" label="Current vs historical range" required=true %}
- [ ] Cheap {% #cheap %}
- [ ] Mid {% #mid %}
- [ ] Expensive {% #expensive %}
{% /single-select %}

{% string-field id="valuation_why" label="Why (valuation rationale)" required=true minLength=60 %}{% /string-field %}

{% doc ref="valuation_why" kind="instructions" %}
Required. Explain your valuation assessment. Minimum 15 words.
{% /doc %}

{% number-field id="avg_earnings_move" label="Avg earnings move last 8 quarters (%)" %}{% /number-field %}

{% multi-select id="reaction_drivers" label="What typically drives reaction" %}
- [ ] Revenue {% #revenue %}
- [ ] Margin {% #margin %}
- [ ] Guidance {% #guidance %}
- [ ] KPI {% #kpi %}
- [ ] Other {% #other %}
{% /multi-select %}

{% string-field id="reaction_notes" label="Reaction pattern notes" %}{% /string-field %}

{% string-field id="short_interest_trend" label="Short interest trend" %}{% /string-field %}

{% string-field id="flow_sentiment" label="Flow / sentiment" %}{% /string-field %}

{% string-field id="crowded_factor" label="Crowded factor exposure" %}{% /string-field %}

{% /field-group %}

{% /form %}
