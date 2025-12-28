/**
 * Examples command - Scaffold and fill example forms interactively.
 *
 * Provides a complete workflow:
 * 1. Select an example form
 * 2. Scaffold it with a versioned filename
 * 3. Automatically run interactive fill for user-role fields
 * 4. Optionally run agent fill for remaining fields
 * 5. Export results in multiple formats
 */

import type { Command } from 'commander';

import * as p from '@clack/prompts';
import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import pc from 'picocolors';

import { parseForm } from '../../engine/parse.js';
import { inspect } from '../../engine/inspect.js';
import { applyPatches } from '../../engine/apply.js';
import { exportMultiFormat } from '../lib/exportHelpers.js';
import {
  USER_ROLE,
  AGENT_ROLE,
  DEFAULT_MAX_TURNS,
  DEFAULT_MAX_PATCHES_PER_TURN,
  DEFAULT_MAX_ISSUES_PER_TURN,
  DEFAULT_RESEARCH_MAX_PATCHES_PER_TURN,
  DEFAULT_RESEARCH_MAX_ISSUES_PER_TURN,
  getFormsDir,
} from '../../settings.js';
import { SUGGESTED_LLMS, hasWebSearchSupport } from '../../llms.js';
import type { ParsedForm, HarnessConfig } from '../../engine/coreTypes.js';
import { formatPatchValue, formatPatchType } from '../lib/patchFormat.js';
import { formatTurnIssues } from '../lib/formatting.js';
import { createHarness } from '../../harness/harness.js';
import { createLiveAgent } from '../../harness/liveAgent.js';
import { resolveModel, getProviderInfo, type ProviderName } from '../../harness/modelResolver.js';
import {
  EXAMPLE_DEFINITIONS,
  getExampleById,
  getExamplePath,
  loadExampleContent,
  getAllExamplesWithMetadata,
} from '../examples/exampleRegistry.js';
import {
  ensureFormsDir,
  formatPath,
  getCommandContext,
  logError,
  logTiming,
  writeFile,
} from '../lib/shared.js';
import { generateVersionedPathInFormsDir } from '../lib/versioning.js';
import {
  runInteractiveFill,
  showInteractiveIntro,
  showInteractiveOutro,
} from '../lib/interactivePrompts.js';

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
 * Display API availability status at startup.
 */
function showApiStatus(): void {
  console.log('API Status:');
  for (const [provider, _models] of Object.entries(SUGGESTED_LLMS)) {
    const info = getProviderInfo(provider as ProviderName);
    const hasKey = !!process.env[info.envVar];
    const status = hasKey ? pc.green('✓') : '○';
    const envVar = hasKey ? info.envVar : pc.yellow(info.envVar);
    console.log(`  ${status} ${provider} (${envVar})`);
  }
  console.log('');
}

/**
 * Build model options for the select prompt.
 */
