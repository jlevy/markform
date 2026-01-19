# Publishing (npm)

> **Template note**: This is a sample publishing workflow for npm packages.
> Replace `OWNER` with your GitHub username/org, `REPO` with your repository name, and
> `PACKAGE` with your package name when adapting for your project.

This project uses [Changesets](https://github.com/changesets/changesets) for version
management and tag-based releases with OIDC trusted publishing to npm.

For release notes format and guidelines, see
@docs/general/agent-guidelines/release-notes-guidelines.md.

## One-Time Setup

Before the first release, complete these steps:

### 1. Manual First Publish

The package must exist on npm before OIDC can be configured.
Run from the package directory:

```bash
cd packages/PACKAGE
npm publish --access public
```

This will prompt for web-based authentication in your browser.

### 2. Configure OIDC Trusted Publishing on npm

1. Go to https://www.npmjs.com/package/PACKAGE/access

2. Under “Publishing access”, click “Add a trusted publisher”

3. Select **GitHub Actions** as the publisher

4. Fill in the form:
   - **Organization or user**: `OWNER`
   - **Repository**: `REPO`
   - **Workflow filename**: `release.yml`
   - **Environment name**: Leave blank

5. For **Publishing access**, select **“Require two-factor authentication and disallow
   tokens (recommended)”**

6. Click “Set up connection”

### 3. Verify Repository is Public

OIDC trusted publishing requires a public GitHub repository.

### 4. Verify npm Version

OIDC publishing requires npm 11.5.1 or later.
Update if needed:

```bash
npm install -g npm@latest
```

## During Development

Merge PRs to `main` without creating changesets.
Changesets are created only at release time.

## Release Workflow

Follow these steps to publish a new version.

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

Run the interactive changeset command:

```bash
pnpm changeset
```

This prompts for package selection, bump type (patch/minor/major), and a summary.

Commit:

```bash
git add .changeset
git commit -m "chore: add changeset for vX.X.X"
```

### Step 4: Version Packages

Run changesets to bump version and update CHANGELOG:

```bash
pnpm changeset version
```

Review and commit:

```bash
git diff  # Verify package.json and CHANGELOG.md
git add .
git commit -m "chore: release PACKAGE vX.X.X"
```

### Step 5: Write Release Notes

**Before pushing**, write release notes following
@docs/general/agent-guidelines/release-notes-guidelines.md.

```bash
# Review changes since last release
git log $(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD~20")..HEAD --oneline

# Write release notes to release-notes.md or prepare for PR body
```

### Step 6: Push and Tag

**Option A: Direct git push (local development)**

```bash
git push
git tag vX.X.X
git push --tags
```

**Option B: Via PR and GitHub API (restricted environments)**

When direct push to main is restricted:

```bash
# Push to feature branch
git push -u origin <branch-name>

# Create and merge PR (use release notes in body)
gh pr create -R OWNER/REPO --base main --head <branch-name> \
  --title "chore: release PACKAGE vX.X.X" \
  --body-file release-notes.md
gh pr merge <pr-number> -R OWNER/REPO --merge

# Get merge commit SHA and create tag
MERGE_SHA=$(gh pr view <pr-number> -R OWNER/REPO --json mergeCommit -q '.mergeCommit.oid')
gh api repos/OWNER/REPO/git/refs -X POST \
  -f ref="refs/tags/vX.X.X" \
  -f sha="$MERGE_SHA"
```

### Step 7: Update GitHub Release

After the release workflow completes:

```bash
# Wait for release workflow
gh run list -R OWNER/REPO --limit 3

# Update release notes
gh release edit vX.X.X -R OWNER/REPO --notes-file release-notes.md
```

### Step 8: Verify

```bash
gh release view vX.X.X -R OWNER/REPO
```

## Quick Reference

### Local Development (direct push)

```bash
git checkout main && git pull
pnpm changeset  # Interactive: select package, bump type, summary
git add .changeset && git commit -m "chore: add changeset for v0.2.0"
pnpm changeset version
git add . && git commit -m "chore: release PACKAGE v0.2.0"

# Write release notes (see release-notes-guidelines.md)
git push && git tag v0.2.0 && git push --tags

# Update GitHub release after workflow completes
gh release edit v0.2.0 -R OWNER/REPO --notes-file release-notes.md
```

### Restricted Environments (via PR and API)

```bash
pnpm changeset  # Interactive: select package, bump type, summary
git add .changeset && git commit -m "chore: add changeset for v0.2.0"
pnpm changeset version
git add . && git commit -m "chore: release PACKAGE v0.2.0"

# Write release notes, push to branch
git push -u origin <branch-name>

# Create PR, merge, tag via API
gh pr create -R OWNER/REPO --base main --head <branch-name> \
  --title "chore: release PACKAGE v0.2.0" --body-file release-notes.md
gh pr merge <pr-number> -R OWNER/REPO --merge
MERGE_SHA=$(gh pr view <pr-number> -R OWNER/REPO --json mergeCommit -q '.mergeCommit.oid')
gh api repos/OWNER/REPO/git/refs -X POST -f ref="refs/tags/v0.2.0" -f sha="$MERGE_SHA"

# Update GitHub release after workflow completes
gh release edit v0.2.0 -R OWNER/REPO --notes-file release-notes.md
```

## How OIDC Publishing Works

This project uses npm’s trusted publishing via OIDC (OpenID Connect):

- **No tokens to manage**: GitHub Actions presents an OIDC identity to npm
- **No secrets to rotate**: npm issues a one-time credential for each workflow run
- **Provenance attestation**: Published packages include signed build provenance

The release workflow (`.github/workflows/release.yml`) triggers on `v*` tags and
publishes automatically without requiring an `NPM_TOKEN` secret.

**Required workflow permissions**: The release workflow must include `id-token: write`
permission to generate OIDC tokens:

```yaml
permissions:
  contents: read
  id-token: write  # Required for OIDC trusted publishing
```

## GitHub Releases

The release workflow automatically creates a GitHub Release when a tag is pushed:

- **Release name**: Matches the tag (e.g., `v0.2.0`)
- **Release notes**: Initially extracted from CHANGELOG; update with formatted notes
- **Pre-release flag**: Automatically set for versions containing `-` (e.g.,
  `1.0.0-beta.1`)

After pushing a tag:

1. Verify the release appears at: `https://github.com/OWNER/REPO/releases`
2. Update the release with formatted notes (Step 7 above)

## Troubleshooting

**Release workflow not running?**

- Ensure tag format is `v*` (e.g., `v0.2.0`)
- Check tag was pushed: `git ls-remote --tags origin`

**npm publish failing with 401/403?**

- Verify OIDC is configured: https://www.npmjs.com/package/PACKAGE/access
- Check repository is listed under “Trusted Publishing”
- Ensure the repository is public

**First publish?**

- OIDC requires the package to already exist on npm
- Do a manual `npm publish --access public` first
