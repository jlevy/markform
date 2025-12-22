## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking.
Do NOT use markdown TODOs, task lists, or other tracking methods.

**Run this now** to get an overview of `bd`:

```bash
bd status || echo "bd not installed"
```

**If bd is not installed:**
```bash
go install github.com/steveyegge/beads/cmd/bd@latest
export PATH="$PATH:$HOME/go/bin" # Required each session
bd prime  # Confirm it is working, get instructions
```

**If bd says `Error: no beads database found` it requires one-time setup:**
```bash
bd init
bd prime  # Get instructions
```

### Issue Types

- `bug` - Something broken

- `feature` - New functionality

- `task` - Work item (tests, docs, refactoring)

- `epic` - Large feature with subtasks

- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)

- `1` - High (major features, important bugs)

- `2` - Medium (default, nice-to-have)

- `3` - Low (polish, optimization)

- `4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: `bd ready` shows unblocked issues

2. **Claim your task**: `bd update <id> --status in_progress`

3. **Work on it**: Implement, test, document

4. **Discover new work?** Create linked issue:

   - `bd create "Found bug" -p 1 --deps discovered-from:<parent-id>`

5. **Complete**: `bd close <id> --reason "Done"`

6. **Commit together**: Always commit the `.beads/issues.jsonl` file together with the
   code changes so issue state stays in sync with code state

### Auto-Sync

bd automatically syncs with git:

- Exports to `.beads/issues.jsonl` after changes (5s debounce)

- Imports from JSONL when newer (e.g., after `git pull`)

- No manual export/import needed!

### CLI Help

Run `bd <command> --help` to see all available flags for any command.
For example: `bd create --help` shows `--parent`, `--deps`, `--assignee`, etc.

### Important Rules

- ✅ Use bd for ALL task tracking

- ✅ Always use `--json` flag for programmatic use

- ✅ Link discovered work with `discovered-from` dependencies

- ✅ Check `bd ready` before asking “what should I work on?”

- ✅ Store AI planning docs in `history/` directory

- ✅ Run `bd <cmd> --help` to discover available flags

- ❌ Do NOT create markdown TODO lists

- ❌ Do NOT use external issue trackers

- ❌ Do NOT duplicate tracking systems

- ❌ Do NOT clutter repo root with planning documents
