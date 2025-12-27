/**
 * Golden Session Test Runner
 *
 * Replays session transcripts and verifies:
 * - Issues match expected at each turn
 * - SHA256 hashes match after each turn
 * - Final form matches completed mock
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Use pure JS sha256 to match harness.ts (avoids node:crypto for portability).
import { sha256 } from 'js-sha256';

import { applyPatches } from '../../src/engine/apply.js';
import { inspect } from '../../src/engine/inspect.js';
import { parseForm } from '../../src/engine/parse.js';
import { serialize } from '../../src/engine/serialize.js';
import { parseSession } from '../../src/engine/session.js';
import type {
  InspectIssue,
  ParsedForm,
  SessionTranscript,
  SessionTurn,
} from '../../src/engine/coreTypes.js';

// =============================================================================
// Types
// =============================================================================

export interface GoldenTestResult {
  success: boolean;
  sessionPath: string;
  turns: TurnResult[];
  finalResult: FinalResult;
  errors: string[];
}

export interface TurnResult {
  turn: number;
  issuesMatch: boolean;
  hashMatch: boolean;
  countsMatch: boolean;
  expectedHash: string;
  actualHash: string;
  expectedAnswered: number;
  actualAnswered: number;
  expectedSkipped: number;
  actualSkipped: number;
  issuesDiff?: IssueDiff[];
}

export interface IssueDiff {
  type: 'missing' | 'extra';
  issue: InspectIssue;
}

export interface FinalResult {
  expectComplete: boolean;
  isComplete: boolean;
  formMatches: boolean;
}

// =============================================================================
// Golden Test Runner
// =============================================================================

/**
 * Run a golden session test.
 *
 * @param sessionPath - Path to the session YAML file
 * @returns Test result with details about each turn
 */
