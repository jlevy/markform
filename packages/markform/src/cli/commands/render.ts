/**
 * Render command - Render a form as static HTML output.
 *
 * Generates the same HTML as the serve command but writes to a file
 * instead of serving via HTTP.
 */

import type { Command } from 'commander';

import { basename, dirname, resolve } from 'node:path';

import pc from 'picocolors';

import { parseForm } from '../../engine/parse.js';
import {
  getCommandContext,
  logDryRun,
  logError,
  logSuccess,
  logVerbose,
  readFile,
  writeFile,
} from '../lib/shared.js';
import { renderFormHtml } from './serve.js';

/**
 * Generate default output path by replacing .form.md with .form.html.
 */
function getDefaultOutputPath(inputPath: string): string {
  const dir = dirname(inputPath);
  const base = basename(inputPath);

  // Replace .form.md extension with .form.html
  const newBase = base.replace(/\.form\.md$/i, '.form.html');

  if (newBase === base) {
    // No .form.md extension found, append .html
    return `${inputPath}.html`;
  }

  return resolve(dir, newBase);
}

/**
 * Register the render command.
 */
export function registerRenderCommand(program: Command): void {
  program
    .command('render <file>')
    .description('Render a form as static HTML output')
    .option('-o, --output <path>', 'Output file path (default: same stem + .html)')
    .action(async (file: string, options: { output?: string }, cmd: Command) => {
      const ctx = getCommandContext(cmd);
      const filePath = resolve(file);
      const outputPath = options.output ? resolve(options.output) : getDefaultOutputPath(filePath);

      try {
        logVerbose(ctx, `Reading file: ${filePath}`);
        const content = await readFile(filePath);

        logVerbose(ctx, 'Parsing form...');
        const form = parseForm(content);

        logVerbose(ctx, 'Rendering HTML...');
        const html = renderFormHtml(form);

        if (ctx.dryRun) {
          logDryRun(`Would write HTML to: ${outputPath}`);
          return;
        }

        await writeFile(outputPath, html);
        logSuccess(ctx, pc.green(`✓ Rendered to ${outputPath}`));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError(message);
        process.exit(1);
      }
    });
}
