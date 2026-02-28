'use client';

import { useReducer, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { AppState, AppAction, FinancialProfile, PathfinderResult, SearchMetadata, QuickAction, AppliedSummary } from '@/lib/types';
import { DEFAULT_PROFILE } from '@/lib/defaults';
import { applyConfirmedActions } from '@/lib/apply-actions';
import HomeScreen from '@/components/home/HomeScreen';
import ThinkingView from '@/components/thinking/ThinkingView';
import PlanView from '@/components/plan/PlanView';
import { Logo } from "@/components/ui/Logo";

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'UPDATE_PROFILE':
      if (state.step !== 'home') return state;
      return { step: 'home', profile: action.profile, customFunds: state.customFunds };
    case 'SUBMIT_EVENT':
      return { step: 'thinking', profile: state.profile, customFunds: state.customFunds, event: action.event };
    case 'COMPLETE_THINKING':
      if (state.step !== 'thinking') return state;
      return { step: 'plan', profile: state.profile, customFunds: state.customFunds, event: state.event, result: action.result, searchMetadata: action.searchMetadata };
    case 'THINKING_ERROR':
      if (state.step !== 'thinking') return state;
      return { step: 'error', profile: state.profile, customFunds: state.customFunds, event: state.event, message: action.message };
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

const initialState: AppState = { step: 'home', profile: DEFAULT_PROFILE, customFunds: [] };

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

const pageTransition = {
  duration: 0.4,
  ease: 'easeOut' as const,
};

export default function Home() {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const handleProfileChange = useCallback((profile: FinancialProfile) => {
    dispatch({ type: 'UPDATE_PROFILE', profile });
  }, []);

  const handleEventSubmit = useCallback((event: string) => {
    dispatch({ type: 'SUBMIT_EVENT', event });
  }, []);

  const handleThinkingComplete = useCallback((result: PathfinderResult, searchMetadata: SearchMetadata | null) => {
    dispatch({ type: 'COMPLETE_THINKING', result, searchMetadata });
  }, []);

  const handleThinkingError = useCallback((message: string) => {
    dispatch({ type: 'THINKING_ERROR', message });
  }, []);

  const handleReset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const handleApplyActions = useCallback((confirmedIndices: number[], actions: QuickAction[]) => {
    dispatch({ type: 'APPLY_ACTIONS', confirmedIndices, actions });
  }, []);

  const handleRetry = useCallback(() => {
    if (state.step === 'error') {
      dispatch({ type: 'SUBMIT_EVENT', event: state.event });
    }
  }, [state]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--ws-bg-dark)] sm:p-6">
      <main className="relative w-full h-full min-h-screen sm:min-h-[850px] max-w-5xl bg-[var(--ws-bg-primary)] sm:rounded-[32px] sm:border sm:border-[var(--ws-border)] shadow-[0_24px_70px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col items-center">
        {/* Header bar */}
        <header
          className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 pt-4 pb-3.5 bg-[var(--ws-bg-primary)]/95 backdrop-blur-md border-b border-[var(--ws-border)]"
        >
          <div className="flex items-center gap-3">
            <Logo />
            <span
              className="text-[11px] font-medium px-1.5 py-0.5 rounded-md"
              style={{
                backgroundColor: 'var(--ws-bg-surface)',
                color: 'var(--ws-text-tertiary)',
                transition: 'all 500ms ease-in-out',
              }}
            >
              beta
            </span>
          </div>
          {state.step !== 'home' && (
            <button
              onClick={handleReset}
              className="text-[13px] font-medium transition-colors hover:opacity-70"
              style={{ color: 'var(--ws-text-tertiary)' }}
            >
              Start over
            </button>
          )}
        </header>

        {/* Scrollable Screen content area */}
        <div className="w-full h-full overflow-y-auto overflow-x-hidden hide-scrollbar relative">
          <AnimatePresence mode="popLayout">
            {state.step === 'home' && (
              <motion.div
                key="home"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
                className="pt-[70px] pb-10 w-full"
              >
                <HomeScreen
                  profile={state.profile}
                  customFunds={state.customFunds}
                  appliedSummary={state.appliedSummary}
                  onProfileChange={handleProfileChange}
                  onSubmit={handleEventSubmit}
                />
              </motion.div>
            )}

            {state.step === 'thinking' && (
              <motion.div
                key="thinking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full h-full flex flex-col justify-center items-center p-6 mt-10"
              >
                <ThinkingView
                  profile={state.profile}
                  customFunds={state.customFunds}
                  event={state.event}
                  onComplete={handleThinkingComplete}
                  onError={handleThinkingError}
                />
              </motion.div>
            )}

            {state.step === 'plan' && (
              <motion.div
                key="plan"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
                className="pt-[70px] w-full"
              >
                <PlanView
                  result={state.result}
                  event={state.event}
                  searchMetadata={state.searchMetadata}
                  onReset={handleReset}
                  onApplyActions={handleApplyActions}
                />
              </motion.div>
            )}

            {state.step === 'error' && (
              <motion.div
                key="error"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
                className="pt-[70px] w-full"
              >
                <div className="mx-auto max-w-[400px] px-6 pt-20 text-center">
                  <div
                    className="rounded-xl p-6 mb-6"
                    style={{
                      backgroundColor: 'var(--ws-bg-surface)',
                      border: '1px solid var(--ws-border)',
                    }}
                  >
                    <p className="text-[18px] font-semibold mb-2" style={{ color: 'var(--ws-text-primary)' }}>
                      Something went wrong
                    </p>
                    <p className="text-[14px] mb-5" style={{ color: 'var(--ws-text-secondary)' }}>
                      {state.message}
                    </p>
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={handleRetry}
                        className="px-5 py-2.5 rounded-full text-[14px] font-semibold cursor-pointer"
                        style={{
                          backgroundColor: 'var(--ws-text-primary)',
                          color: 'var(--ws-bg-primary)',
                        }}
                      >
                        Try again
                      </button>
                      <button
                        onClick={handleReset}
                        className="px-5 py-2.5 rounded-full text-[14px] font-medium cursor-pointer"
                        style={{
                          border: '1px solid var(--ws-border)',
                          color: 'var(--ws-text-secondary)',
                        }}
                      >
                        Go back
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
