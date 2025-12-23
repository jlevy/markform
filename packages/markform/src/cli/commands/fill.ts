/**
 * Fill command - Run an agent to autonomously fill a form.
 *
 * Supports both mock mode (for testing) and live mode (with LLM agent).
 * Records session transcripts for debugging and golden tests.
 */

import type { Command } from "commander";

import { basename, resolve } from "node:path";

import pc from "picocolors";

import { parseForm } from "../../engine/parse.js";
import { serializeSession } from "../../engine/session.js";
import type {
  HarnessConfig,
  SessionFinal,
  SessionTranscript,
} from "../../engine/types.js";
import { createHarness } from "../../harness/harness.js";
import { createLiveAgent } from "../../harness/liveAgent.js";
import { createMockAgent } from "../../harness/mockAgent.js";
import type { Agent } from "../../harness/mockAgent.js";
import { resolveModel } from "../../harness/modelResolver.js";
import {
  formatOutput,
  getCommandContext,
  logError,
  logInfo,
  logSuccess,
  logTiming,
  logVerbose,
  logWarn,
  readFile,
  writeFile,
} from "../lib/shared.js";

/** Supported agent types */
const AGENT_TYPES = ["mock", "live"] as const;
type AgentType = (typeof AGENT_TYPES)[number];

/** Default model for live agent */
const DEFAULT_MODEL = "anthropic:claude-sonnet-4-5";

/**
 * Format session transcript for console output.
 */
function formatConsoleSession(
  transcript: SessionTranscript,
  useColors: boolean
): string {
  const lines: string[] = [];
  const bold = useColors ? pc.bold : (s: string) => s;
  const dim = useColors ? pc.dim : (s: string) => s;
  const cyan = useColors ? pc.cyan : (s: string) => s;
  const green = useColors ? pc.green : (s: string) => s;
  const yellow = useColors ? pc.yellow : (s: string) => s;

  // Header
  lines.push(bold(cyan("Session Transcript")));
  lines.push("");

  // Session info
  lines.push(`${bold("Form:")} ${transcript.form.path}`);
  lines.push(`${bold("Mode:")} ${transcript.mode}`);
  lines.push(`${bold("Version:")} ${transcript.sessionVersion}`);
  lines.push("");

  // Harness config
  lines.push(bold("Harness Config:"));
  lines.push(`  Max turns: ${transcript.harness.maxTurns}`);
  lines.push(`  Max patches/turn: ${transcript.harness.maxPatchesPerTurn}`);
  lines.push(`  Max issues: ${transcript.harness.maxIssues}`);
  lines.push("");

  // Turns summary
  lines.push(bold(`Turns (${transcript.turns.length}):`));
  for (const turn of transcript.turns) {
    const issueCount = turn.inspect.issues.length;
    const patchCount = turn.apply.patches.length;
    const afterIssues = turn.after.requiredIssueCount;

    lines.push(
      `  Turn ${turn.turn}: ${dim(`${issueCount} issues`)} → ${yellow(`${patchCount} patches`)} → ${afterIssues === 0 ? green("0 remaining") : dim(`${afterIssues} remaining`)}`
    );
  }
  lines.push("");

  // Final result
  const expectText = transcript.final.expectComplete
    ? green("✓ complete")
    : yellow("○ incomplete");
  lines.push(`${bold("Expected:")} ${expectText}`);
  lines.push(`${bold("Completed form:")} ${transcript.final.expectedCompletedForm}`);

  return lines.join("\n");
}

/**
 * Register the fill command.
 */
