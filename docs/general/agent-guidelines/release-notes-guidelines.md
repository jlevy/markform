# Release Notes Guidelines

Guidelines for writing clear, human-readable release notes for any software release (npm
packages, Python packages, CLI tools, libraries, etc.).

## Principles

Release notes should be:

- **Manual and curated**: Not automated parsing of commit messages—summarize
  meaningfully
- **User-focused**: Explain what changed from the user’s perspective
- **Concise**: Each bullet should be one line when possible
- **Thematic**: Group related commits into single bullets, not one bullet per commit

## Process

### Step 1: Review Changes

Review all commits since the last release.
Use your project’s tooling:

```bash
# Git log since last tag
git log $(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD~20")..HEAD --oneline

# Or use project-specific scripts if available (e.g., pnpm release:changes)
```

### Step 2: Categorize and Summarize

Group changes thematically.
Standard categories:

- **Breaking Changes**: Backward-incompatible changes requiring user action
- **Features**: New capabilities, significant enhancements
- **Fixes**: Bug fixes, corrections
- **Refactoring**: Internal improvements, code quality (only if notable to users)
- **Documentation**: Significant doc changes (skip trivial updates)

Multiple related commits should be combined into a single bullet point.
For example, “Fixed 5 coverage bugs” instead of 5 separate bullets.

### Step 3: Format the Release Notes

Use this template:

```markdown
## What's Changed

### Breaking Changes

- **Change name**: What changed and what users need to do to migrate

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

**Full commit history**: https://github.com/OWNER/REPO/compare/vX.X.X...vY.Y.Y
```

Omit sections that have no items (e.g., skip “Breaking Changes” for patch releases).

## Example

Here’s an example of good release notes:

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

**Full commit history**: https://github.com/owner/repo/compare/v0.1.14...v0.1.15
```

## Tips

- **Be concise**: Each bullet should be one line
- **Focus on impact**: What can users do now?
  What’s fixed?
- **Group related commits**: Combine related changes into single bullets
- **Skip trivial changes**: Badge updates, typo fixes, formatting don’t need mention
- **Link to full history**: Always include the compare URL for those who want details
- **Use bold for feature names**: Makes scanning easier

## What to Skip

Don’t include in release notes:

- Minor formatting or style changes
- Internal refactoring with no user-visible impact
- Dependency updates (unless significant or security-related)
- Typo fixes in code comments
- CI/CD configuration changes

## Where to Use Release Notes

Release notes should appear in:

1. **PR body** (for release PRs)
2. **GitHub Release** description
3. **CHANGELOG.md** (if maintained)

The same content can be used in all three places, ensuring consistency.
