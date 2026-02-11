/**
 * Content-only HTML renderers for form views and syntax-highlighted content.
 *
 * These produce HTML fragments (no page shell) suitable for embedding.
 * No CLI or server dependencies.
 */

import type { Field, FieldValue, ParsedForm } from '../engine/coreTypes.js';
import { friendlyUrlAbbrev, formatBareUrlsAsHtmlLinks } from '../utils/urlFormat.js';
import { escapeHtml } from './renderUtils.js';

// =============================================================================
// View Content Renderer
// =============================================================================

/**
 * Format a checkbox state for display.
 */
function formatCheckboxState(state: string): string {
  switch (state) {
    case 'done':
      return '<span class="checkbox checked">☑</span>';
    case 'todo':
      return '<span class="checkbox unchecked">☐</span>';
    case 'active':
      return '<span class="state-badge state-active">●</span>';
    case 'incomplete':
      return '<span class="state-badge state-incomplete">○</span>';
    case 'na':
      return '<span class="state-badge state-na">—</span>';
    case 'yes':
      return '<span class="checkbox checked">☑</span>';
    case 'no':
      return '<span class="checkbox unchecked">☐</span>';
    case 'unfilled':
      return '<span class="state-badge state-unfilled">?</span>';
    default:
      return `<span class="state-badge">${escapeHtml(state)}</span>`;
  }
}

/**
 * Render a field value for the View tab.
 */
