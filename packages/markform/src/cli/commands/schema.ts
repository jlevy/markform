/**
 * Schema command - Export form structure as JSON Schema.
 *
 * Converts Markform form structure to JSON Schema format for:
 * - Validation in other systems
 * - Code generation (TypeScript types, API clients)
 * - LLM tooling (function calling schemas)
 * - Documentation and interoperability
 */

import type { Command } from 'commander';

import YAML from 'yaml';

import { parseForm } from '../../engine/parse.js';
import { formToJsonSchema, type JsonSchemaDraft } from '../../engine/jsonSchema.js';
import { getCommandContext, logError, logVerbose, readFile } from '../lib/shared.js';

const VALID_DRAFTS: JsonSchemaDraft[] = ['2020-12', '2019-09', 'draft-07'];

/**
 * Register the schema command.
 */
export function registerSchemaCommand(program: Command): void {
  program
    .command('schema <file>')
    .description('Export form structure as JSON Schema')
    .option('--pure', 'Exclude x-markform extension properties')
    .option('--draft <version>', `JSON Schema draft version: ${VALID_DRAFTS.join(', ')}`, '2020-12')
    .option('--compact', 'Output compact JSON (no formatting)')
    .action(
      async (
        file: string,
        options: { pure?: boolean; draft?: string; compact?: boolean },
        cmd: Command,
      ) => {
        const ctx = getCommandContext(cmd);

        try {
          // Validate draft option
          const draft = (options.draft ?? '2020-12') as JsonSchemaDraft;
          if (!VALID_DRAFTS.includes(draft)) {
            throw new Error(
              `Invalid draft version: ${options.draft}. Valid options: ${VALID_DRAFTS.join(', ')}`,
            );
          }

          logVerbose(ctx, `Reading file: ${file}`);
          const content = await readFile(file);

          logVerbose(ctx, 'Parsing form...');
          const form = parseForm(content);

          logVerbose(ctx, 'Generating JSON Schema...');
          const result = formToJsonSchema(form, {
            includeExtensions: !options.pure,
            draft,
          });

          // Determine output format
          const format = ctx.format;

          if (format === 'yaml') {
            console.log(YAML.stringify(result.schema));
          } else {
            // JSON output (default for this command)
            if (options.compact) {
              console.log(JSON.stringify(result.schema));
            } else {
              console.log(JSON.stringify(result.schema, null, 2));
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logError(message);
          process.exit(1);
        }
      },
    );
}
