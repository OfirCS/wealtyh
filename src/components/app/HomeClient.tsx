'use client';

import { useCallback, useEffect, useRef, useState, useReducer } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { AppState, AppAction, FinancialProfile, PathfinderResult, SearchMetadata, QuickAction, AppliedSummary, CustomFund, DebugLog } from '@/lib/types';
import { DEFAULT_PROFILE } from '@/lib/defaults';
import { applyConfirmedActions } from '@/lib/apply-actions';
import { addQuickEntry, defaultMonth, emptyBudget, loadBudget, profileWithBudget, saveBudget } from '@/lib/budget';
import type { Budget, ImportSummary } from '@/lib/budget';
import type { Insight } from '@/lib/agent-insights';
import { getMoneyPicture, grossFromTakeHome } from '@/lib/money';
import { clearEverything, loadSession, saveSession } from '@/lib/session';
import type { Session } from '@/lib/session';
import { useBudgetImport } from '@/lib/use-budget-import';
import { clearShareStateFromUrl, readShareStateFromUrl, writeShareStateToUrl } from '@/lib/share';
import { playSound } from '@/lib/sounds';
import BudgetScreen from '@/components/budget/BudgetScreen';
import HomeScreen from '@/components/home/HomeScreen';
import ThinkingView from '@/components/thinking/ThinkingView';
import PlanView from '@/components/plan/PlanView';
import QuestionFlow from '@/components/setup/QuestionFlow';
import AgentRun from '@/components/agent/AgentRun';
import SignIn from '@/components/auth/SignIn';
import AppShell from '@/components/app/AppShell';
import type { Section } from '@/components/app/AppShell';
import ConnectionsPage from '@/components/dashboard/ConnectionsPage';
import Dashboard from '@/components/dashboard/Dashboard';
import Landing from '@/components/landing/Landing';

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

type Entry = 'landing' | 'signin' | 'google' | 'demo';

