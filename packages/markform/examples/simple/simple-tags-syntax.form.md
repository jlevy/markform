---
markform:
  spec: MF/0.1
  title: Simple Form (Tags Syntax)
  description: "Same as simple.form.md but using Markdoc tag syntax for testing purposes."
  run_mode: interactive
  roles:
    - user
  role_instructions:
    user: "Fill in all fields in this form."
---

{% form id="simple_test" title="Simple Test Form" %}

{% description ref="simple_test" %}
A simple form demonstrating Markdoc tag syntax.
This file is used for testing the --syntax=tags validation option.
{% /description %}

{% group id="basic_fields" title="Basic Fields" %}

{% field kind="string" id="name" role="user" examples=["John Smith", "Jane Doe"] label="Name" maxLength=50 minLength=2 placeholder="Enter your name" required=true %}{% /field %}

{% instructions ref="name" %}
Enter your full name as you want it to appear.
{% /instructions %}

{% field kind="string" id="email" role="user" label="Email" pattern="^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$" placeholder="user@example.com" required=true %}{% /field %}

{% /group %}

{% /form %}
