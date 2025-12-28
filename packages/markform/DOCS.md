# Markform Quick Reference

**Version:** MF/0.1

Markform is structured Markdown for forms.
Files combine YAML frontmatter with [Markdoc](https://markdoc.dev/) tags to define
typed, validated fields.

**More info:** [Project README](https://github.com/jlevy/markform) |
[Full Specification](https://github.com/jlevy/markform/blob/main/SPEC.md) (`markform
spec`)

## Installation

```bash
npm install -g markform    # Global CLI
npm install markform       # Project dependency
```

Run the CLI as `npx markform` or simply `markform` if installed globally.

Requires Node.js 20+. See [README](https://github.com/jlevy/markform) for full details.

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

## Conventions

Use `.form.md` for Markform files.
They are Markdoc syntax, which is a superset of Markdown.

## Field Types

### String Field

Single-line or multi-line text.

````markdown
{% string-field id="name" label="Name" required=true minLength=2 maxLength=100 %}{% /string-field %}

{% string-field id="bio" label="Biography" pattern="^[A-Z].*" %}
```value
Existing value here
````
{% /string-field %}
````

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
````
{% /number-field %}
````

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
````
{% /string-list %}
````

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
````

Options use `[ ]` (unselected) or `[x]` (selected).
Each option needs `{% #id %}`.

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
| --- | --- | --- |
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
| --- | --- | --- |
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
| --- | --- | --- |
| `[ ]` | unfilled | Not answered (invalid) |
| `[y]` | yes | Explicit yes |
| `[n]` | no | Explicit no |

### URL Field

Single URL with format validation.

````markdown
{% url-field id="website" label="Website" required=true %}{% /url-field %}

{% url-field id="repo" label="Repository" %}
```value
https://github.com/example/repo
````
{% /url-field %}
````

### URL List

Array of URLs.

```markdown
{% url-list id="sources" label="Sources" required=true minItems=1 maxItems=10 uniqueItems=true %}
```value
https://example.com/source1
https://example.com/source2
````
{% /url-list %}
````

## Common Attributes

All fields support these attributes:

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `id` | string | required | Unique snake_case identifier |
| `label` | string | required | Human-readable label |
| `required` | boolean | false | Must be filled for completion |
| `role` | string | - | Target actor (`user`, `agent`) |
| `priority` | string | medium | `high`, `medium`, `low` |

**Text-entry fields only** (string, number, string-list, url, url-list):

| Attribute | Type | Description |
|-----------|------|-------------|
| `placeholder` | string | Hint text shown in empty fields |
| `examples` | string[] | Example values (helps LLMs understand expected format) |

```markdown
{% string-field id="name" label="Name" placeholder="Enter your name" examples=["John Doe", "Jane Smith"] %}{% /string-field %}
{% number-field id="revenue" label="Revenue" placeholder="1000000" examples=["500000", "1000000"] %}{% /number-field %}
```

Note: `placeholder` and `examples` are NOT valid on chooser fields (single-select, multi-select, checkboxes).

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
````

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

````markdown
{% string-field id="name" label="Name" %}
```value
John Smith
````
{% /string-field %}
````

Empty fields omit the value block entirely:

```markdown
{% string-field id="name" label="Name" %}{% /string-field %}
````

## Complete Example

```markdown
---
markform:
  spec: MF/0.1
  title: Movie Research
  description: Quick movie research form pulling ratings and key stats from IMDB, Rotten Tomatoes, and Metacritic.
  roles:
    - user
    - agent
  role_instructions:
    user: "Enter the movie title and optionally the year for disambiguation."
    agent: |
      Research and fill in all fields for the specified movie.
      Guidelines:
      1. WORKFLOW - Complete sections in order:
         - First identify the movie title
         - Then find all source URLs (verify you have the right movie on each site)
         - Then fill in details (year, directors, ratings) from those sources
      2. PRIMARY SOURCES:
         - IMDB (imdb.com) for ratings, runtime, and technical details
         - Rotten Tomatoes (rottentomatoes.com) for Tomatometer and Audience Score
         - Metacritic (metacritic.com) for Metascore
      3. Use the EXACT numeric scores from each source - don't average or interpret
      4. Skip fields if any scores are unavailable (older films may lack some metrics)
  harness_config:
    max_issues_per_turn: 3
    max_patches_per_turn: 8
---

{% form id="movie_research" title="Movie Research" %}

{% description ref="movie_research" %}
A focused research form for gathering ratings and key statistics for any film.
Pulls from IMDB, Rotten Tomatoes, and Metacritic.
{% /description %}

{% field-group id="movie_input" title="Movie Identification" %}

{% string-field id="movie" label="Movie" role="user" required=true minLength=1 maxLength=300 %}{% /string-field %}

{% instructions ref="movie" %}
Enter the movie title (add any details to help identify, like "Barbie 2023" or "the Batman movie with Robert Pattinson")
{% /instructions %}

{% /field-group %}

{% field-group id="title_identification" title="Title Identification" %}

{% string-field id="full_title" label="Full Title" role="agent" required=true %}{% /string-field %}

{% instructions ref="full_title" %}
Look up what film the user had in mind and fill in the official title including subtitle if any (e.g., "The Lord of the Rings: The Fellowship of the Ring").
{% /instructions %}

{% /field-group %}

{% field-group id="sources" title="Sources" %}

{% url-field id="imdb_url" label="IMDB URL" role="agent" required=true %}{% /url-field %}

{% instructions ref="imdb_url" %}
Direct link to the movie's IMDB page (e.g., https://www.imdb.com/title/tt0111161/).
{% /instructions %}

{% url-field id="rt_url" label="Rotten Tomatoes URL" role="agent" %}{% /url-field %}

{% instructions ref="rt_url" %}
Direct link to the movie's Rotten Tomatoes page.
{% /instructions %}

{% url-field id="metacritic_url" label="Metacritic URL" role="agent" %}{% /url-field %}

{% instructions ref="metacritic_url" %}
Direct link to the movie's Metacritic page.
{% /instructions %}

{% /field-group %}

{% field-group id="basic_details" title="Basic Details" %}

{% number-field id="year" label="Release Year" role="agent" required=true min=1888 max=2030 %}{% /number-field %}

{% string-list id="directors" label="Director(s)" role="agent" required=true %}{% /string-list %}

{% instructions ref="directors" %}
One director per line. Most films have one; some have two or more co-directors.
{% /instructions %}

{% number-field id="runtime_minutes" label="Runtime (minutes)" role="agent" min=1 max=1000 %}{% /number-field %}

{% single-select id="mpaa_rating" label="MPAA Rating" role="agent" %}
- [ ] G {% #g %}
- [ ] PG {% #pg %}
- [ ] PG-13 {% #pg_13 %}
- [ ] R {% #r %}
- [ ] NC-17 {% #nc_17 %}
- [ ] NR/Unrated {% #nr %}
{% /single-select %}

{% /field-group %}

{% field-group id="imdb_ratings" title="IMDB Ratings" %}

{% number-field id="imdb_rating" label="IMDB Rating" role="agent" min=1.0 max=10.0 %}{% /number-field %}

{% instructions ref="imdb_rating" %}
IMDB user rating (1.0-10.0 scale).
{% /instructions %}

{% number-field id="imdb_votes" label="IMDB Vote Count" role="agent" min=0 %}{% /number-field %}

{% instructions ref="imdb_votes" %}
Number of IMDB user votes (e.g., 2800000 for a popular film).
{% /instructions %}

{% /field-group %}

{% field-group id="rotten_tomatoes_ratings" title="Rotten Tomatoes Ratings" %}

{% number-field id="rt_critics_score" label="Tomatometer (Critics)" role="agent" min=0 max=100 %}{% /number-field %}

{% instructions ref="rt_critics_score" %}
Tomatometer percentage (0-100).
{% /instructions %}

{% number-field id="rt_critics_count" label="Critics Review Count" role="agent" min=0 %}{% /number-field %}

{% number-field id="rt_audience_score" label="Audience Score" role="agent" min=0 max=100 %}{% /number-field %}

{% instructions ref="rt_audience_score" %}
Audience Score percentage (0-100).
{% /instructions %}

{% /field-group %}

{% field-group id="metacritic_ratings" title="Metacritic Ratings" %}

{% number-field id="metacritic_score" label="Metacritic Score" role="agent" min=0 max=100 %}{% /number-field %}

{% instructions ref="metacritic_score" %}
Metascore (0-100 scale). Leave empty if not available.
{% /instructions %}

{% /field-group %}

{% field-group id="summary" title="Summary" %}

{% string-field id="logline" label="One-Line Summary" role="agent" maxLength=300 %}{% /string-field %}

{% instructions ref="logline" %}
Brief plot summary in 1-2 sentences, no spoilers.
{% /instructions %}

{% string-list id="notable_awards" label="Notable Awards" role="agent" %}{% /string-list %}

{% instructions ref="notable_awards" %}
Major awards won. One per line.
Format: Award | Category | Year
Example: "Oscar | Best Picture | 1995"
{% /instructions %}

{% /field-group %}

{% /form %}
```

## CLI Quick Reference

```bash
# Inspect form structure and progress
markform inspect form.md
markform inspect form.md --format=json

# Validate form (check for errors)
markform validate form.md

# Fill forms
markform fill form.md --interactive              # Interactive prompts for user fields
markform fill form.md --roles=user --interactive # Only fill user-role fields
markform fill form.md --model anthropic/claude-sonnet-4-5  # AI fills agent fields

# Export data
markform export form.md --format=json    # Export values as JSON
markform export form.md --format=yaml    # Export values as YAML
markform export form.md --format=markdown  # Readable markdown (strips tags)

# Other commands
markform serve form.md       # Web UI for browsing
markform examples            # Try built-in examples
markform models              # List supported AI providers
```

## Testing and Validation

**Inspect a form** to see structure, progress, and issues:

```bash
markform inspect my-form.form.md
```

**Validate** checks for constraint violations:

```bash
markform validate my-form.form.md
```

**Test with mock data** using a pre-filled source:

```bash
markform fill template.form.md --mock --mock-source filled.form.md
```

**Workflow for testing forms:**

1. Create your `.form.md` template

2. Run `markform validate` to check syntax and constraints

3. Run `markform fill --interactive` to test user fields

4. Run `markform fill --model <model>` to test agent fields

5. Use `markform inspect` to verify progress and completion

## Best Practices

1. **Use descriptive IDs**: `company_revenue_m` not `rev` or `field1`

2. **Add instructions**: Help agents understand what you want

3. **Set constraints**: Use `min`, `max`, `minLength`, `pattern` to validate

4. **Group logically**: Related fields in the same `field-group`

5. **Assign roles**: Separate user input from agent research

6. **Document thoroughly**: Use `{% instructions %}` for complex fields
