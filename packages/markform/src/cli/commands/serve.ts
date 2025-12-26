/**
 * Serve command - Serve a form as a web page for browsing.
 *
 * Starts an HTTP server that renders the form as interactive HTML.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Command } from "commander";

import { exec } from "node:child_process";
import { createServer } from "node:http";
import { resolve } from "node:path";

import pc from "picocolors";

import { applyPatches } from "../../engine/apply.js";
import { parseForm } from "../../engine/parse.js";
import { serialize } from "../../engine/serialize.js";
import { DEFAULT_PORT } from "../../settings.js";
import type {
  CheckboxesField,
  CheckboxesValue,
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
  UrlField,
  UrlListField,
} from "../../engine/coreTypes.js";
import {
  type CommandContext,
  getCommandContext,
  logError,
  logInfo,
  logVerbose,
  readFile,
  writeFile,
} from "../lib/shared.js";
import { generateVersionedPath } from "../lib/versioning.js";

/**
 * Open a URL in the default browser (cross-platform).
 */
function openBrowser(url: string): void {
  const platform = process.platform;

  let command: string;
  if (platform === "darwin") {
    command = `open "${url}"`;
  } else if (platform === "win32") {
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
          let form = parseForm(content);

          // Start the server
          const server = createServer(
            (req: IncomingMessage, res: ServerResponse) => {
              handleRequest(req, res, form, filePath, ctx, (updatedForm) => {
                form = updatedForm;
              }).catch((err) => {
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

            // Open browser by default unless --no-open is specified
            if (options.open !== false) {
              openBrowser(url);
            }
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
  ctx: CommandContext,
  updateForm: (form: ParsedForm) => void
): Promise<void> {
  const url = req.url ?? "/";

  if (req.method === "GET" && url === "/") {
    // Render the form as HTML
    const html = renderFormHtml(form);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  } else if (req.method === "POST" && url === "/save") {
    // Save the form to a new versioned file
    await handleSave(req, res, form, filePath, ctx, updateForm);
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
function formDataToPatches(
  formData: Record<string, string | string[]>,
  form: ParsedForm
): Patch[] {
  const patches: Patch[] = [];
  const fields = form.schema.groups.flatMap((g) => g.children);

  for (const field of fields) {
    const fieldId = field.id;

    // Check if this field was explicitly skipped
    const skipKey = `__skip__${fieldId}`;
    if (formData[skipKey] === "1" && !field.required) {
      patches.push({ op: "skip_field", fieldId, role: "user" });
      continue; // Don't process other patches for this field
    }

    switch (field.kind) {
      case "string": {
        const value = formData[fieldId];
        if (typeof value === "string" && value.trim() !== "") {
          patches.push({ op: "set_string", fieldId, value: value.trim() });
        } else if (!value || (typeof value === "string" && value.trim() === "")) {
          patches.push({ op: "clear_field", fieldId });
        }
        break;
      }

      case "number": {
        const value = formData[fieldId];
        if (typeof value === "string" && value.trim() !== "") {
          const num = parseFloat(value);
          if (!isNaN(num)) {
            patches.push({ op: "set_number", fieldId, value: num });
          }
        } else {
          patches.push({ op: "clear_field", fieldId });
        }
        break;
      }

      case "string_list": {
        const value = formData[fieldId];
        if (typeof value === "string" && value.trim() !== "") {
          const items = value
            .split("\n")
            .map((s) => s.trim())
            .filter((s) => s !== "");
          if (items.length > 0) {
            patches.push({ op: "set_string_list", fieldId, items });
          } else {
            patches.push({ op: "clear_field", fieldId });
          }
        } else {
          patches.push({ op: "clear_field", fieldId });
        }
        break;
      }

      case "single_select": {
        const value = formData[fieldId];
        if (typeof value === "string" && value !== "") {
          patches.push({ op: "set_single_select", fieldId, selected: value });
        } else {
          patches.push({ op: "clear_field", fieldId });
        }
        break;
      }

      case "multi_select": {
        const value = formData[fieldId];
        const selected = Array.isArray(value)
          ? value
          : value
            ? [value]
            : [];
        if (selected.length > 0 && selected[0] !== "") {
          patches.push({ op: "set_multi_select", fieldId, selected });
        } else {
          patches.push({ op: "clear_field", fieldId });
        }
        break;
      }

      case "checkboxes": {
        const mode = field.checkboxMode ?? "multi";

        if (mode === "simple") {
          // Simple mode: checkboxes send their value when checked
          const value = formData[fieldId];
          const checked = Array.isArray(value)
            ? value
            : value
              ? [value]
              : [];

          const values: Record<string, "done" | "todo"> = {};
          for (const opt of field.options) {
            values[opt.id] = checked.includes(opt.id) ? "done" : "todo";
          }
          patches.push({ op: "set_checkboxes", fieldId, values });
        } else {
          // Multi or explicit mode: each option has its own select
          const values: Record<string, string> = {};
          for (const opt of field.options) {
            const selectName = `${fieldId}.${opt.id}`;
            const selectValue = formData[selectName];
            if (typeof selectValue === "string" && selectValue !== "") {
              values[opt.id] = selectValue;
            }
          }
          if (Object.keys(values).length > 0) {
            patches.push({
              op: "set_checkboxes",
              fieldId,
              values: values as Record<
                string,
                | "todo"
                | "done"
                | "active"
                | "incomplete"
                | "na"
                | "yes"
                | "no"
                | "unfilled"
              >,
            });
          }
        }
        break;
      }

      case "url": {
        const value = formData[fieldId];
        if (typeof value === "string" && value.trim() !== "") {
          patches.push({ op: "set_url", fieldId, value: value.trim() });
        } else {
          patches.push({ op: "clear_field", fieldId });
        }
        break;
      }

      case "url_list": {
        const value = formData[fieldId];
        if (typeof value === "string" && value.trim() !== "") {
          const items = value
            .split("\n")
            .map((s) => s.trim())
            .filter((s) => s !== "");
          if (items.length > 0) {
            patches.push({ op: "set_url_list", fieldId, items });
          } else {
            patches.push({ op: "clear_field", fieldId });
          }
        } else {
          patches.push({ op: "clear_field", fieldId });
        }
        break;
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
  updateForm: (form: ParsedForm) => void
): Promise<void> {
  try {
    // Read request body
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    const body = Buffer.concat(chunks).toString("utf-8");

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
 * Render the form as HTML.
 * @public Exported for testing.
 */
export function renderFormHtml(form: ParsedForm): string {
  const { schema, responsesByFieldId } = form;
  const formTitle = schema.title ?? schema.id;

  const groupsHtml = schema.groups
    .map((group) => renderGroup(group, responsesByFieldId))
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
    input[type="text"]:focus,
    input[type="number"]:focus,
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
  </style>
</head>
<body>
  <h1>${escapeHtml(formTitle)}</h1>
  <form method="POST" action="/save" id="markform">
    ${groupsHtml}
    <div class="toolbar">
      <button type="submit" class="btn btn-primary">Save</button>
    </div>
  </form>
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
  </script>
</body>
</html>`;
}

/**
 * Render a field group as HTML.
 */
function renderGroup(
  group: FieldGroup,
  responses: ParsedForm["responsesByFieldId"]
): string {
  const groupTitle = group.title ?? group.id;
  const fieldsHtml = group.children
    .map((field) => {
      const response = responses[field.id];
      const value = response?.state === "answered" ? response.value : undefined;
      const isSkipped = response?.state === "skipped";
      return renderFieldHtml(field, value, isSkipped);
    })
    .join("\n");

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
  isSkipped?: boolean
): string {
  const skipped = isSkipped === true;
  const requiredMark = field.required ? '<span class="required">*</span>' : "";
  const typeLabel = `<span class="type-badge">${field.kind}</span>`;
  const skippedBadge = skipped ? '<span class="skipped-badge">Skipped</span>' : "";
  const fieldClass = skipped ? "field field-skipped" : "field";
  const disabledAttr = skipped ? " disabled" : "";

  let inputHtml: string;

  switch (field.kind) {
    case "string":
      inputHtml = renderStringInput(field, value, disabledAttr);
      break;
    case "number":
      inputHtml = renderNumberInput(field, value, disabledAttr);
      break;
    case "string_list":
      inputHtml = renderStringListInput(field, value, disabledAttr);
      break;
    case "single_select":
      inputHtml = renderSingleSelectInput(
        field,
        value as SingleSelectValue | undefined,
        disabledAttr
      );
      break;
    case "multi_select":
      inputHtml = renderMultiSelectInput(
        field,
        value as MultiSelectValue | undefined,
        disabledAttr
      );
      break;
    case "checkboxes":
      inputHtml = renderCheckboxesInput(
        field,
        value as CheckboxesValue | undefined,
        disabledAttr
      );
      break;
    case "url":
      inputHtml = renderUrlInput(field, value, disabledAttr);
      break;
    case "url_list":
      inputHtml = renderUrlListInput(field, value, disabledAttr);
      break;
    default:
      inputHtml = '<div class="field-help">(unknown field type)</div>';
  }

  // Add skip button for optional, non-skipped fields
  const skipButton = !field.required && !skipped
    ? `<div class="field-actions">
        <button type="button" class="btn-skip" data-skip-field="${field.id}">Skip</button>
      </div>`
    : "";

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
  disabledAttr: string
): string {
  const currentValue =
    value?.kind === "string" && value.value !== null ? value.value : "";
  const requiredAttr = field.required ? " required" : "";
  const minLengthAttr =
    field.minLength !== undefined ? ` minlength="${field.minLength}"` : "";
  const maxLengthAttr =
    field.maxLength !== undefined ? ` maxlength="${field.maxLength}"` : "";

  return `<input type="text" id="field-${field.id}" name="${field.id}" value="${escapeHtml(currentValue)}"${requiredAttr}${minLengthAttr}${maxLengthAttr}${disabledAttr}>`;
}

/**
 * Render a number field as number input.
 */
function renderNumberInput(
  field: NumberField,
  value: FieldValue | undefined,
  disabledAttr: string
): string {
  const currentValue =
    value?.kind === "number" && value.value !== null ? String(value.value) : "";
  const requiredAttr = field.required ? " required" : "";
  const minAttr = field.min !== undefined ? ` min="${field.min}"` : "";
  const maxAttr = field.max !== undefined ? ` max="${field.max}"` : "";
  const stepAttr = field.integer ? ' step="1"' : "";

  return `<input type="number" id="field-${field.id}" name="${field.id}" value="${escapeHtml(currentValue)}"${requiredAttr}${minAttr}${maxAttr}${stepAttr}${disabledAttr}>`;
}

/**
 * Render a string list field as textarea.
 */
function renderStringListInput(
  field: StringListField,
  value: FieldValue | undefined,
  disabledAttr: string
): string {
  const items =
    value?.kind === "string_list" ? value.items : [];
  const currentValue = items.join("\n");
  const requiredAttr = field.required ? " required" : "";

  return `<textarea id="field-${field.id}" name="${field.id}" placeholder="Enter one item per line"${requiredAttr}${disabledAttr}>${escapeHtml(currentValue)}</textarea>`;
}

/**
 * Render a URL field as url input.
 */
function renderUrlInput(
  field: UrlField,
  value: FieldValue | undefined,
  disabledAttr: string
): string {
  const currentValue =
    value?.kind === "url" && value.value !== null ? value.value : "";
  const requiredAttr = field.required ? " required" : "";

  return `<input type="url" id="field-${field.id}" name="${field.id}" value="${escapeHtml(currentValue)}" placeholder="https://example.com"${requiredAttr}${disabledAttr}>`;
}

/**
 * Render a URL list field as textarea.
 */
function renderUrlListInput(
  field: UrlListField,
  value: FieldValue | undefined,
  disabledAttr: string
): string {
  const items = value?.kind === "url_list" ? value.items : [];
  const currentValue = items.join("\n");
  const requiredAttr = field.required ? " required" : "";

  return `<textarea id="field-${field.id}" name="${field.id}" placeholder="Enter one URL per line"${requiredAttr}${disabledAttr}>${escapeHtml(currentValue)}</textarea>`;
}

/**
 * Render a single-select field as select element.
 */
function renderSingleSelectInput(
  field: SingleSelectField,
  value: SingleSelectValue | undefined,
  disabledAttr: string
): string {
  const selected = value?.selected ?? null;
  const requiredAttr = field.required ? " required" : "";

  const options = field.options
    .map((opt) => {
      const isSelected = selected === opt.id;
      const selectedAttr = isSelected ? " selected" : "";
      return `<option value="${escapeHtml(opt.id)}"${selectedAttr}>${escapeHtml(opt.label)}</option>`;
    })
    .join("\n      ");

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
  disabledAttr: string
): string {
  const selected = value?.selected ?? [];

  const checkboxes = field.options
    .map((opt) => {
      const isChecked = selected.includes(opt.id);
      const checkedAttr = isChecked ? " checked" : "";
      const checkboxId = `field-${field.id}-${opt.id}`;
      return `<div class="checkbox-item">
        <input type="checkbox" id="${checkboxId}" name="${field.id}" value="${escapeHtml(opt.id)}"${checkedAttr}${disabledAttr}>
        <label for="${checkboxId}">${escapeHtml(opt.label)}</label>
      </div>`;
    })
    .join("\n      ");

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
  disabledAttr: string
): string {
  const checkboxValues = value?.values ?? {};
  const mode = field.checkboxMode ?? "multi";

  if (mode === "simple") {
    // Simple mode: render as HTML checkboxes
    const checkboxes = field.options
      .map((opt) => {
        const state = checkboxValues[opt.id];
        const isChecked = state === "done";
        const checkedAttr = isChecked ? " checked" : "";
        const checkboxId = `field-${field.id}-${opt.id}`;
        return `<div class="checkbox-item">
        <input type="checkbox" id="${checkboxId}" name="${field.id}" value="${escapeHtml(opt.id)}"${checkedAttr}${disabledAttr}>
        <label for="${checkboxId}">${escapeHtml(opt.label)}</label>
      </div>`;
      })
      .join("\n      ");

    return `<div class="checkbox-group">
      ${checkboxes}
    </div>`;
  }

  if (mode === "explicit") {
    // Explicit mode: render as select with yes/no/unfilled options
    const rows = field.options
      .map((opt) => {
        const state = checkboxValues[opt.id] ?? "unfilled";
        const selectId = `field-${field.id}-${opt.id}`;
        const selectName = `${field.id}.${opt.id}`;

        return `<div class="option-row">
        <span class="option-label">${escapeHtml(opt.label)}</span>
        <select id="${selectId}" name="${selectName}"${disabledAttr}>
          <option value="unfilled"${state === "unfilled" ? " selected" : ""}>-- Select --</option>
          <option value="yes"${state === "yes" ? " selected" : ""}>Yes</option>
          <option value="no"${state === "no" ? " selected" : ""}>No</option>
        </select>
      </div>`;
      })
      .join("\n      ");

    return `<div class="checkbox-group">
      ${rows}
    </div>`;
  }

  // Multi mode: render as select with multiple state options
  const rows = field.options
    .map((opt) => {
      const state = checkboxValues[opt.id] ?? "todo";
      const selectId = `field-${field.id}-${opt.id}`;
      const selectName = `${field.id}.${opt.id}`;

      return `<div class="option-row">
        <span class="option-label">${escapeHtml(opt.label)}</span>
        <select id="${selectId}" name="${selectName}"${disabledAttr}>
          <option value="todo"${state === "todo" ? " selected" : ""}>To Do</option>
          <option value="active"${state === "active" ? " selected" : ""}>Active</option>
          <option value="done"${state === "done" ? " selected" : ""}>Done</option>
          <option value="incomplete"${state === "incomplete" ? " selected" : ""}>Incomplete</option>
          <option value="na"${state === "na" ? " selected" : ""}>N/A</option>
        </select>
      </div>`;
    })
    .join("\n      ");

  return `<div class="checkbox-group">
      ${rows}
    </div>`;
}

/**
 * Escape HTML special characters.
 * @public Exported for testing.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