function renderViewFieldValue(
  field: Field,
  value: FieldValue | undefined,
  isSkipped: boolean,
  skipReason?: string,
): string {
  if (isSkipped) {
    const reasonText = skipReason ? `(skipped: ${escapeHtml(skipReason)})` : '(skipped)';
    return `<div class="view-field-empty">${reasonText}</div>`;
  }

  if (value === undefined) {
    return '<div class="view-field-empty">(not filled)</div>';
  }

  switch (field.kind) {
    case 'string': {
      const v = value.kind === 'string' ? value.value : null;
      if (v === null || v === '') {
        return '<div class="view-field-empty">(not filled)</div>';
      }
      // Auto-link bare URLs in string content for consistency with URL fields
      const formatted = formatBareUrlsAsHtmlLinks(v, escapeHtml);
      return `<div class="view-field-value">${formatted}</div>`;
    }
    case 'number': {
      const v = value.kind === 'number' ? value.value : null;
      if (v === null) {
        return '<div class="view-field-empty">(not filled)</div>';
      }
      return `<div class="view-field-value">${v}</div>`;
    }
    case 'string_list': {
      const items = value.kind === 'string_list' ? value.items : [];
      if (items.length === 0) {
        return '<div class="view-field-empty">(not filled)</div>';
      }
      // Auto-link bare URLs in string list items
      return `<div class="view-field-value"><ul>${items.map((i) => `<li>${formatBareUrlsAsHtmlLinks(i, escapeHtml)}</li>`).join('')}</ul></div>`;
    }
    case 'single_select': {
      const selected = value.kind === 'single_select' ? value.selected : null;
      if (selected === null) {
        return '<div class="view-field-empty">(not filled)</div>';
      }
      const opt = field.options.find((o) => o.id === selected);
      return `<div class="view-field-value">${escapeHtml(opt?.label ?? selected)}</div>`;
    }
    case 'multi_select': {
      const selected = value.kind === 'multi_select' ? value.selected : [];
      // Show all options with selection state
      const items = field.options.map((opt) => {
        const isSelected = selected.includes(opt.id);
        const checkbox = isSelected
          ? '<span class="checkbox checked">☑</span>'
          : '<span class="checkbox unchecked">☐</span>';
        return `<li class="checkbox-item">${checkbox} ${escapeHtml(opt.label)}</li>`;
      });
      return `<div class="view-field-value"><ul class="checkbox-list">${items.join('')}</ul></div>`;
    }
    case 'checkboxes': {
      const values = value.kind === 'checkboxes' ? value.values : {};
      const mode = field.checkboxMode ?? 'multi';
      // Show all options with their state
      const items = field.options.map((opt) => {
        const state = values[opt.id] ?? (mode === 'explicit' ? 'unfilled' : 'todo');
        // For simple mode, use checkbox symbols
        if (mode === 'simple') {
          const checkbox =
            state === 'done'
              ? '<span class="checkbox checked">☑</span>'
              : '<span class="checkbox unchecked">☐</span>';
          return `<li class="checkbox-item">${checkbox} ${escapeHtml(opt.label)}</li>`;
        }
        // For multi/explicit modes, show state text since there are multiple states
        const stateDisplay = formatCheckboxState(state);
        return `<li class="checkbox-item">${stateDisplay} ${escapeHtml(opt.label)}</li>`;
      });
      return `<div class="view-field-value"><ul class="checkbox-list">${items.join('')}</ul></div>`;
    }
    case 'url': {
      const v = value.kind === 'url' ? value.value : null;
      if (v === null || v === '') {
        return '<div class="view-field-empty">(not filled)</div>';
      }
      const domain = friendlyUrlAbbrev(v);
      return `<div class="view-field-value"><a href="${escapeHtml(v)}" target="_blank" class="url-link" data-url="${escapeHtml(v)}">${escapeHtml(domain)}</a></div>`;
    }
    case 'url_list': {
      const items = value.kind === 'url_list' ? value.items : [];
      if (items.length === 0) {
        return '<div class="view-field-empty">(not filled)</div>';
      }
      return `<div class="view-field-value"><ul>${items
        .map((u) => {
          const domain = friendlyUrlAbbrev(u);
          return `<li><a href="${escapeHtml(u)}" target="_blank" class="url-link" data-url="${escapeHtml(u)}">${escapeHtml(domain)}</a></li>`;
        })
        .join('')}</ul></div>`;
    }
    case 'date': {
      const v = value.kind === 'date' ? value.value : null;
      if (v === null || v === '') {
        return '<div class="view-field-empty">(not filled)</div>';
      }
      return `<div class="view-field-value">${escapeHtml(v)}</div>`;
    }
    case 'year': {
      const v = value.kind === 'year' ? value.value : null;
      if (v === null) {
        return '<div class="view-field-empty">(not filled)</div>';
      }
      return `<div class="view-field-value">${v}</div>`;
    }
    case 'table': {
      const rows = value.kind === 'table' ? value.rows : [];
      if (rows.length === 0) {
        return '<div class="view-field-empty">(no data)</div>';
      }
      let tableHtml = '<div class="table-container"><table class="data-table">';
      tableHtml += '<thead><tr>';
      for (const col of field.columns) {
        tableHtml += `<th>${escapeHtml(col.label)}</th>`;
      }
      tableHtml += '</tr></thead><tbody>';
      for (const row of rows) {
        tableHtml += '<tr>';
        for (const col of field.columns) {
          const cell = row[col.id];
          let cellValue = '';
          let cellHtml = '';
          if (cell?.state === 'answered' && cell.value !== undefined && cell.value !== null) {
            cellValue = String(cell.value);
            // Format URL columns as domain links
            if (col.type === 'url' && cellValue) {
              const domain = friendlyUrlAbbrev(cellValue);
              cellHtml = `<a href="${escapeHtml(cellValue)}" target="_blank" class="url-link" data-url="${escapeHtml(cellValue)}">${escapeHtml(domain)}</a>`;
            } else {
              // Auto-link bare URLs in non-URL columns for consistency
              cellHtml = formatBareUrlsAsHtmlLinks(cellValue, escapeHtml);
            }
          }
          tableHtml += `<td>${cellHtml}</td>`;
        }
        tableHtml += '</tr>';
      }
      tableHtml += '</tbody></table></div>';
      return tableHtml;
    }
    default: {
      const _exhaustive: never = field;
      throw new Error(`Unhandled field kind: ${(_exhaustive as { kind: string }).kind}`);
    }
  }
}

/**
 * Render form view content (read-only display of form fields).
 * Used for View tab content.
 */
export function renderViewContent(form: ParsedForm): string {
  const { schema, responsesByFieldId } = form;
  let html = '<div class="view-content">';

  for (const group of schema.groups) {
    const groupTitle = group.title ?? group.id;
    html += `<div class="view-group"><h2>${escapeHtml(groupTitle)}</h2>`;

    for (const field of group.children) {
      const response = responsesByFieldId[field.id];
      const value = response?.state === 'answered' ? response.value : undefined;
      const isSkipped = response?.state === 'skipped';
      const skipReason = isSkipped ? response?.reason : undefined;

      html += '<div class="view-field">';
      html += `<div class="view-field-label">${escapeHtml(field.label)}`;
      html += ` <span class="type-badge">${field.kind}</span>`;
      if (field.required) {
        html += ' <span class="required">*</span>';
      }
      if (isSkipped) {
        html += ` <span class="skipped-badge">Skipped</span>`;
      }
      html += '</div>';

      // Render value based on field type
      html += renderViewFieldValue(field, value, isSkipped, skipReason);
      html += '</div>';
    }

    html += '</div>';
  }

  html += '</div>';
  return html;
}

