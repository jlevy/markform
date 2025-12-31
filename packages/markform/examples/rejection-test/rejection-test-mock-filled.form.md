---
markform:
  spec: MF/0.1
  title: Rejection Test Form
  description: "Tests type mismatch rejection and recovery behavior"
  roles:
    - agent
---

{% form id="rejection_test" title="Rejection Test Form" %}

{% description ref="rejection_test" %}
A form to test patch rejection scenarios - verifies that type mismatch
errors are properly recorded and recovery works.
{% /description %}

{% group id="fields" title="Test Fields" %}

{% field kind="table" id="ratings" label="Ratings" required=true minRows=1 maxRows=5
   columnIds=["source", "score", "votes"]
   columnLabels=["Source", "Score", "Votes"]
   columnTypes=["string", "number", "number"] %}
| Source | Score | Votes |
|--------|-------|-------|
| IMDB | 85 | 12500 |
| Rotten Tomatoes | 92 | 450 |
{% /field %}

{% instructions ref="ratings" %}
Enter rating data with source name, score (0-100), and vote count.
{% /instructions %}

{% field kind="string" id="title" label="Title" required=true %}
```value
Test Movie
```
{% /field %}

{% /group %}

{% /form %}
