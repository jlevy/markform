# Markform

Agent-friendly, human-readable forms stored as `.form.md` files.

Markform enables AI agents to fill out structured forms using patches, while keeping the
form source in human-readable Markdown with [Markdoc](https://markdoc.dev/) tags.

## Try It

```bash
npx markform examples
```

This walks you through an example form interactively, with optional AI agent filling.

## Install

```bash
npm install markform
# or
pnpm add markform
```

## Usage

```bash
# Interactive examples with optional agent fill
markform examples

# Inspect a form's structure and validation
markform inspect my-form.form.md

# Fill user fields interactively
markform fill my-form.form.md --interactive

# Fill with an AI agent
markform fill my-form.form.md --model=anthropic/claude-sonnet-4-5

# Export as readable markdown, JSON, or YAML
markform export my-form.form.md --format=markdown

# See all commands
markform --help

# View full documentation
markform instructions
```

## Documentation

- **[How to Use Markform](packages/markform/README.md)** - Full CLI reference and
  programmatic API (also available via `markform instructions`)

- **[Developer Workflows](docs/development.md)** - Build, test, and contributing

- **[Publishing](docs/publishing.md)** - Release workflow

- **[Architecture](docs/project/architecture/current/arch-markform-initial-design.md)**
  \- Technical design

## Supported Providers

| Provider | Env Variable | Example Models |
| --- | --- | --- |
| openai | `OPENAI_API_KEY` | gpt-5-mini, gpt-5.1, gpt-5.2 |
| anthropic | `ANTHROPIC_API_KEY` | claude-sonnet-4-5, claude-opus-4-5 |
| google | `GOOGLE_API_KEY` | gemini-2.5-pro, gemini-2.5-flash |
| xai | `XAI_API_KEY` | grok-4, grok-4-fast |
| deepseek | `DEEPSEEK_API_KEY` | deepseek-chat, deepseek-reasoner |

See [`packages/markform/src/settings.ts`](packages/markform/src/settings.ts) for the
full list.

## License

AGPL-3.0-or-later
