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

# CLI usage
markform inspect examples/simple/simple.form.md
markform export examples/simple/simple.form.md --format=json
markform serve examples/simple/simple.form.md

# Fill a form with live agent (requires ANTHROPIC_API_KEY)
markform fill examples/simple/simple.form.md --agent=live

# Fill a form with mock agent (for testing)
markform fill examples/simple/simple.form.md --agent=mock --mock-source examples/simple/simple-mock-filled.form.md
```

## Example Form

See
[`packages/markform/examples/simple/simple.form.md`](packages/markform/examples/simple/simple.form.md)
for a working example.

## License

MIT
