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

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { Command } from 'commander';
import pc from 'picocolors';

import {
  EXAMPLE_DEFINITIONS,
  getExampleById,
  getExamplePath,
  loadExampleContent,
  getAllExamplesWithMetadata,
} from '../examples/exampleRegistry.js';
import { getFormsDir } from '../lib/paths.js';
import {
  ensureFormsDir,
  formatPath,
  getCommandContext,
  logError,
  writeFile,
} from '../lib/shared.js';

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

/**
 * Copy all examples to the forms directory.
 */
async function copyAllExamples(
  formsDir: string,
  overwrite: boolean,
  quiet: boolean,
): Promise<void> {
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
        console.log(`  ${pc.green('✓')} ${example.filename}`);
      }
    } else if (result.skipped) {
      skipped++;
      if (!quiet) {
        console.log(`  ${pc.yellow('○')} ${example.filename} ${pc.dim('(exists, skipped)')}`);
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
    console.log(pc.green(`Done. ${copied} file(s) copied.`));
    console.log(pc.dim(`Run 'markform run' to try one.`));
  }
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
      console.log(`  ${pc.green('✓')} ${example.filename}`);
      console.log('');
      console.log(pc.green('Done.'));
      console.log(pc.dim(`Run 'markform run ${example.filename}' to try it.`));
    }
  } else if (result.skipped) {
    if (!quiet) {
      console.log(`  ${pc.yellow('○')} ${example.filename} ${pc.dim('(exists, skipped)')}`);
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
          await copyAllExamples(formsDir, ctx.overwrite, ctx.quiet);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError(message);
        process.exit(1);
      }
    });
}
