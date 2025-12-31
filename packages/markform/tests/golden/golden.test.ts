/**
 * Golden Session Tests
 *
 * These tests replay recorded session transcripts and verify:
 * - Issues match at each turn
 * - Form state (SHA256 hash) matches after each turn
 * - Final form matches the expected completed form
 * - Export files (report, yaml, schema) match expected output
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

import { parseForm } from '../../src/engine/parse.js';
import { serializeReportMarkdown } from '../../src/engine/serialize.js';
import { formToJsonSchema } from '../../src/engine/jsonSchema.js';
import { toStructuredValues, toNotesArray } from '../../src/cli/lib/exportHelpers.js';
import { findSessionFiles, runGoldenTest } from './runner.js';

// =============================================================================
// Configuration
// =============================================================================

const EXAMPLES_DIR = join(__dirname, '../../examples');

// =============================================================================
// Golden Session Tests
// =============================================================================

describe('Golden Session Tests', () => {
  // Find all session files
  const sessionFiles = findSessionFiles(EXAMPLES_DIR);

  if (sessionFiles.length === 0) {
    it.skip('no session files found', () => {
      // Skip if no session files exist yet
    });
  } else {
    // Create a test for each session file
    for (const sessionPath of sessionFiles) {
      const relativePath = sessionPath.replace(EXAMPLES_DIR + '/', '');

      it(`replays ${relativePath}`, () => {
        const result = runGoldenTest(sessionPath);

        // Log details on failure
        if (!result.success) {
          console.log('Golden test failed:', relativePath);
          console.log('Errors:', result.errors);
          console.log('Final result:', result.finalResult);
          for (const turn of result.turns) {
            console.log(`Turn ${turn.turn}:`, {
              issuesMatch: turn.issuesMatch,
              hashMatch: turn.hashMatch,
              expectedHash: turn.expectedHash.slice(0, 16) + '...',
              actualHash: turn.actualHash.slice(0, 16) + '...',
              issuesDiff: turn.issuesDiff,
            });
          }
        }

        expect(result.success).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.finalResult.formMatches).toBe(true);
      });
    }
  }
});

// =============================================================================
// Individual Form Tests
// =============================================================================

describe('Simple Form Golden Test', () => {
  const sessionPath = join(EXAMPLES_DIR, 'simple/simple.session.yaml');

  it('replays simple form session', () => {
    // Check if session file exists
    if (!existsSync(sessionPath)) {
      // Skip if session file doesn't exist yet
      console.log('Skipping: simple.session.yaml not found');
      return;
    }

    const result = runGoldenTest(sessionPath);

    expect(result.success).toBe(true);
    // Check that completion matches expectations from session
    // Note: This session leaves optional_number empty, so isComplete is false
    expect(result.finalResult.formMatches).toBe(true);
  });
});

// =============================================================================
// Export Files Golden Tests
// =============================================================================

/** Export configuration for a filled form */
interface ExportConfig {
  formPath: string; // Path to the filled form file
  reportPath: string; // Expected report file
  yamlPath: string; // Expected yaml file
  schemaPath: string; // Expected schema file
}

/** Export configurations to test */
const EXPORT_CONFIGS: ExportConfig[] = [
  {
    formPath: 'simple/simple-mock-filled.form.md',
    reportPath: 'simple/simple-mock-filled.report.md',
    yamlPath: 'simple/simple-mock-filled.yml',
    schemaPath: 'simple/simple-mock-filled.schema.json',
  },
  {
    formPath: 'simple/simple-skipped-filled.form.md',
    reportPath: 'simple/simple-skipped-filled.report.md',
    yamlPath: 'simple/simple-skipped-filled.yml',
    schemaPath: 'simple/simple-skipped-filled.schema.json',
  },
  {
    formPath: 'rejection-test/rejection-test-mock-filled.form.md',
    reportPath: 'rejection-test/rejection-test-mock-filled.report.md',
    yamlPath: 'rejection-test/rejection-test-mock-filled.yml',
    schemaPath: 'rejection-test/rejection-test-mock-filled.schema.json',
  },
];

describe('Export Files Golden Tests', () => {
  for (const config of EXPORT_CONFIGS) {
    describe(config.formPath, () => {
      it('generates matching report markdown', () => {
        const formFullPath = join(EXAMPLES_DIR, config.formPath);
        const reportFullPath = join(EXAMPLES_DIR, config.reportPath);

        if (!existsSync(formFullPath) || !existsSync(reportFullPath)) {
          console.log(`Skipping: ${config.reportPath} (files not found)`);
          return;
        }

        const formContent = readFileSync(formFullPath, 'utf-8');
        const form = parseForm(formContent);
        const actualReport = serializeReportMarkdown(form);

        const expectedReport = readFileSync(reportFullPath, 'utf-8');

        expect(actualReport).toBe(expectedReport);
      });

      it('generates matching yaml values', () => {
        const formFullPath = join(EXAMPLES_DIR, config.formPath);
        const yamlFullPath = join(EXAMPLES_DIR, config.yamlPath);

        if (!existsSync(formFullPath) || !existsSync(yamlFullPath)) {
          console.log(`Skipping: ${config.yamlPath} (files not found)`);
          return;
        }

        const formContent = readFileSync(formFullPath, 'utf-8');
        const form = parseForm(formContent);

        const values = toStructuredValues(form);
        const notes = toNotesArray(form);
        const exportData = {
          values,
          ...(notes.length > 0 && { notes }),
        };
        const actualYaml = YAML.stringify(exportData);

        const expectedYaml = readFileSync(yamlFullPath, 'utf-8');

        expect(actualYaml).toBe(expectedYaml);
      });

      it('generates matching json schema', () => {
        const formFullPath = join(EXAMPLES_DIR, config.formPath);
        const schemaFullPath = join(EXAMPLES_DIR, config.schemaPath);

        if (!existsSync(formFullPath) || !existsSync(schemaFullPath)) {
          console.log(`Skipping: ${config.schemaPath} (files not found)`);
          return;
        }

        const formContent = readFileSync(formFullPath, 'utf-8');
        const form = parseForm(formContent);
        const result = formToJsonSchema(form);

        const expectedSchemaStr = readFileSync(schemaFullPath, 'utf-8');
        const expectedSchema = JSON.parse(expectedSchemaStr) as unknown;

        // Compare parsed objects to avoid JSON formatting differences
        expect(result.schema).toEqual(expectedSchema);
      });
    });
  }
});
