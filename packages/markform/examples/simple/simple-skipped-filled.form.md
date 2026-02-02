---
markform:
  spec: "MF/0.1"
  title: "Simple Test Form"
  description: "Fully interactive demo - no LLM required. Demonstrates all Markform field types."
  roles:
    - "user"
  role_instructions:
    user: "Fill in all fields in this form."
---

<!-- form id="simple_test" title="Simple Test Form" -->

<!-- description ref="simple_test" -->
A fully interactive form demonstrating all Markform v0.1 field types.
Fill all fields using interactive prompts - no LLM API key needed.
<!-- /description -->

<!-- group id="basic_fields" title="Basic Fields" -->

<!-- field kind="string" id="name" role="user" examples=["John Smith", "Jane Doe"] label="Name" maxLength=50 minLength=2 placeholder="Enter your name" required=true -->
```value
Test User
```
<!-- /field -->

<!-- instructions ref="name" -->
Enter your full name (2-50 characters).
<!-- /instructions -->

<!-- field kind="string" id="email" role="user" examples=["alice@company.com", "bob@example.org"] label="Email" pattern="^[^@]+@[^@]+\\.[^@]+$" placeholder="email@example.com" required=true -->
```value
test@example.com
```
<!-- /field -->

<!-- field kind="number" id="age" role="user" examples=["18", "30", "45"] integer=true label="Age" max=150 min=0 placeholder="25" required=true -->
```value
25
```
<!-- /field -->

<!-- field kind="number" id="score" role="user" examples=["75.0", "90.5", "100.0"] label="Score" max=100 min=0 placeholder="85.5" state="skipped" -->
```value
%SKIP% (Not needed for this test)
```
<!-- /field -->

<!-- instructions ref="score" -->
Enter a score between 0 and 100 (optional).
<!-- /instructions -->

<!-- /group -->

<!-- group id="list_fields" title="List Fields" -->

<!-- field kind="string_list" id="tags" role="user" itemMinLength=2 label="Tags" maxItems=5 minItems=1 required=true uniqueItems=true -->
```value
typescript
testing
```
<!-- /field -->

<!-- instructions ref="tags" -->
Add 1-5 unique tags (each at least 2 characters).
<!-- /instructions -->

<!-- /group -->

<!-- group id="selection_fields" title="Selection Fields" -->

<!-- field kind="single_select" id="priority" role="user" label="Priority" required=true -->
- [ ] Low <!-- #low -->
- [ ] Medium <!-- #medium -->
- [x] High <!-- #high -->
<!-- /field -->

<!-- field kind="multi_select" id="categories" role="user" label="Categories" maxSelections=3 minSelections=1 required=true -->
- [x] Frontend <!-- #frontend -->
- [x] Backend <!-- #backend -->
- [ ] Database <!-- #database -->
- [ ] DevOps <!-- #devops -->
<!-- /field -->

<!-- /group -->

<!-- group id="checkbox_fields" title="Checkbox Fields" -->

<!-- field kind="checkboxes" id="tasks_multi" role="user" label="Tasks (Multi Mode)" required=true -->
- [x] Research <!-- #research -->
- [x] Design <!-- #design -->
- [x] Implement <!-- #implement -->
- [-] Test <!-- #test -->
<!-- /field -->

<!-- instructions ref="tasks_multi" -->
Track task progress.
All must reach done or na state to complete.
<!-- /instructions -->

<!-- field kind="checkboxes" id="tasks_simple" role="user" checkboxMode="simple" label="Agreements (Simple Mode)" required=true -->
- [x] I have read the guidelines <!-- #read_guidelines -->
- [x] I agree to the terms <!-- #agree_terms -->
<!-- /field -->

<!-- field kind="checkboxes" id="confirmations" role="user" checkboxMode="explicit" label="Confirmations (Explicit Mode)" required=true -->
- [y] Data has been backed up <!-- #backed_up -->
- [n] Stakeholders notified <!-- #notified -->
<!-- /field -->

