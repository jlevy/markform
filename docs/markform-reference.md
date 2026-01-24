<!--
SPDX-License-Identifier: CC-BY-4.0

Markform Quick Reference - Licensed under Creative Commons Attribution 4.0 International
https://creativecommons.org/licenses/by/4.0/

You may freely implement this specification in your own software under any license.
The reference implementation at https://github.com/jlevy/markform is separately
licensed under AGPL-3.0-or-later. Contact the author for commercial licensing options.
-->

# Markform Quick Reference

**Version:** MF/0.1

Markform is structured Markdown for forms.
Files combine YAML frontmatter with HTML comment tags to define typed, validated fields.
Forms render cleanly on GitHub since structure is hidden in comments.

**More info:** [Project README](https://github.com/jlevy/markform) |
[Full Specification](markform-spec.md) (`markform spec`) |
[API Documentation](markform-apis.md) (`markform apis`)

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

<!-- form id="form_id" title="Form Title" -->

<!-- group id="group_id" title="Group Title" -->

<!-- fields go here -->

<!-- /group -->

<!-- /form -->
```

## Conventions

Use `.form.md` for Markform files.
Markform uses HTML comment syntax for structure tags, which render invisibly on GitHub.

### Syntax

**Primary syntax** uses HTML comments:

| Element | Syntax | Notes |
|---------|--------|-------|
| Opening tag | `<!-- form id="x" -->` | Tag name directly after `<!--` |
| Closing tag | `<!-- /form -->` | Closing tags |
| Self-closing | `<!-- field ... /-->` | Self-closing tags |
| ID annotation | `<!-- #id -->` | ID annotations |
| Class annotation | `<!-- .class -->` | Class annotations |

**Example:**

```markdown
<!-- form id="survey" -->
<!-- group id="basics" -->
<!-- field kind="string" id="name" label="Name" --><!-- /field -->
<!-- field kind="single_select" id="rating" label="Rating" -->
- [ ] Good <!-- #good -->
- [ ] Bad <!-- #bad -->
<!-- /field -->
<!-- /group -->
<!-- /form -->
```

### Alternative Syntax (Markdoc Tags)

Markform also supports **Markdoc tag syntax** (`{% tag %}`), which is the underlying
format used internally:

| HTML Comment | Markdoc Tag |
|--------------|-------------|
| `<!-- form id="x" -->` | `{% form id="x" %}` |
| `<!-- /form -->` | `{% /form %}` |
| `<!-- #id -->` | `{% #id %}` |
| `<!-- .class -->` | `{% .class %}` |

Both syntaxes are always supported. Files preserve their original syntax on round-trip.

## Field Kinds

Markform uses the term **field kind** to refer to the type of a field (e.g., `string`,
`number`, `checkboxes`, `table`). The term **data type** refers to the underlying value
representation. See the Type System section in SPEC.md for full details.

### String Field

Single-line or multi-line text.

````markdown
{% field kind="string" id="name" label="Name" required=true minLength=2 maxLength=100 %}{% /field %}

{% field kind="string" id="bio" label="Biography" pattern="^[A-Z].*" %}
```value
Existing value here
````
{% /field %}
````

| Attribute | Type | Description |
|-----------|------|-------------|
| `minLength` | number | Minimum character count |
| `maxLength` | number | Maximum character count |
| `pattern` | string | JavaScript regex (no delimiters) |

### Number Field

Numeric values with optional constraints.

```markdown
{% field kind="number" id="age" label="Age" required=true min=0 max=150 integer=true %}{% /field %}

{% field kind="number" id="price" label="Price" min=0.01 max=999999.99 %}
```value
49.99
````
{% /field %}
````

| Attribute | Type | Description |
|-----------|------|-------------|
| `min` | number | Minimum value |
| `max` | number | Maximum value |
| `integer` | boolean | Require whole numbers |

### String List

Array of strings, one per line.

```markdown
{% field kind="string_list" id="tags" label="Tags" required=true minItems=1 maxItems=10 uniqueItems=true %}{% /field %}

{% field kind="string_list" id="features" label="Key Features" minItems=3 itemMinLength=10 %}
```value
Feature one description
Feature two description
Feature three description
````
{% /field %}
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
{% field kind="single_select" id="rating" label="Rating" required=true %}
- [ ] Low {% #low %}
- [ ] Medium {% #medium %}
- [x] High {% #high %}
{% /field %}
````

Options use `[ ]` (unselected) or `[x]` (selected).
Each option needs `{% #id %}`.

### Multi Select

Choose multiple options.

```markdown
{% field kind="multi_select" id="categories" label="Categories" required=true minSelections=1 maxSelections=3 %}
- [x] Frontend {% #frontend %}
- [x] Backend {% #backend %}
- [ ] Database {% #database %}
- [ ] DevOps {% #devops %}
{% /field %}
```

| Attribute | Type | Description |
| --- | --- | --- |
| `minSelections` | number | Minimum selections |
| `maxSelections` | number | Maximum selections |

### Checkboxes

Stateful checklists with three modes.

**Multi Mode** (default) - 5 states for workflow tracking:

```markdown
{% field kind="checkboxes" id="tasks" label="Tasks" required=true checkboxMode="multi" %}
- [ ] Research {% #research %}
- [x] Design {% #design %}
- [/] Implementation {% #impl %}
- [*] Testing {% #test %}
- [-] N/A item {% #na %}
{% /field %}
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
{% field kind="checkboxes" id="agreements" label="Agreements" checkboxMode="simple" required=true %}
- [x] I agree to terms {% #terms %}
- [ ] Subscribe to newsletter {% #news %}
{% /field %}
```

**Explicit Mode** - Requires yes/no for each:

```markdown
{% field kind="checkboxes" id="confirmations" label="Confirmations" checkboxMode="explicit" required=true %}
- [y] Backup completed {% #backup %}
- [n] Stakeholders notified {% #notify %}
- [ ] Deployment ready {% #deploy %}
{% /field %}
```

| Token | Value | Meaning |
| --- | --- | --- |
| `[ ]` | unfilled | Not answered (invalid) |
| `[y]` | yes | Explicit yes |
| `[n]` | no | Explicit no |

**Option Metadata:**

Options can include arbitrary metadata attributes:

```markdown
- [ ] Ship v1.0 {% #ship pr="#203" issue="PROJ-106" %}
- [ ] Security audit <!-- #audit assignee="alice" due="2026-02-01" -->
```

Metadata is preserved as `Record<string, string>` and does not affect validation.

### Implicit Checkboxes (Plan Documents)

Forms designed as task lists can omit explicit field wrappers. When a form has a
`{% form %}` tag but no `{% field %}` tags, checkboxes are automatically wrapped in
an implicit checkboxes field.

```markdown
---
markform:
  spec: MF/0.1
---
{% form id="plan" title="Project Plan" %}

## Phase 1: Research
- [ ] Literature review {% #lit_review %}
- [ ] Competitive analysis {% #comp %}

## Phase 2: Design
- [x] Architecture doc {% #arch %}
- [/] API design {% #api %}

{% /form %}
```

**Requirements:**
- Each checkbox MUST have an ID annotation (`{% #id %}`)
- The implicit field uses ID `_checkboxes` (reserved)
- Always uses `checkboxMode="multi"` (5-state)
- Mixing explicit fields with checkboxes outside fields is an error

### URL Field

Single URL with format validation.

````markdown
{% field kind="url" id="website" label="Website" required=true %}{% /field %}

{% field kind="url" id="repo" label="Repository" %}
```value
https://github.com/example/repo
````
{% /field %}
````

### URL List

Array of URLs.

```markdown
{% field kind="url_list" id="sources" label="Sources" required=true minItems=1 maxItems=10 uniqueItems=true %}
```value
https://example.com/source1
https://example.com/source2
````
{% /field %}
`````

### Date Field

Date value in ISO 8601 format (YYYY-MM-DD).

````markdown
{% field kind="date" id="deadline" label="Deadline" required=true %}{% /field %}

{% field kind="date" id="start_date" label="Start Date" min="2020-01-01" max="2030-12-31" %}
```value
2024-06-15
`````
{% /field %}
`````

| Attribute | Type | Description |
|-----------|------|-------------|
| `min` | string | Minimum date (ISO 8601: YYYY-MM-DD) |
| `max` | string | Maximum date (ISO 8601: YYYY-MM-DD) |

### Year Field

Integer year with optional constraints.

````markdown
{% field kind="year" id="release_year" label="Release Year" required=true min=1888 max=2030 %}{% /field %}

{% field kind="year" id="founded" label="Year Founded" %}
```value
2015
`````
{% /field %}
`````

| Attribute | Type | Description |
|-----------|------|-------------|
| `min` | number | Minimum year (inclusive) |
| `max` | number | Maximum year (inclusive) |

### Table Field

Structured tabular data with typed columns. Uses standard markdown table syntax.

````markdown
{% field kind="table" id="team" label="Team Members" required=true
   columnIds=["name", "title", "start_date"]
   columnLabels=["Name", "Job Title", "Start Date"]
   columnTypes=["string", "string", "date"]
   minRows=1 maxRows=20 %}
| Name | Job Title | Start Date |
|------|-----------|------------|
| Alice Smith | Engineer | 2023-01-15 |
| Bob Jones | Designer | 2022-06-01 |
{% /field %}
`````

**Basic table (columnLabels backfilled from header row):**

```markdown
{% field kind="table" id="items" label="Items"
   columnIds=["name", "quantity", "price"] %}
| Name | Quantity | Price |
|------|----------|-------|
{% /field %}
```

| Attribute | Type | Required | Description |
| --- | --- | --- | --- |
| `columnIds` | string[] | Yes | Array of snake_case column identifiers |
| `columnLabels` | string[] | No | Display labels (defaults to header row) |
| `columnTypes` | string[] | No | Column types (defaults to all `string`) |
| `minRows` | number | No | Minimum row count (default: 0) |
| `maxRows` | number | No | Maximum row count (default: unlimited) |

**Column types:**

| Type | Description | Validation |
| --- | --- | --- |
| `string` | Any text value | None |
| `number` | Numeric value | Integer or float |
| `url` | URL value | Valid URL format |
| `date` | Date value | ISO 8601 (YYYY-MM-DD) |
| `year` | Year value | Integer (1000-9999) |

**Sentinel values in cells:** Use `%SKIP%` or `%ABORT%` with optional reasons:

```markdown
| 2017 | I, Tonya | 90 | %SKIP% (Not tracked) |
```

**Cell escaping:** Use `\|` for literal pipe characters in cell values.

## Common Attributes

All fields support these attributes:

| Attribute | Type | Default | Description |
| --- | --- | --- | --- |
| `id` | string | required | Unique snake_case identifier |
| `label` | string | required | Human-readable label |
| `required` | boolean | false | Must be filled for completion |
| `role` | string | - | Target actor (`user`, `agent`) |
| `priority` | string | medium | `high`, `medium`, `low` |

**Text-entry fields only** (string, number, string-list, url, url-list):

| Attribute | Type | Description |
| --- | --- | --- |
| `placeholder` | string | Hint text shown in empty fields |
| `examples` | string[] | Example values (helps LLMs understand expected format) |

```markdown
{% field kind="string" id="name" label="Name" placeholder="Enter your name" examples=["John Doe", "Jane Smith"] %}{% /field %}
{% field kind="number" id="revenue" label="Revenue" placeholder="1000000" examples=["500000", "1000000"] %}{% /field %}
```

Note: `placeholder` and `examples` are NOT valid on chooser fields (single-select,
multi-select, checkboxes).

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
{% field kind="string" id="query" label="Search Query" role="user" %}{% /field %}
{% field kind="string" id="summary" label="AI Summary" role="agent" %}{% /field %}
```

## Value Encoding

Values use fenced code blocks with language `value`:

````markdown
{% field kind="string" id="name" label="Name" %}
```value
John Smith
````
{% /field %}
````

Empty fields omit the value block entirely:

```markdown
{% field kind="string" id="name" label="Name" %}{% /field %}
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

{% group id="movie_input" title="Movie Identification" %}

{% field kind="string" id="movie" label="Movie" role="user" required=true minLength=1 maxLength=300 %}{% /field %}

{% instructions ref="movie" %}
Enter the movie title (add any details to help identify, like "Barbie 2023" or "the Batman movie with Robert Pattinson")
{% /instructions %}

{% /group %}

{% group id="title_identification" title="Title Identification" %}

{% field kind="string" id="full_title" label="Full Title" role="agent" required=true %}{% /field %}

{% instructions ref="full_title" %}
Look up what film the user had in mind and fill in the official title including subtitle if any (e.g., "The Lord of the Rings: The Fellowship of the Ring").
{% /instructions %}

{% /group %}

{% group id="sources" title="Sources" %}

{% field kind="url" id="imdb_url" label="IMDB URL" role="agent" required=true %}{% /field %}

{% instructions ref="imdb_url" %}
Direct link to the movie's IMDB page (e.g., https://www.imdb.com/title/tt0111161/).
{% /instructions %}

{% field kind="url" id="rt_url" label="Rotten Tomatoes URL" role="agent" %}{% /field %}

{% instructions ref="rt_url" %}
Direct link to the movie's Rotten Tomatoes page.
{% /instructions %}

{% field kind="url" id="metacritic_url" label="Metacritic URL" role="agent" %}{% /field %}

{% instructions ref="metacritic_url" %}
Direct link to the movie's Metacritic page.
{% /instructions %}

{% /group %}

{% group id="basic_details" title="Basic Details" %}

{% field kind="number" id="year" label="Release Year" role="agent" required=true min=1888 max=2030 %}{% /field %}

{% field kind="string_list" id="directors" label="Director(s)" role="agent" required=true %}{% /field %}

{% instructions ref="directors" %}
One director per line. Most films have one; some have two or more co-directors.
{% /instructions %}

{% field kind="number" id="runtime_minutes" label="Runtime (minutes)" role="agent" min=1 max=1000 %}{% /field %}

{% field kind="single_select" id="mpaa_rating" label="MPAA Rating" role="agent" %}
- [ ] G {% #g %}
- [ ] PG {% #pg %}
- [ ] PG-13 {% #pg_13 %}
- [ ] R {% #r %}
- [ ] NC-17 {% #nc_17 %}
- [ ] NR/Unrated {% #nr %}
{% /field %}

{% /group %}

{% group id="imdb_ratings" title="IMDB Ratings" %}

{% field kind="number" id="imdb_rating" label="IMDB Rating" role="agent" min=1.0 max=10.0 %}{% /field %}

{% instructions ref="imdb_rating" %}
IMDB user rating (1.0-10.0 scale).
{% /instructions %}

{% field kind="number" id="imdb_votes" label="IMDB Vote Count" role="agent" min=0 %}{% /field %}

{% instructions ref="imdb_votes" %}
Number of IMDB user votes (e.g., 2800000 for a popular film).
{% /instructions %}

{% /group %}

{% group id="rotten_tomatoes_ratings" title="Rotten Tomatoes Ratings" %}

{% field kind="number" id="rt_critics_score" label="Tomatometer (Critics)" role="agent" min=0 max=100 %}{% /field %}

{% instructions ref="rt_critics_score" %}
Tomatometer percentage (0-100).
{% /instructions %}

{% field kind="number" id="rt_critics_count" label="Critics Review Count" role="agent" min=0 %}{% /field %}

{% field kind="number" id="rt_audience_score" label="Audience Score" role="agent" min=0 max=100 %}{% /field %}

{% instructions ref="rt_audience_score" %}
Audience Score percentage (0-100).
{% /instructions %}

{% /group %}

{% group id="metacritic_ratings" title="Metacritic Ratings" %}

{% field kind="number" id="metacritic_score" label="Metacritic Score" role="agent" min=0 max=100 %}{% /field %}

{% instructions ref="metacritic_score" %}
Metascore (0-100 scale). Leave empty if not available.
{% /instructions %}

{% /group %}

{% group id="summary" title="Summary" %}

{% field kind="string" id="logline" label="One-Line Summary" role="agent" maxLength=300 %}{% /field %}

{% instructions ref="logline" %}
Brief plot summary in 1-2 sentences, no spoilers.
{% /instructions %}

{% field kind="string_list" id="notable_awards" label="Notable Awards" role="agent" %}{% /field %}

{% instructions ref="notable_awards" %}
Major awards won. One per line.
Format: Award | Category | Year
Example: "Oscar | Best Picture | 1995"
{% /instructions %}

{% /group %}

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

# Export form structure as JSON Schema
markform schema form.md                  # Full schema with x-markform extensions
markform schema form.md --pure           # Pure JSON Schema (no extensions)
markform schema form.md --draft draft-07 # Specify draft version

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

4. **Group logically**: Related fields in the same `group`

5. **Assign roles**: Separate user input from agent research

6. **Document thoroughly**: Use `{% instructions %}` for complex fields

## Programmatic API

For TypeScript and AI SDK integration, run `markform apis` or see
[markform-apis.md](markform-apis.md).
