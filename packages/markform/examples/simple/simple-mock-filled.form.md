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

{% field kind="string" id="name" label="Name" role="user" required=true minLength=2 maxLength=50 placeholder="Enter your name" examples=["John Smith", "Jane Doe"] %}
```value
Alice Johnson
```
{% /field %}

{% instructions ref="name" %}
Enter your full name (2-50 characters).
{% /instructions %}

{% field kind="string" id="email" label="Email" role="user" required=true pattern="^[^@]+@[^@]+\\.[^@]+$" placeholder="email@example.com" examples=["alice@company.com", "bob@example.org"] %}
```value
alice@example.com
```
{% /field %}

{% field kind="number" id="age" label="Age" role="user" required=true min=0 max=150 integer=true placeholder="25" examples=["18", "30", "45"] %}
```value
32
```
{% /field %}

{% field kind="number" id="score" label="Score" role="user" min=0.0 max=100.0 placeholder="85.5" examples=["75.0", "90.5", "100.0"] %}
```value
87.5
```
{% /field %}

{% instructions ref="score" %}
Enter a score between 0 and 100 (optional).
{% /instructions %}

{% /group %}

{% group id="list_fields" title="List Fields" %}

{% field kind="string_list" id="tags" label="Tags" role="user" required=true minItems=1 maxItems=5 itemMinLength=2 uniqueItems=true %}
```value
typescript
testing
forms
```
{% /field %}

{% instructions ref="tags" %}
Add 1-5 unique tags (each at least 2 characters).
{% /instructions %}

{% /group %}

{% group id="selection_fields" title="Selection Fields" %}

{% field kind="single_select" id="priority" label="Priority" role="user" required=true %}
- [ ] Low {% #low %}
- [x] Medium {% #medium %}
- [ ] High {% #high %}
{% /field %}

{% field kind="multi_select" id="categories" label="Categories" role="user" required=true minSelections=1 maxSelections=3 %}
- [x] Frontend {% #frontend %}
- [x] Backend {% #backend %}
- [ ] Database {% #database %}
- [ ] DevOps {% #devops %}
{% /field %}

{% /group %}

{% group id="checkbox_fields" title="Checkbox Fields" %}

{% field kind="checkboxes" id="tasks_multi" label="Tasks (Multi Mode)" role="user" checkboxMode="multi" required=true %}
- [x] Research {% #research %}
- [x] Design {% #design %}
- [x] Implement {% #implement %}
- [-] Test {% #test %}
{% /field %}

{% instructions ref="tasks_multi" %}
Track task progress. All must reach done or na state to complete.
{% /instructions %}

{% field kind="checkboxes" id="tasks_simple" label="Agreements (Simple Mode)" role="user" checkboxMode="simple" required=true %}
- [x] I have read the guidelines {% #read_guidelines %}
- [x] I agree to the terms {% #agree_terms %}
{% /field %}

{% field kind="checkboxes" id="confirmations" label="Confirmations (Explicit Mode)" role="user" checkboxMode="explicit" required=true %}
- [y] Data has been backed up {% #backed_up %}
- [n] Stakeholders notified {% #notified %}
{% /field %}

{% instructions ref="confirmations" %}
Answer yes or no for each confirmation. All must be explicitly answered.
{% /instructions %}

{% /group %}

{% group id="url_fields" title="URL Fields" %}

{% field kind="url" id="website" label="Website" role="user" required=true placeholder="https://example.com" examples=["https://github.com/user/repo", "https://company.com"] %}
```value
https://alice.dev
```
{% /field %}

{% instructions ref="website" %}
Enter your website URL (must be http or https).
{% /instructions %}

{% field kind="url_list" id="references" label="References" role="user" minItems=1 maxItems=5 uniqueItems=true placeholder="https://docs.example.com" examples=["https://wikipedia.org/wiki/Example", "https://docs.github.com/en"] %}
```value
https://docs.example.com/guide
https://github.com/example/project
https://medium.com/article-about-forms
```
{% /field %}

{% instructions ref="references" %}
Add 1-5 unique reference URLs for sources or documentation.
{% /instructions %}

{% /group %}

{% group id="date_fields" title="Date and Year Fields" %}

{% field kind="date" id="event_date" label="Event Date" role="user" required=true min="2020-01-01" max="2030-12-31" %}
```value
2025-06-15
```
{% /field %}

{% instructions ref="event_date" %}
Enter the event date (YYYY-MM-DD format, between 2020 and 2030).
{% /instructions %}

{% field kind="year" id="founded_year" label="Founded Year" role="user" required=true min=1900 max=2030 %}
```value
2020
```
{% /field %}

{% instructions ref="founded_year" %}
Enter the year the company was founded (1900-2030).
{% /instructions %}

{% /group %}

{% group id="table_fields" title="Table Fields" %}

{% field kind="table" id="team_members" label="Team Members" role="user" minRows=0 maxRows=5
   columnIds=["name", "role", "start_date"]
   columnTypes=[{type: "string", required: true}, "string", "date"] %}
| Name | Role | Start Date |
|------|------|------------|
| Alice | Engineer | 2024-01-15 |
| Bob | Designer | 2023-06-01 |
{% /field %}

{% instructions ref="team_members" %}
Add team members with their name (required), role, and start date.
{% /instructions %}

{% field kind="table" id="project_tasks" label="Project Tasks" role="user" minRows=0 maxRows=10
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

{% field kind="string" id="notes" label="Notes" role="user" %}
```value
This is a test note.
```
{% /field %}

{% instructions ref="notes" %}
Add any relevant notes or observations (optional).
{% /instructions %}

{% field kind="number" id="optional_number" label="Optional Number" role="user" %}{% /field %}

{% field kind="url" id="related_url" label="Related URL" role="user" %}
```value
https://markform.dev/docs
```
{% /field %}

{% instructions ref="related_url" %}
Optionally add a URL to related documentation or resources.
{% /instructions %}

{% field kind="date" id="optional_date" label="Optional Date" role="user" %}{% /field %}

{% instructions ref="optional_date" %}
Optionally add a date (YYYY-MM-DD format).
{% /instructions %}

{% field kind="year" id="optional_year" label="Optional Year" role="user" %}{% /field %}

{% instructions ref="optional_year" %}
Optionally add a year.
{% /instructions %}

{% /group %}

{% note id="note-review" ref="simple_test" role="user" %}
Form completed with all required fields.
{% /note %}

{% /form %}
