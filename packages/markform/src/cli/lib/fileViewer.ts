/**
 * File viewer utility for displaying files with colorization and pagination.
 *
 * Provides a modern console experience:
 * - Syntax highlighting for markdown and YAML
 * - Pagination using system pager (less) when available
 * - Fallback to console output when not interactive
 */

import * as p from '@clack/prompts';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import pc from 'picocolors';

/**
 * File option for the viewer chooser.
 */
export interface FileOption {
  path: string;
  label: string;
  hint?: string;
}

/**
 * Check if stdout is an interactive terminal.
 */
function isInteractive(): boolean {
  return process.stdout.isTTY === true;
}

/**
 * Apply terminal formatting to markdown content.
 * Colorizes headers, code blocks, and other elements.
 */
function formatMarkdown(content: string): string {
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
      formatted.push(pc.cyan(line));
      continue;
    }

    // Headers
    if (line.startsWith('# ')) {
      formatted.push(pc.bold(pc.magenta(line)));
      continue;
    }
    if (line.startsWith('## ')) {
      formatted.push(pc.bold(pc.blue(line)));
      continue;
    }
    if (line.startsWith('### ')) {
      formatted.push(pc.bold(pc.cyan(line)));
      continue;
    }
    if (line.startsWith('#### ')) {
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

    // Markform tags - highlight them distinctively
    formattedLine = formattedLine.replace(
      /\{%\s*(\w+)\s*([^%]*)\s*%\}/g,
      (_match, tag: string, attrs: string) => {
        return `${pc.dim('{% ')}${pc.green(tag)}${pc.dim(attrs)} ${pc.dim('%}')}`;
      },
    );

    formatted.push(formattedLine);
  }

  return formatted.join('\n');
}

/**
 * Apply terminal formatting to YAML content.
 */
function formatYaml(content: string): string {
  const lines = content.split('\n');
  const formatted: string[] = [];

  for (const line of lines) {
    // Comments
    if (line.trim().startsWith('#')) {
      formatted.push(pc.dim(line));
      continue;
    }

    // Key-value pairs
    const match = /^(\s*)([^:]+)(:)(.*)$/.exec(line);
    if (match) {
      const [, indent, key, colon, value] = match;
      formatted.push(`${indent}${pc.cyan(key)}${pc.dim(colon)}${pc.yellow(value)}`);
      continue;
    }

    // List items
    if (line.trim().startsWith('-')) {
      formatted.push(pc.green(line));
      continue;
    }

    formatted.push(line);
  }

  return formatted.join('\n');
}

/**
 * Format file content based on extension.
 */
function formatContent(content: string, filename: string): string {
  if (filename.endsWith('.yml') || filename.endsWith('.yaml')) {
    return formatYaml(content);
  }
  if (filename.endsWith('.md')) {
    return formatMarkdown(content);
  }
  return content;
}

/**
 * Display content using system pager (less) if available.
 * Falls back to console.log if not interactive or pager unavailable.
 *
 * @returns Promise that resolves when viewing is complete
 */
async function displayWithPager(content: string, title: string): Promise<void> {
  if (!isInteractive()) {
    console.log(content);
    return;
  }

  // Show title header
  const header = `${pc.bgCyan(pc.black(` ${title} `))}`;

  return new Promise((resolve) => {
    // Try to use less with useful options:
    // -R: interpret ANSI colors
    // -S: don't wrap long lines
    // -X: don't clear screen on exit
    // -F: quit if content fits on one screen
    // -K: exit on Ctrl-C
    const pager = spawn('less', ['-R', '-S', '-X', '-F', '-K'], {
      stdio: ['pipe', 'inherit', 'inherit'],
    });

    pager.on('error', () => {
      // If less is not available, fall back to console output
      console.log(header);
      console.log('');
      console.log(content);
      console.log('');
      resolve();
    });

    pager.on('close', () => {
      resolve();
    });

    // Write content with header
    pager.stdin.write(header + '\n\n');
    pager.stdin.write(content);
    pager.stdin.end();
  });
}

/**
 * Load and display a file with formatting and pagination.
 */
export async function viewFile(filePath: string): Promise<void> {
  const content = readFileSync(filePath, 'utf-8');
  const filename = basename(filePath);
  const formatted = formatContent(content, filename);
  await displayWithPager(formatted, filename);
}

/**
 * Show an interactive file viewer chooser.
 *
 * Presents a list of files to view:
 * - "Show report:" for the report output (.report.md) at the top
 * - "Show source:" for other files (.form.md, .raw.md, .yml)
 * - "Quit" at the bottom
 *
 * Loops until the user selects Quit.
 *
 * @param files Array of file options to display
 */
export async function showFileViewerChooser(files: FileOption[]): Promise<void> {
  if (!isInteractive()) {
    return;
  }

  console.log('');

  // Identify report (.report.md) vs source files
  const reportFile = files.find((f) => f.path.endsWith('.report.md'));
  const sourceFiles = files.filter((f) => !f.path.endsWith('.report.md'));

  while (true) {
    const options: { value: string; label: string; hint?: string }[] = [];

    // Report file first (if exists)
    if (reportFile) {
      options.push({
        value: reportFile.path,
        label: `Show report: ${pc.green(basename(reportFile.path))}`,
        hint: reportFile.hint ?? '',
      });
    }

    // Source files
    for (const file of sourceFiles) {
      options.push({
        value: file.path,
        label: `Show source: ${pc.green(basename(file.path))}`,
        hint: file.hint ?? '',
      });
    }

    // Quit option at the end
    options.push({
      value: 'quit',
      label: 'Quit',
      hint: '',
    });

    const selection = await p.select({
      message: 'View files:',
      options,
    });

    if (p.isCancel(selection) || selection === 'quit') {
      break;
    }

    await viewFile(selection);
    console.log('');
  }
}
