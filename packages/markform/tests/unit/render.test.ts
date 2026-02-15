import { describe, expect, it } from 'vitest';

import {
  escapeHtml,
  formatDuration,
  formatTokens,
  renderViewContent,
  renderSourceContent,
  renderMarkdownContent,
  renderYamlContent,
  renderJsonContent,
  renderFillRecordContent,
  FILL_RECORD_STYLES,
  FILL_RECORD_SCRIPTS,
} from '../../src/render/index.js';
import { parseForm } from '../../src/engine/parse.js';
import type { FillRecord } from '../../src/harness/fillRecord.js';

describe('render/renderUtils', () => {
  describe('escapeHtml', () => {
    it('escapes all HTML special characters', () => {
      expect(escapeHtml('<div class="test">&\'hello\'')).toBe(
        '&lt;div class=&quot;test&quot;&gt;&amp;&#039;hello&#039;',
      );
    });

    it('returns empty string unchanged', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('returns plain text unchanged', () => {
      expect(escapeHtml('hello world')).toBe('hello world');
    });
  });

  describe('formatDuration', () => {
    it('formats milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
    });

    it('formats seconds', () => {
      expect(formatDuration(5000)).toBe('5.0s');
    });

    it('formats minutes and seconds', () => {
      expect(formatDuration(125000)).toBe('2m 5s');
    });
  });

  describe('formatTokens', () => {
    it('formats small numbers', () => {
      expect(formatTokens(500)).toBe('500');
    });

    it('formats thousands with k suffix', () => {
      expect(formatTokens(1500)).toBe('1.5k');
    });

    it('formats tens of thousands with k suffix', () => {
      expect(formatTokens(25000)).toBe('25.0k');
    });
  });
});

describe('render/contentRenderers', () => {
  describe('renderViewContent', () => {
    it('renders a simple form with text field', () => {
      const formMd = [
        '<!-- form id="test" title="Test" -->',
        '<!-- group id="info" title="Info" -->',
        '<!-- field id="name" kind="string" label="Name" -->',
        'Alice',
        '<!-- /field -->',
        '<!-- /group -->',
      ].join('\n');
      const form = parseForm(formMd);
      const html = renderViewContent(form);
      expect(html).toContain('view-content');
      expect(html).toContain('Name');
      expect(html).toContain('view-field');
    });
  });

  describe('renderSourceContent', () => {
    it('renders source with Jinja tag highlighting', () => {
      const html = renderSourceContent('{% field id="x" kind="string" /%}');
      expect(html).toContain('<pre>');
      expect(html).toContain('syn-jinja-keyword');
    });
  });

  describe('renderMarkdownContent', () => {
    it('renders headers', () => {
      const html = renderMarkdownContent('# Hello\n\nParagraph text');
      expect(html).toContain('<h2>');
      expect(html).toContain('Hello');
      expect(html).toContain('<p>');
      expect(html).toContain('Paragraph text');
    });

    it('renders unordered lists', () => {
      const html = renderMarkdownContent('- Item one\n- Item two');
      expect(html).toContain('<ul>');
      expect(html).toContain('<li>');
      expect(html).toContain('Item one');
    });
  });

  describe('renderYamlContent', () => {
    it('highlights YAML key-value pairs', () => {
      const html = renderYamlContent('name: Alice\nage: 30');
      expect(html).toContain('<pre>');
      expect(html).toContain('syn-key');
      expect(html).toContain('syn-string');
      expect(html).toContain('syn-number');
    });

    it('highlights YAML booleans', () => {
      const html = renderYamlContent('active: true');
      expect(html).toContain('syn-bool');
    });
  });

  describe('renderJsonContent', () => {
    it('highlights JSON content', () => {
      const html = renderJsonContent('{"name":"Alice","age":30}');
      expect(html).toContain('<pre>');
      expect(html).toContain('syn-key');
      expect(html).toContain('syn-string');
      expect(html).toContain('syn-number');
    });

    it('handles invalid JSON gracefully', () => {
      const html = renderJsonContent('not valid json');
      expect(html).toContain('<pre>');
      expect(html).toContain('not valid json');
    });
  });
});

