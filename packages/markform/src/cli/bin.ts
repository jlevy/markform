#!/usr/bin/env node
/**
 * CLI entry point for the markform command.
 *
 * Loads environment variables from .env files before running the CLI.
 * Loading order: .env.local first (local overrides), then .env (defaults).
 * Existing environment variables are not overwritten.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { config } from 'dotenv';

import { runCli } from './cli.js';

// Load .env files from current working directory
// .env.local takes precedence over .env, shell env takes precedence over both
const cwd = process.cwd();
for (const file of ['.env.local', '.env']) {
  const path = resolve(cwd, file);
  if (existsSync(path)) {
    // quiet: true suppresses the tip messages added in dotenv v17
    config({ path, override: false, debug: false, quiet: true });
  }
}

runCli().catch((error: unknown) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
