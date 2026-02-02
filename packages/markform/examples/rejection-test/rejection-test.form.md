---
markform:
  spec: "MF/0.1"
  title: "Rejection Test Form"
  description: "Tests type mismatch rejection and recovery behavior"
  roles:
    - "agent"
  role_instructions:
    user: "Fill in the fields you have direct knowledge of."
    agent: "Complete the remaining fields based on the provided context."
---

<!-- form id="rejection_test" title="Rejection Test Form" -->

<!-- description ref="rejection_test" -->
A form to test patch rejection scenarios - verifies that type mismatch errors are
properly recorded and recovery works.
<!-- /description -->

<!-- group id="fields" title="Test Fields" -->

<!-- field kind="table" id="ratings" columnIds=["source", "score", "votes"] columnLabels=["Source", "Score", "Votes"] columnTypes=["string", "number", "number"] label="Ratings" maxRows=5 minRows=1 required=true --><!-- /field -->

<!-- instructions ref="ratings" -->
Enter rating data with source name, score (0-100), and vote count.
<!-- /instructions -->

<!-- field kind="string" id="title" label="Title" required=true --><!-- /field -->

<!-- /group -->

<!-- /form -->

