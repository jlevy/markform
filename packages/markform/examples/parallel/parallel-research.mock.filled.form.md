---
markform:
  spec: "MF/0.1"
  harness:
    max_turns: 10
    max_parallel_agents: 4
role_instructions:
  user: "Fill in the fields you have direct knowledge of."
  agent: "Complete the remaining fields based on the provided context."
---

<!-- form id="company_research" title="Company Research (Parallel)" -->

<!-- description ref="company_research" -->
A company research form that uses  for concurrent deep research
and  to sequence synthesis after data gathering.
<!-- /description -->

<!-- group id="overview" order=0 -->

<!-- field kind="string" id="company_name" label="Company Name" required=true -->
```value
Anthropic
```
<!-- /field -->

<!-- field kind="string" id="company_overview" label="Company Overview" -->
```value
Anthropic is an AI safety company focused on building reliable, interpretable, and steerable AI systems. Founded in 2021 by former OpenAI researchers, the company is known for developing Claude, a family of large language models designed with safety as a core principle.
```
<!-- /field -->

<!-- /group -->

<!-- group id="financials" order=0 parallel="deep_research" -->

<!-- field kind="string" id="revenue" label="Annual Revenue" -->
```value
Estimated $200-400M ARR as of 2024, with rapid growth driven by enterprise adoption of Claude and API services.
```
<!-- /field -->

<!-- field kind="string" id="margins" label="Margin Analysis" -->
```value
As a private company, detailed margin data is not publicly available. However, the AI infrastructure costs are substantial, with significant investment in compute and research talent.
```
<!-- /field -->

<!-- /group -->

<!-- group id="team" order=0 parallel="deep_research" -->

<!-- field kind="string" id="leadership" label="Team & Leadership" -->
```value
CEO Dario Amodei and President Daniela Amodei lead the company. The founding team includes several former OpenAI researchers including Tom Brown (GPT-3 lead), Chris Olah (interpretability), and Sam McCandlish.
```
<!-- /field -->

<!-- /group -->

<!-- group id="market" order=0 parallel="deep_research" -->

<!-- field kind="string" id="tam" label="TAM" -->
```value
The global AI market is projected to reach $1.8 trillion by 2030. The enterprise AI assistant and API market specifically is estimated at $50-100B, growing rapidly.
```
<!-- /field -->

<!-- field kind="string" id="competitors" label="Competitors" -->
```value
Key competitors include OpenAI (GPT-4, ChatGPT), Google DeepMind (Gemini), Meta (LLaMA), Mistral, and Cohere. Anthropic differentiates through its safety-first approach and Constitutional AI methodology.
```
<!-- /field -->

<!-- /group -->

<!-- group id="synthesis" order=10 -->

<!-- field kind="string" id="overall" label="Overall Assessment" required=true -->
```value
Anthropic is a leading AI safety company with strong technical credentials and a differentiated approach to AI development. The company has secured significant funding ($7B+) and established partnerships with major cloud providers. Key strengths include the Claude model family, research leadership in interpretability and safety, and a growing enterprise customer base.
```
<!-- /field -->

<!-- /group -->

<!-- /form -->

