import { describe, it, expect } from 'vitest';
import type { AppState, AppAction, FinancialProfile, PathfinderResult, SearchMetadata, AppliedSummary } from '@/lib/types';
import { DEFAULT_PROFILE } from '@/lib/defaults';

/*
 * The appReducer is defined in page.tsx (a 'use client' component).
 * We re-create it here to test the pure logic without React rendering.
 * This mirrors the actual implementation exactly (page.tsx lines 13-39).
 */
import { applyConfirmedActions } from '@/lib/apply-actions';

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'UPDATE_PROFILE':
      if (state.step !== 'home') return state;
      return { step: 'home', profile: action.profile, customFunds: state.customFunds };
    case 'SUBMIT_EVENT':
      return { step: 'thinking', profile: state.profile, customFunds: state.customFunds, event: action.event };
    case 'COMPLETE_THINKING':
      if (state.step !== 'thinking') return state;
      return { step: 'plan', profile: state.profile, customFunds: state.customFunds, event: (state as { event: string }).event, result: action.result, searchMetadata: action.searchMetadata };
    case 'THINKING_ERROR':
      if (state.step !== 'thinking') return state;
      return { step: 'error', profile: state.profile, customFunds: state.customFunds, event: (state as { event: string }).event, message: action.message };
    case 'RESET':
      return { step: 'home', profile: state.profile, customFunds: state.customFunds };
    case 'APPLY_ACTIONS': {
      const oldProfile = state.profile;
      const oldFunds = state.customFunds;
      const { profile, customFunds } = applyConfirmedActions(
        oldProfile,
        oldFunds,
        action.confirmedIndices,
        action.actions,
      );

      const balanceFields = [
        'chequingBalance', 'savingsBalance', 'tfsaBalance',
        'rrspBalance', 'fhsaBalance', 'nonRegBalance',
      ] as const;
      const balanceChanges: Partial<Record<string, number>> = {};
      for (const field of balanceFields) {
        const delta = profile[field] - oldProfile[field];
        if (delta !== 0) balanceChanges[field] = delta;
      }

      const oldFundNames = new Set(oldFunds.map(f => f.name));
      const newFundNames = customFunds
        .filter(f => !oldFundNames.has(f.name))
        .map(f => f.name);

      const fundChanges: Record<string, number> = {};
      for (const fund of customFunds) {
        const old = oldFunds.find(f => f.name === fund.name);
        const delta = old ? fund.balance - old.balance : fund.balance;
        if (delta !== 0) fundChanges[fund.name] = delta;
      }

      const actions = action.confirmedIndices
        .map(i => action.actions[i]?.title)
        .filter((t): t is string => !!t);

      const appliedSummary: AppliedSummary = {
        actions,
        balanceChanges,
        newFundNames,
        fundChanges,
      };

      return { step: 'home', profile, customFunds, appliedSummary };
    }
    default:
      return state;
  }
}

// ── Fixtures ────────────────────────────────────────────────────────────────

const homeState: AppState = { step: 'home', profile: DEFAULT_PROFILE, customFunds: [] };

const thinkingState: AppState = { step: 'thinking', profile: DEFAULT_PROFILE, customFunds: [], event: 'Having a baby' };

const mockResult: PathfinderResult = {
  thinking_steps: [{ title: 'Step 1', insights: [{ text: 'test', type: 'neutral' }] }],
  impact_summary: {
    income_change: { value: '-$0', label: 'Income', type: 'neutral' },
    expense_change: { value: '+$2,400/mo', label: 'Expenses', type: 'negative' },
    net_worth_change: { value: '-$15K', label: 'Net Worth', type: 'negative' },
    timeline: { value: '18 months', label: 'Timeline', type: 'neutral' },
  },
  quick_actions: [
    { title: 'Move $2,000 to Emergency Fund', why: 'Buffer', type: 'move', amount: 2000, from_account: 'Chequing', to_account: 'Emergency Fund', priority: 'do_now' },
  ],
  advisor_flags: [],
  risk_warnings: [],
  account_impacts: [],
  monthly_cashflow: [],
};

