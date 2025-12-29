---
markform:
  spec: "MF/0.1"
  title: Simple Test Form
  description: "Fully interactive demo - no LLM required. Demonstrates all Markform field types."
  roles:
    - user
  role_instructions:
    user: "Fill in all fields in this form."
---

{% form id="simple_test" title="Simple Test Form" %}

{% description ref="simple_test" %}
A fully interactive form demonstrating all Markform v0.1 field types.
Fill all fields using interactive prompts - no LLM API key needed.
{% /description %}

{% group id="basic_fields" title="Basic Fields" %}

{% field kind="string" id="name" label="Name" maxLength=50 minLength=2 required=true role="user" placeholder="Enter your name" examples=["John Smith", "Jane Doe"] %}
```value
Test User
```
{% /field %}

{% instructions ref="name" %}
Enter your full name (2-50 characters).
{% /instructions %}

{% field kind="string" id="email" label="Email" pattern="^[^@]+@[^@]+\\.[^@]+$" required=true role="user" placeholder="email@example.com" examples=["alice@company.com", "bob@example.org"] %}
```value
test@example.com
```
{% /field %}

{% field kind="number" id="age" integer=true label="Age" max=150 min=0 required=true role="user" placeholder="25" examples=["18", "30", "45"] %}
```value
25
```
{% /field %}

{% field kind="number" id="score" label="Score" max=100 min=0 role="user" state="skipped" placeholder="85.5" examples=["75.0", "90.5", "100.0"] %}
```value
%SKIP% (Not needed for this test)
```
{% /field %}

{% instructions ref="score" %}
Enter a score between 0 and 100 (optional).
{% /instructions %}

{% /group %}

{% group id="list_fields" title="List Fields" %}

{% field kind="string_list" id="tags" itemMinLength=2 label="Tags" maxItems=5 minItems=1 required=true role="user" uniqueItems=true %}
```value
typescript
testing
```
{% /field %}

{% instructions ref="tags" %}
Add 1-5 unique tags (each at least 2 characters).
{% /instructions %}

{% /group %}

{% group id="selection_fields" title="Selection Fields" %}

{% field kind="single_select" id="priority" label="Priority" required=true role="user" %}
- [ ] Low {% #low %}
- [ ] Medium {% #medium %}
- [x] High {% #high %}
{% /field %}

{% field kind="multi_select" id="categories" label="Categories" maxSelections=3 minSelections=1 required=true role="user" %}
- [x] Frontend {% #frontend %}
- [x] Backend {% #backend %}
- [ ] Database {% #database %}
- [ ] DevOps {% #devops %}
{% /field %}

{% /group %}

{% group id="checkbox_fields" title="Checkbox Fields" %}

{% field kind="checkboxes" id="tasks_multi" label="Tasks (Multi Mode)" required=true role="user" %}
- [x] Research {% #research %}
- [x] Design {% #design %}
- [x] Implement {% #implement %}
- [-] Test {% #test %}
{% /field %}

{% instructions ref="tasks_multi" %}
Track task progress. All must reach done or na state to complete.
{% /instructions %}

{% field kind="checkboxes" checkboxMode="simple" id="tasks_simple" label="Agreements (Simple Mode)" required=true role="user" %}
- [x] I have read the guidelines {% #read_guidelines %}
- [x] I agree to the terms {% #agree_terms %}
{% /field %}

{% field kind="checkboxes" checkboxMode="explicit" id="confirmations" label="Confirmations (Explicit Mode)" required=true role="user" %}
- [y] Data has been backed up {% #backed_up %}
- [n] Stakeholders notified {% #notified %}
{% /field %}

{% instructions ref="confirmations" %}
Answer yes or no for each confirmation. All must be explicitly answered.
{% /instructions %}

{% /group %}

{% group id="url_fields" title="URL Fields" %}

{% field kind="url" id="website" label="Website" required=true role="user" placeholder="https://example.com" examples=["https://github.com/user/repo", "https://company.com"] %}
```value
https://test.example.com
```
{% /field %}

{% instructions ref="website" %}
Enter your website URL (must be http or https).
{% /instructions %}

{% field kind="url_list" id="references" label="References" maxItems=5 minItems=1 role="user" uniqueItems=true placeholder="https://docs.example.com" examples=["https://wikipedia.org/wiki/Example", "https://docs.github.com/en"] %}
```value
https://docs.example.com
```
{% /field %}

{% instructions ref="references" %}
Add 1-5 unique reference URLs for sources or documentation.
{% /instructions %}

{% /group %}

{% group id="date_fields" title="Date and Year Fields" %}

{% field kind="date" id="event_date" label="Event Date" max="2030-12-31" min="2020-01-01" required=true role="user" %}
```value
2025-03-15
```
{% /field %}

{% instructions ref="event_date" %}
Enter the event date (YYYY-MM-DD format, between 2020 and 2030).
{% /instructions %}

{% field kind="year" id="founded_year" label="Founded Year" max=2030 min=1900 required=true role="user" %}
```value
2021
```
{% /field %}

{% instructions ref="founded_year" %}
Enter the year the company was founded (1900-2030).
{% /instructions %}

{% /group %}

{% group id="table_fields" title="Table Fields" %}

{% field kind="table" id="team_members" label="Team Members" role="user" minRows=0 maxRows=5 state="skipped"
   columnIds=["name", "role", "start_date"]
   columnTypes=[{type: "string", required: true}, "string", "date"] %}
| Name | Role | Start Date |
|------|------|------------|
{% /field %}

{% instructions ref="team_members" %}
Add team members with their name (required), role, and start date.
{% /instructions %}

{% field kind="table" id="project_tasks" label="Project Tasks" role="user" minRows=0 maxRows=10 state="skipped"
   columnIds=["task", "estimate_hrs", "link"]
   columnTypes=[{type: "string", required: true}, "number", "url"] %}
| Task | Estimate (hrs) | Link |
|------|----------------|------|
{% /field %}

{% instructions ref="project_tasks" %}
Optionally add project tasks with estimated hours and reference links.
{% /instructions %}

{% /group %}

{% group id="optional_fields" title="Optional Fields" %}

{% field kind="string" id="notes" label="Notes" role="user" state="skipped" %}
```value
%SKIP% (No notes required)
```
{% /field %}

{% instructions ref="notes" %}
Add any relevant notes or observations (optional).
{% /instructions %}

{% field kind="number" id="optional_number" label="Optional Number" role="user" state="skipped" %}{% /field %}

{% field kind="url" id="related_url" label="Related URL" role="user" state="skipped" %}
```value
%SKIP% (No related URL needed)
```
{% /field %}

{% instructions ref="related_url" %}
Optionally add a URL to related documentation or resources.
{% /instructions %}

{% field kind="date" id="optional_date" label="Optional Date" role="user" state="skipped" %}{% /field %}

{% instructions ref="optional_date" %}
Optionally add a date (YYYY-MM-DD format).
{% /instructions %}

{% field kind="year" id="optional_year" label="Optional Year" role="user" state="skipped" %}{% /field %}

{% instructions ref="optional_year" %}
Optionally add a year.
{% /instructions %}

{% /group %}

{% note id="note-summary" ref="simple_test" role="user" %}
All required fields completed successfully. Optional fields skipped.
{% /note %}

{% /form %}
