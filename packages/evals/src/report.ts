/**
 * Markdown regression report from a set of scored fixtures.
 */

import type { RubricScore } from './rubric.js';

export interface FixtureResult {
  name: string;
  score: RubricScore;
}

function fmt(value: number | null): string {
  return value === null ? '—' : value.toFixed(2);
}

export function formatReport(results: readonly FixtureResult[]): string {
  const passed = results.filter((r) => r.score.passed).length;
  const lines: string[] = [
    `# Regression report`,
    ``,
    `${passed}/${results.length} fixtures passed.`,
    ``,
    `| fixture | passed | total | trace | validity | determinism |`,
    `| --- | --- | --- | --- | --- | --- |`,
  ];
  for (const { name, score } of results) {
    lines.push(
      `| ${name} | ${score.passed ? '✅' : '❌'} | ${fmt(score.total)} | ${fmt(
        score.traceResolution,
      )} | ${fmt(score.envelopeValidity)} | ${fmt(score.determinism)} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}
