import { describe, it, expect, beforeAll } from 'vitest';
import { GoogleGenAI } from '@google/genai';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  stripMarkdownFences,
  parsePathfinderResult,
  routeQuery,
  searchForContext,
  generatePlan,
  runPathfinder,
} from '@/lib/pathfinder-engine';
import type { FinancialProfile } from '@/lib/types';

// Load .env manually (no dotenv dependency)
try {
  const envContent = readFileSync(resolve(__dirname, '../../.env'), 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
} catch { /* .env not found, rely on existing env */ }

// ── Test profiles ────────────────────────────────────────────────────────────

const PROFILE_A: FinancialProfile = {
  annualIncome: 85000,
  employmentType: 'employed',
  partnerIncome: 65000,
  province: 'ON',
  chequingBalance: 12400,
  savingsBalance: 18000,
  tfsaBalance: 34500,
  tfsaRoom: 7000,
  rrspBalance: 22000,
  rrspRoom: 15200,
  fhsaBalance: 0,
  nonRegBalance: 8000,
  housingType: 'rent',
  housingExpense: 2200,
  mortgageBalance: 0,
  essentialExpenses: 1800,
  discretionarySpending: 800,
  debtPayments: 400,
  creditCardBalance: 853.37,
};

const PROFILE_B: FinancialProfile = {
  annualIncome: 120000,
  employmentType: 'employed',
  partnerIncome: 0,
  province: 'BC',
  chequingBalance: 5000,
  savingsBalance: 10000,
  tfsaBalance: 20000,
  tfsaRoom: 14000,
  rrspBalance: 0,
  rrspRoom: 40000,
  fhsaBalance: 0,
  nonRegBalance: 3000,
  housingType: 'rent',
  housingExpense: 2500,
  mortgageBalance: 0,
  essentialExpenses: 1500,
  discretionarySpending: 600,
  debtPayments: 200,
  creditCardBalance: 0,
};

// ── Unit: stripMarkdownFences ────────────────────────────────────────────────

describe('stripMarkdownFences', () => {
  it('strips ```json ... ``` fences', () => {
    const input = '```json\n{"key": "value"}\n```';
    expect(stripMarkdownFences(input)).toBe('{"key": "value"}');
  });

  it('strips plain ``` fences', () => {
    const input = '```\n{"a": 1}\n```';
    expect(stripMarkdownFences(input)).toBe('{"a": 1}');
  });

  it('leaves clean JSON unchanged', () => {
    const input = '{"key": "value"}';
    expect(stripMarkdownFences(input)).toBe('{"key": "value"}');
  });

  it('handles extra whitespace', () => {
    const input = '  \n```json\n{"a":1}\n```\n  ';
    expect(stripMarkdownFences(input)).toBe('{"a":1}');
  });
});

// ── Unit: parsePathfinderResult ──────────────────────────────────────────────

describe('parsePathfinderResult', () => {
  const validResult = {
    thinking_steps: [{ title: 'Test', insights: [] }],
    impact_summary: {
      income_change: { value: '-10%', label: 'Year 1', type: 'negative' },
      expense_change: { value: '+$500', label: '/mo', type: 'negative' },
      net_worth_change: { value: '+$50K', label: '5yr', type: 'positive' },
      timeline: { value: '12 months', label: 'to stable', type: 'neutral' },
    },
    quick_actions: [],
    advisor_flags: [],
    risk_warnings: [],
    monthly_cashflow: [{ phase: 'Current', amount: 1000 }],
  };

  it('parses valid JSON correctly', () => {
    const result = parsePathfinderResult(JSON.stringify(validResult));
    expect(result.thinking_steps).toHaveLength(1);
    expect(result.thinking_steps[0].title).toBe('Test');
  });

  it('parses JSON wrapped in markdown fences', () => {
    const wrapped = '```json\n' + JSON.stringify(validResult) + '\n```';
    const result = parsePathfinderResult(wrapped);
    expect(result.monthly_cashflow[0].amount).toBe(1000);
  });

  it('throws on invalid JSON', () => {
    expect(() => parsePathfinderResult('not json at all')).toThrow(
      'Failed to parse AI response as JSON',
    );
  });

  it('throws on missing required key', () => {
    const incomplete = { thinking_steps: [] };
    expect(() =>
      parsePathfinderResult(JSON.stringify(incomplete)),
    ).toThrow('Missing required key');
  });
});

// ── Integration: Router (live AI) ────────────────────────────────────────────

describe('routeQuery (live AI)', () => {
  let ai: GoogleGenAI;

  beforeAll(() => {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_API_KEY required for integration tests');
    ai = new GoogleGenAI({ apiKey });
  });

  it('returns needs_search=false for simple TFSA question', async () => {
    const result = await routeQuery(
      ai,
      PROFILE_A,
      'I want to max out my TFSA this year',
      [],
    );
    expect(result.needs_search).toBe(false);
    expect(result.queries).toHaveLength(0);
  });

  it('returns needs_search=true for mortgage/housing question', async () => {
    const result = await routeQuery(
      ai,
      PROFILE_A,
      'I want to buy a condo in downtown Toronto for $700K',
      [],
    );
    expect(result.needs_search).toBe(true);
    expect(result.queries.length).toBeGreaterThan(0);
    expect(result.queries.length).toBeLessThanOrEqual(3);
  });

  it('returns needs_search=true for business startup', async () => {
    const result = await routeQuery(
      ai,
      PROFILE_B,
      'I want to quit my job and open a coffee shop in Vancouver',
      [],
    );
    expect(result.needs_search).toBe(true);
    expect(result.queries.length).toBeGreaterThan(0);
  });
});

// ── Integration: Search (live Google Search) ─────────────────────────────────

describe('searchForContext (live Google Search)', () => {
  let ai: GoogleGenAI;

  beforeAll(() => {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_API_KEY required for integration tests');
    ai = new GoogleGenAI({ apiKey });
  });

  it('returns real data and sources for mortgage rate query', async () => {
    const { text, metadata } = await searchForContext(ai, [
      'current 5-year fixed mortgage rate Canada 2026',
    ]);
    expect(text.length).toBeGreaterThan(50);
    // Should contain actual rate numbers
    expect(text).toMatch(/\d+\.?\d*%/);
    // Should return source URLs
    expect(metadata.sources.length).toBeGreaterThan(0);
    expect(metadata.queries.length).toBeGreaterThan(0);
  });
});

// ── Integration: Full pipeline (live AI end-to-end) ──────────────────────────

describe('generatePlan (live AI)', () => {
  let ai: GoogleGenAI;

  beforeAll(() => {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_API_KEY required for integration tests');
    ai = new GoogleGenAI({ apiKey });
  });

  it('generates a valid plan using profile data (no search)', async () => {
    const result = await generatePlan(
      ai,
      PROFILE_A,
      'I want to max out my TFSA and RRSP this year',
      null,
      [],
    );

    // Structure checks
    expect(result.thinking_steps.length).toBeGreaterThanOrEqual(3);
    expect(result.quick_actions.length).toBeGreaterThanOrEqual(3);
    expect(result.advisor_flags.length).toBeGreaterThanOrEqual(1);
    expect(result.risk_warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.monthly_cashflow.length).toBeGreaterThanOrEqual(1);

    // Verify it uses ACTUAL profile numbers — not generic
    const allText = JSON.stringify(result);
    expect(allText).toContain('85');  // annualIncome reference
    expect(allText).toMatch(/34[.,]?5|34500/); // TFSA balance
    expect(allText).toMatch(/22[.,]?0|22000/); // RRSP balance

    // Impact summary has correct structure
    expect(result.impact_summary.income_change).toBeDefined();
    expect(result.impact_summary.expense_change).toBeDefined();
    expect(result.impact_summary.timeline).toBeDefined();

    // Quick actions are real actions with proper structure
    for (const action of result.quick_actions) {
      expect(action.title).toBeTruthy();
      expect(action.why).toBeTruthy();
      expect(['move', 'create_fund', 'automate', 'open_account', 'pause', 'adjust', 'pay_off']).toContain(action.type);
      expect(['do_now', 'this_week', 'this_month', 'next_quarter']).toContain(action.priority);
    }
  });

  it('uses custom profile B (BC, 120K, single) not defaults', async () => {
    const result = await generatePlan(
      ai,
      PROFILE_B,
      'I want to take a year off to travel',
      null,
      [],
    );

    const allText = JSON.stringify(result);
    // Should reference Profile B's income, not Profile A's
    expect(allText).toContain('120');
    // Should use Profile B balances (20K TFSA, 10K savings)
    expect(allText).toMatch(/20[,.]?000|20K|\$20/);
    // Should have quick actions
    expect(result.quick_actions.length).toBeGreaterThanOrEqual(3);
  });
});

// ── Integration: Full orchestrator (router + optional search + generate) ─────

describe('runPathfinder (full pipeline)', () => {
  beforeAll(() => {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY required for integration tests');
    }
  });

  it('runs full pipeline for simple scenario (no search)', async () => {
    const { result, searchMetadata } = await runPathfinder(
      PROFILE_A,
      'I want to pay off my debt faster',
    );

    expect(result.thinking_steps.length).toBeGreaterThanOrEqual(3);
    expect(result.quick_actions.length).toBeGreaterThanOrEqual(3);
    expect(result.monthly_cashflow.length).toBeGreaterThanOrEqual(2);

    // Simple scenario should not have search metadata
    expect(searchMetadata).toBeNull();

    // Should reference the $400 debt payments from the profile
    const allText = JSON.stringify(result);
    expect(allText).toMatch(/400|debt/i);
  });

  it('runs full pipeline for complex scenario (with search)', async () => {
    const { result, searchMetadata } = await runPathfinder(
      PROFILE_B,
      'I want to buy a house in Vancouver for around $900K',
    );

    expect(result.thinking_steps.length).toBeGreaterThanOrEqual(3);
    expect(result.quick_actions.length).toBeGreaterThanOrEqual(3);
    expect(result.advisor_flags.length).toBeGreaterThanOrEqual(1);

    // Complex scenario should have search metadata with sources
    expect(searchMetadata).not.toBeNull();
    expect(searchMetadata!.queries.length).toBeGreaterThan(0);
    expect(searchMetadata!.sources.length).toBeGreaterThan(0);

    // Should use profile B's data
    const allText = JSON.stringify(result);
    expect(allText).toContain('120');
    expect(allText).toMatch(/900|Vancouver/i);
  });
});
