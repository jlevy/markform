/**
 * Research command - Fill forms using web-search-enabled models.
 *
 * The research command provides a streamlined workflow for filling forms
 * with information gathered from web searches.
 */

import type { Command } from 'commander';

import { resolve } from 'node:path';

import pc from 'picocolors';

import { parseForm } from '../../engine/parse.js';
import { applyPatches } from '../../engine/apply.js';
import { runResearch } from '../../research/runResearch.js';
import {
  formatSuggestedLlms,
  hasWebSearchSupport,
  parseModelIdForDisplay,
  WEB_SEARCH_CONFIG,
} from '../../llms.js';
import {
  AGENT_ROLE,
  DEFAULT_MAX_TURNS,
  DEFAULT_RESEARCH_MAX_ISSUES_PER_TURN,
  DEFAULT_RESEARCH_MAX_PATCHES_PER_TURN,
} from '../../settings.js';
import { getFormsDir } from '../lib/paths.js';
import {
  createSpinner,
  getCommandContext,
  logError,
  logInfo,
  logSuccess,
  logTiming,
  logVerbose,
  logWarn,
  readFile,
} from '../lib/shared.js';
import { exportMultiFormat } from '../lib/exportHelpers.js';
import { generateVersionedPathInFormsDir } from '../lib/versioning.js';
import { parseInitialValues, validateInitialValueFields } from '../lib/initialValues.js';

/**
 * Register the research command.
 */
