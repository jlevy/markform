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

import type { Command } from "commander";

import * as p from "@clack/prompts";
import { existsSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import pc from "picocolors";

import { parseForm } from "../../engine/parse.js";
import { inspect } from "../../engine/inspect.js";
import { applyPatches } from "../../engine/apply.js";
import { exportMultiFormat } from "../lib/exportHelpers.js";
import {
  USER_ROLE,
  AGENT_ROLE,
  SUGGESTED_LLMS,
  DEFAULT_MAX_TURNS,
  DEFAULT_MAX_PATCHES_PER_TURN,
  DEFAULT_MAX_ISSUES,
} from "../../settings.js";
import type { ParsedForm, HarnessConfig, Patch } from "../../engine/coreTypes.js";
import { createHarness } from "../../harness/harness.js";
import { createLiveAgent } from "../../harness/liveAgent.js";
import { resolveModel, getProviderInfo, type ProviderName } from "../../harness/modelResolver.js";
import {
  EXAMPLE_DEFINITIONS,
  getExampleById,
  loadExampleContent,
} from "../examples/exampleRegistry.js";
import { formatPath, getCommandContext, logError, logTiming } from "../lib/shared.js";
import { generateVersionedPath } from "../lib/versioning.js";
import {
  runInteractiveFill,
  showInteractiveIntro,
  showInteractiveOutro,
} from "../lib/interactivePrompts.js";

/**
 * Print non-interactive list of examples.
 */
function printExamplesList(): void {
  console.log(pc.bold("Available examples:\n"));
  for (const example of EXAMPLE_DEFINITIONS) {
    console.log(`  ${pc.cyan(example.id)}`);
    console.log(`    ${pc.bold(example.title)}`);
    console.log(`    ${pc.dim(example.description)}`);
    console.log(`    Default filename: ${example.filename}`);
    console.log("");
  }
}

/**
 * Display API availability status at startup.
 */
function showApiStatus(): void {
  console.log(pc.dim("API Status:"));
  for (const [provider, _models] of Object.entries(SUGGESTED_LLMS)) {
    const info = getProviderInfo(provider as ProviderName);
    const hasKey = !!process.env[info.envVar];
    const status = hasKey ? pc.green("✓") : pc.dim("○");
    const envVar = hasKey ? pc.dim(info.envVar) : pc.yellow(info.envVar);
    console.log(`  ${status} ${provider} (${envVar})`);
  }
  console.log("");
}

/**
 * Build model options for the select prompt.
 */
function buildModelOptions(): { value: string; label: string; hint?: string }[] {
  const options: { value: string; label: string; hint?: string }[] = [];

  for (const [provider, models] of Object.entries(SUGGESTED_LLMS)) {
    const info = getProviderInfo(provider as ProviderName);
    const hasKey = !!process.env[info.envVar];
    const keyStatus = hasKey ? pc.green("✓") : pc.dim("○");

    for (const model of models) {
      options.push({
        value: `${provider}/${model}`,
        label: `${provider}/${model}`,
        hint: `${keyStatus} ${info.envVar}`,
      });
    }
  }

  options.push({
    value: "custom",
    label: "Enter custom model ID...",
    hint: "provider/model-id format",
  });

  return options;
}

/**
 * Prompt user to select a model for agent fill.
 */
async function promptForModel(): Promise<string | null> {
  const modelOptions = buildModelOptions();

  const selection = await p.select({
    message: "Select LLM model:",
    options: modelOptions,
  });

  if (p.isCancel(selection)) {
    return null;
  }

  if (selection === "custom") {
    const customModel = await p.text({
      message: "Model ID (provider/model-id):",
      placeholder: "anthropic/claude-sonnet-4-20250514",
      validate: (value) => {
        if (!value.includes("/")) {
          return "Format: provider/model-id (e.g., anthropic/claude-sonnet-4-20250514)";
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
 */
async function runAgentFill(
  form: ParsedForm,
  modelId: string,
  _outputPath: string,
): Promise<{ success: boolean; turnCount: number }> {
  const spinner = p.spinner();

  try {
    // Resolve the model
    spinner.start(`Resolving model: ${modelId}`);
    const { model } = await resolveModel(modelId);
    spinner.stop(`Model resolved: ${modelId}`);

    // Create harness config
    const harnessConfig: Partial<HarnessConfig> = {
      maxTurns: DEFAULT_MAX_TURNS,
      maxPatchesPerTurn: DEFAULT_MAX_PATCHES_PER_TURN,
      maxIssues: DEFAULT_MAX_ISSUES,
      targetRoles: [AGENT_ROLE],
      fillMode: "continue",
    };

    // Create harness and agent
    const harness = createHarness(form, harnessConfig);
    const agent = createLiveAgent({ model, targetRole: AGENT_ROLE });

    // Run harness loop with verbose output
    console.log("");
    p.log.step(pc.bold("Agent fill in progress..."));
    let stepResult = harness.step();

    while (!stepResult.isComplete && !harness.hasReachedMaxTurns()) {
      console.log(
        pc.dim(`  Turn ${stepResult.turnNumber}: ${stepResult.issues.length} issue(s) to address`)
      );

      // Generate patches from agent
      const patches: Patch[] = await agent.generatePatches(
        stepResult.issues,
        harness.getForm(),
        harnessConfig.maxPatchesPerTurn!
      );

      // Log each patch
      for (const patch of patches) {
        const fieldId = patch.fieldId;
        console.log(pc.dim(`    → ${patch.op} ${fieldId}`));
      }

      // Apply patches
      stepResult = harness.apply(patches, stepResult.issues);
      console.log(
        pc.dim(`    ${patches.length} patch(es) applied, ${stepResult.issues.length} remaining`)
      );

      if (!stepResult.isComplete) {
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
    spinner.stop(pc.red("Agent fill failed"));
    throw error;
  }
}

/**
 * Run the interactive example scaffolding and filling flow.
 */
async function runInteractiveFlow(
  preselectedId?: string,
): Promise<void> {
  const startTime = Date.now();

  p.intro(pc.bgCyan(pc.black(" markform examples ")));

  // Show API availability status
  showApiStatus();

  // Step 1: Select example (or use preselected)
  let selectedId = preselectedId;

  if (!selectedId) {
    const selection = await p.select({
      message: "Select an example form to scaffold:",
      options: EXAMPLE_DEFINITIONS.map((example) => ({
        value: example.id,
        label: example.title,
        hint: example.description,
      })),
    });

    if (p.isCancel(selection)) {
      p.cancel("Cancelled.");
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
  const defaultFilename = generateVersionedPath(example.filename);
  const filenameResult = await p.text({
    message: "Output filename:",
    initialValue: defaultFilename,
    validate: (value) => {
      if (!value.trim()) {
        return "Filename is required";
      }
      if (!value.endsWith(".form.md") && !value.endsWith(".md")) {
        return "Filename should end with .form.md or .md";
      }
      return undefined;
    },
  });

  if (p.isCancel(filenameResult)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  const filename = filenameResult;
  const outputPath = join(process.cwd(), filename);

  // Step 3: Check for existing file
  if (existsSync(outputPath)) {
    const overwrite = await p.confirm({
      message: `${filename} already exists. Overwrite?`,
      initialValue: false,
    });

    if (p.isCancel(overwrite) || !overwrite) {
      p.cancel("Cancelled.");
      process.exit(0);
    }
  }

  // Step 4: Load and write the example
  let content: string;
  try {
    content = loadExampleContent(selectedId);
    writeFileSync(outputPath, content, "utf-8");
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
  const fieldIssues = inspectResult.issues.filter((i) => i.scope === "field");
  const uniqueFieldIds = new Set(fieldIssues.map((i) => i.ref));

  if (uniqueFieldIds.size === 0) {
    p.log.info("No user-role fields to fill in this example.");
    // Check if there are agent fields
    const agentInspect = inspect(form, { targetRoles: [AGENT_ROLE] });
    const agentFieldIssues = agentInspect.issues.filter((i) => i.scope === "field");

    if (agentFieldIssues.length === 0) {
      logTiming({ verbose: false, format: "console", dryRun: false, quiet: false }, "Total time", Date.now() - startTime);
      p.outro(pc.dim("Form scaffolded with no fields to fill."));
      return;
    }
    // Skip to agent fill
  } else {
    // Show interactive fill intro
    const formTitle = form.schema.title ?? form.schema.id;
    showInteractiveIntro(formTitle, targetRoles.join(", "), uniqueFieldIds.size);

    // Run interactive prompts
    const { patches, cancelled } = await runInteractiveFill(form, inspectResult.issues);

    if (cancelled) {
      showInteractiveOutro(0, "", true);
      process.exit(1);
    }

    // Apply patches to form
    if (patches.length > 0) {
      applyPatches(form, patches);
    }

    // Export filled form in all formats (examples command always exports all formats)
    const { formPath, rawPath, yamlPath } = exportMultiFormat(form, outputPath);

    showInteractiveOutro(patches.length, outputPath, false);
    console.log("");
    p.log.success("Outputs:");
    console.log(`  ${formatPath(formPath)}  ${pc.dim("(markform)")}`);
    console.log(`  ${formatPath(rawPath)}  ${pc.dim("(plain markdown)")}`);
    console.log(`  ${formatPath(yamlPath)}  ${pc.dim("(values as YAML)")}`);

    logTiming({ verbose: false, format: "console", dryRun: false, quiet: false }, "Fill time", Date.now() - startTime);
  }

  // Step 6: Check for agent-role fields and prompt for agent fill
  const agentInspect = inspect(form, { targetRoles: [AGENT_ROLE] });
  const agentFieldIssues = agentInspect.issues.filter((i) => i.scope === "field");

  if (agentFieldIssues.length > 0) {
    console.log("");
    p.log.info(`This form has ${agentFieldIssues.length} agent-role field(s) remaining.`);

    const runAgent = await p.confirm({
      message: "Run agent fill now?",
      initialValue: true,
    });

    if (p.isCancel(runAgent) || !runAgent) {
      console.log("");
      console.log(pc.dim("You can run agent fill later with:"));
      console.log(pc.dim(`  markform fill ${formatPath(outputPath)} --agent=live --model=<provider/model>`));
      p.outro(pc.dim("Happy form filling!"));
      return;
    }

    // Step 7: Model selection
    const modelId = await promptForModel();
    if (!modelId) {
      p.cancel("Cancelled.");
      process.exit(0);
    }

    // Step 8: Agent output filename
    const agentDefaultFilename = generateVersionedPath(outputPath);
    const agentFilenameResult = await p.text({
      message: "Agent output filename:",
      initialValue: basename(agentDefaultFilename),
      validate: (value) => {
        if (!value.trim()) {
          return "Filename is required";
        }
        return undefined;
      },
    });

    if (p.isCancel(agentFilenameResult)) {
      p.cancel("Cancelled.");
      process.exit(0);
    }

    const agentOutputPath = join(process.cwd(), agentFilenameResult);

    // Step 9: Run agent fill
    const agentStartTime = Date.now();
    try {
      const { success, turnCount: _turnCount } = await runAgentFill(form, modelId, agentOutputPath);

      logTiming({ verbose: false, format: "console", dryRun: false, quiet: false }, "Agent fill time", Date.now() - agentStartTime);

      // Step 10: Multi-format export
      const { formPath, rawPath, yamlPath } = exportMultiFormat(form, agentOutputPath);

      console.log("");
      p.log.success("Agent fill complete. Outputs:");
      console.log(`  ${formatPath(formPath)}  ${pc.dim("(markform)")}`);
      console.log(`  ${formatPath(rawPath)}  ${pc.dim("(plain markdown)")}`);
      console.log(`  ${formatPath(yamlPath)}  ${pc.dim("(values as YAML)")}`);

      if (!success) {
        p.log.warn("Agent did not complete all fields. You may need to run it again.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      p.log.error(`Agent fill failed: ${message}`);
      console.log("");
      console.log(pc.dim("You can try again with:"));
      console.log(pc.dim(`  markform fill ${formatPath(outputPath)} --agent=live --model=${modelId}`));
    }
  }

  p.outro(pc.dim("Happy form filling!"));
}

/**
 * Register the examples command.
 */
export function registerExamplesCommand(program: Command): void {
  program
    .command("examples")
    .description("Scaffold an example form and fill it interactively")
    .option("--list", "List available examples without interactive selection")
    .option(
      "--name <example>",
      "Select example by ID (still prompts for filename)"
    )
    .action(
      async (
        options: { list?: boolean; name?: string },
        cmd: Command
      ) => {
        const _ctx = getCommandContext(cmd);

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
              console.log("\nAvailable examples:");
              for (const ex of EXAMPLE_DEFINITIONS) {
                console.log(`  ${ex.id}`);
              }
              process.exit(1);
            }
          }

          // Run interactive flow
          await runInteractiveFlow(options.name);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          logError(message);
          process.exit(1);
        }
      }
    );
}
