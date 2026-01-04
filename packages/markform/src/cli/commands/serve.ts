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

import { applyPatches } from '../../engine/apply.js';
import { parseForm } from '../../engine/parse.js';
import { serializeForm } from '../../engine/serialize.js';
import { ALL_EXTENSIONS, DEFAULT_PORT, detectFileType, type FileType } from '../../settings.js';
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
// Related Files Discovery
// =============================================================================

/** Represents a tab for navigation between related files */
interface Tab {
  id: 'view' | 'form' | 'source' | 'report' | 'values' | 'schema';
  label: string;
  path: string | null; // null if file doesn't exist
}

/** Collection of related files for a form */
interface RelatedFiles {
  form: string;
  report: string | null;
  values: string | null;
  schema: string | null;
}

/**
 * Get the base path by stripping any known markform extension.
 */
function getBasePath(filePath: string): string {
  for (const ext of Object.values(ALL_EXTENSIONS)) {
    if (filePath.endsWith(ext)) {
      return filePath.slice(0, -ext.length);
    }
  }
  // Also handle plain .md files
  if (filePath.endsWith('.md')) {
    return filePath.slice(0, -3);
  }
  return filePath;
}

/**
 * Find related files for a form file.
 * Checks for .report.md, .yml, and .schema.json files with the same base name.
 */
function findRelatedFiles(formPath: string): RelatedFiles {
  const base = getBasePath(formPath);

  const reportPath = base + ALL_EXTENSIONS.report;
  const valuesPath = base + ALL_EXTENSIONS.yaml;
  const schemaPath = base + ALL_EXTENSIONS.schema;

  return {
    form: formPath,
    report: existsSync(reportPath) ? reportPath : null,
    values: existsSync(valuesPath) ? valuesPath : null,
    schema: existsSync(schemaPath) ? schemaPath : null,
  };
}

/**
 * Build tabs for tabbed navigation.
 * Tab order: View, Edit, Source, Report, Values, Schema
 */
function buildTabs(relatedFiles: RelatedFiles): Tab[] {
  const tabs: Tab[] = [];

  // View tab - read-only display of form (always present for form files)
  tabs.push({ id: 'view', label: 'View', path: relatedFiles.form });

  // Edit tab - interactive form editor (renamed from "Markform")
  tabs.push({ id: 'form', label: 'Edit', path: relatedFiles.form });

  // Source tab - syntax-highlighted source code (always present for form files)
  tabs.push({ id: 'source', label: 'Source', path: relatedFiles.form });

  if (relatedFiles.report) {
    tabs.push({ id: 'report', label: 'Report', path: relatedFiles.report });
  }
  if (relatedFiles.values) {
    tabs.push({ id: 'values', label: 'Values', path: relatedFiles.values });
  }
  if (relatedFiles.schema) {
    tabs.push({ id: 'schema', label: 'Schema', path: relatedFiles.schema });
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

        // Discover related files for form files
        const relatedFiles = fileType === 'form' ? findRelatedFiles(filePath) : null;
        const tabs = relatedFiles ? buildTabs(relatedFiles) : null;

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

    // Handle other tabs (report, values, schema)
    if (tab?.path) {
      const content = await readFileAsync(tab.path, 'utf-8');
      const tabFileType = detectFileType(tab.path);
      let html: string;
      if (tabFileType === 'report' || tabFileType === 'raw') {
        html = renderMarkdownContent(content);
      } else if (tabFileType === 'yaml') {
        html = renderYamlContent(content);
      } else if (tabFileType === 'json' || tabFileType === 'schema') {
        html = renderJsonContent(content);
      } else {
        html = `<pre>${escapeHtml(content)}</pre>`;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
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
    .markdown-content code { background: #f1f3f5; padding: 0.2em 0.4em; border-radius: 3px; font-size: 0.9em; }
    .markdown-content pre { background: #f8f9fa; padding: 1rem; border-radius: 6px; border: 1px solid #e1e4e8; overflow-x: auto; }
    .markdown-content pre code { background: none; padding: 0; }
    .markdown-content a { color: #0366d6; text-decoration: none; }
    .markdown-content a:hover { text-decoration: underline; }
    .markdown-content strong { font-weight: 600; }
    /* Checkbox styles for markdown */
    .checkbox { font-size: 1.1em; margin-right: 0.25em; }
    .checkbox.checked { color: #28a745; }
    .checkbox.unchecked { color: #6c757d; }
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
      return `<div class="view-field-value">${escapeHtml(v)}</div>`;
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
      return `<div class="view-field-value"><ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul></div>`;
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
      if (selected.length === 0) {
        return '<div class="view-field-empty">(not filled)</div>';
      }
      const labels = selected.map((s) => {
        const opt = field.options.find((o) => o.id === s);
        return opt?.label ?? s;
      });
      return `<div class="view-field-value">${labels.map((l) => escapeHtml(l)).join(', ')}</div>`;
    }
    case 'checkboxes': {
      const values = value.kind === 'checkboxes' ? value.values : {};
      if (Object.keys(values).length === 0) {
        return '<div class="view-field-empty">(not filled)</div>';
      }
      const items = field.options.map((opt) => {
        const state = values[opt.id] ?? 'todo';
        return `<li>${escapeHtml(opt.label)}: <em>${state}</em></li>`;
      });
      return `<div class="view-field-value"><ul>${items.join('')}</ul></div>`;
    }
    case 'url': {
      const v = value.kind === 'url' ? value.value : null;
      if (v === null || v === '') {
        return '<div class="view-field-empty">(not filled)</div>';
      }
      return `<div class="view-field-value"><a href="${escapeHtml(v)}" target="_blank">${escapeHtml(v)}</a></div>`;
    }
    case 'url_list': {
      const items = value.kind === 'url_list' ? value.items : [];
      if (items.length === 0) {
        return '<div class="view-field-empty">(not filled)</div>';
      }
      return `<div class="view-field-value"><ul>${items.map((u) => `<li><a href="${escapeHtml(u)}" target="_blank">${escapeHtml(u)}</a></li>`).join('')}</ul></div>`;
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
          if (cell?.state === 'answered' && cell.value !== undefined && cell.value !== null) {
            cellValue = String(cell.value);
          }
          tableHtml += `<td>${escapeHtml(cellValue)}</td>`;
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
      html += `<li>${formatInlineMarkdown(trimmed.slice(2))}</li>`;
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
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_: string, linkText: string, url: string) =>
      `<a href="${url.replace(/&amp;/g, '&')}" target="_blank">${linkText}</a>`,
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
