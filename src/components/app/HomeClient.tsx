'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useReducer } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { AppState, AppAction, FinancialProfile, PathfinderResult, SearchMetadata, QuickAction, AppliedSummary, CustomFund, DebugLog } from '@/lib/types';
import { DEFAULT_PROFILE } from '@/lib/defaults';
import { applyConfirmedActions } from '@/lib/apply-actions';
import { addQuickEntry, emptyBudget, loadBudget, monthKey, monthSummary, saveBudget } from '@/lib/budget';
import type { Budget } from '@/lib/budget';
import { clearShareStateFromUrl, readShareStateFromUrl, writeShareStateToUrl } from '@/lib/share';
import { playSound } from '@/lib/sounds';
import BudgetScreen from '@/components/budget/BudgetScreen';
import HomeScreen from '@/components/home/HomeScreen';
import ThinkingView from '@/components/thinking/ThinkingView';
import PlanView from '@/components/plan/PlanView';
import ConnectStep from '@/components/setup/ConnectStep';
import QuestionFlow from '@/components/setup/QuestionFlow';
import { Logo } from '@/components/ui/Logo';
import SoundToggle from '@/components/ui/SoundToggle';

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
        openedAccounts: [],
      };

      return { step: 'home', profile, customFunds, appliedSummary };
    }
    default:
      return state;
  }
}

const STORAGE_KEY = 'pathfinder.home-state.v1';
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

/** An iPhone Shortcut can open /?spent=12.50&at=Starbucks after each Apple Pay tap. */
function readWalletLink(): { amount: number; description: string } | null {
  const params = new URLSearchParams(window.location.search);
  const amount = Number(params.get('spent'));
  const description = params.get('at')?.trim();
  return amount > 0 && description ? { amount, description } : null;
}

