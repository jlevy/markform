/**
 * Golden Session Test Helpers
 *
 * Provides utilities for regenerating sessions and normalizing YAML
 * for deterministic comparison.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import type {
  FillMode,
  HarnessConfig,
  PatchRejection,
  SessionTranscript,
} from '../../src/engine/coreTypes.js';
import { parseForm } from '../../src/engine/parse.js';
import { serializeSession } from '../../src/engine/session.js';
import { FormHarness } from '../../src/harness/harness.js';
import { createMockAgent } from '../../src/harness/mockAgent.js';
import { createRejectionMockAgent } from '../../src/harness/rejectionMockAgent.js';
import { buildMockWireFormat } from '../../src/harness/liveAgent.js';
import type { Agent } from '../../src/harness/harnessTypes.js';
import { AGENT_ROLE } from '../../src/settings.js';

// =============================================================================
// Normalization
// =============================================================================

/**
 * Normalize a session YAML string for deterministic comparison.
 *
 * Normalizes:
 * - Token counts (truly unstable, varies with model)
 * - YAML quoting style (Prettier uses single quotes, serializer uses double)
 *
 * All other content must match exactly.
 */
export function normalizeSession(yaml: string): string {
  return (
    yaml
      // Normalize token counts (unstable)
      .replace(/input_tokens: \d+/g, 'input_tokens: 0')
      .replace(/output_tokens: \d+/g, 'output_tokens: 0')
      // Normalize YAML quoting style (Prettier formats with single quotes)
      // Target roles: "*" -> '*'
      .replace(/- "\*"/g, "- '*'")
      // JSON Schema $ref: "#/$defs/patch" -> '#/$defs/patch'
      .replace(/\$ref: "#\/\$defs\/patch"/g, "$ref: '#/$defs/patch'")
  );
}

// =============================================================================
// Session Regeneration
// =============================================================================

/** Session configuration (inferred from session file) */
interface SessionMeta {
  formPath: string;
  mockPath: string;
  useRejectionMock: boolean;
  harness: HarnessConfig;
}

/**
 * Parse session metadata from a session file to determine regeneration params.
 */
function parseSessionMeta(sessionPath: string): SessionMeta {
  const sessionContent = readFileSync(sessionPath, 'utf-8');
  const sessionDir = dirname(sessionPath);

  // Parse YAML to extract form and mock paths
  // Use simple regex to avoid YAML parsing dependency in tests
  const formMatch = /form:\s*\n\s*path:\s*(.+)/.exec(sessionContent);
  const mockMatch = /mock:\s*\n\s*completed_mock:\s*(.+)/.exec(sessionContent);
  const maxTurnsMatch = /max_turns:\s*(\d+)/.exec(sessionContent);
  const maxPatchesMatch = /max_patches_per_turn:\s*(\d+)/.exec(sessionContent);
  const maxIssuesMatch = /max_issues_per_turn:\s*(\d+)/.exec(sessionContent);
  const fillModeMatch = /fill_mode:\s*(\w+)/.exec(sessionContent);

  if (!formMatch?.[1] || !mockMatch?.[1]) {
    throw new Error(`Cannot parse session metadata from ${sessionPath}`);
  }

  const formPath = resolve(sessionDir, formMatch[1].trim());
  const mockPath = resolve(sessionDir, mockMatch[1].trim());

  // Detect rejection mock from path naming convention
  const useRejectionMock = sessionPath.includes('rejection-test');

  // Parse fill mode with proper type
  const fillModeValue = fillModeMatch?.[1];
  const fillMode: FillMode | undefined =
    fillModeValue === 'continue' || fillModeValue === 'overwrite' ? fillModeValue : undefined;

  const harness: HarnessConfig = {
    maxTurns: maxTurnsMatch?.[1] ? parseInt(maxTurnsMatch[1], 10) : 100,
    maxPatchesPerTurn: maxPatchesMatch?.[1] ? parseInt(maxPatchesMatch[1], 10) : 20,
    maxIssuesPerTurn: maxIssuesMatch?.[1] ? parseInt(maxIssuesMatch[1], 10) : 10,
    targetRoles: ['*'],
    fillMode: fillMode ?? 'continue',
  };

  return { formPath, mockPath, useRejectionMock, harness };
}

/**
 * Run mock fill and return session turns.
 */
async function runMockFill(
  formContent: string,
  mockContent: string,
  config: HarnessConfig,
  useRejectionMock = false,
): Promise<SessionTranscript['turns']> {
  const form = parseForm(formContent);
  const mockForm = parseForm(mockContent);
  const agent: Agent = useRejectionMock
    ? createRejectionMockAgent(mockForm)
    : createMockAgent(mockForm);
  const harness = new FormHarness(form, config);

  // Track rejections between turns
  let previousRejections: PatchRejection[] | undefined;

  while (harness.getState() !== 'complete') {
    const step = harness.step();
    if (step.isComplete || step.issues.length === 0) break;

    const response = await agent.fillFormTool(
      step.issues,
      harness.getForm(),
      config.maxPatchesPerTurn,
      previousRejections,
    );

    // Build wire format for session logging
    const wire = buildMockWireFormat(
      harness.getForm(),
      step.issues,
      response.patches,
      config.maxPatchesPerTurn,
      AGENT_ROLE,
      previousRejections,
    );

    // Extract context from wire for session logging
    const context = {
      systemPrompt: wire.request.system,
      contextPrompt: wire.request.prompt,
    };

    // Apply patches with wire format
    const applyResult = harness.apply(response.patches, step.issues, undefined, context, wire);

    // Track rejections for next turn
    previousRejections = applyResult.rejectedPatches;
  }

  return harness.getTurns();
}

/**
 * Regenerate a session from its form and mock files.
 *
 * Returns the session as a YAML string for comparison.
 */
export async function regenerateSession(sessionPath: string): Promise<string> {
  const meta = parseSessionMeta(sessionPath);

  const formContent = readFileSync(meta.formPath, 'utf-8');
  const mockContent = readFileSync(meta.mockPath, 'utf-8');

  const turns = await runMockFill(formContent, mockContent, meta.harness, meta.useRejectionMock);

  const transcript: SessionTranscript = {
    sessionVersion: '0.1.0',
    mode: 'mock',
    form: { path: basename(meta.formPath) },
    mock: { completedMock: basename(meta.mockPath) },
    harness: meta.harness,
    turns,
    final: {
      expectComplete: true,
      expectedCompletedForm: basename(meta.mockPath),
    },
  };

  return serializeSession(transcript);
}

/**
 * Find all session files in a directory.
 */
export function findSessionFiles(dir: string): string[] {
  const results: string[] = [];

  function walk(currentDir: string): void {
    const entries = readdirSync(currentDir);
    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (entry.endsWith('.session.yaml')) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}
