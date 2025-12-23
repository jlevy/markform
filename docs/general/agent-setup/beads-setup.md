## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking.
Do NOT use markdown TODOs or other ad-hoc issue tracking methods.

**Run this now** to get an overview of `bd`:

```bash
bd status || echo "bd not installed"
```

**If bd is not installed:**
```bash
go install github.com/steveyegge/beads/cmd/bd@latest
export PATH="$PATH:$HOME/go/bin" # Required each session
bd prime   # Get workflow context
```

**If bd says `Error: no beads database found` it requires one-time setup:**
```bash
bd init
bd prime  # Get workflow context
```

**If you encounter other errors:**
```
bd doctor  # Check installation health
bd doctor --fix  # Fix any setup issues
```

### Issue Types

- `bug` - Something broken

- `feature` - New functionality

- `task` - Work item (tests, docs, refactoring)

- `epic` - Large feature with subtasks

- `chore` - Maintenance (dependencies, tooling)

- `merge-request` - Code review / merge request

- `molecule` - Work template (advanced)

### Priorities

Use `0-4` or `P0-P4` format (NOT "high"/"medium"/"low"):

- `0` / `P0` - Critical (security, data loss, broken builds)

- `1` / `P1` - High (major features, important bugs)

- `2` / `P2` - Medium (default, nice-to-have)

- `3` / `P3` - Low (polish, optimization)

- `4` / `P4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: `bd ready` shows unblocked issues

2. **Claim your task**: `bd update <id> --status in_progress`

3. **Work on it**: Implement, test, document

4. **Discover new work?** Create linked issue:

   - `bd create "Found bug" -p 1 --deps "discovered-from:<parent-id>"`

   - Dependencies format: `'type:id'` or `'id'` (e.g.,
     `'discovered-from:bd-20,blocks:bd-15'`)

5. **Complete**: `bd close <id>` or close multiple at once: `bd close <id1> <id2> ...`

6. **Session close protocol** (CRITICAL - before saying “done”):
   ```bash
   git status              # Check what changed
   git add <files>         # Stage code changes
   bd sync --from-main     # Pull beads updates from main
   git commit -m "..."     # Commit code changes
   ```

### Sync & Collaboration

bd automatically syncs with git:

- Exports to `.beads/issues.jsonl` after CRUD operations (5s debounce)

- Imports from JSONL when newer than DB (e.g., after `git pull`)

- Run `bd sync --from-main` at session end (especially for ephemeral branches)

- Check sync status: `bd sync --status`

### Useful Commands

- `bd ready` - Show issues ready to work (no blockers)

- `bd blocked` - Show blocked issues

- `bd show <id>` - Detailed issue view with dependencies

- `bd doctor` - Check and fix beads installation health

- `bd quickstart` - Quick start guide

- `bd prime` - Get workflow context (auto-called by hooks)

- `bd <command> --help` - See all flags for any command

### Important Rules

- ✅ Use bd for ALL task tracking

- ✅ Always use `--json` flag for programmatic use

- ✅ Link discovered work with `discovered-from` dependencies

- ✅ Check `bd ready` before asking “what should I work on?”

- ✅ Store AI planning docs in `history/` directory

- ✅ Run `bd <cmd> --help` to discover available flags

- ✅ Run `bd sync --from-main` at session end

- ❌ Do NOT use "high"/"medium"/"low" for priorities (use 0-4 or P0-P4)

- ❌ Do NOT use external issue trackers

- ❌ Do NOT duplicate tracking systems

- ❌ Do NOT clutter repo root with planning documents
