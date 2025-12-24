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
import { join } from "node:path";
import pc from "picocolors";

import { parseForm } from "../../engine/parse.js";
import { serialize } from "../../engine/serialize.js";
import { inspect } from "../../engine/inspect.js";
import { applyPatches } from "../../engine/apply.js";
import { USER_ROLE } from "../../settings.js";
import {
  EXAMPLE_DEFINITIONS,
  getExampleById,
  loadExampleContent,
} from "../examples/index.js";
import { getCommandContext, logError, logTiming } from "../lib/shared.js";
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
 * Run the interactive example scaffolding and filling flow.
 */
async function runInteractiveFlow(
  preselectedId?: string,
): Promise<void> {
  const startTime = Date.now();

  p.intro(pc.bgCyan(pc.black(" markform examples ")));

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

  p.log.success(`Created ${pc.green(filename)}`);

  // Step 5: Parse the form and run interactive fill
  const form = parseForm(content);
  const targetRoles = [USER_ROLE];

  // Inspect form to get issues for user role
  const inspectResult = inspect(form, { targetRoles });
  const fieldIssues = inspectResult.issues.filter((i) => i.scope === "field");
  const uniqueFieldIds = new Set(fieldIssues.map((i) => i.ref));

  if (uniqueFieldIds.size === 0) {
    p.log.info("No user-role fields to fill in this example.");
    logTiming({ verbose: false, format: "console", dryRun: false, quiet: false }, "Total time", Date.now() - startTime);
    p.outro(pc.dim("Form scaffolded. Use 'markform fill' to complete agent fields."));
    return;
  }

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

  // Save the filled form
  const formMarkdown = serialize(form);
  writeFileSync(outputPath, formMarkdown, "utf-8");

  showInteractiveOutro(patches.length, outputPath, false);
  logTiming({ verbose: false, format: "console", dryRun: false, quiet: false }, "Fill time", Date.now() - startTime);

  // Show next step hint for agent fill
  if (patches.length > 0) {
    // Check if there are any agent-role fields remaining
    const agentInspect = inspect(form, { targetRoles: ["agent"] });
    const agentFieldIssues = agentInspect.issues.filter((i) => i.scope === "field");

    if (agentFieldIssues.length > 0) {
      console.log("");
      console.log(pc.dim("Next step: fill remaining fields with agent"));
      console.log(pc.dim(`  markform fill ${outputPath} --agent=live --model=<provider/model>`));
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
