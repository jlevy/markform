/**
 * Visual validation script for Fill Record visualization.
 * Generates HTML snapshots for manual review or automated comparison.
 *
 * Run: npx tsx tests/visual/fill-record-visual.ts
 * Output: tests/visual/snapshots/fill-record-*.html
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderFillRecordContent,
  formatDuration,
  formatTokens,
} from '../../src/cli/commands/serve.js';
import type { FillRecord } from '../../src/harness/fillRecord.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const snapshotDir = join(__dirname, 'snapshots');

// Ensure snapshot directory exists
if (!existsSync(snapshotDir)) {
  mkdirSync(snapshotDir, { recursive: true });
}

// Test case: Completed fill with tool calls
// Use type assertion since we're creating test fixtures that may have optional fields
const completedRecord = {
  sessionId: 'sess-test-completed',
  startedAt: '2026-01-30T14:30:00.000Z',
  completedAt: '2026-01-30T14:30:12.450Z',
  durationMs: 12450,
  form: {
    id: 'startup_research',
    title: 'Startup Deep Research',
    description: 'Comprehensive research form for startup analysis',
    structure: {
      groupCount: 5,
      fieldCount: 18,
      optionCount: 8,
      columnCount: 4,
      fieldCountByKind: {
        string: 6,
        number: 4,
        string_list: 0,
        checkboxes: 1,
        single_select: 1,
        multi_select: 0,
        url: 3,
        url_list: 1,
        date: 0,
        year: 0,
        table: 2,
      },
      groupsById: {},
      fieldsById: {},
      optionsById: {},
      columnsById: {},
    },
  },
  status: 'completed',
  formProgress: {
    totalFields: 18,
    requiredFields: 12,
    unansweredFields: 0,
    answeredFields: 18,
    skippedFields: 2,
    abortedFields: 0,
    validFields: 18,
    invalidFields: 0,
    emptyFields: 0,
    filledFields: 16,
    emptyRequiredFields: 0,
    totalNotes: 3,
  },
  llm: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    totalCalls: 3,
    inputTokens: 4250,
    outputTokens: 1890,
  },
  toolSummary: {
    totalCalls: 8,
    successfulCalls: 7,
    failedCalls: 1,
    successRate: 87.5,
    totalDurationMs: 5100,
    byTool: [
      {
        toolName: 'web_search',
        callCount: 5,
        successCount: 4,
        failureCount: 1,
        successRate: 80,
        timing: { minMs: 450, maxMs: 1800, avgMs: 920, p50Ms: 850, p95Ms: 1650, totalMs: 4600 },
      },
      {
        toolName: 'fill_form',
        callCount: 3,
        successCount: 3,
        failureCount: 0,
        successRate: 100,
        timing: { minMs: 120, maxMs: 220, avgMs: 167, p50Ms: 160, p95Ms: 210, totalMs: 500 },
      },
    ],
  },
  timingBreakdown: {
    totalMs: 12450,
    llmTimeMs: 6800,
    toolTimeMs: 5100,
    overheadMs: 550,
    breakdown: [
      { category: 'llm', label: 'LLM API calls', ms: 6800, percentage: 54.6 },
      { category: 'tools', label: 'Tool execution', ms: 5100, percentage: 41.0 },
      { category: 'overhead', label: 'Overhead', ms: 550, percentage: 4.4 },
    ],
  },
  timeline: [
    {
      turnNumber: 1,
      order: 1,
      startedAt: '2026-01-30T14:30:00.100Z',
      completedAt: '2026-01-30T14:30:04.500Z',
      durationMs: 4400,
      tokens: { input: 1500, output: 650 },
      toolCalls: [
        {
          tool: 'web_search',
          startedAt: '2026-01-30T14:30:00.200Z',
          completedAt: '2026-01-30T14:30:01.050Z',
          durationMs: 850,
          success: true,
          input: { query: 'startup funding' },
          result: { resultCount: 8 },
        },
        {
          tool: 'web_search',
          startedAt: '2026-01-30T14:30:01.100Z',
          completedAt: '2026-01-30T14:30:02.300Z',
          durationMs: 1200,
          success: true,
          input: { query: 'startup founders' },
          result: { resultCount: 12 },
        },
        {
          tool: 'fill_form',
          startedAt: '2026-01-30T14:30:02.400Z',
          completedAt: '2026-01-30T14:30:02.560Z',
          durationMs: 160,
          success: true,
          input: { patches: [] },
        },
      ],
      patchesApplied: 6,
      patchesRejected: 1,
    },
    {
      turnNumber: 2,
      order: 1,
      startedAt: '2026-01-30T14:30:04.600Z',
      completedAt: '2026-01-30T14:30:08.200Z',
      durationMs: 3600,
      tokens: { input: 1450, output: 580 },
      toolCalls: [
        {
          tool: 'web_search',
          startedAt: '2026-01-30T14:30:04.700Z',
          completedAt: '2026-01-30T14:30:05.150Z',
          durationMs: 450,
          success: false,
          input: { query: 'startup valuation' },
          result: { error: 'Rate limit exceeded, retrying...' },
        },
        {
          tool: 'web_search',
          startedAt: '2026-01-30T14:30:05.200Z',
          completedAt: '2026-01-30T14:30:07.000Z',
          durationMs: 1800,
          success: true,
          input: { query: 'startup valuation' },
          result: { resultCount: 5 },
        },
        {
          tool: 'fill_form',
          startedAt: '2026-01-30T14:30:07.100Z',
          completedAt: '2026-01-30T14:30:07.320Z',
          durationMs: 220,
          success: true,
          input: { patches: [] },
        },
      ],
      patchesApplied: 8,
      patchesRejected: 0,
    },
    {
      turnNumber: 3,
      order: 1,
      startedAt: '2026-01-30T14:30:08.300Z',
      completedAt: '2026-01-30T14:30:12.350Z',
      durationMs: 4050,
      tokens: { input: 1300, output: 660 },
      toolCalls: [
        {
          tool: 'web_search',
          startedAt: '2026-01-30T14:30:08.400Z',
          completedAt: '2026-01-30T14:30:08.700Z',
          durationMs: 300,
          success: true,
          input: { query: 'startup team' },
          result: { resultCount: 3 },
        },
        {
          tool: 'fill_form',
          startedAt: '2026-01-30T14:30:08.800Z',
          completedAt: '2026-01-30T14:30:08.920Z',
          durationMs: 120,
          success: true,
          input: { patches: [] },
        },
      ],
      patchesApplied: 4,
      patchesRejected: 0,
    },
  ],
  execution: {
    totalTurns: 3,
    parallelEnabled: false,
    orderLevels: [1],
    executionThreads: [],
  },
} as unknown as FillRecord;

// Test case: Failed fill
const failedRecord = {
  ...completedRecord,
  sessionId: 'sess-test-failed',
  status: 'failed',
  statusDetail: 'API rate limit exceeded after 3 retries',
  durationMs: 8500,
  formProgress: {
    ...completedRecord.formProgress,
    filledFields: 8,
    emptyFields: 10,
    unansweredFields: 10,
    answeredFields: 8,
  },
  timeline: completedRecord.timeline.slice(0, 2),
} as unknown as FillRecord;

// Test case: Partial fill (max_turns)
const partialRecord = {
  ...completedRecord,
  sessionId: 'sess-test-partial',
  status: 'partial',
  statusDetail: 'max_turns',
  formProgress: {
    ...completedRecord.formProgress,
    filledFields: 14,
    emptyFields: 4,
    unansweredFields: 4,
    answeredFields: 14,
  },
} as unknown as FillRecord;

// Test case: Cancelled fill
const cancelledRecord = {
  ...completedRecord,
  sessionId: 'sess-test-cancelled',
  status: 'cancelled',
  statusDetail: 'User interrupted via Ctrl+C',
  durationMs: 4400,
  formProgress: {
    ...completedRecord.formProgress,
    filledFields: 6,
    emptyFields: 12,
    unansweredFields: 12,
    answeredFields: 6,
  },
  timeline: completedRecord.timeline.slice(0, 1),
} as unknown as FillRecord;

// Generate HTML wrapper for standalone viewing
function wrapHtml(content: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      background: #f5f5f5;
    }
    @media (prefers-color-scheme: dark) {
      body {
        background: #111827;
      }
    }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
}

// Generate snapshots
const testCases = [
  { name: 'completed', record: completedRecord, title: 'Completed Fill Record' },
  { name: 'failed', record: failedRecord, title: 'Failed Fill Record' },
  { name: 'partial', record: partialRecord, title: 'Partial Fill Record' },
  { name: 'cancelled', record: cancelledRecord, title: 'Cancelled Fill Record' },
];

console.log('Generating visual snapshots...\n');

for (const { name, record, title } of testCases) {
  const content = renderFillRecordContent(record);
  const html = wrapHtml(content, title);
  const outputPath = join(snapshotDir, `fill-record-${name}.html`);
  writeFileSync(outputPath, html);
  console.log(`✓ Generated: ${outputPath}`);
}

// Also test utility functions
console.log('\n--- Utility Function Tests ---');
console.log(`formatDuration(500) = "${formatDuration(500)}"`);
console.log(`formatDuration(2500) = "${formatDuration(2500)}"`);
console.log(`formatDuration(65000) = "${formatDuration(65000)}"`);
console.log(`formatTokens(500) = "${formatTokens(500)}"`);
console.log(`formatTokens(1500) = "${formatTokens(1500)}"`);
console.log(`formatTokens(15000) = "${formatTokens(15000)}"`);

console.log('\n✅ All visual snapshots generated successfully!');
console.log(`\nOpen the HTML files in a browser to review:`);
console.log(`  file://${snapshotDir}/fill-record-completed.html`);
console.log(`  file://${snapshotDir}/fill-record-failed.html`);
console.log(`  file://${snapshotDir}/fill-record-partial.html`);
console.log(`  file://${snapshotDir}/fill-record-cancelled.html`);
