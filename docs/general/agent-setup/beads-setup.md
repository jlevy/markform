## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking.
Do NOT use markdown TODOs or other ad-hoc issue tracking methods.

**Check if bd is installed and get workflow context:**

```bash
if command -v bd &>/dev/null; then
  bd prime
else
  echo "bd not installed - run installation below"
fi
```

If bd is already installed, `bd prime` loads the workflow context.
**Skip to the “Workflow for AI Agents” section below.**

**If bd is not installed**, use the direct download method:

**Quick install (Linux x86_64 / amd64):**

```bash
# Get latest version, download, and install
curl -sI https://github.com/steveyegge/beads/releases/latest | grep -i "^location:"
# Note the version (e.g., v0.35.0), then:
curl -fsSL -o /tmp/beads.tar.gz "https://github.com/steveyegge/beads/releases/download/v0.35.0/beads_0.35.0_linux_amd64.tar.gz"
tar -xzf /tmp/beads.tar.gz -C /tmp
mkdir -p ~/.local/bin
cp /tmp/bd ~/.local/bin/
chmod +x ~/.local/bin/bd
export PATH="$HOME/.local/bin:$PATH"
bd prime   # Get workflow context
```

**For other platforms**, run each step separately:

```bash
# Step 1: Detect platform
uname -s | tr '[:upper:]' '[:lower:]'   # OS: linux, darwin
uname -m                                  # ARCH: x86_64->amd64, aarch64->arm64

# Step 2: Get latest version
curl -sI https://github.com/steveyegge/beads/releases/latest | grep -i "^location:"
# Extract version from URL (e.g., v0.35.0)

# Step 3: Download (substitute OS, ARCH, VERSION)
# Example: beads_0.35.0_linux_amd64.tar.gz or beads_0.35.0_darwin_arm64.tar.gz
curl -fsSL -o /tmp/beads.tar.gz "https://github.com/steveyegge/beads/releases/download/VERSION/beads_VERSION_OS_ARCH.tar.gz"

# Step 4: Install
tar -xzf /tmp/beads.tar.gz -C /tmp
mkdir -p ~/.local/bin
cp /tmp/bd ~/.local/bin/
chmod +x ~/.local/bin/bd
export PATH="$HOME/.local/bin:$PATH"
bd prime
```

For troubleshooting, see: https://github.com/steveyegge/beads/releases

**If bd says `Error: no beads database found`:**
```bash
bd init
bd prime
```

**If you encounter other errors:**
```bash
bd doctor       # Check installation health
bd doctor --fix # Fix any setup issues
```

### Git Merge Driver (required for each clone)

The `.gitattributes` file configures beads JSONL files to use a custom merge driver, but
the driver must be registered in your local git config:

```bash
git config merge.beads.driver "bd merge %A %O %A %B"
git config merge.beads.name "bd JSONL merge driver"
```

Verify with: `bd doctor | grep "Git Merge Driver"` (should show checkmark)

### This Project Uses no-db Mode

**IMPORTANT:** This project has `no-db: true` in `.beads/config.yaml`.

In no-db mode, the JSONL file IS the database.
This means:

- **Do NOT run `bd sync`** - it will fail or corrupt data

- bd commands read/write directly to `.beads/issues.jsonl`

- Use git to sync issues between environments (not `bd sync`)

**Session close protocol for no-db mode:**
```bash
git status                      # Check what changed
git add <files>                 # Stage code changes
git add .beads/issues.jsonl     # Stage issue changes
git commit -m "..."             # Commit everything
git push                        # Push to remote
```

### Git Merge Driver (IMPORTANT)

The beads JSONL file requires a custom git merge driver to handle 3-way merges
correctly. Without it, git will use line-based merging which can corrupt issue statuses
during merges.

**Check if configured:**
```bash
git config --get merge.beads.driver || echo "Not configured"
```

**Configure if missing:**
```bash
git config merge.beads.driver "bd merge %A %O %A %B"
git config merge.beads.name "bd JSONL merge driver"
```

The `.gitattributes` file should already contain:
```
.beads/issues.jsonl merge=beads
```

**Note:** `bd init` automatically configures the merge driver.
If you cloned an existing repo with beads, run the config commands above or `bd doctor
--fix` to set it up.

### Issue Types

- `bug` - Something broken

- `feature` - New functionality

- `task` - Work item (tests, docs, refactoring)

- `epic` - Large feature with subtasks

- `chore` - Maintenance (dependencies, tooling)

- `merge-request` - Code review / merge request

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
   git status                      # Check what changed
   git add <files>                 # Stage code changes
   git add .beads/issues.jsonl     # Stage issue changes (if modified)
   git commit -m "..."             # Commit everything
   git push                        # Push to remote
   ```

### Useful Commands

- `bd ready` - Show issues ready to work (no blockers)

- `bd blocked` - Show blocked issues

- `bd show <id>` - Detailed issue view with dependencies

- `bd doctor` - Check and fix beads installation health

- `bd quickstart` - Quick start guide

- `bd prime` - Get workflow context (auto-called by hooks)

- `bd <command> --help` - See all flags for any command

### Important Rules

- Use bd for ALL task tracking

- Always use `--json` flag for programmatic use

- Link discovered work with `discovered-from` dependencies

- Check `bd ready` before asking “what should I work on?”

- Store AI planning docs in `history/` directory

- Run `bd <cmd> --help` to discover available flags

- Do NOT run `bd sync` (this project uses no-db mode)

- Do NOT use "high"/"medium"/"low" for priorities (use 0-4 or P0-P4)

- Do NOT use external issue trackers

- Do NOT use `main` as the sync branch (use `beads-sync`)
