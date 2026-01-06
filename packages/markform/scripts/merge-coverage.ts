#!/usr/bin/env npx tsx
/**
 * Merge vitest and tryscript coverage reports into a single unified report.
 * Updates coverage-summary.json with merged totals so badges show correct values.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const COVERAGE_DIR = 'coverage';
const TRYSCRIPT_DIR = 'coverage-tryscript';
const MERGED_DIR = 'coverage-merged';

interface CoverageData {
  lines: Map<string, Map<number, number>>; // file -> line -> hit count
  branches: Map<string, Map<string, number>>; // file -> branchId -> hit count
}

interface CoverageSummary {
  total: {
    lines: { total: number; covered: number; skipped: number; pct: number };
    statements: { total: number; covered: number; skipped: number; pct: number };
    functions: { total: number; covered: number; skipped: number; pct: number };
    branches: { total: number; covered: number; skipped: number; pct: number };
    branchesTrue: { total: number; covered: number; skipped: number; pct: number };
  };
  [file: string]: unknown;
}

function parseLcov(content: string): CoverageData {
  const lines = new Map<string, Map<number, number>>();
  const branches = new Map<string, Map<string, number>>();

  let currentFile = '';

  for (const line of content.split('\n')) {
    if (line.startsWith('SF:')) {
      currentFile = line.slice(3);
      if (!lines.has(currentFile)) {
        lines.set(currentFile, new Map());
      }
      if (!branches.has(currentFile)) {
        branches.set(currentFile, new Map());
      }
    } else if (line.startsWith('DA:') && currentFile) {
      const [lineNum, hits] = line.slice(3).split(',');
      const fileLines = lines.get(currentFile)!;
      const existingHits = fileLines.get(Number(lineNum)) ?? 0;
      fileLines.set(Number(lineNum), existingHits + Number(hits));
    } else if (line.startsWith('BRDA:') && currentFile) {
      const parts = line.slice(5).split(',');
      const branchId = `${parts[0]},${parts[1]},${parts[2]}`;
      const hits = parts[3] === '-' ? 0 : Number(parts[3]);
      const fileBranches = branches.get(currentFile)!;
      const existingHits = fileBranches.get(branchId) ?? 0;
      fileBranches.set(branchId, existingHits + hits);
    }
  }

  return { lines, branches };
}

function mergeCoverageData(a: CoverageData, b: CoverageData): CoverageData {
  const merged: CoverageData = {
    lines: new Map(a.lines),
    branches: new Map(a.branches),
  };

  // Merge lines
  for (const [file, fileLines] of b.lines) {
    if (!merged.lines.has(file)) {
      merged.lines.set(file, new Map(fileLines));
    } else {
      const existingLines = merged.lines.get(file)!;
      for (const [lineNum, hits] of fileLines) {
        const existingHits = existingLines.get(lineNum) ?? 0;
        existingLines.set(lineNum, existingHits + hits);
      }
    }
  }

  // Merge branches
  for (const [file, fileBranches] of b.branches) {
    if (!merged.branches.has(file)) {
      merged.branches.set(file, new Map(fileBranches));
    } else {
      const existingBranches = merged.branches.get(file)!;
      for (const [branchId, hits] of fileBranches) {
        const existingHits = existingBranches.get(branchId) ?? 0;
        existingBranches.set(branchId, existingHits + hits);
      }
    }
  }

  return merged;
}

function generateLcov(data: CoverageData): string {
  const output: string[] = [];

  for (const [file, fileLines] of data.lines) {
    output.push(`SF:${file}`);

    // Output line data
    const sortedLines = [...fileLines.entries()].sort((a, b) => a[0] - b[0]);
    for (const [lineNum, hits] of sortedLines) {
      output.push(`DA:${lineNum},${hits}`);
    }

    // Output branch data
    const fileBranches = data.branches.get(file);
    if (fileBranches) {
      for (const [branchId, hits] of fileBranches) {
        output.push(`BRDA:${branchId},${hits}`);
      }
    }

    output.push('end_of_record');
  }

  return output.join('\n');
}

function calculateStats(data: CoverageData) {
  let linesTotal = 0;
  let linesCovered = 0;
  let branchesTotal = 0;
  let branchesCovered = 0;

  for (const fileLines of data.lines.values()) {
    for (const hits of fileLines.values()) {
      linesTotal++;
      if (hits > 0) linesCovered++;
    }
  }

  for (const fileBranches of data.branches.values()) {
    for (const hits of fileBranches.values()) {
      branchesTotal++;
      if (hits > 0) branchesCovered++;
    }
  }

  return {
    lines: {
      total: linesTotal,
      covered: linesCovered,
      pct: linesTotal > 0 ? Number(((linesCovered / linesTotal) * 100).toFixed(2)) : 0,
    },
    branches: {
      total: branchesTotal,
      covered: branchesCovered,
      pct: branchesTotal > 0 ? Number(((branchesCovered / branchesTotal) * 100).toFixed(2)) : 0,
    },
  };
}

function main() {
  // Check input files exist
  const vitestLcov = join(COVERAGE_DIR, 'lcov.info');
  const tryscriptLcov = join(TRYSCRIPT_DIR, 'lcov.info');
  const coverageSummaryPath = join(COVERAGE_DIR, 'coverage-summary.json');

  if (!existsSync(vitestLcov)) {
    console.error(`Error: ${vitestLcov} not found. Run 'pnpm test:coverage:vitest' first.`);
    process.exit(1);
  }

  if (!existsSync(tryscriptLcov)) {
    console.error(`Error: ${tryscriptLcov} not found. Run 'pnpm test:coverage:tryscript' first.`);
    process.exit(1);
  }

  // Create output directory
  mkdirSync(MERGED_DIR, { recursive: true });

  console.log('Merging coverage reports...');

  // Parse both lcov files
  const vitestData = parseLcov(readFileSync(vitestLcov, 'utf8'));
  const tryscriptData = parseLcov(readFileSync(tryscriptLcov, 'utf8'));

  // Merge the coverage data
  const mergedData = mergeCoverageData(vitestData, tryscriptData);

  // Generate merged lcov file
  const mergedLcov = generateLcov(mergedData);
  writeFileSync(join(MERGED_DIR, 'lcov.info'), mergedLcov);

  // Calculate stats
  const stats = calculateStats(mergedData);

  // Update coverage-summary.json with merged totals
  if (existsSync(coverageSummaryPath)) {
    const summary = JSON.parse(readFileSync(coverageSummaryPath, 'utf8')) as CoverageSummary;

    // Keep original function stats (not available in merged lcov)
    const originalFunctions = summary.total.functions;

    summary.total = {
      lines: {
        total: stats.lines.total,
        covered: stats.lines.covered,
        skipped: 0,
        pct: stats.lines.pct,
      },
      statements: {
        total: stats.lines.total,
        covered: stats.lines.covered,
        skipped: 0,
        pct: stats.lines.pct,
      },
      functions: originalFunctions, // Keep original function stats
      branches: {
        total: stats.branches.total,
        covered: stats.branches.covered,
        skipped: 0,
        pct: stats.branches.pct,
      },
      branchesTrue: { total: 0, covered: 0, skipped: 0, pct: 100 },
    };

    writeFileSync(coverageSummaryPath, JSON.stringify(summary));
    console.log(`Updated ${coverageSummaryPath} with merged totals`);
  }

  // Print summary
  console.log('');
  console.log('=== Merged Coverage Summary ===');
  console.log(`Lines:      ${stats.lines.pct}% (${stats.lines.covered}/${stats.lines.total})`);
  console.log(
    `Branches:   ${stats.branches.pct}% (${stats.branches.covered}/${stats.branches.total})`,
  );
  console.log(`Statements: ${stats.lines.pct}% (${stats.lines.covered}/${stats.lines.total})`);
  console.log('');
  console.log(`Full report written to ${MERGED_DIR}/lcov.info`);
}

main();
