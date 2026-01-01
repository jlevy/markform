#!/usr/bin/env npx tsx
/* eslint-disable @typescript-eslint/consistent-type-imports */
/**
 * Regenerate golden test files (sessions and schemas).
 *
 * Re-runs mock fill to update SHA256 hashes after format changes.
 * Also regenerates JSON Schema snapshots for schema golden tests.
 *
 * Usage: pnpm --filter markform test:golden:regen
 */

import { readFileSync } from 'node:fs';
import { writeFile } from 'atomically';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

import type { HarnessConfig, SessionTranscript } from '../src/engine/coreTypes.js';
import { parseForm } from '../src/engine/parse.js';
import { formToJsonSchema } from '../src/engine/jsonSchema.js';
import { serializeSession } from '../src/engine/session.js';
import { serializeReportMarkdown } from '../src/engine/serialize.js';
import { toStructuredValues, toNotesArray } from '../src/cli/lib/exportHelpers.js';
import { FormHarness } from '../src/harness/harness.js';
import { createMockAgent } from '../src/harness/mockAgent.js';
import { createRejectionMockAgent } from '../src/harness/rejectionMockAgent.js';
import type { Agent } from '../src/harness/harnessTypes.js';

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
  /** Use rejection mock agent (intentionally makes type mismatch errors) */
  useRejectionMock?: boolean;
}

/** Export files configuration - derived from the filled form */
interface ExportConfig {
  form: string; // Path to the completed/filled form file
  reportFile: string; // .report.md output
  yamlFile: string; // .yml output
  schemaFile: string; // .schema.json output
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
  {
    form: 'rejection-test/rejection-test.form.md',
    mockSource: 'rejection-test/rejection-test-mock-filled.form.md',
    sessionFile: 'rejection-test/rejection-test.session.yaml',
    useRejectionMock: true,
  },
];

/** Schema configuration for forms that have schema snapshots */
interface SchemaConfig {
  form: string; // Path to form file relative to examples/
  schemaFile: string; // Path to schema snapshot file relative to examples/
}

/**
 * Forms with JSON Schema snapshots to regenerate.
 * Add new forms here when creating schema golden tests.
 */
const SCHEMAS: SchemaConfig[] = [
  {
    form: 'simple/simple.form.md',
    schemaFile: 'simple/simple.schema.json',
  },
];

/**
 * Export files to regenerate for filled forms.
 * These are the multi-format exports (report, yaml, schema) of completed forms.
 */
const EXPORTS: ExportConfig[] = [
  {
    form: 'simple/simple-mock-filled.form.md',
    reportFile: 'simple/simple-mock-filled.report.md',
    yamlFile: 'simple/simple-mock-filled.yml',
    schemaFile: 'simple/simple-mock-filled.schema.json',
  },
  {
    form: 'simple/simple-skipped-filled.form.md',
    reportFile: 'simple/simple-skipped-filled.report.md',
    yamlFile: 'simple/simple-skipped-filled.yml',
    schemaFile: 'simple/simple-skipped-filled.schema.json',
  },
  {
    form: 'rejection-test/rejection-test-mock-filled.form.md',
    reportFile: 'rejection-test/rejection-test-mock-filled.report.md',
    yamlFile: 'rejection-test/rejection-test-mock-filled.yml',
    schemaFile: 'rejection-test/rejection-test-mock-filled.schema.json',
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
  useRejectionMock = false,
): Promise<SessionTranscript['turns']> {
  const form = parseForm(formContent);
  const mockForm = parseForm(mockContent);
  const agent: Agent = useRejectionMock
    ? createRejectionMockAgent(mockForm)
    : createMockAgent(mockForm);
  const harness = new FormHarness(form, config);

  // Track rejections between turns (like programmaticFill does)
  let previousRejections:
    | Array<{
        patchIndex: number;
        message: string;
        fieldId?: string;
        fieldKind?: string;
        columnIds?: string[];
      }>
    | undefined;

  while (harness.getState() !== 'complete') {
    const step = harness.step();
    if (step.isComplete || step.issues.length === 0) break;

    const response = await agent.fillFormTool(
      step.issues,
      harness.getForm(),
      config.maxPatchesPerTurn,
      previousRejections,
    );

    const applyResult = harness.apply(response.patches, step.issues);

    // Track rejections for next turn
    previousRejections = applyResult.rejectedPatches;
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
    maxIssuesPerTurn: 10,
    targetRoles: ['*'],
    fillMode: 'continue',
  };

  const turns = await runMockFill(formContent, mockContent, harnessConfig, config.useRejectionMock);

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
// Schema Regeneration
// =============================================================================

/** Regenerate a JSON Schema snapshot for a form */
async function regenSchema(config: SchemaConfig): Promise<void> {
  console.log(`\nRegenerating schema: ${config.schemaFile}`);

  const formContent = readFileSync(resolve(EXAMPLES_DIR, config.form), 'utf-8');
  const form = parseForm(formContent);
  const result = formToJsonSchema(form);

  const outputPath = resolve(EXAMPLES_DIR, config.schemaFile);
  await writeFile(outputPath, JSON.stringify(result.schema, null, 2) + '\n');
  console.log(`  ✓ Written: ${outputPath}`);
}

// =============================================================================
// Export Regeneration
// =============================================================================

/** Regenerate export files (report, yaml, schema) for a filled form */
async function regenExports(config: ExportConfig): Promise<void> {
  console.log(`\nRegenerating exports for: ${config.form}`);

  const formContent = readFileSync(resolve(EXAMPLES_DIR, config.form), 'utf-8');
  const form = parseForm(formContent);

  // Generate report markdown
  const reportContent = serializeReportMarkdown(form);
  const reportPath = resolve(EXAMPLES_DIR, config.reportFile);
  await writeFile(reportPath, reportContent);
  console.log(`  ✓ Written: ${reportPath}`);

  // Generate YAML values
  const values = toStructuredValues(form);
  const notes = toNotesArray(form);
  const exportData = {
    values,
    ...(notes.length > 0 && { notes }),
  };
  const yamlContent = YAML.stringify(exportData);
  const yamlPath = resolve(EXAMPLES_DIR, config.yamlFile);
  await writeFile(yamlPath, yamlContent);
  console.log(`  ✓ Written: ${yamlPath}`);

  // Generate JSON Schema
  const result = formToJsonSchema(form);
  const schemaPath = resolve(EXAMPLES_DIR, config.schemaFile);
  await writeFile(schemaPath, JSON.stringify(result.schema, null, 2) + '\n');
  console.log(`  ✓ Written: ${schemaPath}`);
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  console.log('Regenerating golden test files...');

  // Regenerate session transcripts
  console.log('\n--- Session Transcripts ---');
  for (const config of SESSIONS) {
    await regenSession(config);
  }

  // Regenerate JSON Schema snapshots for empty forms
  console.log('\n--- JSON Schema Snapshots (empty forms) ---');
  for (const config of SCHEMAS) {
    await regenSchema(config);
  }

  // Regenerate export files for filled forms
  console.log('\n--- Export Files (filled forms) ---');
  for (const config of EXPORTS) {
    await regenExports(config);
  }

  console.log('\n✓ All golden test files regenerated');
  console.log("\nRun 'pnpm test:golden' to verify.");
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
