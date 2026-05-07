'use client';

import { useState, useReducer, useCallback, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { AppState, AppAction, FinancialProfile, PathfinderResult, SearchMetadata, QuickAction, AppliedSummary, CustomFund, DebugLog } from '@/lib/types';
import { DEFAULT_PROFILE } from '@/lib/defaults';
import { applyConfirmedActions } from '@/lib/apply-actions';
import HomeScreen from '@/components/home/HomeScreen';
import OnboardingScreen from '@/components/onboarding/OnboardingScreen';
import ThinkingView from '@/components/thinking/ThinkingView';
import PlanView from '@/components/plan/PlanView';
import { Logo } from "@/components/ui/Logo";
import FlowDiagram from '@/components/demo/FlowDiagram';
import Disclaimer from '@/components/ui/Disclaimer';
import Footer from '@/components/ui/Footer';
import SponsorSlot from '@/components/ui/SponsorSlot';
import { readShareStateFromUrl, writeShareStateToUrl } from '@/lib/share';

// ... (keep reducer and initialization code exactly as is until HomeClient)
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'UPDATE_PROFILE':
      if (state.step !== 'home') return state;
      return { step: 'home', profile: action.profile, customFunds: state.customFunds };
    case 'UPDATE_CUSTOM_FUNDS':
      if (state.step !== 'home') return state;
      return { ...state, customFunds: action.customFunds };
    case 'SUBMIT_EVENT':
      return { step: 'thinking', profile: state.profile, customFunds: state.customFunds, event: action.event };
    case 'COMPLETE_THINKING':
      if (state.step !== 'thinking') return state;
      return { step: 'plan', profile: state.profile, customFunds: state.customFunds, event: state.event, result: action.result, searchMetadata: action.searchMetadata, debugLog: action.debugLog };
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

const STORAGE_KEY = 'pathfinder.home-state.v1';
const ONBOARDED_KEY = 'pathfinder.onboarded.v1';
const EMPLOYMENT_TYPES = new Set<FinancialProfile['employmentType']>([
  'employed',
  'self_employed',
  'freelance',
  'unemployed',
  'student',
  'retired',
]);
const HOUSING_TYPES = new Set<FinancialProfile['housingType']>(['rent', 'own']);

const NUMERIC_PROFILE_FIELDS = [
  'annualIncome',
  'partnerIncome',
  'chequingBalance',
  'savingsBalance',
  'tfsaBalance',
  'tfsaRoom',
  'rrspBalance',
  'rrspRoom',
  'fhsaBalance',
  'nonRegBalance',
  'housingExpense',
  'mortgageBalance',
  'essentialExpenses',
  'discretionarySpending',
  'debtPayments',
  'creditCardBalance',
] as const;

function hydrateProfile(raw: unknown): FinancialProfile {
  const profile: FinancialProfile = { ...DEFAULT_PROFILE };
  if (!raw || typeof raw !== 'object') return profile;
  const candidate = raw as Partial<FinancialProfile>;

  for (const field of NUMERIC_PROFILE_FIELDS) {
    const value = candidate[field];
    if (typeof value === 'number' && Number.isFinite(value)) {
      profile[field] = value;
    }
  }

  if (typeof candidate.province === 'string' && candidate.province.length > 0) {
    profile.province = candidate.province.toUpperCase().slice(0, 2);
  }
  if (typeof candidate.employmentType === 'string' && EMPLOYMENT_TYPES.has(candidate.employmentType as FinancialProfile['employmentType'])) {
    profile.employmentType = candidate.employmentType as FinancialProfile['employmentType'];
  }
  if (typeof candidate.housingType === 'string' && HOUSING_TYPES.has(candidate.housingType as FinancialProfile['housingType'])) {
    profile.housingType = candidate.housingType as FinancialProfile['housingType'];
  }

  return profile;
}

function hydrateCustomFunds(raw: unknown): CustomFund[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Partial<CustomFund> => !!item && typeof item === 'object')
    .map((fund) => ({
      name: typeof fund.name === 'string' ? fund.name.trim() : '',
      balance: typeof fund.balance === 'number' && Number.isFinite(fund.balance) ? fund.balance : 0,
      emoji: typeof fund.emoji === 'string' ? fund.emoji : undefined,
    }))
    .filter((fund) => fund.name.length > 0);
}

function createInitialState(): AppState {
  const fallback: AppState = { step: 'home', profile: { ...DEFAULT_PROFILE }, customFunds: [] };
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { profile?: unknown; customFunds?: unknown };
    return {
      step: 'home',
      profile: hydrateProfile(parsed.profile),
      customFunds: hydrateCustomFunds(parsed.customFunds),
    };
  } catch {
    return fallback;
  }
}

export type PipelineStepStatus = { id: string; status: 'active' | 'complete'; label?: string; detail?: string };

