# Markform

Agent-friendly, human-readable, editable forms stored as `.form.md` files.

Markform enables AI agents to fill out forms using structured patches, while keeping the
form source in human-readable Markdown.

## Documentation

- [Development Guide](docs/development.md) - Getting started, workflows, and AI SDK
  integration

- [Architecture Design](docs/project/architecture/current/arch-markform-initial-design.md)
  \- Technical specification

## Project Structure

```
packages/markform/     # Main package
  src/engine/          # Core: parsing, validation, serialization
  src/cli/             # CLI commands (inspect, export, serve, fill)
  src/harness/         # Execution harness for agents
  src/integrations/    # AI SDK tools
  examples/            # Example forms
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# CLI usage (use pnpm markform in development)
pnpm markform inspect packages/markform/examples/simple/simple.form.md
pnpm markform export packages/markform/examples/simple/simple.form.md --format=json
pnpm markform serve packages/markform/examples/simple/simple.form.md

# Fill a form with live agent (requires API key for chosen provider)
pnpm markform fill packages/markform/examples/simple/simple.form.md \
  --agent=live --model=openai/gpt-5.2

# Fill a form with mock agent (for testing)
pnpm markform fill packages/markform/examples/simple/simple.form.md \
  --agent=mock \
  --mock-source packages/markform/examples/simple/simple-mock-filled.form.md

# See available providers and models
pnpm markform fill --help
```

## Supported Providers

| Provider | Env Variable | Example Models |
| --- | --- | --- |
| openai | `OPENAI_API_KEY` | gpt-5.2, gpt-5-mini, gpt-5.2-pro |
| google | `GOOGLE_API_KEY` | gemini-2.5-pro, gemini-2.0-flash |
| anthropic | `ANTHROPIC_API_KEY` | claude-sonnet-4-5, claude-haiku-4-5 |
| xai | `XAI_API_KEY` | grok-4, grok-4-fast |
| deepseek | `DEEPSEEK_API_KEY` | deepseek-chat, deepseek-reasoner |

## Example Form

See
[`packages/markform/examples/simple/simple.form.md`](packages/markform/examples/simple/simple.form.md)
for a working example.

## License

MIT
