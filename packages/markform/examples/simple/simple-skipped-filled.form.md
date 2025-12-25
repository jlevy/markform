---
markform:
  markform_version: "0.1.0"
---

{% form id="simple_test" title="Simple Test Form" %}

{% description ref="simple_test" %}
A form demonstrating user and agent roles. User fills required fields,agent fills optional fields. Demonstrates all Markform v0.1 field types.
{% /description %}

{% field-group id="basic_fields" title="Basic Fields" %}

{% string-field id="name" label="Name" maxLength=50 minLength=2 required=true role="user" %}
```value
Test User
```
{% /string-field %}

{% instructions ref="name" %}
Enter your full name (2-50 characters).
{% /instructions %}

{% string-field id="email" label="Email" pattern="^[^@]+@[^@]+\\.[^@]+$" required=true role="user" %}
```value
test@example.com
```
{% /string-field %}

{% number-field id="age" integer=true label="Age" max=150 min=0 required=true role="user" %}
```value
25
```
{% /number-field %}

{% number-field id="score" label="Score" max=100 min=0 %}{% /number-field %}

{% instructions ref="score" %}
Assign a score between 0 and 100 based on form completeness.
{% /instructions %}

{% /field-group %}

{% field-group id="list_fields" title="List Fields" %}

{% string-list id="tags" itemMinLength=2 label="Tags" maxItems=5 minItems=1 required=true role="user" uniqueItems=true %}
```value
typescript
testing
```
{% /string-list %}

{% instructions ref="tags" %}
Add 1-5 unique tags (each at least 2 characters).
{% /instructions %}

{% /field-group %}

{% field-group id="selection_fields" title="Selection Fields" %}

{% single-select id="priority" label="Priority" required=true role="user" %}
- [ ] Low {% #low %}
- [ ] Medium {% #medium %}
- [x] High {% #high %}
{% /single-select %}

{% multi-select id="categories" label="Categories" maxSelections=3 minSelections=1 required=true role="user" %}
- [x] Frontend {% #frontend %}
- [x] Backend {% #backend %}
- [ ] Database {% #database %}
- [ ] DevOps {% #devops %}
{% /multi-select %}

{% /field-group %}

{% field-group id="checkbox_fields" title="Checkbox Fields" %}

{% checkboxes id="tasks_multi" label="Tasks (Multi Mode)" required=true role="user" %}
- [x] Research {% #research %}
- [x] Design {% #design %}
- [x] Implement {% #implement %}
- [-] Test {% #test %}
{% /checkboxes %}

{% instructions ref="tasks_multi" %}
Track task progress. All must reach done or na state to complete.
{% /instructions %}

{% checkboxes checkboxMode="simple" id="tasks_simple" label="Agreements (Simple Mode)" required=true role="user" %}
- [x] I have read the guidelines {% #read_guidelines %}
- [x] I agree to the terms {% #agree_terms %}
{% /checkboxes %}

{% checkboxes checkboxMode="explicit" id="confirmations" label="Confirmations (Explicit Mode)" required=true role="user" %}
- [y] Data has been backed up {% #backed_up %}
- [n] Stakeholders notified {% #notified %}
{% /checkboxes %}

{% instructions ref="confirmations" %}
Answer yes or no for each confirmation. All must be explicitly answered.
{% /instructions %}

{% /field-group %}

{% field-group id="optional_fields" title="Optional Fields (Agent)" %}

{% string-field id="notes" label="Notes" %}{% /string-field %}

{% instructions ref="notes" %}
Add any relevant notes or observations about this test form.
{% /instructions %}

{% number-field id="optional_number" label="Optional Number" %}{% /number-field %}

{% /field-group %}

{% /form %}
