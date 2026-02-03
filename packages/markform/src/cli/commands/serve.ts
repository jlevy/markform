/**
 * Serve command - Serve a form as a web page for browsing.
 *
 * Starts an HTTP server that renders the form as interactive HTML.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Command } from 'commander';

import { exec } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile as readFileAsync } from 'node:fs/promises';
import { createServer } from 'node:http';
import { basename, resolve } from 'node:path';

import pc from 'picocolors';
import YAML from 'yaml';

import { applyPatches } from '../../engine/apply.js';
import { parseForm } from '../../engine/parse.js';
import { formToJsonSchema } from '../../engine/jsonSchema.js';
import { serializeForm, serializeReport } from '../../engine/serialize.js';
import type { FillRecord } from '../../harness/fillRecord.js';
import { toNotesArray, toStructuredValues } from '../lib/exportHelpers.js';
import {
  DEFAULT_PORT,
  deriveFillRecordPath,
  detectFileType,
  type FileType,
} from '../../settings.js';
import type {
  CheckboxesField,
  CheckboxesValue,
  DateField,
  Field,
  FieldGroup,
  FieldValue,
  MultiSelectField,
  MultiSelectValue,
  NumberField,
  Patch,
  ParsedForm,
  SingleSelectField,
  SingleSelectValue,
  StringField,
  StringListField,
  TableField,
  TableValue,
  UrlField,
  UrlListField,
  YearField,
} from '../../engine/coreTypes.js';
import {
  type CommandContext,
  getCommandContext,
  logError,
  logInfo,
  logVerbose,
  readFile,
  writeFile,
} from '../lib/shared.js';
import { generateVersionedPath } from '../lib/versioning.js';
import { friendlyUrlAbbrev, formatBareUrlsAsHtmlLinks } from '../../utils/urlFormat.js';

/**
 * Open a URL in the default browser (cross-platform).
 */
function openBrowser(url: string): void {
  const platform = process.platform;

  let command: string;
  if (platform === 'darwin') {
    command = `open "${url}"`;
  } else if (platform === 'win32') {
    command = `start "" "${url}"`;
  } else {
    // Linux and other Unix-like systems
    command = `xdg-open "${url}"`;
  }

  exec(command, (error) => {
    if (error) {
      // Silently ignore - user can still open URL manually
    }
  });
}

// =============================================================================
// Tab Configuration
// =============================================================================

/** Represents a tab for navigation */
interface Tab {
  id: 'view' | 'form' | 'source' | 'report' | 'values' | 'schema' | 'fill-record';
  label: string;
  path: string | null; // Source file path (for source tab) or null for dynamically generated
}

/**
 * Build tabs for a form file.
 * All tabs are always present - content is generated dynamically from the form.
 * Tab order: View, Edit, Source, Report, Values, Schema, Fill Record (if sidecar exists)
 */
function buildFormTabs(formPath: string): Tab[] {
  const tabs: Tab[] = [
    { id: 'view', label: 'View', path: null }, // Generated from form
    { id: 'form', label: 'Edit', path: formPath }, // Interactive editor
    { id: 'source', label: 'Source', path: formPath }, // Form source
    { id: 'report', label: 'Report', path: null }, // Generated from form
    { id: 'values', label: 'Values', path: null }, // Generated from form
    { id: 'schema', label: 'Schema', path: null }, // Generated from form
  ];

  // Add Fill Record tab if sidecar file exists
  const sidecarPath = deriveFillRecordPath(formPath);
  if (existsSync(sidecarPath)) {
    tabs.push({ id: 'fill-record', label: 'Fill Record', path: sidecarPath });
  }

  return tabs;
}

/**
 * Register the serve command.
 */
