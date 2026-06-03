import { describe, it, expect, beforeAll } from 'vitest';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runEvals, metricTable, renderResultsMarkdown, type Scorecard } from './harness';

const here = dirname(fileURLToPath(import.meta.url));

let card: Scorecard;

beforeAll(() => {
  card = runEvals();

  // Emit the showcase artifacts: a human-readable scorecard + a CI-friendly JSON.
  console.log('\n── Pathfinder eval scorecard ─────────────────────────────');
  console.table(metricTable(card));
  console.log(`Scenarios: ${card.totalPassed}/${card.totalScenarios} passing\n`);

  writeFileSync(join(here, 'RESULTS.md'), renderResultsMarkdown(card));
  writeFileSync(join(here, 'results.json'), JSON.stringify(card, null, 2));
});

describe('Pathfinder pipeline evals', () => {
  it('runs every recorded scenario through the real guardrail pipeline', () => {
    expect(card.totalScenarios).toBeGreaterThanOrEqual(6);
  });

  it('passes every metric for every scenario', () => {
    const failures = card.scenarios
      .filter((s) => !s.passed)
      .map((s) => `${s.id}: ${s.metrics.filter((m) => !m.passed).map((m) => `${m.name} (${m.detail})`).join('; ')}`);
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('reports 100% on every metric', () => {
    for (const [name, { passed, total }] of Object.entries(card.perMetric)) {
      expect(passed, `${name} only ${passed}/${total}`).toBe(total);
    }
  });
});
