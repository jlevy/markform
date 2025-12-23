/**
 * Serve command - Serve a form as a web page for browsing.
 *
 * Starts an HTTP server that renders the form as HTML.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Command } from "commander";

import { createServer } from "node:http";
import { resolve } from "node:path";

import pc from "picocolors";

import { parseForm } from "../../engine/parse.js";
import { serialize } from "../../engine/serialize.js";
import type {
  CheckboxesField,
  CheckboxesValue,
  Field,
  FieldGroup,
  FieldValue,
  MultiSelectField,
  MultiSelectValue,
  ParsedForm,
  SingleSelectField,
  SingleSelectValue,
} from "../../engine/types.js";
import {
  type CommandContext,
  getCommandContext,
  logError,
  logInfo,
  logVerbose,
  readFile,
  writeFile,
} from "../lib/shared.js";

const DEFAULT_PORT = 3000;

/**
 * Register the serve command.
 */
export function registerServeCommand(program: Command): void {
  program
    .command("serve <file>")
    .description("Serve a form as a web page for browsing")
    .option("-p, --port <port>", "Port to serve on", String(DEFAULT_PORT))
    .option("--no-open", "Don't open browser automatically")
    .action(
      async (
        file: string,
        options: { port?: string; open?: boolean },
        cmd: Command
      ) => {
        const ctx = getCommandContext(cmd);
        const port = parseInt(options.port ?? String(DEFAULT_PORT), 10);
        const filePath = resolve(file);

        try {
          logVerbose(ctx, `Reading file: ${filePath}`);
          const content = await readFile(filePath);

          logVerbose(ctx, "Parsing form...");
          const form = parseForm(content);

          // Start the server
          const server = createServer(
            (req: IncomingMessage, res: ServerResponse) => {
              handleRequest(req, res, form, filePath, ctx).catch((err) => {
                console.error("Request error:", err);
                res.writeHead(500);
                res.end("Internal Server Error");
              });
            }
          );

          server.listen(port, () => {
            const url = `http://localhost:${port}`;
            logInfo(ctx, pc.green(`\n✓ Form server running at ${pc.bold(url)}\n`));
            logInfo(ctx, pc.dim("Press Ctrl+C to stop\n"));
          });

          // Handle graceful shutdown
          process.on("SIGINT", () => {
            logInfo(ctx, "\nShutting down server...");
            server.close();
            process.exit(0);
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logError(message);
          process.exit(1);
        }
      }
    );
}

/**
 * Handle HTTP requests.
 */
async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  form: ParsedForm,
  filePath: string,
  ctx: CommandContext
): Promise<void> {
  const url = req.url ?? "/";

  if (req.method === "GET" && url === "/") {
    // Render the form as HTML
    const html = renderFormHtml(form);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  } else if (req.method === "POST" && url === "/save") {
    // Save the form to a new versioned file
    await handleSave(req, res, form, filePath, ctx);
  } else if (url === "/api/form") {
    // API endpoint for form data
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ schema: form.schema }));
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
}

/**
 * Handle form save request.
 */
