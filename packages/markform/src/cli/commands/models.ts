/**
 * Models command - List available AI models and providers.
 *
 * Displays supported providers, their environment variables,
 * and example models for use with the fill command.
 */

import type { Command } from "commander";

import pc from "picocolors";

import {
  getProviderInfo,
  getProviderNames,
  type ProviderName,
} from "../../harness/modelResolver.js";
import { SUGGESTED_LLMS } from "../../settings.js";
import { formatOutput, getCommandContext, logError } from "../lib/shared.js";

/**
 * Model info for a single provider.
 */
interface ProviderModelInfo {
  provider: ProviderName;
  envVar: string;
  models: string[];
}

/**
 * Get model info for all providers or a specific one.
 */
function getModelInfo(providerFilter?: string): ProviderModelInfo[] {
  const providers = getProviderNames();

  // Validate filter if provided
  if (providerFilter && !providers.includes(providerFilter as ProviderName)) {
    throw new Error(
      `Unknown provider: "${providerFilter}". Available: ${providers.join(", ")}`
    );
  }

  const filtered = providerFilter
    ? [providerFilter as ProviderName]
    : providers;

  return filtered.map((provider) => {
    const info = getProviderInfo(provider);
    return {
      provider,
      envVar: info.envVar,
      models: SUGGESTED_LLMS[provider] ?? [],
    };
  });
}

/**
 * Format model info for console output.
 */
function formatConsoleOutput(
  info: ProviderModelInfo[],
  useColors: boolean
): string {
  const lines: string[] = [];
  const bold = useColors ? pc.bold : (s: string) => s;
  const cyan = useColors ? pc.cyan : (s: string) => s;
  const dim = useColors ? pc.dim : (s: string) => s;
  const green = useColors ? pc.green : (s: string) => s;

  for (const { provider, envVar, models } of info) {
    lines.push(bold(cyan(`${provider}/`)));
    lines.push(`  ${dim("env:")} ${envVar}`);

    if (models.length > 0) {
      lines.push(`  ${dim("models:")}`);
      for (const model of models) {
        lines.push(`    ${green(`${provider}/${model}`)}`);
      }
    } else {
      lines.push(`  ${dim("(no suggested models)")}`);
    }
    lines.push("");
  }

  // Remove trailing empty line
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines.join("\n");
}

/**
 * Register the models command.
 */
export function registerModelsCommand(program: Command): void {
  program
    .command("models")
    .description("List available AI providers and example models")
    .option(
      "-p, --provider <name>",
      "Filter by provider (anthropic, openai, google, xai, deepseek)"
    )
    .action((options: { provider?: string }, cmd: Command) => {
      const ctx = getCommandContext(cmd);

      try {
        const info = getModelInfo(options.provider);

        const output = formatOutput(ctx, info, (data, useColors) =>
          formatConsoleOutput(data as ProviderModelInfo[], useColors)
        );
        console.log(output);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError(message);
        process.exit(1);
      }
    });
}