const mockSearchMetadata: SearchMetadata = {
  queries: ['baby costs Canada 2026'],
  sources: [{ title: 'StatsCan', url: 'https://statcan.gc.ca' }],
};

const planState: AppState = {
  step: 'plan',
  profile: DEFAULT_PROFILE,
  customFunds: [],
  event: 'Having a baby',
  result: mockResult,
  searchMetadata: mockSearchMetadata,
};

const errorState: AppState = {
  step: 'error',
  profile: DEFAULT_PROFILE,
  customFunds: [],
  event: 'Having a baby',
  message: 'API failed',
};

// ── Tests ───────────────────────────────────────────────────────────────────

describe('appReducer', () => {
  // ── UPDATE_PROFILE ──

  describe('UPDATE_PROFILE', () => {
    it('updates profile when in home step', () => {
      const newProfile = { ...DEFAULT_PROFILE, annualIncome: 100000 };
      const next = appReducer(homeState, { type: 'UPDATE_PROFILE', profile: newProfile });
      expect(next.profile.annualIncome).toBe(100000);
      expect(next.step).toBe('home');
    });

    it('is ignored when not in home step', () => {
      const newProfile = { ...DEFAULT_PROFILE, annualIncome: 999999 };
      const next = appReducer(thinkingState, { type: 'UPDATE_PROFILE', profile: newProfile });
      expect(next.profile.annualIncome).toBe(DEFAULT_PROFILE.annualIncome);
    });

    it('clears appliedSummary when editing profile', () => {
      const stateWithSummary: AppState = {
        step: 'home',
        profile: DEFAULT_PROFILE,
        customFunds: [],
        appliedSummary: {
          actions: ['Test action'],
          balanceChanges: { chequingBalance: -1000 },
          newFundNames: [],
          fundChanges: {},
        },
      };
      const newProfile = { ...DEFAULT_PROFILE, annualIncome: 100000 };
      const next = appReducer(stateWithSummary, { type: 'UPDATE_PROFILE', profile: newProfile });
      expect((next as { appliedSummary?: AppliedSummary }).appliedSummary).toBeUndefined();
    });
  });

  // ── SUBMIT_EVENT ──

  describe('SUBMIT_EVENT', () => {
    it('transitions from home to thinking with event', () => {
      const next = appReducer(homeState, { type: 'SUBMIT_EVENT', event: 'Buying a house' });
      expect(next.step).toBe('thinking');
      expect((next as { event: string }).event).toBe('Buying a house');
    });

    it('preserves profile and customFunds', () => {
      const stateWithFunds: AppState = { ...homeState, customFunds: [{ name: 'Fund', balance: 100 }] };
      const next = appReducer(stateWithFunds, { type: 'SUBMIT_EVENT', event: 'test' });
      expect(next.profile).toEqual(DEFAULT_PROFILE);
      expect(next.customFunds).toHaveLength(1);
    });
  });

  // ── COMPLETE_THINKING ──

  describe('COMPLETE_THINKING', () => {
    it('transitions thinking → plan with result and searchMetadata', () => {
      const next = appReducer(thinkingState, {
        type: 'COMPLETE_THINKING',
        result: mockResult,
        searchMetadata: mockSearchMetadata,
      });
      expect(next.step).toBe('plan');
      expect((next as { result: PathfinderResult }).result).toBe(mockResult);
      expect((next as { searchMetadata: SearchMetadata | null }).searchMetadata).toBe(mockSearchMetadata);
    });

    it('preserves the event from thinking state', () => {
      const next = appReducer(thinkingState, {
        type: 'COMPLETE_THINKING',
        result: mockResult,
        searchMetadata: null,
      });
      expect((next as { event: string }).event).toBe('Having a baby');
    });

    it('is ignored when not in thinking step', () => {
      const next = appReducer(homeState, {
        type: 'COMPLETE_THINKING',
        result: mockResult,
        searchMetadata: null,
      });
      expect(next.step).toBe('home');
    });
  });

  // ── THINKING_ERROR ──

  describe('THINKING_ERROR', () => {
    it('transitions thinking → error with message', () => {
      const next = appReducer(thinkingState, {
        type: 'THINKING_ERROR',
        message: 'Rate limited',
      });
      expect(next.step).toBe('error');
      expect((next as { message: string }).message).toBe('Rate limited');
    });

    it('is ignored when not in thinking step', () => {
      const next = appReducer(planState, {
        type: 'THINKING_ERROR',
        message: 'should not apply',
      });
      expect(next.step).toBe('plan');
    });
  });

  // ── RESET ──

  describe('RESET', () => {
    it('returns to home from any step', () => {
      for (const state of [thinkingState, planState, errorState]) {
        const next = appReducer(state, { type: 'RESET' });
        expect(next.step).toBe('home');
      }
    });

    it('preserves profile and customFunds', () => {
      const modifiedProfile = { ...DEFAULT_PROFILE, annualIncome: 200000 };
      const state: AppState = {
        step: 'error',
        profile: modifiedProfile,
        customFunds: [{ name: 'My Fund', balance: 5000, emoji: '🎯' }],
        event: 'test',
        message: 'err',
      };
      const next = appReducer(state, { type: 'RESET' });
      expect(next.step).toBe('home');
      expect(next.profile.annualIncome).toBe(200000);
      expect(next.customFunds).toHaveLength(1);
      expect(next.customFunds[0].name).toBe('My Fund');
    });
  });

  // ── APPLY_ACTIONS ──

  describe('APPLY_ACTIONS', () => {
    it('applies confirmed actions and returns to home with appliedSummary', () => {
      const next = appReducer(planState, {
        type: 'APPLY_ACTIONS',
        confirmedIndices: [0],
        actions: mockResult.quick_actions,
      });
      expect(next.step).toBe('home');
      // The move action deducted $2000 from chequing
      expect(next.profile.chequingBalance).toBe(DEFAULT_PROFILE.chequingBalance - 2000);
      // Created 'Emergency Fund' custom fund
      expect(next.customFunds).toHaveLength(1);
      expect(next.customFunds[0].name).toBe('Emergency Fund');
      expect(next.customFunds[0].balance).toBe(2000);

      // Verify appliedSummary
      const summary = (next as { appliedSummary?: AppliedSummary }).appliedSummary;
      expect(summary).toBeDefined();
      expect(summary!.actions).toEqual(['Move $2,000 to Emergency Fund']);
      expect(summary!.balanceChanges.chequingBalance).toBe(-2000);
      expect(summary!.newFundNames).toEqual(['Emergency Fund']);
      expect(summary!.fundChanges['Emergency Fund']).toBe(2000);
    });

    it('returns home with empty appliedSummary when no indices confirmed', () => {
      const next = appReducer(planState, {
        type: 'APPLY_ACTIONS',
        confirmedIndices: [],
        actions: mockResult.quick_actions,
      });
      expect(next.step).toBe('home');
      expect(next.profile.chequingBalance).toBe(DEFAULT_PROFILE.chequingBalance);
      expect(next.customFunds).toHaveLength(0);

      const summary = (next as { appliedSummary?: AppliedSummary }).appliedSummary;
      expect(summary).toBeDefined();
      expect(summary!.actions).toEqual([]);
      expect(summary!.balanceChanges).toEqual({});
      expect(summary!.newFundNames).toEqual([]);
      expect(summary!.fundChanges).toEqual({});
    });
  });

  // ── Default case ──

  describe('unknown action', () => {
    it('returns the same state for unknown action types', () => {
      const next = appReducer(homeState, { type: 'UNKNOWN' } as unknown as AppAction);
      expect(next).toBe(homeState);
    });
  });
});
