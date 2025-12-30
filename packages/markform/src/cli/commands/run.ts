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

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { Command } from 'commander';
import * as p from '@clack/prompts';
import pc from 'picocolors';

import { parseForm } from '../../engine/parse.js';
import { inspect } from '../../engine/inspect.js';
import { applyPatches } from '../../engine/apply.js';
import type { ParsedForm, HarnessConfig, RunMode } from '../../engine/coreTypes.js';
import { createHarness } from '../../harness/harness.js';
import { createLiveAgent } from '../../harness/liveAgent.js';
import { resolveModel, getProviderInfo, type ProviderName } from '../../harness/modelResolver.js';
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
import { SUGGESTED_LLMS, hasWebSearchSupport, parseModelIdForDisplay } from '../../llms.js';
import { determineRunMode, formatRunModeSource } from '../lib/runMode.js';
import { exportMultiFormat } from '../lib/exportHelpers.js';
import { generateVersionedPathInFormsDir } from '../lib/versioning.js';
import {
  runInteractiveFill,
  showInteractiveIntro,
  showInteractiveOutro,
} from '../lib/interactivePrompts.js';
import { formatPatchValue, formatPatchType } from '../lib/patchFormat.js';
import { formatTurnIssues } from '../lib/formatting.js';
import {
  createSpinner,
  ensureFormsDir,
  formatPath,
  getCommandContext,
  logError,
  logInfo,
  logTiming,
  logVerbose,
  readFile,
} from '../lib/shared.js';

// =============================================================================
// Types
// =============================================================================