function hasSavedNumbers(): boolean {
  if (readShareStateFromUrl()) return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export default function HomeClient() {
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialState);
  const [hasNumbers, setHasNumbers] = useState(hasSavedNumbers);
  const [pendingEvent, setPendingEvent] = useState<string | null>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [walletEntry] = useState(readWalletLink);
  const [section, setSection] = useState<'plan' | 'budget'>(walletEntry ? 'budget' : 'plan');
  const [budget, setBudget] = useState<Budget | null>(() => {
    const saved = loadBudget();
    if (!walletEntry) return saved;
    return addQuickEntry(saved ?? emptyBudget(), walletEntry, new Date().toISOString().slice(0, 10), 'wallet').budget;
  });
  const [typing, setTyping] = useState(false);
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
  }, []);

  useEffect(() => {
    saveBudget(budget);
  }, [budget]);

  useEffect(() => {
    if (!walletEntry) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('spent');
    url.searchParams.delete('at');
    window.history.replaceState({}, '', url.toString());
  }, [walletEntry]);

  useEffect(() => {
    // A first-time visitor has nothing to remember until they've answered
    if (!hasNumbers) return;
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
  }, [state.profile, state.customFunds, hasNumbers]);

  const handleProfileChange = useCallback((profile: FinancialProfile) => {
    dispatch({ type: 'UPDATE_PROFILE', profile });
  }, []);

  const handleCustomFundsChange = useCallback((customFunds: CustomFund[]) => {
    dispatch({ type: 'UPDATE_CUSTOM_FUNDS', customFunds });
  }, []);

  const handleEventSubmit = useCallback((event: string) => {
    if (hasNumbers) dispatch({ type: 'SUBMIT_EVENT', event });
    else {
      setTyping(false);
      setPendingEvent(event);
    }
  }, [hasNumbers]);

  const handleAnswered = useCallback((profile: FinancialProfile) => {
    if (pendingEvent === null) return;
    dispatch({ type: 'UPDATE_PROFILE', profile });
    dispatch({ type: 'SUBMIT_EVENT', event: pendingEvent });
    setHasNumbers(true);
    setPendingEvent(null);
  }, [pendingEvent]);

  const handleUseSample = useCallback(() => {
    playSound('pop');
    dispatch({ type: 'UPDATE_PROFILE', profile: { ...DEFAULT_PROFILE } });
    setHasNumbers(true);
  }, []);

  const handleThinkingComplete = useCallback((result: PathfinderResult, searchMetadata: SearchMetadata | null, debugLog: DebugLog | null) => {
    dispatch({ type: 'COMPLETE_THINKING', result, searchMetadata, debugLog });
  }, []);

  const handleThinkingError = useCallback((message: string) => {
    dispatch({ type: 'THINKING_ERROR', message });
  }, []);

  const handleReset = useCallback(() => {
    clearShareStateFromUrl();
    dispatch({ type: 'RESET' });
  }, []);

  const handleApplyActions = useCallback((confirmedIndices: number[], actions: QuickAction[]) => {
    clearShareStateFromUrl();
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

  const handleBudgetProfile = useCallback((profile: FinancialProfile) => {
    clearShareStateFromUrl();
    dispatch({ type: 'RESET' });
    dispatch({ type: 'UPDATE_PROFILE', profile });
  }, []);

  const budgetLeft = useMemo(
    () => (budget ? monthSummary(budget, monthKey(new Date())).left : null),
    [budget],
  );

  const screen = section === 'budget' ? 'budget' : pendingEvent !== null ? 'questions' : state.step;

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden">
      <header className={`mx-auto flex h-16 w-full shrink-0 items-center justify-between gap-4 px-5 sm:px-8 ${section === 'budget' ? 'max-w-none' : 'max-w-[1120px]'}`}>
        <button
          type="button"
          className="cursor-pointer"
          aria-label="Pathfinder home"
          onClick={() => {
            setSection('plan');
            setPendingEvent(null);
            handleReset();
          }}
        >
          <Logo />
        </button>
        <nav className="flex items-center gap-4 sm:gap-6">
          <button type="button" className="pf-tab" aria-current={section === 'plan' ? 'page' : undefined} onClick={() => { setSection('plan'); playSound('tap'); }}>Plan</button>
          <button type="button" className="pf-tab" aria-current={section === 'budget' ? 'page' : undefined} onClick={() => { setSection('budget'); playSound('tap'); }}>Budget</button>
          <SoundToggle />
        </nav>
      </header>

      <AnimatePresence mode="wait">
        <motion.main
          key={screen}
          className={`mx-auto min-h-0 w-full flex-1 px-5 pb-4 sm:px-8 ${section === 'budget' ? 'max-w-none' : 'max-w-[1120px]'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
        >
          {section === 'budget' ? (
            <BudgetScreen
              budget={budget}
              profile={state.profile}
              customFunds={state.customFunds}
              hasNumbers={hasNumbers}
              onChange={setBudget}
              onUpdateProfile={handleBudgetProfile}
            />
          ) : pendingEvent !== null ? (
            budget || typing ? (
              <QuestionFlow event={pendingEvent} connected={typing ? null : budget} onDone={handleAnswered} onBack={() => setPendingEvent(null)} />
            ) : (
              <ConnectStep event={pendingEvent} onConnected={setBudget} onTypeInstead={() => setTyping(true)} onBack={() => setPendingEvent(null)} />
            )
          ) : (
            <>
              {state.step === 'home' && (
                <HomeScreen
                  profile={state.profile}
                  customFunds={state.customFunds}
                  hasNumbers={hasNumbers}
                  appliedSummary={state.appliedSummary}
                  onProfileChange={handleProfileChange}
                  onCustomFundsChange={handleCustomFundsChange}
                  onSubmit={handleEventSubmit}
                  onUseSample={handleUseSample}
                  budgetLeft={budgetLeft}
                  onOpenBudget={() => setSection('budget')}
                />
              )}

              {state.step === 'thinking' && (
                <ThinkingView
                  profile={state.profile}
                  customFunds={state.customFunds}
                  event={state.event}
                  onComplete={handleThinkingComplete}
                  onError={handleThinkingError}
                />
              )}

              {state.step === 'plan' && (
                <PlanView
                  result={state.result}
                  event={state.event}
                  profile={state.profile}
                  customFunds={state.customFunds}
                  searchMetadata={state.searchMetadata}
                  debugLog={state.debugLog}
                  shareLabel={shareToast ?? 'Share'}
                  onShare={handleShare}
                  onReset={handleReset}
                  onApplyActions={handleApplyActions}
                />
              )}

              {state.step === 'error' && (
                <div className="mx-auto flex h-full max-w-[640px] flex-col justify-center">
                  <h1 className="pf-title-lg font-serif">Something went wrong</h1>
                  <p className="mt-3 text-[17px] leading-relaxed text-[var(--pf-text-secondary)]">{state.message}</p>
                  <div className="mt-6 flex gap-3">
                    <button type="button" className="pf-btn pf-btn-primary" onClick={handleRetry}>Try again</button>
                    <button type="button" className="pf-btn pf-btn-secondary" onClick={handleReset}>Go back</button>
                  </div>
                </div>
              )}
            </>
          )}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
