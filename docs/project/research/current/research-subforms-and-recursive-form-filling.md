# Research Brief: Subforms and Recursive Form Filling in Markform

**Last Updated**: 2026-01-05

**Status**: In Progress

**Related**:

- [Markform Specification](../../../markform-spec.md)
- [Architecture Design](../../architecture/current/arch-markform-design.md)
- [Harness Implementation](../../../../packages/markform/src/harness/)

* * *

## Executive Summary

This research brief explores the design space for **subforms** (also called dependent forms, nested forms, or child forms) in Markform. The core question is how to extend Markform's current flat form structure to support hierarchical, recursive form-filling scenarios where:

1. A field in a parent form references another form (one-to-one subform)
2. A table column contains references to subforms (one-to-many subform rows)
3. Subforms are filled by subagents with context from the parent form
4. The agentic loop can handle recursive form structures with appropriate context propagation

This capability would enable deep research workflows where, for example, a form contains a table of companies, and each company row has a "research details" subform that gets filled by a dedicated subagent.

**Research Questions**:

1. What are the precedents for subforms in existing tools (Access, Excel, Typeform, JSON Schema)?
2. How should the Markform syntax and data model be extended to support subforms?
3. Who should own the agentic loop: the library (Markform harness) or the caller (external orchestrator)?
4. How should context be propagated from parent forms to subform agents?
5. What parallelization and concurrency strategies should be supported?
6. How should field filling order and dependencies be handled?

* * *

## Research Methodology

### Approach

- Literature review of existing form/database systems with subform capabilities
- Analysis of current Markform architecture and harness implementation
- Survey of AI agent orchestration patterns for multi-agent workflows
- Comparative analysis of design alternatives

### Sources

- Microsoft Access documentation on subforms and master-detail forms
- Excel nested data structures and Power Query patterns
- Typeform conditional logic and branching documentation
- JSON Schema composition keywords (allOf, oneOf, anyOf)
- AI agent orchestration research (Anthropic, Google ADK, LangChain, AWS Strands)
- Workflow orchestration platforms (Temporal, Airflow, Step Functions)

* * *

## Research Findings

### Category 1: Precedents in Existing Tools

#### 1.1 Microsoft Access Subforms

**Status**: ✅ Complete

Microsoft Access provides the most mature implementation of subforms in a form-based system:

**Key Concepts**:
- A **subform** is a form embedded within another form (the "main form" or "parent form")
- The combination is called a **hierarchical form**, **master/detail form**, or **parent/child form**
- Subforms are linked to parent forms via **Link Master Fields** and **Link Child Fields** properties
- Access automatically filters subform data based on the current record in the parent form

**Linking Mechanism**:
- The Link Master Field is typically the primary key of the parent form's recordset
- The Link Child Field is the foreign key in the subform's recordset
- When the parent record changes, the subform automatically filters to show only related child records

**Best Practices from Access**:
- Always reference the control name rather than the field name for Link Master Fields
- For editable link fields, link to the control to ensure correct data display
- Use intermediate text boxes for complex multi-subform synchronization

**Relevance to Markform**:
- The Link Master/Child pattern maps to passing parent field values as context to subform agents
- Access's automatic filtering suggests subforms should inherit context from their parent row
- The one-to-many relationship pattern aligns with table fields containing subform references