export function registerServeCommand(program: Command): void {
  program
    .command('serve <file>')
    .description('Serve a file as a web page (forms are interactive, others are read-only)')
    .option('-p, --port <port>', 'Port to serve on', String(DEFAULT_PORT))
    .option('--no-open', "Don't open browser automatically")
    .action(async (file: string, options: { port?: string; open?: boolean }, cmd: Command) => {
      const ctx = getCommandContext(cmd);
      const port = parseInt(options.port ?? String(DEFAULT_PORT), 10);
      const filePath = resolve(file);
      const fileType = detectFileType(filePath);

      try {
        logVerbose(ctx, `Reading file: ${filePath}`);
        const content = await readFile(filePath);

        // For form files, parse and track state
        let form: ParsedForm | null = null;
        if (fileType === 'form') {
          form = parseForm(content);
        }

        // Build tabs for form files (all tabs are generated dynamically)
        const tabs = fileType === 'form' ? buildFormTabs(filePath) : null;

        // Start the server
        const server = createServer((req: IncomingMessage, res: ServerResponse) => {
          handleRequest(req, res, filePath, fileType, form, ctx, tabs, (updatedForm) => {
            form = updatedForm;
          }).catch((err) => {
            console.error('Request error:', err);
            res.writeHead(500);
            res.end('Internal Server Error');
          });
        });

        server.listen(port, () => {
          const url = `http://localhost:${port}`;
          const typeLabel =
            fileType === 'form' ? 'Form' : fileType === 'unknown' ? 'File' : fileType.toUpperCase();
          logInfo(ctx, pc.green(`\n✓ ${typeLabel} server running at ${pc.bold(url)}\n`));
          logInfo(ctx, pc.dim('Press Ctrl+C to stop\n'));

          // Open browser by default unless --no-open is specified
          if (options.open !== false) {
            openBrowser(url);
          }
        });

        // Handle graceful shutdown
        process.on('SIGINT', () => {
          logInfo(ctx, '\nShutting down server...');
          server.close();
          process.exit(0);
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError(message);
        process.exit(1);
      }
    });
}

/**
 * Handle HTTP requests.
 * Dispatches to appropriate renderer based on file type.
 */
async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  filePath: string,
  fileType: FileType,
  form: ParsedForm | null,
  ctx: CommandContext,
  tabs: Tab[] | null,
  updateForm: (form: ParsedForm) => void,
): Promise<void> {
  const url = req.url ?? '/';

  // Handle tab content requests for form files with tabs
  if (req.method === 'GET' && url.startsWith('/tab/') && tabs && tabs.length > 1) {
    const tabId = url.slice(5) as Tab['id'];
    const tab = tabs.find((t) => t.id === tabId);

    // Handle special tabs that need the parsed form or source content
    if (tabId === 'view' && form) {
      const html = renderViewContent(form);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    if (tabId === 'source' && tab?.path) {
      const content = await readFileAsync(tab.path, 'utf-8');
      const html = renderSourceContent(content);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    // Report tab - generate dynamically from form
    if (tabId === 'report' && form) {
      const reportContent = serializeReport(form);
      const html = renderMarkdownContent(reportContent);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    // Values tab - generate dynamically from form
    if (tabId === 'values' && form) {
      const values = toStructuredValues(form);
      const notes = toNotesArray(form);
      const exportData = {
        values,
        ...(notes.length > 0 && { notes }),
      };
      const yamlContent = YAML.stringify(exportData);
      const html = renderYamlContent(yamlContent);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    // Schema tab - generate dynamically from form
    if (tabId === 'schema' && form) {
      const result = formToJsonSchema(form);
      const jsonContent = JSON.stringify(result.schema, null, 2);
      const html = renderJsonContent(jsonContent);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    // Fill Record tab - load and render fill record sidecar
    if (tabId === 'fill-record' && tab?.path) {
      try {
        const content = await readFileAsync(tab.path, 'utf-8');
        const fillRecord = JSON.parse(content) as FillRecord;
        const html = renderFillRecordContent(fillRecord);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Error loading fill record: ${message}`);
        return;
      }
    }

    res.writeHead(404);
    res.end('Tab not found');
    return;
  }

  if (req.method === 'GET' && url === '/') {
    // Dispatch to appropriate renderer based on file type
    if (fileType === 'form' && form) {
      const html = renderFormHtml(form, tabs);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } else if (fileType === 'raw' || fileType === 'report') {
      const content = await readFileAsync(filePath, 'utf-8');
      const html = renderMarkdownHtml(content, basename(filePath));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } else if (fileType === 'yaml') {
      const content = await readFileAsync(filePath, 'utf-8');
      const html = renderYamlHtml(content, basename(filePath));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } else if (fileType === 'json' || fileType === 'schema') {
      const content = await readFileAsync(filePath, 'utf-8');
      const html = renderJsonHtml(content, basename(filePath));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } else {
      // Unknown file type - show as plain text
      const content = await readFileAsync(filePath, 'utf-8');
      const html = renderPlainTextHtml(content, basename(filePath));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    }
  } else if (req.method === 'POST' && url === '/save' && fileType === 'form' && form) {
    // Save the form to a new versioned file
    await handleSave(req, res, form, filePath, ctx, updateForm);
  } else if (url === '/api/form' && form) {
    // API endpoint for form data
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ schema: form.schema }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
}

/**
 * Parse form body data.
 */
function parseFormBody(body: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  const params = new URLSearchParams(body);

  for (const [key, value] of params) {
    const existing = result[key];
    if (existing !== undefined) {
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        result[key] = [existing, value];
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Convert form data to patches.
 */
function formDataToPatches(formData: Record<string, string | string[]>, form: ParsedForm): Patch[] {
  const patches: Patch[] = [];
  const fields = form.schema.groups.flatMap((g) => g.children);

  for (const field of fields) {
    const fieldId = field.id;

    // Check if this field was explicitly skipped
    const skipKey = `__skip__${fieldId}`;
    if (formData[skipKey] === '1' && !field.required) {
      patches.push({ op: 'skip_field', fieldId, role: 'user' });
      continue; // Don't process other patches for this field
    }

    switch (field.kind) {
      case 'string': {
        const value = formData[fieldId];
        if (typeof value === 'string' && value.trim() !== '') {
          patches.push({ op: 'set_string', fieldId, value: value.trim() });
        } else if (!value || (typeof value === 'string' && value.trim() === '')) {
          patches.push({ op: 'clear_field', fieldId });
        }
        break;
      }

      case 'number': {
        const value = formData[fieldId];
        if (typeof value === 'string' && value.trim() !== '') {
          const num = parseFloat(value);
          if (!isNaN(num)) {
            patches.push({ op: 'set_number', fieldId, value: num });
          }
        } else {
          patches.push({ op: 'clear_field', fieldId });
        }
        break;
      }

      case 'string_list': {
        const value = formData[fieldId];
        if (typeof value === 'string' && value.trim() !== '') {
          const items = value
            .split('\n')
            .map((s) => s.trim())
            .filter((s) => s !== '');
          if (items.length > 0) {
            patches.push({ op: 'set_string_list', fieldId, value: items });
          } else {
            patches.push({ op: 'clear_field', fieldId });
          }
        } else {
          patches.push({ op: 'clear_field', fieldId });
        }
        break;
      }

      case 'single_select': {
        const value = formData[fieldId];
        if (typeof value === 'string' && value !== '') {
          patches.push({ op: 'set_single_select', fieldId, value });
        } else {
          patches.push({ op: 'clear_field', fieldId });
        }
        break;
      }

      case 'multi_select': {
        const value = formData[fieldId];
        const selected = Array.isArray(value) ? value : value ? [value] : [];
        if (selected.length > 0 && selected[0] !== '') {
          patches.push({ op: 'set_multi_select', fieldId, value: selected });
        } else {
          patches.push({ op: 'clear_field', fieldId });
        }
        break;
      }

      case 'checkboxes': {
        const mode = field.checkboxMode ?? 'multi';

        if (mode === 'simple') {
          // Simple mode: checkboxes send their value when checked
          const value = formData[fieldId];
          const checked = Array.isArray(value) ? value : value ? [value] : [];

          const checkboxValues: Record<string, 'done' | 'todo'> = {};
          for (const opt of field.options) {
            checkboxValues[opt.id] = checked.includes(opt.id) ? 'done' : 'todo';
          }
          patches.push({ op: 'set_checkboxes', fieldId, value: checkboxValues });
        } else {
          // Multi or explicit mode: each option has its own select
          const values: Record<string, string> = {};
          for (const opt of field.options) {
            const selectName = `${fieldId}.${opt.id}`;
            const selectValue = formData[selectName];
            if (typeof selectValue === 'string' && selectValue !== '') {
              values[opt.id] = selectValue;
            }
          }
          if (Object.keys(values).length > 0) {
            patches.push({
              op: 'set_checkboxes',
              fieldId,
              value: values as Record<
                string,
                'todo' | 'done' | 'active' | 'incomplete' | 'na' | 'yes' | 'no' | 'unfilled'
              >,
            });
          }
        }
        break;
      }

      case 'url': {
        const value = formData[fieldId];
        if (typeof value === 'string' && value.trim() !== '') {
          patches.push({ op: 'set_url', fieldId, value: value.trim() });
        } else {
          patches.push({ op: 'clear_field', fieldId });
        }
        break;
      }

      case 'url_list': {
        const value = formData[fieldId];
        if (typeof value === 'string' && value.trim() !== '') {
          const items = value
            .split('\n')
            .map((s) => s.trim())
            .filter((s) => s !== '');
          if (items.length > 0) {
            patches.push({ op: 'set_url_list', fieldId, value: items });
          } else {
            patches.push({ op: 'clear_field', fieldId });
          }
        } else {
          patches.push({ op: 'clear_field', fieldId });
        }
        break;
      }

      case 'date': {
        const value = formData[fieldId];
        if (typeof value === 'string' && value.trim() !== '') {
          patches.push({ op: 'set_date', fieldId, value: value.trim() });
        } else {
          patches.push({ op: 'clear_field', fieldId });
        }
        break;
      }

      case 'year': {
        const value = formData[fieldId];
        if (typeof value === 'string' && value.trim() !== '') {
          const num = parseInt(value, 10);
          if (!isNaN(num)) {
            patches.push({ op: 'set_year', fieldId, value: num });
          }
        } else {
          patches.push({ op: 'clear_field', fieldId });
        }
        break;
      }

      case 'table': {
        // Table fields are read-only in the web UI for now
        // Table editing would require a more complex UI (add/remove rows, cell editing)
        break;
      }

      default: {
        // Exhaustiveness check - TypeScript will error if a case is missing
        const _exhaustive: never = field;
        throw new Error(`Unhandled field kind: ${(_exhaustive as { kind: string }).kind}`);
      }
    }
  }

  return patches;
}

/**
 * Handle form save request.
 */
async function handleSave(
  req: IncomingMessage,
  res: ServerResponse,
  form: ParsedForm,
  filePath: string,
  ctx: CommandContext,
  updateForm: (form: ParsedForm) => void,
): Promise<void> {
  try {
    // Read request body
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    const body = Buffer.concat(chunks).toString('utf-8');

    // Parse form data
    const formData = parseFormBody(body);

    // Convert to patches
    const patches = formDataToPatches(formData, form);

    // Apply patches (mutates form in place)
    applyPatches(form, patches);

    // Update the in-memory form reference
    updateForm(form);

    // Generate versioned filename
    const newPath = generateVersionedPath(filePath);

    // Serialize the form
    const content = serializeForm(form);

    if (ctx.dryRun) {
      logInfo(ctx, `[DRY RUN] Would save to: ${newPath}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, path: newPath, dryRun: true }));
      return;
    }

    // Write the file
    await writeFile(newPath, content);
    logInfo(ctx, pc.green(`Saved to: ${newPath}`));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, path: newPath }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: message }));
  }
}

