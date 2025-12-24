/**
 * Examples command - Scaffold example forms into the current directory.
 *
 * Provides an interactive menu for discovering and scaffolding example forms.
 * Supports:
 * - Interactive selection with descriptions
 * - Editable filename with default
 * - Overwrite confirmation
 * - Suggested next commands
 */

import type { Command } from "commander";

import * as p from "@clack/prompts";
import { existsSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import pc from "picocolors";

import {
  EXAMPLE_DEFINITIONS,
  getExampleById,
  loadExampleContent,
} from "../examples/index.js";
import { getCommandContext, logError } from "../lib/shared.js";

/**
 * Format suggested commands for a scaffolded example.
 */
function formatSuggestedCommands(
  exampleId: string,
  filename: string,
): string[] {
  const lines: string[] = [];
  const filenameBase = basename(filename, ".form.md");
  const filledName = `${filenameBase}-filled.form.md`;
  const doneName = `${filenameBase}-done.form.md`;

  lines.push("");
  lines.push("This form has fields for both you (user) and the AI agent.");
  lines.push("");
  lines.push(pc.bold("Next steps:"));
  lines.push(
    `  ${pc.dim("# 1. Fill in your fields (interactive mode for user-role fields)")}`
  );
  lines.push(
    `  markform fill ${filename} --interactive -o ${filledName}`
  );
  lines.push("");
  lines.push(
    `  ${pc.dim("# 2. Let the agent complete the remaining fields")}`
  );
  lines.push(`  markform fill ${filledName} -o ${doneName}`);
  lines.push("");
  lines.push(`  ${pc.dim("# 3. Review the final output")}`);
  lines.push(`  markform dump ${doneName}`);
  lines.push("");
  lines.push(pc.dim("Other useful commands:"));
  lines.push(`  markform inspect ${filename}`);

  return lines;
}

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
 * Run the interactive example scaffolding flow.
 */
async function runInteractiveFlow(
  preselectedId?: string,
): Promise<void> {
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

  // Step 2: Prompt for filename
  const filenameResult = await p.text({
    message: "Filename:",
    placeholder: example.filename,
    defaultValue: example.filename,
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
  try {
    const content = loadExampleContent(selectedId);
    writeFileSync(outputPath, content, "utf-8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    p.cancel(`Failed to write file: ${message}`);
    process.exit(1);
  }

  p.log.success(`Created ${pc.green(filename)}`);

  // Step 5: Show suggested commands
  const suggestions = formatSuggestedCommands(selectedId, filename);
  for (const line of suggestions) {
    console.log(line);
  }

  p.outro(pc.dim("Happy form filling!"));
}

/**
 * Register the examples command.
 */
export function registerExamplesCommand(program: Command): void {
  program
    .command("examples")
    .description("Scaffold an example form into the current directory")
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
