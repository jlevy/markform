/**
 * Run helpers - Pure/testable functions extracted from run command.
 *
 * These functions handle form scanning, metadata loading, and model options,
 * separated from interactive UI code to enable unit testing.
 */

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import pc from 'picocolors';

import { parseForm } from '../../engine/parse.js';
import { SUGGESTED_LLMS, hasWebSearchSupport } from '../../llms.js';
import { getProviderInfo, type BuiltInProviderName } from '../../harness/modelResolver.js';
import { determineRunMode } from './runMode.js';
import { readFile } from './shared.js';
import { getExampleOrder } from '../examples/exampleRegistry.js';
import type { FormDisplayInfo } from './cliTypes.js';

// =============================================================================
// Types
// =============================================================================

export interface FormEntry extends FormDisplayInfo {
  path: string;
  mtime: Date;
}

export interface ModelOption {
  value: string;
  label: string;
  hint?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Scan forms directory for .form.md files.
 */
export function scanFormsDirectory(formsDir: string): FormEntry[] {
  const entries: FormEntry[] = [];

  try {
    const files = readdirSync(formsDir);
    for (const file of files) {
      if (!file.endsWith('.form.md')) continue;

      const fullPath = join(formsDir, file);
      try {
        const stat = statSync(fullPath);
        if (stat.isFile()) {
          entries.push({
            path: fullPath,
            filename: file,
            mtime: stat.mtime,
          });
        }
      } catch {
        // Skip files we can't stat
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  // Sort by canonical example order, then alphabetically for unknown files
  entries.sort((a, b) => {
    const orderDiff = getExampleOrder(a.filename) - getExampleOrder(b.filename);
    if (orderDiff !== 0) return orderDiff;
    return a.filename.localeCompare(b.filename);
  });

  return entries;
}

/**
 * Load form metadata for menu display.
 */
export async function enrichFormEntry(entry: FormEntry): Promise<FormEntry> {
  try {
    const content = await readFile(entry.path);
    const form = parseForm(content);
    const runModeResult = determineRunMode(form);

    return {
      ...entry,
      title: form.schema.title,
      description: form.schema.description,
      runMode: runModeResult.success ? runModeResult.runMode : undefined,
    };
  } catch {
    return entry;
  }
}

/**
 * Build model options for the select prompt.
 */
export function buildModelOptions(webSearchOnly: boolean): ModelOption[] {
  const options: ModelOption[] = [];

  for (const [provider, models] of Object.entries(SUGGESTED_LLMS)) {
    // Filter for web search support if required
    if (webSearchOnly && !hasWebSearchSupport(provider)) {
      continue;
    }

    const info = getProviderInfo(provider as BuiltInProviderName);
    const hasKey = !!process.env[info.envVar];
    const keyStatus = hasKey ? pc.green('✓') : '○';

    for (const model of models) {
      options.push({
        value: `${provider}/${model}`,
        label: `${provider}/${model}`,
        hint: `${keyStatus} ${info.envVar}`,
      });
    }
  }

  options.push({
    value: 'custom',
    label: 'Enter custom model ID...',
    hint: 'provider/model-id format',
  });

  return options;
}
