# Research Brief: Subforms and Recursive Form Filling in Markform

**Last Updated**: 2026-01-05

**Status**: Complete

**Related**:

- [Markform Specification](../../../markform-spec.md)
- [Architecture Design](../../architecture/current/arch-markform-design.md)
- [Harness Implementation](../../../../packages/markform/src/harness/)
- [External Analysis: Subform Design Space](./analysis-subform-design-space.md)

* * *

## Executive Summary

This research brief explores the design space for **subforms** (also called dependent forms, nested forms, or child forms) in Markform. The core question is how to extend Markform's current flat form structure to support hierarchical form-filling scenarios where:

1. A field in a parent form references another form (one-to-one subform)
2. A table column contains references to subforms (one-to-many subform rows)
3. Subforms are filled by subagents with context from the parent form
4. The agentic loop can handle subform structures with appropriate context propagation

This capability would enable deep research workflows where, for example, a form contains a table of companies, and each company row has a "research details" subform that gets filled by a dedicated subagent.

### Key Finding: No Recursive Nesting

Research into production systems (Claude Code, OpenAI Codex) reveals a critical design constraint: **subagents cannot spawn their own subagents**. Claude Code explicitly prohibits this to prevent infinite recursion, simplify debugging, and bound complexity. Markform should adopt this same constraint—subforms should be limited to **one level of nesting only**.

### Key Insights from Production Systems

| System | Architecture | Key Lesson for Markform |
| --- | --- | --- |
| **Claude Code** | Task tool + isolated context windows (200k each) | Context isolation prevents pollution; no nested spawning |
| **OpenAI Codex** | Cloud sandboxes, parallel task execution | Independent tasks can run in parallel; results returned with provenance |
| **OpenAI Agents SDK** | Handoffs (agentic vs programmatic) | Row-only context (programmatic) is usually better than full context (agentic) |

**Research Questions**:

1. What are the precedents for subforms in existing tools (Access, Excel, Typeform, JSON Schema)?
2. How should the Markform syntax and data model be extended to support subforms?
3. Who should own the agentic loop: the library (Markform harness) or the caller (external orchestrator)?
4. How should context be propagated from parent forms to subform agents?
5. What parallelization and concurrency strategies should be supported?
6. How should field filling order and dependencies be handled?
7. What constraints do production agent systems (Claude Code, Codex) suggest for subform nesting?
8. How should subform values be exported (references vs inline vs dual with provenance)?
9. How should multiple related forms be managed as a workspace?

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
- Claude Code Task tool and subagent architecture
- OpenAI Codex and Agents SDK orchestration patterns
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

#### 2.4 Claude Code Task Tool and Subagent Architecture

**Status**: ✅ Complete

Claude Code provides a production-ready implementation of subagent orchestration that directly informs Markform's design:

**Core Architecture**:
- **Task Tool**: The foundational parallel processing engine for spawning subagents
- **Subagents**: Lightweight Claude instances with their own context windows (200k tokens each)
- **Two-Layer Model**: Task tool is the execution engine; subagents are the management layer built on top

**Spawning Mechanism**:
- Subagents are spawned **exclusively through the Task tool**
- Without Task in `allowedTools`, Claude cannot delegate to subagents
- Each subagent maintains separate transcript files (`agent-{agentId}.jsonl`)
- By default, Claude is cautious about spawning and requires explicit delegation instructions

**Context Isolation** (Critical Design Pattern):
- Each subagent operates in its **own isolated context window**
- Prevents "context pollution" of the main conversation
- Only relevant findings are returned to the parent—not the full exploration history
- Example: A research subagent can explore dozens of files without cluttering the main thread

**Tool Permissions**:
- Configurable per subagent via the `tools` field
- Default: inherit all tools from parent (omit `tools` field)
- Restricted: specify comma-separated list (e.g., `tools: Read, Grep, Glob`)
- Role-based patterns:
  - **Read-only agents**: `Read, Grep, Glob` (analyzers, reviewers)
  - **Research agents**: `Read, Grep, Glob, WebFetch, WebSearch`
  - **Code writers**: `Read, Write, Edit, Bash, Glob, Grep`

**Critical Constraint: No Nested Subagents**:
- "Subagents cannot spawn other subagents" — explicit architectural limitation
- **Do NOT include Task in a subagent's `tools` array**
- Prevents: infinite recursion, uncontrolled delegation loops, architectural complexity
- **Implication for Markform**: Maximum one level of subform nesting via subagents

**Parallelization**:
- Parallelism capped at **10 concurrent operations** (tasks queued beyond this)
- Task tool supports large numbers of tasks (100+ demonstrated)
- Batch execution: waits for current batch to complete before starting next
- **7-Parallel-Task Method**: Component creation, styles, tests, types, hooks, integration, config—all in parallel

**Result Return**:
- Subagents return findings with **absolute file paths** for references
- Parent agent synthesizes subagent results back to user
- Detection: check for `tool_use` blocks with `name: "Task"`

**Token Cost Considerations**:
- Active multi-agent sessions consume **3-4x more tokens** than single-threaded
- Balance performance gains against token costs
- Group related tasks rather than spawning separate agents for every operation

**Relevance to Markform**:
- **Direct analog**: Parent form = main agent, subforms = subagents via Task tool
- **Context isolation model**: Each subform fill gets isolated context, returns only results
- **No recursive subforms**: Aligns with Claude Code's no-nested-subagents constraint
- **Parallelism cap**: 10 concurrent suggests similar default for Markform (5-10)
- **Tool permissions**: Subform agents could have restricted tool access

