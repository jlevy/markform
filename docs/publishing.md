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

### Step 2: Review Changes and Determine Version

Preview release notes (auto-generated from merged PRs):

```bash
pnpm release-notes
```

This shows:

- All PRs merged since the last release, categorized by type
- A compare link to the full diff

Choose version bump based on the changes:

- `patch` (0.1.0 → 0.1.1): Bug fixes, docs, internal changes

- `minor` (0.1.0 → 0.2.0): New features, non-breaking changes

- `major` (0.1.0 → 1.0.0): Breaking changes

### Step 3: Create Changeset

**Option A: Auto-generate from PRs (recommended)**

```bash
pnpm release-notes --changeset --bump <type>
```

This creates a `.changeset/v{version}.md` file with structured release notes.

Examples:

```bash
pnpm release-notes --changeset                    # patch bump (default)
pnpm release-notes --changeset --bump minor       # minor bump
pnpm release-notes --changeset --bump major       # major bump
```

**Option B: Manual summary**

For releases where you want a custom summary instead of PR-based notes:

```bash
pnpm changeset:add <bump> <version> "<summary>"
```

Examples:

```bash
pnpm changeset:add patch 0.1.1 "Fix parsing bug"
pnpm changeset:add minor 0.2.0 "Add new export format"
pnpm changeset:add major 1.0.0 "Breaking API changes"
```

**Review and commit:**

```bash
cat .changeset/v*.md   # Review the changeset
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

# 2. Create and merge PR
gh pr create -R OWNER/PACKAGE --base main --head <branch-name> \
  --title "chore: release PACKAGE v0.2.0" \
  --body "Release v0.2.0"
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

## Quick Reference

### Local Development (direct push)

```bash
# Full release sequence
git checkout main && git pull

# Preview and generate release notes
pnpm release-notes                      # Preview
pnpm release-notes --changeset          # Generate .changeset/v0.x.y.md

# Commit and version
git add .changeset && git commit -m "chore: add changeset for v0.x.y"
pnpm version-packages
git add . && git commit -m "chore: release markform v0.x.y"
git push && git tag v0.x.y && git push --tags
```

### Restricted Environments (via PR and API)

```bash
# Prepare release on feature branch
pnpm release-notes --changeset          # Generate release notes
git add .changeset && git commit -m "chore: add changeset for v0.x.y"
pnpm version-packages
git add . && git commit -m "chore: release markform v0.x.y"
git push -u origin <branch-name>

# Merge via PR
gh pr create -R OWNER/PACKAGE --base main --head <branch-name> \
  --title "chore: release markform v0.x.y" --body "Release v0.x.y"
gh pr merge <pr-number> -R OWNER/PACKAGE --merge

# Create tag via API (triggers release workflow)
MERGE_SHA=$(gh pr view <pr-number> -R OWNER/PACKAGE --json mergeCommit -q '.mergeCommit.oid')
gh api repos/OWNER/PACKAGE/git/refs -X POST -f ref="refs/tags/v0.x.y" -f sha="$MERGE_SHA"

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

- **Release notes**: Extracted from the CHANGELOG for the tagged version

- **Compare link**: Auto-generated link to diff between versions

- **Pre-release flag**: Automatically set for versions containing `-` (e.g., `1.0.0-beta.1`)

After pushing a tag, verify the release appears at:
`https://github.com/OWNER/PACKAGE/releases`

## PR Conventions for Release Notes

For best auto-generated release notes, use [conventional commit](https://www.conventionalcommits.org/)
format in PR titles:

| Prefix | Category | Example |
| --- | --- | --- |
| `feat:` | Features | `feat: add export to CSV` |
| `fix:` | Bug Fixes | `fix: handle empty input` |
| `docs:` | Documentation | `docs: update API reference` |
| `test:` | Testing | `test: add unit tests for parser` |
| `refactor:` | Refactoring | `refactor: simplify validation` |
| `perf:` | Performance | `perf: optimize large file handling` |
| `ci:` | CI/CD | `ci: add caching to workflow` |
| `chore:` | Maintenance | `chore: update dependencies` |

Optional scope: `feat(cli): add --verbose flag`

The `pnpm release-notes` command categorizes PRs by these prefixes. PRs without conventional
prefixes appear under "Other Changes".

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
