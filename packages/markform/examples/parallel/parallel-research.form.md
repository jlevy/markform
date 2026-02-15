---
markform:
  spec: MF/0.1
  title: Company Research (Parallel)
  description: Demonstrates parallel and order attributes for concurrent form filling.
  harness:
    max_turns: 10
    max_parallel_agents: 4
  roles:
    - agent
  role_instructions:
    agent: Research the company and fill in all fields.
---
<!-- form id="company_research" title="Company Research (Parallel)" -->

<!-- description ref="company_research" -->
A company research form that uses `parallel` for concurrent deep research and `order` to
sequence synthesis after data gathering.
<!-- /description -->

<!-- group id="overview" order=0 -->

<!-- field kind="string" id="company_name" label="Company Name" required=true --><!-- /field -->

<!-- field kind="string" id="company_overview" label="Company Overview" --><!-- /field -->

<!-- /group -->

<!-- group id="financials" order=0 parallel="deep_research" -->

<!-- field kind="string" id="revenue" label="Annual Revenue" --><!-- /field -->

<!-- field kind="string" id="margins" label="Margin Analysis" --><!-- /field -->

<!-- /group -->

<!-- group id="team" order=0 parallel="deep_research" -->

<!-- field kind="string" id="leadership" label="Team & Leadership" --><!-- /field -->

<!-- /group -->

<!-- group id="market" order=0 parallel="deep_research" -->

<!-- field kind="string" id="tam" label="TAM" --><!-- /field -->

<!-- field kind="string" id="competitors" label="Competitors" --><!-- /field -->

<!-- /group -->

<!-- group id="synthesis" order=10 -->

<!-- field kind="string" id="overall" label="Overall Assessment" required=true --><!-- /field -->

<!-- /group -->

<!-- /form -->