function shouldShowOnboardingInitial(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // If a shared plan is in the URL, don't interrupt with onboarding.
    if (window.location.hash && window.location.hash.length > 1) return false;
    return !window.localStorage.getItem(ONBOARDED_KEY);
  } catch {
    return true;
  }
}

export default function HomeClient() {
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialState);
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState<Record<string, PipelineStepStatus>>({});
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(shouldShowOnboardingInitial);
  const prevStepRef = useRef(state.step);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sharedHydratedRef = useRef(false);

  useEffect(() => {
    if (sharedHydratedRef.current) return;
    sharedHydratedRef.current = true;
    const shared = readShareStateFromUrl();
    if (!shared) return;
    dispatch({ type: 'UPDATE_PROFILE', profile: shared.profile });
    dispatch({ type: 'UPDATE_CUSTOM_FUNDS', customFunds: shared.customFunds });
    if (shared.event && shared.result) {
      dispatch({ type: 'SUBMIT_EVENT', event: shared.event });
      dispatch({
        type: 'COMPLETE_THINKING',
        result: shared.result,
        searchMetadata: null,
        debugLog: null,
      });
    }
    try {
      window.localStorage.setItem(ONBOARDED_KEY, '1');
    } catch {
      // ignore
    }
  }, []);

  const finishOnboarding = useCallback((profile: FinancialProfile) => {
    dispatch({ type: 'UPDATE_PROFILE', profile });
    try {
      window.localStorage.setItem(ONBOARDED_KEY, '1');
    } catch {
      // ignore
    }
    setShowOnboarding(false);
  }, []);

  const skipOnboarding = useCallback(() => {
    try {
      window.localStorage.setItem(ONBOARDED_KEY, '1');
    } catch {
      // ignore
    }
    setShowOnboarding(false);
  }, []);

  useEffect(() => {
    prevStepRef.current = state.step;
    // Scroll to top on step change
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0 });
    }
  }, [state.step]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          profile: state.profile,
          customFunds: state.customFunds,
        }),
      );
    } catch {
      // Ignore storage failures (private mode/quota)
    }
  }, [state.profile, state.customFunds]);

  const handleProfileChange = useCallback((profile: FinancialProfile) => {
    dispatch({ type: 'UPDATE_PROFILE', profile });
  }, []);

  const handleCustomFundsChange = useCallback((customFunds: CustomFund[]) => {
    dispatch({ type: 'UPDATE_CUSTOM_FUNDS', customFunds });
  }, []);

  const handleEventSubmit = useCallback((event: string) => {
    setPipelineSteps({});
    dispatch({ type: 'SUBMIT_EVENT', event });
  }, []);

  const handlePipelineStep = useCallback((step: PipelineStepStatus) => {
    setPipelineSteps((prev) => ({ ...prev, [step.id]: step }));
  }, []);

  const handleThinkingComplete = useCallback((result: PathfinderResult, searchMetadata: SearchMetadata | null, debugLog: DebugLog | null) => {
    dispatch({ type: 'COMPLETE_THINKING', result, searchMetadata, debugLog });
  }, []);

  const handleThinkingError = useCallback((message: string) => {
    dispatch({ type: 'THINKING_ERROR', message });
  }, []);

  const handleReset = useCallback(() => {
    setPipelineSteps({});
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

  const handleShare = useCallback(async () => {
    if (state.step !== 'plan') return;
    const url = writeShareStateToUrl({
      profile: state.profile,
      customFunds: state.customFunds,
      event: state.event,
      result: state.result,
    });
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareToast('Link copied');
      } else {
        setShareToast('Link in URL bar');
      }
    } catch {
      setShareToast('Link in URL bar');
    }
    setTimeout(() => setShareToast(null), 2200);
  }, [state]);

  // Encode the shareable state silently into the URL whenever a plan exists,
  // so refresh / direct sharing of the address bar both work.
  useEffect(() => {
    if (state.step === 'plan') {
      writeShareStateToUrl({
        profile: state.profile,
        customFunds: state.customFunds,
        event: state.event,
        result: state.result,
      });
    }
  }, [state]);

  return (
    <div className="h-screen w-full flex items-stretch bg-[var(--ws-bg-surface)] p-3 sm:p-4 overflow-hidden">
      <div className="w-full h-full max-w-[1600px] mx-auto flex gap-3 sm:gap-4">
        {/* Main App Container */}
        <main
          className="relative flex-1 h-full bg-[var(--ws-bg-primary)] rounded-[24px] sm:rounded-[32px] border border-[var(--ws-border)] shadow-[0_24px_70px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col"
          style={{ transform: "translateZ(0)" }}
        >

          {/* Header bar */}
          <header
            className="shrink-0 z-50 flex items-center justify-between px-6 pt-4 pb-3.5 bg-[var(--ws-bg-primary)] border-b border-[var(--ws-border)] rounded-t-[24px] sm:rounded-t-[32px]"
          >
            <div className="flex items-center gap-3">
              <Logo />
            </div>
            <div className="flex items-center gap-3">
              {state.step === 'plan' && (
                <button
                  onClick={handleShare}
                  className="text-[13px] font-medium transition-colors hover:opacity-70 flex items-center gap-1.5 cursor-pointer"
                  style={{ color: 'var(--ws-text-secondary)' }}
                  aria-label="Copy share link"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                  {shareToast ?? 'Share'}
                </button>
              )}
              {state.step === 'home' && !showOnboarding && (
                <button
                  onClick={() => setShowOnboarding(true)}
                  className="text-[13px] font-medium transition-colors hover:opacity-70 cursor-pointer flex items-center gap-1.5"
                  style={{ color: 'var(--ws-text-tertiary)' }}
                  aria-label="Run quick setup again"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" />
                  </svg>
                  Quick setup
                </button>
              )}
              {state.step !== 'home' && (
                <button
                  onClick={handleReset}
                  className="text-[13px] font-medium transition-colors hover:opacity-70 cursor-pointer"
                  style={{ color: 'var(--ws-text-tertiary)' }}
                >
                  Start over
                </button>
              )}
            </div>
          </header>

          {/* Scrollable content — fills remaining height, scrolls internally */}
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden hide-scrollbar">
            <AnimatePresence mode="wait">
              {state.step === 'home' && (
                <motion.div
                  key="home"
                  variants={{
                    initial: { opacity: 0, y: 24 },
                    animate: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0, duration: 0.5 } },
                    exit: { opacity: 0, transition: { duration: 0.15 } },
                  }}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="pb-10 w-full will-change-transform"
                >
                  <HomeScreen
                    profile={state.profile}
                    customFunds={state.customFunds}
                    appliedSummary={state.appliedSummary}
                    onProfileChange={handleProfileChange}
                    onCustomFundsChange={handleCustomFundsChange}
                    onSubmit={handleEventSubmit}
                    onPromptOpenChange={setIsPromptOpen}
                  />
                </motion.div>
              )}

              {state.step === 'thinking' && (
                <motion.div
                  key="thinking"
                  variants={{
                    initial: { opacity: 0 },
                    animate: { opacity: 1, transition: { duration: 0.3 } },
                    exit: { opacity: 0, transition: { duration: 0.12 } },
                  }}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="w-full min-h-full flex flex-col justify-center items-center p-6 will-change-transform"
                >
                  <ThinkingView
                    profile={state.profile}
                    customFunds={state.customFunds}
                    event={state.event}
                    onComplete={handleThinkingComplete}
                    onError={handleThinkingError}
                    onPipelineStep={handlePipelineStep}
                  />
                </motion.div>
              )}

              {state.step === 'plan' && (
                <motion.div
                  key="plan"
                  variants={{
                    initial: { opacity: 0, y: 30 },
                    animate: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0, duration: 0.5 } },
                    exit: { opacity: 0, transition: { duration: 0.15 } },
                  }}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="w-full will-change-transform"
                >
                  <PlanView
                    result={state.result}
                    event={state.event}
                    profile={state.profile}
                    customFunds={state.customFunds}
                    searchMetadata={state.searchMetadata}
                    debugLog={state.debugLog}
                    onReset={handleReset}
                    onApplyActions={handleApplyActions}
                  />
                </motion.div>
              )}

              {state.step === 'error' && (
                <motion.div
                  key="error"
                  variants={{
                    initial: { opacity: 0 },
                    animate: { opacity: 1, transition: { duration: 0.3 } },
                    exit: { opacity: 0, transition: { duration: 0.15 } },
                  }}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="w-full will-change-transform"
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

        {/* Persistent Sidebar — always visible, matches main height */}
        <aside className="hidden md:flex flex-col w-[260px] lg:w-[320px] xl:w-[360px] shrink-0 h-full bg-[var(--ws-bg-primary)] rounded-[24px] sm:rounded-[32px] border border-[var(--ws-border)] shadow-xl overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <FlowDiagram
              appStep={state.step === 'error' ? 'error' : state.step}
              isPromptOpen={isPromptOpen}
              searchMetadata={state.step === 'plan' ? state.searchMetadata : undefined}
              debugLog={state.step === 'plan' ? state.debugLog : undefined}
              pipelineSteps={pipelineSteps}
            />
          </div>
          <div className="shrink-0 p-3 border-t border-[var(--ws-border)]">
            <SponsorSlot />
          </div>
        </aside>
      </div>
      <Disclaimer />
      <Footer />
      <AnimatePresence>
        {showOnboarding && state.step === 'home' && (
          <OnboardingScreen
            key="onboarding"
            initialProfile={state.profile}
            onComplete={finishOnboarding}
            onSkip={skipOnboarding}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