export function registerResearchCommand(program: Command): void {
  program
    .command('research <input>')
    .description('Fill a form using a web-search-enabled model')
    .option(
      '--model <provider/model>',
      'LLM model to use (e.g., google/gemini-2.5-flash). Required.',
    )
    .option(
      '--output <path>',
      'Output path for filled form (default: auto-generated in forms directory)',
    )
    .option(
      '--input <fieldId=value>',
      'Set initial field value (can be used multiple times)',
      (value: string, previous: string[]) => previous.concat([value]),
      [] as string[],
    )
    .option(
      '--max-turns <n>',
      `Maximum turns (default: ${DEFAULT_MAX_TURNS})`,
      String(DEFAULT_MAX_TURNS),
    )
    .option(
      '--max-patches <n>',
      `Maximum patches per turn (default: ${DEFAULT_RESEARCH_MAX_PATCHES_PER_TURN})`,
      String(DEFAULT_RESEARCH_MAX_PATCHES_PER_TURN),
    )
    .option(
      '--max-issues <n>',
      `Maximum issues per turn (default: ${DEFAULT_RESEARCH_MAX_ISSUES_PER_TURN})`,
      String(DEFAULT_RESEARCH_MAX_ISSUES_PER_TURN),
    )
    .option('--transcript', 'Save session transcript')
    .action(async (input: string, options: Record<string, unknown>, cmd: Command) => {
      const ctx = getCommandContext(cmd);
      const startTime = Date.now();

      try {
        // Validate model is provided
        if (!options.model) {
          logError('--model is required');
          console.log('');
          console.log(formatSuggestedLlms());
          process.exit(1);
        }

        // Validate model supports web search
        const modelId = options.model as string;
        const { provider, model: modelName } = parseModelIdForDisplay(modelId);

        if (!hasWebSearchSupport(provider)) {
          const webSearchProviders = Object.entries(WEB_SEARCH_CONFIG)
            .filter(([, config]) => config.supported)
            .map(([p]) => p);

          logError(`Model "${modelId}" does not support web search.`);
          console.log('');
          console.log(pc.yellow('Research forms require web search capabilities.'));
          console.log(`Use a model from: ${webSearchProviders.join(', ')}`);
          console.log('');
          console.log('Examples:');
          console.log('  --model openai/gpt-5-mini');
          console.log('  --model anthropic/claude-sonnet-4-5');
          console.log('  --model google/gemini-2.5-flash');
          console.log('  --model xai/grok-4');
          process.exit(1);
        }

        // Resolve input path
        const inputPath = resolve(input);
        logVerbose(ctx, `Input: ${inputPath}`);

        // Read and parse form
        const content = await readFile(inputPath);
        const form = parseForm(content);
        logVerbose(ctx, `Parsed form: ${form.schema.id}`);

        // Parse and apply initial values if provided
        const initialInputs = (options.input as string[]) ?? [];
        if (initialInputs.length > 0) {
          const patches = parseInitialValues(initialInputs);

          // Validate field IDs
          const validFieldIds = new Set(form.orderIndex);
          const invalidFields = validateInitialValueFields(patches, validFieldIds);

          if (invalidFields.length > 0) {
            logWarn(ctx, `Unknown field IDs: ${invalidFields.join(', ')}`);
          }

          // Apply initial values
          applyPatches(form, patches);
          logInfo(ctx, `Applied ${patches.length} initial value(s)`);
        }

        // Resolve output path
        const formsDir = getFormsDir(ctx.formsDir);
        let outputPath: string;

        if (options.output) {
          outputPath = resolve(options.output as string);
        } else {
          // Auto-generate output path in forms directory
          outputPath = generateVersionedPathInFormsDir(inputPath, formsDir);
        }

        logVerbose(ctx, `Output: ${outputPath}`);

        // Parse harness config from options
        const maxTurns = parseInt(options.maxTurns as string, 10);
        const maxPatchesPerTurn = parseInt(options.maxPatches as string, 10);
        const maxIssuesPerTurn = parseInt(options.maxIssues as string, 10);

        // Log research start
        logInfo(ctx, `Research fill with model: ${modelId}`);
        logVerbose(ctx, `Max turns: ${maxTurns}`);
        logVerbose(ctx, `Max patches/turn: ${maxPatchesPerTurn}`);
        logVerbose(ctx, `Max issues/turn: ${maxIssuesPerTurn}`);

        // Create spinner for research operation (only for TTY, not quiet mode)
        // Note: provider and modelName already extracted via parseModelIdForDisplay above
        const spinner =
          process.stdout.isTTY && !ctx.quiet
            ? createSpinner({
                type: 'api',
                provider,
                model: modelName,
              })
            : null;

        // Run research fill
        let result;
        try {
          result = await runResearch(form, {
            model: modelId,
            enableWebSearch: true,
            captureWireFormat: false,
            recordFill: false,
            maxTurnsTotal: maxTurns,
            maxPatchesPerTurn,
            maxIssuesPerTurn,
            targetRoles: [AGENT_ROLE],
            fillMode: 'continue',
          });
          spinner?.stop();
        } catch (error) {
          spinner?.error('Research failed');
          throw error;
        }

        // Log tools used
        if (result.availableTools) {
          logInfo(ctx, `Tools: ${result.availableTools.join(', ')}`);
        }

        // Log result
        const statusColor =
          result.status === 'completed'
            ? pc.green
            : result.status === 'max_turns_reached'
              ? pc.yellow
              : pc.red;

        logInfo(ctx, `Status: ${statusColor(result.status)}`);
        logInfo(ctx, `Turns: ${result.totalTurns}`);

        if (result.inputTokens || result.outputTokens) {
          logVerbose(ctx, `Tokens: ${result.inputTokens ?? 0} in, ${result.outputTokens ?? 0} out`);
        }

        // Export filled form
        const { reportPath, yamlPath, formPath, schemaPath } = await exportMultiFormat(
          result.form,
          outputPath,
        );

        logSuccess(ctx, 'Outputs:');
        console.log(`  ${reportPath}  ${pc.dim('(output report)')}`);
        console.log(`  ${yamlPath}  ${pc.dim('(output values)')}`);
        console.log(`  ${formPath}  ${pc.dim('(filled markform source)')}`);
        console.log(`  ${schemaPath}  ${pc.dim('(JSON Schema)')}`);

        // Save transcript if requested
        if (options.transcript && result.transcript) {
          const { serializeSession } = await import('../../engine/session.js');
          const transcriptPath = outputPath.replace(/\.form\.md$/, '.session.yaml');
          const { writeFile } = await import('../lib/shared.js');
          await writeFile(transcriptPath, serializeSession(result.transcript));
          logInfo(ctx, `Transcript: ${transcriptPath}`);
        }

        logTiming(ctx, 'Research fill', Date.now() - startTime);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError(message);
        process.exit(1);
      }
    });
}
