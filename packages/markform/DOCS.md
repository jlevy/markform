# Markform Quick Reference

**Version:** MF/0.1 | **Extension:** `.form.md`

Markform is structured Markdown for forms. Files combine YAML frontmatter with Markdoc
tags to define typed, validated fields.

## File Structure

```markdown
---
markform:
  spec: MF/0.1
  title: "Form Title"
  description: "What this form does"
  roles:
    - user
    - agent
  role_instructions:
    user: "Instructions for human users"
    agent: "Instructions for AI agents"
---

{% form id="form_id" title="Form Title" %}

{% field-group id="group_id" title="Group Title" %}
<!-- fields go here -->
{% /field-group %}

{% /form %}
```

## Field Types

### String Field

Single-line or multi-line text.

```markdown
{% string-field id="name" label="Name" required=true minLength=2 maxLength=100 %}{% /string-field %}

{% string-field id="bio" label="Biography" pattern="^[A-Z].*" %}
```value
Existing value here
```
{% /string-field %}
```

| Attribute | Type | Description |
|-----------|------|-------------|
| `minLength` | number | Minimum character count |
| `maxLength` | number | Maximum character count |
| `pattern` | string | JavaScript regex (no delimiters) |

### Number Field

Numeric values with optional constraints.

```markdown
{% number-field id="age" label="Age" required=true min=0 max=150 integer=true %}{% /number-field %}

{% number-field id="price" label="Price" min=0.01 max=999999.99 %}
```value
49.99
```
{% /number-field %}
```

| Attribute | Type | Description |
|-----------|------|-------------|
| `min` | number | Minimum value |
| `max` | number | Maximum value |
| `integer` | boolean | Require whole numbers |

### String List

Array of strings, one per line.

```markdown
{% string-list id="tags" label="Tags" required=true minItems=1 maxItems=10 uniqueItems=true %}{% /string-list %}

{% string-list id="features" label="Key Features" minItems=3 itemMinLength=10 %}
```value
Feature one description
Feature two description
Feature three description
```
{% /string-list %}
```

| Attribute | Type | Description |
|-----------|------|-------------|
| `minItems` | number | Minimum items required |
| `maxItems` | number | Maximum items allowed |
| `itemMinLength` | number | Min length per item |
| `itemMaxLength` | number | Max length per item |
| `uniqueItems` | boolean | No duplicates allowed |

### Single Select

Choose exactly one option.

```markdown
{% single-select id="rating" label="Rating" required=true %}
- [ ] Low {% #low %}
- [ ] Medium {% #medium %}
- [x] High {% #high %}
{% /single-select %}
```

Options use `[ ]` (unselected) or `[x]` (selected). Each option needs `{% #id %}`.

### Multi Select

Choose multiple options.

```markdown
{% multi-select id="categories" label="Categories" required=true minSelections=1 maxSelections=3 %}
- [x] Frontend {% #frontend %}
- [x] Backend {% #backend %}
- [ ] Database {% #database %}
- [ ] DevOps {% #devops %}
{% /multi-select %}
```

| Attribute | Type | Description |
|-----------|------|-------------|
| `minSelections` | number | Minimum selections |
| `maxSelections` | number | Maximum selections |

### Checkboxes

Stateful checklists with three modes.

**Multi Mode** (default) - 5 states for workflow tracking:

```markdown
{% checkboxes id="tasks" label="Tasks" required=true checkboxMode="multi" %}
- [ ] Research {% #research %}
- [x] Design {% #design %}
- [/] Implementation {% #impl %}
- [*] Testing {% #test %}
- [-] N/A item {% #na %}
{% /checkboxes %}
```

| Token | State | Meaning |
|-------|-------|---------|
| `[ ]` | todo | Not started |
| `[x]` | done | Completed |
| `[/]` | incomplete | Work started |
| `[*]` | active | Currently working |
| `[-]` | na | Not applicable |

**Simple Mode** - 2 states (GFM compatible):

```markdown
{% checkboxes id="agreements" label="Agreements" checkboxMode="simple" required=true %}
- [x] I agree to terms {% #terms %}
- [ ] Subscribe to newsletter {% #news %}
{% /checkboxes %}
```

**Explicit Mode** - Requires yes/no for each:

```markdown
{% checkboxes id="confirmations" label="Confirmations" checkboxMode="explicit" required=true %}
- [y] Backup completed {% #backup %}
- [n] Stakeholders notified {% #notify %}
- [ ] Deployment ready {% #deploy %}
{% /checkboxes %}
```

| Token | Value | Meaning |
|-------|-------|---------|
| `[ ]` | unfilled | Not answered (invalid) |
| `[y]` | yes | Explicit yes |
| `[n]` | no | Explicit no |

### URL Field

Single URL with format validation.

```markdown
{% url-field id="website" label="Website" required=true %}{% /url-field %}

{% url-field id="repo" label="Repository" %}
```value
https://github.com/example/repo
```
{% /url-field %}
```

### URL List

Array of URLs.

