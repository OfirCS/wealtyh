// ===== Financial Profile =====

export interface FinancialProfile {
  annualIncome: number;
  employmentType: 'employed' | 'self_employed' | 'freelance' | 'unemployed' | 'student' | 'retired';
  partnerIncome: number;
  province: string;

  chequingBalance: number;
  savingsBalance: number;
  tfsaBalance: number;
  tfsaRoom: number;
  rrspBalance: number;
  rrspRoom: number;
  fhsaBalance: number;
  nonRegBalance: number;

  housingType: 'rent' | 'own';
  housingExpense: number;
  mortgageBalance: number;
  essentialExpenses: number;
  discretionarySpending: number;
  debtPayments: number;
  creditCardBalance: number;
}

// ===== Pathfinder Result (AI response) =====

export interface ThinkingStep {
  title: string;
  insights: {
    text: string;
    type: 'positive' | 'negative' | 'neutral';
  }[];
}

export interface ImpactCard {
  value: string;
  label: string;
  type: 'positive' | 'negative' | 'neutral';
}

export interface ImpactSummary {
  income_change: ImpactCard;
  expense_change: ImpactCard;
  net_worth_change: ImpactCard;
  timeline: ImpactCard;
}

// ===== Quick Actions (1-tap recommended steps) =====

export interface ActionAutomation {
  amount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  duration_months?: number;
  target_amount?: number;
}

export interface QuickAction {
  title: string;          // "Move $2,000 → Emergency Fund"
  why: string;            // "Buffer for months 7-10 when cashflow dips"
  derived_from: string;   // "Savings $18K ÷ $5.1K/mo expenses = 3.5mo buffer → move $2K keeps 3.1mo"
  type: 'move' | 'create_fund' | 'automate' | 'open_account' | 'pause' | 'adjust' | 'pay_off';
  amount?: number;
  from_account?: string;
  to_account?: string;
  automation?: ActionAutomation;
  priority: 'do_now' | 'this_week' | 'this_month' | 'next_quarter';
}

export interface AdvisorFlag {
  title: string;
  explanation: string;
  urgency: 'high' | 'medium' | 'low';
}

export interface RiskWarning {
  text: string;
  severity: 'high' | 'medium' | 'low';
}

export interface AccountImpact {
  account_name: string;
  current_balance: number;
  projected_balance: number;
  impact_text: string;
  status: 'positive' | 'negative' | 'neutral' | 'warning';
  note?: string;
}

export interface CashflowPoint {
  phase: string;
  amount: number;
}

export interface ResearchTopic {
  subject: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

export interface PathfinderResult {
  thinking_steps: ThinkingStep[];
  impact_summary: ImpactSummary;
  quick_actions: QuickAction[];
  advisor_flags: AdvisorFlag[];
  risk_warnings: RiskWarning[];
  account_impacts: AccountImpact[];
  monthly_cashflow: CashflowPoint[];
  research_needed?: ResearchTopic[];
  /** Set when the plan came from the built-in rules instead of the AI pipeline. */
  source?: 'local';
}

// ===== Search Metadata (passed from API to UI) =====

export interface SearchSource {
  title?: string;
  url: string;
}

export interface SearchMetadata {
  queries: string[];
  sources: SearchSource[];
}

// ===== Debug Log (decision trace for transparency) =====

export interface DebugLogEntry {
  step: string;       // "Router" | "Search" | "Generate" | "Guardrail"
  detail: string;     // What happened
  data?: string;      // Optional raw data
}

export interface DebugLog {
  entries: DebugLogEntry[];
  actionsBeforeGuardrails: number;
  actionsAfterGuardrails: number;
  removedActions: string[];
}

export interface PathfinderAPIResult {
  result: PathfinderResult;
  searchMetadata: SearchMetadata | null;
  debugLog: DebugLog;
}

// ===== Custom Funds (created via actions) =====

export interface CustomFund {
  name: string;
  balance: number;
  emoji?: string;
}

// ===== Post-Action Feedback =====

export interface AppliedSummary {
  actions: string[];
  balanceChanges: Partial<Record<string, number>>;
  newFundNames: string[];
  fundChanges: Record<string, number>;
  openedAccounts: string[];
}

// ===== App State Machine =====

export type AppState =
  | { step: 'home'; profile: FinancialProfile; customFunds: CustomFund[]; appliedSummary?: AppliedSummary }
  | { step: 'thinking'; profile: FinancialProfile; customFunds: CustomFund[]; event: string }
  | { step: 'plan'; profile: FinancialProfile; customFunds: CustomFund[]; event: string; result: PathfinderResult; searchMetadata: SearchMetadata | null; debugLog: DebugLog | null }
  | { step: 'error'; profile: FinancialProfile; customFunds: CustomFund[]; event: string; message: string };

export type AppAction =
  | { type: 'SUBMIT_EVENT'; event: string }
  | { type: 'UPDATE_PROFILE'; profile: FinancialProfile }
  | { type: 'COMPLETE_THINKING'; result: PathfinderResult; searchMetadata: SearchMetadata | null; debugLog: DebugLog | null }
  | { type: 'THINKING_ERROR'; message: string }
  | { type: 'RESET' }
  | { type: 'APPLY_ACTIONS'; confirmedIndices: number[]; actions: QuickAction[] }
  | { type: 'UPDATE_CUSTOM_FUNDS'; customFunds: CustomFund[] };

// ===== Suggestion Chip =====

export interface SuggestionChip {
  emoji: string;
  label: string;
  prompt: string;
}