**Sources**:
- [Create a form that contains a subform - Microsoft Support](https://support.microsoft.com/en-us/office/create-a-form-that-contains-a-subform-a-one-to-many-form-ddf3822f-8aba-49cb-831a-1e74d6f5f06b)
- [SubForm.Parent property (Access) - Microsoft Learn](https://learn.microsoft.com/en-us/office/vba/api/access.subform.parent)
- [Link Master Fields Best Practices - FMS Inc](http://www.fmsinc.com/microsoftaccess/forms/subform/master-link-fields.asp)

* * *

#### 1.2 Excel Nested Data Structures

**Status**: ✅ Complete

Excel does not natively support nested tables, but several patterns have emerged:

**Key Findings**:
- Excel's flat table structure makes true nesting difficult
- Workarounds include: named ranges, INDIRECT functions, Power Query nested data types
- Data validation dependent lists create pseudo-hierarchical relationships
- Power Query allows creating "data types inside data types" for nested structures

**Limitations**:
- Managing data validation within nested structures is challenging
- Performance degrades with complex nesting
- From an accessibility perspective, nested cells should be avoided as Excel isn't designed for them

**Relevance to Markform**:
- Excel's struggles with nesting validate Markform's text-based approach
- The concept of dependent lists (field B's options depend on field A's value) is relevant for conditional subforms
- Power Query's nested data types suggest a "field as reference to another form" model

**Sources**:
- [Excel Data Validation Dependent Lists - Contextures](https://www.contextures.com/exceldatavaldependindextablesindirect.html)
- [Power Query nested data types - CrossJoin](https://blog.crossjoin.co.uk/2023/12/23/power-query-nested-data-types-in-excel/)
- [Excel Tables as Source for Data Validation - MyOnlineTrainingHub](https://www.myonlinetraininghub.com/excel-tables-as-source-for-data-validation-lists)

* * *

#### 1.3 Typeform Conditional Logic and Branching

**Status**: ✅ Complete

Typeform uses branching logic rather than true subforms:

**Key Concepts**:
- **Logic Jumps**: Skip to different questions based on previous answers
- **Branching**: Show different question paths based on conditions
- **Question Groups**: Bundle related questions together as a unit
- **Multi-branching**: Follow-up questions specific to selected choices

**How It Works**:
- Respondents never see irrelevant questions—they're hidden via logic
- AND/OR operators combine multiple conditions
- Logic applies to the last question in a group for group-based navigation

**Limitations**:
- Can't directly create "nested forms"—only skip/branching logic
- Complex nested logic requires careful ordering (most restrictive first)
- No concept of filling the same subform multiple times for different items

**Relevance to Markform**:
- Question groups suggest grouping subform-related fields together
- Conditional display logic could determine whether a subform is needed
- The "one path through the form" model differs from Markform's "fill all fields" model

**Sources**:
- [What is Logic? - Typeform Help Center](https://help.typeform.com/hc/en-us/articles/360029116392-What-is-Logic)
- [Use Branching Logic - Typeform Help](https://www.typeform.com/help/a/use-branching-and-calculations-in-logic-to-show-relevant-questions-360054770931/)
- [Logic Jumps - Typeform Developers](https://www.typeform.com/developers/create/logic-jumps/)

* * *

#### 1.4 JSON Schema Composition

**Status**: ✅ Complete

JSON Schema provides composition keywords for nested/conditional schemas:

**Composition Keywords**:
- **allOf**: Must be valid against ALL subschemas (AND)
- **anyOf**: Must be valid against AT LEAST ONE subschema (OR)
- **oneOf**: Must be valid against EXACTLY ONE subschema (XOR)
- **$ref**: Reference another schema definition

**Nested Object Pattern**:
```json
{
  "type": "object",
  "properties": {
    "company": { "type": "string" },
    "details": { "$ref": "#/$defs/companyDetails" }
  },
  "$defs": {
    "companyDetails": {
      "type": "object",
      "properties": {
        "founded": { "type": "integer" },
        "employees": { "type": "integer" }
      }
    }
  }
}
```

**Key Considerations**:
- `additionalProperties` only recognizes properties in the same subschema
- `unevaluatedProperties` can recognize properties across subschemas
- Performance warning: `oneOf` requires validating every subschema

**Relevance to Markform**:
- The `$ref` pattern maps directly to "field references another form"
- Markform already exports to JSON Schema, so subform references could use `$ref`
- Composition keywords could enable conditional subform inclusion

**Sources**:
- [JSON Schema - Boolean combination](https://json-schema.org/understanding-json-schema/reference/combining)
- [oneOf, anyOf, allOf, not - Swagger Docs](https://swagger.io/docs/specification/v3_0/data-models/oneof-anyof-allof-not/)
- [JSON Schema - object](https://json-schema.org/understanding-json-schema/reference/object)

* * *

#### 1.5 Database Hierarchical Models

**Status**: ✅ Complete

Database design offers several patterns for hierarchical data:

**Master-Detail Pattern**:
- Parent table (master) has one-to-many relationship with child table (detail)
- Classic example: Customer → Orders → OrderItems
- Foreign key in child references primary key in parent

**Adjacency List Model**:
- Self-referential table with parent_id column
- Simple but limited query performance for deep hierarchies
- Good for shallow hierarchies (2-3 levels)

**Closure Table Pattern**:
- Separate table records ALL paths between nodes
- Efficient for querying ancestors/descendants at any depth
- More complex to maintain but excellent query performance

**Relevance to Markform**:
- Master-detail maps to parent form → table field → subform per row
- Adjacency list suggests subforms could reference parent form by ID
- Closure table complexity suggests keeping Markform hierarchies shallow (2-3 levels)

**Sources**:
- [Universal Database Design Patterns - Redgate](https://www.red-gate.com/blog/database-design-patterns)
- [Closure Table Pattern in SQL - Software Patterns Lexicon](https://softwarepatternslexicon.com/patterns-sql/4/2/4/)
- [Hierarchical Database Model - Wikipedia](https://en.wikipedia.org/wiki/Hierarchical_database_model)

* * *

### Category 2: AI Agent Orchestration Patterns

#### 2.1 Orchestrator-Worker Pattern

**Status**: ✅ Complete

The dominant pattern for multi-agent systems:

**How It Works** (from [Anthropic's Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system)):
- A **lead agent** (orchestrator) analyzes the task and develops a strategy
- The lead agent spawns **subagents** (workers) to explore different aspects
- Subagents work in parallel on their assigned subtasks
- Results are aggregated back to the lead agent

**Key Benefits**:
- Parallel execution reduces total runtime
- Each subagent has focused context (lower token usage)
- Complex tasks naturally decompose into subtasks

**Challenges**:
- Lead agent can't steer subagents mid-execution
- Subagents can't coordinate with each other
- System can block waiting for slowest subagent
- Error propagation and state consistency across subagents

**Relevance to Markform**:
- Parent form agent = lead agent
- Subform agents = worker agents
- Need mechanism to pass context from lead to workers
- Consider whether subagents can communicate back mid-execution

**Sources**:
- [How we built our multi-agent research system - Anthropic](https://www.anthropic.com/engineering/multi-agent-research-system)
- [AI Agent Orchestration Patterns - Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)
- [Developer's guide to multi-agent patterns in ADK - Google](https://developers.googleblog.com/developers-guide-to-multi-agent-patterns-in-adk/)

* * *

#### 2.2 Recursive Subagent Pattern

**Status**: ✅ Complete

A more sophisticated pattern allowing dynamic decomposition:

**How It Works** (from [Recursive Planning - Acta Machina](https://actamachina.com/posts/recursive-planning)):
- A **DynamicAgent** receives a task and decides whether to:
  - Solve directly (single LLM call)
  - Break into parallel subtasks (spawn ParallelAgent with subagents)
  - Break into sequential subtasks (spawn SequentialAgent with subagents)
- Each subagent is also a DynamicAgent (recursive)
- Recursion stops at MAX_DEPTH or when task is simple enough

**Google ADK ParallelAgent**:
- Runs sub-agents simultaneously in separate execution threads
- Agents share session state (potential for race conditions)
- Recommendation: each agent writes to unique keys in shared state

**Relevance to Markform**:
- Natural fit for recursive form structures
- Need MAX_DEPTH equivalent to prevent infinite nesting
- Shared state = parent form; unique keys = subform field IDs
- Could support both parallel and sequential subform filling

**Sources**:
- [Extending Anthropic's Agent Workflows with Recursive Planning](https://actamachina.com/posts/recursive-planning)
- [Parallel agents - Google ADK](https://google.github.io/adk-docs/agents/workflow-agents/parallel-agents/)
- [Multi-agent - LangChain](https://docs.langchain.com/oss/python/langchain/multi-agent)

* * *

#### 2.3 Parallelization Patterns from Anthropic

**Status**: ✅ Complete

Anthropic's research system uses two levels of parallelization:

1. **Subagent Parallelization**: Lead agent spawns 3-5 subagents in parallel
2. **Tool Parallelization**: Each subagent uses 3+ tools in parallel

**Key Insight**: "Complex research tasks naturally involve exploring many sources. Early agents executed sequential searches, which was painfully slow."

**Rate Limiting Considerations**:
- Don't exceed downstream service capacity
- Use concurrency limits to protect APIs

**Relevance to Markform**:
- For table fields with N rows, could spawn N subagent calls in parallel
- Should support configurable max concurrency (e.g., 5 at a time)
- Tool parallelization already handled by AI SDK's generateText

* * *

### Category 3: Workflow Concurrency Patterns

#### 3.1 Concurrency Control Mechanisms

**Status**: ✅ Complete

Common patterns from workflow orchestration platforms:

**Max Concurrency Limit**:
- Power Automate: 1-50 concurrent items in Apply to Each
- AWS Step Functions: Default 10,000 parallel executions (configurable)
- Kestra: Flow-level concurrency limit property
- Google Workflows: CONCURRENCY_LIMIT parameter for branches

**Key Considerations**:
- Higher concurrency doesn't always mean faster (overhead, API limits)
- Recommend not exceeding downstream service capacity
- Queue excess work rather than failing

**Rate Limiting Strategies**:
- GitHub Actions: Concurrency groups with same key
- Temporal: Worker-level configuration for parallel task handling
- Airflow: `max_active_runs` per DAG, `parallelism` system-wide

**Relevance to Markform**:
- Need `maxConcurrency` option for parallel subform filling
- Should queue subforms beyond the limit rather than blocking
- Consider both per-form and global concurrency limits

**Sources**:
- [Optimize flows with parallel execution - Power Automate](https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/implement-parallel-execution)
- [Execute workflow steps in parallel - Google Cloud](https://cloud.google.com/workflows/docs/execute-parallel-steps)
- [Using Map state in Distributed mode - AWS Step Functions](https://docs.aws.amazon.com/step-functions/latest/dg/state-map-distributed.html)
- [Apache Airflow Task Concurrency - SparkCodeHub](https://www.sparkcodehub.com/airflow/task-management/concurrency)

* * *

## Design Considerations for Markform Subforms

### Design Question 1: Syntax for Subform Fields

**Option A: New `subform` Field Kind**

```jinja
{% field kind="subform" id="company_details" label="Company Details"
   formRef="company-research.form.md" %}{% /field %}
```

Pros:
- Explicit and clear
- Dedicated handling for subform semantics

Cons:
- New field kind increases complexity
- May not fit table context well

**Option B: Reference Attribute on Existing Fields**

```jinja
{% field kind="string" id="company_details" label="Company Details"
   formRef="company-research.form.md" %}{% /field %}
```

Pros:
- Less invasive change
- Works with existing field kinds

Cons:
- Overloads meaning of string/other field kinds
- Unclear what the "value" is

**Option C: Subform Column Type in Tables**

```jinja
{% field kind="table" id="companies" label="Companies"
   columnIds=["name", "url", "research"]
   columnTypes=["string", "url", "subform:company-research.form.md"]
   minRows=1 maxRows=10 %}
| Name | URL | Research |
|------|-----|----------|
{% /field %}
```

Pros:
- Natural extension of existing table syntax
- Each row gets its own subform instance
- Clear one-to-many relationship

Cons:
- Complex column type syntax
- Need to decide how subform values are stored/serialized

**Recommendation**: Start with Option C for table-based subforms (most common use case), then consider Option A for standalone subform fields.

* * *

### Design Question 2: Subform Value Storage

**Option A: Inline Expansion**

Subform content is embedded directly in the parent form:

```jinja
{% field kind="table" id="companies" ... %}
| Name | URL | Research |
|------|-----|----------|
| Acme | https://acme.com | {% subform-value %}...filled subform content...{% /subform-value %} |
{% /field %}
```

Pros:
- All data in one file
- Easy to inspect full state

Cons:
- Parent form becomes very large
- Harder to edit individual subforms
- Token limits for LLM context

**Option B: External File References**

Subforms are stored in separate files:

```jinja
{% field kind="table" id="companies" ... %}
| Name | URL | Research |
|------|-----|----------|
| Acme | https://acme.com | ./subforms/companies/acme-research.form.md |
{% /field %}
```

Pros:
- Parent form stays manageable
- Each subform is independently editable
- Better for large/deep hierarchies

Cons:
- Need to manage multiple files
- More complex serialization/deserialization
- Potential for orphaned files

**Option C: Hybrid (Summary + External)**

Store summary in parent, full content in external file:

```jinja
| Acme | https://acme.com | ✅ Complete (./subforms/acme-research.form.md) |
```

Pros:
- Parent shows progress at a glance
- Full details available when needed

Cons:
- Two sources of truth to synchronize

**Recommendation**: Option B (external files) for initial implementation, with clear naming conventions and automatic file management.

* * *

### Design Question 3: Agentic Loop Ownership

**Option A: Library-Owned Loop (Current Model, Extended)**

The Markform harness owns the entire execution, including recursive subform filling:

```typescript
// User calls:
const result = await fillForm({
  form: parentFormMarkdown,
  model: "anthropic/claude-sonnet-4-5",
  enableWebSearch: true,
  // New option:
  subformOptions: {
    maxDepth: 3,
    maxConcurrency: 5,
    contextPropagation: "row", // or "full-form"
  }
});
```

Pros:
- Simple API for users
- Harness manages all complexity (context, parallelization, state)
- Consistent prompts and behavior
- Harness can optimize execution order

Cons:
- Less flexibility for custom orchestration
- Harder to integrate with external workflow systems
- Harness complexity increases significantly

**Option B: Caller-Owned Loop (External Orchestration)**

The caller (Claude Code, custom agent, etc.) drives execution via CLI or tools:

```bash
# Caller asks: "What's next?"
markform next parent.form.md
# Returns: { "action": "fill_subform", "row": 0, "formRef": "company-research.form.md", "context": {...} }

# Caller fills subform
markform fill subforms/acme.form.md --context '{"company": "Acme", ...}'

# Caller marks complete
markform complete-subform parent.form.md --row 0 --subformPath subforms/acme.form.md
```

Pros:
- Maximum flexibility
- Caller can use any orchestration system
- Easy to parallelize externally
- Works with MCP tools

Cons:
- More complex for simple use cases
- Caller must handle state tracking
- Risk of inconsistent behavior

**Option C: Hybrid (Library Default, Caller Override)**

Library provides complete loop, but exposes hooks for caller control:

```typescript
const result = await fillForm({
  form: parentFormMarkdown,
  model: "claude-sonnet-4-5",
  subformHandler: async (subformContext) => {
    // Caller can:
    // 1. Return null to use default handling
    // 2. Fill subform themselves and return result
    // 3. Delegate to external system

    if (subformContext.depth > 2) {
      // Deep subforms handled externally
      return await externalSystem.fill(subformContext);
    }
    return null; // Use default
  }
});
```

Pros:
- Works out of the box for common cases
- Extensible for advanced use cases
- Progressive disclosure of complexity

Cons:
- API surface area increases
- Need to carefully design subformContext interface

**Recommendation**: Option C (Hybrid) provides the best balance. Start with library-owned loop for v1, add hooks for customization in v2.

* * *

### Design Question 4: Context Propagation

**Question**: What context does a subform agent receive from the parent?

**Option A: Row Context Only**

Subform receives only the values from its row in the parent table:

```typescript
{
  context: {
    company_name: "Acme Corp",
    company_url: "https://acme.com"
  }
}
```

Pros:
- Minimal token usage
- Clear, focused context
- Subform is isolated from other rows

Cons:
- May miss relevant context from other fields
- Can't compare across rows

**Option B: Full Parent Form Context**

Subform receives the entire parent form state:

```typescript
{
  context: {
    parentForm: { /* full form markdown */ },
    currentRow: { /* row data */ },
    rowIndex: 0
  }
}
```

Pros:
- Maximum context available
- Can reference any parent field
- Can see other rows for comparison

Cons:
- High token usage
- May confuse agent with irrelevant context
- Larger prompts = slower/more expensive

**Option C: Configurable Context Scope**

Let the form designer specify what context to propagate:

```jinja
{% field kind="table" id="companies"
   columnTypes=["string", "url", "subform:company-research.form.md"]
   subformContext=["company_name", "company_url", "parent:industry"] %}
```

Pros:
- Flexible per use case
- Designer controls token budget
- Can include specific parent fields

Cons:
- More syntax complexity
- Designer must understand context implications

**Option D: Automatic Context Selection**

Harness automatically includes:
- Row values (always)
- Parent form title/description
- Any fields referenced in subform instructions

Pros:
- Smart defaults
- No configuration needed for common cases

Cons:
- Harder to predict what's included
- May include too much or too little

**Recommendation**: Option D (automatic) with Option C (explicit override) for fine-tuning.

* * *

### Design Question 5: Field Filling Order and Dependencies

**Question**: In what order should fields (including subforms) be filled?

**Current Markform Behavior**:
- Fields are filled in priority order based on issues
- All fields are generally independent
- Harness decides order based on validation state

**New Considerations with Subforms**:

**Option A: Linear (Parent First, Then Subforms)**

1. Fill all regular parent fields
2. For each row with a subform, fill the subform
3. Complete

Pros:
- Simple to implement
- Predictable order
- Subforms get complete row context

Cons:
- May be slow (sequential)
- Can't start subforms until all parent fields done

**Option B: Eager Subforms (Fill ASAP)**

Fill subforms as soon as their row has required context:

1. Fill parent field A
2. Fill parent field B (row 0 now has enough context)
3. Start subform for row 0 (in parallel with step 4)
4. Fill parent field C
5. Complete remaining subforms

Pros:
- Faster overall (parallelism)
- More efficient use of time

Cons:
- Complex dependency tracking
- Subform may need re-filling if parent context changes

**Option C: Explicit Dependencies**

Form designer specifies dependencies:

```jinja
{% field kind="subform" id="details"
   dependsOn=["company_name", "company_url"] %}
```

Pros:
- Clear control over order
- Prevents premature subform filling

Cons:
- More configuration burden
- Easy to get wrong

**Option D: Semantic Analysis**

Harness analyzes subform instructions to infer dependencies:

"Research the company {{company_name}} at {{company_url}}" → depends on company_name, company_url

Pros:
- Automatic for well-written instructions
- No explicit configuration

Cons:
- Unreliable if instructions don't use variables
- Complex to implement

**Recommendation**: Option A (linear) for v1 simplicity, with Option C (explicit dependencies) as an optional enhancement.

* * *

### Design Question 6: Parallelization Control

**Question**: How should parallel subform filling be configured?

**Proposed Configuration**:

```typescript
interface SubformOptions {
  // Maximum concurrent subform fills
  maxConcurrency?: number;  // Default: 5

  // Strategy for parallel execution
  parallelization?:
    | "sequential"    // One at a time
    | "parallel"      // All at once (up to maxConcurrency)
    | "adaptive";     // Start sequential, increase if fast

  // Maximum subform nesting depth
  maxDepth?: number;  // Default: 2

  // Timeout per subform
  subformTimeout?: number;  // Milliseconds
}
```

**Form-Level Parallelization Hints** (Optional):

```jinja
{% field kind="table" id="companies"
   parallelizable=true
   maxConcurrency=10 %}
```

Pros:
- Form designer can indicate independence
- Harness can optimize with hints

Cons:
- More syntax to learn
- Most cases don't need it

**Recommendation**: Start with runtime configuration only. Add form-level hints if needed based on real-world usage.

* * *

### Design Question 7: Error Handling and Partial Completion

**Question**: What happens when a subform fill fails?

**Options**:

**Option A: Fail Fast**
Any subform failure aborts the entire parent form.

Cons: Too aggressive for most use cases.

**Option B: Continue with Errors**
Mark failed subforms as "aborted" with error reason, continue others.

```jinja
| Acme | https://acme.com | %ABORT% (API rate limit exceeded) |
```

Pros:
- Partial progress preserved
- User can retry failed subforms

**Option C: Retry with Backoff**
Automatically retry failed subforms with exponential backoff.

Pros:
- Handles transient failures
- Better completion rate

Cons:
- Longer execution time
- May retry hopeless failures

**Recommendation**: Option B (continue with errors) + Option C (configurable retries).

* * *

## Comparative Analysis

| Aspect | Access | Excel | Typeform | JSON Schema | Markform (Proposed) |
| --- | --- | --- | --- | --- | --- |
| **Subform mechanism** | Embedded form control | Not native | Branching logic | $ref composition | Subform column type |
| **Data relationship** | 1:N via foreign key | Manual linking | Conditional paths | Nested objects | Table row → subform file |
| **Linking method** | Link Master/Child Fields | Named ranges | Logic jumps | $ref pointer | formRef attribute |
| **Parallelization** | N/A (UI-driven) | N/A | N/A | N/A | maxConcurrency config |
| **Context sharing** | Automatic filtering | Formula references | Variable piping | Parent schema access | Configurable propagation |
| **Nesting depth** | Unlimited | ~2-3 levels | Flat with jumps | Unlimited | Configurable (default: 2) |

**Strengths/Weaknesses Summary**:

- **Access**: Rich subform model but UI-focused, not text/agent-friendly
- **Excel**: Limited nesting, but data validation patterns are relevant
- **Typeform**: Good branching logic, but not true subforms
- **JSON Schema**: Strong composition model, directly applicable to Markform's schema export
- **Markform (Proposed)**: Can combine best aspects: Access's master-detail, JSON Schema's $ref, modern agent orchestration

* * *

## Best Practices

Based on research findings, the following best practices should guide implementation:

1. **Start Simple**: Begin with table-based subforms (one-to-many), add standalone subforms later

2. **External Storage**: Store subforms in separate files to keep parent forms manageable

3. **Row Context by Default**: Subforms should receive their row's data automatically; full form context should be opt-in

4. **Conservative Concurrency**: Default to 5 concurrent subforms; let users increase if needed

5. **Shallow Hierarchies**: Limit nesting depth to 2-3 levels by default (like Excel's practical limit)

6. **Clear Naming**: Use deterministic file naming for subforms: `{parentId}/{rowIndex}-{fieldId}.form.md`

7. **Graceful Degradation**: Failed subforms should be marked as aborted, not fail the entire form

8. **Library-First**: Keep the agentic loop in the library by default; expose hooks for advanced users

* * *

## Open Research Questions

1. **Cross-Subform References**: Can a subform reference data from another subform (sibling relationship)? This adds significant complexity.

2. **Subform Templates**: Should subforms use the same template for all rows, or can templates vary by row? (e.g., different research form for different company types)

3. **Incremental Updates**: If parent row data changes after subform is filled, should subform be re-filled? How to detect staleness?

4. **MCP Integration**: How should subform filling work when Markform is exposed as an MCP tool? Should MCP tools expose subform operations?

5. **Progress Visualization**: How should the CLI/UI show progress for deeply nested forms? What's the right UX?

6. **Token Budget Allocation**: For parallel subforms, how should the total token budget be allocated across subagents?

* * *

## Recommendations

### Summary

Based on this research, we recommend a phased approach to implementing subforms in Markform:

### Phase 1: Table-Based Subforms (MVP)

1. **New column type**: `subform:path/to/template.form.md`
2. **External storage**: Subforms stored in `{formDir}/subforms/{parentFieldId}/{rowIndex}.form.md`
3. **Linear execution**: Fill parent fields first, then subforms sequentially
4. **Row context**: Pass row values as `inputContext` to subform harness
5. **Library-owned loop**: Extend current harness with recursive call for subforms

### Phase 2: Parallel Execution

1. **Concurrency config**: Add `maxConcurrency` to `FillOptions`
2. **Parallel subform filling**: Fill N subforms concurrently
3. **Progress callbacks**: Extend `FillCallbacks` with `onSubformStart`, `onSubformComplete`
4. **Error handling**: Mark failed subforms as aborted, continue others

### Phase 3: Advanced Features

1. **Standalone subform fields**: Non-table subform references
2. **Context configuration**: `subformContext` attribute for custom context
3. **Subform handler hook**: Allow caller to override subform filling
4. **Depth limits**: Configurable `maxDepth` with default of 2

### Rationale

This phased approach:
- Delivers value quickly with MVP table-based subforms
- Follows proven patterns from Access (master-detail) and modern agent systems (orchestrator-worker)
- Keeps complexity manageable by deferring advanced features
- Maintains Markform's design principles: text-based, human-readable, agent-friendly

### Alternative Approaches

**Alternative: Caller-Owned Loop First**
Instead of extending the harness, expose a "next action" CLI command that callers use to drive execution. This is more flexible but shifts complexity to callers.

**When to consider**: If primary users are sophisticated orchestrators (Claude Code, custom agents) rather than direct API users.

**Alternative: Inline Subforms**
Embed subform content directly in parent form rather than external files.

**When to consider**: If forms are typically small and single-file simplicity is paramount. Not recommended for deep research use cases.

* * *

## References

### Microsoft Access
- [Create a form that contains a subform - Microsoft Support](https://support.microsoft.com/en-us/office/create-a-form-that-contains-a-subform-a-one-to-many-form-ddf3822f-8aba-49cb-831a-1e74d6f5f06b)
- [SubForm.Parent property - Microsoft Learn](https://learn.microsoft.com/en-us/office/vba/api/access.subform.parent)
- [Link Master Fields Best Practices - FMS Inc](http://www.fmsinc.com/microsoftaccess/forms/subform/master-link-fields.asp)

### Excel
- [Excel Data Validation Dependent Lists - Contextures](https://www.contextures.com/exceldatavaldependindextablesindirect.html)
- [Power Query nested data types - CrossJoin](https://blog.crossjoin.co.uk/2023/12/23/power-query-nested-data-types-in-excel/)

### Typeform
- [What is Logic? - Typeform Help](https://help.typeform.com/hc/en-us/articles/360029116392-What-is-Logic)
- [Use Branching Logic - Typeform](https://www.typeform.com/help/a/use-branching-and-calculations-in-logic-to-show-relevant-questions-360054770931/)

### JSON Schema
- [JSON Schema - Boolean combination](https://json-schema.org/understanding-json-schema/reference/combining)
- [oneOf, anyOf, allOf - Swagger Docs](https://swagger.io/docs/specification/v3_0/data-models/oneof-anyof-allof-not/)

### AI Agent Orchestration
- [How we built our multi-agent research system - Anthropic](https://www.anthropic.com/engineering/multi-agent-research-system)
- [AI Agent Orchestration Patterns - Azure](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)
- [Recursive Planning - Acta Machina](https://actamachina.com/posts/recursive-planning)
- [Parallel agents - Google ADK](https://google.github.io/adk-docs/agents/workflow-agents/parallel-agents/)
- [Multi-agent - LangChain](https://docs.langchain.com/oss/python/langchain/multi-agent)

### Database Design
- [Universal Database Design Patterns - Redgate](https://www.red-gate.com/blog/database-design-patterns)
- [Closure Table Pattern - Software Patterns Lexicon](https://softwarepatternslexicon.com/patterns-sql/4/2/4/)

### Workflow Orchestration
- [Optimize flows with parallel execution - Power Automate](https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/implement-parallel-execution)
- [Execute parallel steps - Google Cloud Workflows](https://cloud.google.com/workflows/docs/execute-parallel-steps)
- [Map state in Distributed mode - AWS Step Functions](https://docs.aws.amazon.com/step-functions/latest/dg/state-map-distributed.html)
- [Task Concurrency - Apache Airflow](https://www.sparkcodehub.com/airflow/task-management/concurrency)

* * *

## Appendices

### Appendix A: Proposed Syntax Examples

**Table with Subform Column:**

```jinja
{% field kind="table" id="competitor_analysis" label="Competitor Analysis"
   columnIds=["company", "url", "research"]
   columnTypes=["string", "url", "subform:competitor-deep-dive.form.md"]
   minRows=3 maxRows=10 %}
| Company | URL | Research |
|---------|-----|----------|
{% /field %}

{% instructions ref="competitor_analysis" %}
List the top 3-10 competitors. For each, the research subform will be filled
with detailed analysis including product comparison, pricing, and market position.
{% /instructions %}
```

**Filled Table with Subform References:**

```jinja
{% field kind="table" id="competitor_analysis" ... %}
| Company | URL | Research |
|---------|-----|----------|
| Acme Corp | https://acme.com | ✅ ./subforms/competitor_analysis/0.form.md |
| Beta Inc | https://beta.io | ⏳ ./subforms/competitor_analysis/1.form.md |
| Gamma Ltd | https://gamma.co | ❌ %ABORT% (Company website unavailable) |
{% /field %}
```

### Appendix B: Proposed API Extensions

```typescript
interface FillOptions {
  // ... existing options ...

  /**
   * Configuration for subform filling.
   */
  subform?: {
    /**
     * Maximum concurrent subform fills.
     * @default 5
     */
    maxConcurrency?: number;

    /**
     * Maximum nesting depth for recursive subforms.
     * @default 2
     */
    maxDepth?: number;

    /**
     * Timeout per subform in milliseconds.
     * @default 300000 (5 minutes)
     */
    timeout?: number;

    /**
     * Custom handler for subform filling.
     * Return null to use default handling.
     */
    handler?: (context: SubformContext) => Promise<FillResult | null>;
  };
}

interface SubformContext {
  /** Path to subform template */
  templatePath: string;
  /** Path where filled subform should be saved */
  outputPath: string;
  /** Parent form state */
  parentForm: ParsedForm;
  /** Row data from parent table (if table-based) */
  rowData?: Record<string, unknown>;
  /** Row index in parent table */
  rowIndex?: number;
  /** Current nesting depth (0 = top-level) */
  depth: number;
}

interface FillCallbacks {
  // ... existing callbacks ...

  /** Called when starting to fill a subform */
  onSubformStart?: (context: SubformContext) => void;

  /** Called when a subform completes (success or failure) */
  onSubformComplete?: (context: SubformContext, result: FillResult) => void;
}
```

### Appendix C: File Structure Example

```
research-project/
├── main-research.form.md              # Parent form
├── competitor-deep-dive.form.md       # Subform template (reused)
└── subforms/
    └── competitor_analysis/           # Named after parent field ID
        ├── 0.form.md                  # Row 0 (Acme Corp)
        ├── 1.form.md                  # Row 1 (Beta Inc)
        └── 2.form.md                  # Row 2 (Gamma Ltd - aborted)
```
