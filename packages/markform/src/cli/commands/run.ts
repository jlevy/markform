/**
 * Run command - Interactive launcher for running forms.
 *
 * Provides a menu-based interface for selecting and running forms
 * from the forms directory. Automatically detects run mode based
 * on frontmatter or field roles.
 *
 * Usage:
 *   markform run                   # Browse forms, select, run
 *   markform run movie.form.md     # Run specific form directly
 *   markform run --limit=50        # Override menu limit
 */

import { join } from 'node:path';

import type { Command } from 'commander';
import * as p from '@clack/prompts';
import pc from 'picocolors';

import { parseForm } from '../../engine/parse.js';
import { inspect } from '../../engine/inspect.js';
import { applyPatches } from '../../engine/apply.js';
import type { ParsedForm } from '../../engine/coreTypes.js';
import {
  AGENT_ROLE,
  USER_ROLE,
  MAX_FORMS_IN_MENU,
  DEFAULT_MAX_TURNS,
  DEFAULT_MAX_PATCHES_PER_TURN,
  DEFAULT_MAX_ISSUES_PER_TURN,
  DEFAULT_RESEARCH_MAX_PATCHES_PER_TURN,
  DEFAULT_RESEARCH_MAX_ISSUES_PER_TURN,
} from '../../settings.js';
import { getFormsDir } from '../lib/paths.js';
import { determineRunMode, formatRunModeSource } from '../lib/runMode.js';
import { exportMultiFormat } from '../lib/exportHelpers.js';
import { generateVersionedPathInFormsDir } from '../lib/versioning.js';
import {
  runInteractiveFill,
  showInteractiveIntro,
  showInteractiveOutro,
} from '../lib/interactivePrompts.js';
import { formatFormLabel, formatFormHint } from '../lib/formatting.js';
import type { ExportResult } from '../lib/cliTypes.js';
import { getExampleById, DEFAULT_EXAMPLE_ID } from '../examples/exampleRegistry.js';
import {
  ensureFormsDir,
  formatPath,
  getCommandContext,
  logError,
  logInfo,
  logTiming,
  logVerbose,
  readFile,
  type CommandContext,
} from '../lib/shared.js';
import { createFillLoggingCallbacks } from '../lib/fillLogging.js';
import { fillForm } from '../../harness/programmaticFill.js';
import { scanFormsDirectory, enrichFormEntry, buildModelOptions } from '../lib/runHelpers.js';

/**
 * Prompt user to select a model.
 */
async function promptForModel(webSearchRequired: boolean): Promise<string | null> {
  const modelOptions = buildModelOptions(webSearchRequired);

  if (webSearchRequired && modelOptions.length === 1) {
    p.log.warn('No web-search-capable providers found. OpenAI, Google, or xAI API key required.');
  }

  const message = webSearchRequired
    ? 'Select LLM model (web search required):'
    : 'Select LLM model:';

  const selection = await p.select({
    message,
    options: modelOptions,
  });

  if (p.isCancel(selection)) {
    return null;
  }

  if (selection === 'custom') {
    const customModel = await p.text({
      message: 'Model ID (provider/model-id):',
      placeholder: 'anthropic/claude-sonnet-4-20250514',
      validate: (value) => {
        if (!value.includes('/')) {
          return 'Format: provider/model-id (e.g., anthropic/claude-sonnet-4-20250514)';
        }
        return undefined;
      },
    });

    if (p.isCancel(customModel)) {
      return null;
    }

    return customModel;
  }

  return selection;
}

/**
 * Collect user input interactively (without exporting).
 * Returns true if successful, false if cancelled.
 */
