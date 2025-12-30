/**
 * Browse command - Interactive file browser for the forms directory.
 *
 * Provides a menu-based interface for viewing files with syntax highlighting
 * and pagination. Shows .form.md, .report.md, .yml, and .schema.json files.
 *
 * Usage:
 *   markform browse              # Browse all files in forms/
 *   markform browse --filter=foo # Only show files matching pattern
 */

import { readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

import type { Command } from 'commander';
import * as p from '@clack/prompts';
import pc from 'picocolors';

import { getFormsDir } from '../lib/paths.js';
import { getCommandContext, logError, formatPath } from '../lib/shared.js';
import { showFileViewerChooser, viewFile, type FileOption } from '../lib/fileViewer.js';

// =============================================================================
// Types
// =============================================================================

/** File extensions we support viewing */
const VIEWABLE_EXTENSIONS = ['.form.md', '.report.md', '.yml', '.yaml', '.schema.json', '.raw.md'];

interface FileEntry {
  path: string;
  filename: string;
  mtime: Date;
  extension: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if a file has a viewable extension.
 */
function isViewableFile(filename: string): boolean {
  return VIEWABLE_EXTENSIONS.some((ext) => filename.endsWith(ext));
}

/**
 * Get the display extension for sorting/grouping.
 */
function getExtension(filename: string): string {
  for (const ext of VIEWABLE_EXTENSIONS) {
    if (filename.endsWith(ext)) {
      return ext;
    }
  }
  return '';
}

/**
 * Scan forms directory for viewable files.
 */
function scanFormsDirectory(formsDir: string, filter?: string): FileEntry[] {
  const entries: FileEntry[] = [];

  try {
    const files = readdirSync(formsDir);
    for (const file of files) {
      if (!isViewableFile(file)) continue;

      // Apply filter if provided
      if (filter && !file.toLowerCase().includes(filter.toLowerCase())) {
        continue;
      }

      const fullPath = join(formsDir, file);
      try {
        const stat = statSync(fullPath);
        if (stat.isFile()) {
          entries.push({
            path: fullPath,
            filename: file,
            mtime: stat.mtime,
            extension: getExtension(file),
          });
        }
      } catch {
        // Skip files we can't stat
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  // Sort by modification time (most recent first), then by filename
  entries.sort((a, b) => {
    const timeDiff = b.mtime.getTime() - a.mtime.getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.filename.localeCompare(b.filename);
  });

  return entries;
}

/**
 * Get extension hint for display.
 */
function getExtensionHint(ext: string): string {
  switch (ext) {
    case '.form.md':
      return 'markform source';
    case '.report.md':
      return 'output report';
    case '.yml':
    case '.yaml':
      return 'YAML values';
    case '.schema.json':
      return 'JSON Schema';
    case '.raw.md':
      return 'raw markdown';
    default:
      return '';
  }
}

/**
 * Format file entry for menu display.
 */
function formatFileLabel(entry: FileEntry): string {
  const icon = entry.extension === '.report.md' ? pc.green('*') : ' ';
  return `${icon} ${entry.filename}`;
}

// =============================================================================
// Exported Functions
// =============================================================================

/**
 * Browse files in the forms directory interactively.
 *
 * This is the core browse functionality that can be called programmatically
 * from other commands (like examples).
 *
 * @param formsDir - Path to the forms directory
 * @param filter - Optional filter pattern to match filenames
 * @returns Promise that resolves when user quits the browser
 */
export async function browseFormsDirectory(formsDir: string, filter?: string): Promise<void> {
  const entries = scanFormsDirectory(formsDir, filter);

  if (entries.length === 0) {
    if (filter) {
      p.log.warn(`No files matching "${filter}" found in ${formatPath(formsDir)}`);
    } else {
      p.log.warn(`No viewable files found in ${formatPath(formsDir)}`);
    }
    return;
  }

  // Convert to FileOption format for the viewer
  const files: FileOption[] = entries.map((entry) => ({
    path: entry.path,
    label: basename(entry.path),
    hint: getExtensionHint(entry.extension),
  }));

  // Use the existing file viewer chooser
  await showFileViewerChooser(files);
}

/**
 * Browse specific output files after a form run.
 *
 * This is a convenience function for the examples workflow that shows
 * the standard output files (report, yml, form, schema) for a completed form.
 *
 * @param basePath - Base path of the output (e.g., "forms/movie-research-demo-filled1")
 */
export async function browseOutputFiles(basePath: string): Promise<void> {
  // Standard output file extensions
  const outputExtensions = ['.report.md', '.yml', '.form.md', '.schema.json'];

  const files: FileOption[] = [];
  for (const ext of outputExtensions) {
    const fullPath = basePath + ext;
    try {
      statSync(fullPath);
      files.push({
        path: fullPath,
        label: basename(fullPath),
        hint: getExtensionHint(ext),
      });
    } catch {
      // File doesn't exist, skip
    }
  }

  if (files.length === 0) {
    return;
  }

  await showFileViewerChooser(files);
}

// =============================================================================
// Command Registration
// =============================================================================

/**
 * Register the browse command.
 */
export function registerBrowseCommand(program: Command): void {
  program
    .command('browse')
    .description('Browse and view files in the forms directory')
    .option('--filter <pattern>', 'Only show files matching pattern')
    .action(async (options: { filter?: string }, cmd: Command) => {
      const ctx = getCommandContext(cmd);

      try {
        const formsDir = getFormsDir(ctx.formsDir);

        p.intro(pc.bgCyan(pc.black(' markform browse ')));

        const entries = scanFormsDirectory(formsDir, options.filter);

        if (entries.length === 0) {
          if (options.filter) {
            p.log.warn(`No files matching "${options.filter}" found in ${formatPath(formsDir)}`);
          } else {
            p.log.warn(`No viewable files found in ${formatPath(formsDir)}`);
          }
          console.log('');
          console.log(`Run ${pc.cyan("'markform examples'")} to get started.`);
          p.outro('');
          return;
        }

        // Show file count
        console.log(pc.dim(`Found ${entries.length} file(s) in ${formatPath(formsDir)}`));

        // Build menu options
        const menuOptions: { value: string; label: string; hint?: string }[] = entries.map(
          (entry) => ({
            value: entry.path,
            label: formatFileLabel(entry),
            hint: getExtensionHint(entry.extension),
          }),
        );

        // Add quit option
        menuOptions.push({
          value: 'quit',
          label: 'Quit',
          hint: '',
        });

        // Interactive loop
        while (true) {
          const selection = await p.select({
            message: 'Select a file to view:',
            options: menuOptions,
          });

          if (p.isCancel(selection)) {
            break;
          }

          // Now selection is narrowed to string
          if (selection === 'quit') {
            break;
          }

          // View the selected file
          await viewFile(selection);
          console.log('');
        }

        p.outro('');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError(message);
        process.exit(1);
      }
    });
}
