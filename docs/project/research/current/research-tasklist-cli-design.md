# Research Brief: Tasklist CLI Design — A Markform Wrapper for Task Management

**Last Updated**: 2026-01-07

**Status**: Draft

**Related**:

- [Markform Specification](../../../markform-spec.md)
- [Markform Architecture](../../architecture/current/arch-markform-design.md)
- [Beads Issue Tracker](https://github.com/steveyegge/beads)

* * *

## Executive Summary

This research brief explores the design of **Tasklist** (`taskl`), a lightweight CLI tool that wraps Markform to provide simple, file-based task management. The goal is to create an alternative to complex issue trackers like Beads that trades off project-wide features for simplicity and single-file focus.

**Core Insight**: Many task management scenarios don't need a project-wide database with dependency graphs and sync mechanisms. Instead, they need a simple, persistent to-do list for a specific task or workflow that can be easily created, manipulated, and archived when done.

**Key Design Principles**:

1. **File-as-Database**: Each task file (`.form.md`) is self-contained—no external database, no sync complexity
2. **Stateless CLI**: The CLI operates on a single file per invocation with no persistent state
3. **Human-Readable**: Task files are standard Markform documents, readable and editable in any editor
4. **Unique IDs**: Each item has a unique ID for reliable programmatic manipulation
5. **Markdown-Native**: Uses checkbox syntax familiar to developers (`- [ ]` / `- [x]`)

**Research Questions**:

1. What is the optimal file format for task lists within Markform's constraints?
2. How should item descriptions/details be attached to checkbox items?
3. What CLI command structure best serves the use case?
4. How should IDs be generated and managed?
5. What workflow patterns should be supported (create, add, check, archive)?

* * *

## Research Methodology

### Approach

- Analysis of existing task management tools (Beads, Taskwarrior, todo.txt)
- Review of Markform's current capabilities and constraints
- Design exploration of CLI patterns and file formats
- Comparative analysis of design alternatives

### Sources

- Beads CLI documentation and source code
- Markform specification and architecture documents
- todo.txt format specification
- Taskwarrior CLI patterns
- Commander.js CLI design patterns

* * *

## Background: Beads vs. Tasklist

### Beads Architecture

Beads is a sophisticated issue tracker designed for agent workflows with:

| Feature | Description | Complexity Cost |
| --- | --- | --- |
| JSONL Database | All issues in a single file | Merge conflicts, sync challenges |
| SQLite Cache | Local performance optimization | Invisible complexity, staleness |
| Hash-Based IDs | Collision-free distributed creation | Additional infrastructure |
| Dependency Graphs | Block/depends-on relationships | Complex state management |
| Background Daemon | Automatic synchronization | Process management overhead |
| Git Integration | Hooks for auto-sync | Repository coupling |

**Beads Strengths**: Project-wide visibility, dependency management, agent optimization

**Beads Challenges**: Database sync across branches, merge conflicts, infrastructure complexity

### Tasklist Philosophy

Tasklist takes the opposite approach—trading features for simplicity:

| Beads | Tasklist |
| --- | --- |
| Project-wide database | Single file per task |
| Complex dependencies | Simple sequential checklist |
| Sync infrastructure | No sync needed |
| Hash-based IDs | Sequential/auto-generated IDs |
| Background daemon | Stateless CLI |
| 600+ issues possible | Focused on single task scope |

**Target Use Cases**:

1. **Session Task Lists**: A developer starting a coding session creates a task list with 5-10 items, checks them off as they work, archives when done
2. **Onboarding Checklists**: A repeatable checklist for new team member setup, copied and filled per person
3. **Release Checklists**: Steps for deploying a release, tracked per deployment
4. **Investigation Notes**: A structured checklist for debugging or research with notes per item

* * *

## Research Findings

### Category 1: File Format Design

#### 1.1 Basic Markform Task List Structure

**Status**: ✅ Complete

A task list would be a standard Markform document with checkboxes as the primary field type:

```markdown
---
markform:
  spec: MF/0.1
  title: Deploy v2.3.0 Release
  run_mode: interactive
---

{% form id="deploy_v230" title="Deploy v2.3.0 Release" %}

{% field kind="checkboxes" id="tasks" label="Deployment Tasks" checkboxMode="simple" required=true %}
- [ ] Update version in package.json {% #update_version %}
- [ ] Run test suite {% #run_tests %}
- [ ] Build production bundle {% #build_bundle %}
- [ ] Deploy to staging {% #deploy_staging %}
- [ ] Verify staging deployment {% #verify_staging %}
- [ ] Deploy to production {% #deploy_prod %}
- [ ] Verify production deployment {% #verify_prod %}
- [ ] Update release notes {% #release_notes %}
{% /field %}

{% /form %}
```

**Assessment**: This structure leverages Markform's existing checkbox functionality with unique IDs per option. The `checkboxMode="simple"` provides clean `[ ]`/`[x]` semantics.

#### 1.2 Item Descriptions/Details Pattern

**Status**: ✅ Complete

A key question: How to attach descriptions to individual checklist items?

**Option A: Documentation Blocks (Markform Native)**

```markdown
{% field kind="checkboxes" id="tasks" label="Tasks" checkboxMode="simple" %}
- [ ] Buy carrots {% #buy_carrots %}
- [ ] Review PR #123 {% #review_pr %}
{% /field %}

{% instructions ref="tasks.buy_carrots" %}
Go to the store, look in the veggie section, get the carrots and pay.
{% /instructions %}

{% instructions ref="tasks.review_pr" %}
Focus on the authentication changes. Check for SQL injection.
{% /instructions %}
```

**Pros**: Uses existing Markform documentation blocks; supports rich markdown content
**Cons**: Verbose; instructions separated from checkbox items

**Option B: Inline Description Attribute (Extension)**

```markdown
{% field kind="checkboxes" id="tasks" label="Tasks" checkboxMode="simple" %}
- [ ] Buy carrots {% #buy_carrots description="Go to the store, look in the veggie section, get the carrots and pay" %}
- [ ] Review PR #123 {% #review_pr description="Focus on the authentication changes. Check for SQL injection." %}
{% /field %}
```

**Pros**: Compact; description co-located with item
**Cons**: Requires Markform extension; long descriptions become unwieldy

**Option C: Multi-Line Item Content (Parser Extension)**

```markdown
{% field kind="checkboxes" id="tasks" label="Tasks" checkboxMode="simple" %}
- [ ] Buy carrots {% #buy_carrots %}
  Go to the store, look in the veggie section, get the carrots and pay.

- [ ] Review PR #123 {% #review_pr %}
  Focus on the authentication changes. Check for SQL injection.
{% /field %}
```

**Pros**: Natural markdown indentation pattern; readable
**Cons**: Requires parser enhancement to capture continuation lines

**Option D: String Field Pairs (No Extension)**

```markdown
{% group id="task_1" %}
{% field kind="checkboxes" id="task_1_status" label="Task" checkboxMode="simple" %}
- [ ] Buy carrots {% #done %}
{% /field %}
{% field kind="string" id="task_1_description" label="Description" %}
```value
Go to the store, look in the veggie section, get the carrots and pay.
```
{% /field %}
{% /group %}
```

**Pros**: Works with current Markform; each task is a group
**Cons**: Extremely verbose; loses the clean checklist feel

**Recommendation**: **Option A (Documentation Blocks)** for initial implementation as it requires no Markform changes. Consider **Option C** as a future Markform enhancement for cleaner syntax.

#### 1.3 ID Generation Strategies

**Status**: ✅ Complete

| Strategy | Format | Pros | Cons |
| --- | --- | --- | --- |
| Sequential | `task_1`, `task_2` | Predictable, compact | Gaps after deletion |
| Slugified Label | `buy_carrots`, `run_tests` | Readable, mnemonic | Label changes break ID |
| Hash-Based | `t_a1b2c3` | Collision-free | Not human-friendly |
| User-Provided | Any valid ID | Full control | Burden on user |
| Hybrid | Auto-generate, allow override | Best of both | Additional complexity |

**Recommendation**: **Hybrid approach**:
- Auto-generate slugified IDs from labels by default (e.g., "Buy carrots" → `buy_carrots`)
- Allow explicit ID override via CLI flag
- Validate uniqueness at creation time

* * *

### Category 2: CLI Command Design

#### 2.1 Command Structure Overview

**Status**: ✅ Complete

The CLI follows a standard subcommand pattern similar to git, beads, and taskwarrior:

```
taskl <command> [options] [arguments]
```

**Core Commands**:

| Command | Description | Example |
| --- | --- | --- |
| `create` | Create a new task list file | `taskl create deploy-v2` |
| `add` | Add a task item | `taskl add deploy-v2 "Run tests"` |
| `check` | Mark item(s) as done | `taskl check deploy-v2 run_tests` |
| `uncheck` | Mark item(s) as not done | `taskl uncheck deploy-v2 run_tests` |
| `list` | List items with status | `taskl list deploy-v2` |
| `show` | Show item details | `taskl show deploy-v2 run_tests` |
| `edit` | Edit item description | `taskl edit deploy-v2 run_tests` |
| `remove` | Remove an item | `taskl remove deploy-v2 run_tests` |
| `archive` | Move to archive directory | `taskl archive deploy-v2` |

#### 2.2 Detailed Command Specifications

**Status**: ✅ Complete

##### `taskl create <name>`

Creates a new task list file.

```bash
# Basic creation
taskl create deploy-v2
# → Creates ./deploy-v2.form.md

# With title
taskl create deploy-v2 --title "Deploy v2.3.0 Release"

# With initial tasks (from args)
taskl create deploy-v2 \
  --task "Update version" \
  --task "Run tests" \
  --task "Build bundle"

# With initial tasks (from stdin or file)
taskl create deploy-v2 --tasks-from tasks.txt

# Custom output directory
taskl create deploy-v2 --dir ./tasks/
# → Creates ./tasks/deploy-v2.form.md
```

**Options**:
- `--title <title>`: Form title (defaults to humanized name)
- `--task <text>`: Add initial task(s), can be repeated
- `--tasks-from <file>`: Read tasks from file (one per line)
- `--dir <path>`: Output directory (default: current directory)
- `--force`: Overwrite existing file

##### `taskl add <file> <title>`

Adds a task item to an existing list.

```bash
# Basic add
taskl add deploy-v2 "Deploy to staging"
# → Adds: - [ ] Deploy to staging {% #deploy_to_staging %}

# With explicit ID
taskl add deploy-v2 "Deploy to staging" --id staging

# With description
taskl add deploy-v2 "Buy carrots" \
  --description "Go to the store, look in the veggie section, get the carrots and pay"

# With priority position
taskl add deploy-v2 "Urgent fix" --position 1  # Add at top
taskl add deploy-v2 "Final step" --position -1 # Add at end (default)

# Interactive description (opens $EDITOR)
taskl add deploy-v2 "Complex task" --edit
```

**Options**:
- `--id <id>`: Explicit ID (auto-generated if omitted)
- `--description <text>`: Item description
- `--position <n>`: Insert position (1-indexed, -1 for end)
- `--edit`: Open $EDITOR for description

##### `taskl check <file> <id...>`

Marks one or more items as done.

```bash
# Single item
taskl check deploy-v2 run_tests

# Multiple items
taskl check deploy-v2 run_tests build_bundle deploy_staging

# All items matching pattern
taskl check deploy-v2 --pattern "deploy_*"

# Interactive mode (prompts for selection)
taskl check deploy-v2 --interactive
```

**Options**:
- `--pattern <glob>`: Match IDs by pattern
- `--interactive`: Interactive selection mode

##### `taskl uncheck <file> <id...>`

Marks items as not done (reverses check).

```bash
taskl uncheck deploy-v2 deploy_staging
```

##### `taskl list <file>`

Lists all items with their status.

```bash
taskl list deploy-v2

# Output:
# deploy-v2: Deploy v2.3.0 Release (3/8 done)
#
# [x] update_version    Update version in package.json
# [x] run_tests         Run test suite
# [x] build_bundle      Build production bundle
# [ ] deploy_staging    Deploy to staging
# [ ] verify_staging    Verify staging deployment
# [ ] deploy_prod       Deploy to production
# [ ] verify_prod       Verify production deployment
# [ ] release_notes     Update release notes

# Filter by status
taskl list deploy-v2 --pending  # Only unchecked
taskl list deploy-v2 --done     # Only checked

# Output formats
taskl list deploy-v2 --format json
taskl list deploy-v2 --format yaml
```

**Options**:
- `--pending`: Show only unchecked items
- `--done`: Show only checked items
- `--format <format>`: Output format (console, json, yaml)

##### `taskl show <file> <id>`

Shows detailed information about an item.

```bash
taskl show deploy-v2 buy_carrots

# Output:
# Task: buy_carrots
# Title: Buy carrots
# Status: pending
#
# Description:
# Go to the store, look in the veggie section, get the carrots and pay.
```

##### `taskl edit <file> <id>`

Edits an item's title or description.

```bash
# Edit title
taskl edit deploy-v2 run_tests --title "Run full test suite"

# Edit description (opens $EDITOR)
taskl edit deploy-v2 run_tests --description

# Edit description inline
taskl edit deploy-v2 run_tests --description "Run all unit and integration tests"
```

##### `taskl remove <file> <id...>`

Removes items from the list.

```bash
taskl remove deploy-v2 obsolete_task

# With confirmation prompt
taskl remove deploy-v2 important_task  # Prompts: Are you sure?

# Skip confirmation
taskl remove deploy-v2 obsolete_task --force
```

##### `taskl archive <file>`

Moves a completed task list to an archive directory.

```bash
taskl archive deploy-v2
# → Moves ./deploy-v2.form.md to ./.tasks-archive/2026-01-07-deploy-v2.form.md

# Custom archive directory
taskl archive deploy-v2 --archive-dir ./completed/

# Archive incomplete list
taskl archive deploy-v2 --force  # Allows archiving uncompleted lists
```

#### 2.3 File Resolution Strategy

**Status**: ✅ Complete

The CLI should resolve file arguments flexibly:

```bash
# All equivalent:
taskl list deploy-v2
taskl list deploy-v2.form.md
taskl list ./deploy-v2.form.md
taskl list /full/path/to/deploy-v2.form.md
```

**Resolution Order**:
1. If path has `.form.md` extension, use as-is
2. If path exists as file, use as-is
3. Append `.form.md` and look in current directory
4. Look in configured tasks directory (e.g., `.tasks/`)

* * *

### Category 3: Implementation Architecture

#### 3.1 Relationship to Markform

**Status**: ✅ Complete

Tasklist is a **thin wrapper** around Markform, not a fork:

```
┌─────────────────────────────────────────────────┐
│                  Tasklist CLI                    │
│  (taskl create, add, check, list, archive...)   │
├─────────────────────────────────────────────────┤
│                 Markform Engine                  │
│    parseForm, applyPatches, serializeForm       │
├─────────────────────────────────────────────────┤
│                 .form.md Files                   │
│     Standard Markform document format           │
└─────────────────────────────────────────────────┘
```

**Key Implementation Points**:

1. **Dependency**: Tasklist depends on `markform` as an npm package
2. **Parsing**: Uses `parseForm()` to read task files
3. **Patching**: Uses `applyPatches()` with `set_checkboxes` to update status
4. **Serializing**: Uses `serializeForm()` to write changes
5. **No Custom Parsing**: All file manipulation goes through Markform engine

**Example: Implementing `taskl check`**

```typescript
import { parseForm, applyPatches, serializeForm } from 'markform';
import type { Patch } from 'markform';

async function check(filePath: string, itemIds: string[]): Promise<void> {
  // Read and parse
  const content = await fs.readFile(filePath, 'utf-8');
  const form = parseForm(content);

  // Build patch: mark items as done
  const patch: Patch = {
    op: 'set_checkboxes',
    fieldId: 'tasks',  // The main checkbox field
    value: Object.fromEntries(itemIds.map(id => [id, 'done']))
  };

  // Apply patch
  const result = applyPatches(form, [patch]);

  // Write back
  const output = serializeForm(result.form);
  await fs.writeFile(filePath, output);
}
```

#### 3.2 Package Structure

**Status**: ✅ Complete

```
tasklist/
├── package.json         # depends on 'markform'
├── src/
│   ├── cli/
│   │   ├── cli.ts       # Main CLI entry (Commander)
│   │   ├── commands/
│   │   │   ├── create.ts
│   │   │   ├── add.ts
│   │   │   ├── check.ts
│   │   │   ├── list.ts
│   │   │   ├── archive.ts
│   │   │   └── ...
│   │   └── lib/
│   │       ├── fileResolver.ts
│   │       ├── idGenerator.ts
│   │       └── formatting.ts
│   └── index.ts         # Library exports
├── bin/
│   └── taskl.js         # CLI binary entry
└── tests/
```

#### 3.3 Form Template Generation

**Status**: ✅ Complete

When creating a new task list, Tasklist generates a minimal Markform document:

```typescript
function generateTaskListForm(options: {
  id: string;
  title: string;
  tasks?: Array<{ title: string; id?: string }>;
}): string {
  const tasks = options.tasks ?? [];
  const taskItems = tasks.map(task => {
    const id = task.id ?? slugify(task.title);
    return `- [ ] ${task.title} {% #${id} %}`;
  }).join('\n');

  return `---
markform:
  spec: MF/0.1
  title: ${options.title}
  run_mode: interactive
---

{% form id="${options.id}" title="${options.title}" %}

{% field kind="checkboxes" id="tasks" label="Tasks" checkboxMode="simple" %}
${taskItems}
{% /field %}

{% /form %}
`;
}
```

* * *

### Category 4: Alternative Design Approaches

#### 4.1 Design Alternative A: Pure Checkbox File

**Status**: ✅ Complete

The simplest approach: one checkbox field for all tasks.

**File Structure**:
```markdown
{% form id="mytask" %}
{% field kind="checkboxes" id="tasks" label="Tasks" checkboxMode="simple" %}
- [ ] Task 1 {% #task_1 %}
- [ ] Task 2 {% #task_2 %}
{% /field %}
{% /form %}
```

**Pros**:
- Minimal file size
- Simple to parse and manipulate
- Clean, linear list structure

**Cons**:
- Descriptions require separate documentation blocks
- No metadata per task (priority, due date, assignee)
- Single checkbox field limits extensibility

#### 4.2 Design Alternative B: Task-as-Group Pattern

**Status**: ✅ Complete

Each task is a Markform group with multiple fields:

**File Structure**:
```markdown
{% form id="mytask" %}

{% group id="task_1" title="Buy carrots" %}
{% field kind="checkboxes" id="task_1_done" checkboxMode="simple" %}
- [ ] Done {% #done %}
{% /field %}
{% field kind="string" id="task_1_desc" label="Description" %}
```value
Go to the store, look in the veggie section...
```
{% /field %}
{% /group %}

{% group id="task_2" title="Review PR #123" %}
...
{% /group %}

{% /form %}
```

**Pros**:
- Rich metadata per task
- Descriptions naturally co-located
- Extensible (could add priority, due date fields)

**Cons**:
- Verbose file format
- Loses clean checklist aesthetics
- More complex CLI implementation

#### 4.3 Design Alternative C: Hybrid with Metadata Header

**Status**: ✅ Complete

Simple checklist with optional metadata group:

**File Structure**:
```markdown
{% form id="deploy_v2" %}

{% group id="metadata" title="Task Info" %}
{% field kind="string" id="owner" label="Owner" %}{% /field %}
{% field kind="date" id="due_date" label="Due Date" %}{% /field %}
{% field kind="single_select" id="priority" label="Priority" %}
- [ ] Low {% #low %}
- [ ] Medium {% #medium %}
- [ ] High {% #high %}
{% /field %}
{% /group %}

{% field kind="checkboxes" id="tasks" label="Tasks" checkboxMode="simple" %}
- [ ] Update version {% #update_version %}
- [ ] Run tests {% #run_tests %}
- [ ] Build bundle {% #build_bundle %}
{% /field %}

{% /form %}
```

**Pros**:
- Metadata when needed, simple checklist always
- Balances simplicity and extensibility
- Progressive complexity

**Cons**:
- Two patterns to maintain
- CLI must handle both metadata and tasks

**Recommendation**: Start with **Alternative A** (pure checkbox) for simplicity, with Option C as a future enhancement for users needing metadata.

* * *

### Category 5: Workflow Integration

#### 5.1 Integration with Beads

**Status**: ✅ Complete

Tasklist complements rather than replaces Beads:

| Scenario | Tool |
| --- | --- |
| Project-wide issue tracking | Beads |
| Cross-session task dependencies | Beads |
| Single-session task list | Tasklist |
| Repeatable checklists | Tasklist |
| Release/deploy procedures | Tasklist |

**Handoff Pattern**: A Beads issue could reference a Tasklist file:

```bash
# In Beads issue description or comment
bd update beads-123 --description "See ./deploy-v2.form.md for checklist"
```

#### 5.2 Integration with Claude Code / AI Agents

**Status**: ✅ Complete

Tasklist files are designed to be agent-friendly:

1. **Creation**: Agent creates task list at session start
2. **Progress**: Agent checks items as they complete work
3. **Visibility**: Progress is visible in the file at any time
4. **Persistence**: Survives session interruptions (unlike TodoWrite)

**Example Agent Workflow**:
```bash
# Start of session
taskl create refactor-auth \
  --task "Identify all auth-related files" \
  --task "Extract shared authentication logic" \
  --task "Create AuthService class" \
  --task "Update all callers" \
  --task "Run tests"

# As work progresses
taskl check refactor-auth identify_all_auth_related_files
taskl check refactor-auth extract_shared_authentication_logic

# Add discovered work
taskl add refactor-auth "Fix circular dependency in UserStore"

# End of session
taskl list refactor-auth  # Shows progress summary
```

#### 5.3 Shell Completion and Discoverability

**Status**: ✅ Complete

For good CLI UX, Tasklist should support:

1. **Shell Completion**: Bash/Zsh/Fish completions for commands and file names
2. **Self-Documentation**: `taskl --help`, `taskl <command> --help`
3. **Man Pages**: Generated from CLI definitions
4. **Examples**: `taskl examples` to show usage patterns

* * *

## Comparative Analysis

### Comparison with Existing Tools

| Feature | Tasklist | Beads | todo.txt | Taskwarrior |
| --- | --- | --- | --- | --- |
| Storage | Single .form.md | JSONL + SQLite | Single txt | SQLite |
| Sync | None (file-level) | Git-integrated | Manual | Taskserver |
| Dependencies | None | Yes | No | Limited |
| Human-readable | Yes (Markdown) | No (JSON) | Yes (txt) | No (DB) |
| Agent-friendly | Yes | Yes | No | No |
| Complexity | Low | High | Very Low | Medium |
| Metadata | Via Markform | Rich | Tags only | Rich |

### Strengths/Weaknesses Summary

- **Tasklist**: Best for single-task checklists, agent workflows, and repeatable procedures. Limited for project-wide tracking.

- **Beads**: Best for complex projects with dependencies and multi-session work. Overhead for simple tasks.

- **todo.txt**: Simplest possible format. No structure, no IDs, no programmatic manipulation.

- **Taskwarrior**: Powerful local task management. Complex setup, not agent-friendly.

* * *

## Best Practices

### For CLI Design

1. **Consistent Argument Order**: `taskl <command> <file> [item] [options]`

2. **Sensible Defaults**: Most commands should work without options

3. **Explicit Over Implicit**: Destructive operations require confirmation or `--force`

4. **Output Formats**: Support `--format` for machine consumption (json, yaml)

5. **Exit Codes**: 0 for success, non-zero for errors with meaningful codes

### For File Format

1. **Single Checkbox Field**: Keep it simple with one `tasks` checkbox field

2. **Meaningful IDs**: Auto-generate from titles, allow override

3. **Documentation Blocks**: Use for descriptions when needed

4. **Standard Markform**: Don't extend the format—work within it

### For Agent Integration

1. **Predictable File Locations**: Establish conventions (e.g., `./.tasks/` directory)

2. **Quiet Mode**: Support `--quiet` for scripted usage

3. **JSON Output**: Enable `--format json` for agent parsing

4. **Atomic Operations**: Each command is a complete operation

* * *

## Open Research Questions

1. **Multi-Checkbox Fields**: Should a task list support multiple checkbox sections (e.g., "Prerequisites" and "Tasks")?

2. **Notes Per Item**: Should notes be attachable to individual items via dedicated syntax, or are documentation blocks sufficient?

3. **Task Templates**: Should there be a mechanism for creating task lists from templates?

4. **Progress Webhooks**: Should completion events be hookable for integrations?

* * *

## Recommendations

### Summary

Tasklist should be a minimal, focused CLI that wraps Markform for simple task list management. Start with the simplest design (pure checkbox file, auto-generated IDs, documentation blocks for descriptions) and enhance based on real usage.

### Recommended Approach

**Phase 1: Core CLI (MVP)**
- `create`, `add`, `check`, `uncheck`, `list` commands
- Single checkbox field format
- Auto-generated slugified IDs
- Console and JSON output formats

**Phase 2: Enhanced UX**
- `show`, `edit`, `remove` commands
- `archive` command with date-prefixed naming
- Shell completions (bash, zsh, fish)
- Interactive mode with `--interactive` flag

**Phase 3: Advanced Features**
- Description support via documentation blocks
- Metadata header (optional)
- Template files
- Integration hooks

### Rationale

- **Simplicity First**: Complex features can be added later; complexity is hard to remove
- **Markform Native**: Working within Markform's format ensures compatibility and leverages existing tooling
- **Agent-Friendly**: File-based, predictable, and machine-readable for AI agent workflows
- **Complementary to Beads**: Fills a different niche rather than competing

### Alternative Approaches

1. **Extend Markform CLI**: Add task commands to `markform` directly instead of a separate tool
   - Pro: Single tool ecosystem
   - Con: Bloats Markform, different abstraction level

2. **Use Beads with Single-File Mode**: Configure Beads to use individual files
   - Pro: Leverages mature infrastructure
   - Con: Beads architecture doesn't fit this model well

3. **Pure Markdown (No Markform)**: Simple `- [ ]` markdown files
   - Pro: Maximum simplicity
   - Con: No unique IDs, no programmatic manipulation guarantees

* * *

## References

- [Markform Specification](../../../markform-spec.md)
- [Markform Architecture](../../architecture/current/arch-markform-design.md)
- [Beads GitHub Repository](https://github.com/steveyegge/beads)
- [todo.txt Format](http://todotxt.org/)
- [Taskwarrior Documentation](https://taskwarrior.org/docs/)
- [Commander.js](https://github.com/tj/commander.js/)
- [GFM Task Lists](https://github.github.com/gfm/#task-list-items-extension-)

* * *

## Appendices

### Appendix A: Example Task List File

**deploy-v2.form.md**:
```markdown
---
markform:
  spec: MF/0.1
  title: Deploy v2.3.0 Release
  run_mode: interactive
  form_state: incomplete
  form_progress:
    counts:
      totalFields: 1
      filledFields: 1
      emptyFields: 0
      validFields: 1
      invalidFields: 0
    checkboxProgress:
      done: 3
      todo: 5
---

{% form id="deploy_v230" title="Deploy v2.3.0 Release" %}

{% description ref="deploy_v230" %}
Standard deployment checklist for version 2.3.0 release.
Follow steps in order. Do not skip staging verification.
{% /description %}

{% field kind="checkboxes" id="tasks" label="Deployment Tasks" checkboxMode="simple" required=true %}
- [x] Update version in package.json {% #update_version %}
- [x] Run test suite {% #run_tests %}
- [x] Build production bundle {% #build_bundle %}
- [ ] Deploy to staging {% #deploy_staging %}
- [ ] Verify staging deployment {% #verify_staging %}
- [ ] Deploy to production {% #deploy_prod %}
- [ ] Verify production deployment {% #verify_prod %}
- [ ] Update release notes {% #release_notes %}
{% /field %}

{% instructions ref="tasks.deploy_staging" %}
Run: `./scripts/deploy.sh staging`
Wait for health check to pass before proceeding.
{% /instructions %}

{% instructions ref="tasks.verify_staging" %}
1. Check https://staging.example.com loads
2. Run smoke tests: `npm run test:smoke:staging`
3. Verify all API endpoints respond
{% /instructions %}

{% /form %}
```

### Appendix B: CLI Quick Reference

```
Tasklist CLI - File-based task management

Usage: taskl <command> [options]

Commands:
  create <name>              Create new task list
  add <file> <title>         Add task item
  check <file> <id...>       Mark items done
  uncheck <file> <id...>     Mark items not done
  list <file>                List items with status
  show <file> <id>           Show item details
  edit <file> <id>           Edit item
  remove <file> <id...>      Remove items
  archive <file>             Archive completed list

Options:
  --help                     Show help
  --version                  Show version
  --quiet                    Suppress output
  --format <fmt>             Output format (console|json|yaml)

Examples:
  taskl create deploy-v2 --task "Run tests" --task "Build"
  taskl add deploy-v2 "Deploy to staging"
  taskl check deploy-v2 run_tests build
  taskl list deploy-v2 --pending
  taskl archive deploy-v2
```

### Appendix C: ID Generation Algorithm

```typescript
function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')      // Remove special chars
    .replace(/[\s_-]+/g, '_')       // Replace spaces/dashes with underscore
    .replace(/^-+|-+$/g, '')        // Trim leading/trailing dashes
    .slice(0, 50);                  // Max length
}

function generateUniqueId(
  title: string,
  existingIds: Set<string>
): string {
  let baseId = slugify(title);
  if (!baseId) baseId = 'task';

  if (!existingIds.has(baseId)) {
    return baseId;
  }

  // Add numeric suffix for uniqueness
  let suffix = 2;
  while (existingIds.has(`${baseId}_${suffix}`)) {
    suffix++;
  }
  return `${baseId}_${suffix}`;
}
```
