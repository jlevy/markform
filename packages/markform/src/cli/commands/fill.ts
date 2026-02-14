/**
 * Fill command - Run an agent to autonomously fill a form.
 *
 * Supports both mock mode (for testing) and live mode (with LLM agent).
 * Records session transcripts for debugging and golden tests.
 */

import type { Command } from 'commander';

import { resolve } from 'node:path';

import * as p from '@clack/prompts';
import pc from 'picocolors';

import { writeFileSync } from 'node:fs';

import { parseForm } from '../../engine/parse.js';
import { serializeForm } from '../../engine/serialize.js';
import { serializeSession } from '../../engine/session.js';
import { computeProgressSummary, computeStructureSummary } from '../../engine/summaries.js';
import type {
  FillMode,
  HarnessConfig,
  MockMode,
  ParsedForm,
  PatchRejection,
  SessionFinal,
  SessionTranscript,
  SessionTurnContext,
  SessionTurnStats,
  WireFormat,
} from '../../engine/coreTypes.js';
import type { TurnProgress } from '../../harness/harnessTypes.js';
import { FillRecordCollector } from '../../harness/fillRecordCollector.js';
import { isEmptyFillRecord, stripUnstableFillRecordFields } from '../../harness/fillRecord.js';
import { formatFillRecordSummary } from '../../harness/formatFillRecordSummary.js';
import { createHarness } from '../../harness/harness.js';
import { resolveHarnessConfig } from '../../harness/harnessConfigResolver.js';
import { createLiveAgent, buildMockWireFormat } from '../../harness/liveAgent.js';
import { createMockAgent } from '../../harness/mockAgent.js';
import { fillForm } from '../../harness/programmaticFill.js';
import {
  DEFAULT_MAX_ISSUES_PER_TURN,
  DEFAULT_MAX_PATCHES_PER_TURN,
  DEFAULT_MAX_TURNS,
  AGENT_ROLE,
  USER_ROLE,
  parseRolesFlag,
  deriveFillRecordPath,
} from '../../settings.js';
import { getFormsDir } from '../lib/paths.js';
import { formatSuggestedLlms } from '../../llms.js';
import type { Agent } from '../../harness/mockAgent.js';
import { resolveModel } from '../../harness/modelResolver.js';
import {
  createSpinner,
  ensureFormsDir,
  formatOutput,
  formatPath,
  getCommandContext,
  logError,
  logInfo,
  logSuccess,
  logTiming,
  logVerbose,
  logWarn,
  readFile,
  writeFile,
  type SpinnerHandle,
} from '../lib/shared.js';
import { exportMultiFormat } from '../lib/exportHelpers.js';
import { generateVersionedPathInFormsDir } from '../lib/versioning.js';
import {
  runInteractiveFill,
  showInteractiveIntro,
  showInteractiveOutro,
} from '../lib/interactivePrompts.js';
import { formatPatchValue, formatPatchType } from '../lib/patchFormat.js';
import { formatTurnIssues } from '../lib/formatting.js';
import { inspect } from '../../engine/inspect.js';
import { applyPatches } from '../../engine/apply.js';
import { createCliToolCallbacks } from '../lib/fillCallbacks.js';

/**
 * Format session transcript for console output.
 */
function formatConsoleSession(transcript: SessionTranscript, useColors: boolean): string {
  const lines: string[] = [];
  const bold = useColors ? pc.bold : (s: string) => s;
  const dim = useColors ? pc.dim : (s: string) => s;
  const cyan = useColors ? pc.cyan : (s: string) => s;
  const green = useColors ? pc.green : (s: string) => s;
  const yellow = useColors ? pc.yellow : (s: string) => s;

  // Header
  lines.push(bold(cyan('Session Transcript')));
  lines.push('');

  // Session info
  lines.push(`${bold('Form:')} ${transcript.form.path}`);
  lines.push(`${bold('Mode:')} ${transcript.mode}`);
  lines.push(`${bold('Version:')} ${transcript.sessionVersion}`);
  lines.push('');

  // Harness config
  lines.push(bold('Harness Config:'));
  lines.push(`  Max turns: ${transcript.harness.maxTurns}`);
  lines.push(`  Max patches/turn: ${transcript.harness.maxPatchesPerTurn}`);
  lines.push(`  Max issues/turn: ${transcript.harness.maxIssuesPerTurn}`);
  lines.push('');

  // Turns summary
  lines.push(bold(`Turns (${transcript.turns.length}):`));
  for (const turn of transcript.turns) {
    const issueCount = turn.inspect.issues.length;
    const patchCount = turn.apply.patches.length;
    const afterIssues = turn.after.requiredIssueCount;

    lines.push(
      `  Turn ${turn.turn}: ${dim(`${issueCount} issues`)} → ${yellow(`${patchCount} patches`)} → ${afterIssues === 0 ? green('0 remaining') : dim(`${afterIssues} remaining`)}`,
    );
  }
  lines.push('');

  // Final result
  const expectText = transcript.final.expectComplete ? green('✓ complete') : yellow('○ incomplete');
  lines.push(`${bold('Expected:')} ${expectText}`);
  lines.push(`${bold('Completed form:')} ${transcript.final.expectedCompletedForm}`);

  return lines.join('\n');
}

