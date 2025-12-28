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

{% field-group id="basic_fields" title="Basic Fields" %}

{% string-field id="name" label="Name" role="user" required=true minLength=2 maxLength=50 %}
```value
Alice Johnson
```
{% /string-field %}

{% instructions ref="name" %}
Enter your full name (2-50 characters).
{% /instructions %}

{% string-field id="email" label="Email" role="user" required=true pattern="^[^@]+@[^@]+\\.[^@]+$" %}
```value
alice@example.com
```
{% /string-field %}

{% number-field id="age" label="Age" role="user" required=true min=0 max=150 integer=true %}
```value
32
```
{% /number-field %}

{% number-field id="score" label="Score" role="user" min=0.0 max=100.0 %}
```value
87.5
```
{% /number-field %}

{% instructions ref="score" %}
Enter a score between 0 and 100 (optional).
{% /instructions %}

{% /field-group %}

{% field-group id="list_fields" title="List Fields" %}

{% string-list id="tags" label="Tags" role="user" required=true minItems=1 maxItems=5 itemMinLength=2 uniqueItems=true %}
```value
typescript
testing
forms
```
{% /string-list %}

{% instructions ref="tags" %}
Add 1-5 unique tags (each at least 2 characters).
{% /instructions %}

{% /field-group %}

{% field-group id="selection_fields" title="Selection Fields" %}

{% single-select id="priority" label="Priority" role="user" required=true %}
- [ ] Low {% #low %}
- [x] Medium {% #medium %}
- [ ] High {% #high %}
{% /single-select %}

{% multi-select id="categories" label="Categories" role="user" required=true minSelections=1 maxSelections=3 %}
- [x] Frontend {% #frontend %}
- [x] Backend {% #backend %}
- [ ] Database {% #database %}
- [ ] DevOps {% #devops %}
{% /multi-select %}

{% /field-group %}

{% field-group id="checkbox_fields" title="Checkbox Fields" %}

{% checkboxes id="tasks_multi" label="Tasks (Multi Mode)" role="user" checkboxMode="multi" required=true %}
- [x] Research {% #research %}
- [x] Design {% #design %}
- [x] Implement {% #implement %}
- [-] Test {% #test %}
{% /checkboxes %}

{% instructions ref="tasks_multi" %}
Track task progress. All must reach done or na state to complete.
{% /instructions %}

{% checkboxes id="tasks_simple" label="Agreements (Simple Mode)" role="user" checkboxMode="simple" required=true %}
- [x] I have read the guidelines {% #read_guidelines %}
- [x] I agree to the terms {% #agree_terms %}
{% /checkboxes %}

{% checkboxes id="confirmations" label="Confirmations (Explicit Mode)" role="user" checkboxMode="explicit" required=true %}
- [y] Data has been backed up {% #backed_up %}
- [n] Stakeholders notified {% #notified %}
{% /checkboxes %}

{% instructions ref="confirmations" %}
Answer yes or no for each confirmation. All must be explicitly answered.
{% /instructions %}

{% /field-group %}

{% field-group id="url_fields" title="URL Fields" %}

{% url-field id="website" label="Website" role="user" required=true %}
```value
https://alice.dev
```
{% /url-field %}

{% instructions ref="website" %}
Enter your website URL (must be http or https).
{% /instructions %}

{% url-list id="references" label="References" role="user" minItems=1 maxItems=5 uniqueItems=true %}
```value
https://docs.example.com/guide
https://github.com/example/project
https://medium.com/article-about-forms
```
{% /url-list %}

{% instructions ref="references" %}
Add 1-5 unique reference URLs for sources or documentation.
{% /instructions %}

{% /field-group %}

{% field-group id="optional_fields" title="Optional Fields" %}

{% string-field id="notes" label="Notes" role="user" %}
```value
This is a test note.
```
{% /string-field %}

{% instructions ref="notes" %}
Add any relevant notes or observations (optional).
{% /instructions %}

{% number-field id="optional_number" label="Optional Number" role="user" %}{% /number-field %}

{% url-field id="related_url" label="Related URL" role="user" %}
```value
https://markform.dev/docs
```
{% /url-field %}

{% instructions ref="related_url" %}
Optionally add a URL to related documentation or resources.
{% /instructions %}

{% /field-group %}

{% note id="note-review" ref="simple_test" role="user" %}
Form completed with all required fields.
{% /note %}

{% /form %}
