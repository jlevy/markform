# Markform

*Markdown forms for token-friendly workflows*

**Markform** is a format, data model, and editing API for **agent-friendly,
human-readable text forms**. The Markform format is **a superset of Markdown** based on
[Markdoc](https://github.com/markdoc/markdoc), stored as `.form.md` files that are
**easily readable by agents and humans**.

The idea is to combine the simple utility of a Markdown document with structured tags
that define typed fields and validation rules.
In effect, Markform is Markdown plus structure that makes it editable via API. Markform
enables AI agents to fill out human-readable forms or docs written in Markdown by using
[Markdoc](https://markdoc.dev/) tags.

## Installation

```bash
# As a global CLI
npm install -g markform

# Or as a project dependency
npm install markform
```

Requires Node.js 24+.

## Quick Start

```bash
# Try it without installing
npx markform examples
```

This walks you through an example form interactively, with optional AI agent filling.

## Motivation

### Why Are Forms Important?

Most current agent workflow frameworks emphasize the *flow* of information rather than
the *structure* of the content.
What’s often more useful is expressing the *state* of content directly in a way that
provides clear context to agents and humans at all times.

The key insight of Markform is that *forms* are a natural way to express structured
workflow state. If state is represented in a context-efficient way, workflows like agent
loops become much more effective.

Humans have used forms for centuries to manage processes with rigor.
Just as Markdown is a transparent format for documents, Markform is a transparent text
format structured information.

### Why Another Format for Forms?

Plain Markdown checklists and ad-hoc templates are readable, but fragile to update
programmatically via LLMs or agents.
Simple to-do list tools are now commonly used by agents, but these do not extend to more
complex assembly of information.

There are numerous other tools like Typeform and Google forms for collecting data from
humans, but it seems there isn’t a clean text format for such forms or workflows for
their use by agents.

### How Can Agents Use Markform?

The data model and editing API let agents fill in forms.
This enables powerful AI workflows that assemble information in a defined structure.

Key elements of its design:

- **Form content, structure, and field values are all in one text file** for better
  context engineering.
  This is a major advantage for LLM agents and for humans reviewing their work.

- **Incremental filling** means an agent or a human can take many iterations, filling
  and correcting a form until it is complete and satisfies the validation rules.

- The same API works with **multiple interfaces for humans or agents**. You can interact
  with a form via a CLI, a programmatic API, from Vercel AI SDK or in an MCP server used
  by an agent, or in web form UIs for humans.

- **Flexible validation** at multiple scopes (field/group/form), including declarative
  constraints and external hooks to arbitrary code (currently TypeScript) or LLM-based
  validation instructions.

- An **agent execution harness** for step-by-step form filling, enabling deep research
  agents that assemble validated output in a structured format.

- A **golden session testing framework** for validating end-to-end behavior

### Example Use Cases

- A clean and readable text format for web UIs that involve filling in forms, supporting
  strings, lists, numbers, checkboxes, URLs, and other fields

- A format and set of APIs for validating structured values filled into forms

- Deep research tools where agents need to follow codified processes to assemble
  information

- Practical task execution plans with checklists and assembled answers and notes

- Analysis processes, like assembling insights from unstructured sources in structured
  form

- Multi-agent and agent-human workflows, where humans and/or agents fill in different
  parts of a form, or where humans or agents review each other’s work in structured ways

### Why Markdoc as a Format?

Markdoc extends Markdown with structured tags, allowing AST parsing and programmatic
manipulation while preserving human and LLM readability.
See Stripe’s [Markdoc overview][markdoc-overview] and [blog post][stripe-markdoc] for
more on the philosophy behind “docs-as-data” that Markform extends to “forms-as-data.”

## CLI Commands

### Explore Examples

```bash
# Interactive: select an example, fill it, optionally run agent
markform examples

# List available examples
markform examples --list

# Start with a specific example
markform examples --name political-research
```

### Inspect Forms

```bash
# View form structure, progress, and validation issues
markform inspect my-form.form.md

# Output as JSON
markform inspect my-form.form.md --format=json
```

### Fill Forms

```bash
# Interactive mode: fill user-role fields via prompts
markform fill my-form.form.md --interactive

# Agent mode: use an LLM to fill agent-role fields
markform fill my-form.form.md --model=anthropic/claude-sonnet-4-5

# Mock agent for testing (uses pre-filled form as source)
markform fill my-form.form.md --mock --mock-source filled.form.md
```

### Export and Transform

```bash
# Export as readable markdown (strips Markdoc tags)
markform export my-form.form.md --format=markdown

# Export values as JSON
markform export my-form.form.md --format=json

# Export values as YAML
markform export my-form.form.md --format=yaml

# Dump just the current values
markform dump my-form.form.md
```

### Apply Patches

```bash
# Apply a JSON patch to update field values
markform apply my-form.form.md --patch '[{"op":"set","fieldId":"name","value":"Alice"}]'
```

### Web Interface

```bash
# Serve a form as a web page for browsing
markform serve my-form.form.md
```

### Other Commands

```bash
# See supported AI providers and example models
markform models

# Display full documentation
markform instructions

# See all commands
markform --help
```

## Markform Format

A `.form.md` file is simply a Markdoc file.
It combines YAML frontmatter with Markdoc-tagged content:

```markdown
---
markform:
  spec: MF/0.1
  roles:
    - user
    - agent
  role_instructions:
    user: "Fill in your details."
    agent: "Complete the analysis fields."
---

{% form id="my_form" title="My Form" %}

{% field-group id="basics" title="Basic Info" %}

{% string-field id="name" label="Name" role="user" required=true %}{% /string-field %}

{% number-field id="score" label="Score" role="agent" min=0 max=100 %}{% /number-field %}

{% /field-group %}

{% /form %}
```

**Key concepts:**

- **Roles**: Define who fills what (`user` for humans, `agent` for AI)

- **Field types**: `string-field`, `number-field`, `string-list`, `single-select`,
  `multi-select`, `checkboxes`

- **Validation**: `required`, `min/max`, `minLength/maxLength`, `pattern`

- **Structure**: Fields organized in `field-group` containers

## Programmatic Usage

Markform exports a parsing engine and AI SDK integration for use in your own
applications.

### Basic Parsing

```typescript
import { parseForm, serializeForm } from "markform";

// Parse a .form.md file
const form = parseForm(markdownContent);

// Access schema and values
console.log(form.schema.title);
console.log(form.values);

// Serialize back to markdown
const output = serializeForm(form);
```

### AI SDK Integration

Markform provides tools compatible with the [Vercel AI SDK](https://sdk.vercel.ai/):

```typescript
import { parseForm } from "markform";
import { createMarkformTools, MarkformSessionStore } from "markform/ai-sdk";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

const form = parseForm(markdownContent);
const store = new MarkformSessionStore(form);
const tools = createMarkformTools({ sessionStore: store });

const result = await generateText({
  model: anthropic("claude-sonnet-4-5-20250929"),
  prompt: "Fill out this form with appropriate values...",
  tools,
  maxSteps: 10,
});
```

**Available tools:**

| Tool | Description |
| --- | --- |
| `markform_inspect` | Get current form state, issues, progress |
| `markform_apply` | Apply patches to update field values |
| `markform_export` | Export schema and values as JSON |
| `markform_get_markdown` | Get canonical Markdown representation |

## Supported Providers

| Provider | Env Variable | Example Models |
| --- | --- | --- |
| openai | `OPENAI_API_KEY` | gpt-5-mini, gpt-5.1, gpt-5.2 |
| anthropic | `ANTHROPIC_API_KEY` | claude-sonnet-4-5, claude-opus-4-5 |
| google | `GOOGLE_API_KEY` | gemini-2.5-pro, gemini-2.5-flash |
| xai | `XAI_API_KEY` | grok-4, grok-4-fast |
| deepseek | `DEEPSEEK_API_KEY` | deepseek-chat, deepseek-reasoner |

Set the appropriate environment variable for your provider before running `markform
fill`. See
[`src/settings.ts`](https://github.com/jlevy/markform/blob/main/packages/markform/src/settings.ts)
for the full list of models.

## Example Forms

The package includes example forms in
[`examples/`](https://github.com/jlevy/markform/tree/main/packages/markform/examples):

- `simple/simple.form.md` - Basic form demonstrating all field types

- `political-research/political-research.form.md` - Biographical research form

- `earnings-analysis/earnings-analysis.form.md` - Financial analysis form

View them with `markform examples --list` or try them interactively.

## Documentation

- **[Full Specification](https://github.com/jlevy/markform/blob/main/SPEC.md)** (or run
  `markform spec`) - Complete syntax and semantics

- **[Architecture](https://github.com/jlevy/markform/blob/main/docs/project/architecture/current/arch-markform-design.md)**
  \- Technical design and roadmap

- **[Development](https://github.com/jlevy/markform/blob/main/docs/development.md)** -
  Build, test, and contribute

## License

AGPL-3.0-or-later. [Contact me](https://github.com/jlevy) for additional licensing
options.