async function collectUserInput(form: ParsedForm): Promise<boolean> {
  const targetRoles = [USER_ROLE];

  // Inspect form to get user-role issues
  const inspectResult = inspect(form, { targetRoles });
  const fieldIssues = inspectResult.issues.filter((i) => i.scope === 'field');
  const uniqueFieldIds = new Set(fieldIssues.map((i) => i.ref));

  if (uniqueFieldIds.size === 0) {
    return true; // No user fields to fill
  }

  // Show intro
  const formTitle = form.schema.title ?? form.schema.id;
  showInteractiveIntro(formTitle, targetRoles.join(', '), uniqueFieldIds.size);

  // Run interactive prompts
  const { patches, cancelled } = await runInteractiveFill(form, inspectResult.issues);

  if (cancelled) {
    showInteractiveOutro(0, true);
    return false;
  }

  // Apply patches to form (in place)
  if (patches.length > 0) {
    applyPatches(form, patches);
  }

  showInteractiveOutro(patches.length, false);
  return true;
}

/**
 * Run interactive fill workflow.
 * @returns ExportResult with paths to output files, or undefined if cancelled/no fields
 */
async function runInteractiveWorkflow(
  form: ParsedForm,
  filePath: string,
  formsDir: string,
): Promise<ExportResult | undefined> {
  const startTime = Date.now();
  const targetRoles = [USER_ROLE];

  // Inspect form to get issues
  const inspectResult = inspect(form, { targetRoles });
  const fieldIssues = inspectResult.issues.filter((i) => i.scope === 'field');
  const uniqueFieldIds = new Set(fieldIssues.map((i) => i.ref));

  if (uniqueFieldIds.size === 0) {
    p.log.info('No user-role fields to fill.');
    return undefined;
  }

  // Show intro
  const formTitle = form.schema.title ?? form.schema.id;
  showInteractiveIntro(formTitle, targetRoles.join(', '), uniqueFieldIds.size);

  // Run interactive prompts
  const { patches, cancelled } = await runInteractiveFill(form, inspectResult.issues);

  if (cancelled) {
    showInteractiveOutro(0, true);
    return undefined;
  }

  // Apply patches
  if (patches.length > 0) {
    applyPatches(form, patches);
  }

  // Export
  await ensureFormsDir(formsDir);
  const outputPath = generateVersionedPathInFormsDir(filePath, formsDir);
  const exportResult = await exportMultiFormat(form, outputPath);

  showInteractiveOutro(patches.length, false);
  console.log('');
  p.log.success('Outputs:');
  console.log(`  ${formatPath(exportResult.reportPath)}  ${pc.dim('(output report)')}`);
  console.log(`  ${formatPath(exportResult.yamlPath)}  ${pc.dim('(output values)')}`);
  console.log(`  ${formatPath(exportResult.formPath)}  ${pc.dim('(filled markform source)')}`);
  console.log(`  ${formatPath(exportResult.schemaPath)}  ${pc.dim('(JSON Schema)')}`);

  logTiming(
    { verbose: false, format: 'console', dryRun: false, quiet: false, overwrite: false },
    'Fill time',
    Date.now() - startTime,
  );

  return exportResult;
}

/**
 * Run agent fill workflow using fillForm with logging callbacks.
 * @returns ExportResult with paths to output files
 */
