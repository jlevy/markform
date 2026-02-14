/**
 * Skill command - Output the Markform SKILL.md content for Claude Code integration.
 *
 * Outputs the bundled SKILL.md to stdout. This is agent-oriented content
 * describing markform's capabilities, commands, and usage patterns.
 */

import type { Command } from 'commander';

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { logError } from '../lib/shared.js';

/**
 * Get the path to the SKILL.md file.
 * Works both during development and when installed as a package.
 */
function getSkillPath(): string {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const dirName = thisDir.split(/[/\\]/).pop();

  if (dirName === 'dist') {
    // Bundled: dist -> package root -> docs/skill/SKILL.md
    return join(dirname(thisDir), 'docs', 'skill', 'SKILL.md');
  }

  // Development: src/cli/commands -> src/cli -> src -> package root -> docs/skill/SKILL.md
  return join(dirname(dirname(dirname(thisDir))), 'docs', 'skill', 'SKILL.md');
}

/**
 * Load the SKILL.md content.
 */
function loadSkillContent(): string {
  const skillPath = getSkillPath();
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
