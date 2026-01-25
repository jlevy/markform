---
markform:
  spec: MF/0.1
  title: Sprint Tasks
  description: "Plan document example using Markdoc syntax instead of HTML comments."
  roles:
    - user
  role_instructions:
    user: "Update task status as you complete work."
---
{% form id="sprint_tasks" title="Sprint Tasks" %}

{% description ref="sprint_tasks" %}
A sprint task list using Markdoc tag syntax. Both Markdoc (`{% %}`) and
HTML comment (`<!-- -->`) syntaxes are equivalent in Markform.
{% /description %}

## Backend

- [ ] Implement user authentication {% #auth %}
- [ ] Add rate limiting {% #rate_limit %}
- [ ] Set up database migrations {% #db_migrations %}

## Frontend

- [ ] Create login page {% #login_page %}
- [ ] Add form validation {% #form_validation %}
- [ ] Implement dark mode {% #dark_mode %}

## DevOps

- [ ] Configure CI/CD pipeline {% #cicd %}
- [ ] Set up monitoring {% #monitoring %}

{% /form %}