/**
 * Render the form as HTML.
 * @public Exported for testing.
 */
export function renderFormHtml(form: ParsedForm, tabs?: Tab[] | null): string {
  const { schema, responsesByFieldId } = form;
  const formTitle = schema.title ?? schema.id;

  const groupsHtml = schema.groups
    .map((group) => renderGroup(group, responsesByFieldId))
    .join('\n');

  // Build tab bar HTML if we have multiple tabs
  const showTabs = tabs && tabs.length > 1;
  const tabBarHtml = showTabs
    ? `<div class="tab-bar">
        ${tabs
          .map(
            (tab, i) =>
              `<button class="tab-btn${i === 0 ? ' active' : ''}" data-tab="${tab.id}">${escapeHtml(tab.label)}</button>`,
          )
          .join('\n        ')}
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(formTitle)} - Markform</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      background: #f8f9fa;
      color: #212529;
    }
    h1 { color: #495057; border-bottom: none; padding-bottom: 0.5rem; }
    /* Tab bar styles */
    .tab-bar {
      display: flex;
      gap: 0.25rem;
      margin-bottom: 1.5rem;
      border-bottom: 2px solid #dee2e6;
      padding-bottom: 0;
    }
    .tab-btn {
      padding: 0.5rem 1rem;
      border: none;
      background: transparent;
      color: #6c757d;
      font-size: 0.95rem;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      transition: all 0.15s;
    }
    .tab-btn:hover {
      color: #495057;
    }
    .tab-btn.active {
      color: #0d6efd;
      border-bottom-color: #0d6efd;
      font-weight: 500;
    }
    .tab-content {
      display: none;
    }
    .tab-content.active {
      display: block;
    }
    /* Light theme syntax highlighting for tab content */
    .tab-content pre {
      background: #f8f9fa;
      color: #24292e;
      padding: 1rem;
      border-radius: 6px;
      border: 1px solid #e1e4e8;
      overflow-x: auto;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.9rem;
      line-height: 1.5;
    }
    .syn-key { color: #005cc5; }
    .syn-string { color: #22863a; }
    .syn-number { color: #005cc5; }
    .syn-bool { color: #d73a49; }
    .syn-null { color: #d73a49; }
    .syn-comment { color: #6a737d; font-style: italic; }
    /* Jinja/MarkDoc syntax highlighting */
    .syn-jinja-tag { color: #6f42c1; font-weight: 500; }
    .syn-jinja-keyword { color: #d73a49; }
    .syn-jinja-attr { color: #005cc5; }
    .syn-jinja-value { color: #22863a; }
    /* Markdown syntax highlighting */
    .syn-md-header { color: #005cc5; font-weight: 600; }
    .syn-md-bold { font-weight: 600; }
    .syn-md-italic { font-style: italic; }
    .syn-md-code { background: #f1f3f5; padding: 0.1em 0.3em; border-radius: 3px; }
    .syn-md-link { color: #0366d6; }
    .syn-md-list { color: #d73a49; }
    /* View tab styles */
    .view-content { padding: 0.5rem 0; }
    .view-group { background: white; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .view-group h2 { color: #6c757d; font-size: 1.25rem; margin-top: 0; }
    .view-field { margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid #e9ecef; }
    .view-field:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .view-field-label { font-weight: 600; color: #495057; margin-bottom: 0.25rem; }
    .view-field-value { color: #212529; }
    .view-field-empty { color: #adb5bd; font-style: italic; }
    /* Markdown content styles */
    .markdown-content { padding: 0.5rem 0; }
    .markdown-content h2 { font-size: 1.4rem; color: #24292e; margin: 1.5rem 0 0.75rem; }
    .markdown-content h3 { font-size: 1.2rem; color: #24292e; margin: 1.25rem 0 0.5rem; }
    .markdown-content h4 { font-size: 1.1rem; color: #24292e; margin: 1rem 0 0.5rem; }
    .markdown-content h5 { font-size: 1rem; color: #24292e; margin: 0.75rem 0 0.5rem; }
    .markdown-content p { margin: 0.75rem 0; line-height: 1.6; }
    .markdown-content li { margin: 0.25rem 0; margin-left: 1.5rem; line-height: 1.6; }
    .markdown-content li.checkbox-item { list-style: none; margin-left: 0; }
    .markdown-content code { background: #f1f3f5; padding: 0.2em 0.4em; border-radius: 3px; font-size: 0.9em; }
    .markdown-content pre { background: #f8f9fa; padding: 1rem; border-radius: 6px; border: 1px solid #e1e4e8; overflow-x: auto; }
    .markdown-content pre code { background: none; padding: 0; }
    .markdown-content a { color: #0366d6; text-decoration: none; }
    .markdown-content a:hover { text-decoration: underline; }
    .markdown-content strong { font-weight: 600; }
    /* URL link with hover copy */
    .url-link {
      color: #0366d6;
      text-decoration: none;
      position: relative;
    }
    .url-link:hover {
      text-decoration: underline;
    }
    .url-copy-tooltip {
      position: fixed;
      padding: 0.25rem 0.5rem;
      background: #6c757d;
      color: white;
      border-radius: 4px;
      font-size: 0.75rem;
      white-space: nowrap;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition: opacity 0.2s ease, visibility 0.2s ease, background 0.2s ease, transform 0.15s ease;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.25rem;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .url-copy-tooltip.visible {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }
    .url-copy-tooltip:hover {
      background: #343a40;
      transform: translateY(-50%) scale(1.02);
    }
    .url-copy-tooltip svg {
      width: 12px;
      height: 12px;
      transition: opacity 0.15s ease;
    }
    .url-copy-tooltip.copied {
      background: #28a745;
    }
    .url-copy-tooltip.copied:hover {
      background: #218838;
    }
    .url-copy-tooltip.transitioning {
      opacity: 0.7;
    }
    /* Checkbox and state styles */
    .checkbox { font-size: 1.1em; margin-right: 0.25em; }
    .checkbox.checked { color: #28a745; }
    .checkbox.unchecked { color: #6c757d; }
    .state-badge { display: inline-block; width: 1.1em; text-align: center; margin-right: 0.25em; font-weight: 600; }
    .state-badge.state-active { color: #0d6efd; }
    .state-badge.state-incomplete { color: #ffc107; }
    .state-badge.state-na { color: #6c757d; }
    .state-badge.state-unfilled { color: #adb5bd; }
    .checkbox-list { list-style: none; padding-left: 0; margin: 0.25rem 0; }
    .checkbox-list .checkbox-item { margin-left: 0; }
    .loading { text-align: center; padding: 2rem; color: #6c757d; }
    .error { text-align: center; padding: 2rem; color: #dc3545; }
    h2 { color: #6c757d; font-size: 1.25rem; }
    .group {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .field {
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #e9ecef;
    }
    .field:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .field-label {
      font-weight: 600;
      color: #495057;
      display: block;
      margin-bottom: 0.5rem;
    }
    .required { color: #dc3545; }
    .type-badge {
      font-size: 0.7rem;
      padding: 0.1rem 0.3rem;
      background: #e9ecef;
      border-radius: 3px;
      color: #6c757d;
      margin-left: 0.5rem;
      font-weight: normal;
    }
    input[type="text"],
    input[type="number"],
    input[type="url"],
    input[type="date"],
    textarea,
    select {
      width: 100%;
      padding: 0.5rem 0.75rem;
      font-size: 1rem;
      border: 1px solid #ced4da;
      border-radius: 4px;
      background: #fff;
      transition: border-color 0.15s ease-in-out;
    }
    input[type="url"] {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.9rem;
    }
    input[type="text"]:focus,
    input[type="number"]:focus,
    input[type="url"]:focus,
    input[type="date"]:focus,
    textarea:focus,
    select:focus {
      outline: none;
      border-color: #80bdff;
      box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25);
    }
    textarea {
      min-height: 100px;
      resize: vertical;
    }
    .checkbox-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .checkbox-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .checkbox-item input[type="checkbox"] {
      width: auto;
      margin: 0;
    }
    .checkbox-item label {
      margin: 0;
      font-weight: normal;
      cursor: pointer;
    }
    .checkbox-item select {
      width: auto;
      min-width: 120px;
    }
    .option-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
    }
    .option-row:last-child { margin-bottom: 0; }
    .option-label {
      flex: 1;
    }
    .toolbar {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      display: flex;
      gap: 0.5rem;
    }
    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-primary {
      background: #0d6efd;
      color: white;
    }
    .btn-primary:hover { background: #0b5ed7; }
    .field-help {
      font-size: 0.85rem;
      color: #6c757d;
      margin-top: 0.25rem;
    }
    .field-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
    .btn-skip {
      padding: 0.25rem 0.75rem;
      font-size: 0.85rem;
      background: #f8f9fa;
      border: 1px solid #ced4da;
      border-radius: 4px;
      color: #6c757d;
      cursor: pointer;
    }
    .btn-skip:hover {
      background: #e9ecef;
      color: #495057;
    }
    .field-skipped {
      opacity: 0.6;
    }
    .field-skipped input,
    .field-skipped textarea,
    .field-skipped select {
      background: #f8f9fa;
    }
    .skipped-badge {
      font-size: 0.75rem;
      padding: 0.15rem 0.4rem;
      background: #6c757d;
      color: white;
      border-radius: 3px;
      margin-left: 0.5rem;
    }
    .table-container {
      overflow-x: auto;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    .data-table th,
    .data-table td {
      padding: 0.5rem 0.75rem;
      text-align: left;
      border: 1px solid #dee2e6;
    }
    .data-table th {
      background: #f8f9fa;
      font-weight: 600;
      color: #495057;
    }
    .data-table tbody tr:hover {
      background: #f8f9fa;
    }
    /* Print styles */
    @media print {
      body {
        background: white;
        padding: 0;
        margin: 0;
      }
      h1 {
        margin-top: 0;
        padding-top: 0;
      }
      .tab-bar {
        display: none !important;
      }
      .tab-content {
        display: none !important;
      }
      .tab-content.active {
        display: block !important;
      }
      .group {
        box-shadow: none;
        border: 1px solid #dee2e6;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .url-link {
        color: #0d6efd;
        text-decoration: none;
      }
      .url-copy-tooltip {
        display: none !important;
      }
      a[href]:after {
        content: none;
      }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(formTitle)}</h1>
  ${tabBarHtml}
  <div id="tab-view" class="tab-content active">
    <div class="loading">Loading...</div>
  </div>
  <div id="tab-form" class="tab-content">
    <form method="POST" action="/save" id="markform">
      ${groupsHtml}
      <div class="toolbar">
        <button type="submit" class="btn btn-primary">Save</button>
      </div>
    </form>
  </div>
  ${showTabs ? '<div id="tab-other" class="tab-content"><div class="loading">Loading...</div></div>' : ''}
  <script>
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

    // Track fields marked for skip
    const skippedFields = new Set();

    // Handle skip button clicks
    document.querySelectorAll('.btn-skip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const fieldId = e.target.dataset.skipField;
        if (!fieldId) return;

        // Toggle skip state
        if (skippedFields.has(fieldId)) {
          skippedFields.delete(fieldId);
          e.target.textContent = 'Skip';
          e.target.classList.remove('btn-skip-active');
          // Re-enable the field input
          const fieldDiv = e.target.closest('.field');
          fieldDiv.classList.remove('field-skipped');
          fieldDiv.querySelectorAll('input, select, textarea').forEach(input => {
            input.disabled = false;
          });
        } else {
          skippedFields.add(fieldId);
          e.target.textContent = 'Unskip';
          e.target.classList.add('btn-skip-active');
          // Disable the field input to show it's skipped
          const fieldDiv = e.target.closest('.field');
          fieldDiv.classList.add('field-skipped');
          fieldDiv.querySelectorAll('input, select, textarea').forEach(input => {
            input.disabled = true;
          });
        }
      });
    });

    document.getElementById('markform').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const params = new URLSearchParams();

      // Add skip markers for skipped fields
      for (const fieldId of skippedFields) {
        params.append('__skip__' + fieldId, '1');
      }

      for (const [key, value] of formData) {
        params.append(key, value);
      }
      try {
        const res = await fetch('/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString()
        });
        const data = await res.json();
        if (data.success) {
          alert('Saved to: ' + data.path);
          location.reload();
        } else {
          alert('Error: ' + data.error);
        }
      } catch (err) {
        alert('Save failed: ' + err.message);
      }
    });

    // Tab switching logic
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabViewContent = document.getElementById('tab-view');
    const tabFormContent = document.getElementById('tab-form');
    const tabOtherContent = document.getElementById('tab-other');
    const tabCache = {};

    // Function to show a specific tab
    async function showTab(tabId) {
      // Hide all tab content
      if (tabViewContent) tabViewContent.classList.remove('active');
      if (tabFormContent) tabFormContent.classList.remove('active');
      if (tabOtherContent) tabOtherContent.classList.remove('active');

      if (tabId === 'form') {
        // Show Edit (form) tab - pre-rendered content
        if (tabFormContent) tabFormContent.classList.add('active');
      } else if (tabId === 'view') {
        // Show View tab
        if (tabViewContent) {
          tabViewContent.classList.add('active');
          // Fetch content if not cached
          if (!tabCache[tabId]) {
            tabViewContent.innerHTML = '<div class="loading">Loading...</div>';
            try {
              const response = await fetch('/tab/' + tabId);
              if (response.ok) {
                tabCache[tabId] = await response.text();
              } else {
                tabCache[tabId] = '<div class="error">Failed to load content</div>';
              }
            } catch (err) {
              tabCache[tabId] = '<div class="error">Failed to load content</div>';
            }
          }
          tabViewContent.innerHTML = tabCache[tabId];
        }
      } else {
        // Show other tab content (source, report, values, schema)
        if (tabOtherContent) {
          tabOtherContent.classList.add('active');
          // Fetch content if not cached
          if (!tabCache[tabId]) {
            tabOtherContent.innerHTML = '<div class="loading">Loading...</div>';
            try {
              const response = await fetch('/tab/' + tabId);
              if (response.ok) {
                tabCache[tabId] = await response.text();
              } else {
                tabCache[tabId] = '<div class="error">Failed to load content</div>';
              }
            } catch (err) {
              tabCache[tabId] = '<div class="error">Failed to load content</div>';
            }
          }
          tabOtherContent.innerHTML = tabCache[tabId];
        }
      }
    }

    tabButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const tabId = btn.dataset.tab;

        // Update active button
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        await showTab(tabId);
      });
    });

    // Load View tab on page load (it's the default tab)
    showTab('view');

    // URL copy tooltip functionality - initialize once
    (function initUrlCopyTooltip() {
      // Feather copy icon SVG (inline to avoid external dependency)
      const copyIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';

      // Shared state
      let activeLink = null;
      let hideTimeout = null;

      // Create tooltip element
      const tooltip = document.createElement('span');
      tooltip.id = 'url-copy-tooltip';
      tooltip.className = 'url-copy-tooltip';
      tooltip.innerHTML = copyIconSvg + ' Copy';
      document.body.appendChild(tooltip);

      function showTooltip(link) {
        if (hideTimeout) {
          clearTimeout(hideTimeout);
          hideTimeout = null;
        }
        activeLink = link;
        const rect = link.getBoundingClientRect();
        tooltip.style.left = (rect.right + 6) + 'px';
        tooltip.style.top = (rect.top + rect.height / 2) + 'px';
        tooltip.style.transform = 'translateY(-50%)';
        tooltip.classList.add('visible');
      }

      function hideTooltip() {
        hideTimeout = setTimeout(() => {
          tooltip.classList.remove('visible');
          activeLink = null;
        }, 100);
      }

      // Tooltip hover keeps it visible
      tooltip.addEventListener('mouseenter', () => {
        if (hideTimeout) {
          clearTimeout(hideTimeout);
          hideTimeout = null;
        }
      });

      tooltip.addEventListener('mouseleave', () => {
        hideTooltip();
      });

      // Handle click on tooltip
      tooltip.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!activeLink) return;
        const url = activeLink.getAttribute('data-url') || activeLink.getAttribute('href');
        if (!url) return;
        try {
          await navigator.clipboard.writeText(url);
          // Transition to copied state
          tooltip.classList.add('transitioning');
          setTimeout(() => {
            tooltip.innerHTML = 'Copied!';
            tooltip.classList.add('copied');
            tooltip.classList.remove('transitioning');
          }, 100);
          // Reset after delay
          setTimeout(() => {
            tooltip.classList.add('transitioning');
            setTimeout(() => {
              tooltip.innerHTML = copyIconSvg + ' Copy';
              tooltip.classList.remove('copied');
              tooltip.classList.remove('transitioning');
            }, 100);
          }, 1500);
        } catch (err) {
          tooltip.innerHTML = 'Failed';
          setTimeout(() => {
            tooltip.innerHTML = copyIconSvg + ' Copy';
          }, 1500);
        }
      });

      // Function to attach hover listeners to new links
      function attachLinkListeners() {
        document.querySelectorAll('.url-link').forEach(link => {
          if (link.hasAttribute('data-tooltip-setup')) return;
          link.setAttribute('data-tooltip-setup', 'true');
          link.addEventListener('mouseenter', () => showTooltip(link));
          link.addEventListener('mouseleave', () => hideTooltip());
        });
      }

      // Attach to links after tab content loads
      const originalShowTab = showTab;
      showTab = async function(tabId) {
        await originalShowTab(tabId);
        attachLinkListeners();
      };

      // Initial setup
      setTimeout(attachLinkListeners, 100);
    })();
  </script>
</body>
</html>`;
}