async function runAgentFillWorkflow(
  form: ParsedForm,
  modelId: string,
  formsDir: string,
  filePath: string,
  isResearch: boolean,
  overwrite: boolean,
  ctx: CommandContext,
): Promise<ExportResult> {
  const startTime = Date.now();

  // Config based on mode
  const maxTurns = DEFAULT_MAX_TURNS;
  const maxPatchesPerTurn = isResearch
    ? DEFAULT_RESEARCH_MAX_PATCHES_PER_TURN
    : DEFAULT_MAX_PATCHES_PER_TURN;
  const maxIssuesPerTurn = isResearch
    ? DEFAULT_RESEARCH_MAX_ISSUES_PER_TURN
    : DEFAULT_MAX_ISSUES_PER_TURN;

  logVerbose(
    ctx,
    `Config: max_turns=${maxTurns}, max_issues_per_turn=${maxIssuesPerTurn}, max_patches_per_turn=${maxPatchesPerTurn}`,
  );

  // Create logging callbacks
  const callbacks = createFillLoggingCallbacks(ctx);

  // Run form fill
  const workflowLabel = isResearch ? 'Research' : 'Agent fill';
  p.log.step(pc.bold(`${workflowLabel} in progress...`));

  const result = await fillForm({
    form,
    model: modelId,
    maxTurnsTotal: maxTurns,
    maxPatchesPerTurn,
    maxIssuesPerTurn,
    targetRoles: [AGENT_ROLE],
    fillMode: overwrite ? 'overwrite' : 'continue',
    enableWebSearch: isResearch,
    captureWireFormat: false,
    callbacks,
  });

  // Check result
  if (result.status.ok) {
    p.log.success(pc.green(`Form completed in ${result.turns} turn(s)`));
  } else if (result.status.reason === 'max_turns') {
    p.log.warn(pc.yellow(`Max turns reached (${maxTurns})`));
  } else {
    throw new Error(result.status.message ?? `Fill failed: ${result.status.reason}`);
  }

  // Export
  await ensureFormsDir(formsDir);
  const outputPath = generateVersionedPathInFormsDir(filePath, formsDir);
  const exportResult = await exportMultiFormat(result.form, outputPath);

  console.log('');
  p.log.success(`${workflowLabel} complete. Outputs:`);
  console.log(`  ${formatPath(exportResult.reportPath)}  ${pc.dim('(output report)')}`);
  console.log(`  ${formatPath(exportResult.yamlPath)}  ${pc.dim('(output values)')}`);
  console.log(`  ${formatPath(exportResult.formPath)}  ${pc.dim('(filled markform source)')}`);
  console.log(`  ${formatPath(exportResult.schemaPath)}  ${pc.dim('(JSON Schema)')}`);

  logTiming(ctx, isResearch ? 'Research time' : 'Fill time', Date.now() - startTime);

  return exportResult;
}

// =============================================================================
// Exported Workflow Function
// =============================================================================

/**
 * Run a form directly (callable from other commands).
 * This executes the same workflow as `markform run <file>`.
 *
 * @param selectedPath - Path to the form file
 * @param formsDir - Directory for output files
 * @param overwrite - Whether to overwrite existing field values
 * @param ctx - Optional command context for logging (defaults to non-verbose/quiet)
 * @returns ExportResult with paths to output files, or undefined if cancelled/no output
 */
export async function runForm(
  selectedPath: string,
  formsDir: string,
  overwrite: boolean,
  ctx?: CommandContext,
): Promise<ExportResult | undefined> {
  // Default context for when called programmatically without CLI context
  const effectiveCtx: CommandContext = ctx ?? {
    verbose: false,
    quiet: false,
    dryRun: false,
    format: 'console',
    overwrite,
  };

  const content = await readFile(selectedPath);
  const form = parseForm(content);

  const runModeResult = determineRunMode(form);
  if (!runModeResult.success) {
    throw new Error(runModeResult.error);
  }

  const { runMode } = runModeResult;

  switch (runMode) {
    case 'interactive':
      return runInteractiveWorkflow(form, selectedPath, formsDir);

    case 'fill':
    case 'research': {
      const isResearch = runMode === 'research';

      // First collect user input if form has user-role fields
      const userInputSuccess = await collectUserInput(form);
      if (!userInputSuccess) {
        p.cancel('Cancelled.');
        return undefined;
      }

      // Then prompt for model and run agent fill
      const modelId = await promptForModel(isResearch);
      if (!modelId) {
        p.cancel('Cancelled.');
        return undefined;
      }
      return runAgentFillWorkflow(
        form,
        modelId,
        formsDir,
        selectedPath,
        isResearch,
        overwrite,
        effectiveCtx,
      );
    }
  }
}

// =============================================================================
// Command Registration
// =============================================================================

/**
 * Register the run command.
 */
