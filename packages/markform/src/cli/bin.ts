#!/usr/bin/env node
/**
 * CLI entry point for the markform command.
 */

import { runCli } from "./cli.js";

runCli().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