/**
 * Render a field group as HTML.
 */
function renderGroup(group: FieldGroup, responses: ParsedForm['responsesByFieldId']): string {
  const groupTitle = group.title ?? group.id;
  const fieldsHtml = group.children
    .map((field) => {
      const response = responses[field.id];
      const value = response?.state === 'answered' ? response.value : undefined;
      const isSkipped = response?.state === 'skipped';
      return renderFieldHtml(field, value, isSkipped);
    })
    .join('\n');

  return `
  <div class="group">
    <h2>${escapeHtml(groupTitle)}</h2>
    ${fieldsHtml}
  </div>`;
}

/**
 * Render a field as HTML.
 * @public Exported for testing.
 */
export function renderFieldHtml(
  field: Field,
  value: FieldValue | undefined,
  isSkipped?: boolean,
): string {
  const skipped = isSkipped === true;
  const requiredMark = field.required ? '<span class="required">*</span>' : '';
  const typeLabel = `<span class="type-badge">${field.kind}</span>`;
  const skippedBadge = skipped ? '<span class="skipped-badge">Skipped</span>' : '';
  const fieldClass = skipped ? 'field field-skipped' : 'field';
  const disabledAttr = skipped ? ' disabled' : '';

  let inputHtml: string;

  switch (field.kind) {
    case 'string':
      inputHtml = renderStringInput(field, value, disabledAttr);
      break;
    case 'number':
      inputHtml = renderNumberInput(field, value, disabledAttr);
      break;
    case 'string_list':
      inputHtml = renderStringListInput(field, value, disabledAttr);
      break;
    case 'single_select':
      inputHtml = renderSingleSelectInput(
        field,
        value as SingleSelectValue | undefined,
        disabledAttr,
      );
      break;
    case 'multi_select':
      inputHtml = renderMultiSelectInput(
        field,
        value as MultiSelectValue | undefined,
        disabledAttr,
      );
      break;
    case 'checkboxes':
      inputHtml = renderCheckboxesInput(field, value as CheckboxesValue | undefined, disabledAttr);
      break;
    case 'url':
      inputHtml = renderUrlInput(field, value, disabledAttr);
      break;
    case 'url_list':
      inputHtml = renderUrlListInput(field, value, disabledAttr);
      break;
    case 'date':
      inputHtml = renderDateInput(field, value, disabledAttr);
      break;
    case 'year':
      inputHtml = renderYearInput(field, value, disabledAttr);
      break;
    case 'table':
      inputHtml = renderTableInput(field, value as TableValue | undefined, disabledAttr);
      break;
    default: {
      // Exhaustiveness check - TypeScript will error if a case is missing
      const _exhaustive: never = field;
      throw new Error(`Unhandled field kind: ${(_exhaustive as { kind: string }).kind}`);
    }
  }

  // Add skip button for optional, non-skipped fields
  const skipButton =
    !field.required && !skipped
      ? `<div class="field-actions">
        <button type="button" class="btn-skip" data-skip-field="${field.id}">Skip</button>
      </div>`
      : '';

  return `
    <div class="${fieldClass}">
      <label class="field-label" for="field-${field.id}">
        ${escapeHtml(field.label)} ${requiredMark} ${typeLabel} ${skippedBadge}
      </label>
      ${inputHtml}
      ${skipButton}
    </div>`;
}

