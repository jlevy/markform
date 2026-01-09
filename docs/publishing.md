# Publishing

> **Template note**: Replace `OWNER` with your GitHub username/org and `PACKAGE` with
> your package name when adapting this for other projects.

This project uses [Changesets](https://github.com/changesets/changesets) for version
management and tag-based releases with OIDC trusted publishing to npm.

## One-Time Setup

Before the first release, complete these steps:

### 1. Manual First Publish

The package must exist on npm before OIDC can be configured.
Run from the package directory (important: the root `.npmrc` has pnpm-specific config
that confuses npm):

```bash
cd packages/PACKAGE
npm publish --access public
```

This will prompt for web-based authentication in your browser.

### 2. Configure OIDC Trusted Publishing on npm

1. Go to https://www.npmjs.com/package/PACKAGE/access

2. Under "Publishing access", click "Add a trusted publisher" or "Configure Trusted
   Publishing"

3. Select **GitHub Actions** as the publisher

4. Fill in the form:
   - **Organization or user**: `OWNER`
   - **Repository**: `PACKAGE`
   - **Workflow filename**: `release.yml`
   - **Environment name**: Leave blank (not required unless using GitHub environments)

5. For **Publishing access**, select **"Require two-factor authentication and disallow
   tokens (recommended)"** - OIDC trusted publishers work regardless of this setting

6. Click "Set up connection"

### 3. Verify Repository is Public

OIDC trusted publishing requires a public GitHub repository.

## During Development

Merge PRs to `main` without creating changesets.
Changesets are created only at release time.

## Release Workflow

Follow these steps to publish a new version.
All commands are non-interactive and can be run by an agent or human.

### Step 1: Prepare

```bash
git checkout main
git pull
git status  # Must be clean
```

### Step 2: Determine Version

Review changes since last release:

```bash
git log $(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD~20")..HEAD --oneline
```

Choose version bump:

- `patch` (0.1.0 → 0.1.1): Bug fixes, docs, internal changes

- `minor` (0.1.0 → 0.2.0): New features, non-breaking changes

- `major` (0.1.0 → 1.0.0): Breaking changes

### Step 3: Create Changeset

```bash
pnpm changeset:add <bump> <version> "<summary>"
```

Examples:

```bash
pnpm changeset:add patch 0.1.1 "Fix parsing bug"
pnpm changeset:add minor 0.2.0 "Add new export format"
pnpm changeset:add major 1.0.0 "Breaking API changes"
```

Commit:

```bash
git add .changeset
git commit -m "chore: add changeset for v0.2.0"
```

### Step 4: Version Packages

Run changesets to bump version and update CHANGELOG:

```bash
pnpm version-packages
```

Review and commit:

```bash
git diff  # Verify package.json and CHANGELOG.md
git add .
git commit -m "chore: release PACKAGE v0.2.0"
```

### Step 5: Push and Tag

**Option A: Direct git push (local development)**

```bash
git push
git tag v0.2.0
git push --tags
```

**Option B: Via PR and GitHub API (restricted environments like Claude Code Web)**

When direct push to main is restricted, use GitHub CLI. See
[GitHub CLI Setup](general/agent-setup/github-cli-setup.md) for installation.

```bash
# 1. Push to feature branch
git push -u origin <branch-name>

# 2. Create and merge PR (use release notes format from "Writing Release Notes" section)
gh pr create -R OWNER/PACKAGE --base main --head <branch-name> \
  --title "chore: release PACKAGE v0.2.0" \
  --body-file release-notes.md  # Or use --body with the formatted notes
gh pr merge <pr-number> -R OWNER/PACKAGE --merge

# 3. Get merge commit SHA
MERGE_SHA=$(gh pr view <pr-number> -R OWNER/PACKAGE --json mergeCommit -q '.mergeCommit.oid')

# 4. Create tag via API (triggers release workflow)
gh api repos/OWNER/PACKAGE/git/refs -X POST \
  -f ref="refs/tags/v0.2.0" \
  -f sha="$MERGE_SHA"
```

The release workflow will automatically create the GitHub Release when the tag is pushed.

### Step 6: Verify

```bash
gh run list -R OWNER/PACKAGE --limit 3  # Check release workflow started
gh run view --log                        # Watch progress
```

The GitHub Actions workflow will build and publish to npm using OIDC authentication.

## Writing Release Notes

Each release should include clear, human-readable release notes that summarize what changed.
This is a manual process—not automated parsing of commit messages—so the notes are readable
and meaningful.

### Step 1: Review Changes

Get the commit history since the last release:

```bash
# Get last tag
LAST_TAG=$(git describe --tags --abbrev=0)

# View commits since last release
git log $LAST_TAG..HEAD --oneline

# See feature commits
git log $LAST_TAG..HEAD --pretty=format:"%s" | grep -E "^feat:"

# See fix commits
git log $LAST_TAG..HEAD --pretty=format:"%s" | grep -E "^fix:"

# See other significant changes
git log $LAST_TAG..HEAD --pretty=format:"%s" | grep -E "^refactor:|^test:|^docs:"
```

### Step 2: Categorize and Summarize

Group changes thematically, not by individual commit. Categories to use:

- **Features**: New capabilities, significant enhancements
- **Fixes**: Bug fixes, corrections
- **Refactoring**: Internal improvements, code quality (if notable)
- **Documentation**: Significant doc changes (skip trivial updates)

Write concise descriptions that explain what changed from the user's perspective. Multiple
related commits should be combined into a single bullet point.

### Step 3: Format the Release Notes

Use this format for the PR body and GitHub release:

```markdown
## What's Changed

### Features

- **Feature name**: Brief description of what it does
- **Another feature**: What users can now do

### Fixes

- Fixed specific issue with clear description
- Another fix with context

### Refactoring

- Significant internal change (if user-relevant)

### Documentation

- Notable doc updates (if significant)

**Full commit history**: https://github.com/OWNER/PACKAGE/compare/vX.X.X...vY.Y.Y
```

### Example Release Notes

Here's an example of good release notes (from v0.1.15):

```markdown
## What's Changed

### Features

- **Tryscript CLI testing**: End-to-end CLI tests with coverage support
- **Unified test coverage**: Merged vitest and tryscript coverage into single report
- **Web UI URL formatting**: URLs display as domain links with hover-to-copy

### Fixes

- Fixed tooltip positioning and checkbox rendering in web UI
- Fixed coverage exclusion patterns and monorepo working directory

### Refactoring

- CLI integration tests converted to tryscript format
- Coverage merge script rewritten in TypeScript

### Documentation

- Added CC-BY-4.0 license for spec and CLA for contributors
- Research briefs on subforms and coverage infrastructure

**Full commit history**: https://github.com/jlevy/markform/compare/v0.1.14...v0.1.15
```

### Tips

- **Be concise**: Each bullet should be one line
- **Focus on impact**: What can users do now? What's fixed?
- **Group related commits**: "Fixed 5 coverage bugs" not 5 separate bullets
- **Skip trivial changes**: Badge updates, typo fixes don't need mention
- **Link to full history**: Always include the compare URL for those who want details

## Quick Reference

### Local Development (direct push)

```bash
# Full release sequence (replace version as needed)
git checkout main && git pull
pnpm changeset:add minor 0.2.0 "Summary of changes"
git add .changeset && git commit -m "chore: add changeset for v0.2.0"
pnpm version-packages
git add . && git commit -m "chore: release PACKAGE v0.2.0"
git push && git tag v0.2.0 && git push --tags
```

### Restricted Environments (via PR and API)

```bash
# Prepare release on feature branch
pnpm changeset:add minor 0.2.0 "Summary of changes"
git add .changeset && git commit -m "chore: add changeset for v0.2.0"
pnpm version-packages
git add . && git commit -m "chore: release PACKAGE v0.2.0"
git push -u origin <branch-name>

# Merge via PR (see "Writing Release Notes" section for body format)
gh pr create -R OWNER/PACKAGE --base main --head <branch-name> \
  --title "chore: release PACKAGE v0.2.0" --body-file release-notes.md
gh pr merge <pr-number> -R OWNER/PACKAGE --merge

# Create tag via API (triggers release workflow)
MERGE_SHA=$(gh pr view <pr-number> -R OWNER/PACKAGE --json mergeCommit -q '.mergeCommit.oid')
gh api repos/OWNER/PACKAGE/git/refs -X POST -f ref="refs/tags/v0.2.0" -f sha="$MERGE_SHA"

# Verify (release workflow creates GitHub Release automatically)
gh run list -R OWNER/PACKAGE --limit 3
```

## How OIDC Publishing Works

This project uses npm’s trusted publishing via OIDC (OpenID Connect):

- **No tokens to manage**: GitHub Actions presents an OIDC identity to npm

- **No secrets to rotate**: npm issues a one-time credential for each workflow run

- **Provenance attestation**: Published packages include signed build provenance

The release workflow (`.github/workflows/release.yml`) triggers on `v*` tags and
publishes automatically without requiring an `NPM_TOKEN` secret.

## GitHub Releases

The release workflow automatically creates a GitHub Release when a tag is pushed:

- **Release name**: Matches the tag (e.g., `v0.1.1`)

- **Release notes**: Initially extracted from CHANGELOG; update manually with formatted notes
  (see "Writing Release Notes" section)

- **Pre-release flag**: Automatically set for versions containing `-` (e.g., `1.0.0-beta.1`)

After pushing a tag:

1. Verify the release appears at: `https://github.com/OWNER/PACKAGE/releases`

2. Edit the release to add properly formatted release notes following the "Writing Release
   Notes" section format

3. The release PR body should already contain the notes—copy them to the GitHub release

## Troubleshooting

**Release workflow not running?**

- Ensure tag format is `v*` (e.g., `v0.2.0`)

- Check tag was pushed: `git ls-remote --tags origin`

**npm publish failing with 401/403?**

- Verify OIDC is configured: https://www.npmjs.com/package/PACKAGE/access

- Check repository is listed under "Trusted Publishing"

- Ensure the repository is public

**First publish?**

- OIDC requires the package to already exist on npm

- Do a manual `npm publish --access public` first (see One-Time Setup)

## Alternative: Interactive Mode

For humans who prefer prompts, use `pnpm changeset` instead of writing the file
directly. It will prompt for package selection, bump type, and description.

## Installing from Git (Bleeding Edge)

To use the latest unreleased code directly from GitHub:

```bash
# pnpm
pnpm add "github:OWNER/PACKAGE#path:packages/PACKAGE"

# npm
npm install "github:OWNER/PACKAGE#path:packages/PACKAGE"
```

This runs the `prepare` script to build from source.