export function registerFillCommand(program: Command): void {
  program
    .command("fill <file>")
    .description("Run an agent to autonomously fill a form")
    .option(
      "--agent <type>",
      `Agent type: ${AGENT_TYPES.join(", ")} (default: live)`,
      "live"
    )
    .option(
      "--model <id>",
      `Model ID for live agent (format: provider:model-id, default: ${DEFAULT_MODEL})`,
      DEFAULT_MODEL
    )
    .option("--mock-source <file>", "Path to completed form for mock agent")
    .option("--record <file>", "Record session transcript to file")
    .option("--max-turns <n>", "Maximum turns (default: 50)", "50")
    .option("--max-patches <n>", "Maximum patches per turn (default: 20)", "20")
    .option("--max-issues <n>", "Maximum issues per step (default: 10)", "10")
    .option("-o, --output <file>", "Write final form to file")
    .action(
      async (
        file: string,
        options: {
          agent?: string;
          model?: string;
          mockSource?: string;
          record?: string;
          maxTurns?: string;
          maxPatches?: string;
          maxIssues?: string;
          output?: string;
        },
        cmd: Command
      ) => {
        const ctx = getCommandContext(cmd);
        const filePath = resolve(file);

        try {
          // Validate agent type
          const agentType = options.agent as AgentType;
          if (!AGENT_TYPES.includes(agentType)) {
            logError(
              `Invalid agent type '${options.agent}'. Valid types: ${AGENT_TYPES.join(", ")}`
            );
            process.exit(1);
          }

          // Validate options based on agent type
          if (agentType === "mock" && !options.mockSource) {
            logError("--agent=mock requires --mock-source <file>");
            process.exit(1);
          }

          const startTime = Date.now();

          // Parse harness config
          const harnessConfig: Partial<HarnessConfig> = {
            maxTurns: parseInt(options.maxTurns ?? "50", 10),
            maxPatchesPerTurn: parseInt(options.maxPatches ?? "20", 10),
            maxIssues: parseInt(options.maxIssues ?? "10", 10),
          };

          logVerbose(ctx, `Reading form: ${filePath}`);
          const formContent = await readFile(filePath);

          logVerbose(ctx, "Parsing form...");
          const form = parseForm(formContent);

          // Create harness
          const harness = createHarness(form, harnessConfig);

          // Create agent based on type
          let agent: Agent;
          let mockPath: string | undefined;

          if (agentType === "mock") {
            // Mock agent requires a completed form as source
            mockPath = resolve(options.mockSource!);
            logVerbose(ctx, `Reading mock source: ${mockPath}`);
            const mockContent = await readFile(mockPath);
            const mockForm = parseForm(mockContent);
            agent = createMockAgent(mockForm);
          } else {
            // Live agent uses LLM
            const modelId = options.model ?? DEFAULT_MODEL;
            logVerbose(ctx, `Resolving model: ${modelId}`);
            const { model } = await resolveModel(modelId);
            agent = createLiveAgent({ model });
            logVerbose(ctx, `Using live agent with model: ${modelId}`);
          }

          logInfo(ctx, pc.cyan(`Filling form: ${basename(filePath)}`));
          logVerbose(ctx, `Agent: ${agentType}`);
          logVerbose(ctx, `Max turns: ${harnessConfig.maxTurns}`);
          logVerbose(ctx, `Max patches per turn: ${harnessConfig.maxPatchesPerTurn}`);
          logVerbose(ctx, `Max issues per step: ${harnessConfig.maxIssues}`);

          // Run harness loop
          let stepResult = harness.step();
          logVerbose(
            ctx,
            `Turn ${stepResult.turnNumber}: ${stepResult.issues.length} issues`
          );

          while (!stepResult.isComplete && !harness.hasReachedMaxTurns()) {
            // Generate patches from agent
            const patches = await agent.generatePatches(
              stepResult.issues,
              harness.getForm(),
              harnessConfig.maxPatchesPerTurn!
            );

            logVerbose(ctx, `  Applying ${patches.length} patches...`);

            // Apply patches
            stepResult = harness.apply(patches, stepResult.issues);

            logVerbose(
              ctx,
              `  After apply: ${stepResult.isComplete ? "complete" : `${stepResult.issues.length} issues remaining`}`
            );

            // Step for next turn if not complete
            if (!stepResult.isComplete && !harness.hasReachedMaxTurns()) {
              stepResult = harness.step();
              logVerbose(
                ctx,
                `Turn ${stepResult.turnNumber}: ${stepResult.issues.length} issues`
              );
            }
          }

          const durationMs = Date.now() - startTime;

          // Check if completed
          if (stepResult.isComplete) {
            logSuccess(
              ctx,
              `Form completed in ${harness.getTurnNumber()} turn(s)`
            );
          } else if (harness.hasReachedMaxTurns()) {
            logWarn(ctx, `Max turns reached (${harnessConfig.maxTurns})`);
          }

          logTiming(ctx, "Fill time", durationMs);

          // Build session transcript
          const transcript = buildSessionTranscript(
            filePath,
            agentType,
            mockPath,
            options.model ?? DEFAULT_MODEL,
            harnessConfig as HarnessConfig,
            harness.getTurns(),
            stepResult.isComplete
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
          } else {
            // Output to stdout in requested format
            const output = formatOutput(ctx, transcript, (data, useColors) =>
              formatConsoleSession(data as SessionTranscript, useColors)
            );
            console.log(output);
          }

          process.exit(stepResult.isComplete ? 0 : 1);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logError(message);
          process.exit(1);
        }
      }
    );
}

/**
 * Build a session transcript from harness execution.
 */
function buildSessionTranscript(
  formPath: string,
  agentType: AgentType,
  mockPath: string | undefined,
  modelId: string,
  harnessConfig: HarnessConfig,
  turns: SessionTranscript["turns"],
  expectComplete: boolean
): SessionTranscript {
  // Make paths relative for portability
  const relativeFormPath = basename(formPath);
  const relativeMockPath = mockPath ? basename(mockPath) : undefined;

  const final: SessionFinal = {
    expectComplete,
    expectedCompletedForm: relativeMockPath ?? relativeFormPath,
  };

  const transcript: SessionTranscript = {
    sessionVersion: "0.1.0",
    mode: agentType,
    form: {
      path: relativeFormPath,
    },
    harness: harnessConfig,
    turns,
    final,
  };

  // Add mode-specific fields
  if (agentType === "mock" && relativeMockPath) {
    transcript.mock = {
      completedMock: relativeMockPath,
    };
  } else if (agentType === "live") {
    transcript.live = {
      modelId,
    };
  }

  return transcript;
}