/**
 * Render a string field as text input.
 */
function renderStringInput(
  field: StringField,
  value: FieldValue | undefined,
  disabledAttr: string,
): string {
  const currentValue = value?.kind === 'string' && value.value !== null ? value.value : '';
  const requiredAttr = field.required ? ' required' : '';
  const minLengthAttr = field.minLength !== undefined ? ` minlength="${field.minLength}"` : '';
  const maxLengthAttr = field.maxLength !== undefined ? ` maxlength="${field.maxLength}"` : '';
  const placeholderAttr = field.placeholder
    ? ` placeholder="${escapeHtml(field.placeholder)}"`
    : '';

  return `<input type="text" id="field-${field.id}" name="${field.id}" value="${escapeHtml(currentValue)}"${requiredAttr}${minLengthAttr}${maxLengthAttr}${placeholderAttr}${disabledAttr}>`;
}

/**
 * Render a number field as number input.
 */
function renderNumberInput(
  field: NumberField,
  value: FieldValue | undefined,
  disabledAttr: string,
): string {
  const currentValue = value?.kind === 'number' && value.value !== null ? String(value.value) : '';
  const requiredAttr = field.required ? ' required' : '';
  const minAttr = field.min !== undefined ? ` min="${field.min}"` : '';
  const maxAttr = field.max !== undefined ? ` max="${field.max}"` : '';
  const stepAttr = field.integer ? ' step="1"' : '';
  const placeholderAttr = field.placeholder
    ? ` placeholder="${escapeHtml(field.placeholder)}"`
    : '';

  return `<input type="number" id="field-${field.id}" name="${field.id}" value="${escapeHtml(currentValue)}"${requiredAttr}${minAttr}${maxAttr}${stepAttr}${placeholderAttr}${disabledAttr}>`;
}