function buildModelOptions(): { value: string; label: string; hint?: string }[] {
  const options: { value: string; label: string; hint?: string }[] = [];

  for (const [provider, models] of Object.entries(SUGGESTED_LLMS)) {
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
 * Prompt user to select a model for agent fill.
 */
async function promptForModel(): Promise<string | null> {
  const modelOptions = buildModelOptions();

  const selection = await p.select({
    message: 'Select LLM model:',
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
 * Build model options filtered to providers with web search support.
 */
function buildWebSearchModelOptions(): { value: string; label: string; hint?: string }[] {
  const options: { value: string; label: string; hint?: string }[] = [];

  for (const [provider, models] of Object.entries(SUGGESTED_LLMS)) {
    // Only include providers with web search support
    if (!hasWebSearchSupport(provider)) {
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
 * Prompt user to select a model with web search capability for research workflow.
 */
async function promptForWebSearchModel(): Promise<string | null> {
  const modelOptions = buildWebSearchModelOptions();

  if (modelOptions.length === 1) {
    // Only "custom" option available, no web-search-capable providers configured
    p.log.warn('No web-search-capable providers found. OpenAI, Google, or xAI API key required.');
  }

  const selection = await p.select({
    message: 'Select LLM model (web search required):',
    options: modelOptions,
  });

  if (p.isCancel(selection)) {
    return null;
  }

  if (selection === 'custom') {
    const customModel = await p.text({
      message: 'Model ID (provider/model-id):',
      placeholder: 'openai/gpt-5-mini',
      validate: (value) => {
        if (!value.includes('/')) {
          return 'Format: provider/model-id (e.g., openai/gpt-5-mini)';
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
 * Run the agent fill workflow.
 * Accepts optional harness config overrides - research uses different defaults.
 */
async function runAgentFill(
  form: ParsedForm,
  modelId: string,
  _outputPath: string,
  configOverrides?: Partial<HarnessConfig>,
): Promise<{ success: boolean; turnCount: number }> {
  const spinner = p.spinner();

  try {
    // Resolve the model
    spinner.start(`Resolving model: ${modelId}`);
    const { model, provider } = await resolveModel(modelId);
    spinner.stop(`Model resolved: ${modelId}`);

    // Create harness config with defaults, then apply overrides
    const harnessConfig: Partial<HarnessConfig> = {
      maxTurns: configOverrides?.maxTurns ?? DEFAULT_MAX_TURNS,
      maxPatchesPerTurn: configOverrides?.maxPatchesPerTurn ?? DEFAULT_MAX_PATCHES_PER_TURN,
      maxIssuesPerTurn: configOverrides?.maxIssuesPerTurn ?? DEFAULT_MAX_ISSUES_PER_TURN,
      targetRoles: [AGENT_ROLE],
      fillMode: 'continue',
    };

    // Log config for visibility
    console.log('');
    console.log(
      `Config: max_turns=${harnessConfig.maxTurns}, max_issues_per_turn=${harnessConfig.maxIssuesPerTurn}, max_patches_per_turn=${harnessConfig.maxPatchesPerTurn}`,
    );

    // Create harness and agent
    const harness = createHarness(form, harnessConfig);
    const agent = createLiveAgent({ model, provider, targetRole: AGENT_ROLE });

    // Run harness loop with verbose output
    p.log.step(pc.bold('Agent fill in progress...'));
    let stepResult = harness.step();

    while (!stepResult.isComplete && !harness.hasReachedMaxTurns()) {
      console.log(
        `  ${pc.bold(`Turn ${stepResult.turnNumber}:`)} ${formatTurnIssues(stepResult.issues)}`,
      );

      // Generate patches from agent
      const response = await agent.generatePatches(
        stepResult.issues,
        harness.getForm(),
        harnessConfig.maxPatchesPerTurn!,
      );
      const { patches } = response;

      // Log each patch with field id, type, and value (truncated)
      for (const patch of patches) {
        const typeName = formatPatchType(patch);
        const value = formatPatchValue(patch);
        // Some patches (add_note, remove_note) don't have fieldId
        const fieldId =
          'fieldId' in patch ? patch.fieldId : patch.op === 'add_note' ? patch.ref : '';
        if (fieldId) {
          console.log(`    ${pc.cyan(fieldId)} (${typeName}) = ${pc.green(value)}`);
        } else {
          console.log(`    (${typeName}) = ${pc.green(value)}`);
        }
      }

      // Apply patches
      stepResult = harness.apply(patches, stepResult.issues);
      console.log(`    ${patches.length} patch(es) applied, ${stepResult.issues.length} remaining`);

      if (!stepResult.isComplete && !harness.hasReachedMaxTurns()) {
        stepResult = harness.step();
      }
    }

    if (stepResult.isComplete) {
      p.log.success(pc.green(`Form completed in ${harness.getTurnNumber()} turn(s)`));
    } else {
      p.log.warn(pc.yellow(`Max turns reached (${harnessConfig.maxTurns})`));
    }

    // Copy final form state
    Object.assign(form, harness.getForm());

    return {
      success: stepResult.isComplete,
      turnCount: harness.getTurnNumber(),
    };
  } catch (error) {
    spinner.stop(pc.red('Agent fill failed'));
    throw error;
  }
}

/**
 * Run the interactive example scaffolding and filling flow.
 *
 * @param preselectedId Optional example ID to pre-select
 * @param formsDirOverride Optional forms directory override from CLI option
 */
async function runInteractiveFlow(
  preselectedId?: string,
  formsDirOverride?: string,
): Promise<void> {
  const startTime = Date.now();

  p.intro(pc.bgCyan(pc.black(' markform examples ')));

  // Ensure forms directory exists (use override if provided)
  const formsDir = getFormsDir(formsDirOverride);
  await ensureFormsDir(formsDir);

  // Show API availability status
  showApiStatus();

  // Step 1: Select example (or use preselected)
  let selectedId = preselectedId;

  if (!selectedId) {
    const examples = getAllExamplesWithMetadata();
    const selection = await p.select({
      message: 'Select an example form to scaffold:',
      options: examples.map((example) => ({
        value: example.id,
        label: example.title ?? example.id,
        hint: example.description,
      })),
    });

    if (p.isCancel(selection)) {
      p.cancel('Cancelled.');
      process.exit(0);
    }

    selectedId = selection;
  }

  const example = getExampleById(selectedId);
  if (!example) {
    p.cancel(`Unknown example: ${selectedId}`);
    process.exit(1);
  }

  // Step 2: Prompt for output filename (use filled naming convention)
  // Generate versioned path in forms directory
  const defaultOutputPath = generateVersionedPathInFormsDir(example.filename, formsDir);
  const defaultFilename = basename(defaultOutputPath);
  const filenameResult = await p.text({
    message: `Output filename (in ${formatPath(formsDir)}):`,
    initialValue: defaultFilename,
    validate: (value) => {
      if (!value.trim()) {
        return 'Filename is required';
      }
      if (!value.endsWith('.form.md') && !value.endsWith('.md')) {
        return 'Filename should end with .form.md or .md';
      }
      return undefined;
    },
  });

  if (p.isCancel(filenameResult)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  const filename = filenameResult;
  const outputPath = join(formsDir, filename);

  // Step 3: Check for existing file
  if (existsSync(outputPath)) {
    const overwrite = await p.confirm({
      message: `${filename} already exists. Overwrite?`,
      initialValue: false,
    });

    if (p.isCancel(overwrite) || !overwrite) {
      p.cancel('Cancelled.');
      process.exit(0);
    }
  }

  // Step 4: Load and write the example
  let content: string;
  try {
    content = loadExampleContent(selectedId);
    await writeFile(outputPath, content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    p.cancel(`Failed to write file: ${message}`);
    process.exit(1);
  }

  p.log.success(`Created ${formatPath(outputPath)}`);

  // Step 5: Parse the form and run interactive fill
  const form = parseForm(content);
  const targetRoles = [USER_ROLE];

  // Inspect form to get issues for user role
  const inspectResult = inspect(form, { targetRoles });
  const fieldIssues = inspectResult.issues.filter((i) => i.scope === 'field');
  const uniqueFieldIds = new Set(fieldIssues.map((i) => i.ref));

  if (uniqueFieldIds.size === 0) {
    p.log.info('No user-role fields to fill in this example.');
    // Check if there are agent fields
    const agentInspect = inspect(form, { targetRoles: [AGENT_ROLE] });
    const agentFieldIssues = agentInspect.issues.filter((i) => i.scope === 'field');

    if (agentFieldIssues.length === 0) {
      logTiming(
        { verbose: false, format: 'console', dryRun: false, quiet: false },
        'Total time',
        Date.now() - startTime,
      );
      p.outro('Form scaffolded with no fields to fill.');
      return;
    }
    // Skip to agent fill
  } else {
    // Show interactive fill intro
    const formTitle = form.schema.title ?? form.schema.id;
    showInteractiveIntro(formTitle, targetRoles.join(', '), uniqueFieldIds.size);

    // Run interactive prompts
    const { patches, cancelled } = await runInteractiveFill(form, inspectResult.issues);

    if (cancelled) {
      showInteractiveOutro(0, true);
      process.exit(1);
    }

    // Apply patches to form
    if (patches.length > 0) {
      applyPatches(form, patches);
    }

    // Export filled form in all formats (examples command always exports all formats)
    const { formPath, rawPath, yamlPath } = await exportMultiFormat(form, outputPath);

    showInteractiveOutro(patches.length, false);
    console.log('');
    p.log.success('Outputs:');
    console.log(`  ${formatPath(formPath)}  ${pc.dim('(markform)')}`);
    console.log(`  ${formatPath(rawPath)}  ${pc.dim('(plain markdown)')}`);
    console.log(`  ${formatPath(yamlPath)}  ${pc.dim('(values as YAML)')}`);

    logTiming(
      { verbose: false, format: 'console', dryRun: false, quiet: false },
      'Fill time',
      Date.now() - startTime,
    );
  }

  // Step 6: Check for agent-role fields and prompt for agent fill
  const agentInspect = inspect(form, { targetRoles: [AGENT_ROLE] });
  const agentFieldIssues = agentInspect.issues.filter((i) => i.scope === 'field');
  const isResearchExample = example.type === 'research';

  if (agentFieldIssues.length > 0) {
    console.log('');
    const workflowLabel = isResearchExample ? 'research' : 'agent fill';
    p.log.info(`This form has ${agentFieldIssues.length} agent-role field(s) remaining.`);

    const confirmMessage = isResearchExample
      ? 'Run research now? (requires web search)'
      : 'Run agent fill now?';
    const runAgent = await p.confirm({
      message: confirmMessage,
      initialValue: true,
    });

    if (p.isCancel(runAgent) || !runAgent) {
      console.log('');
      const cliCommand = isResearchExample
        ? `  markform research ${formatPath(outputPath)} --model=<provider/model>`
        : `  markform fill ${formatPath(outputPath)} --model=<provider/model>`;
      console.log(`You can run ${workflowLabel} later with:`);
      console.log(cliCommand);
      p.outro('Happy form filling!');
      return;
    }

    // Step 7: Model selection - use web search prompt for research examples
    const modelId = isResearchExample ? await promptForWebSearchModel() : await promptForModel();
    if (!modelId) {
      p.cancel('Cancelled.');
      process.exit(0);
    }

    // Step 8: Agent output filename (in forms directory)
    const agentDefaultOutputPath = generateVersionedPathInFormsDir(outputPath, formsDir);
    const agentDefaultFilename = basename(agentDefaultOutputPath);
    const agentFilenameResult = await p.text({
      message: `Agent output filename (in ${formatPath(formsDir)}):`,
      initialValue: agentDefaultFilename,
      validate: (value) => {
        if (!value.trim()) {
          return 'Filename is required';
        }
        return undefined;
      },
    });

    if (p.isCancel(agentFilenameResult)) {
      p.cancel('Cancelled.');
      process.exit(0);
    }

    const agentOutputPath = join(formsDir, agentFilenameResult);

    // Step 9: Run agent fill (research examples use different defaults)
    const agentStartTime = Date.now();
    const timingLabel = isResearchExample ? 'Research time' : 'Agent fill time';

    // Research examples use tighter per-turn limits for focused web search
    const configOverrides = isResearchExample
      ? {
          maxIssuesPerTurn: DEFAULT_RESEARCH_MAX_ISSUES_PER_TURN,
          maxPatchesPerTurn: DEFAULT_RESEARCH_MAX_PATCHES_PER_TURN,
        }
      : undefined;

    try {
      const { success } = await runAgentFill(form, modelId, agentOutputPath, configOverrides);

      logTiming(
        { verbose: false, format: 'console', dryRun: false, quiet: false },
        timingLabel,
        Date.now() - agentStartTime,
      );

      // Step 10: Multi-format export
      const { formPath, rawPath, yamlPath } = await exportMultiFormat(form, agentOutputPath);

      console.log('');
      const successMessage = isResearchExample
        ? 'Research complete. Outputs:'
        : 'Agent fill complete. Outputs:';
      p.log.success(successMessage);
      console.log(`  ${formatPath(formPath)}  (markform)`);
      console.log(`  ${formatPath(rawPath)}  (plain markdown)`);
      console.log(`  ${formatPath(yamlPath)}  (values as YAML)`);

      if (!success) {
        p.log.warn('Agent did not complete all fields. You may need to run it again.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failMessage = isResearchExample ? 'Research failed' : 'Agent fill failed';
      p.log.error(`${failMessage}: ${message}`);
      console.log('');
      console.log('You can try again with:');
      const retryCommand = isResearchExample
        ? `  markform research ${formatPath(outputPath)} --model=${modelId}`
        : `  markform fill ${formatPath(outputPath)} --model=${modelId}`;
      console.log(retryCommand);
    }
  }

  p.outro('Happy form filling!');
}

/**
 * Register the examples command.
 */
export function registerExamplesCommand(program: Command): void {
  program
    .command('examples')
    .description('Try out some example forms interactively using the console')
    .option('--list', 'List available examples without interactive selection')
    .option('--name <example>', 'Select example by ID (still prompts for filename)')
    .action(async (options: { list?: boolean; name?: string }, cmd: Command) => {
      const ctx = getCommandContext(cmd);

      try {
        // --list mode: just print examples and exit
        if (options.list) {
          printExamplesList();
          return;
        }

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
        }

        // Run interactive flow with optional formsDir override
        await runInteractiveFlow(options.name, ctx.formsDir);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError(message);
        process.exit(1);
      }
    });
}