**Sources**:
- [Subagents - Claude Code Docs](https://code.claude.com/docs/en/sub-agents)
- [Claude Code: Best practices for agentic coding - Anthropic](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Claude Code Subagent Deep Dive - Code Centre](https://cuong.io/blog/2025/06/24-claude-code-subagent-deep-dive)
- [How to Use Claude Code Subagents - Zach Wills](https://zachwills.net/how-to-use-claude-code-subagents-to-parallelize-development/)
- [Task Tool vs. Subagents - iCodeWith.ai](https://www.icodewith.ai/blog/task-tool-vs-subagents-how-agents-work-in-claude-code/)

* * *

#### 2.5 OpenAI Codex and Agents SDK

**Status**: ✅ Complete

OpenAI Codex represents a different architectural approach—cloud-based parallel task execution:

**Codex Architecture Overview**:
- **Cloud-based agent**: Tasks run in isolated cloud sandbox environments
- **Parallel by default**: Can work on many tasks simultaneously
- **Repository preloading**: Each sandbox is preloaded with your repository
- **Powered by codex-1**: Optimized version of o3 for software engineering

**Cloud Sandbox Model**:
- Each task runs in its own **Docker-like sandbox** environment
- Internet access **disabled during execution** (security isolation)
- Agent interacts only with explicitly provided code and pre-installed dependencies
- Container state cached for up to 12 hours (speeds up follow-up tasks)
- Task completion: 1-30 minutes depending on complexity

**Parallel Task Execution**:
- Developers can queue multiple tasks (features, docs, refactoring, bugs)
- Tasks execute independently in separate containers
- Results returned independently as each completes
- No explicit concurrency limit documented (infrastructure-dependent)

**Control Plane Architecture**:
- Codex acts as a **control plane** routing tasks to execution surfaces:
  - Local IDE/terminal (lowest latency)
  - Cloud sandbox (reproducible, isolated)
  - Server-side via SDK (background automation)
- Maintains shared **task graph** and **contextual memory** across executions
- "Run anywhere" approach—not IDE-bound

**OpenAI Agents SDK (Evolution of Swarm)**:
- Production-ready multi-agent orchestration framework
- Key primitives:
  - **Agents**: LLMs with instructions and tools
  - **Handoffs**: Delegate to other agents for specific tasks
  - **Guardrails**: Validate agent inputs/outputs
  - **Sessions**: Maintain conversation history across runs

**Handoff Patterns**:
Two fundamental handoff types:
1. **Agentic Handoff**: Entire message history passed to next agent (full context transfer)
2. **Programmatic Handoff**: Only required information passed (selective context)

**Multi-Agent Workflow Example** (from Codex + Agents SDK):
- Project Manager → Designer → Frontend Dev → Backend Dev → Tester
- Each agent has scoped instructions and output folders
- Handoffs transfer control based on task completion
- Tracing captures prompts, tool calls, execution times for debugging

**Function Calling**:
- Swarm/Agents SDK automatically converts functions to JSON Schema
- Docstrings become function descriptions
- Type hints map to parameter types
- Handoffs are a subset of tools that transfer control

**Latest Model (GPT-5-Codex)**:
- Further optimized for agentic software engineering
- Can work independently for **7+ hours** on complex tasks
- Iterates on implementation, fixes test failures, delivers working code

**Relevance to Markform**:
- **Sandbox isolation**: Each subform fill could run in isolated context (like Codex containers)
- **Parallel independence**: Subforms are naturally independent tasks (like Codex tasks)
- **Handoff patterns**: Agentic (full context) vs programmatic (row-only) maps to Markform context propagation options
- **Control plane concept**: Markform harness as control plane routing to subform execution
- **Verifiable evidence**: Codex returns citations/logs; subforms could return fill provenance

**Key Difference from Claude Code**:
- Codex: Heavy isolation (separate containers), cloud-first, long-running
- Claude Code: Light isolation (context windows), local-first, quick delegation
- **For Markform**: Claude Code's lightweight model is more appropriate for form filling

**Sources**:
- [Introducing Codex - OpenAI](https://openai.com/index/introducing-codex/)
- [Codex Cloud Environments - OpenAI Developers](https://developers.openai.com/codex/cloud/environments/)
- [Use Codex with the Agents SDK - OpenAI](https://developers.openai.com/codex/guides/agents-sdk/)
- [Building Consistent Workflows with Codex CLI & Agents SDK - OpenAI Cookbook](https://cookbook.openai.com/examples/codex/codex_mcp_agents_sdk/building_consistent_workflows_codex_cli_agents_sdk)
- [OpenAI Agents SDK - GitHub](https://openai.github.io/openai-agents-python/)
- [Orchestrating Agents: Routines and Handoffs - OpenAI Cookbook](https://cookbook.openai.com/examples/orchestrating_agents)
- [OpenAI Swarm - GitHub](https://github.com/openai/swarm)

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

### Markform's Core Constraints Relevant to Subforms

Before exploring design options, it's important to understand how Markform's existing design shapes what subforms can look like:

1. **Single text file and forms-as-context**: A `.form.md` document intentionally co-locates instructions (Markdown), schema (Markdoc tags), and values (inline in tags). This is explicit context engineering—everything needed to fill/validate/review is in one diff-friendly file.

2. **Global ID uniqueness**: Structural IDs (form/group/field) must be globally unique within a document. Option IDs are only unique within their field. This constraint matters significantly for embedded/repeated subforms.

3. **Patch-based editing**: The tool API centers on typed patch operations (`set_string`, `set_table`, `skip_field`, `abort_field`), not "rewrite the doc". Subforms must fit the patch vocabulary and `inspect`/issue model.

4. **Incremental filling + validation loop**: Markform expects: `inspect` → learn what's missing → `patch` → `inspect` again → repeat until complete. Subforms must participate in this completion and validation story.

5. **Tables are rows of scalars**: Table rows are `Record<ColumnId, CellValue>`. Notably, there's no first-class row identity (no row IDs), which matters for per-row subforms.

### Four Design Families for Subforms

Based on external analysis and survey of existing systems, subform implementations fall into four design families:

#### Family A: Separate Files, Referenced from Parent

The "relational/linked record" approach—subforms live in separate `.form.md` files.

**What it looks like:**

```jinja
{% field kind="subform_ref" id="market_analysis" label="Market analysis" required=true %}
```value
forms/market-analysis.form.md
```
{% /field %}
```

For tables, an explicit ref column:

```jinja
{% field kind="table" id="companies" label="Companies"
   columnIds=["company_id","company","url","research_form"]
   columnTypes=["string","string","url","string"] %}
| company_id | company | url | research_form |
| --- | --- | --- | --- |
| acme | Acme Inc. | https://acme.com | forms/company-acme.research.form.md |
| globex | Globex | https://globex.com | forms/company-globex.research.form.md |
{% /field %}
```

**Pros:**
- Respects Markform's global-unique ID rule (each file is its own namespace)
- Compatible with existing tool API (`inspect`/`apply`/`export` per form)
- Scales to many subforms without one enormous file
- Avoids reinventing row identity inside Markform
- Easy to parallelize—each subform is independent

**Cons:**
- Loses "everything in one file" context advantage
- Reviewers must jump between files
- Requires file naming conventions and lifecycle management
- Needs a "workspace" notion for caller-owned orchestration

#### Family B: Embedded Subforms Inside One Document

The "single file contains the whole tree" approach.

**What it looks like:**

```jinja
{% field kind="subform" id="market_analysis" label="Market analysis" required=true %}
  {% form id="market_analysis_form" %}
    {% field kind="string" id="tam" label="TAM" role="agent" required=true %}{% /field %}
    {% field kind="string_list" id="competitors" label="Competitors" role="agent" %}{% /field %}
  {% /form %}
{% /field %}
```

**The ID scoping problem:** If you embed 10 identical company research subforms, you either:
- Rename every field ID with a prefix (`acme_revenue`, `globex_revenue`), or
- Change the spec to allow local scopes and path addressing

Changing the ID model is a **major shift** because:
- Patch operations currently take `fieldId: Id` (simple string)
- Inspection issues reference `ref: Id`
- If IDs become non-unique, you need fully-qualified paths (like JSON Pointer), cascading through patches, issues, doc blocks, and derived metadata

**Pros:**
- Strongly preserves "single file = full context"
- Great for human review (one artifact)
- Export is straightforward (tree already present)

**Cons:**
- Forces redesign of ID scoping and patch addressing for repetition
- Document can become huge and unwieldy
- Canonicalization/serialization complexity increases
- Table+subform-per-row is awkward inside Markdown tables

**Verdict:** Possible but requires "big spec changes."

#### Family C: Repeatable Groups (Array of Objects)

The "JSON Schema style" approach in Markform's Markdoc idiom.

**What it looks like:**

```jinja
{% group id="companies" label="Companies" repeat=true itemLabel="Company" %}
- {% group id="acme" label="Acme Inc." %}
    {% field kind="string" id="company" label="Company" %}…{% /field %}
    {% field kind="url" id="url" label="URL" %}…{% /field %}

    {% group id="research" label="Research details" %}
      {% field kind="string" id="summary" label="Summary" role="agent" required=true %}{% /field %}
      {% field kind="single_select" id="rating" label="Rating" role="agent" %}…{% /field %}
    {% /group %}
  {% /group %}
- {% group id="globex" label="Globex" %}…{% /group %}
{% /group %}
```

Each repeated instance gets a stable ID (`acme`, `globex`), and nested structure is natural.

**Pros:**
- Models domain accurately: companies are objects, not table rows
- Stable identity is natural (instance ID)
- Easy to attach nested structures per object

**Cons:**
- Requires scoped IDs or multiple files (collapses to Family A)
- Harder for quick "glanceable" summary than a table
- Would need tooling to project a summary table

#### Family D: Hybrid—Table with First-Class Row Identity

The "Airtable in a text file" approach—keep tables but add stable row IDs.

**Option D1: Require explicit row_id column**
- First column is row identity
- Markform tooling enforces uniqueness
- Subform instances are keyed to row IDs

**Option D2: Row annotations in table syntax**
Allow per-row Markdoc annotations (but Markdown tables don't naturally support this).

**Option D3: Derived metadata**
Parser assigns row IDs stored in frontmatter (breaks when humans edit tables manually).

**Practical choice: D1** (explicit key column in source).

**Pros:**
- Preserves table editing experience
- Introduces stability for row-attached subforms
- Enables nice UIs (table + "open details")

**Cons:**
- Requires users to think in IDs/keys
- Still need to decide where subform data lives
- More spec surface area (row identity rules, uniqueness)

### Design Family Comparison

| Family | Best When | Main Risk |
| --- | --- | --- |
| **A (separate files)** | Need repetition (per-row subforms); want minimal spec disruption; care about parallel execution | Context fragmentation unless you standardize context injection |
| **B (embedded)** | Truly want "one artifact" and subforms are few (not repeated) | ID scoping + patch addressing gets complicated fast |
| **C (repeatable groups)** | Want native hierarchical schema model like JSON Schema | Requires scoped IDs or multi-file anyway |
| **D (table + row IDs)** | Strongly want "spreadsheet table feel" in source | Evolving toward relational features (scope increase) |

**Recommendation:** Family A (separate files) + Family D1 (explicit row IDs) for Phase 1. This gives stable identity, parallelism, no redesign of field IDs or patch addressing, and clean separation between parent and subform lifecycles.

* * *

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

#### Context Propagation Modes

Based on external analysis and production patterns (OpenAI Agents SDK handoffs), there are four distinct modes:

| Mode | What's Included | Token Cost | Best For |
| --- | --- | --- | --- |
| **minimal** | Row context only (company + url) | Lowest | Independent research tasks |
| **parent_values** | Exported parent values JSON | Low-medium | Tasks needing parent context |
| **parent** | Entire parent form markdown | High | Tasks requiring full context |
| **workspace** | Include other completed subforms | Highest | Cross-referencing (rare) |

**Mode 1: Minimal (Row Context Only)**

Subform receives only the values from its row in the parent table:

```typescript
{
  context: {
    company_name: "Acme Corp",
    company_url: "https://acme.com"
  }
}
```

**Pros:** Minimal token usage, clear focus, isolated from other rows
**Cons:** May miss relevant parent context, can't compare across rows
**Maps to:** OpenAI Agents SDK "programmatic handoff"

**Mode 2: Parent Values (Exported JSON)**

Subform receives row context plus exported parent values:

```typescript
{
  rowContext: {
    company_name: "Acme Corp",
    company_url: "https://acme.com"
  },
  parentValues: {
    industry: "Enterprise Software",
    research_focus: "Competitive analysis"
  }
}
```

**Pros:** Smaller than full markdown, structured data
**Cons:** Loses instructions/prose context
**Recommended default** for most use cases

**Mode 3: Parent (Full Markdown)**

Subform receives the entire parent form markdown:

```typescript
{
  parentForm: "# Research Project\n{% form %}...",
  currentRow: { /* row data */ },
  rowIndex: 0
}
```

**Pros:** Maximum context, can reference any parent field
**Cons:** High token usage, may confuse agent
**Maps to:** OpenAI Agents SDK "agentic handoff"

**Mode 4: Workspace (Cross-Subform)**

Subform can access other completed subforms:

```typescript
{
  rowContext: { /* current row */ },
  siblings: {
    "row_0": { /* completed subform values */ },
    "row_1": { /* completed subform values */ }
  }
}
```

**Pros:** Enables comparison and cross-referencing
**Cons:** Very expensive, potential for confusion
**Use case:** Summary fields that need to see all subforms

#### Configuration Options

**Option A: Schema Attribute**

```jinja
{% field kind="subform_ref" id="research"
   contextMode="parent_values"
   includeFields=["industry", "research_focus"] %}
```

**Option B: Runtime Configuration**

```typescript
const result = await fillForm({
  form: parentFormMarkdown,
  subform: {
    contextMode: "parent_values",
    includeParentFields: ["industry", "research_focus"]
  }
});
```

**Option C: Automatic Selection with Override**

Default to `parent_values` + row context; allow explicit override per subform field or harness config.

**Recommendation**: Default to `parent_values` mode (programmatic handoff) with explicit override capability. Full parent context (agentic handoff) is rarely needed and usually indicates the form structure should be flattened.

* * *

### Design Question 5: Field Filling Order and Dependencies

**Question**: In what order should fields (including subforms) be filled?

**Current Markform Behavior**:
- Fields are filled in priority order based on issues
- All fields are generally independent
- Harness decides order based on validation state

**New Considerations with Subforms**:

#### The Simplest Viable Ordering for v1

For the "companies table + research subforms" use case:

1. **Fill parent "index" fields first** (anything that defines the set of subforms)
2. **Materialize subform instances** (create files or embedded blocks)
3. **Fill subforms** (parallelizable once context is ready)
4. **Fill any parent summary fields** that depend on subform results

This matches how humans work: create list → research each → summarize.

#### Ordering Options

**Option A: Linear (Parent First, Then Subforms)**

1. Fill all regular parent fields
2. For each row with a subform, fill the subform
3. Complete

**Pros:** Simple, predictable, subforms get complete row context
**Cons:** May be slow (sequential), can't start subforms early

**Option B: Eager Subforms (Fill ASAP)**

Fill subforms as soon as their row has required context:

1. Fill parent field A
2. Fill parent field B (row 0 now has enough context)
3. Start subform for row 0 (in parallel with step 4)
4. Fill parent field C
5. Complete remaining subforms

**Pros:** Faster overall (parallelism)
**Cons:** Complex dependency tracking, may need re-filling if context changes

**Option C: Explicit Dependencies via `dependsOn`**

Form designer specifies dependencies:

```jinja
{% field kind="subform_ref" id="research" dependsOn=["company", "url"] %}
```

For computed summary fields that depend on subforms:

```jinja
{% field kind="string" id="overall_findings" dependsOn=["companies.*.research"] %}
```

**Pros:** Clear control, prevents premature filling, enables safe parallelism
**Cons:** More configuration burden, easy to get wrong

**Option D: Semantic Analysis**

Harness analyzes subform instructions to infer dependencies:

"Research the company {{company_name}} at {{company_url}}" → depends on company_name, company_url

**Pros:** Automatic for well-written instructions
**Cons:** Unreliable, complex to implement

#### The `dependsOn` Attribute

Adding `dependsOn` as an optional schema attribute provides:

1. **Ordering hints**: Fields with dependencies filled after their dependencies
2. **Context clues**: Dependencies automatically included in subform context
3. **Parallelism safety**: Fields without cross-dependencies can run in parallel
4. **Validation**: Warn if filling a field whose dependencies are incomplete

**Syntax options:**

```jinja
// Simple field dependencies
{% field kind="subform_ref" id="research" dependsOn=["company", "url"] %}

// Cross-table dependencies (subform depends on values in parent table)
{% field kind="subform_ref" id="deep_dive" dependsOn=["parent:industry", "row:company"] %}

// Summary field depending on all subforms
{% field kind="string" id="synthesis" dependsOn=["companies[*].research"] %}
```

**Recommendation**: Option A (linear) for v1 simplicity. Add `dependsOn` in Phase 3 as an optional enhancement for:
- Improving context passed to subagents
- Avoiding premature filling
- Enabling safe parallel execution decisions

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

### Design Question 8: Export Semantics

**Question**: How should filled subforms be represented when exporting values?

#### Export Option 1: References Only

Parent export includes table rows, subform refs as strings/paths:

```json
{
  "companies": [
    {
      "company": "Acme Inc.",
      "url": "https://acme.com",
      "research": "./subforms/companies/0.form.md"
    }
  ]
}
```

**Pros:** Simple, lightweight, preserves source of truth
**Cons:** Caller must load N more files to get full data

#### Export Option 2: Inline Subform Values (Recursive)

Parent export recursively reads subforms and returns nested JSON:

```json
{
  "companies": [
    {
      "company": "Acme Inc.",
      "url": "https://acme.com",
      "research": {
        "summary": "Market leader in widgets...",
        "rating": "strong",
        "competitive_position": "..."
      }
    }
  ]
}
```

**Pros:** What most users want—complete data tree
**Cons:** Requires filesystem/workspace notion, recursion rules

#### Export Option 3: Dual (Inline + Provenance)

Return both nested values AND source pointers for traceability:

```json
{
  "companies": [
    {
      "company": "Acme Inc.",
      "url": "https://acme.com",
      "research": {
        "_source": "./subforms/companies/0.form.md",
        "_status": "complete",
        "summary": "Market leader in widgets...",
        "rating": "strong"
      }
    }
  ]
}
```

**Pros:** Complete data plus provenance, useful for debugging and audit
**Cons:** More verbose output format

#### Validation/Completion and Subforms

How should parent form completion relate to subform completion?

| Validation Mode | Parent "Complete" When | Use Case |
| --- | --- | --- |
| **Strict** | All required subform refs point to complete subforms | High-integrity workflows |
| **Loose** | Subform refs are non-empty and files exist | Iterative/draft workflows |
| **Independent** | Parent and subforms validated separately | Maximum flexibility |

**Recommendation**: Export Option 2 (inline values) as default with Option 3 (dual with provenance) as a flag. Use strict validation for production, loose for development.

* * *

### Design Question 9: Workspace and Multi-Form Management

**Question**: How should multiple related forms be managed as a unit?

With external subforms (Family A), you need a concept of "workspace"—a collection of related forms that can be operated on together.

#### Workspace Responsibilities

1. **Discovery**: Find all forms in a project (parent + subforms)
2. **Status aggregation**: "What's the overall completion status?"
3. **Coordinated operations**: Inspect/fill across multiple forms
4. **Dependency tracking**: Which subforms depend on which parent fields?

#### Option A: Implicit Workspace (Convention-Based)

Forms in a directory tree are a workspace:

```
research-project/
├── main.form.md              # Parent
└── subforms/
    └── companies/
        ├── 0.form.md
        └── 1.form.md
```

`markform inspect .` inspects all forms and aggregates status.

**Pros:** No configuration, works with existing file layouts
**Cons:** Less explicit, may pick up unrelated forms

#### Option B: Explicit Workspace Manifest

A workspace file defines the forms:

```yaml
# .markform-workspace.yaml
parent: main.form.md
subforms:
  companies: subforms/companies/*.form.md
```

**Pros:** Explicit control, can span directories
**Cons:** Another file to maintain

#### Option C: Parent Form Declares Subforms

Parent form's metadata lists subform patterns:

```jinja
{% form id="research"
   subformPattern="subforms/{fieldId}/{rowIndex}.form.md" %}
```

**Pros:** Self-contained, no external config
**Cons:** Pattern syntax complexity

#### Tool API Implications

For caller-owned orchestration, useful workspace-level operations:

```bash
# Aggregate status across all forms in workspace
markform workspace status .

# What's the next action across the whole workspace?
markform workspace next .
# Returns: { "form": "subforms/companies/0.form.md", "action": "fill", "context": {...} }

# Export entire workspace as nested JSON
markform workspace export . --inline
```

**Recommendation**: Start with Option A (implicit, convention-based) for v1. Add explicit workspace manifest in Phase 2 if needed for complex projects.

* * *

## Comparative Analysis

### Form/Data Systems Comparison

| Aspect | Access | Excel | Typeform | JSON Schema | Markform (Proposed) |
| --- | --- | --- | --- | --- | --- |
| **Subform mechanism** | Embedded form control | Not native | Branching logic | $ref composition | Subform column type |
| **Data relationship** | 1:N via foreign key | Manual linking | Conditional paths | Nested objects | Table row → subform file |
| **Linking method** | Link Master/Child Fields | Named ranges | Logic jumps | $ref pointer | formRef attribute |
| **Parallelization** | N/A (UI-driven) | N/A | N/A | N/A | maxConcurrency config |
| **Context sharing** | Automatic filtering | Formula references | Variable piping | Parent schema access | Configurable propagation |
| **Nesting depth** | Unlimited | ~2-3 levels | Flat with jumps | Unlimited | Configurable (default: 2) |

### Agent Systems Comparison

| Aspect | Claude Code | OpenAI Codex | Anthropic Research | Markform (Proposed) |
| --- | --- | --- | --- | --- |
| **Subagent mechanism** | Task tool spawns subagents | Cloud sandbox tasks | Lead agent + workers | Harness spawns subform fills |
| **Context isolation** | Separate 200k context windows | Separate Docker containers | Separate contexts | Separate form instances |
| **Nesting allowed** | ❌ No (single level only) | N/A (flat task queue) | ❌ No | ❌ No (recommended) |
| **Max concurrency** | 10 (queues beyond) | Infrastructure-dependent | 3-5 subagents | 5-10 (configurable) |
| **Context propagation** | Returns summary only | Task-specific context | Results aggregated | Row context + optional parent |
| **Tool permissions** | Configurable per subagent | Sandbox-limited | Inherited | Inherited (configurable) |
| **Result return** | Findings + file paths | Commits + citations | Synthesized report | Filled subform file |
| **Token overhead** | 3-4x single-threaded | N/A (separate models) | Higher but bounded | Per-subform context |

**Strengths/Weaknesses Summary**:

- **Access**: Rich subform model but UI-focused, not text/agent-friendly
- **Excel**: Limited nesting, but data validation patterns are relevant
- **Typeform**: Good branching logic, but not true subforms
- **JSON Schema**: Strong composition model, directly applicable to Markform's schema export
- **Claude Code**: Production-proven subagent model with context isolation; **no nesting** is a key design decision
- **OpenAI Codex**: Heavy isolation via containers; better for long-running independent tasks
- **Markform (Proposed)**: Can combine best aspects: Access's master-detail, JSON Schema's $ref, Claude Code's context isolation and single-level constraint

* * *

## Best Practices

Based on research findings—especially lessons from Claude Code and OpenAI Codex—the following best practices should guide implementation:

### Architecture Principles (from Claude Code/Codex)

1. **No Recursive Subforms**: Follow Claude Code's proven constraint—subforms cannot spawn their own subforms. This prevents infinite recursion, simplifies debugging, and bounds complexity. Maximum depth = 1 level.

2. **Context Isolation**: Each subform fill should operate in isolated context (like Claude Code's separate 200k context windows). Only return relevant findings to parent, not full exploration history.

3. **Conservative Concurrency**: Default to 5-10 concurrent subforms (Claude Code caps at 10). Queue excess work rather than failing. Higher isn't always faster due to overhead.

4. **Token Budget Awareness**: Multi-agent sessions consume 3-4x more tokens. Group related tasks rather than spawning separate agents for every small operation.

### Form Design Principles

5. **Start Simple**: Begin with table-based subforms (one-to-many), add standalone subforms later

6. **External Storage**: Store subforms in separate files to keep parent forms manageable (like Codex's separate containers)

7. **Row Context by Default**: Subforms should receive their row's data automatically; full form context should be opt-in (programmatic handoff > agentic handoff for most cases)

8. **Clear Naming**: Use deterministic file naming for subforms: `{parentId}/{rowIndex}-{fieldId}.form.md`

### Operational Principles

9. **Graceful Degradation**: Failed subforms should be marked as aborted, not fail the entire form (partial progress is valuable)

10. **Library-First**: Keep the agentic loop in the library by default; expose hooks for advanced users (like Claude Code's Task tool abstraction)

11. **Configurable Tool Permissions**: Allow restricting tools available to subform agents (read-only analyzers vs full write access)

12. **Batch Execution**: Process subforms in batches, waiting for batch completion before starting next (Claude Code pattern)

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

Based on this research—combining insights from existing form systems (Access, JSON Schema), production agent systems (Claude Code, OpenAI Codex), and external analysis—we recommend a phased approach that prioritizes minimal spec disruption while enabling powerful subform workflows.

### Critical Design Decisions

#### 1. Single-Level Nesting Only

**Subforms CANNOT contain their own subforms.** This follows Claude Code's explicit architectural constraint and prevents:
- Infinite recursion chains
- Exponential complexity growth
- Debugging nightmares
- Unbounded token consumption

If a use case seems to require deeper nesting, the solution is to flatten the hierarchy or have the parent form orchestrate multiple independent subforms.

#### 2. Design Family Choice: A + D1

Recommend **Family A (separate files)** combined with **Family D1 (explicit row IDs)**:
- Subforms live in separate `.form.md` files
- Tables use an explicit ID column as stable row keys
- Subform instances are keyed to row IDs
- No changes to Markform's global ID uniqueness rule
- No changes to patch addressing model

This gives: stable identity, parallelism, no redesign of core spec, clean separation between parent and subform lifecycles.

#### 3. Context Propagation Default

Default to **`parent_values` mode** (programmatic handoff):
- Row values always included
- Parent form's exported values included (not raw markdown)
- Full parent context is opt-in, not default

This aligns with OpenAI Agents SDK's finding that programmatic handoff (selective context) usually outperforms agentic handoff (full context).

### Phase 1: External Subforms with Row IDs (MVP)

**Goal**: Enable the "companies table + research subforms" use case with minimal spec changes.

1. **Standardize table-of-entities pattern**:
   - Require a `*_id` column as stable row key (e.g., `company_id`)
   - Include a `research_form` column for subform file path

2. **New `subform_ref` column type** (optional syntactic sugar):
   ```jinja
   columnTypes=["string", "url", "subform_ref:company-research.form.md"]
   ```

3. **File storage convention**:
   - Subforms stored in `{formDir}/subforms/{fieldId}/{rowId}.form.md`
   - Or explicit paths in table cells

4. **Harness logic**:
   - Fill table columns (at least ID/name/url) first
   - Generate missing subform files from template
   - Fill subforms sequentially (v1)
   - Return to parent for any summary fields

5. **Validation semantics**:
   - Loose by default: subform ref is valid if file exists
   - Strict mode: subform ref is valid only if subform is complete

6. **No nested subforms**: Subform harness call cannot trigger further subform fills

### Phase 2: Workspace and Parallel Execution

**Goal**: Enable efficient parallel filling and workspace-level operations.

1. **Workspace concept**:
   - Implicit workspace: forms in directory tree are a unit
   - `markform workspace status .` aggregates all form status
   - `markform workspace next .` returns next action across all forms

2. **Parallel subform filling**:
   - Add `maxConcurrency` to `FillOptions` (default: 5, max: 10)
   - Batch execution: wait for batch before starting next
   - Progress callbacks: `onSubformStart`, `onSubformComplete`, `onBatchComplete`

3. **Export enhancements**:
   - Default: inline subform values (recursive)
   - Flag: include provenance metadata (`_source`, `_status`)
   - Workspace export: entire tree as nested JSON

4. **Error handling**:
   - Mark failed subforms as aborted
   - Continue filling other subforms
   - Configurable retry with backoff

### Phase 3: Dependencies and Context Configuration

**Goal**: Enable smart ordering and fine-grained context control.

1. **`dependsOn` attribute**:
   ```jinja
   {% field kind="subform_ref" id="research" dependsOn=["company", "url"] %}
   ```
   - Ordering hints for fill sequence
   - Auto-include dependencies in subform context
   - Enable safe parallel execution

2. **Context propagation modes**:
   - `minimal`: row context only
   - `parent_values`: row + parent exported values (default)
   - `parent`: full parent markdown
   - `workspace`: include sibling subforms (expensive)

3. **Subform handler hook**:
   ```typescript
   subformHandler: async (context) => {
     // Return null for default, or custom fill result
   }
   ```

4. **Tool permissions per subform**:
   - Read-only agents: `tools: ["web_search"]`
   - Full access: inherit parent tools

### Phase 4: Embedded Subforms (Only If Needed)

**Goal**: Support single-file subforms for simple cases.

**Only pursue if Phase 1-3 prove insufficient.** This requires:
- Scoped IDs or path addressing in patches
- Changes to issue references
- More complex canonicalization

The external analysis notes this is "big spec changes" territory—avoid unless clear user demand.

### Decision Matrix

| Decision | Recommendation | Rationale |
| --- | --- | --- |
| **Design family** | A + D1 (separate files + row IDs) | Minimal spec disruption, proven patterns |
| **Nesting depth** | 1 level only | Claude Code constraint, bounded complexity |
| **Context default** | `parent_values` (programmatic) | Token efficiency, focus |
| **Concurrency** | 5 default, 10 max | Claude Code proven limits |
| **Export default** | Inline values | What users want |
| **Validation default** | Loose (file exists) | Supports iterative workflows |
| **Loop ownership** | Library-first, hooks for callers | Progressive complexity |
| **Workspace** | Implicit (convention-based) | Zero config for common case |

### Rationale

This phased approach:
- **Follows production-proven patterns**: Claude Code's no-nested-subagents, context isolation, batch execution
- **Minimizes spec disruption**: Family A + D1 requires no changes to ID model, patch addressing, or validation
- **Delivers value quickly**: MVP enables the core "table + per-row research" use case
- **Follows proven patterns**: Access (master-detail), JSON Schema ($ref), Claude Code (context isolation)
- **Keeps complexity bounded**: Single-level nesting prevents exponential growth
- **Maintains Markform's design principles**: text-based, human-readable, agent-friendly
- **Enables caller control**: Workspace commands support caller-owned orchestration (Claude Code, MCP tools)
- **Integrates external analysis**: Design families framework and phased approach align with prior research

### Alternative Approaches

**Alternative: Caller-Owned Loop (External Orchestration)**

Instead of extending the harness, expose a "next action" CLI command that callers use to drive execution:

```bash
markform next parent.form.md
# Returns: { "action": "fill_subform", "row": 0, "formRef": "...", "context": {...} }

markform fill subforms/acme.form.md --context '{"company": "Acme", ...}'

markform complete-subform parent.form.md --row 0 --subformPath subforms/acme.form.md
```

**When to consider**: If primary users are sophisticated orchestrators (Claude Code, custom agents) that want full control over parallelization and error handling.

**Hybrid approach**: Implement library-owned loop first, but design it so the CLI commands exist and can be called externally. This matches how Claude Code's Task tool works—it abstracts complexity but the primitives are accessible.

**Alternative: Inline Subforms**

Embed subform content directly in parent form rather than external files.

**When to consider**: If forms are typically small and single-file simplicity is paramount. Not recommended for research use cases with many subforms.

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

### Claude Code
- [Subagents - Claude Code Docs](https://code.claude.com/docs/en/sub-agents)
- [Claude Code: Best practices for agentic coding - Anthropic](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Building agents with the Claude Agent SDK - Anthropic](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
- [Subagents in the SDK - Claude Docs](https://platform.claude.com/docs/en/agent-sdk/subagents)
- [Claude Code Subagent Deep Dive - Code Centre](https://cuong.io/blog/2025/06/24-claude-code-subagent-deep-dive)
- [How to Use Claude Code Subagents - Zach Wills](https://zachwills.net/how-to-use-claude-code-subagents-to-parallelize-development/)
- [Task Tool vs. Subagents - iCodeWith.ai](https://www.icodewith.ai/blog/task-tool-vs-subagents-how-agents-work-in-claude-code/)
- [Best practices for Claude Code subagents - PubNub](https://www.pubnub.com/blog/best-practices-for-claude-code-sub-agents/)

### OpenAI Codex and Agents SDK
- [Introducing Codex - OpenAI](https://openai.com/index/introducing-codex/)
- [Codex Cloud Environments - OpenAI Developers](https://developers.openai.com/codex/cloud/environments/)
- [Use Codex with the Agents SDK - OpenAI](https://developers.openai.com/codex/guides/agents-sdk/)
- [Building Consistent Workflows with Codex CLI & Agents SDK - OpenAI Cookbook](https://cookbook.openai.com/examples/codex/codex_mcp_agents_sdk/building_consistent_workflows_codex_cli_agents_sdk)
- [OpenAI Agents SDK - GitHub](https://openai.github.io/openai-agents-python/)
- [Orchestrating Agents: Routines and Handoffs - OpenAI Cookbook](https://cookbook.openai.com/examples/orchestrating_agents)
- [OpenAI Swarm - GitHub](https://github.com/openai/swarm)
- [How Codex ran OpenAI DevDay 2025 - OpenAI](https://developers.openai.com/blog/codex-at-devday/)

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

### Appendix D: Implementation Patterns from Production Systems

#### Claude Code Task Tool Pattern

Claude Code's Task tool provides a model for how Markform's subform filling should work:

```typescript
// How Claude Code spawns subagents (conceptual)
interface TaskToolCall {
  name: "Task";
  parameters: {
    description: string;      // Short description (3-5 words)
    prompt: string;           // Detailed task for subagent
    subagent_type: string;    // Agent type (e.g., "Explore", "Plan")
    model?: string;           // Optional model override
  };
}

// Key constraints enforced by Claude Code:
// 1. Subagents cannot include "Task" in their tools array
// 2. Each subagent gets isolated 200k context window
// 3. Max 10 concurrent tasks (excess queued)
// 4. Batch execution: wait for batch before starting next
```

**Markform Equivalent**:

```typescript
// Proposed Markform subform fill call
interface SubformFillCall {
  parentForm: string;         // Path to parent form
  subformTemplate: string;    // Path to subform template
  outputPath: string;         // Where to save filled subform
  rowContext: {               // Context from parent row
    [fieldId: string]: unknown;
  };
  parentContext?: {           // Optional additional parent context
    title?: string;
    description?: string;
    [fieldId: string]: unknown;
  };
}

// Key constraints (following Claude Code):
// 1. Subform harness call CANNOT trigger further subform fills
// 2. Each subform fill gets isolated context
// 3. Max 5-10 concurrent fills (configurable)
// 4. Batch execution with progress callbacks
```

#### OpenAI Agents SDK Handoff Pattern

The handoff pattern from OpenAI's Agents SDK informs context propagation:

```python
# OpenAI Agents SDK handoff types (conceptual)

# Agentic handoff: Full context transfer
def agentic_handoff(from_agent, to_agent):
    """Pass entire message history to next agent."""
    to_agent.context = from_agent.full_history
    return to_agent.run()

# Programmatic handoff: Selective context
def programmatic_handoff(from_agent, to_agent, required_data):
    """Pass only required information to next agent."""
    to_agent.context = required_data  # e.g., just row values
    return to_agent.run()
```

**Markform Equivalent**:

```typescript
// Context propagation options for subforms
type ContextPropagation =
  | "row"           // Programmatic: only row values (recommended default)
  | "row+parent"    // Row values + parent form metadata
  | "full";         // Agentic: entire parent form (expensive, rarely needed)

interface SubformOptions {
  contextPropagation: ContextPropagation;

  // For "row+parent", specify which parent fields to include
  includeParentFields?: string[];
}

// Example: Row-only context (programmatic handoff)
const rowContext = {
  company_name: "Acme Corp",
  company_url: "https://acme.com"
};

// Example: Row + parent metadata
const rowPlusParent = {
  ...rowContext,
  _parent: {
    title: "Competitor Analysis Research",
    industry: "Enterprise Software"
  }
};
```

#### Codex Cloud Sandbox Pattern

Codex's isolated sandbox model informs error handling and result return:

```typescript
// Codex task result pattern
interface CodexTaskResult {
  status: "completed" | "failed" | "timeout";

  // Verifiable evidence
  citations: {
    file: string;
    line?: number;
    content: string;
  }[];

  // Terminal logs for debugging
  logs: string[];

  // Changes made
  commits?: {
    sha: string;
    message: string;
    files: string[];
  }[];
}
```

**Markform Equivalent**:

```typescript
// Subform fill result
interface SubformFillResult {
  status: "completed" | "aborted" | "timeout";

  // Path to filled subform
  outputPath: string;

  // Fill provenance (like Codex citations)
  provenance?: {
    model: string;
    timestamp: string;
    tokensUsed: number;

    // Sources used during fill
    sources?: {
      type: "web" | "file" | "input";
      reference: string;
    }[];
  };

  // Error details if aborted
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}
```

#### Batch Execution Pattern (from Claude Code)

```typescript
// Claude Code batch execution (conceptual)
async function executeTasks(tasks: Task[], maxConcurrency: number) {
  const batches = chunk(tasks, maxConcurrency);
  const results: TaskResult[] = [];

  for (const batch of batches) {
    // Execute batch in parallel
    const batchResults = await Promise.all(
      batch.map(task => executeTask(task))
    );

    // Wait for entire batch before starting next
    results.push(...batchResults);

    // Optional: callback for progress tracking
    onBatchComplete?.(batchResults);
  }

  return results;
}
```

**Markform Equivalent**:

```typescript
// Subform batch execution
async function fillSubforms(
  subforms: SubformFillCall[],
  options: SubformOptions
): Promise<SubformFillResult[]> {
  const { maxConcurrency = 5 } = options;
  const batches = chunk(subforms, maxConcurrency);
  const results: SubformFillResult[] = [];

  for (const batch of batches) {
    // Execute batch in parallel with isolated contexts
    const batchResults = await Promise.all(
      batch.map(subform => fillSubform(subform, {
        // Subform harness CANNOT spawn further subforms
        allowSubforms: false
      }))
    );

    results.push(...batchResults);

    // Progress callback
    options.callbacks?.onBatchComplete?.(batchResults);
  }

  return results;
}
```

### Appendix E: Why No Recursive Subforms (Detailed Rationale)

Claude Code's prohibition on nested subagents is a deliberate architectural decision. Here's why Markform should follow the same constraint:

#### 1. Infinite Recursion Risk

```
Without constraint:
  Parent form
    → Subform A
      → Subform A.1
        → Subform A.1.1
          → ... (unbounded)
```

Even with a depth limit, the complexity grows exponentially. Claude Code solves this by simply disallowing it.

#### 2. Debugging Complexity

With nested subagents:
- Error in A.1.1 must propagate through A.1 to A to parent
- Each level has its own context, making root cause analysis difficult
- Token usage is hard to attribute

With single level:
- All subforms report directly to parent
- Clear ownership and error attribution
- Simpler mental model

#### 3. Token Budget Management

```
Nested (problematic):
  Parent: 50k tokens
    Child 1: 50k tokens
      Grandchild 1.1: 50k tokens  (150k total for one path!)
      Grandchild 1.2: 50k tokens
    Child 2: 50k tokens
      ...

Single level (bounded):
  Parent: 50k tokens
  Child 1: 50k tokens (isolated)
  Child 2: 50k tokens (isolated)
  ...
  Total = Parent + N × Child (predictable)
```

#### 4. Alternative for "Deep" Use Cases

If you think you need nested subforms, consider:

1. **Flatten**: Make all subforms children of the root form
2. **Sequentialize**: Fill subform 1, use results as context for subform 2
3. **Orchestrate externally**: Use Claude Code or another orchestrator to manage the hierarchy

Example of flattening:
```
Instead of:
  Company Research Form
    → Company Details Subform
      → Executive Profile Subform (nested!)

Do:
  Company Research Form
    → Company Details Subform
    → Executive Profile Subform (sibling, with company context)
```
