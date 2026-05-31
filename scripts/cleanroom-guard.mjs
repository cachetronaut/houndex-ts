#!/usr/bin/env node
/**
 * Clean-room guard.
 *
 * Fails if any disallowed token appears in a git-tracked file. This keeps the
 * public framework free of names and terminology carried over from the
 * applications that use it. Run via `pnpm cleanroom` (part of `pnpm verify`)
 * and in CI.
 *
 * To intentionally allow a term, remove it from BANNED below with a comment
 * explaining why, or add a specific path to ALLOWED_PATHS.
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** Case-insensitive substrings that must never appear in tracked source. */
const BANNED = [
  'aquir',
  'competitor',
  'competitive',
  'positioning',
  'talkingpoint',
  'buyersignal',
  'crowdstrike',
  'splunk',
  'market_position',
  'customer_segment',
];

/** Files exempt from the scan (this guard declares the banned list itself). */
const ALLOWED_PATHS = new Set(['scripts/cleanroom-guard.mjs']);

/** Extensions we treat as text and therefore scan. */
const TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|jsonc|md|mdx|yml|yaml|sql|txt|toml|css|html|sh)$/;

function trackedFiles() {
  return execSync('git ls-files', { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

const lowerBanned = BANNED.map((term) => term.toLowerCase());
const violations = [];

for (const file of trackedFiles()) {
  if (ALLOWED_PATHS.has(file)) continue;
  if (!TEXT_EXT.test(file)) continue;

  let contents;
  try {
    contents = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  const lines = contents.split('\n');
  lines.forEach((line, index) => {
    const lower = line.toLowerCase();
    for (const term of lowerBanned) {
      if (lower.includes(term)) {
        violations.push({ file, line: index + 1, term, text: line.trim() });
      }
    }
  });
}

if (violations.length > 0) {
  console.error('Clean-room guard FAILED — disallowed tokens found:\n');
  for (const violation of violations) {
    console.error(`  ${violation.file}:${violation.line}  [${violation.term}]  ${violation.text}`);
  }
  console.error(`\n${violations.length} violation(s). See scripts/cleanroom-guard.mjs.`);
  process.exit(1);
}

console.log(`Clean-room guard passed (${BANNED.length} terms checked).`);
