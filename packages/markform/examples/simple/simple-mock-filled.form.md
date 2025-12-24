---
markform:
  markform_version: "0.1.0"
---

{% form id="simple_test" title="Simple Test Form" %}

{% doc ref="simple_test" kind="description" %}
A minimal form testing all Markform v0.1 field types and features.
Used for TDD development and golden session testing.
{% /doc %}

{% field-group id="basic_fields" title="Basic Fields" %}

{% string-field id="name" label="Name" required=true minLength=2 maxLength=50 %}
```value
Alice Johnson
```
{% /string-field %}

{% doc ref="name" kind="instructions" %}
Enter your full name (2-50 characters).
{% /doc %}

{% string-field id="email" label="Email" required=true pattern="^[^@]+@[^@]+\\.[^@]+$" %}
```value
alice@example.com
```
{% /string-field %}

{% number-field id="age" label="Age" required=true min=0 max=150 integer=true %}
```value
32
```
{% /number-field %}

{% number-field id="score" label="Score" min=0.0 max=100.0 %}
```value
87.5
```
{% /number-field %}

{% /field-group %}

{% field-group id="list_fields" title="List Fields" %}

{% string-list id="tags" label="Tags" required=true minItems=1 maxItems=5 itemMinLength=2 uniqueItems=true %}
```value
typescript
testing
forms
```
{% /string-list %}

{% doc ref="tags" kind="instructions" %}
Add 1-5 unique tags (each at least 2 characters).
{% /doc %}

{% /field-group %}

{% field-group id="selection_fields" title="Selection Fields" %}

{% single-select id="priority" label="Priority" required=true %}
- [ ] Low {% #low %}
- [x] Medium {% #medium %}
- [ ] High {% #high %}
{% /single-select %}

{% multi-select id="categories" label="Categories" required=true minSelections=1 maxSelections=3 %}
- [x] Frontend {% #frontend %}
- [x] Backend {% #backend %}
- [ ] Database {% #database %}
- [ ] DevOps {% #devops %}
{% /multi-select %}

{% /field-group %}

{% field-group id="checkbox_fields" title="Checkbox Fields" %}

{% checkboxes id="tasks_multi" label="Tasks (Multi Mode)" checkboxMode="multi" required=true %}
- [x] Research {% #research %}
- [x] Design {% #design %}
- [x] Implement {% #implement %}
- [-] Test {% #test %}
{% /checkboxes %}

{% doc ref="tasks_multi" kind="instructions" %}
Track task progress. All must reach done or na state to complete.
{% /doc %}

{% checkboxes id="tasks_simple" label="Agreements (Simple Mode)" checkboxMode="simple" required=true %}
- [x] I have read the guidelines {% #read_guidelines %}
- [x] I agree to the terms {% #agree_terms %}
{% /checkboxes %}

{% checkboxes id="confirmations" label="Confirmations (Explicit Mode)" checkboxMode="explicit" required=true %}
- [y] Data has been backed up {% #backed_up %}
- [n] Stakeholders notified {% #notified %}
{% /checkboxes %}

{% doc ref="confirmations" kind="instructions" %}
Answer yes or no for each confirmation. All must be explicitly answered.
{% /doc %}

{% /field-group %}

{% field-group id="optional_fields" title="Optional Fields" %}

{% string-field id="notes" label="Notes" %}
```value
This is a test note.
```
{% /string-field %}

{% number-field id="optional_number" label="Optional Number" %}{% /number-field %}

{% /field-group %}

{% /form %}