export function registerRunCommand(program: Command): void {
  program
    .command('run [file]')
    .description('Browse and run forms from the forms directory')
    .option(
      '--limit <n>',
      `Maximum forms to show in menu (default: ${MAX_FORMS_IN_MENU})`,
      String(MAX_FORMS_IN_MENU),
    )
    .action(async (file: string | undefined, options: { limit?: string }, cmd: Command) => {
      const ctx = getCommandContext(cmd);

      try {
        const formsDir = getFormsDir(ctx.formsDir);
        const limit = options.limit ? parseInt(options.limit, 10) : MAX_FORMS_IN_MENU;
        let selectedPath: string;

        // =====================================================================
        // STEP 1: Select a form
        // =====================================================================
        if (file) {
          // Direct file path provided
          selectedPath = file.startsWith('/') ? file : join(formsDir, file);
          if (!selectedPath.endsWith('.form.md') && !selectedPath.endsWith('.md')) {
            // Try adding extension
            const withExt = `${selectedPath}.form.md`;
            selectedPath = withExt;
          }
        } else {
          // Show menu
          p.intro(pc.bgCyan(pc.black(' markform run ')));

          const entries = scanFormsDirectory(formsDir);

          if (entries.length === 0) {
            p.log.warn(`No forms found in ${formatPath(formsDir)}`);
            console.log('');
            console.log(`Run ${pc.cyan("'markform examples'")} to get started.`);
            p.outro('');
            return;
          }

          // Enrich entries with metadata (limit to menu size)
          const entriesToShow = entries.slice(0, limit);
          const enrichedEntries = await Promise.all(entriesToShow.map(enrichFormEntry));

          // Build menu options using shared formatters
          const menuOptions = enrichedEntries.map((entry) => ({
            value: entry.path,
            label: formatFormLabel(entry),
            hint: formatFormHint(entry),
          }));

          // Find the default example for initial selection
          const defaultExample = getExampleById(DEFAULT_EXAMPLE_ID);
          const defaultEntry = enrichedEntries.find((e) => e.filename === defaultExample?.filename);
          const initialValue = defaultEntry?.path;

          if (entries.length > limit) {
            console.log(pc.dim(`Showing ${limit} of ${entries.length} forms`));
          }

          const selection = await p.select({
            message: 'Select a form to run:',
            options: menuOptions,
            initialValue,
          });

          if (p.isCancel(selection)) {
            p.cancel('Cancelled.');
            process.exit(0);
          }

          selectedPath = selection;
        }

        // =====================================================================
        // STEP 2: Parse form and determine run mode
        // =====================================================================
        logVerbose(ctx, `Reading form: ${selectedPath}`);
        const content = await readFile(selectedPath);
        const form = parseForm(content);

        const runModeResult = determineRunMode(form);
        if (!runModeResult.success) {
          logError(runModeResult.error);
          process.exit(1);
        }

        const { runMode, source } = runModeResult;
        logInfo(ctx, `Run mode: ${runMode} (${formatRunModeSource(source)})`);

        // =====================================================================
        // STEP 3: Execute workflow based on run mode
        // =====================================================================
        switch (runMode) {
          case 'interactive':
            await runInteractiveWorkflow(form, selectedPath, formsDir);
            break;

          case 'fill':
          case 'research': {
            const isResearch = runMode === 'research';

            // First collect user input if form has user-role fields
            const userInputSuccess = await collectUserInput(form);
            if (!userInputSuccess) {
              p.cancel('Cancelled.');
              process.exit(0);
            }

            // Then prompt for model and run agent fill
            const modelId = await promptForModel(isResearch);
            if (!modelId) {
              p.cancel('Cancelled.');
              process.exit(0);
            }
            await runAgentFillWorkflow(
              form,
              modelId,
              formsDir,
              selectedPath,
              isResearch,
              ctx.overwrite,
              ctx,
            );
            break;
          }
        }

        if (!file) {
          p.outro('Happy form filling!');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError(message);
        process.exit(1);
      }
    });
}