/**
 * Render a string list field as textarea.
 */
function renderStringListInput(
  field: StringListField,
  value: FieldValue | undefined,
  disabledAttr: string,
): string {
  const items = value?.kind === 'string_list' ? value.items : [];
  const currentValue = items.join('\n');
  const requiredAttr = field.required ? ' required' : '';
  // Use field placeholder or default
  const placeholderText = field.placeholder
    ? `${escapeHtml(field.placeholder)} (one item per line)`
    : 'Enter one item per line';

  return `<textarea id="field-${field.id}" name="${field.id}" placeholder="${placeholderText}"${requiredAttr}${disabledAttr}>${escapeHtml(currentValue)}</textarea>`;
}

/**
 * Render a URL field as url input.
 */
function renderUrlInput(
  field: UrlField,
  value: FieldValue | undefined,
  disabledAttr: string,
): string {
  const currentValue = value?.kind === 'url' && value.value !== null ? value.value : '';
  const requiredAttr = field.required ? ' required' : '';
  // Use field placeholder or default
  const placeholderText = field.placeholder ?? 'https://example.com';

  return `<input type="url" id="field-${field.id}" name="${field.id}" value="${escapeHtml(currentValue)}" placeholder="${escapeHtml(placeholderText)}"${requiredAttr}${disabledAttr}>`;
}

/**
 * Render a URL list field as textarea.
 */
function renderUrlListInput(
  field: UrlListField,
  value: FieldValue | undefined,
  disabledAttr: string,
): string {
  const items = value?.kind === 'url_list' ? value.items : [];
  const currentValue = items.join('\n');
  const requiredAttr = field.required ? ' required' : '';
  // Use field placeholder or default
  const placeholderText = field.placeholder
    ? `${escapeHtml(field.placeholder)} (one URL per line)`
    : 'Enter one URL per line';

  return `<textarea id="field-${field.id}" name="${field.id}" placeholder="${placeholderText}"${requiredAttr}${disabledAttr}>${escapeHtml(currentValue)}</textarea>`;
}

/**
 * Render a date field as date input.
 */
function renderDateInput(
  field: DateField,
  value: FieldValue | undefined,
  disabledAttr: string,
): string {
  const currentValue = value?.kind === 'date' && value.value !== null ? value.value : '';
  const requiredAttr = field.required ? ' required' : '';
  const minAttr = field.min !== undefined ? ` min="${field.min}"` : '';
  const maxAttr = field.max !== undefined ? ` max="${field.max}"` : '';

  return `<input type="date" id="field-${field.id}" name="${field.id}" value="${escapeHtml(currentValue)}"${requiredAttr}${minAttr}${maxAttr}${disabledAttr}>`;
}

/**
 * Render a year field as number input.
 */
function renderYearInput(
  field: YearField,
  value: FieldValue | undefined,
  disabledAttr: string,
): string {
  const currentValue = value?.kind === 'year' && value.value !== null ? String(value.value) : '';
  const requiredAttr = field.required ? ' required' : '';
  const minAttr = field.min !== undefined ? ` min="${field.min}"` : ' min="1000"';
  const maxAttr = field.max !== undefined ? ` max="${field.max}"` : ' max="2500"';

  return `<input type="number" id="field-${field.id}" name="${field.id}" value="${escapeHtml(currentValue)}" step="1" placeholder="YYYY"${requiredAttr}${minAttr}${maxAttr}${disabledAttr}>`;
}

/**
 * Render a single-select field as select element.
 */
function renderSingleSelectInput(
  field: SingleSelectField,
  value: SingleSelectValue | undefined,
  disabledAttr: string,
): string {
  const selected = value?.selected ?? null;
  const requiredAttr = field.required ? ' required' : '';

  const options = field.options
    .map((opt) => {
      const isSelected = selected === opt.id;
      const selectedAttr = isSelected ? ' selected' : '';
      return `<option value="${escapeHtml(opt.id)}"${selectedAttr}>${escapeHtml(opt.label)}</option>`;
    })
    .join('\n      ');

  return `<select id="field-${field.id}" name="${field.id}"${requiredAttr}${disabledAttr}>
      <option value="">-- Select --</option>
      ${options}
    </select>`;
}

