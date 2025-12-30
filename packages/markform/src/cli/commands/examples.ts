/**
 * Examples command - Copy bundled example forms to the forms directory.
 *
 * This command provides a simple way to get started with markform by
 * copying bundled example forms to your local forms directory.
 *
 * Usage:
 *   markform examples              # Copy all bundled examples to ./forms/
 *   markform examples --list       # List bundled examples (no copy)
 *   markform examples --name=foo   # Copy specific example only
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { Command } from 'commander';
import * as p from '@clack/prompts';
import pc from 'picocolors';

import {
  EXAMPLE_DEFINITIONS,
  DEFAULT_EXAMPLE_ID,
  getExampleById,
  getExamplePath,
  getExampleOrder,
  loadExampleContent,
  getAllExamplesWithMetadata,
} from '../examples/exampleRegistry.js';
import { getFormsDir } from '../lib/paths.js';
import {
  ensureFormsDir,
  formatPath,
  getCommandContext,
  logError,
  readFile,
  writeFile,
} from '../lib/shared.js';
import { formatFormLogLine, formatFormLabel, formatFormHint } from '../lib/formatting.js';
import { parseForm } from '../../engine/parse.js';
import { determineRunMode } from '../lib/runMode.js';
import type { FormDisplayInfo, FormRunMode } from '../lib/cliTypes.js';
import { runForm } from './run.js';
import { browseOutputFiles } from './browse.js';

/**
 * Print non-interactive list of examples.
 */
function printExamplesList(): void {
  console.log(pc.bold('Available examples:\n'));
  const examples = getAllExamplesWithMetadata();
  for (const example of examples) {
    const typeLabel = example.type === 'research' ? pc.magenta('[research]') : pc.blue('[fill]');
    console.log(`  ${pc.cyan(example.id)} ${typeLabel}`);
    console.log(`    ${pc.bold(example.title ?? example.id)}`);
    console.log(`    ${example.description ?? 'No description'}`);
    console.log(`    Source: ${formatPath(getExamplePath(example.id))}`);
    console.log('');
  }
}

/**
 * Copy an example form to the forms directory.
 *
 * @returns true if copied, false if skipped
 */
async function copyExample(
  exampleId: string,
  formsDir: string,
  overwrite: boolean,
  _quiet: boolean,
): Promise<{ copied: boolean; skipped: boolean; path: string }> {
  const example = getExampleById(exampleId);
  if (!example) {
    throw new Error(`Unknown example: ${exampleId}`);
  }

  const outputPath = join(formsDir, example.filename);

  // Check if file exists
  if (existsSync(outputPath)) {
    if (!overwrite) {
      return { copied: false, skipped: true, path: outputPath };
    }
  }

  // Load and write the example
  const content = loadExampleContent(exampleId);
  await writeFile(outputPath, content);

  return { copied: true, skipped: false, path: outputPath };
}

interface FormEntry extends FormDisplayInfo {
  path: string;
}

/**
 * Scan forms directory and enrich entries with metadata.
 */
