/**
 * Skill command - Output the Markform SKILL.md content for Claude Code integration.
 *
 * Outputs the bundled SKILL.md to stdout. This is agent-oriented content
 * describing markform's capabilities, commands, and usage patterns.
 */

import type { Command } from 'commander';

import { readFileSync } from 'node:fs';

import { resolvePackagePath } from '../lib/paths.js';
import { logError } from '../lib/shared.js';

/**
 * Load the SKILL.md content.
 */
function loadSkillContent(): string {
  const skillPath = resolvePackagePath(import.meta.url, 'docs/skill/SKILL.md');
  try {
    return readFileSync(skillPath, 'utf-8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load SKILL.md from ${skillPath}: ${message}`);
  }
}

/**
 * Register the skill command.
 */
export function registerSkillCommand(program: Command): void {
  program
    .command('skill')
    .description('Output SKILL.md content for Claude Code integration')
    .action(() => {
      try {
        const content = loadSkillContent();
        process.stdout.write(content);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError(message);
        process.exit(1);
      }
    });
}
