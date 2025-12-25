# Markform

Agent-friendly, human-readable forms stored as `.form.md` files.

Markform enables AI agents to fill out structured forms using patches, while keeping the
form source in human-readable Markdown with [Markdoc](https://markdoc.dev/) tags.

## Installation

```bash
npm install markform
# or
pnpm add markform
```

Requires Node.js 24+.

## Quick Start

The fastest way to try Markform is the interactive `examples` command:

```bash
# Try it without installing (uses npx)
npx markform examples

# Or after installing globally
npm install -g markform
markform examples
```

This walks you through:

1. Selecting an example form (simple, political research, earnings analysis)

2. Filling in user fields interactively

3. Optionally running an AI agent to complete remaining fields

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
markform fill my-form.form.md --agent=live --model=anthropic/claude-sonnet-4-5

# Mock agent for testing (uses pre-filled form as source)
markform fill my-form.form.md --agent=mock --mock-source filled.form.md
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

### List Models

```bash
# See supported AI providers and example models
markform models
```

### View Documentation

```bash
# Display this README with terminal formatting
markform instructions

# Output raw markdown (for piping)
markform instructions --raw
```

## Supported AI Providers

| Provider | Env Variable | Example Models |
| --- | --- | --- |
| openai | `OPENAI_API_KEY` | gpt-5-mini, gpt-5.1, gpt-5.2 |
| anthropic | `ANTHROPIC_API_KEY` | claude-sonnet-4-5, claude-opus-4-5 |
| google | `GOOGLE_API_KEY` | gemini-2.5-pro, gemini-2.5-flash |
| xai | `XAI_API_KEY` | grok-4, grok-4-fast |
| deepseek | `DEEPSEEK_API_KEY` | deepseek-chat, deepseek-reasoner |

Set the appropriate environment variable for your provider before running `markform fill
--agent=live`. See [`src/settings.ts`](src/settings.ts) for the full list of models.

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

## Form Structure

A `.form.md` file combines YAML frontmatter with Markdoc-tagged content:

```markdown
---
markform:
  markform_version: "0.1.0"
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

## Example Forms

The package includes example forms in the `examples/` directory:

- `simple/simple.form.md` - Basic form demonstrating all field types

- `political-research/political-research.form.md` - Biographical research form

- `earnings-analysis/earnings-analysis.form.md` - Financial analysis form

View them with `markform examples --list` or try them interactively with `markform
examples`.

## Contributing

For development and contributing, see the
[GitHub repository](https://github.com/jlevy/markform).

## License

AGPL-3.0-or-later