async function getFormEntries(formsDir: string): Promise<FormEntry[]> {
  const entries: FormEntry[] = [];

  try {
    const files = readdirSync(formsDir);
    for (const file of files) {
      if (!file.endsWith('.form.md')) continue;

      const fullPath = join(formsDir, file);
      try {
        const stat = statSync(fullPath);
        if (stat.isFile()) {
          // Load metadata
          const content = await readFile(fullPath);
          const form = parseForm(content);
          const runModeResult = determineRunMode(form);

          entries.push({
            path: fullPath,
            filename: file,
            title: form.schema.title,
            description: form.schema.description,
            runMode: runModeResult.success ? (runModeResult.runMode as FormRunMode) : undefined,
          });
        }
      } catch {
        // Skip files we can't read
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return entries;
}

/**
 * Copy all examples to the forms directory.
 * Returns { copied, skipped } counts for the caller to handle prompts.
 */
async function copyAllExamples(
  formsDir: string,
  overwrite: boolean,
  quiet: boolean,
): Promise<{ copied: number; skipped: number }> {
  const examples = getAllExamplesWithMetadata();
  const total = examples.length;

  if (!quiet) {
    console.log(`Copying ${total} example forms to ${formatPath(formsDir)}...`);
    console.log('');
  }

  let copied = 0;
  let skipped = 0;

  for (const example of examples) {
    const result = await copyExample(example.id, formsDir, overwrite, quiet);

    if (result.copied) {
      copied++;
      if (!quiet) {
        console.log(formatFormLogLine(example, `  ${pc.green('✓')}`));
      }
    } else if (result.skipped) {
      skipped++;
      if (!quiet) {
        console.log(
          `${formatFormLogLine(example, `  ${pc.yellow('○')}`)} ${pc.dim('(exists, skipped)')}`,
        );
      }
    }
  }

  if (!quiet) {
    console.log('');
    if (skipped > 0) {
      console.log(
        pc.yellow(`Skipped ${skipped} existing file(s). Use --overwrite to replace them.`),
      );
    }
    console.log(pc.green(`Done! Copied ${copied} example form(s) to ${formatPath(formsDir)}`));
  }

  return { copied, skipped };
}

/**
 * Show form selection menu and return the selected path.
 */
async function showFormMenu(formsDir: string): Promise<string | null> {
  const entries = await getFormEntries(formsDir);

  if (entries.length === 0) {
    return null;
  }

  // Sort by canonical order from exampleRegistry
  const sortedEntries = [...entries].sort((a, b) => {
    return getExampleOrder(a.filename) - getExampleOrder(b.filename);
  });

  // Find the default example index for initial selection
  const defaultExample = getExampleById(DEFAULT_EXAMPLE_ID);
  const defaultIndex = sortedEntries.findIndex((e) => e.filename === defaultExample?.filename);

  const menuOptions = sortedEntries.map((entry) => ({
    value: entry.path,
    label: formatFormLabel(entry),
    hint: formatFormHint(entry),
  }));

  // Use the default example's path as initial value
  const defaultEntry = defaultIndex >= 0 ? sortedEntries[defaultIndex] : undefined;
  const initialValue = defaultEntry?.path;

  const selection = await p.select({
    message: 'Select a form to run:',
    options: menuOptions,
    initialValue,
  });

  if (p.isCancel(selection)) {
    return null;
  }

  return selection;
}

/**
 * Copy a specific example to the forms directory.
 */
async function copySingleExample(
  exampleId: string,
  formsDir: string,
  overwrite: boolean,
  quiet: boolean,
): Promise<void> {
  const example = getExampleById(exampleId);
  if (!example) {
    throw new Error(`Unknown example: ${exampleId}`);
  }

  if (!quiet) {
    console.log(`Copying ${example.filename} to ${formatPath(formsDir)}...`);
  }

  const result = await copyExample(exampleId, formsDir, overwrite, quiet);

  if (result.copied) {
    if (!quiet) {
      console.log(formatFormLogLine(example, `  ${pc.green('✓')}`));
      console.log('');
      console.log(pc.green('Done!'));
      console.log(`Run ${pc.cyan(`'markform run ${example.filename}'`)} to try it.`);
    }
  } else if (result.skipped) {
    if (!quiet) {
      console.log(
        `${formatFormLogLine(example, `  ${pc.yellow('○')}`)} ${pc.dim('(exists, skipped)')}`,
      );
      console.log('');
      console.log(pc.yellow(`File already exists. Use --overwrite to replace it.`));
    }
  }
}

/**
 * Register the examples command.
 */
export function registerExamplesCommand(program: Command): void {
  program
    .command('examples')
    .description('Copy bundled example forms to the forms directory')
    .option('--list', 'List available examples without copying')
    .option('--name <example>', 'Copy specific example by ID')
    .action(async (options: { list?: boolean; name?: string }, cmd: Command) => {
      const ctx = getCommandContext(cmd);

      try {
        // --list mode: just print examples and exit
        if (options.list) {
          printExamplesList();
          return;
        }

        // Ensure forms directory exists
        const formsDir = getFormsDir(ctx.formsDir);
        await ensureFormsDir(formsDir);

        // Validate --name if provided
        if (options.name) {
          const example = getExampleById(options.name);
          if (!example) {
            logError(`Unknown example: ${options.name}`);
            console.log('\nAvailable examples:');
            for (const ex of EXAMPLE_DEFINITIONS) {
              console.log(`  ${ex.id}`);
            }
            process.exit(1);
          }

          // Copy single example
          await copySingleExample(options.name, formsDir, ctx.overwrite, ctx.quiet);
        } else {
          // Copy all examples
          const { copied } = await copyAllExamples(formsDir, ctx.overwrite, ctx.quiet);

          // Prompt to run a form (only if not quiet and we copied something)
          if (!ctx.quiet && copied > 0) {
            console.log('');
            const wantToRun = await p.confirm({
              message: 'Do you want to try running a form?',
              initialValue: true,
            });

            if (p.isCancel(wantToRun) || !wantToRun) {
              console.log('');
              console.log(`Run ${pc.cyan("'markform run'")} to select and run a form later.`);
            } else {
              // Show form selection menu
              const selectedPath = await showFormMenu(formsDir);
              if (selectedPath) {
                console.log('');
                // Run the selected form directly
                const exportResult = await runForm(selectedPath, formsDir, ctx.overwrite);

                // Offer to browse output files if form was completed
                if (exportResult) {
                  console.log('');
                  const wantToBrowse = await p.confirm({
                    message: 'Would you like to view the output files?',
                    initialValue: true,
                  });

                  if (!p.isCancel(wantToBrowse) && wantToBrowse) {
                    // Get base path by removing extension from form path
                    const basePath = exportResult.formPath.replace(/\.form\.md$/, '');
                    await browseOutputFiles(basePath);
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError(message);
        process.exit(1);
      }
    });
}
