# Markform

*Markdown forms for token-friendly workflows*

**Markform** is a **file format**, **data model**, and **editing API** for
**agent-friendly, human-readable text forms**. Markform syntax is a superset of Markdown
based on [Markdoc](https://github.com/markdoc/markdoc), stored as `.form.md` files that
are easily readable by agents and humans.

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

## Architecture

```mermaid
flowchart LR
    subgraph SPEC["<b>MARKFORM SPEC</b>"]
        direction TB

        subgraph L1["<b>LAYER 1: SYNTAX</b><br/>Markdoc tag syntax and frontmatter (form, field-group, string-field, checkboxes, etc.)"]
        end

        subgraph L2["<b>LAYER 2: FORM DATA MODEL</b><br/>Schema definitions for forms, fields, values (in Zod but mappable to JSON Schema or Pydantic)"]
        end

        subgraph L3["<b>LAYER 3: VALIDATION & FORM FILLING</b><br/>Rules for filling forms via patches, field ids, required field semantics, validation hooks"]
        end

        subgraph L4["<b>LAYER 4: TOOL API & INTERFACES</b><br/>Abstract API for agents and humans (TypeScript and AI SDK integration)"]
        end

        L4 --> L3 --> L2 --> L1
    end

    subgraph IMPL["<b>THIS IMPLEMENTATION</b>"]
        direction TB

        subgraph ENGINE["<b>ENGINE IMPLEMENTATION</b><br/>Markdoc parser, serializer, patch application, validation (uses jiti for TypeScript rules)"]
        end

        subgraph UI["<b>USER INTERFACES</b><br/>CLI commands, web UI (serve), render to HTML"]
        end

        subgraph AGENT["<b>AGENT INTERFACES</b><br/>Tool API library, MCP server, AI SDK tools"]
        end

        subgraph HARNESS["<b>EXECUTION HARNESS</b><br/>Step-by-step form-filling agentic loop"]
        end

        subgraph TEST["<b>TESTING FRAMEWORK</b><br/>Golden session testing with .session.yaml transcripts"]
        end

        UI --> ENGINE
        AGENT --> HARNESS
        AGENT --> ENGINE
        HARNESS --> ENGINE
        ENGINE --> TEST
    end

    SPEC ~~~ IMPL

    style SPEC fill:#e8f4f8,stroke:#0077b6
    style L1 fill:#caf0f8,stroke:#0077b6
    style L2 fill:#caf0f8,stroke:#0077b6
    style L3 fill:#caf0f8,stroke:#0077b6
    style L4 fill:#caf0f8,stroke:#0077b6
    style IMPL fill:#fff3e6,stroke:#fb8500
    style ENGINE fill:#ffe8cc,stroke:#fb8500
    style UI fill:#ffe8cc,stroke:#fb8500
    style AGENT fill:#ffe8cc,stroke:#fb8500
    style HARNESS fill:#ffe8cc,stroke:#fb8500
    style TEST fill:#ffe8cc,stroke:#fb8500
```

## Motivation

### Why Do Forms Help Agentic Workflows?

Most current agent workflow frameworks emphasize the *flow* of information rather than
the *structure* of the content.
What’s often more useful is expressing the *state* of content directly in a way that
provides clear context to agents and humans at all times.

Humans have for centuries used paper forms to systemetize and manage processes.
The key insight of Markform is that the most natural way to express the state and
context for a workflow is often *forms*. Just as Markdown is a transparent format for
documents, Markform is a transparent text format structured information.

### Goals of Markform

Our goals are threefold:

- **Expressive form state:** Fields can be arbitrary types like checkboxes, strings,
  numbers, and lists.

- **Programmatic editing:** Field state should be updated via APIs or tools.

- **Easily readable by humans and agents:** Both template and field values of a form
  should have a clear text format (not a binary or obscure XML format only readable by
  certain applications).

### Does This Already Exist?

No, unfortunately not.
The closest alternatives are:

- Plain Markdown docs can be used as templates and filledin by agents.
  These are more expressive, but it is hard to edit them programmatically or use LLMs to
  update them reliably.

- Agent to-do lists are part of many chat or coding interfaces and are programmatically
  edited by agents. But these are limited to simple checklists, not forms with other
  fields.

- Numerous tools like Typeform, Google forms, PDF forms, and Docusign offer
  human-friendly UI. But these do not have a human-friendly text format for use by
  agents as well as humans.

### How Can Agents Use Markform?

The data model and editing API let agents fill in forms.
This enables powerful AI workflows that assemble information in a defined structure:

- **Form content, structure, and field values are in a single text file** for better
  context engineering.
  This is a major advantage for LLM agents and for humans reviewing their work.

- **Incremental filling** means an agent or a human can take many iterations, filling
  and correcting a form until it is complete and satisfies the validation rules.

- **Multiple interfaces for humans or agents** can work with the same forms.
  You can interact with a form via a CLI, a programmatic API, from Vercel AI SDK or in
  an MCP server used by an agent, or in web form UIs for humans.

- **Flexible validation** at multiple scopes (field/group/form), including declarative
  constraints and external hooks to arbitrary code (currently TypeScript) or LLM-based
  validation instructions.

- An **agent execution harness** for step-by-step form filling, enabling deep research
  agents that assemble validated output in a structured format.

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

Standard LLMs can be used to fill in forms or create research reports from form
templates. The package currently has support for these models built in, and enables web
search tools for them if possible.

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

- **[Markform Spec](https://github.com/jlevy/markform/blob/main/SPEC.md)** (or run
  `markform spec`) - Complete syntax and semantics

- **[Design
  Doc](https://github.com/jlevy/markform/blob/main/docs/project/architecture/current/arch-markform-design.md)**
  \- Technical design and roadmap

- **[Development](https://github.com/jlevy/markform/blob/main/docs/development.md)** -
  Build, test, and contribute

## License

AGPL-3.0-or-later. [Contact me](https://github.com/jlevy) for additional licensing
options.
