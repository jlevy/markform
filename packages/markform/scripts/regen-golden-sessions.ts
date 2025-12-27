#!/usr/bin/env npx tsx
/* eslint-disable @typescript-eslint/consistent-type-imports */
/**
 * Regenerate golden test session files.
 *
 * Re-runs mock fill to update SHA256 hashes after format changes.
 *
 * Usage: pnpm --filter markform test:golden:regen
 */

import { readFileSync } from 'node:fs';
import { writeFile } from 'atomically';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { HarnessConfig, SessionTranscript } from '../src/engine/coreTypes.js';
import { parseForm } from '../src/engine/parse.js';
import { serializeSession } from '../src/engine/session.js';
import { FormHarness } from '../src/harness/harness.js';
import { createMockAgent } from '../src/harness/mockAgent.js';

// =============================================================================
// Configuration
// =============================================================================

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '..', 'examples');

/** Golden session configuration */
interface SessionConfig {
  form: string;
  mockSource: string;
  sessionFile: string;
}

/** Sessions to regenerate (paths relative to examples/) */
const SESSIONS: SessionConfig[] = [
  {
    form: 'simple/simple.form.md',
    mockSource: 'simple/simple-mock-filled.form.md',
    sessionFile: 'simple/simple.session.yaml',
  },
  {
    form: 'simple/simple.form.md',
    mockSource: 'simple/simple-skipped-filled.form.md',
    sessionFile: 'simple/simple-with-skips.session.yaml',
  },
];

// =============================================================================
// Session Generation
// =============================================================================

/** Run mock fill and return session transcript */
async function runMockFill(
  formContent: string,
  mockContent: string,
  config: HarnessConfig,
): Promise<SessionTranscript['turns']> {
  const form = parseForm(formContent);
  const mockForm = parseForm(mockContent);
  const agent = createMockAgent(mockForm);
  const harness = new FormHarness(form, config);

  while (harness.getState() !== 'complete') {
    const step = harness.step();
    if (step.isComplete || step.issues.length === 0) break;

    const response = await agent.generatePatches(
      step.issues,
      harness.getForm(),
      config.maxPatchesPerTurn,
    );
    harness.apply(response.patches, step.issues);
  }

  return harness.getTurns();
}

/** Regenerate a single golden session */
async function regenSession(config: SessionConfig): Promise<void> {
  console.log(`\nRegenerating: ${config.sessionFile}`);

  const formContent = readFileSync(resolve(EXAMPLES_DIR, config.form), 'utf-8');
  const mockContent = readFileSync(resolve(EXAMPLES_DIR, config.mockSource), 'utf-8');

  const harnessConfig: HarnessConfig = {
    maxTurns: 100,
    maxPatchesPerTurn: 20,
    maxIssues: 10,
    targetRoles: ['*'],
    fillMode: 'continue',
  };

  const turns = await runMockFill(formContent, mockContent, harnessConfig);

  const transcript: SessionTranscript = {
    sessionVersion: '0.1.0',
    mode: 'mock',
    form: { path: basename(config.form) },
    mock: { completedMock: basename(config.mockSource) },
    harness: harnessConfig,
    turns,
    final: {
      expectComplete: true,
      expectedCompletedForm: basename(config.mockSource),
    },
  };

  const outputPath = resolve(EXAMPLES_DIR, config.sessionFile);
  await writeFile(outputPath, serializeSession(transcript));
  console.log(`  ✓ Written: ${outputPath}`);
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  console.log('Regenerating golden test sessions...');

  for (const config of SESSIONS) {
    await regenSession(config);
  }

  console.log('\n✓ All sessions regenerated');
  console.log("\nRun 'pnpm test:golden' to verify.");
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
