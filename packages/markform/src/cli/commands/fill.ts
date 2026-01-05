/**
 * Fill command - Run an agent to autonomously fill a form.
 *
 * Supports both mock mode (for testing) and live mode (with LLM agent).
 * Records session transcripts for debugging and golden tests.
 */

import type { Command } from 'commander';

import { appendFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as p from '@clack/prompts';
import pc from 'picocolors';

import { parseForm } from '../../engine/parse.js';
import { serializeForm } from '../../engine/serialize.js';
import { serializeSession } from '../../engine/session.js';
import type {
  FillMode,
  HarnessConfig,
  MockMode,
  PatchRejection,
  SessionFinal,
  SessionTranscript,
  SessionTurnContext,
  SessionTurnStats,
  WireFormat,
} from '../../engine/coreTypes.js';
import { createHarness } from '../../harness/harness.js';
import { resolveHarnessConfig } from '../../harness/harnessConfigResolver.js';
import { createLiveAgent, buildMockWireFormat } from '../../harness/liveAgent.js';
import { createMockAgent } from '../../harness/mockAgent.js';
import {
  DEFAULT_MAX_ISSUES_PER_TURN,
  DEFAULT_MAX_PATCHES_PER_TURN,
  DEFAULT_MAX_TURNS,
  AGENT_ROLE,
  USER_ROLE,
  parseRolesFlag,
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

// =============================================================================
// Trace File Helpers
// =============================================================================

/**
 * Strip ANSI escape codes from a string for file output.
 */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Create a trace function that writes to a file if traceFile is provided.
 * Returns a no-op function if no trace file is configured.
 */
function createTracer(
  traceFile: string | undefined,
  modelId: string | undefined,
): (line: string) => void {
  if (!traceFile) {
    return () => undefined; // No-op
  }

  // Initialize trace file with header
  const timestamp = new Date().toISOString();
  const header = `# Markform Fill Trace Log\n# Started: ${timestamp}\n# Model: ${modelId ?? 'mock'}\n\n`;
  try {
    writeFileSync(traceFile, header, 'utf-8');
  } catch {
    console.error(`Warning: Could not create trace file: ${traceFile}`);
    return () => undefined;
  }

  // Return function that appends lines
  return (line: string) => {
    try {
      const plainLine = stripAnsi(line);
      appendFileSync(traceFile, plainLine + '\n', 'utf-8');
    } catch {
      // Silently ignore write errors to not disrupt main flow
    }
  };
}

// =============================================================================
// Console Formatting
// =============================================================================

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
    .option('--wire-log <file>', 'Capture full wire format (LLM request/response) to YAML file')
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
    .action(
      async (
        file: string,
        options: {
          mock?: boolean;
          model?: string;
          mockSource?: string;
          record?: string;
          wireLog?: string;
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
        },
        cmd: Command,
      ) => {
        const ctx = getCommandContext(cmd);
        const filePath = resolve(file);

        try {
          const startTime = Date.now();

          // Parse and validate --roles (default depends on mode)
          let targetRoles: string[];
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
          const form = parseForm(formContent);

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
          const harness = createHarness(form, harnessConfig);

          // Create tracer for incremental file logging (no-op if no traceFile)
          const trace = createTracer(ctx.traceFile, options.model);

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
          } else {
            // Live agent uses LLM (model is required, validated above)
            const modelIdString = options.model!;
            logVerbose(ctx, `Resolving model: ${modelIdString}`);
            const { model, provider, modelId } = await resolveModel(modelIdString);

            // Store provider and model name for spinner display
            agentProvider = provider;
            agentModelName = modelId;

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
            const callbacks = createCliToolCallbacks(
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
          trace(`Filling form: ${filePath}`);
          const agentInfo = `Agent: ${options.mock ? 'mock' : 'live'}${options.model ? ` (${options.model})` : ''}`;
          logInfo(ctx, agentInfo);
          trace(agentInfo);
          logVerbose(ctx, `Max turns: ${harnessConfig.maxTurns}`);
          trace(`Max turns: ${harnessConfig.maxTurns}`);
          logVerbose(ctx, `Max patches per turn: ${harnessConfig.maxPatchesPerTurn}`);
          trace(`Max patches per turn: ${harnessConfig.maxPatchesPerTurn}`);
          logVerbose(ctx, `Max issues per turn: ${harnessConfig.maxIssuesPerTurn}`);
          trace(`Max issues per turn: ${harnessConfig.maxIssuesPerTurn}`);
          const rolesInfo = `Target roles: ${targetRoles.includes('*') ? '*' : targetRoles.join(', ')}`;
          logVerbose(ctx, rolesInfo);
          trace(rolesInfo);
          logVerbose(ctx, `Fill mode: ${fillMode}`);
          trace(`Fill mode: ${fillMode}`);

          // Run harness loop
          let stepResult = harness.step();
          // Track rejections for wire format context (helps LLM learn from mistakes)
          let previousRejections: PatchRejection[] | undefined;
          const issuesText = formatTurnIssues(stepResult.issues);
          logInfo(ctx, `${pc.bold(`Turn ${stepResult.turnNumber}:`)} ${issuesText}`);
          trace(`Turn ${stepResult.turnNumber}: ${issuesText}`);

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
            const tokenSuffixPlain = stats
              ? ` (tokens: ↓${stats.inputTokens ?? 0} ↑${stats.outputTokens ?? 0})`
              : '';
            logInfo(ctx, `  → ${pc.yellow(String(patches.length))} patches${tokenSuffix}:`);
            trace(`  → ${patches.length} patches${tokenSuffixPlain}:`);
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
                trace(`    ${fieldId} (${typeName}) = ${value}`);
              } else {
                logInfo(ctx, `    ${pc.dim(`(${typeName})`)} = ${pc.green(value)}`);
                trace(`    (${typeName}) = ${value}`);
              }
            }

            // Log stats and prompts in verbose mode
            if (stats) {
              const statsInfo = `  Stats: tokens ↓${stats.inputTokens ?? 0} ↑${stats.outputTokens ?? 0}`;
              logVerbose(ctx, statsInfo);
              trace(statsInfo);
              if (stats.toolCalls && stats.toolCalls.length > 0) {
                const toolSummary = stats.toolCalls.map((t) => `${t.name}(${t.count})`).join(', ');
                logVerbose(ctx, `  Tools: ${toolSummary}`);
                trace(`  Tools: ${toolSummary}`);
              }

              // Log full prompts in verbose mode
              if (stats.prompts) {
                logVerbose(ctx, ``);
                logVerbose(ctx, pc.dim(`  ─── System Prompt ───`));
                trace(`  ─── System Prompt ───`);
                for (const line of stats.prompts.system.split('\n')) {
                  logVerbose(ctx, pc.dim(`  ${line}`));
                  trace(`  ${line}`);
                }
                logVerbose(ctx, ``);
                logVerbose(ctx, pc.dim(`  ─── Context Prompt ───`));
                trace(`  ─── Context Prompt ───`);
                for (const line of stats.prompts.context.split('\n')) {
                  logVerbose(ctx, pc.dim(`  ${line}`));
                  trace(`  ${line}`);
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
            stepResult = harness.apply(patches, stepResult.issues, llmStats, context, wire);

            // Track rejections for next turn's wire format context
            previousRejections = stepResult.rejectedPatches;

            if (stepResult.isComplete) {
              logInfo(ctx, pc.green(`  ✓ Complete`));
              trace(`  ✓ Complete`);
            } else if (!harness.hasReachedMaxTurns()) {
              // Step for next turn (only if not at max turns)
              stepResult = harness.step();
              const nextIssuesText = formatTurnIssues(stepResult.issues);
              logInfo(ctx, `${pc.bold(`Turn ${stepResult.turnNumber}:`)} ${nextIssuesText}`);
              trace(`Turn ${stepResult.turnNumber}: ${nextIssuesText}`);
            }
          }

          const durationMs = Date.now() - startTime;

          // Check if completed
          if (stepResult.isComplete) {
            const successMsg = `Form completed in ${harness.getTurnNumber()} turn(s)`;
            logSuccess(ctx, successMsg);
            trace(successMsg);
          } else if (harness.hasReachedMaxTurns()) {
            const warnMsg = `Max turns reached (${harnessConfig.maxTurns})`;
            logWarn(ctx, warnMsg);
            trace(warnMsg);
          }

          logTiming(ctx, 'Fill time', durationMs);
          trace(`Fill time: ${durationMs}ms`);

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
          const formMarkdown = serializeForm(harness.getForm());

          if (ctx.dryRun) {
            logInfo(ctx, `[DRY RUN] Would write form to: ${outputPath}`);
            trace(`[DRY RUN] Would write form to: ${outputPath}`);
          } else {
            await writeFile(outputPath, formMarkdown);
            logSuccess(ctx, `Form written to: ${outputPath}`);
            trace(`Form written to: ${outputPath}`);
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

          // Write wire log if requested (captures full LLM request/response)
          // Support both --wire-log flag and MARKFORM_WIRE_LOG env var
          const wireLogPathOption = options.wireLog ?? process.env.MARKFORM_WIRE_LOG;
          if (wireLogPathOption) {
            const wireLogPath = resolve(wireLogPathOption);
            // Extract wire format data from transcript turns
            const wireLogData = {
              sessionVersion: transcript.sessionVersion,
              mode: transcript.mode,
              modelId: options.model,
              formPath: filePath,
              turns: transcript.turns
                .map((turn) => ({
                  turn: turn.turn,
                  wire: turn.wire,
                }))
                .filter((t) => t.wire), // Only include turns with wire data
            };
            const wireYaml = serializeSession(wireLogData as unknown as SessionTranscript);

            if (ctx.dryRun) {
              logInfo(ctx, `[DRY RUN] Would write wire log to: ${wireLogPath}`);
            } else {
              await writeFile(wireLogPath, wireYaml);
              logSuccess(ctx, `Wire log written to: ${wireLogPath}`);
            }
          }

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
          } else if (!wireLogPathOption) {
            // Output to stdout in requested format (skip if wire log was written)
            const output = formatOutput(ctx, transcript, (data, useColors) =>
              formatConsoleSession(data as SessionTranscript, useColors),
            );
            console.log(output);
          }

          process.exit(stepResult.isComplete ? 0 : 1);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logError(message);
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