export default function HomeClient() {
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialState);
  const [walletEntry] = useState(readWalletLink);
  const [shared] = useState(() => readShareStateFromUrl() !== null);
  const [session, setSession] = useState<Session | null>(() => loadSession() ?? (shared || walletEntry ? { name: '', email: '', kind: 'demo' } : null));
  const [entry, setEntry] = useState<Entry>('landing');
  const [signInProblem, setSignInProblem] = useState<string | null>(null);
  const [section, setSection] = useState<Section>(walletEntry ? 'budget' : shared ? 'plans' : 'home');
  const [budget, setBudget] = useState<Budget | null>(() => {
    const saved = loadBudget();
    if (!walletEntry) return saved;
    return addQuickEntry(saved ?? emptyBudget(), walletEntry, new Date().toISOString().slice(0, 10), 'wallet').budget;
  });
  const [hasNumbers, setHasNumbers] = useState(hasSavedNumbers);
  const [pendingEvent, setPendingEvent] = useState<string | null>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [report, setReport] = useState<ImportSummary | null>(null);
  const [fillKey, setFillKey] = useState(0);
  const [month, setMonth] = useState<string>(() => defaultMonth(budget ?? emptyBudget(), new Date()));
  const sharedHydratedRef = useRef(false);

  const fallbackIncome = hasNumbers ? getMoneyPicture(state.profile, state.customFunds).monthlyTakeHome : 0;

  const onImported = useCallback((next: Budget, summary: ImportSummary, nextMonth: string) => {
    setBudget(next);
    setMonth(nextMonth);
    setReport(summary);
    setFillKey((key) => key + 1);
  }, []);

  const { steps, error, addFile, connectGmail } = useBudgetImport({ budget, fallbackIncome, onImported });

  useEffect(() => {
    if (sharedHydratedRef.current) return;
    sharedHydratedRef.current = true;
    const sharedState = readShareStateFromUrl();
    if (!sharedState) return;
    dispatch({ type: 'UPDATE_PROFILE', profile: sharedState.profile });
    dispatch({ type: 'UPDATE_CUSTOM_FUNDS', customFunds: sharedState.customFunds });
    if (sharedState.event && sharedState.result) {
      dispatch({ type: 'SUBMIT_EVENT', event: sharedState.event });
      dispatch({
        type: 'COMPLETE_THINKING',
        result: sharedState.result,
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
    setSection('plans');
    if (hasNumbers) dispatch({ type: 'SUBMIT_EVENT', event });
    else setPendingEvent(event);
  }, [hasNumbers]);

  const handleAnswered = useCallback((profile: FinancialProfile) => {
    if (pendingEvent === null) return;
    dispatch({ type: 'UPDATE_PROFILE', profile });
    dispatch({ type: 'SUBMIT_EVENT', event: pendingEvent });
    setHasNumbers(true);
    setPendingEvent(null);
  }, [pendingEvent]);

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

  const finishRun = useCallback((next: Budget | null, user: Session) => {
    saveSession(user);
    setSession(user);
    setSection('home');
    setSignInProblem(null);
    if (next) {
      setBudget(next);
      setMonth(defaultMonth(next, new Date()));
      setFillKey((key) => key + 1);
      if (user.kind === 'demo') {
        // The demo family's plan numbers come from the same money as their budget
        const annualIncome = grossFromTakeHome(next.income * 12);
        dispatch({ type: 'UPDATE_PROFILE', profile: profileWithBudget({ ...DEFAULT_PROFILE, annualIncome, partnerIncome: 0 }, next) });
        setHasNumbers(true);
      }
    } else {
      setBudget(emptyBudget());
    }
  }, []);

  const failRun = useCallback((problem: string) => {
    setSignInProblem(problem);
    setEntry('signin');
  }, []);

  const signOut = useCallback(() => {
    clearEverything();
    window.location.assign(window.location.pathname);
  }, []);

  const handleInsight = useCallback((insight: Insight) => {
    if (insight.action === 'plan' && insight.prompt) handleEventSubmit(insight.prompt);
    else if (insight.action === 'connect') setSection('connections');
    else setSection('budget');
  }, [handleEventSubmit]);

  if (!session) {
    if (entry === 'google' || entry === 'demo') {
      return <AgentRun key={entry} mode={entry} onDone={finishRun} onFailed={failRun} />;
    }
    if (entry === 'signin') {
      return (
        <SignIn
          problem={signInProblem}
          onGoogle={() => setEntry('google')}
          onDemo={() => setEntry('demo')}
          onBack={() => setEntry('landing')}
        />
      );
    }
    return <Landing onStart={() => setEntry('signin')} onDemo={() => setEntry('demo')} />;
  }

  const screen = section !== 'plans' ? section : pendingEvent !== null ? 'questions' : state.step;

  return (
    <AppShell section={section} session={session} onNavigate={(next) => { setSection(next); playSound('tap'); }} onSignOut={signOut}>
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          className="h-full min-h-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
        >
          {section === 'home' && (
            <Dashboard
              session={session}
              budget={budget}
              month={month}
              onInsight={handleInsight}
              onAsk={handleEventSubmit}
              onOpenBudget={() => setSection('budget')}
            />
          )}

          {section === 'budget' && (
            <BudgetScreen
              budget={budget}
              profile={state.profile}
              customFunds={state.customFunds}
              hasNumbers={hasNumbers}
              report={report}
              fillKey={fillKey}
              month={month}
              steps={steps}
              problem={error}
              onMonthChange={setMonth}
              onChange={setBudget}
              onAddFile={addFile}
              onUpdateProfile={handleBudgetProfile}
            />
          )}

          {section === 'connections' && (
            <ConnectionsPage session={session} budget={budget} steps={steps} problem={error} onCheckGmail={connectGmail} onFile={(file) => void addFile(file)} />
          )}

          {section === 'plans' && (pendingEvent !== null ? (
            <QuestionFlow event={pendingEvent} connected={budget} onDone={handleAnswered} onBack={() => setPendingEvent(null)} />
          ) : (
            <>
              {state.step === 'home' && (
                <HomeScreen
                  profile={state.profile}
                  customFunds={state.customFunds}
                  appliedSummary={state.appliedSummary}
                  onProfileChange={handleProfileChange}
                  onCustomFundsChange={handleCustomFundsChange}
                  onSubmit={handleEventSubmit}
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
          ))}
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}
