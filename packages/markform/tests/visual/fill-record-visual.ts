/**
 * Visual validation script for Fill Record visualization.
 * Generates HTML snapshots for manual review or automated comparison.
 *
 * Run: npx tsx tests/visual/fill-record-visual.ts
 * Output: tests/visual/snapshots/fill-record-*.html
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
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
          input: {
            patches: [
              { op: 'set_string', fieldId: 'company_name', value: 'Acme Corporation' },
              { op: 'set_string', fieldId: 'ceo_name', value: 'Jane Smith' },
              { op: 'set_number', fieldId: 'funding_amount', value: 15000000 },
              { op: 'set_url', fieldId: 'website', value: 'https://acme.example.com' },
              { op: 'set_single_select', fieldId: 'stage', value: 'series_a' },
              { op: 'skip_field', fieldId: 'optional_notes' },
            ],
          },
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
          input: {
            patches: [
              { op: 'set_number', fieldId: 'valuation', value: 50000000 },
              { op: 'set_date', fieldId: 'founded_date', value: '2019-03-15' },
              {
                op: 'set_string_list',
                fieldId: 'key_investors',
                value: ['Sequoia Capital', 'Andreessen Horowitz', 'Y Combinator'],
              },
              { op: 'set_string', fieldId: 'headquarters', value: 'San Francisco, CA' },
              {
                op: 'set_checkboxes',
                fieldId: 'industries',
                values: ['technology', 'saas', 'enterprise'],
              },
              { op: 'set_string', fieldId: 'employee_count', value: '50-100' },
              { op: 'clear_field', fieldId: 'deprecated_field' },
              { op: 'set_number', fieldId: 'revenue', value: 5200000 },
            ],
          },
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
          input: {
            patches: [
              {
                op: 'set_table',
                fieldId: 'team_members',
                rows: [
                  {
                    name: 'Jane Smith',
                    role: 'CEO',
                    linkedin: 'https://linkedin.com/in/janesmith',
                  },
                  { name: 'John Doe', role: 'CTO', linkedin: 'https://linkedin.com/in/johndoe' },
                  {
                    name: 'Alice Johnson',
                    role: 'CFO',
                    linkedin: 'https://linkedin.com/in/alicejohnson',
                  },
                ],
              },
              {
                op: 'set_url_list',
                fieldId: 'press_coverage',
                value: ['https://techcrunch.com/acme-funding', 'https://forbes.com/acme-profile'],
              },
              {
                op: 'set_string',
                fieldId: 'company_description',
                value:
                  'Acme Corporation is a leading enterprise SaaS company providing innovative solutions for workflow automation and business process optimization. Founded in 2019, we have grown to serve over 500 enterprise customers globally.',
              },
              { op: 'abort_field', fieldId: 'competitor_analysis' },
            ],
          },
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
  <script>
    // Tooltip handlers for Fill Record visualizations
    function frShowTip(el) {
      var tip = document.getElementById('fr-tooltip');
      if (tip && el.dataset.tooltip) {
        tip.textContent = el.dataset.tooltip;
        // Position tooltip centered above the element
        var rect = el.getBoundingClientRect();
        tip.style.left = (rect.left + rect.width / 2) + 'px';
        tip.style.top = (rect.top - 8) + 'px';
        tip.style.transform = 'translate(-50%, -100%)';
        tip.classList.add('visible');
      }
    }
    function frHideTip() {
      var tip = document.getElementById('fr-tooltip');
      if (tip) tip.classList.remove('visible');
    }
    // Copy YAML handler
    function frCopyYaml(btn) {
      var pre = btn.parentElement.querySelector('pre');
      navigator.clipboard.writeText(pre.textContent).then(function() {
        var orig = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(function() { btn.textContent = orig; }, 1500);
      });
    }
  </script>
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

console.log('\n✅ All HTML snapshots generated successfully!');

// Check if a command is available
function hasCommand(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Generate PNG snapshots if wkhtmltoimage is available
if (hasCommand('wkhtmltoimage')) {
  console.log('\n--- Generating PNG snapshots ---');
  const hasImagemagick = hasCommand('convert');

  for (const { name } of testCases) {
    const htmlPath = join(snapshotDir, `fill-record-${name}.html`);
    const pngPath = join(snapshotDir, `fill-record-${name}.png`);
    try {
      // Use wkhtmltoimage to convert HTML to PNG
      // --width 900 matches the max-width of .fr-dashboard
      execSync(
        `wkhtmltoimage --width 900 --quality 90 --enable-local-file-access "${htmlPath}" "${pngPath}"`,
        { stdio: 'pipe' },
      );

      // Optimize with ImageMagick if available (reduce size for PR attachment)
      if (hasImagemagick) {
        execSync(`convert "${pngPath}" -resize 50% -quality 85 "${pngPath}"`, { stdio: 'pipe' });
      }

      console.log(`✓ Generated: ${pngPath}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`✗ Failed to generate PNG for ${name}: ${errorMsg}`);
    }
  }
  console.log('\n✅ PNG snapshots generated!');
  if (hasImagemagick) {
    console.log('   (optimized with ImageMagick for smaller file sizes)');
  }
  console.log(`\nPNG files for PR attachment:`);
  console.log(`  ${snapshotDir}/fill-record-completed.png`);
  console.log(`  ${snapshotDir}/fill-record-failed.png`);
  console.log(`  ${snapshotDir}/fill-record-partial.png`);
  console.log(`  ${snapshotDir}/fill-record-cancelled.png`);
} else {
  console.log('\n⚠ wkhtmltoimage not found - skipping PNG generation');
  console.log('  Install with: apt-get install wkhtmltopdf');
}

console.log(`\nOpen the HTML files in a browser to review:`);
console.log(`  file://${snapshotDir}/fill-record-completed.html`);
console.log(`  file://${snapshotDir}/fill-record-failed.html`);
console.log(`  file://${snapshotDir}/fill-record-partial.html`);
console.log(`  file://${snapshotDir}/fill-record-cancelled.html`);
