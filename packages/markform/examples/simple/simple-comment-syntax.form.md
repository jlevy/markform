---
markform:
  spec: MF/0.1
  title: Simple Form (Comment Syntax)
  description: "Same as simple.form.md but using HTML comment syntax for GitHub compatibility."
  run_mode: interactive
  roles:
    - user
  role_instructions:
    user: "Fill in all fields in this form."
---

<!--form id="simple_test" title="Simple Test Form" -->

<!--description ref="simple_test" -->
A simple form demonstrating HTML comment syntax.
On GitHub, all form tags are hidden - only the content is visible.
<!-- /description -->

<!--group id="basic_fields" title="Basic Fields" -->

<!--field kind="string" id="name" label="Name" role="user" required=true minLength=2 maxLength=50 placeholder="Enter your name" examples=["John Smith", "Jane Doe"] --><!-- /field -->

<!--instructions ref="name" -->
Enter your full name (2-50 characters).
<!-- /instructions -->

<!--field kind="string" id="email" label="Email" role="user" required=true pattern="^[^@]+@[^@]+\\.[^@]+$" placeholder="email@example.com" examples=["alice@company.com", "bob@example.org"] --><!-- /field -->

<!--field kind="number" id="age" label="Age" role="user" required=true min=0 max=150 integer=true placeholder="25" examples=["18", "30", "45"] --><!-- /field -->

<!-- /group -->

<!--group id="selection_fields" title="Selection Fields" -->

<!--field kind="single_select" id="priority" label="Priority" role="user" required=true -->
- [ ] Low <!-- #low -->
- [ ] Medium <!-- #medium -->
- [ ] High <!-- #high -->
<!-- /field -->

<!--field kind="multi_select" id="categories" label="Categories" role="user" required=true minSelections=1 maxSelections=3 -->
- [ ] Frontend <!-- #frontend -->
- [ ] Backend <!-- #backend -->
- [ ] Database <!-- #database -->
- [ ] DevOps <!-- #devops -->
<!-- /field -->

<!-- /group -->

<!--group id="checkbox_fields" title="Checkbox Fields" -->

<!--field kind="checkboxes" id="tasks" label="Tasks" role="user" checkboxMode="multi" required=true -->
- [ ] Research <!-- #research -->
- [ ] Design <!-- #design -->
- [ ] Implement <!-- #implement -->
- [ ] Test <!-- #test -->
<!-- /field -->

<!--instructions ref="tasks" -->
Track task progress. All must reach done or na state to complete.
<!-- /instructions -->

<!--field kind="checkboxes" id="confirmations" label="Confirmations" role="user" checkboxMode="explicit" required=true -->
- [ ] I have reviewed the data <!-- #reviewed -->
- [ ] I confirm submission <!-- #confirmed -->
<!-- /field -->

<!-- /group -->

<!--group id="url_fields" title="URL Fields" -->

<!--field kind="url" id="website" label="Website" role="user" required=true placeholder="https://example.com" --><!-- /field -->

<!--field kind="url_list" id="references" label="References" role="user" minItems=1 maxItems=5 --><!-- /field -->

<!-- /group -->

<!-- /form -->