export function runGoldenTest(sessionPath: string): GoldenTestResult {
  const errors: string[] = [];
  const turnResults: TurnResult[] = [];

  // Load and parse session
  let session: SessionTranscript;
  try {
    const sessionYaml = readFileSync(sessionPath, 'utf-8');
    session = parseSession(sessionYaml);
  } catch (err) {
    return {
      success: false,
      sessionPath,
      turns: [],
      finalResult: {
        expectComplete: false,
        isComplete: false,
        formMatches: false,
      },
      errors: [`Failed to parse session: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  // Get base directory for relative paths
  const baseDir = dirname(sessionPath);

  // Load template form
  let form: ParsedForm;
  try {
    const formPath = join(baseDir, session.form.path);
    const formContent = readFileSync(formPath, 'utf-8');
    form = parseForm(formContent);
  } catch (err) {
    return {
      success: false,
      sessionPath,
      turns: [],
      finalResult: {
        expectComplete: session.final.expectComplete,
        isComplete: false,
        formMatches: false,
      },
      errors: [`Failed to load form: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  // Replay each turn
  for (const turn of session.turns) {
    const turnResult = replayTurn(form, turn);
    turnResults.push(turnResult);

    if (!turnResult.issuesMatch) {
      errors.push(`Turn ${turn.turn}: Issues do not match expected`);
    }
    if (!turnResult.hashMatch) {
      errors.push(
        `Turn ${turn.turn}: Hash mismatch (expected ${turnResult.expectedHash}, got ${turnResult.actualHash})`,
      );
    }
    if (!turnResult.countsMatch) {
      errors.push(
        `Turn ${turn.turn}: Counts mismatch (answered: expected ${turnResult.expectedAnswered}, got ${turnResult.actualAnswered}; skipped: expected ${turnResult.expectedSkipped}, got ${turnResult.actualSkipped})`,
      );
    }
    // Note: patches are applied within replayTurn, so form is already updated
  }

  // Verify final state
  const finalInspect = inspect(form);
  const isComplete = finalInspect.isComplete;

  // Load expected completed form and compare
  let formMatches = false;
  if (session.final.expectedCompletedForm) {
    try {
      const expectedPath = join(baseDir, session.final.expectedCompletedForm);
      const expectedContent = readFileSync(expectedPath, 'utf-8');
      const expectedForm = parseForm(expectedContent);

      // Compare values
      formMatches = compareFormValues(form, expectedForm);
    } catch (err) {
      errors.push(
        `Failed to load expected form: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Check completion expectation
  if (session.final.expectComplete && !isComplete) {
    errors.push('Expected form to be complete, but it is not');
  }

  const success =
    errors.length === 0 &&
    turnResults.every((t) => t.issuesMatch && t.hashMatch && t.countsMatch) &&
    formMatches;

  return {
    success,
    sessionPath,
    turns: turnResults,
    finalResult: {
      expectComplete: session.final.expectComplete,
      isComplete,
      formMatches,
    },
    errors,
  };
}

/**
 * Replay a single turn and verify results.
 */
function replayTurn(form: ParsedForm, turn: SessionTurn): TurnResult {
  // Get current issues
  const inspectResult = inspect(form);

  // Compare issues (by ref and reason, not exact object equality)
  const expectedIssues = turn.inspect.issues;
  const actualIssues = inspectResult.issues.slice(0, expectedIssues.length);

  const issuesDiff = compareIssues(expectedIssues, actualIssues);
  const issuesMatch = issuesDiff.length === 0;

  // Apply patches and compute hash
  const applyResult = applyPatches(form, turn.apply.patches);
  const markdown = serialize(form);
  const actualHash = sha256(markdown);

  const expectedHash = turn.after.markdownSha256;
  const hashMatch = actualHash === expectedHash;

  // Verify answered/skipped counts
  const actualAnswered = applyResult.progressSummary.counts.answeredFields;
  const actualSkipped = applyResult.progressSummary.counts.skippedFields;
  const expectedAnswered = turn.after.answeredFieldCount;
  const expectedSkipped = turn.after.skippedFieldCount;
  const countsMatch = actualAnswered === expectedAnswered && actualSkipped === expectedSkipped;

  return {
    turn: turn.turn,
    issuesMatch,
    hashMatch,
    countsMatch,
    expectedHash,
    actualHash,
    expectedAnswered,
    actualAnswered,
    expectedSkipped,
    actualSkipped,
    issuesDiff: issuesDiff.length > 0 ? issuesDiff : undefined,
  };
}

/**
 * Compare expected and actual issues.
 */
function compareIssues(expected: InspectIssue[], actual: InspectIssue[]): IssueDiff[] {
  const diffs: IssueDiff[] = [];

  // Create sets for comparison
  const expectedSet = new Set(expected.map(issueKey));
  const actualSet = new Set(actual.map(issueKey));

  // Find missing (expected but not actual)
  for (const issue of expected) {
    if (!actualSet.has(issueKey(issue))) {
      diffs.push({ type: 'missing', issue });
    }
  }

  // Find extra (actual but not expected)
  for (const issue of actual) {
    if (!expectedSet.has(issueKey(issue))) {
      diffs.push({ type: 'extra', issue });
    }
  }

  return diffs;
}

/**
 * Create a unique key for an issue for comparison.
 */
function issueKey(issue: InspectIssue): string {
  return `${issue.ref}:${issue.scope}:${issue.reason}`;
}

/**
 * Check if a field value represents "no value" (null, empty array, empty object).
 */
function isEmptyValue(value: unknown): boolean {
  if (!value) {
    return true;
  }
  const v = value as Record<string, unknown>;
  if (v.value === null) {
    return true;
  }
  if (Array.isArray(v.items) && v.items.length === 0) {
    return true;
  }
  if (Array.isArray(v.selected) && v.selected.length === 0) {
    return true;
  }
  if (v.values && typeof v.values === 'object' && Object.keys(v.values).length === 0) {
    return true;
  }
  return false;
}

/**
 * Compare form values between two parsed forms.
 *
 * Handles skipped fields: if actual form has a field skipped (state: "skipped"),
 * it matches expected fields with null/empty values.
 */
function compareFormValues(actual: ParsedForm, expected: ParsedForm): boolean {
  const actualResponses = actual.responsesByFieldId;
  const expectedResponses = expected.responsesByFieldId;

  // Get all field IDs from both
  const allIds = new Set([...Object.keys(actualResponses), ...Object.keys(expectedResponses)]);

  for (const id of allIds) {
    const actualResponse = actualResponses[id];
    const expectedResponse = expectedResponses[id];
    const isSkipped = actualResponse?.state === 'skipped';

    // If field is skipped in actual, it should match empty/null in expected
    if (isSkipped) {
      const expectedValue =
        expectedResponse?.state === 'answered' ? expectedResponse.value : undefined;
      if (expectedValue && !isEmptyValue(expectedValue)) {
        return false; // Expected has a value but actual skipped it
      }
      continue; // Match: skipped === empty
    }

    // Normal comparison: compare the entire response objects
    if (JSON.stringify(actualResponse) !== JSON.stringify(expectedResponse)) {
      return false;
    }
  }

  return true;
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
