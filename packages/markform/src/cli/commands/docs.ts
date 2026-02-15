/**
 * Docs command - Display the Markform quick reference.
 *
 * Shows the markform-reference.md file, formatted for the terminal when interactive,
 * or as plain text when piped. This is a concise reference for writing forms,
 * optimized for agent consumption.
 */

import type { Command } from 'commander';

import { readFileSync } from 'node:fs';
import pc from 'picocolors';

import { resolvePackagePath } from '../lib/paths.js';
import { getCommandContext, logError, stripHtmlComments } from '../lib/shared.js';

/**
 * Load the docs content.
 */
function loadDocs(): string {
  const docsPath = resolvePackagePath(import.meta.url, 'docs/markform-reference.md');
  try {
    return readFileSync(docsPath, 'utf-8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load reference docs from ${docsPath}: ${message}`);
  }
}

/**
 * Apply basic terminal formatting to markdown content.
 * Colorizes headers, code blocks, and other elements for better readability.
 */
function formatMarkdown(content: string, useColors: boolean): string {
  if (!useColors) {
    return content;
  }

  const lines = content.split('\n');
  const formatted: string[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    // Track code blocks
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      formatted.push(pc.dim(line));
      continue;
    }

    if (inCodeBlock) {
      formatted.push(pc.dim(line));
      continue;
    }

    // Headers
    if (line.startsWith('# ')) {
      formatted.push(pc.bold(pc.cyan(line)));
      continue;
    }
    if (line.startsWith('## ')) {
      formatted.push(pc.bold(pc.blue(line)));
      continue;
    }
    if (line.startsWith('### ')) {
      formatted.push(pc.bold(line));
      continue;
    }

    // Inline code (backticks)
    let formattedLine = line.replace(/`([^`]+)`/g, (_match, code: string) => {
      return pc.yellow(code);
    });

    // Bold text
    formattedLine = formattedLine.replace(/\*\*([^*]+)\*\*/g, (_match, text: string) => {
      return pc.bold(text);
    });

    // Links - show text in cyan, URL dimmed
    formattedLine = formattedLine.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_match, text: string, url: string) => {
        return `${pc.cyan(text)} ${pc.dim(`(${url})`)}`;
      },
    );

    formatted.push(formattedLine);
  }

  return formatted.join('\n');
}

/**
 * Check if stdout is an interactive terminal.
 */
function isInteractive(): boolean {
  return process.stdout.isTTY === true;
}

/**
 * Display content.
 */
function displayContent(content: string): void {
  console.log(content);
}

/**
 * Register the docs command.
 */
export function registerDocsCommand(program: Command): void {
  program
    .command('docs')
    .description('Display concise Markform syntax reference (agent-friendly)')
    .option('--raw', 'Output raw markdown without formatting')
    .action((options: { raw?: boolean }, cmd: Command) => {
      const ctx = getCommandContext(cmd);

      try {
        const rawDocs = loadDocs();
        // Strip HTML comments (license headers, etc.) for cleaner output
        const docs = stripHtmlComments(rawDocs);

        // Determine if we should colorize
        const shouldColorize = !options.raw && isInteractive() && !ctx.quiet;

        const formatted = formatMarkdown(docs, shouldColorize);
        displayContent(formatted);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError(message);
        process.exit(1);
      }
    });
}