/**
 * Render a multi-select field as checkboxes.
 */
function renderMultiSelectInput(
  field: MultiSelectField,
  value: MultiSelectValue | undefined,
  disabledAttr: string,
): string {
  const selected = value?.selected ?? [];

  const checkboxes = field.options
    .map((opt) => {
      const isChecked = selected.includes(opt.id);
      const checkedAttr = isChecked ? ' checked' : '';
      const checkboxId = `field-${field.id}-${opt.id}`;
      return `<div class="checkbox-item">
        <input type="checkbox" id="${checkboxId}" name="${field.id}" value="${escapeHtml(opt.id)}"${checkedAttr}${disabledAttr}>
        <label for="${checkboxId}">${escapeHtml(opt.label)}</label>
      </div>`;
    })
    .join('\n      ');

  return `<div class="checkbox-group">
      ${checkboxes}
    </div>`;
}

/**
 * Render checkboxes field based on mode.
 */
function renderCheckboxesInput(
  field: CheckboxesField,
  value: CheckboxesValue | undefined,
  disabledAttr: string,
): string {
  const checkboxValues = value?.values ?? {};
  const mode = field.checkboxMode ?? 'multi';

  if (mode === 'simple') {
    // Simple mode: render as HTML checkboxes
    const checkboxes = field.options
      .map((opt) => {
        const state = checkboxValues[opt.id];
        const isChecked = state === 'done';
        const checkedAttr = isChecked ? ' checked' : '';
        const checkboxId = `field-${field.id}-${opt.id}`;
        return `<div class="checkbox-item">
        <input type="checkbox" id="${checkboxId}" name="${field.id}" value="${escapeHtml(opt.id)}"${checkedAttr}${disabledAttr}>
        <label for="${checkboxId}">${escapeHtml(opt.label)}</label>
      </div>`;
      })
      .join('\n      ');

    return `<div class="checkbox-group">
      ${checkboxes}
    </div>`;
  }

  if (mode === 'explicit') {
    // Explicit mode: render as select with yes/no/unfilled options
    const rows = field.options
      .map((opt) => {
        const state = checkboxValues[opt.id] ?? 'unfilled';
        const selectId = `field-${field.id}-${opt.id}`;
        const selectName = `${field.id}.${opt.id}`;

        return `<div class="option-row">
        <span class="option-label">${escapeHtml(opt.label)}</span>
        <select id="${selectId}" name="${selectName}"${disabledAttr}>
          <option value="unfilled"${state === 'unfilled' ? ' selected' : ''}>-- Select --</option>
          <option value="yes"${state === 'yes' ? ' selected' : ''}>Yes</option>
          <option value="no"${state === 'no' ? ' selected' : ''}>No</option>
        </select>
      </div>`;
      })
      .join('\n      ');

    return `<div class="checkbox-group">
      ${rows}
    </div>`;
  }

  // Multi mode: render as select with multiple state options
  const rows = field.options
    .map((opt) => {
      const state = checkboxValues[opt.id] ?? 'todo';
      const selectId = `field-${field.id}-${opt.id}`;
      const selectName = `${field.id}.${opt.id}`;

      return `<div class="option-row">
        <span class="option-label">${escapeHtml(opt.label)}</span>
        <select id="${selectId}" name="${selectName}"${disabledAttr}>
          <option value="todo"${state === 'todo' ? ' selected' : ''}>To Do</option>
          <option value="active"${state === 'active' ? ' selected' : ''}>Active</option>
          <option value="done"${state === 'done' ? ' selected' : ''}>Done</option>
          <option value="incomplete"${state === 'incomplete' ? ' selected' : ''}>Incomplete</option>
          <option value="na"${state === 'na' ? ' selected' : ''}>N/A</option>
        </select>
      </div>`;
    })
    .join('\n      ');

  return `<div class="checkbox-group">
      ${rows}
    </div>`;
}

/**
 * Render a table field as an HTML table.
 * Currently read-only display; editing requires more complex UI.
 */
function renderTableInput(
  field: TableField,
  value: TableValue | undefined,
  _disabledAttr: string,
): string {
  const rows = value?.rows ?? [];

  if (rows.length === 0) {
    return '<div class="field-help">(no data)</div>';
  }

  // Build header row
  const headerHtml = field.columns.map((col) => `<th>${escapeHtml(col.label)}</th>`).join('');

  // Build data rows
  const dataRowsHtml = rows
    .map((row) => {
      const cellsHtml = field.columns
        .map((col) => {
          const cell = row[col.id];
          let cellValue = '';
          if (cell?.state === 'answered' && cell.value !== undefined && cell.value !== null) {
            cellValue = String(cell.value);
          } else if (cell?.state === 'skipped') {
            cellValue = cell.reason ? `[skipped: ${cell.reason}]` : '[skipped]';
          } else if (cell?.state === 'aborted') {
            cellValue = cell.reason ? `[aborted: ${cell.reason}]` : '[aborted]';
          }
          return `<td>${escapeHtml(cellValue)}</td>`;
        })
        .join('');
      return `<tr>${cellsHtml}</tr>`;
    })
    .join('\n        ');

  return `<div class="table-container">
      <table class="data-table">
        <thead>
          <tr>${headerHtml}</tr>
        </thead>
        <tbody>
          ${dataRowsHtml}
        </tbody>
      </table>
      <div class="field-help">(table fields are currently read-only in the web UI)</div>
    </div>`;
}

/**
 * Escape HTML special characters.
 * @public Exported for testing.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// =============================================================================
// Read-only Renderers for non-form file types
// =============================================================================

/** Common styles for read-only viewers */
const READ_ONLY_STYLES = `
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
      background: #f8f9fa;
      color: #212529;
    }
    h1 { color: #495057; border-bottom: 2px solid #dee2e6; padding-bottom: 0.5rem; font-size: 1.5rem; }
    .content {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    pre {
      background: #f8f9fa;
      color: #24292e;
      padding: 1rem;
      border-radius: 6px;
      border: 1px solid #e1e4e8;
      overflow-x: auto;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.9rem;
      line-height: 1.5;
    }
    /* Light theme syntax highlighting */
    .syn-key { color: #005cc5; }
    .syn-string { color: #22863a; }
    .syn-number { color: #005cc5; }
    .syn-bool { color: #d73a49; }
    .syn-null { color: #d73a49; }
    .syn-comment { color: #6a737d; font-style: italic; }
    .badge {
      font-size: 0.75rem;
      padding: 0.2rem 0.5rem;
      background: #e9ecef;
      border-radius: 4px;
      color: #6c757d;
      margin-left: 0.75rem;
      font-weight: normal;
    }
`;

/**
 * Render markdown content as read-only HTML.
 * Simple rendering without full markdown parsing.
 */