/**
 * Register the fill command.
 */
export function registerFillCommand(program: Command): void {
  program
    .command('fill <file>')
    .description('Run an agent to autonomously fill a form')
    .option('--mock', 'Use mock agent (requires --mock-source)')
    .option(
      '--model <id>',
      'Model ID for live agent (format: provider/model-id, e.g. openai/gpt-5-mini)',
    )
    .option('--mock-source <file>', 'Path to completed form for mock agent')
    .option('--record <file>', 'Record session transcript to file')
    .option(
      '--max-turns <n>',
      `Maximum turns (default: ${DEFAULT_MAX_TURNS})`,
      String(DEFAULT_MAX_TURNS),
    )
    .option(
      '--max-patches <n>',
      `Maximum patches per turn (default: ${DEFAULT_MAX_PATCHES_PER_TURN})`,
      String(DEFAULT_MAX_PATCHES_PER_TURN),
    )
    .option(
      '--max-issues <n>',
      `Maximum issues shown per turn (default: ${DEFAULT_MAX_ISSUES_PER_TURN})`,
      String(DEFAULT_MAX_ISSUES_PER_TURN),
    )
    .option('--max-fields <n>', 'Maximum unique fields per turn (applied before --max-issues)')
    .option('--max-groups <n>', 'Maximum unique groups per turn (applied before --max-issues)')
    .option(
      '--roles <roles>',
      "Target roles to fill (comma-separated, or '*' for all; default: 'agent', or 'user' in --interactive mode)",
    )
    .option(
      '--mode <mode>',
      'Fill mode: continue (skip filled fields) or overwrite (re-fill; default: continue)',
    )
    .option('-o, --output <file>', 'Write final form to file')
    .option('--prompt <file>', 'Path to custom system prompt file (appends to default)')
    .option(
      '--instructions <text>',
      'Inline system prompt (appends to default; takes precedence over --prompt)',
    )
    .option(
      '-i, --interactive',
      'Interactive mode: prompt user for field values (defaults to user role)',
    )
    .option('--normalize', 'Regenerate form without preserving external content')
    .option('--record-fill', 'Write fill record to sidecar .fill.json file')
    .option(
      '--record-fill-stable',
      'Write fill record without timestamps/durations (for golden tests)',
    )
    .option('--parallel', 'Enable parallel execution for forms with parallel batches')
    .action(
      async (
        file: string,
        options: {
          mock?: boolean;
          model?: string;
          mockSource?: string;
          record?: string;
          maxTurns?: string;
          maxPatches?: string;
          maxIssues?: string;
          maxFields?: string;
          maxGroups?: string;
          roles?: string;
          mode?: string;
          output?: string;
          prompt?: string;
          instructions?: string;
          interactive?: boolean;
          normalize?: boolean;
          recordFill?: boolean;
          recordFillStable?: boolean;
          parallel?: boolean;
        },
        cmd: Command,
      ) => {
        const ctx = getCommandContext(cmd);
        const filePath = resolve(file);

        // Declare variables that may be needed in error handler
        // These are accessible in catch block for partial fill record writing
        let harness: ReturnType<typeof createHarness> | undefined;
        let collector: FillRecordCollector | undefined;
        let targetRoles: string[] = [];
        let form: ParsedForm | undefined;

        try {
          const startTime = Date.now();

          // Parse and validate --roles (default depends on mode)
          if (options.roles) {
            try {
              targetRoles = parseRolesFlag(options.roles);
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              logError(`Invalid --roles: ${message}`);
              process.exit(1);
            }
          } else {
            // Default: user role for interactive, agent role for agent mode
            targetRoles = options.interactive ? [USER_ROLE] : [AGENT_ROLE];
          }

          // Parse and validate --mode
          let fillMode: FillMode = 'continue'; // Default
          if (options.mode) {
            if (options.mode !== 'continue' && options.mode !== 'overwrite') {
              logError(`Invalid --mode: ${options.mode}. Valid modes: continue, overwrite`);
              process.exit(1);
            }
            fillMode = options.mode;
          }

          logVerbose(ctx, `Reading form: ${filePath}`);
          const formContent = await readFile(filePath);

          logVerbose(ctx, 'Parsing form...');
          form = parseForm(formContent);

          // =====================================================================
          // INTERACTIVE MODE
          // =====================================================================
          if (options.interactive) {
            // Validate: --interactive conflicts with mock mode
            if (options.mock) {
              logError('--interactive cannot be used with --mock');
              process.exit(1);
            }
            if (options.model) {
              logError('--interactive cannot be used with --model');
              process.exit(1);
            }
            if (options.mockSource) {
              logError('--interactive cannot be used with --mock-source');
              process.exit(1);
            }

            // Inspect form to get issues for target roles
            const inspectResult = inspect(form, { targetRoles });

            // Show intro
            const formTitle = form.schema.title ?? form.schema.id;
            const fieldIssues = inspectResult.issues.filter((i) => i.scope === 'field');
            const uniqueFieldIds = new Set(fieldIssues.map((i) => i.ref));
            showInteractiveIntro(formTitle, targetRoles.join(', '), uniqueFieldIds.size);

            // Run interactive prompts
            const { patches, cancelled } = await runInteractiveFill(form, inspectResult.issues);

            if (cancelled) {
              showInteractiveOutro(0, true);
              process.exit(1);
            }

            // Apply patches to form (mutates form in place)
            if (patches.length > 0) {
              applyPatches(form, patches);
            }

            const durationMs = Date.now() - startTime;

            // Write output files (all formats)
            // Default to forms directory when --output is not specified
            let outputPath: string;
            if (options.output) {
              outputPath = resolve(options.output);
            } else {
              const formsDir = getFormsDir(ctx.formsDir);
              await ensureFormsDir(formsDir);
              outputPath = generateVersionedPathInFormsDir(filePath, formsDir);
            }

            if (ctx.dryRun) {
              logInfo(ctx, `[DRY RUN] Would write form to: ${outputPath}`);
              showInteractiveOutro(patches.length, false);
            } else {
              // Export all formats (report, yaml, form, schema)
              const { reportPath, yamlPath, formPath, schemaPath } = await exportMultiFormat(
                form,
                outputPath,
              );

              showInteractiveOutro(patches.length, false);
              console.log('');
              p.log.success('Outputs:');
              console.log(`  ${formatPath(reportPath)}  ${pc.dim('(output report)')}`);
              console.log(`  ${formatPath(yamlPath)}  ${pc.dim('(output values)')}`);
              console.log(`  ${formatPath(formPath)}  ${pc.dim('(filled markform source)')}`);
              console.log(`  ${formatPath(schemaPath)}  ${pc.dim('(JSON Schema)')}`);
            }

            logTiming(ctx, 'Fill time', durationMs);

            // Show next step hint
            if (patches.length > 0) {
              console.log('');
              console.log('Next step: fill remaining fields with agent');
              console.log(`  markform fill ${formatPath(outputPath)} --model=<provider/model>`);
            }

            process.exit(0);
          }

          // =====================================================================
          // AGENT MODE (mock or live)
          // =====================================================================

          // Validate options based on mode
          if (options.mock && !options.mockSource) {
            logError('--mock requires --mock-source <file>');
            process.exit(1);
          }

          if (!options.mock && !options.model) {
            logError('Live agent requires --model <provider/model-id>');
            console.log('');
            console.log(formatSuggestedLlms());
            process.exit(1);
          }

          // Warn about --roles=* in non-interactive mode
          if (targetRoles.includes('*')) {
            logWarn(ctx, 'Warning: Filling all roles including user-designated fields');
          }

          // =====================================================================
          // PARALLEL EXECUTION PATH (uses programmatic fillForm API)
          // =====================================================================
          if (options.parallel && !options.mock) {
            logInfo(ctx, pc.cyan(`Filling form (parallel): ${filePath}`));
            logInfo(ctx, `Agent: live (${options.model})`);

            // Determine system prompt
            let systemPrompt: string | undefined;
            if (options.instructions) {
              systemPrompt = options.instructions;
            } else if (options.prompt) {
              const promptPath = resolve(options.prompt);
              systemPrompt = await readFile(promptPath);
            }

            // Determine output path
            let outputPath: string;
            if (options.output) {
              outputPath = resolve(options.output);
            } else {
              const formsDir = getFormsDir(ctx.formsDir);
              await ensureFormsDir(formsDir);
              outputPath = generateVersionedPathInFormsDir(filePath, formsDir);
            }

            // Run programmatic fill with parallel enabled
            const result = await fillForm({
              form,
              model: options.model!,
              enableParallel: true,
              enableWebSearch: true,
              captureWireFormat: false,
              recordFill: true,
              targetRoles,
              fillMode,
              maxTurnsTotal: options.maxTurns ? parseInt(options.maxTurns, 10) : undefined,
              maxPatchesPerTurn: options.maxPatches ? parseInt(options.maxPatches, 10) : undefined,
              maxIssuesPerTurn: options.maxIssues ? parseInt(options.maxIssues, 10) : undefined,
              systemPromptAddition: systemPrompt,
              callbacks: {
                onTurnStart: ({ turnNumber, executionId }) => {
                  logInfo(
                    ctx,
                    `${pc.bold(`Turn ${turnNumber}:`)} started (${pc.dim(executionId)})`,
                  );
                },
                onTurnComplete: (progress) => {
                  const patchText = progress.patchesApplied === 1 ? 'patch' : 'patches';
                  logInfo(
                    ctx,
                    `  → ${pc.yellow(String(progress.patchesApplied))} ${patchText} applied`,
                  );
                  if (progress.isComplete) {
                    logInfo(ctx, pc.green(`  ✓ Complete`));
                  }
                },
                onBatchStart: ({ batchId, itemCount }) => {
                  logInfo(ctx, pc.cyan(`Starting batch "${batchId}" with ${itemCount} items`));
                },
                onBatchComplete: ({ batchId, patchesApplied }) => {
                  logInfo(ctx, pc.cyan(`Batch "${batchId}" completed: ${patchesApplied} patches`));
                },
              },
            });

            const durationMs = Date.now() - startTime;

            // Check if completed
            if (result.status.ok) {
              logSuccess(ctx, `Form completed in ${result.turns} turn(s)`);
            } else {
              logWarn(ctx, `Fill incomplete: ${result.status.reason}`);
            }

            logTiming(ctx, 'Fill time', durationMs);

            // Write output
            if (ctx.dryRun) {
              logInfo(ctx, `[DRY RUN] Would write form to: ${outputPath}`);
            } else {
              await writeFile(outputPath, result.markdown);
              logSuccess(ctx, `Form written to: ${outputPath}`);
            }

            // Print fill record summary
            if (result.record && !ctx.quiet) {
              console.log('');
              const summary = formatFillRecordSummary(result.record, { verbose: ctx.verbose });
              console.error(summary);
            }

            // Write fill record sidecar (skip if no turns were executed)
            if ((options.recordFill || options.recordFillStable) && result.record) {
              if (isEmptyFillRecord(result.record)) {
                logVerbose(ctx, 'Skipping fill record: no turns were executed');
              } else {
                const sidecarPath = deriveFillRecordPath(outputPath);
                const recordToWrite = options.recordFillStable
                  ? stripUnstableFillRecordFields(result.record)
                  : result.record;

                if (ctx.dryRun) {
                  logInfo(ctx, `[DRY RUN] Would write fill record to: ${sidecarPath}`);
                } else {
                  writeFileSync(sidecarPath, JSON.stringify(recordToWrite, null, 2));
                  logSuccess(ctx, `Fill record written to: ${sidecarPath}`);
                }
              }
            }

            process.exit(result.status.ok ? 0 : 1);
          }

          // =====================================================================
          // SERIAL EXECUTION PATH (original manual harness loop)
          // =====================================================================

          // Parse harness config using resolver (handles frontmatter defaults)
          const cliOptions = {
            maxTurns: options.maxTurns ? parseInt(options.maxTurns, 10) : undefined,
            maxPatchesPerTurn: options.maxPatches ? parseInt(options.maxPatches, 10) : undefined,
            maxIssuesPerTurn: options.maxIssues ? parseInt(options.maxIssues, 10) : undefined,
            maxFieldsPerTurn: options.maxFields ? parseInt(options.maxFields, 10) : undefined,
            maxGroupsPerTurn: options.maxGroups ? parseInt(options.maxGroups, 10) : undefined,
            targetRoles,
            fillMode,
          };
          const harnessConfig = resolveHarnessConfig(form, cliOptions);

          // Create harness
          harness = createHarness(form, harnessConfig);

          // Note: collector is declared in outer scope for error handler access

          // Create agent based on type
          let agent: Agent;
          let mockPath: string | undefined;
          let agentProvider: string | undefined;
          let agentModelName: string | undefined;
          let targetRole: string = AGENT_ROLE; // Track for mock wire format

          // Mutable spinner reference for tool callbacks (updated each turn)
          // Using explicit type to avoid narrowing issues in closures
          let currentSpinner = null as SpinnerHandle | null;

          if (options.mock) {
            // Mock agent requires a completed form as source
            mockPath = resolve(options.mockSource!);
            logVerbose(ctx, `Reading mock source: ${mockPath}`);
            const mockContent = await readFile(mockPath);
            const mockForm = parseForm(mockContent);
            agent = createMockAgent(mockForm);

            // Always create collector for summary output
            const structureSummary = computeStructureSummary(form.schema);
            collector = new FillRecordCollector({
              form: {
                id: form.schema.id,
                title: form.schema.title,
                description: form.schema.description,
                structure: structureSummary,
              },
              provider: 'mock',
              model: 'mock',
              parallelEnabled: false,
            });
          } else {
            // Live agent uses LLM (model is required, validated above)
            const modelIdString = options.model!;
            logVerbose(ctx, `Resolving model: ${modelIdString}`);
            const { model, provider, modelId } = await resolveModel(modelIdString);

            // Store provider and model name for spinner display
            agentProvider = provider;
            agentModelName = modelId;

            // Always create collector for summary output
            const structureSummary = computeStructureSummary(form.schema);
            collector = new FillRecordCollector({
              form: {
                id: form.schema.id,
                title: form.schema.title,
                description: form.schema.description,
                structure: structureSummary,
              },
              provider,
              model: modelIdString,
              parallelEnabled: false,
            });

            // Determine system prompt: --instructions > --prompt > default
            let systemPrompt: string | undefined;
            if (options.instructions) {
              systemPrompt = options.instructions;
              logVerbose(ctx, 'Using inline system prompt from --instructions');
            } else if (options.prompt) {
              const promptPath = resolve(options.prompt);
              logVerbose(ctx, `Reading system prompt from: ${promptPath}`);
              systemPrompt = await readFile(promptPath);
            }

            // Create callbacks that reference the mutable spinner
            // Callbacks update spinner during tool execution (especially web search)
            const cliCallbacks = createCliToolCallbacks(
              {
                // Proxy to current spinner (may be null between turns)
                message: (msg) => currentSpinner?.message(msg),
                update: (context) => currentSpinner?.update(context),
                stop: (msg) => currentSpinner?.stop(msg),
                error: (msg) => currentSpinner?.error(msg),
                getElapsedMs: () => currentSpinner?.getElapsedMs() ?? 0,
              },
              ctx,
            );

            // Merge CLI callbacks with collector callbacks
            // Collector is always defined at this point (created above)
            const liveCollector = collector;
            const callbacks = {
              onTurnStart: (turn: {
                turnNumber: number;
                issuesCount: number;
                order?: number;
                executionId?: string;
              }) => {
                liveCollector.onTurnStart({
                  turnNumber: turn.turnNumber,
                  issuesCount: turn.issuesCount,
                  order: turn.order ?? 0,
                  executionId: turn.executionId ?? 'eid:serial:o0',
                });
              },
              onTurnComplete: (progress: TurnProgress) => {
                liveCollector.onTurnComplete(progress);
              },
              onToolStart: (call: { name: string; input: unknown; executionId: string }) => {
                cliCallbacks.onToolStart?.(call);
                liveCollector.onToolStart(call);
              },
              onToolEnd: (call: {
                name: string;
                output: unknown;
                durationMs: number;
                error?: string;
                executionId: string;
              }) => {
                cliCallbacks.onToolEnd?.(call);
                liveCollector.onToolEnd(call);
              },
              onLlmCallStart: (call: { model: string; executionId: string }) => {
                liveCollector.onLlmCallStart(call);
              },
              onLlmCallEnd: (call: {
                model: string;
                inputTokens: number;
                outputTokens: number;
                executionId: string;
              }) => {
                liveCollector.onLlmCallEnd(call);
              },
              onWebSearch: (info: {
                query: string;
                resultCount: number;
                provider: string;
                executionId: string;
              }) => {
                liveCollector.onWebSearch(info);
              },
            };

            // Pass first target role to agent (for instruction lookup)
            targetRole = targetRoles[0] === '*' ? AGENT_ROLE : (targetRoles[0] ?? AGENT_ROLE);

            const liveAgent = createLiveAgent({
              model,
              provider,
              systemPromptAddition: systemPrompt,
              targetRole,
              enableWebSearch: true,
              callbacks,
            });
            agent = liveAgent;

            // Log available tools
            const toolNames = liveAgent.getAvailableToolNames();
            logInfo(ctx, `Available tools: ${toolNames.join(', ')}`);
            logVerbose(ctx, `Using live agent with model: ${modelId}`);
          }

          logInfo(ctx, pc.cyan(`Filling form: ${filePath}`));
          logInfo(
            ctx,
            `Agent: ${options.mock ? 'mock' : 'live'}${options.model ? ` (${options.model})` : ''}`,
          );
          logVerbose(ctx, `Max turns: ${harnessConfig.maxTurns}`);
          logVerbose(ctx, `Max patches per turn: ${harnessConfig.maxPatchesPerTurn}`);
          logVerbose(ctx, `Max issues per turn: ${harnessConfig.maxIssuesPerTurn}`);
          logVerbose(
            ctx,
            `Target roles: ${targetRoles.includes('*') ? '*' : targetRoles.join(', ')}`,
          );
          logVerbose(ctx, `Fill mode: ${fillMode}`);

          // Run harness loop
          let stepResult = harness.step();
          // Track rejections for wire format context (helps LLM learn from mistakes)
          let previousRejections: PatchRejection[] | undefined;
          logInfo(
            ctx,
            `${pc.bold(`Turn ${stepResult.turnNumber}:`)} ${formatTurnIssues(stepResult.issues)}`,
          );

          // Record first turn start for FillRecord (fixes mf-mgxo: empty timeline bug)
          collector.onTurnStart({
            turnNumber: stepResult.turnNumber,
            issuesCount: stepResult.issues.length,
            order: 0,
            executionId: 'eid:serial:o0',
          });

          while (!stepResult.isComplete && !harness.hasReachedMaxTurns()) {
            // Create spinner for LLM call (only for live agent with TTY)
            let spinner: SpinnerHandle | null = null;
            if (
              !options.mock &&
              agentProvider &&
              agentModelName &&
              process.stdout.isTTY &&
              !ctx.quiet
            ) {
              spinner = createSpinner({
                type: 'api',
                provider: agentProvider,
                model: agentModelName,
                turnNumber: stepResult.turnNumber,
              });
              // Set mutable reference so tool callbacks can update spinner
              currentSpinner = spinner;
            }

            // Generate patches from agent
            let response;
            try {
              response = await agent.fillFormTool(
                stepResult.issues,
                harness.getForm(),
                harnessConfig.maxPatchesPerTurn,
              );
              spinner?.stop();
              currentSpinner = null; // Clear reference after spinner stops
            } catch (error) {
              spinner?.error('LLM call failed');
              currentSpinner = null; // Clear reference on error
              throw error;
            }
            const { patches, stats } = response;

            // Log patches with field id, type, and value (truncated)
            const tokenSuffix = stats
              ? ` ${pc.dim(`(tokens: ↓${stats.inputTokens ?? 0} ↑${stats.outputTokens ?? 0})`)}`
              : '';
            logInfo(ctx, `  → ${pc.yellow(String(patches.length))} patches${tokenSuffix}:`);
            for (const patch of patches) {
              const typeName = formatPatchType(patch);
              const value = formatPatchValue(patch);
              // Some patches (add_note, remove_note) don't have fieldId
              const fieldId =
                'fieldId' in patch ? patch.fieldId : patch.op === 'add_note' ? patch.ref : '';
              if (fieldId) {
                logInfo(
                  ctx,
                  `    ${pc.cyan(fieldId)} ${pc.dim(`(${typeName})`)} = ${pc.green(value)}`,
                );
              } else {
                logInfo(ctx, `    ${pc.dim(`(${typeName})`)} = ${pc.green(value)}`);
              }
            }

            // Log stats and prompts in verbose mode
            if (stats) {
              logVerbose(
                ctx,
                `  Stats: tokens ↓${stats.inputTokens ?? 0} ↑${stats.outputTokens ?? 0}`,
              );
              if (stats.toolCalls && stats.toolCalls.length > 0) {
                const toolSummary = stats.toolCalls.map((t) => `${t.name}(${t.count})`).join(', ');
                logVerbose(ctx, `  Tools: ${toolSummary}`);
              }

              // Log full prompts in verbose mode
              if (stats.prompts) {
                logVerbose(ctx, ``);
                logVerbose(ctx, pc.dim(`  ─── System Prompt ───`));
                for (const line of stats.prompts.system.split('\n')) {
                  logVerbose(ctx, pc.dim(`  ${line}`));
                }
                logVerbose(ctx, ``);
                logVerbose(ctx, pc.dim(`  ─── Context Prompt ───`));
                for (const line of stats.prompts.context.split('\n')) {
                  logVerbose(ctx, pc.dim(`  ${line}`));
                }
                logVerbose(ctx, ``);
              }
            }

            // Convert TurnStats to SessionTurnStats for session logging
            let llmStats: SessionTurnStats | undefined;
            let context: SessionTurnContext | undefined;
            let wire: WireFormat | undefined;

            if (stats) {
              // Live agent - use stats from LLM call
              llmStats = {
                inputTokens: stats.inputTokens,
                outputTokens: stats.outputTokens,
                toolCalls:
                  stats.toolCalls && stats.toolCalls.length > 0 ? stats.toolCalls : undefined,
              };
              // Get context and wire from live agent stats
              if (stats.prompts) {
                context = {
                  systemPrompt: stats.prompts.system,
                  contextPrompt: stats.prompts.context,
                };
              }
              wire = stats.wire;
            } else if (options.mock) {
              // Mock agent - build wire format for session logging
              wire = buildMockWireFormat(
                harness.getForm(),
                stepResult.issues,
                patches,
                harnessConfig.maxPatchesPerTurn,
                targetRole,
                previousRejections,
              );
              // Extract context from wire for convenience
              context = {
                systemPrompt: wire.request.system,
                contextPrompt: wire.request.prompt,
              };
            }

            // Apply patches (with wire format for comprehensive session logging)
            const prevTurnNumber = stepResult.turnNumber;
            const prevIssuesShown = stepResult.issues.length;
            stepResult = harness.apply(patches, stepResult.issues, llmStats, context, wire);

            // Record turn completion for FillRecord (fixes mf-mgxo: empty timeline bug)
            const rejectedPatches = stepResult.rejectedPatches ?? [];
            collector.onTurnComplete({
              turnNumber: prevTurnNumber,
              issuesShown: prevIssuesShown,
              patchesApplied: patches.length - rejectedPatches.length,
              requiredIssuesRemaining: stepResult.issues.filter((i) => i.severity === 'required')
                .length,
              isComplete: stepResult.isComplete,
              rejectedPatches,
              issues: stepResult.issues,
              patches,
            });

            // Track rejections for next turn's wire format context
            previousRejections = stepResult.rejectedPatches;

            if (stepResult.isComplete) {
              logInfo(ctx, pc.green(`  ✓ Complete`));
            } else if (!harness.hasReachedMaxTurns()) {
              // Step for next turn (only if not at max turns)
              stepResult = harness.step();
              logInfo(
                ctx,
                `${pc.bold(`Turn ${stepResult.turnNumber}:`)} ${formatTurnIssues(stepResult.issues)}`,
              );

              // Record next turn start for FillRecord
              collector.onTurnStart({
                turnNumber: stepResult.turnNumber,
                issuesCount: stepResult.issues.length,
                order: 0,
                executionId: 'eid:serial:o0',
              });
            }
          }

          const durationMs = Date.now() - startTime;

          // Check if completed
          if (stepResult.isComplete) {
            logSuccess(ctx, `Form completed in ${harness.getTurnNumber()} turn(s)`);
          } else if (harness.hasReachedMaxTurns()) {
            logWarn(ctx, `Max turns reached (${harnessConfig.maxTurns})`);
          }

          logTiming(ctx, 'Fill time', durationMs);

          // Write output file
          // Default to forms directory when --output is not specified
          let outputPath: string;
          if (options.output) {
            outputPath = resolve(options.output);
          } else {
            const formsDir = getFormsDir(ctx.formsDir);
            await ensureFormsDir(formsDir);
            outputPath = generateVersionedPathInFormsDir(filePath, formsDir);
          }
          const formMarkdown = serializeForm(harness.getForm(), {
            preserveContent: !options.normalize,
          });

          if (ctx.dryRun) {
            logInfo(ctx, `[DRY RUN] Would write form to: ${outputPath}`);
          } else {
            await writeFile(outputPath, formMarkdown);
            logSuccess(ctx, `Form written to: ${outputPath}`);
          }

          // Always compute FillRecord for summary output
          // Get final form progress
          const finalInspect = inspect(harness.getForm(), { targetRoles });
          const progressSummary = computeProgressSummary(
            form.schema,
            harness.getForm().responsesByFieldId,
            harness.getForm().notes,
            finalInspect.issues,
          );

          // Set status and get record
          collector.setStatus(
            stepResult.isComplete ? 'completed' : 'partial',
            stepResult.isComplete ? undefined : 'max_turns',
          );
          const fillRecord = collector.getRecord(progressSummary.counts);

          // Print summary to stderr (unless quiet)
          if (!ctx.quiet) {
            console.log('');
            const summary = formatFillRecordSummary(fillRecord, { verbose: ctx.verbose });
            console.error(summary);
          }

          // Write FillRecord sidecar file if recordFill or recordFillStable is enabled
          // Skip if no turns were executed (empty session)
          if (options.recordFill || options.recordFillStable) {
            if (isEmptyFillRecord(fillRecord)) {
              logVerbose(ctx, 'Skipping fill record: no turns were executed');
            } else {
              const sidecarPath = deriveFillRecordPath(outputPath);

              // Strip unstable fields for golden tests
              const recordToWrite = options.recordFillStable
                ? stripUnstableFillRecordFields(fillRecord)
                : fillRecord;

              if (ctx.dryRun) {
                logInfo(ctx, `[DRY RUN] Would write fill record to: ${sidecarPath}`);
              } else {
                writeFileSync(sidecarPath, JSON.stringify(recordToWrite, null, 2));
                logSuccess(ctx, `Fill record written to: ${sidecarPath}`);
              }
            }
          }

          // Build session transcript
          const transcript = buildSessionTranscript(
            filePath,
            options.mock ? 'mock' : 'live',
            mockPath,
            options.model,
            harnessConfig,
            harness.getTurns(),
            stepResult.isComplete,
            outputPath,
          );

          // Output or record session
          if (options.record) {
            const recordPath = resolve(options.record);
            // Always use YAML for recorded files (standard format)
            const yaml = serializeSession(transcript);

            if (ctx.dryRun) {
              logInfo(ctx, `[DRY RUN] Would write session to: ${recordPath}`);
              console.log(yaml);
            } else {
              await writeFile(recordPath, yaml);
              logSuccess(ctx, `Session recorded to: ${recordPath}`);
            }
          } else if (!ctx.quiet) {
            // Output to stdout in requested format (unless quiet)
            const output = formatOutput(ctx, transcript, (data, useColors) =>
              formatConsoleSession(data as SessionTranscript, useColors),
            );
            console.log(output);
          }

          process.exit(stepResult.isComplete ? 0 : 1);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logError(message);

          // Write partial fill record if available (helps with debugging failures)
          if (
            (options.recordFill || options.recordFillStable) &&
            collector &&
            harness &&
            form &&
            options.output
          ) {
            try {
              // Get current form state and compute progress
              const currentForm = harness.getForm();
              const finalInspect = inspect(currentForm, { targetRoles });
              const progressSummary = computeProgressSummary(
                form.schema,
                currentForm.responsesByFieldId,
                currentForm.notes,
                finalInspect.issues,
              );

              // Set failed status with error message
              collector.setStatus('failed', message);
              const fillRecord = collector.getRecord(progressSummary.counts);

              // Skip if no turns were executed (empty session)
              if (!isEmptyFillRecord(fillRecord)) {
                const outputPath = resolve(options.output);
                const sidecarPath = deriveFillRecordPath(outputPath);
                const recordToWrite = options.recordFillStable
                  ? stripUnstableFillRecordFields(fillRecord)
                  : fillRecord;

                writeFileSync(sidecarPath, JSON.stringify(recordToWrite, null, 2));
                logWarn(ctx, `Partial fill record written to: ${sidecarPath}`);
              }
            } catch {
              // Ignore errors writing partial record - the main error is more important
            }
          }

          process.exit(1);
        }
      },
    );
}

/**
 * Build a session transcript from harness execution.
 */
function buildSessionTranscript(
  formPath: string,
  mockMode: MockMode,
  mockPath: string | undefined,
  modelId: string | undefined,
  harnessConfig: HarnessConfig,
  turns: SessionTranscript['turns'],
  expectComplete: boolean,
  outputPath: string,
): SessionTranscript {
  const final: SessionFinal = {
    expectComplete,
    // For mock mode, use the mock source as expected; otherwise use actual output
    expectedCompletedForm: mockMode === 'mock' ? (mockPath ?? outputPath) : outputPath,
  };

  const transcript: SessionTranscript = {
    sessionVersion: '0.1.0',
    mode: mockMode,
    form: {
      path: formPath,
    },
    harness: harnessConfig,
    turns,
    final,
  };

  // Add mode-specific fields
  if (mockMode === 'mock' && mockPath) {
    transcript.mock = {
      completedMock: mockPath,
    };
  } else if (mockMode === 'live' && modelId) {
    transcript.live = {
      modelId,
    };
  }

  return transcript;
}
