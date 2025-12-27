/**
 * AI SDK Integration Tests
 *
 * Tests for the Markform AI SDK tools.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createMarkformTools,
  MarkformSessionStore,
  type MarkformToolSet,
} from "../../../src/integrations/ai-sdk.js";
import { parseForm } from "../../../src/engine/parse.js";
import type { ParsedForm, Patch } from "../../../src/engine/coreTypes.js";

// =============================================================================
// Test Fixtures
// =============================================================================

const SIMPLE_FORM = `---
markform:
  spec: "MF/0.1"
---

{% form id="test_form" %}

{% field-group id="main" %}

{% string-field id="name" label="Name" required=true %}{% /string-field %}

{% number-field id="age" label="Age" required=true %}{% /number-field %}

{% /field-group %}

{% /form %}
`;

const FILLED_FORM = `---
markform:
  spec: "MF/0.1"
---

{% form id="test_form" %}

{% field-group id="main" %}

{% string-field id="name" label="Name" required=true %}
\`\`\`value
Alice
\`\`\`
{% /string-field %}

{% number-field id="age" label="Age" required=true %}
\`\`\`value
30
\`\`\`
{% /number-field %}

{% /field-group %}

{% /form %}
`;

// =============================================================================
// MarkformSessionStore Tests
// =============================================================================

describe("MarkformSessionStore", () => {
  let form: ParsedForm;

  beforeEach(() => {
    form = parseForm(SIMPLE_FORM);
  });

  it("stores and retrieves form", () => {
    const store = new MarkformSessionStore(form);
    expect(store.getForm()).toBe(form);
  });

  it("updates form", () => {
    const store = new MarkformSessionStore(form);
    const newForm = parseForm(FILLED_FORM);
    store.updateForm(newForm);
    expect(store.getForm()).toBe(newForm);
  });

  it("stores empty validator registry by default", () => {
    const store = new MarkformSessionStore(form);
    expect(store.getValidatorRegistry()).toEqual({});
  });

  it("stores custom validator registry", () => {
    const customValidator = () => [];
    const registry = { myValidator: customValidator };
    const store = new MarkformSessionStore(form, registry);
    expect(store.getValidatorRegistry()).toBe(registry);
  });
});

// =============================================================================
// createMarkformTools Tests
// =============================================================================

describe("createMarkformTools", () => {
  let form: ParsedForm;
  let store: MarkformSessionStore;
  let tools: MarkformToolSet;

  beforeEach(() => {
    form = parseForm(SIMPLE_FORM);
    store = new MarkformSessionStore(form);
    tools = createMarkformTools({ sessionStore: store });
  });

  it("returns all tools by default", () => {
    expect(tools.markform_inspect).toBeDefined();
    expect(tools.markform_apply).toBeDefined();
    expect(tools.markform_export).toBeDefined();
    expect(tools.markform_get_markdown).toBeDefined();
  });

  it("can exclude markform_get_markdown", () => {
    const toolsWithoutMarkdown = createMarkformTools({
      sessionStore: store,
      includeGetMarkdown: false,
    });
    expect(toolsWithoutMarkdown.markform_get_markdown).toBeUndefined();
  });
});

// =============================================================================
// markform_inspect Tool Tests
// =============================================================================

describe("markform_inspect tool", () => {
  let form: ParsedForm;
  let store: MarkformSessionStore;
  let tools: MarkformToolSet;

  beforeEach(() => {
    form = parseForm(SIMPLE_FORM);
    store = new MarkformSessionStore(form);
    tools = createMarkformTools({ sessionStore: store });
  });

  it("has correct description", () => {
    expect(tools.markform_inspect.description).toContain("Inspect");
    expect(tools.markform_inspect.description).toContain("form state");
  });

  it("returns success with empty form issues", async () => {
    const result = await tools.markform_inspect.execute({});

    expect(result.success).toBe(true);
    expect(result.data.isComplete).toBe(false);
    expect(result.data.issues.length).toBeGreaterThan(0);
  });

  it("returns issues for required fields", async () => {
    const result = await tools.markform_inspect.execute({});

    const nameIssue = result.data.issues.find((i) => i.ref === "name");
    const ageIssue = result.data.issues.find((i) => i.ref === "age");

    expect(nameIssue).toBeDefined();
    expect(nameIssue?.severity).toBe("required");
    expect(ageIssue).toBeDefined();
    expect(ageIssue?.severity).toBe("required");
  });

  it("returns isComplete=true for filled form", async () => {
    const filledForm = parseForm(FILLED_FORM);
    const filledStore = new MarkformSessionStore(filledForm);
    const filledTools = createMarkformTools({ sessionStore: filledStore });

    const result = await filledTools.markform_inspect.execute({});

    expect(result.success).toBe(true);
    expect(result.data.isComplete).toBe(true);
    expect(result.message).toContain("complete");
  });

  it("returns structure and progress summaries", async () => {
    const result = await tools.markform_inspect.execute({});

    expect(result.data.structureSummary).toBeDefined();
    expect(result.data.structureSummary.groupCount).toBe(1);
    expect(result.data.structureSummary.fieldCount).toBe(2);
    expect(result.data.progressSummary).toBeDefined();
  });
});

// =============================================================================
// markform_apply Tool Tests
// =============================================================================

describe("markform_apply tool", () => {
  let form: ParsedForm;
  let store: MarkformSessionStore;
  let tools: MarkformToolSet;

  beforeEach(() => {
    form = parseForm(SIMPLE_FORM);
    store = new MarkformSessionStore(form);
    tools = createMarkformTools({ sessionStore: store });
  });

  it("has correct description", () => {
    expect(tools.markform_apply.description).toContain("Apply patches");
    expect(tools.markform_apply.description).toContain("set_string");
  });

  it("applies valid patches", async () => {
    const patches: Patch[] = [
      { op: "set_string", fieldId: "name", value: "Bob" },
      { op: "set_number", fieldId: "age", value: 25 },
    ];

    const result = await tools.markform_apply.execute({ patches });

    expect(result.success).toBe(true);
    expect(result.data.applyStatus).toBe("applied");
    expect(result.data.isComplete).toBe(true);
    expect(result.message).toContain("complete");
  });

  it("updates the session store", async () => {
    const patches: Patch[] = [
      { op: "set_string", fieldId: "name", value: "Charlie" },
    ];

    await tools.markform_apply.execute({ patches });

    const updatedForm = store.getForm();
    // eslint-disable-next-line @typescript-eslint/dot-notation
    const nameResponse = updatedForm.responsesByFieldId["name"];
    expect(nameResponse).toBeDefined();
    expect(nameResponse?.state).toBe("answered");
    expect(nameResponse?.value?.kind).toBe("string");
    if (nameResponse?.value?.kind === "string") {
      expect(nameResponse.value.value).toBe("Charlie");
    }
  });

  it("rejects patches for invalid field IDs", async () => {
    const patches: Patch[] = [
      { op: "set_string", fieldId: "nonexistent", value: "test" },
    ];

    const result = await tools.markform_apply.execute({ patches });

    expect(result.success).toBe(false);
    expect(result.data.applyStatus).toBe("rejected");
    expect(result.message).toContain("rejected");
  });

  it("rejects patches with wrong type", async () => {
    const patches: Patch[] = [
      { op: "set_number", fieldId: "name", value: 123 }, // name is string field
    ];

    const result = await tools.markform_apply.execute({ patches });

    expect(result.success).toBe(false);
    expect(result.data.applyStatus).toBe("rejected");
  });

  it("returns remaining issues after partial fill", async () => {
    const patches: Patch[] = [{ op: "set_string", fieldId: "name", value: "Dave" }];

    const result = await tools.markform_apply.execute({ patches });

    expect(result.success).toBe(true);
    expect(result.data.isComplete).toBe(false);
    expect(result.message).toContain("1 required issue");
  });
});

// =============================================================================
// markform_export Tool Tests
// =============================================================================

describe("markform_export tool", () => {
  let form: ParsedForm;
  let store: MarkformSessionStore;
  let tools: MarkformToolSet;

  beforeEach(() => {
    form = parseForm(SIMPLE_FORM);
    store = new MarkformSessionStore(form);
    tools = createMarkformTools({ sessionStore: store });
  });

  it("has correct description", () => {
    expect(tools.markform_export.description).toContain("Export");
    expect(tools.markform_export.description).toContain("JSON");
  });

  it("exports schema and values", async () => {
    const result = await tools.markform_export.execute({});

    expect(result.success).toBe(true);
    expect(result.data.schema).toBeDefined();
    expect(result.data.schema.id).toBe("test_form");
    expect(result.data.values).toBeDefined();
  });

  it("exports filled values after apply", async () => {
    const patches: Patch[] = [
      { op: "set_string", fieldId: "name", value: "Eve" },
    ];
    await tools.markform_apply.execute({ patches });

    const result = await tools.markform_export.execute({});

    expect(result.success).toBe(true);
    // eslint-disable-next-line @typescript-eslint/dot-notation
    const nameResponse = result.data.values["name"];
    expect(nameResponse).toBeDefined();
    expect(nameResponse?.state).toBe("answered");
  });

  it("includes group count in message", async () => {
    const result = await tools.markform_export.execute({});
    expect(result.message).toContain("1 group");
  });
});

// =============================================================================
// markform_get_markdown Tool Tests
// =============================================================================

describe("markform_get_markdown tool", () => {
  let form: ParsedForm;
  let store: MarkformSessionStore;
  let tools: MarkformToolSet;

  beforeEach(() => {
    form = parseForm(SIMPLE_FORM);
    store = new MarkformSessionStore(form);
    tools = createMarkformTools({ sessionStore: store });
  });

  it("has correct description", () => {
    expect(tools.markform_get_markdown?.description).toContain("Markdown");
    expect(tools.markform_get_markdown?.description).toContain("canonical");
  });

  it("returns markdown content", async () => {
    const result = await tools.markform_get_markdown!.execute({});

    expect(result.success).toBe(true);
    expect(result.data.markdown).toBeDefined();
    expect(result.data.markdown).toContain("{% form");
    expect(result.data.markdown).toContain("test_form");
  });

  it("includes values in markdown after apply", async () => {
    const patches: Patch[] = [
      { op: "set_string", fieldId: "name", value: "Frank" },
    ];
    await tools.markform_apply.execute({ patches });

    const result = await tools.markform_get_markdown!.execute({});

    expect(result.data.markdown).toContain("Frank");
  });

  it("reports character count in message", async () => {
    const result = await tools.markform_get_markdown!.execute({});
    expect(result.message).toMatch(/\d+ characters/);
  });
});

// =============================================================================
// End-to-End Workflow Tests
// =============================================================================

describe("AI SDK tools workflow", () => {
  it("completes a form filling workflow", async () => {
    // Setup
    const form = parseForm(SIMPLE_FORM);
    const store = new MarkformSessionStore(form);
    const tools = createMarkformTools({ sessionStore: store });

    // 1. Inspect to see what needs filling
    const inspectResult = await tools.markform_inspect.execute({});
    expect(inspectResult.data.isComplete).toBe(false);
    expect(inspectResult.data.issues.length).toBe(2);

    // 2. Apply patches to fill the form
    const patches: Patch[] = [
      { op: "set_string", fieldId: "name", value: "Grace" },
      { op: "set_number", fieldId: "age", value: 28 },
    ];
    const applyResult = await tools.markform_apply.execute({ patches });
    expect(applyResult.success).toBe(true);
    expect(applyResult.data.isComplete).toBe(true);

    // 3. Verify completion
    const finalInspect = await tools.markform_inspect.execute({});
    expect(finalInspect.data.isComplete).toBe(true);
    expect(finalInspect.data.issues.filter((i) => i.severity === "required")).toHaveLength(0);

    // 4. Export final form
    const exportResult = await tools.markform_export.execute({});
    /* eslint-disable @typescript-eslint/dot-notation */
    const nameResponse = exportResult.data.values["name"];
    const ageResponse = exportResult.data.values["age"];
    expect(nameResponse).toBeDefined();
    expect(nameResponse?.state).toBe("answered");
    expect(ageResponse).toBeDefined();
    expect(ageResponse?.state).toBe("answered");
    /* eslint-enable @typescript-eslint/dot-notation */

    // 5. Get final markdown
    const markdownResult = await tools.markform_get_markdown!.execute({});
    expect(markdownResult.data.markdown).toContain("Grace");
    expect(markdownResult.data.markdown).toContain("28");
  });
});