function renderMarkdownHtml(content: string, filename: string): string {
  // Simple markdown-to-html conversion (headers and paragraphs)
  const lines = content.split('\n');
  let html = '';
  let inParagraph = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('# ')) {
      if (inParagraph) {
        html += '</p>';
        inParagraph = false;
      }
      html += `<h2>${escapeHtml(trimmed.slice(2))}</h2>`;
    } else if (trimmed.startsWith('## ')) {
      if (inParagraph) {
        html += '</p>';
        inParagraph = false;
      }
      html += `<h3>${escapeHtml(trimmed.slice(3))}</h3>`;
    } else if (trimmed.startsWith('### ')) {
      if (inParagraph) {
        html += '</p>';
        inParagraph = false;
      }
      html += `<h4>${escapeHtml(trimmed.slice(4))}</h4>`;
    } else if (trimmed === '') {
      if (inParagraph) {
        html += '</p>';
        inParagraph = false;
      }
    } else {
      if (!inParagraph) {
        html += '<p>';
        inParagraph = true;
      } else {
        html += '<br>';
      }
      html += escapeHtml(trimmed);
    }
  }

  if (inParagraph) {
    html += '</p>';
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(filename)} - Markform Viewer</title>
  <style>${READ_ONLY_STYLES}
    h2 { color: #495057; font-size: 1.3rem; margin-top: 1.5rem; }
    h3 { color: #6c757d; font-size: 1.1rem; margin-top: 1.25rem; }
    h4 { color: #6c757d; font-size: 1rem; margin-top: 1rem; }
    p { margin: 0.75rem 0; }
  </style>
</head>
<body>
  <h1>${escapeHtml(filename)}<span class="badge">Markdown</span></h1>
  <div class="content">
    ${html}
  </div>
</body>
</html>`;
}

/**
 * Render YAML content with syntax highlighting.
 */
function renderYamlHtml(content: string, filename: string): string {
  // YAML syntax highlighting using CSS classes
  const highlighted = content
    .split('\n')
    .map((line) => {
      // Highlight comments
      if (line.trim().startsWith('#')) {
        return `<span class="syn-comment">${escapeHtml(line)}</span>`;
      }
      // Highlight keys (before colon)
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0 && !line.trim().startsWith('-')) {
        const key = escapeHtml(line.slice(0, colonIndex));
        const afterColon = line.slice(colonIndex + 1).trim();
        const colonAndSpace = escapeHtml(line.slice(colonIndex, colonIndex + 1));
        // Highlight the value based on type
        if (afterColon === '') {
          return `<span class="syn-key">${key}</span>${colonAndSpace}`;
        }
        const valueStart = line.indexOf(afterColon, colonIndex);
        const beforeValue = escapeHtml(line.slice(colonIndex, valueStart));
        const value = highlightYamlValue(afterColon);
        return `<span class="syn-key">${key}</span>${beforeValue}${value}`;
      }
      // List items
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(filename)} - Markform Viewer</title>
  <style>${READ_ONLY_STYLES}</style>
</head>
<body>
  <h1>${escapeHtml(filename)}<span class="badge">YAML</span></h1>
  <div class="content">
    <pre>${highlighted}</pre>
  </div>
</body>
</html>`;
}

/**
 * Highlight a YAML value based on its type.
 */
function highlightYamlValue(value: string): string {
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
 * Render JSON content with syntax highlighting and formatting.
 */
function renderJsonHtml(content: string, filename: string): string {
  // Try to pretty-print JSON
  let formatted: string;
  try {
    const parsed = JSON.parse(content) as unknown;
    formatted = JSON.stringify(parsed, null, 2);
  } catch {
    formatted = content;
  }

  // JSON syntax highlighting using CSS classes
  const highlighted = formatted
    .replace(/"([^"]+)":/g, '<span class="syn-key">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span class="syn-string">"$1"</span>')
    .replace(/: (-?\d+\.?\d*)/g, ': <span class="syn-number">$1</span>')
    .replace(/: (true|false)/g, ': <span class="syn-bool">$1</span>')
    .replace(/: (null)/g, ': <span class="syn-null">$1</span>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(filename)} - Markform Viewer</title>
  <style>${READ_ONLY_STYLES}</style>
</head>
<body>
  <h1>${escapeHtml(filename)}<span class="badge">JSON</span></h1>
  <div class="content">
    <pre>${highlighted}</pre>
  </div>
</body>
</html>`;
}

/**
 * Render plain text content.
 */
function renderPlainTextHtml(content: string, filename: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(filename)} - Markform Viewer</title>
  <style>${READ_ONLY_STYLES}</style>
</head>
<body>
  <h1>${escapeHtml(filename)}<span class="badge">Text</span></h1>
  <div class="content">
    <pre>${escapeHtml(content)}</pre>
  </div>
</body>
</html>`;
}

// =============================================================================
// Content-only Renderers (for tab content)
// =============================================================================

/**
 * Render form view content (read-only display of form fields).
 * Used for View tab content.
 * @public Exported for testing.
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

      html += '<div class="view-field">';
      html += `<div class="view-field-label">${escapeHtml(field.label)}`;
      html += ` <span class="type-badge">${field.kind}</span>`;
      if (field.required) {
        html += ' <span class="required">*</span>';
      }
      if (isSkipped) {
        html += ' <span class="skipped-badge">Skipped</span>';
      }
      html += '</div>';

      // Render value based on field type
      html += renderViewFieldValue(field, value, isSkipped);
      html += '</div>';
    }

    html += '</div>';
  }

  html += '</div>';
  return html;
}

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
): string {
  if (isSkipped) {
    return '<div class="view-field-empty">(skipped)</div>';
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
 * Render source content with Markdown and Jinja syntax highlighting.
 * Used for Source tab content.
 * @public Exported for testing.
 */
export function renderSourceContent(content: string): string {
  const lines = content.split('\n');
  const highlighted = lines.map((line) => highlightSourceLine(line)).join('\n');
  return `<pre>${highlighted}</pre>`;
}

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
 * Render markdown content (content only, no page wrapper).
 * Used for tab content.
 * @public Exported for testing.
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
    const content = trimmed.slice(1, -1);
    return content.split('|').map((cell) => cell.trim());
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
 * Render YAML content (content only, no page wrapper).
 * Used for tab content.
 * @public Exported for testing.
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
 * Render JSON content (content only, no page wrapper).
 * Used for tab content.
 * @public Exported for testing.
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

/**
 * Format milliseconds as human-readable duration.
 * @public Exported for reuse in other visualizations.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format token count with K suffix for large numbers.
 * @public Exported for reuse in other visualizations.
 */
export function formatTokens(count: number): string {
  if (count >= 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return count.toLocaleString();
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
const FILL_RECORD_STYLES = `
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

  const summaryCards = `
    <div class="fr-cards">
      <div class="fr-card">
        <div class="fr-card__label">Status</div>
        <div><span class="${badgeClass}">${badgeIcon} ${badgeLabel}</span></div>
      </div>
      <div class="fr-card">
        <div class="fr-card__label">Duration</div>
        <div class="fr-card__value">${formatDuration(durationMs)}</div>
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

    toolSection = `
      <details class="fr-details fr-section" open>
        <summary>Tool Summary</summary>
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
