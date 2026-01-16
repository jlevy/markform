/**
 * APIs command - Display the Markform API documentation.
 *
 * Shows the markform-apis.md file, formatted for the terminal when interactive,
 * or as plain text when piped. This documents the TypeScript and AI SDK APIs.
 */

import type { Command } from 'commander';

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';

import { getCommandContext, logError, stripHtmlComments } from '../lib/shared.js';

/**
 * Get the path to the markform-apis.md file.
 * Works both during development and when installed as a package.
 */
function getApisPath(): string {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const dirName = thisDir.split(/[/\\]/).pop();

  if (dirName === 'dist') {
    // Bundled: dist -> package root -> docs/markform-apis.md
    return join(dirname(thisDir), 'docs', 'markform-apis.md');
  }

  // Development: src/cli/commands -> src/cli -> src -> package root -> docs/markform-apis.md
  return join(dirname(dirname(dirname(thisDir))), 'docs', 'markform-apis.md');
}

/**
 * Load the APIs documentation content.
 */
function loadApis(): string {
  const apisPath = getApisPath();
  try {
    return readFileSync(apisPath, 'utf-8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load API docs from ${apisPath}: ${message}`);
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
 * Register the apis command.
 */
export function registerApisCommand(program: Command): void {
  program
    .command('apis')
    .description('Display Markform TypeScript and AI SDK API documentation')
    .option('--raw', 'Output raw markdown without formatting')
    .action((options: { raw?: boolean }, cmd: Command) => {
      const ctx = getCommandContext(cmd);

      try {
        const rawApis = loadApis();
        // Strip HTML comments (license headers, etc.) for cleaner output
        const apis = stripHtmlComments(rawApis);

        // Determine if we should colorize
        const shouldColorize = !options.raw && isInteractive() && !ctx.quiet;

        const formatted = formatMarkdown(apis, shouldColorize);
        displayContent(formatted);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError(message);
        process.exit(1);
      }
    });
}