async function handleSave(
  _req: IncomingMessage,
  res: ServerResponse,
  form: ParsedForm,
  filePath: string,
  ctx: CommandContext
): Promise<void> {
  try {
    // Generate versioned filename
    const newPath = generateVersionedPath(filePath);

    // Serialize the form
    const content = serialize(form);

    if (ctx.dryRun) {
      logInfo(ctx, `[DRY RUN] Would save to: ${newPath}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, path: newPath, dryRun: true }));
      return;
    }

    // Write the file
    await writeFile(newPath, content);
    logInfo(ctx, pc.green(`Saved to: ${newPath}`));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, path: newPath }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: message }));
  }
}

/**
 * Generate a versioned filename.
 * e.g., form.form.md -> form-v1.form.md
 *       form-v1.form.md -> form-v2.form.md
 */
function generateVersionedPath(filePath: string): string {
  // Match patterns like -v1, _v1, or v1 at the end (before extension)
  const versionPattern = /^(.+?)(?:[-_]?v(\d+))?(\.form\.md)$/i;
  const match = versionPattern.exec(filePath);

  if (match) {
    const [, base, version, ext] = match;
    const newVersion = version ? parseInt(version, 10) + 1 : 1;
    return `${base}-v${newVersion}${ext}`;
  }

  // Fallback: append -v1 before the extension
  const extPattern = /^(.+)(\.form\.md)$/i;
  const extMatch = extPattern.exec(filePath);
  if (extMatch) {
    return `${extMatch[1]}-v1${extMatch[2]}`;
  }

  return `${filePath}-v1`;
}

/**
 * Render the form as HTML.
 */
function renderFormHtml(form: ParsedForm): string {
  const { schema, valuesByFieldId } = form;
  const formTitle = schema.title ?? schema.id;

  const groupsHtml = schema.groups
    .map((group) => renderGroup(group, valuesByFieldId))
    .join("\n");

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
    h1 { color: #495057; border-bottom: 2px solid #dee2e6; padding-bottom: 0.5rem; }
    h2 { color: #6c757d; margin-top: 2rem; }
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
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .required { color: #dc3545; }
    .field-value {
      margin-top: 0.5rem;
      padding: 0.75rem;
      background: #f8f9fa;
      border-radius: 4px;
      font-family: 'SFMono-Regular', Menlo, Monaco, monospace;
      font-size: 0.9rem;
      white-space: pre-wrap;
    }
    .field-value.empty {
      color: #6c757d;
      font-style: italic;
    }
    .options { list-style: none; padding: 0; margin: 0.5rem 0 0 0; }
    .option {
      padding: 0.25rem 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .option-marker {
      font-family: monospace;
      width: 2rem;
      text-align: center;
    }
    .option-marker.selected { color: #28a745; font-weight: bold; }
    .doc-block {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 1rem;
      margin: 1rem 0;
      border-radius: 0 4px 4px 0;
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
    .type-badge {
      font-size: 0.75rem;
      padding: 0.15rem 0.4rem;
      background: #e9ecef;
      border-radius: 3px;
      color: #6c757d;
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(formTitle)}</h1>
  ${groupsHtml}
  <div class="toolbar">
    <button class="btn btn-primary" onclick="saveForm()">Save</button>
  </div>
  <script>
    async function saveForm() {
      try {
        const res = await fetch('/save', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          alert('Saved to: ' + data.path);
        } else {
          alert('Error: ' + data.error);
        }
      } catch (err) {
        alert('Save failed: ' + err.message);
      }
    }
  </script>
</body>
</html>`;
}

/**
 * Render a field group as HTML.
 */
function renderGroup(
  group: FieldGroup,
  values: Record<string, FieldValue>
): string {
  const groupTitle = group.title ?? group.id;
  const fieldsHtml = group.children
    .map((field) => renderField(field, values[field.id]))
    .join("\n");

  return `
  <div class="group">
    <h2>${escapeHtml(groupTitle)}</h2>
    ${fieldsHtml}
  </div>`;
}

/**
 * Render a field as HTML.
 */
function renderField(field: Field, value: FieldValue | undefined): string {
  const requiredMark = field.required ? '<span class="required">*</span>' : "";
  const typeLabel = `<span class="type-badge">${field.kind}</span>`;

  let valueHtml: string;

  switch (field.kind) {
    case "string":
    case "number":
      valueHtml = renderScalarValue(value);
      break;
    case "string_list":
      valueHtml = renderListValue(value);
      break;
    case "single_select":
      valueHtml = renderSingleSelectValue(
        field,
        value as SingleSelectValue | undefined
      );
      break;
    case "multi_select":
      valueHtml = renderMultiSelectValue(
        field,
        value as MultiSelectValue | undefined
      );
      break;
    case "checkboxes":
      valueHtml = renderCheckboxesValue(
        field,
        value as CheckboxesValue | undefined
      );
      break;
    default:
      valueHtml = '<div class="field-value empty">(unknown type)</div>';
  }

  return `
    <div class="field">
      <div class="field-label">
        ${escapeHtml(field.label)} ${requiredMark} ${typeLabel}
      </div>
      ${valueHtml}
    </div>`;
}

/**
 * Render a scalar value (string or number).
 */
function renderScalarValue(value: FieldValue | undefined): string {
  if (!value) {
    return '<div class="field-value empty">(empty)</div>';
  }
  if (value.kind === "string") {
    if (value.value === null || value.value === "") {
      return '<div class="field-value empty">(empty)</div>';
    }
    return `<div class="field-value">${escapeHtml(value.value)}</div>`;
  }
  if (value.kind === "number") {
    if (value.value === null) {
      return '<div class="field-value empty">(empty)</div>';
    }
    return `<div class="field-value">${value.value}</div>`;
  }
  return '<div class="field-value empty">(empty)</div>';
}

/**
 * Render a list value (string_list).
 */
function renderListValue(value: FieldValue | undefined): string {
  if (value?.kind !== "string_list" || value.items.length === 0) {
    return '<div class="field-value empty">(empty)</div>';
  }
  const items = value.items.map((v) => `• ${escapeHtml(v)}`).join("\n");
  return `<div class="field-value">${items}</div>`;
}

/**
 * Render a single-select value.
 */
function renderSingleSelectValue(
  field: SingleSelectField,
  value: SingleSelectValue | undefined
): string {
  const selected = value?.selected ?? null;
  const options = field.options
    .map((opt) => {
      const isSelected = selected === opt.id;
      const marker = isSelected ? "(x)" : "( )";
      const markerClass = isSelected ? "selected" : "";
      return `<li class="option"><span class="option-marker ${markerClass}">${marker}</span> ${escapeHtml(opt.label)}</li>`;
    })
    .join("\n");
  return `<ul class="options">${options}</ul>`;
}

/**
 * Render a multi-select value.
 */
function renderMultiSelectValue(
  field: MultiSelectField,
  value: MultiSelectValue | undefined
): string {
  const selected = value?.selected ?? [];
  const options = field.options
    .map((opt) => {
      const isSelected = selected.includes(opt.id);
      const marker = isSelected ? "[x]" : "[ ]";
      const markerClass = isSelected ? "selected" : "";
      return `<li class="option"><span class="option-marker ${markerClass}">${marker}</span> ${escapeHtml(opt.label)}</li>`;
    })
    .join("\n");
  return `<ul class="options">${options}</ul>`;
}

/**
 * Render checkboxes value.
 */
function renderCheckboxesValue(
  field: CheckboxesField,
  value: CheckboxesValue | undefined
): string {
  const checkboxValues = value?.values ?? {};
  const mode = field.checkboxMode ?? "multi";
  const options = field.options
    .map((opt) => {
      const state = checkboxValues[opt.id];
      let marker: string;
      let markerClass = "";

      if (mode === "explicit") {
        if (state === "yes") {
          marker = "[y]";
          markerClass = "selected";
        } else if (state === "no") {
          marker = "[n]";
        } else {
          marker = "[_]";
        }
      } else if (mode === "multi") {
        if (state === "done") {
          marker = "[x]";
          markerClass = "selected";
        } else if (state === "active") {
          marker = "[*]";
          markerClass = "selected";
        } else if (state === "incomplete") {
          marker = "[~]";
        } else if (state === "na") {
          marker = "[-]";
        } else {
          marker = "[ ]";
        }
      } else {
        // simple mode
        if (state === "done") {
          marker = "[x]";
          markerClass = "selected";
        } else {
          marker = "[ ]";
        }
      }

      return `<li class="option"><span class="option-marker ${markerClass}">${marker}</span> ${escapeHtml(opt.label)}</li>`;
    })
    .join("\n");
  return `<ul class="options">${options}</ul>`;
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
