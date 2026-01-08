#!/usr/bin/env npx tsx
/**
 * Generate release notes from merged PRs since the last release.
 *
 * This script:
 * 1. Finds the last release tag and its date
 * 2. Fetches all PRs merged since that date
 * 3. Categorizes them by conventional commit prefix
 * 4. Generates structured release notes
 *
 * Usage:
 *   pnpm release-notes              # Preview release notes
 *   pnpm release-notes --changeset  # Write to .changeset/ file
 *   pnpm release-notes --json       # Output raw PR data as JSON
 *
 * Options:
 *   --changeset    Write output to .changeset/v{version}.md
 *   --json         Output raw PR data as JSON
 *   --bump TYPE    Version bump type: patch, minor, major (default: patch)
 *   --version VER  Target version (default: auto-increment from last tag)
 *   --repo OWNER/REPO  GitHub repo (default: from git remote)
 *
 * Requirements:
 *   - gh CLI installed and authenticated
 *   - Git repository with tags
 *
 * Adapting for other projects:
 *   1. Update PACKAGE_NAME constant
 *   2. Customize CATEGORY_CONFIG for your commit conventions
 *   3. Adjust EXCLUDED_PATTERNS for your automation PRs
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// =============================================================================
// Configuration - customize for your project
// =============================================================================

const PACKAGE_NAME = 'markform';

// Map conventional commit prefixes to release note categories
const CATEGORY_CONFIG: Record<string, { title: string; order: number }> = {
  feat: { title: 'Features', order: 1 },
  fix: { title: 'Bug Fixes', order: 2 },
  perf: { title: 'Performance', order: 3 },
  refactor: { title: 'Refactoring', order: 4 },
  test: { title: 'Testing', order: 5 },
  docs: { title: 'Documentation', order: 6 },
  ci: { title: 'CI/CD', order: 7 },
  chore: { title: 'Maintenance', order: 8 },
};

// PRs matching these patterns are excluded from release notes
const EXCLUDED_PATTERNS = [
  /^chore: release/i,
  /^chore: update badge/i,
  /^Updating coverage badges/i,
];

// =============================================================================
// Types
// =============================================================================

interface PR {
  number: number;
  title: string;
  mergedAt: string;
  url: string;
  author: { login: string };
}

interface CategorizedPR {
  category: string;
  title: string;
  number: number;
  scope?: string;
}

interface ReleaseNotesData {
  version: string;
  previousVersion: string;
  bump: 'patch' | 'minor' | 'major';
  repo: string;
  prs: CategorizedPR[];
  categories: Map<string, CategorizedPR[]>;
}

// =============================================================================
// Helpers
// =============================================================================

function exec(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (e: unknown) {
    const error = e as { stderr?: Buffer; message?: string };
    throw new Error(`Command failed: ${cmd}\n${error.stderr?.toString() ?? error.message}`);
  }
}

function getLastTag(): string {
  try {
    return exec('git describe --tags --abbrev=0');
  } catch {
    throw new Error('No tags found. Create an initial release first.');
  }
}

function getTagDate(tag: string): string {
  // Get the date of the tag (or the commit it points to)
  return exec(`git log -1 --format=%cI ${tag}`);
}

function getRepoFromRemote(): string {
  const remote = exec('git remote get-url origin');
  // Handle HTTPS, SSH, and proxy URLs
  // - https://github.com/owner/repo
  // - git@github.com:owner/repo
  // - http://proxy@host/git/owner/repo
  const patterns = [
    /github\.com[:/]([^/]+\/[^/.]+)/, // Standard GitHub URLs
    /\/git\/([^/]+\/[^/.]+)/, // Proxy URLs like /git/owner/repo
  ];
  for (const pattern of patterns) {
    const match = remote.match(pattern);
    if (match) {
      return match[1].replace(/\.git$/, '');
    }
  }
  throw new Error(`Could not parse repo from remote: ${remote}`);
}

function incrementVersion(version: string, bump: 'patch' | 'minor' | 'major'): string {
  const v = version.replace(/^v/, '');
  const parts = v.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid version format: ${version}`);
  }
  const [major, minor, patch] = parts;
  switch (bump) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
  }
}

function fetchMergedPRs(repo: string, sinceDate: string): PR[] {
  // Format date for GitHub search (YYYY-MM-DD)
  const dateStr = sinceDate.split('T')[0];
  const query = `merged:>${dateStr}`;

  const cmd = `gh pr list -R ${repo} --state merged --search "${query}" --json number,title,mergedAt,url,author --limit 200`;

  try {
    const output = exec(cmd);
    return JSON.parse(output) as PR[];
  } catch (e) {
    console.error('Failed to fetch PRs. Ensure gh CLI is installed and authenticated.');
    throw e;
  }
}

function parsePRTitle(title: string): { type: string; scope?: string; description: string } {
  // Match: type(scope): description  OR  type: description
  const match = /^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/.exec(title);
  if (match) {
    return {
      type: match[1].toLowerCase(),
      scope: match[2],
      description: match[3],
    };
  }
  // Fallback for non-conventional titles
  return { type: 'other', description: title };
}

function categorizePRs(prs: PR[]): Map<string, CategorizedPR[]> {
  const categories = new Map<string, CategorizedPR[]>();

  for (const pr of prs) {
    // Skip excluded PRs
    if (EXCLUDED_PATTERNS.some((pattern) => pattern.test(pr.title))) {
      continue;
    }

    const parsed = parsePRTitle(pr.title);
    const categoryKey = CATEGORY_CONFIG[parsed.type] ? parsed.type : 'other';

    const categorizedPR: CategorizedPR = {
      category: categoryKey,
      title: parsed.description,
      number: pr.number,
      scope: parsed.scope,
    };

    if (!categories.has(categoryKey)) {
      categories.set(categoryKey, []);
    }
    categories.get(categoryKey)!.push(categorizedPR);
  }

  return categories;
}

function formatReleaseNotes(data: ReleaseNotesData): string {
  const lines: string[] = [];

  // Sort categories by configured order
  const sortedCategories = [...data.categories.entries()].sort((a, b) => {
    const orderA = CATEGORY_CONFIG[a[0]]?.order ?? 99;
    const orderB = CATEGORY_CONFIG[b[0]]?.order ?? 99;
    return orderA - orderB;
  });

  for (const [categoryKey, prs] of sortedCategories) {
    const config = CATEGORY_CONFIG[categoryKey];
    const title = config?.title ?? 'Other Changes';

    lines.push(`### ${title}`);
    lines.push('');

    for (const pr of prs) {
      const scope = pr.scope ? `**${pr.scope}**: ` : '';
      lines.push(`- ${scope}${pr.title} (#${pr.number})`);
    }

    lines.push('');
  }

  // Add compare link
  lines.push(
    `**Full Changelog**: https://github.com/${data.repo}/compare/v${data.previousVersion}...v${data.version}`,
  );

  return lines.join('\n');
}

function formatChangeset(data: ReleaseNotesData): string {
  const notes = formatReleaseNotes(data);

  return `---
"${PACKAGE_NAME}": ${data.bump}
---

${notes}
`;
}

// =============================================================================
// Main
// =============================================================================

function parseArgs(): {
  changeset: boolean;
  json: boolean;
  bump: 'patch' | 'minor' | 'major';
  version?: string;
  repo?: string;
} {
  const args = process.argv.slice(2);
  const result = {
    changeset: false,
    json: false,
    bump: 'patch' as const,
    version: undefined as string | undefined,
    repo: undefined as string | undefined,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--changeset':
        result.changeset = true;
        break;
      case '--json':
        result.json = true;
        break;
      case '--bump':
        result.bump = args[++i] as 'patch' | 'minor' | 'major';
        break;
      case '--version':
        result.version = args[++i];
        break;
      case '--repo':
        result.repo = args[++i];
        break;
      case '--help':
      case '-h':
        console.log(`
Usage: pnpm release-notes [options]

Generate release notes from merged PRs since the last release.

Options:
  --changeset       Write output to .changeset/v{version}.md
  --json            Output raw PR data as JSON
  --bump TYPE       Version bump type: patch, minor, major (default: patch)
  --version VER     Target version (default: auto-increment)
  --repo OWNER/REPO GitHub repo (default: from git remote)
  --help, -h        Show this help message

Examples:
  pnpm release-notes                    # Preview release notes
  pnpm release-notes --bump minor       # Preview with minor bump
  pnpm release-notes --changeset        # Write to .changeset/
`);
        process.exit(0);
    }
  }

  return result;
}

function main() {
  const args = parseArgs();

  // Get repo
  const repo = args.repo ?? getRepoFromRemote();
  console.error(`Repository: ${repo}`);

  // Get last tag
  const lastTag = getLastTag();
  const previousVersion = lastTag.replace(/^v/, '');
  console.error(`Last release: ${lastTag}`);

  // Get tag date
  const tagDate = getTagDate(lastTag);
  console.error(`Tag date: ${tagDate}`);

  // Determine new version
  const version = args.version ?? incrementVersion(previousVersion, args.bump);
  console.error(`New version: v${version} (${args.bump})`);

  // Fetch PRs
  console.error('\nFetching merged PRs...');
  const prs = fetchMergedPRs(repo, tagDate);
  console.error(`Found ${prs.length} merged PRs since ${lastTag}`);

  // JSON output mode
  if (args.json) {
    console.log(JSON.stringify(prs, null, 2));
    return;
  }

  // Categorize PRs
  const categories = categorizePRs(prs);
  const totalIncluded = [...categories.values()].reduce((sum, arr) => sum + arr.length, 0);
  console.error(`Included ${totalIncluded} PRs in release notes\n`);

  const data: ReleaseNotesData = {
    version,
    previousVersion,
    bump: args.bump,
    repo,
    prs: [...categories.values()].flat(),
    categories,
  };

  // Generate output
  if (args.changeset) {
    const content = formatChangeset(data);
    const filename = `v${version}.md`;
    const filepath = join(process.cwd(), '.changeset', filename);

    if (existsSync(filepath)) {
      console.error(`Warning: ${filepath} already exists, overwriting`);
    }

    writeFileSync(filepath, content);
    console.error(`Written to .changeset/${filename}`);
    console.log(filepath);
  } else {
    // Preview mode - print release notes
    console.log('─'.repeat(60));
    console.log(formatReleaseNotes(data));
  }
}

try {
  main();
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  console.error('Error:', message);
  process.exit(1);
}
