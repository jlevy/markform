#!/usr/bin/env -S npx tsx
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/consistent-type-imports, no-restricted-syntax, @typescript-eslint/prefer-nullish-coalescing */
/**
 * Live Agent Test Script
 *
 * Tests the Markform AI SDK integration with a real LLM.
 *
 * Prerequisites:
 *   1. Install the AI SDK: pnpm add ai @ai-sdk/anthropic
 *   2. Set ANTHROPIC_API_KEY environment variable
 *
 * Usage:
 *   npx tsx scripts/test-live-agent.ts [form-path]
 *
 * Examples:
 *   npx tsx scripts/test-live-agent.ts
 *   npx tsx scripts/test-live-agent.ts examples/simple/simple.form.md
 *
 * The script will:
 *   1. Load the form
 *   2. Create AI SDK tools
 *   3. Run the agent loop to fill the form
 *   4. Log the session transcript
 *   5. Validate final form completeness
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Markform imports
import { parseForm } from "../src/engine/parse.js";
import { serializeSession } from "../src/engine/session.js";
import type { SessionTranscript, SessionTurn, Patch } from "../src/engine/types.js";
import {
  createMarkformTools,
  MarkformSessionStore,
} from "../src/integrations/ai-sdk.js";

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageDir = join(__dirname, "..");

// =============================================================================
// Configuration
// =============================================================================

interface Config {
  formPath: string;
  maxTurns: number;
  model: string;
  outputSessionPath?: string;
  verbose: boolean;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const formPath =
    args[0] ?? join(packageDir, "examples/simple/simple.form.md");

  return {
    formPath: resolve(formPath),
    maxTurns: 20,
    model: "claude-sonnet-4-20250514",
    outputSessionPath: args[1],
    verbose: args.includes("--verbose") || args.includes("-v"),
  };
}

// =============================================================================
// Mock Agent (fallback when AI SDK not installed)
// =============================================================================

async function runMockAgent(config: Config): Promise<void> {
  console.log("Running in mock mode (AI SDK not installed)\n");

  // Load form
  const formContent = readFileSync(config.formPath, "utf-8");
  const form = parseForm(formContent);

  // Create session store and tools
  const store = new MarkformSessionStore(form);
  const tools = createMarkformTools({ sessionStore: store });

  // Session transcript
  const turns: SessionTurn[] = [];
  let turnNumber = 0;

  console.log("=== Starting Mock Agent Loop ===\n");

  // Initial inspect
  let inspectResult = await tools.markform_inspect.execute({});
  console.log(`Initial state: ${inspectResult.message}`);
  console.log(`Issues: ${inspectResult.data.issues.length}`);

  // Mock filling loop
  while (!inspectResult.data.isComplete && turnNumber < config.maxTurns) {
    turnNumber++;
    console.log(`\n--- Turn ${turnNumber} ---`);

    // Get issues to address
    const issues = inspectResult.data.issues.filter(
      (i) => i.severity === "required"
    );

    if (issues.length === 0) {
      console.log("No required issues remaining.");
      break;
    }

    console.log(`Addressing ${issues.length} issue(s)...`);

    // Generate mock patches for first few issues
    const patches: Patch[] = [];
    for (const issue of issues.slice(0, 3)) {
      const fieldId = issue.ref;
      const field = form.schema.groups
        .flatMap((g) => g.children)
        .find((f) => f.id === fieldId);

      if (!field) {
        continue;
      }

      switch (field.kind) {
        case "string":
          patches.push({
            op: "set_string",
            fieldId,
            value: `Mock value for ${field.label}`,
          });
          break;
        case "number":
          patches.push({ op: "set_number", fieldId, value: 42 });
          break;
        case "string_list":
          patches.push({
            op: "set_string_list",
            fieldId,
            items: ["item1", "item2"],
          });
          break;
        case "single_select":
          if (field.options.length > 0) {
            patches.push({
              op: "set_single_select",
              fieldId,
              selected: field.options[0]?.id ?? null,
            });
          }
          break;
        case "multi_select":
          if (field.options.length > 0) {
            patches.push({
              op: "set_multi_select",
              fieldId,
              selected: [field.options[0]?.id ?? ""],
            });
          }
          break;
        case "checkboxes":
          if (field.options.length > 0) {
            const values: Record<string, "done" | "yes"> = {};
            for (const opt of field.options) {
              values[opt.id] = field.checkboxMode === "explicit" ? "yes" : "done";
            }
            patches.push({ op: "set_checkboxes", fieldId, values });
          }
          break;
      }
    }

    if (patches.length === 0) {
      console.log("No patches generated. Breaking.");
      break;
    }

    // Apply patches
    const applyResult = await tools.markform_apply.execute({ patches });
    console.log(`Apply result: ${applyResult.message}`);

    // Record turn
    turns.push({
      turn: turnNumber,
      inspect: { issues },
      apply: { patches },
      after: {
        requiredIssueCount: applyResult.data.issues.filter(
          (i) => i.severity === "required"
        ).length,
        markdownSha256: "mock-sha256",
      },
    });

    // Update inspect result
    inspectResult = await tools.markform_inspect.execute({});
  }

  // Final result
  console.log("\n=== Final Result ===");
  console.log(`Complete: ${inspectResult.data.isComplete}`);
  console.log(`Turns: ${turnNumber}`);
  console.log(
    `Remaining issues: ${inspectResult.data.issues.filter((i) => i.severity === "required").length}`
  );

  // Show final markdown
  if (config.verbose) {
    const markdownResult = await tools.markform_get_markdown!.execute({});
    console.log("\n=== Final Form ===");
    console.log(markdownResult.data.markdown);
  }

  // Output session if requested
  if (config.outputSessionPath) {
    const session: SessionTranscript = {
      sessionVersion: "0.1.0",
      mode: "mock",
      form: { path: config.formPath },
      harness: { maxTurns: config.maxTurns, maxPatchesPerTurn: 20, maxIssues: 10 },
      turns,
      final: {
        expectComplete: inspectResult.data.isComplete,
      },
    };
    const yaml = serializeSession(session);
    writeFileSync(config.outputSessionPath, yaml);
    console.log(`\nSession written to: ${config.outputSessionPath}`);
  }
}

// =============================================================================
// Live Agent (with AI SDK)
// =============================================================================

async function runLiveAgent(config: Config): Promise<void> {
  // Dynamically import AI SDK
  let generateText: typeof import("ai").generateText;
  let anthropic: typeof import("@ai-sdk/anthropic").anthropic;

  try {
    const ai = await import("ai");
    generateText = ai.generateText;
  } catch {
    console.log("AI SDK (ai package) not installed. Running mock agent.");
    return runMockAgent(config);
  }

  try {
    const anthropicModule = await import("@ai-sdk/anthropic");
    anthropic = anthropicModule.anthropic;
  } catch {
    console.log("Anthropic provider not installed. Running mock agent.");
    return runMockAgent(config);
  }

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("ANTHROPIC_API_KEY not set. Running mock agent.");
    return runMockAgent(config);
  }

  console.log(`Running live agent with model: ${config.model}\n`);

  // Load form
  const formContent = readFileSync(config.formPath, "utf-8");
  const form = parseForm(formContent);

  // Create session store and tools
  const store = new MarkformSessionStore(form);
  const tools = createMarkformTools({ sessionStore: store });

  // Session tracking
  const turns: SessionTurn[] = [];
  let turnNumber = 0;

  console.log("=== Starting Live Agent Loop ===\n");

  // Get initial form state
  let inspectResult = await tools.markform_inspect.execute({});
  console.log(`Initial state: ${inspectResult.message}`);

  // Agent loop
  while (!inspectResult.data.isComplete && turnNumber < config.maxTurns) {
    turnNumber++;
    console.log(`\n--- Turn ${turnNumber} ---`);

    // Prepare prompt with current form state
    const prompt = `You are filling out a form. Here is the current state:

Form State: ${inspectResult.data.formState}
Issues to resolve:
${inspectResult.data.issues.map((i) => `- ${i.ref}: ${i.message} (${i.severity})`).join("\n")}

Use the markform_apply tool to fill in values for the fields that have issues.
Focus on required issues first. Use realistic, sensible values.
If a field asks for specific format (email, date, etc.), use the correct format.`;

    if (config.verbose) {
      console.log("Prompt:", prompt.slice(0, 200) + "...");
    }

    // Call the model
    const model = anthropic(config.model);

    try {
      const result = await generateText({
        model,
        prompt,
        tools: tools as Parameters<typeof generateText>[0]["tools"],
        maxSteps: 5,
      });

      console.log(`Model response: ${result.text || "(tool calls only)"}`);

      // Record patches from tool calls
      const patches: Patch[] = [];
      for (const step of result.steps) {
        for (const toolResult of step.toolResults) {
          if (
            toolResult.toolName === "markform_apply" &&
            "result" in toolResult &&
            typeof toolResult.result === "object" &&
            toolResult.result !== null
          ) {
            // The patches were already applied, just record them
            const applyResult = toolResult.result as { data: { applyStatus: string } };
            if (applyResult.data?.applyStatus === "applied") {
              // Get patches from the tool call args
              const toolCall = step.toolCalls.find(
                (tc) => tc.toolName === "markform_apply"
              );
              if (toolCall && "args" in toolCall) {
                const args = toolCall.args as { patches: Patch[] };
                patches.push(...args.patches);
              }
            }
          }
        }
      }

      // Record turn
      if (patches.length > 0) {
        turns.push({
          turn: turnNumber,
          inspect: { issues: inspectResult.data.issues },
          apply: { patches },
          after: {
            requiredIssueCount: 0, // Will be updated
            markdownSha256: "live-agent",
          },
        });
      }
    } catch (err) {
      console.error("Error calling model:", err);
      break;
    }

    // Update inspect result
    inspectResult = await tools.markform_inspect.execute({});
    console.log(`After turn: ${inspectResult.message}`);

    // Update last turn with new issue count
    if (turns.length > 0 && turns[turns.length - 1]) {
      turns[turns.length - 1].after.requiredIssueCount =
        inspectResult.data.issues.filter((i) => i.severity === "required").length;
    }
  }

  // Final result
  console.log("\n=== Final Result ===");
  console.log(`Complete: ${inspectResult.data.isComplete}`);
  console.log(`Turns: ${turnNumber}`);

  // Show final form
  const markdownResult = await tools.markform_get_markdown!.execute({});
  console.log("\n=== Final Form ===");
  console.log(markdownResult.data.markdown);

  // Output session if requested
  if (config.outputSessionPath) {
    const session: SessionTranscript = {
      sessionVersion: "0.1.0",
      mode: "live",
      form: { path: config.formPath },
      harness: { maxTurns: config.maxTurns, maxPatchesPerTurn: 20, maxIssues: 10 },
      turns,
      final: {
        expectComplete: inspectResult.data.isComplete,
      },
    };
    const yaml = serializeSession(session);
    writeFileSync(config.outputSessionPath, yaml);
    console.log(`\nSession written to: ${config.outputSessionPath}`);
  }

  // Validation
  if (inspectResult.data.isComplete) {
    console.log("\n✓ Form successfully completed by agent!");
  } else {
    console.log(
      `\n✗ Form incomplete. ${inspectResult.data.issues.filter((i) => i.severity === "required").length} required issues remaining.`
    );
    process.exit(1);
  }
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  const config = parseArgs();

  console.log("Markform Live Agent Test");
  console.log("========================");
  console.log(`Form: ${config.formPath}`);
  console.log(`Max turns: ${config.maxTurns}`);
  console.log("");

  await runLiveAgent(config);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
