---
markform:
  spec: MF/0.1
  title: Company Research (Parallel)
  description: "Demonstrates parallel and order attributes for concurrent form filling."
  roles:
    - agent
  role_instructions:
    agent: "Research the company and fill in all fields."
  harness:
    max_turns: 10
    max_parallel_agents: 4
---
{% form id="company_research" title="Company Research (Parallel)" %}

{% description ref="company_research" %}
A company research form that uses `parallel` for concurrent deep research
and `order` to sequence synthesis after data gathering.
{% /description %}

{% group id="overview" order=0 %}

{% field kind="string" id="company_name" label="Company Name" role="agent" required=true %}{% /field %}

{% field kind="string" id="company_overview" label="Company Overview" role="agent" %}{% /field %}

{% /group %}

{% group id="financials" parallel="deep_research" order=0 %}

{% field kind="string" id="revenue" label="Annual Revenue" role="agent" %}{% /field %}

{% field kind="string" id="margins" label="Margin Analysis" role="agent" %}{% /field %}

{% /group %}

{% group id="team" parallel="deep_research" order=0 %}

{% field kind="string" id="leadership" label="Team & Leadership" role="agent" %}{% /field %}

{% /group %}

{% group id="market" parallel="deep_research" order=0 %}

{% field kind="string" id="tam" label="TAM" role="agent" %}{% /field %}

{% field kind="string" id="competitors" label="Competitors" role="agent" %}{% /field %}

{% /group %}

{% group id="synthesis" order=10 %}

{% field kind="string" id="overall" label="Overall Assessment" role="agent" required=true %}{% /field %}

{% /group %}

{% /form %}