describe('render/fillRecordRenderer', () => {
  // Use a minimal fixture that satisfies the runtime behavior.

  const baseFillRecord = {
    sessionId: '00000000-0000-0000-0000-000000000000',
    startedAt: '2026-02-10T10:00:00.000Z',
    completedAt: '2026-02-10T10:01:00.000Z',
    durationMs: 60000,
    form: {
      id: 'test-form',
      title: 'Test Form',
      structure: {
        groupCount: 1,
        fieldCount: 2,
        optionCount: 0,
        columnCount: 0,
        fieldCountByKind: { string: 2 },
        groupsById: { info: { id: 'info', title: 'Info', fieldCount: 2 } },
        fieldsById: {
          name: { id: 'name', kind: 'string', label: 'Name', groupId: 'info', required: true },
          bio: { id: 'bio', kind: 'string', label: 'Bio', groupId: 'info', required: false },
        },
        optionsById: {},
      },
    },
    status: 'completed',
    formProgress: {
      totalFields: 2,
      requiredFields: 1,
      unansweredFields: 0,
      answeredFields: 2,
      skippedFields: 0,
      abortedFields: 0,
      validFields: 2,
      invalidFields: 0,
      emptyFields: 0,
      filledFields: 2,
      totalNotes: 0,
    },
    llm: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      totalCalls: 2,
      inputTokens: 1000,
      outputTokens: 500,
    },
    toolSummary: {
      totalCalls: 3,
      successfulCalls: 3,
      failedCalls: 0,
      successRate: 100,
      totalDurationMs: 500,
      byTool: [],
    },
    timingBreakdown: {
      totalMs: 60000,
      llmTimeMs: 50000,
      toolTimeMs: 500,
      overheadMs: 9500,
      breakdown: [
        { category: 'llm', label: 'LLM', ms: 50000, percentage: 83.3 },
        { category: 'tools', label: 'Tools', ms: 500, percentage: 0.8 },
        { category: 'overhead', label: 'Overhead', ms: 9500, percentage: 15.8 },
      ],
    },
    timeline: [
      {
        turnNumber: 1,
        order: 0,
        executionId: '0-serial',
        startedAt: '2026-02-10T10:00:00.000Z',
        completedAt: '2026-02-10T10:00:30.000Z',
        durationMs: 30000,
        issuesAddressed: 2,
        patchesApplied: 2,
        patchesRejected: 0,
        tokens: { input: 1000, output: 500 },
        toolCalls: [],
      },
    ],
    execution: {
      totalTurns: 1,
      parallelEnabled: false,
      orderLevels: [0],
      executionThreads: ['0-serial'],
    },
  } as unknown as FillRecord;

  describe('renderFillRecordContent', () => {
    it('renders a completed fill record', () => {
      const html = renderFillRecordContent(baseFillRecord);
      expect(html).toContain('fr-dashboard');
      expect(html).toContain('claude-sonnet-4-5');
      expect(html).toContain('1m 0s'); // formatDuration(60000)
    });

    it('renders status banner for failed records', () => {
      const failed = {
        ...baseFillRecord,
        status: 'failed' as const,
        statusDetail: 'API error',
      };
      const html = renderFillRecordContent(failed);
      expect(html).toContain('fr-banner--error');
      expect(html).toContain('FAILED');
      expect(html).toContain('API error');
    });

    it('renders token summary', () => {
      const html = renderFillRecordContent(baseFillRecord);
      expect(html).toContain('1.5k'); // formatTokens(1500 total)
    });
  });

  describe('FILL_RECORD_STYLES', () => {
    it('contains CSS for fill record dashboard', () => {
      expect(FILL_RECORD_STYLES).toContain('.fr-dashboard');
      expect(FILL_RECORD_STYLES).toContain('<style>');
    });
  });

  describe('FILL_RECORD_SCRIPTS', () => {
    it('contains tooltip and copy functions', () => {
      expect(FILL_RECORD_SCRIPTS).toContain('frShowTip');
      expect(FILL_RECORD_SCRIPTS).toContain('frHideTip');
      expect(FILL_RECORD_SCRIPTS).toContain('frCopyYaml');
    });
  });
});