```markdown
{% url-list id="sources" label="Sources" required=true minItems=1 maxItems=10 uniqueItems=true %}
```value
https://example.com/source1
https://example.com/source2
```
{% /url-list %}
```

## Common Attributes

All fields support these attributes:

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `id` | string | required | Unique snake_case identifier |
| `label` | string | required | Human-readable label |
| `required` | boolean | false | Must be filled for completion |
| `role` | string | - | Target actor (`user`, `agent`) |
| `priority` | string | medium | `high`, `medium`, `low` |

## Documentation Blocks

Add context to fields, groups, or the form.

```markdown
{% description ref="form_id" %}
Overall form description and purpose.
{% /description %}

{% instructions ref="field_id" %}
Step-by-step guidance for filling this field.
{% /instructions %}

{% notes ref="field_id" %}
Additional context or caveats.
{% /notes %}

{% examples ref="field_id" %}
Example values: "AAPL", "GOOGL", "MSFT"
{% /examples %}
```

Place doc blocks after the element they reference.

## ID Conventions

- **Form/Group/Field IDs**: Globally unique, `snake_case`
- **Option IDs**: Unique within field, `snake_case`, use `{% #id %}` syntax
- **Qualified refs**: `field_id.option_id` for external references

## Role System

Assign fields to different actors:

```yaml
roles:
  - user    # Human fills these
  - agent   # AI fills these
```

```markdown
{% string-field id="query" label="Search Query" role="user" %}{% /string-field %}
{% string-field id="summary" label="AI Summary" role="agent" %}{% /string-field %}
```

## Value Encoding

Values use fenced code blocks with language `value`:

```markdown
{% string-field id="name" label="Name" %}
```value
John Smith
```
{% /string-field %}
```

Empty fields omit the value block entirely:

```markdown
{% string-field id="name" label="Name" %}{% /string-field %}
```

## Complete Example

```markdown
---
markform:
  spec: MF/0.1
  title: Movie Research
  description: Research ratings for a film
  roles:
    - user
    - agent
  role_instructions:
    user: "Enter the movie title"
    agent: "Research and fill ratings from IMDB, Rotten Tomatoes"
---

{% form id="movie_research" title="Movie Research" %}

{% description ref="movie_research" %}
Gather ratings and basic info for any film.
{% /description %}

{% field-group id="input" title="Movie Input" %}

{% string-field id="movie" label="Movie" role="user" required=true %}{% /string-field %}

{% instructions ref="movie" %}
Enter the movie title. Add year if needed for disambiguation (e.g., "Dune 2021").
{% /instructions %}

{% /field-group %}

{% field-group id="basic_info" title="Basic Information" %}

{% string-field id="title" label="Full Title" role="agent" required=true %}{% /string-field %}

{% string-list id="directors" label="Directors" role="agent" required=true %}{% /string-list %}

{% number-field id="year" label="Release Year" role="agent" required=true min=1888 max=2030 %}{% /number-field %}

{% number-field id="runtime" label="Runtime (minutes)" role="agent" min=1 max=1000 %}{% /number-field %}

{% single-select id="mpaa" label="MPAA Rating" role="agent" %}
- [ ] G {% #g %}
- [ ] PG {% #pg %}
- [ ] PG-13 {% #pg13 %}
- [ ] R {% #r %}
- [ ] NC-17 {% #nc17 %}
- [ ] NR {% #nr %}
{% /single-select %}

{% /field-group %}

{% field-group id="ratings" title="Ratings" %}

{% number-field id="imdb_rating" label="IMDB Rating" role="agent" min=1.0 max=10.0 %}{% /number-field %}

{% url-field id="imdb_url" label="IMDB URL" role="agent" %}{% /url-field %}

{% number-field id="rt_score" label="Rotten Tomatoes %" role="agent" min=0 max=100 %}{% /number-field %}

{% url-field id="rt_url" label="RT URL" role="agent" %}{% /url-field %}

{% /field-group %}

{% field-group id="summary" title="Summary" %}

{% string-field id="logline" label="One-Line Summary" role="agent" maxLength=300 %}{% /string-field %}

{% string-list id="awards" label="Notable Awards" role="agent" %}{% /string-list %}

{% instructions ref="awards" %}
Format: Award | Category | Year (e.g., "Oscar | Best Picture | 2024")
{% /instructions %}

{% /field-group %}

{% /form %}
```

## CLI Quick Reference

```bash
markform inspect form.md      # View structure and progress
markform fill form.md --interactive  # Fill user fields interactively
markform fill form.md --model anthropic/claude-sonnet-4-5  # AI fills agent fields
markform export form.md --format=json  # Export values as JSON
markform validate form.md     # Check for validation errors
markform serve form.md        # Web UI for browsing
```

## Best Practices

1. **Use descriptive IDs**: `company_revenue_m` not `rev` or `field1`
2. **Add instructions**: Help agents understand what you want
3. **Set constraints**: Use `min`, `max`, `minLength`, `pattern` to validate
4. **Group logically**: Related fields in the same `field-group`
5. **Assign roles**: Separate user input from agent research
6. **Document thoroughly**: Use `{% instructions %}` for complex fields