// =============================================================================
// Source Content Renderer
// =============================================================================

/**
 * Highlight a single line of source code (Markdown + Jinja).
 */
function highlightSourceLine(line: string): string {
  // First escape HTML
  let result = escapeHtml(line);

  // Highlight Jinja tags: {% tag %}, {% /tag %}, {# comment #}
  // Match {% ... %} patterns
  result = result.replace(
    /(\{%\s*)([a-zA-Z_/]+)(\s+[^%]*)?(%\})/g,
    (_: string, open: string, keyword: string, attrs: string | undefined, close: string) => {
      let attrHtml = '';
      if (attrs) {
        // Highlight attributes within the tag
        attrHtml = attrs.replace(
          /([a-zA-Z_]+)(=)("[^"]*"|&#039;[^&#]*&#039;|[^\s%]+)?/g,
          (_m: string, attrName: string, eq: string, attrValue: string) => {
            const valueHtml = attrValue ? `<span class="syn-jinja-value">${attrValue}</span>` : '';
            return `<span class="syn-jinja-attr">${attrName}</span>${eq}${valueHtml}`;
          },
        );
      }
      return `<span class="syn-jinja-tag">${open}</span><span class="syn-jinja-keyword">${keyword}</span>${attrHtml}<span class="syn-jinja-tag">${close}</span>`;
    },
  );

  // Highlight Jinja comments: {# ... #}
  result = result.replace(/(\{#)(.*?)(#\})/g, `<span class="syn-comment">$1$2$3</span>`);

  // Highlight Markdown headers
  result = result.replace(/^(#{1,6}\s.*)$/gm, '<span class="syn-md-header">$1</span>');

  // Highlight YAML frontmatter markers
  if (result === '---') {
    result = '<span class="syn-comment">---</span>';
  }

  return result;
}

/**
 * Render source content with Markdown and Jinja syntax highlighting.
 * Used for Source tab content.
 */
export function renderSourceContent(content: string): string {
  const lines = content.split('\n');
  const highlighted = lines.map((line) => highlightSourceLine(line)).join('\n');
  return `<pre>${highlighted}</pre>`;
}

// =============================================================================
// Markdown Content Renderer
// =============================================================================

/**
 * Format inline markdown (bold, italic, code, links, checkboxes).
 * Also auto-links bare URLs for consistency.
 */
function formatInlineMarkdown(text: string): string {
  let result = escapeHtml(text);
  // Checkboxes - render before other formatting to avoid conflicts
  // Checked checkbox [x] or [X]
  result = result.replace(/\[x\]/gi, '<span class="checkbox checked">☑</span>');
  // Unchecked checkbox [ ]
  result = result.replace(/\[ \]/g, '<span class="checkbox unchecked">☐</span>');
  // Inline code
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Links - need to unescape the URL first
  // Add url-link class and data-url for copy tooltip support
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_: string, linkText: string, url: string) => {
      const cleanUrl = url.replace(/&amp;/g, '&');
      return `<a href="${cleanUrl}" target="_blank" class="url-link" data-url="${cleanUrl}">${linkText}</a>`;
    },
  );
  // Auto-link bare URLs (not already in <a> tags or markdown links)
  // Uses negative lookbehind to skip URLs that are:
  // - Inside href="" or data-url="" attributes
  // - Inside anchor tag content (preceded by ">)
  // - Part of markdown link syntax ](
  result = result.replace(
    /(?<!href="|data-url="|">|\]\()(?:https?:\/\/|www\.)[^\s<>"]+(?<![.,;:!?'")])/g,
    (url: string) => {
      // Unescape &amp; back to & for the URL
      const cleanUrl = url.replace(/&amp;/g, '&');
      const fullUrl = cleanUrl.startsWith('www.') ? `https://${cleanUrl}` : cleanUrl;
      const display = friendlyUrlAbbrev(fullUrl);
      return `<a href="${escapeHtml(fullUrl)}" target="_blank" class="url-link" data-url="${escapeHtml(fullUrl)}">${escapeHtml(display)}</a>`;
    },
  );
  return result;
}

/**
 * Render markdown content (content only, no page wrapper).
 * Used for tab content.
 */
export function renderMarkdownContent(content: string): string {
  const lines = content.split('\n');
  let html = '<div class="markdown-content">';
  let inParagraph = false;
  let inCodeBlock = false;
  let codeBlockContent = '';
  let inUnorderedList = false;
  let inOrderedList = false;
  let inTable = false;
  let tableHeaderDone = false;

  // Helper to close any open list
  const closeList = () => {
    if (inUnorderedList) {
      html += '</ul>';
      inUnorderedList = false;
    }
    if (inOrderedList) {
      html += '</ol>';
      inOrderedList = false;
    }
  };

  // Helper to close table
  const closeTable = () => {
    if (inTable) {
      html += '</tbody></table></div>';
      inTable = false;
      tableHeaderDone = false;
    }
  };

  // Helper to detect if a line is a table row
  const isTableRow = (line: string): boolean => {
    const trimmed = line.trim();
    return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|');
  };

  // Helper to detect table separator line (| --- | --- |)
  const isTableSeparator = (line: string): boolean => {
    const trimmed = line.trim();
    return /^\|[\s-:|]+\|$/.test(trimmed);
  };

  // Helper to parse table cells
  const parseTableCells = (line: string): string[] => {
    const trimmed = line.trim();
    // Remove leading and trailing pipes, then split by pipes
    const cellContent = trimmed.slice(1, -1);
    return cellContent.split('|').map((cell) => cell.trim());
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Handle fenced code blocks
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        html += `<pre><code>${escapeHtml(codeBlockContent.trim())}</code></pre>`;
        codeBlockContent = '';
        inCodeBlock = false;
      } else {
        // Start code block
        if (inParagraph) {
          html += '</p>';
          inParagraph = false;
        }
        closeList();
        closeTable();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent += line + '\n';
      continue;
    }

    // Handle table rows
    if (isTableRow(trimmed)) {
      if (inParagraph) {
        html += '</p>';
        inParagraph = false;
      }
      closeList();

      // Skip separator line but mark header as done
      if (isTableSeparator(trimmed)) {
        tableHeaderDone = true;
        continue;
      }

      const cells = parseTableCells(trimmed);

      if (!inTable) {
        // Start new table with header
        html += '<div class="table-container"><table class="data-table"><thead><tr>';
        for (const cell of cells) {
          html += `<th>${formatInlineMarkdown(cell)}</th>`;
        }
        html += '</tr></thead><tbody>';
        inTable = true;
      } else if (tableHeaderDone) {
        // Regular table row
        html += '<tr>';
        for (const cell of cells) {
          html += `<td>${formatInlineMarkdown(cell)}</td>`;
        }
        html += '</tr>';
      }
      continue;
    }

    // Close table if we hit a non-table line
    if (inTable && !isTableRow(trimmed)) {
      closeTable();
    }

    // Handle headers
    if (trimmed.startsWith('# ')) {
      if (inParagraph) {
        html += '</p>';
        inParagraph = false;
      }
      closeList();
      html += `<h2>${formatInlineMarkdown(trimmed.slice(2))}</h2>`;
    } else if (trimmed.startsWith('## ')) {
      if (inParagraph) {
        html += '</p>';
        inParagraph = false;
      }
      closeList();
      html += `<h3>${formatInlineMarkdown(trimmed.slice(3))}</h3>`;
    } else if (trimmed.startsWith('### ')) {
      if (inParagraph) {
        html += '</p>';
        inParagraph = false;
      }
      closeList();
      html += `<h4>${formatInlineMarkdown(trimmed.slice(4))}</h4>`;
    } else if (trimmed.startsWith('#### ')) {
      if (inParagraph) {
        html += '</p>';
        inParagraph = false;
      }
      closeList();
      html += `<h5>${formatInlineMarkdown(trimmed.slice(5))}</h5>`;
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      // Unordered list item
      if (inParagraph) {
        html += '</p>';
        inParagraph = false;
      }
      if (inOrderedList) {
        html += '</ol>';
        inOrderedList = false;
      }
      if (!inUnorderedList) {
        html += '<ul>';
        inUnorderedList = true;
      }
      const itemContent = trimmed.slice(2);
      // If item starts with checkbox, use no-bullet class
      const hasCheckbox = /^\[[ xX]\]/.test(itemContent);
      const liClass = hasCheckbox ? ' class="checkbox-item"' : '';
      html += `<li${liClass}>${formatInlineMarkdown(itemContent)}</li>`;
    } else if (/^\d+\.\s/.test(trimmed)) {
      // Ordered list item
      if (inParagraph) {
        html += '</p>';
        inParagraph = false;
      }
      if (inUnorderedList) {
        html += '</ul>';
        inUnorderedList = false;
      }
      if (!inOrderedList) {
        html += '<ol>';
        inOrderedList = true;
      }
      const text = trimmed.replace(/^\d+\.\s/, '');
      html += `<li>${formatInlineMarkdown(text)}</li>`;
    } else if (trimmed === '') {
      if (inParagraph) {
        html += '</p>';
        inParagraph = false;
      }
      closeList();
    } else {
      closeList();
      if (!inParagraph) {
        html += '<p>';
        inParagraph = true;
      } else {
        html += '<br>';
      }
      html += formatInlineMarkdown(trimmed);
    }
  }

  if (inParagraph) {
    html += '</p>';
  }
  closeList();
  closeTable();

  html += '</div>';
  return html;
}

// =============================================================================
// Syntax-Highlighted Content Renderers
// =============================================================================

/**
 * Highlight a YAML value with appropriate syntax class.
 */
export function highlightYamlValue(value: string): string {
  const trimmed = value.trim();
  // Booleans
  if (trimmed === 'true' || trimmed === 'false') {
    return `<span class="syn-bool">${escapeHtml(value)}</span>`;
  }
  // Null
  if (trimmed === 'null' || trimmed === '~') {
    return `<span class="syn-null">${escapeHtml(value)}</span>`;
  }
  // Numbers
  if (/^-?\d+\.?\d*$/.test(trimmed)) {
    return `<span class="syn-number">${escapeHtml(value)}</span>`;
  }
  // Quoted strings
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return `<span class="syn-string">${escapeHtml(value)}</span>`;
  }
  // Unquoted strings (treat as string)
  return `<span class="syn-string">${escapeHtml(value)}</span>`;
}

/**
 * Render YAML content with syntax highlighting (content only, no page wrapper).
 * Used for tab content.
 */
export function renderYamlContent(content: string): string {
  const highlighted = content
    .split('\n')
    .map((line) => {
      if (line.trim().startsWith('#')) {
        return `<span class="syn-comment">${escapeHtml(line)}</span>`;
      }
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0 && !line.trim().startsWith('-')) {
        const key = escapeHtml(line.slice(0, colonIndex));
        const afterColon = line.slice(colonIndex + 1).trim();
        const colonAndSpace = escapeHtml(line.slice(colonIndex, colonIndex + 1));
        if (afterColon === '') {
          return `<span class="syn-key">${key}</span>${colonAndSpace}`;
        }
        const valueStart = line.indexOf(afterColon, colonIndex);
        const beforeValue = escapeHtml(line.slice(colonIndex, valueStart));
        const value = highlightYamlValue(afterColon);
        return `<span class="syn-key">${key}</span>${beforeValue}${value}`;
      }
      if (line.trim().startsWith('-')) {
        const dashIndex = line.indexOf('-');
        const beforeDash = escapeHtml(line.slice(0, dashIndex));
        const afterDash = line.slice(dashIndex + 1).trim();
        if (afterDash === '') {
          return `${beforeDash}-`;
        }
        return `${beforeDash}- ${highlightYamlValue(afterDash)}`;
      }
      return escapeHtml(line);
    })
    .join('\n');

  return `<pre>${highlighted}</pre>`;
}

/**
 * Render JSON content with syntax highlighting (content only, no page wrapper).
 * Used for tab content.
 */
export function renderJsonContent(content: string): string {
  let formatted: string;
  try {
    const parsed = JSON.parse(content) as unknown;
    formatted = JSON.stringify(parsed, null, 2);
  } catch {
    formatted = content;
  }

  const highlighted = formatted
    .replace(/"([^"]+)":/g, '<span class="syn-key">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span class="syn-string">"$1"</span>')
    .replace(/: (-?\d+\.?\d*)/g, ': <span class="syn-number">$1</span>')
    .replace(/: (true|false)/g, ': <span class="syn-bool">$1</span>')
    .replace(/: (null)/g, ': <span class="syn-null">$1</span>');

  return `<pre>${highlighted}</pre>`;
}
