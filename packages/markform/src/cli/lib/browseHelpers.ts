/**
 * Browse helpers - Pure/testable functions extracted from browse command.
 *
 * These functions handle file scanning and formatting for the browse command,
 * separated from interactive UI code to enable unit testing.
 */

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import pc from 'picocolors';

// =============================================================================
// Types
// =============================================================================

/** File extensions we support viewing */
export const VIEWABLE_EXTENSIONS = [
  '.form.md',
  '.report.md',
  '.yml',
  '.yaml',
  '.schema.json',
  '.raw.md',
];

export interface FileEntry {
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
export function isViewableFile(filename: string): boolean {
  return VIEWABLE_EXTENSIONS.some((ext) => filename.endsWith(ext));
}

/**
 * Get the display extension for sorting/grouping.
 */
export function getExtension(filename: string): string {
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
export function scanFormsDirectory(formsDir: string, filter?: string): FileEntry[] {
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
export function getExtensionHint(ext: string): string {
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
export function formatFileLabel(entry: FileEntry): string {
  const icon = entry.extension === '.report.md' ? pc.green('*') : ' ';
  return `${icon} ${entry.filename}`;
}