interface FormEntry {
  path: string;
  filename: string;
  mtime: Date;
  title?: string;
  runMode?: RunMode;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Scan forms directory for .form.md files.
 */
function scanFormsDirectory(formsDir: string): FormEntry[] {
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

  // Sort by mtime desc, then alphabetically
  entries.sort((a, b) => {
    const mtimeDiff = b.mtime.getTime() - a.mtime.getTime();
    if (mtimeDiff !== 0) return mtimeDiff;
    return a.filename.localeCompare(b.filename);
  });

  return entries;
}

/**
 * Load form metadata for menu display.
 */
async function enrichFormEntry(entry: FormEntry): Promise<FormEntry> {
  try {
    const content = await readFile(entry.path);
    const form = parseForm(content);
    const runModeResult = determineRunMode(form);

    return {
      ...entry,
      title: form.schema.title,
      runMode: runModeResult.success ? runModeResult.runMode : undefined,
    };
  } catch {
    return entry;
  }
}

/**
 * Format relative time for display.
 */
function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Build model options for the select prompt.
 */
function buildModelOptions(
  webSearchOnly: boolean,
): { value: string; label: string; hint?: string }[] {
  const options: { value: string; label: string; hint?: string }[] = [];

  for (const [provider, models] of Object.entries(SUGGESTED_LLMS)) {
    // Filter for web search support if required
    if (webSearchOnly && !hasWebSearchSupport(provider)) {
      continue;
    }

    const info = getProviderInfo(provider as ProviderName);
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
 * Run interactive fill workflow.
 */
async function runInteractiveWorkflow(
  form: ParsedForm,
  filePath: string,
  formsDir: string,
): Promise<void> {
  const startTime = Date.now();
  const targetRoles = [USER_ROLE];

  // Inspect form to get issues
  const inspectResult = inspect(form, { targetRoles });
  const fieldIssues = inspectResult.issues.filter((i) => i.scope === 'field');
  const uniqueFieldIds = new Set(fieldIssues.map((i) => i.ref));

  if (uniqueFieldIds.size === 0) {
    p.log.info('No user-role fields to fill.');
    return;
  }

  // Show intro
  const formTitle = form.schema.title ?? form.schema.id;
  showInteractiveIntro(formTitle, targetRoles.join(', '), uniqueFieldIds.size);

  // Run interactive prompts
  const { patches, cancelled } = await runInteractiveFill(form, inspectResult.issues);

  if (cancelled) {
    showInteractiveOutro(0, true);
    return;
  }

  // Apply patches
  if (patches.length > 0) {
    applyPatches(form, patches);
  }

  // Export
  await ensureFormsDir(formsDir);
  const outputPath = generateVersionedPathInFormsDir(filePath, formsDir);
  const { reportPath, yamlPath, formPath, schemaPath } = await exportMultiFormat(form, outputPath);

  showInteractiveOutro(patches.length, false);
  console.log('');
  p.log.success('Outputs:');
  console.log(`  ${formatPath(reportPath)}  ${pc.dim('(output report)')}`);
  console.log(`  ${formatPath(yamlPath)}  ${pc.dim('(output values)')}`);
  console.log(`  ${formatPath(formPath)}  ${pc.dim('(filled markform source)')}`);
  console.log(`  ${formatPath(schemaPath)}  ${pc.dim('(JSON Schema)')}`);

  logTiming(
    { verbose: false, format: 'console', dryRun: false, quiet: false, overwrite: false },
    'Fill time',
    Date.now() - startTime,
  );
}

/**
 * Run agent fill workflow.
 */
async function runAgentFillWorkflow(
  form: ParsedForm,
  modelId: string,
  formsDir: string,
  filePath: string,
  isResearch: boolean,
  overwrite: boolean,
): Promise<void> {
  const startTime = Date.now();
  const { provider: providerName, model: modelName } = parseModelIdForDisplay(modelId);

  // Resolve model
  const resolveSpinner = createSpinner({
    type: 'compute',
    operation: `Resolving model: ${modelId}`,
  });

  let model, provider;
  try {
    const result = await resolveModel(modelId);
    model = result.model;
    provider = result.provider;
    resolveSpinner.stop(`✓ Model resolved: ${modelId}`);
  } catch (error) {
    resolveSpinner.error('Model resolution failed');
    throw error;
  }

  // Config based on mode
  const harnessConfig: Partial<HarnessConfig> = {
    maxTurns: DEFAULT_MAX_TURNS,
    maxPatchesPerTurn: isResearch
      ? DEFAULT_RESEARCH_MAX_PATCHES_PER_TURN
      : DEFAULT_MAX_PATCHES_PER_TURN,
    maxIssuesPerTurn: isResearch
      ? DEFAULT_RESEARCH_MAX_ISSUES_PER_TURN
      : DEFAULT_MAX_ISSUES_PER_TURN,
    targetRoles: [AGENT_ROLE],
    fillMode: overwrite ? 'overwrite' : 'continue',
  };

  console.log('');
  console.log(
    `Config: max_turns=${harnessConfig.maxTurns}, max_issues_per_turn=${harnessConfig.maxIssuesPerTurn}, max_patches_per_turn=${harnessConfig.maxPatchesPerTurn}`,
  );

  // Create harness and agent
  const harness = createHarness(form, harnessConfig);
  const agent = createLiveAgent({
    model,
    provider,
    targetRole: AGENT_ROLE,
    enableWebSearch: isResearch,
  });

  // Run harness loop
  const workflowLabel = isResearch ? 'Research' : 'Agent fill';
  p.log.step(pc.bold(`${workflowLabel} in progress...`));
  let stepResult = harness.step();

  while (!stepResult.isComplete && !harness.hasReachedMaxTurns()) {
    console.log(
      `  ${pc.bold(`Turn ${stepResult.turnNumber}:`)} ${formatTurnIssues(stepResult.issues)}`,
    );

    const llmSpinner = createSpinner({
      type: 'api',
      provider: providerName,
      model: modelName,
      turnNumber: stepResult.turnNumber,
    });

    let response;
    try {
      response = await agent.generatePatches(
        stepResult.issues,
        harness.getForm(),
        harnessConfig.maxPatchesPerTurn!,
      );
      llmSpinner.stop();
    } catch (error) {
      llmSpinner.error('LLM call failed');
      throw error;
    }
    const { patches, stats } = response;

    // Log patches
    for (const patch of patches) {
      const typeName = formatPatchType(patch);
      const value = formatPatchValue(patch);
      const fieldId = 'fieldId' in patch ? patch.fieldId : patch.op === 'add_note' ? patch.ref : '';
      if (fieldId) {
        console.log(`    ${pc.cyan(fieldId)} (${typeName}) = ${pc.green(value)}`);
      } else {
        console.log(`    (${typeName}) = ${pc.green(value)}`);
      }
    }

    // Apply patches
    stepResult = harness.apply(patches, stepResult.issues);
    const tokenInfo = stats
      ? ` ${pc.dim(`(tokens: ↓${stats.inputTokens ?? 0} ↑${stats.outputTokens ?? 0})`)}`
      : '';
    console.log(
      `    ${patches.length} patch(es) applied, ${stepResult.issues.length} remaining${tokenInfo}`,
    );

    if (!stepResult.isComplete && !harness.hasReachedMaxTurns()) {
      stepResult = harness.step();
    }
  }

  if (stepResult.isComplete) {
    p.log.success(pc.green(`Form completed in ${harness.getTurnNumber()} turn(s)`));
  } else {
    p.log.warn(pc.yellow(`Max turns reached (${harnessConfig.maxTurns})`));
  }

  // Export
  await ensureFormsDir(formsDir);
  const outputPath = generateVersionedPathInFormsDir(filePath, formsDir);
  const { reportPath, yamlPath, formPath, schemaPath } = await exportMultiFormat(
    harness.getForm(),
    outputPath,
  );

  console.log('');
  p.log.success(`${workflowLabel} complete. Outputs:`);
  console.log(`  ${formatPath(reportPath)}  ${pc.dim('(output report)')}`);
  console.log(`  ${formatPath(yamlPath)}  ${pc.dim('(output values)')}`);
  console.log(`  ${formatPath(formPath)}  ${pc.dim('(filled markform source)')}`);
  console.log(`  ${formatPath(schemaPath)}  ${pc.dim('(JSON Schema)')}`);

  logTiming(
    { verbose: false, format: 'console', dryRun: false, quiet: false, overwrite: false },
    isResearch ? 'Research time' : 'Fill time',
    Date.now() - startTime,
  );
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

          // Build menu options
          const menuOptions = enrichedEntries.map((entry) => {
            const runModeLabel = entry.runMode ? pc.dim(`[${entry.runMode}]`) : '';
            const timeLabel = pc.dim(formatRelativeTime(entry.mtime));
            const title = entry.title ?? entry.filename;
            return {
              value: entry.path,
              label: `${title} ${runModeLabel}`,
              hint: timeLabel,
            };
          });

          if (entries.length > limit) {
            console.log(pc.dim(`Showing ${limit} of ${entries.length} forms`));
          }

          const selection = await p.select({
            message: 'Select a form to run:',
            options: menuOptions,
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
