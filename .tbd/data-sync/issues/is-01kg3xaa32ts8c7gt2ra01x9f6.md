---
close_reason: null
closed_at: 2025-12-23T21:06:40.997Z
created_at: 2025-12-23T21:01:29.143Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.012Z
    original_id: markform-100
id: is-01kg3xaa32ts8c7gt2ra01x9f6
kind: feature
labels: []
parent_id: null
priority: 2
status: closed
title: Add dotenv support for CLI (.env and .env.local)
type: is
updated_at: 2025-12-23T21:06:40.997Z
version: 1
---
The CLI currently has no support for loading environment variables from .env files.

**Current state:**
- bin.ts just runs the CLI without loading any env files
- Scripts like test-live-agent.ts check process.env.ANTHROPIC_API_KEY but rely on shell environment
- A .env file exists in the repo root but is not loaded

**Requirements:**
1. Load .env.local first (for local overrides, not committed to git)
2. Then load .env (for defaults/examples)
3. Never overwrite existing environment variables (shell takes precedence)
4. Must work in both dev (pnpm/tsx) and production (npm-installed binary)

**Recommended approach:**
Use the `dotenv` package (zero-dependency, well-maintained, de facto standard):
```typescript
// In bin.ts, before anything else:
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env.local first (local overrides), then .env (defaults)
// Don't overwrite existing env vars
const cwd = process.cwd();
for (const file of ['.env.local', '.env']) {
  const path = resolve(cwd, file);
  if (existsSync(path)) {
    config({ path, override: false });
  }
}
```

**Dependencies to add:**
- dotenv (runtime)
- @types/dotenv or included types (dev, if needed)

**Files to modify:**
- packages/markform/package.json (add dotenv dependency)
- packages/markform/src/cli/bin.ts (add loading logic)

**Testing:**
- Verify API keys load from .env in dev mode (pnpm markform serve)
- Verify API keys load from .env when installed globally (npm install -g)
- Verify shell env vars take precedence over .env files
- Verify .env.local takes precedence over .env