<!-- instructions ref="confirmations" -->
Answer yes or no for each confirmation.
All must be explicitly answered.
<!-- /instructions -->

<!-- /group -->

<!-- group id="url_fields" title="URL Fields" -->

<!-- field kind="url" id="website" role="user" examples=["https://github.com/user/repo", "https://company.com"] label="Website" placeholder="https://example.com" required=true -->
```value
https://test.example.com
```
<!-- /field -->

<!-- instructions ref="website" -->
Enter your website URL (must be http or https).
<!-- /instructions -->

<!-- field kind="url_list" id="references" role="user" examples=["https://wikipedia.org/wiki/Example", "https://docs.github.com/en"] label="References" maxItems=5 minItems=1 placeholder="https://docs.example.com" uniqueItems=true -->
```value
https://docs.example.com
```
<!-- /field -->

<!-- instructions ref="references" -->
Add 1-5 unique reference URLs for sources or documentation.
<!-- /instructions -->

<!-- /group -->

<!-- group id="date_fields" title="Date and Year Fields" -->

<!-- field kind="date" id="event_date" role="user" label="Event Date" max="2030-12-31" min="2020-01-01" required=true -->
```value
2025-03-15
```
<!-- /field -->

<!-- instructions ref="event_date" -->
Enter the event date (YYYY-MM-DD format, between 2020 and 2030).
<!-- /instructions -->

<!-- field kind="year" id="founded_year" role="user" label="Founded Year" max=2030 min=1900 required=true -->
```value
2021
```
<!-- /field -->

<!-- instructions ref="founded_year" -->
Enter the year the company was founded (1900-2030).
<!-- /instructions -->

<!-- /group -->

<!-- group id="table_fields" title="Table Fields" -->

<!-- field kind="table" id="team_members" role="user" columnIds=["name", "role", "start_date"] columnLabels=["Name", "Role", "Start Date"] columnTypes=[{type: "string", required: true}, "string", "date"] label="Team Members" maxRows=5 minRows=0 state="skipped" --><!-- /field -->

<!-- instructions ref="team_members" -->
Add team members with their name (required), role, and start date.
<!-- /instructions -->

<!-- field kind="table" id="project_tasks" role="user" columnIds=["task", "estimate_hrs", "link"] columnLabels=["Task", "Estimate (hrs)", "Link"] columnTypes=[{type: "string", required: true}, "number", "url"] label="Project Tasks" maxRows=10 minRows=0 state="skipped" --><!-- /field -->

<!-- instructions ref="project_tasks" -->
Optionally add project tasks with estimated hours and reference links.
<!-- /instructions -->

<!-- /group -->

<!-- group id="optional_fields" title="Optional Fields" -->

<!-- field kind="string" id="notes" role="user" label="Notes" state="skipped" -->
```value
%SKIP% (No notes required)
```
<!-- /field -->

<!-- instructions ref="notes" -->
Add any relevant notes or observations (optional).
<!-- /instructions -->

<!-- field kind="number" id="optional_number" role="user" label="Optional Number" state="skipped" --><!-- /field -->

<!-- field kind="url" id="related_url" role="user" label="Related URL" state="skipped" -->
```value
%SKIP% (No related URL needed)
```
<!-- /field -->

<!-- instructions ref="related_url" -->
Optionally add a URL to related documentation or resources.
<!-- /instructions -->

<!-- field kind="date" id="optional_date" role="user" label="Optional Date" state="skipped" --><!-- /field -->

<!-- instructions ref="optional_date" -->
Optionally add a date (YYYY-MM-DD format).
<!-- /instructions -->

<!-- field kind="year" id="optional_year" role="user" label="Optional Year" state="skipped" --><!-- /field -->

<!-- instructions ref="optional_year" -->
Optionally add a year.
<!-- /instructions -->

<!-- /group -->

<!-- note id="note-summary" role="user" ref="simple_test" -->
All required fields completed successfully.Optional fields skipped.
<!-- /note -->

<!-- /form -->

