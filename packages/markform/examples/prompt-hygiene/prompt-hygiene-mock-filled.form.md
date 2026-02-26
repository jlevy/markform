---
markform:
  spec: MF/0.1
  title: Prompt Hygiene Fixture
  roles:
    - agent
  role_instructions:
    agent: If unavailable, use %SKIP% (No evidence) or %ABORT% (Hard failure).
---

<!-- form id="prompt_hygiene" title="Prompt Hygiene Fixture" -->

<!-- instructions ref="prompt_hygiene" -->
Fallback guidance: use %SKIP:No evidence% when data is unavailable.
<!-- /instructions -->

<!-- group id="main" title="Main" -->

<!-- field kind="string" id="company_name" role="agent" label="Company Name" required=true -->
```value
Acme Corp
```
<!-- /field -->

<!-- field kind="string" id="notes" role="agent" label="Notes" state="skipped" -->
```value
%SKIP% (Not provided at this stage)
```
<!-- /field -->

<!-- instructions ref="notes" -->
Escalate with %ABORT(timeout)% if blocked.
<!-- /instructions -->

<!-- /group -->

<!-- /form -->

