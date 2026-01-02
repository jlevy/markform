/**
 * Report command - Generate filtered markdown reports from forms.
 *
 * Produces clean, readable markdown suitable for sharing:
 * - Instructions blocks are excluded by default
 * - Fields/groups with report=false are excluded
 * - Output is plain markdown without directives
 */

import type { Command } from 'commander';

import { parseForm } from '../../engine/parse.js';
import { serializeReport } from '../../engine/serialize.js';
import { REPORT_EXTENSION } from '../../settings.js';
import { getCommandContext, logError, logVerbose, readFile, writeFile } from '../lib/shared.js';

/**
 * Register the report command.
 */
export function registerReportCommand(program: Command): void {
  program
    .command('report <file>')
    .description('Generate filtered markdown report (excludes instructions, report=false elements)')
    .option('-o, --output <file>', 'Output file path (default: stdout)')
    .action(async (file: string, options: { output?: string }, cmd: Command) => {
      const ctx = getCommandContext(cmd);

      try {
        logVerbose(ctx, `Reading file: ${file}`);
        const content = await readFile(file);

        logVerbose(ctx, 'Parsing form...');
        const form = parseForm(content);

        logVerbose(ctx, 'Generating report...');
        const reportContent = serializeReport(form);

        if (options.output) {
          // Write to specified output file
          let outputPath = options.output;
          // Ensure it has the .report.md extension if it's a bare name
          if (!outputPath.endsWith(REPORT_EXTENSION) && !outputPath.endsWith('.md')) {
            outputPath = outputPath + REPORT_EXTENSION;
          }
          await writeFile(outputPath, reportContent);
          logVerbose(ctx, `Report written to: ${outputPath}`);
        } else {
          // Output to stdout
          console.log(reportContent);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError(message);
        process.exit(1);
      }
    });
}
