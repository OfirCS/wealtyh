'use client';

import { useReducer, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { AppState, AppAction, FinancialProfile, PathfinderResult, SearchMetadata, QuickAction } from '@/lib/types';
import { DEFAULT_PROFILE } from '@/lib/defaults';
import { applyConfirmedActions } from '@/lib/apply-actions';
import HomeScreen from '@/components/home/HomeScreen';
import ThinkingView from '@/components/thinking/ThinkingView';
import PlanView from '@/components/plan/PlanView';
import { Logo } from '@/components/ui/Logo';

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'UPDATE_PROFILE':
      if (state.step !== 'home') return state;
      return { ...state, profile: action.profile };
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
      const { profile, customFunds } = applyConfirmedActions(
        state.profile,
        state.customFunds,
        action.confirmedIndices,
        action.actions,
      );
      return { step: 'home', profile, customFunds };
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
    <div className="min-h-screen w-full flex items-center justify-center bg-[#E6E1DA] sm:py-6">
      <main className="relative w-full h-full min-h-screen sm:min-h-[850px] sm:max-h-[850px] sm:max-w-[430px] bg-[var(--ws-bg-primary)] sm:rounded-[38px] sm:border sm:border-[#D8D3CC] sm:shadow-[0_24px_70px_rgba(42,39,36,0.16)] overflow-hidden flex flex-col items-center">
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
        <div className="w-full h-full overflow-y-auto overflow-x-hidden hide-scrollbar">
          <AnimatePresence mode="wait">
            {state.step === 'home' && (
              <motion.div
                key="home"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
                className="pt-[70px] pb-10"
              >
                <HomeScreen
                  profile={state.profile}
                  customFunds={state.customFunds}
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
                className="pt-[70px]"
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
                className="pt-[70px]"
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
