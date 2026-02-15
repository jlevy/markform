/**
 * Fill record HTML renderer and associated styles/scripts.
 *
 * Renders FillRecord data as an interactive dashboard with Gantt timeline,
 * progress bars, tool summaries, and turn details. No CLI or server dependencies.
 */

import YAML from 'yaml';

import type { FillRecord } from '../harness/fillRecord.js';
import { escapeHtml, formatDuration, formatTokens } from './renderUtils.js';
import { renderYamlContent } from './contentRenderers.js';

// =============================================================================
// Fill Record Interactive Scripts
// =============================================================================

/**
 * JavaScript for fill record interactive features.
 * Consumers should include this in a <script> tag on their page.
 * Provides: frShowTip(el), frHideTip(), frCopyYaml(btn)
 */
export const FILL_RECORD_SCRIPTS = `
// Copy YAML content handler for Fill Record tab (must be global for dynamically loaded content)
function frCopyYaml(btn) {
  const pre = btn.parentElement.querySelector('pre');
  navigator.clipboard.writeText(pre.textContent).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = orig, 1500);
  });
}

// Tooltip handlers for Fill Record visualizations (must be global for dynamically loaded content)
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
`;

// =============================================================================
// Private Helpers
// =============================================================================

/**
 * Format a rate value for HTML display with appropriate significant figures.
 * >= 10s: 1 decimal (e.g., 12.3s/field)
 * >= 1s: 2 decimals (e.g., 3.45s/field)
 * < 1s: show as ms (e.g., 450ms/field)
 */
function formatRateHtml(ms: number, unit: string): string {
  const seconds = ms / 1000;
  if (seconds >= 10) {
    return `${seconds.toFixed(1)}s/${unit}`;
  }
  if (seconds >= 1) {
    return `${seconds.toFixed(2)}s/${unit}`;
  }
  return `${Math.round(ms)}ms/${unit}`;
}

/**
 * Format a patch value for display.
 * Shows full content - the container has max-height with scroll for long values.
 */
function formatPatchValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '<em class="fr-turn__patch-value--clear">(cleared)</em>';
  }
  if (typeof value === 'string') {
    return escapeHtml(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  // Arrays and objects - show full JSON
  return escapeHtml(JSON.stringify(value, null, 2));
}

/**
 * Render patches from a fill_form tool call input.
 * Returns HTML for the patch details section.
 */
function renderPatchDetails(input: Record<string, unknown>): string {
  const patches = input.patches;
  if (!Array.isArray(patches) || patches.length === 0) {
    return '';
  }

  const patchHtml = patches
    .map((patch: unknown) => {
      if (!patch || typeof patch !== 'object') return '';
      const p = patch as Record<string, unknown>;
      const op = typeof p.op === 'string' ? p.op : 'unknown';
      const fieldId =
        typeof p.fieldId === 'string' ? p.fieldId : typeof p.noteId === 'string' ? p.noteId : '';

      // Determine the display based on operation type
      const opLabel = op.replace(/_/g, ' ');
      let valueHtml = '';

      if (op === 'skip_field') {
        valueHtml = '<em class="fr-turn__patch-value--skip">(skipped)</em>';
      } else if (op === 'abort_field') {
        valueHtml = '<em class="fr-turn__patch-value--skip">(aborted)</em>';
      } else if (op === 'clear_field') {
        valueHtml = '<em class="fr-turn__patch-value--clear">(cleared)</em>';
      } else if ('value' in p) {
        valueHtml = formatPatchValue(p.value);
      } else if ('values' in p) {
        valueHtml = formatPatchValue(p.values);
      } else if ('rows' in p) {
        valueHtml = formatPatchValue(p.rows);
      }

      return `
        <div class="fr-turn__patch">
          <span class="fr-turn__patch-field">${escapeHtml(fieldId)}</span>
          <span class="fr-turn__patch-op">${escapeHtml(opLabel)}</span>
          <span class="fr-turn__patch-value">${valueHtml}</span>
        </div>
      `;
    })
    .filter(Boolean)
    .join('');

  return `<div class="fr-turn__patches">${patchHtml}</div>`;
}

/**
 * Render a single tool call with enhanced details.
 * Shows query for web_search, patch details for fill_form.
 */
function renderToolCall(tc: {
  tool: string;
  success: boolean;
  durationMs: number;
  input: Record<string, unknown>;
  result?: { error?: string; resultCount?: number };
}): string {
  const hasError = !!tc.result?.error;
  const icon = tc.success ? '✓' : '✕';
  const errorClass = hasError ? ' fr-turn__tool--error' : '';

  // Build result summary
  let resultSummary = '';
  if (hasError) {
    resultSummary = `Error: ${escapeHtml(tc.result?.error ?? '')}`;
  } else if (tc.result?.resultCount !== undefined) {
    resultSummary = `${tc.result.resultCount} results`;
  } else {
    resultSummary = 'OK';
  }

  // Build tool-specific details
  let detailHtml = '';
  if (tc.tool === 'web_search' && typeof tc.input.query === 'string') {
    const query = escapeHtml(tc.input.query);
    detailHtml = ` <span class="fr-turn__query">"${query}"</span>`;
  }

  // Base tool call line
  const toolLine = `<li class="fr-turn__tool${errorClass}">${icon} <strong>${escapeHtml(tc.tool)}</strong>${detailHtml}: ${resultSummary} (${formatDuration(tc.durationMs)})</li>`;

  // For fill_form, add patch details
  if (tc.tool === 'fill_form' && tc.input.patches) {
    const patchDetails = renderPatchDetails(tc.input);
    if (patchDetails) {
      return toolLine + patchDetails;
    }
  }

  return toolLine;
}

/**
 * CSS styles for fill record visualization.
 * Uses CSS custom properties for theming (supports dark mode via prefers-color-scheme).
 * Designed to be lightweight, reusable, and embeddable.
 */
export const FILL_RECORD_STYLES = `
<style>
  .fr-dashboard {
    --fr-bg: #ffffff;
    --fr-bg-muted: #f9fafb;
    --fr-bg-subtle: #f3f4f6;
    --fr-border: #e5e7eb;
    --fr-text: #111827;
    --fr-text-muted: #6b7280;
    --fr-primary: #3b82f6;
    --fr-success: #22c55e;
    --fr-warning: #f59e0b;
    --fr-error: #ef4444;
    --fr-info: #6b7280;

    /* Typography - consolidated to fewer sizes */
    --fr-font-sm: 13px;
    --fr-font-base: 14px;
    --fr-font-lg: 20px;

    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    padding: 20px;
    max-width: 900px;
    margin: 0 auto;
    color: var(--fr-text);
    line-height: 1.5;
  }

  @media (prefers-color-scheme: dark) {
    .fr-dashboard {
      --fr-bg: #1f2937;
      --fr-bg-muted: #374151;
      --fr-bg-subtle: #4b5563;
      --fr-border: #4b5563;
      --fr-text: #f9fafb;
      --fr-text-muted: #9ca3af;
    }
  }

  .fr-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--fr-border);
  }
  .fr-header__model {
    font-weight: 600;
    font-size: var(--fr-font-base);
    color: var(--fr-text);
  }
  .fr-header__time {
    font-weight: 600;
    font-size: var(--fr-font-base);
    color: var(--fr-text);
  }

  .fr-banner {
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 20px;
    font-size: var(--fr-font-base);
  }
  .fr-banner--error {
    background: color-mix(in srgb, var(--fr-error) 10%, var(--fr-bg));
    border: 1px solid var(--fr-error);
  }
  .fr-banner--warning {
    background: color-mix(in srgb, var(--fr-warning) 10%, var(--fr-bg));
    border: 1px solid var(--fr-warning);
  }

  .fr-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }

  .fr-card {
    padding: 16px;
    background: var(--fr-bg-muted);
    border-radius: 8px;
    text-align: center;
  }
  .fr-card__label {
    font-size: var(--fr-font-sm);
    color: var(--fr-text-muted);
    margin-bottom: 4px;
  }
  .fr-card__value {
    font-size: var(--fr-font-lg);
    font-weight: 600;
  }
  .fr-card__sub {
    font-size: var(--fr-font-sm);
    color: var(--fr-text-muted);
    margin-top: 2px;
  }

  .fr-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 4px;
    font-weight: 600;
    font-size: var(--fr-font-sm);
  }
  .fr-badge--completed { background: color-mix(in srgb, var(--fr-success) 15%, transparent); color: var(--fr-success); }
  .fr-badge--partial { background: color-mix(in srgb, var(--fr-warning) 15%, transparent); color: var(--fr-warning); }
  .fr-badge--cancelled { background: color-mix(in srgb, var(--fr-info) 15%, transparent); color: var(--fr-info); }
  .fr-badge--failed { background: color-mix(in srgb, var(--fr-error) 15%, transparent); color: var(--fr-error); }

  .fr-section {
    margin-bottom: 24px;
  }
  .fr-section__title {
    font-size: var(--fr-font-base);
    font-weight: 500;
    color: var(--fr-text);
    margin-bottom: 8px;
  }

  .fr-progress {
    background: var(--fr-border);
    border-radius: 4px;
    height: 20px;
    overflow: hidden;
  }
  .fr-progress__bar {
    background: var(--fr-primary);
    height: 100%;
    transition: width 0.3s ease;
  }
  .fr-progress__text {
    font-size: var(--fr-font-sm);
    color: var(--fr-text-muted);
    margin-top: 4px;
  }

  .fr-progress__segments {
    display: flex;
    height: 100%;
    width: 100%;
  }
  .fr-progress-segment {
    height: 100%;
    min-width: 2px;
    border-right: 2px solid var(--fr-bg);
    cursor: pointer;
  }
  .fr-progress-segment:last-child {
    border-right: none;
  }
  .fr-progress-segment--filled {
    background: var(--fr-primary);
  }
  .fr-progress-segment--filled:hover {
    background: color-mix(in srgb, var(--fr-primary) 70%, white);
  }
  .fr-progress-segment--prefilled {
    background: #8b5cf6;
  }
  .fr-progress-segment--prefilled:hover {
    background: color-mix(in srgb, #8b5cf6 70%, white);
  }
  .fr-progress-segment--skipped {
    background: var(--fr-warning);
  }
  .fr-progress-segment--skipped:hover {
    background: color-mix(in srgb, var(--fr-warning) 70%, white);
  }
  .fr-progress-segment--empty {
    background: var(--fr-border);
  }

  /* Gantt chart - each call on its own row */
  .fr-gantt {
    margin-bottom: 8px;
  }
  .fr-gantt__row {
    display: flex;
    align-items: center;
    height: 20px;
    margin-bottom: 3px;
  }
  .fr-gantt__label {
    width: 90px;
    flex-shrink: 0;
    font-size: 11px;
    color: var(--fr-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 8px;
    text-align: right;
  }
  .fr-gantt__track {
    flex: 1;
    background: var(--fr-bg-subtle);
    border-radius: 3px;
    height: 14px;
    position: relative;
  }
  .fr-gantt__bar {
    position: absolute;
    top: 2px;
    height: calc(100% - 4px);
    min-width: 6px;
    border-radius: 2px;
    cursor: pointer;
  }
  .fr-gantt__bar:hover {
    filter: brightness(1.15);
  }
  .fr-gantt__bar--llm {
    background: var(--fr-primary);
  }
  .fr-gantt__bar--tool {
    background: var(--fr-success);
  }
  .fr-gantt__legend {
    display: flex;
    gap: 16px;
    font-size: var(--fr-font-sm);
    color: var(--fr-text-muted);
    margin-top: 12px;
    padding-top: 8px;
    border-top: 1px solid var(--fr-border);
  }
  .fr-gantt__legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .fr-gantt__legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 2px;
  }
  .fr-gantt__legend-dot--llm { background: var(--fr-primary); }
  .fr-gantt__legend-dot--tool { background: var(--fr-success); }

  /* Tooltip container */
  .fr-tooltip {
    position: fixed;
    background: #1f2937;
    color: #f9fafb;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: var(--fr-font-sm);
    white-space: pre-line;
    pointer-events: none;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.05s ease-out, visibility 0.05s ease-out;
  }
  .fr-tooltip.visible {
    opacity: 1;
    visibility: visible;
    transition: opacity 0.2s ease-in, visibility 0.2s ease-in;
  }

  .fr-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--fr-font-sm);
  }
  .fr-table th {
    padding: 8px 12px;
    text-align: left;
    font-weight: 600;
    background: var(--fr-bg-subtle);
  }
  .fr-table th:not(:first-child) { text-align: center; }
  .fr-table td {
    padding: 8px 12px;
    border-bottom: 1px solid var(--fr-border);
  }
  .fr-table td:not(:first-child) { text-align: center; }

  .fr-details {
    border: none;
    background: none;
  }
  .fr-details > summary {
    cursor: pointer;
    font-size: var(--fr-font-base);
    font-weight: 500;
    color: var(--fr-text);
    padding: 8px 0;
    list-style: none;
  }
  .fr-details > summary::-webkit-details-marker { display: none; }
  .fr-details > summary::before {
    content: '▶';
    display: inline-block;
    margin-right: 8px;
    transition: transform 0.2s;
    font-size: 11px;
  }
  .fr-details[open] > summary::before {
    transform: rotate(90deg);
  }
  .fr-details__content {
    background: var(--fr-bg-muted);
    border-radius: 8px;
    padding: 16px;
    margin-top: 8px;
  }

  .fr-turn {
    margin-bottom: 8px;
    background: var(--fr-bg-muted);
    border-radius: 4px;
  }
  .fr-turn summary {
    cursor: pointer;
    padding: 12px;
    font-size: var(--fr-font-sm);
    list-style: none;
  }
  .fr-turn summary::-webkit-details-marker { display: none; }
  .fr-turn summary::before {
    content: '▶';
    display: inline-block;
    margin-right: 8px;
    transition: transform 0.2s;
    font-size: 11px;
  }
  .fr-turn[open] summary::before {
    transform: rotate(90deg);
  }
  .fr-turn__content {
    padding: 0 12px 12px;
  }
  .fr-turn__tools {
    margin: 0;
    padding-left: 20px;
    list-style: none;
  }
  .fr-turn__tool {
    margin: 4px 0;
    font-size: var(--fr-font-sm);
    color: var(--fr-text-muted);
  }
  .fr-turn__tool--error { color: var(--fr-error); }

  .fr-turn__query {
    color: var(--fr-primary);
    font-style: italic;
  }

  .fr-turn__patches {
    margin: 4px 0 8px 20px;
    padding: 8px 12px;
    background: var(--fr-bg-subtle);
    border-radius: 4px;
    font-size: var(--fr-font-sm);
  }
  .fr-turn__patch {
    margin: 4px 0;
    padding: 4px 0;
    border-bottom: 1px solid var(--fr-border);
  }
  .fr-turn__patch:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }
  .fr-turn__patch-field {
    font-weight: 600;
    color: var(--fr-text);
  }
  .fr-turn__patch-op {
    font-size: 11px;
    padding: 1px 4px;
    border-radius: 2px;
    background: var(--fr-bg-muted);
    color: var(--fr-text-muted);
    margin-left: 6px;
  }
  .fr-turn__patch-value {
    display: block;
    margin-top: 2px;
    color: var(--fr-text-muted);
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    word-break: break-word;
    white-space: pre-wrap;
    max-height: 200px;
    overflow: auto;
  }
  .fr-turn__patch-value--skip {
    color: var(--fr-warning);
    font-style: italic;
  }
  .fr-turn__patch-value--clear {
    color: var(--fr-info);
    font-style: italic;
  }

  .fr-raw {
    position: relative;
  }
  .fr-copy-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 4px 8px;
    font-size: var(--fr-font-sm);
    background: var(--fr-bg-subtle);
    border: 1px solid var(--fr-border);
    border-radius: 4px;
    cursor: pointer;
    color: var(--fr-text-muted);
    transition: all 0.15s;
  }
  .fr-copy-btn:hover {
    background: var(--fr-border);
    color: var(--fr-text);
  }
  .fr-copy-btn:active {
    transform: scale(0.95);
  }

  /* Scoped pre styles to override parent .tab-content pre */
  .fr-dashboard pre {
    background: var(--fr-bg-muted);
    color: var(--fr-text);
    padding: 1rem;
    border-radius: 6px;
    border: 1px solid var(--fr-border);
    overflow-x: auto;
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 0.85rem;
    line-height: 1.5;
    margin: 0;
  }

  /* Override syntax highlighting colors for dark mode compatibility */
  .fr-dashboard .syn-key { color: var(--fr-primary); }
  .fr-dashboard .syn-string { color: var(--fr-success); }
  .fr-dashboard .syn-number { color: var(--fr-primary); }
  .fr-dashboard .syn-bool { color: var(--fr-warning); }
  .fr-dashboard .syn-null { color: var(--fr-error); }

  @media (max-width: 600px) {
    .fr-dashboard { padding: 12px; }
    .fr-cards { grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .fr-card { padding: 12px; }
    .fr-card__value { font-size: 18px; }
    .fr-table { font-size: var(--fr-font-sm); }
    .fr-table th, .fr-table td { padding: 6px 8px; }
  }
</style>
`;

/**
 * Render fill record content (dashboard-style visualization).
 * Uses CSS custom properties for theming with automatic dark mode support.
 * Mobile responsive with grid-based layout.
 *
 * @public Exported for testing and reuse.
 */
export function renderFillRecordContent(record: FillRecord): string {
  const { status, statusDetail, startedAt, durationMs, llm, formProgress, toolSummary, timeline } =
    record;

  // Format start time for display
  const startDate = new Date(startedAt);
  const formattedDate = startDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedTime = startDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Header with model and timestamp
  const headerInfo = `
    <div class="fr-header">
      <div class="fr-header__model">${escapeHtml(llm.model)}</div>
      <div class="fr-header__time">${formattedDate} at ${formattedTime}</div>
    </div>
  `;

  // Status banner for non-completed fills
  let statusBanner = '';
  if (status !== 'completed') {
    const bannerClass = status === 'failed' ? 'fr-banner--error' : 'fr-banner--warning';
    const icon = status === 'failed' ? '✕' : '⚠';
    const title = status === 'failed' ? 'FAILED' : status === 'cancelled' ? 'CANCELLED' : 'PARTIAL';
    const msg = statusDetail ?? (status === 'partial' ? 'Did not complete all fields' : '');
    statusBanner = `<div class="fr-banner ${bannerClass}"><strong>${icon} ${title}${msg ? ':' : ''}</strong>${msg ? ` ${escapeHtml(msg)}` : ''}</div>`;
  }

  // Summary cards
  const totalTokens = llm.inputTokens + llm.outputTokens;
  const badgeClass = `fr-badge fr-badge--${status}`;
  const badgeIcon = { completed: '✓', partial: '⚠', cancelled: '⊘', failed: '✕' }[status] ?? '?';
  const badgeLabel = status.charAt(0).toUpperCase() + status.slice(1);

  // Compute display rates for duration card
  const durationSubParts: string[] = [];
  if (record.execution.totalTurns > 0) {
    durationSubParts.push(formatRateHtml(durationMs / record.execution.totalTurns, 'turn'));
  }
  if (formProgress.answeredFields > 0) {
    durationSubParts.push(formatRateHtml(durationMs / formProgress.answeredFields, 'field'));
  }
  const durationSubHtml =
    durationSubParts.length > 0
      ? `<div class="fr-card__sub">${durationSubParts.join(' · ')}</div>`
      : '';

  // Effective parallelism card
  const ep = record.timingBreakdown.effectiveParallelism;
  const parallelismCard =
    ep > 0
      ? `
      <div class="fr-card">
        <div class="fr-card__label">Parallelism</div>
        <div class="fr-card__value">${ep.toFixed(1)}x</div>
        <div class="fr-card__sub">${record.execution.parallelEnabled ? `${record.execution.executionThreads.length} threads` : 'serial'}</div>
      </div>`
      : '';

  const summaryCards = `
    <div class="fr-cards">
      <div class="fr-card">
        <div class="fr-card__label">Status</div>
        <div><span class="${badgeClass}">${badgeIcon} ${badgeLabel}</span></div>
      </div>
      <div class="fr-card">
        <div class="fr-card__label">Duration</div>
        <div class="fr-card__value">${formatDuration(durationMs)}</div>
        ${durationSubHtml}
      </div>
      <div class="fr-card">
        <div class="fr-card__label">Turns</div>
        <div class="fr-card__value">${timeline.length}</div>
      </div>
      <div class="fr-card">
        <div class="fr-card__label">Tokens</div>
        <div class="fr-card__value">${formatTokens(totalTokens)}</div>
        <div class="fr-card__sub">${formatTokens(llm.inputTokens)} in / ${formatTokens(llm.outputTokens)} out</div>
      </div>
      ${parallelismCard}
    </div>
  `;

  // Progress bar
  // Extract filled fields from timeline to show individual segments
  // Use Map to deduplicate by fieldId, keeping only the last (final) state for each field
  const fieldsMap = new Map<string, { fieldId: string; op: string; turnNumber: number }>();
  for (const turn of timeline) {
    for (const tc of turn.toolCalls) {
      if (tc.tool === 'fill_form' && tc.input.patches) {
        const patches = tc.input.patches as { op?: string; fieldId?: string }[];
        for (const patch of patches) {
          if (patch.fieldId && patch.op) {
            fieldsMap.set(patch.fieldId, {
              fieldId: patch.fieldId,
              op: patch.op,
              turnNumber: turn.turnNumber,
            });
          }
        }
      }
    }
  }
  const fieldsFilled = Array.from(fieldsMap.values());

  const totalFields = formProgress.totalFields;
  const filledFields = formProgress.filledFields;
  const skippedFields = formProgress.skippedFields;
  const abortedFields = formProgress.abortedFields ?? 0;
  const progressPercent = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;

  // Build progress segments
  const segmentWidth = totalFields > 0 ? 100 / totalFields : 0;

  // AI-filled fields (from timeline patches, excluding skip/abort)
  const aiFilledFields = fieldsFilled.filter(
    (f) => f.op !== 'skip_field' && f.op !== 'abort_field',
  );
  const aiFilledSegmentsHtml = aiFilledFields
    .map((f) => {
      const opLabel = f.op.replace(/_/g, ' ');
      const tooltip = `${f.fieldId}\n${opLabel}\nTurn ${f.turnNumber}`;
      return `<div class="fr-progress-segment fr-progress-segment--filled" style="width: ${segmentWidth}%" data-tooltip="${escapeHtml(tooltip)}" onmouseenter="frShowTip(this)" onmouseleave="frHideTip()"></div>`;
    })
    .join('');

  // Pre-filled fields (filled before AI started, not in timeline)
  const prefilledCount = Math.max(0, filledFields - aiFilledFields.length);
  const prefilledSegmentsHtml =
    prefilledCount > 0
      ? `<div class="fr-progress-segment fr-progress-segment--prefilled" style="width: ${segmentWidth * prefilledCount}%" data-tooltip="Pre-filled (${prefilledCount} field${prefilledCount !== 1 ? 's' : ''})" onmouseenter="frShowTip(this)" onmouseleave="frHideTip()"></div>`
      : '';

  // Skipped/aborted fields
  const skippedSegmentsHtml = fieldsFilled
    .filter((f) => f.op === 'skip_field' || f.op === 'abort_field')
    .map((f) => {
      const opLabel = f.op === 'skip_field' ? 'skipped' : 'aborted';
      const tooltip = `${f.fieldId}\n${opLabel}\nTurn ${f.turnNumber}`;
      return `<div class="fr-progress-segment fr-progress-segment--skipped" style="width: ${segmentWidth}%" data-tooltip="${escapeHtml(tooltip)}" onmouseenter="frShowTip(this)" onmouseleave="frHideTip()"></div>`;
    })
    .join('');

  // Empty segments for unfilled fields
  const unfilledCount = totalFields - filledFields - skippedFields - abortedFields;
  const unfilledSegmentsHtml =
    unfilledCount > 0
      ? `<div class="fr-progress-segment fr-progress-segment--empty" style="width: ${segmentWidth * unfilledCount}%"></div>`
      : '';

  // Build progress text with details
  const progressDetails: string[] = [];
  if (prefilledCount > 0) progressDetails.push(`${prefilledCount} pre-filled`);
  if (skippedFields > 0) progressDetails.push(`${skippedFields} skipped`);
  const progressDetailsText = progressDetails.length > 0 ? ` • ${progressDetails.join(' • ')}` : '';

  const progressBar = `
    <div class="fr-section">
      <div class="fr-section__title">Progress</div>
      <div class="fr-progress">
        <div class="fr-progress__segments">
          ${prefilledSegmentsHtml}${aiFilledSegmentsHtml}${skippedSegmentsHtml}${unfilledSegmentsHtml}
        </div>
      </div>
      <div class="fr-progress__text">
        ${filledFields}/${totalFields} fields filled (${progressPercent}%)${progressDetailsText}
      </div>
    </div>
  `;

  // Gantt-style timeline visualization
  // Calculate actual start/end times for each call
  const totalMs = durationMs;
  const llmCallCount = llm.totalCalls;
  const toolCallCount = toolSummary.totalCalls;

  // Build timeline events with actual positions
  // For each turn: LLM call happens first, then tool calls sequentially
  interface TimelineEvent {
    type: 'llm' | 'tool';
    startMs: number;
    durationMs: number;
    turnNumber: number;
    label: string;
    tokens?: { input: number; output: number; total: number };
  }

  const timelineEvents: TimelineEvent[] = [];

  for (const turn of timeline) {
    const toolTimeInTurn = turn.toolCalls.reduce((sum, tc) => sum + tc.durationMs, 0);
    const llmTimeInTurn = Math.max(0, turn.durationMs - toolTimeInTurn);

    // LLM call for this turn - starts at turn.startMs
    if (llmTimeInTurn > 0) {
      timelineEvents.push({
        type: 'llm',
        startMs: turn.startMs,
        durationMs: llmTimeInTurn,
        turnNumber: turn.turnNumber,
        label: `Turn ${turn.turnNumber}`,
        tokens: {
          input: turn.tokens.input,
          output: turn.tokens.output,
          total: turn.tokens.input + turn.tokens.output,
        },
      });
    }

    // Tool calls for this turn - use pre-computed startMs
    for (const tc of turn.toolCalls) {
      timelineEvents.push({
        type: 'tool',
        startMs: tc.startMs,
        durationMs: tc.durationMs,
        turnNumber: turn.turnNumber,
        label: tc.tool,
      });
    }
  }

  // Render Gantt chart rows - each event gets its own row
  const ganttRowsHtml = timelineEvents
    .map((e) => {
      const leftPct = totalMs > 0 ? (e.startMs / totalMs) * 100 : 0;
      const widthPct = totalMs > 0 ? (e.durationMs / totalMs) * 100 : 0;
      const barClass = e.type === 'llm' ? 'fr-gantt__bar--llm' : 'fr-gantt__bar--tool';
      const startTime = `Start: ${formatDuration(e.startMs)}`;
      const tooltip =
        e.type === 'llm'
          ? `${e.label}&#10;${startTime}&#10;Duration: ${formatDuration(e.durationMs)}&#10;${formatTokens(e.tokens?.total ?? 0)} tokens (${formatTokens(e.tokens?.input ?? 0)} in / ${formatTokens(e.tokens?.output ?? 0)} out)`
          : `${e.label}&#10;${startTime}&#10;Duration: ${formatDuration(e.durationMs)}&#10;Turn ${e.turnNumber}`;

      return `
        <div class="fr-gantt__row">
          <div class="fr-gantt__label">${escapeHtml(e.label)}</div>
          <div class="fr-gantt__track">
            <div class="fr-gantt__bar ${barClass}" style="left: ${leftPct}%; width: ${widthPct}%" data-tooltip="${tooltip}" onmouseenter="frShowTip(this)" onmouseleave="frHideTip()"></div>
          </div>
        </div>`;
    })
    .join('');

  const llmTotalMs = timelineEvents
    .filter((e) => e.type === 'llm')
    .reduce((sum, e) => sum + e.durationMs, 0);
  const toolTotalMs = timelineEvents
    .filter((e) => e.type === 'tool')
    .reduce((sum, e) => sum + e.durationMs, 0);

  const timingSection = `
    <details class="fr-details fr-section" open>
      <summary>Timeline (${formatDuration(totalMs)} total)</summary>
      <div class="fr-details__content">
        <div class="fr-gantt">
          ${ganttRowsHtml}
          <div class="fr-gantt__legend">
            <div class="fr-gantt__legend-item">
              <div class="fr-gantt__legend-dot fr-gantt__legend-dot--llm"></div>
              <span>LLM (${llmCallCount} call${llmCallCount !== 1 ? 's' : ''}, ${formatDuration(llmTotalMs)})</span>
            </div>
            <div class="fr-gantt__legend-item">
              <div class="fr-gantt__legend-dot fr-gantt__legend-dot--tool"></div>
              <span>Tools (${toolCallCount} call${toolCallCount !== 1 ? 's' : ''}, ${formatDuration(toolTotalMs)})</span>
            </div>
          </div>
        </div>
      </div>
    </details>
  `;

  // Tool summary table
  let toolSection = '';
  if (toolSummary.byTool.length > 0) {
    const toolRows = toolSummary.byTool
      .map(
        (t) => `
      <tr>
        <td>${escapeHtml(t.toolName)}</td>
        <td>${t.callCount}</td>
        <td>${t.successCount === t.callCount ? '100%' : `${Math.round((t.successCount / t.callCount) * 100)}%`}</td>
        <td>${formatDuration(t.timing.avgMs)}</td>
        <td>${formatDuration(t.timing.p95Ms)}</td>
      </tr>
    `,
      )
      .join('');

    const avgToolDuration =
      toolSummary.avgDurationMs > 0
        ? ` · avg ${formatDuration(toolSummary.avgDurationMs)} each`
        : '';

    toolSection = `
      <details class="fr-details fr-section" open>
        <summary>Tool Summary (${toolSummary.totalCalls} calls${avgToolDuration})</summary>
        <div style="overflow-x: auto; margin-top: 8px;">
          <table class="fr-table">
            <thead><tr><th>Tool</th><th>Calls</th><th>Success</th><th>Avg</th><th>p95</th></tr></thead>
            <tbody>${toolRows}</tbody>
          </table>
        </div>
      </details>
    `;
  }

  // Turn Details accordion
  let timelineSection = '';
  if (timeline.length > 0) {
    const timelineItems = timeline
      .map((turn) => {
        const turnTokens = turn.tokens.input + turn.tokens.output;
        const toolCallsList = turn.toolCalls.map((tc) => renderToolCall(tc)).join('');

        const patchInfo = turn.patchesApplied > 0 ? ` • ${turn.patchesApplied} patches` : '';
        const rejectedInfo =
          turn.patchesRejected > 0
            ? ` <span style="color: var(--fr-error)">(${turn.patchesRejected} rejected)</span>`
            : '';

        return `
        <details class="fr-turn">
          <summary><strong>Turn ${turn.turnNumber}</strong> • Order ${turn.order} • ${formatDuration(turn.durationMs)} • ${formatTokens(turnTokens)} tokens${patchInfo}${rejectedInfo}</summary>
          <div class="fr-turn__content">
            ${turn.toolCalls.length > 0 ? `<ul class="fr-turn__tools">${toolCallsList}</ul>` : '<span class="fr-turn__tool">No tool calls</span>'}
          </div>
        </details>
      `;
      })
      .join('');

    timelineSection = `
      <details class="fr-details fr-section">
        <summary>Turn Details (${timeline.length} turns)</summary>
        <div style="margin-top: 8px;">${timelineItems}</div>
      </details>
    `;
  }

  // Raw YAML section with copy functionality (handler defined in main page script)
  const yamlContent = YAML.stringify(record, { lineWidth: 0 });

  const rawSection = `
    <details class="fr-details fr-section">
      <summary>Raw YAML</summary>
      <div class="fr-raw" style="margin-top: 8px;">
        <button class="fr-copy-btn" onclick="frCopyYaml(this)">Copy</button>
        ${renderYamlContent(yamlContent)}
      </div>
    </details>
  `;

  // Tooltip element - functions are defined in main page script
  const tooltipHtml = `<div id="fr-tooltip" class="fr-tooltip"></div>`;

  return `
    ${FILL_RECORD_STYLES}
    ${tooltipHtml}
    <div class="fr-dashboard">
      ${headerInfo}
      ${statusBanner}
      ${summaryCards}
      ${progressBar}
      ${timingSection}
      ${toolSection}
      ${timelineSection}
      ${rawSection}
    </div>
  `;
}
