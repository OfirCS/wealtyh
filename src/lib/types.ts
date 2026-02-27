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

// ===== Quick Actions (1-tap Wealthsimple actions) =====

export interface ActionAutomation {
  amount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  duration_months?: number;
  target_amount?: number;
}

export interface QuickAction {
  title: string;          // "Move $2,000 → Emergency Fund"
  why: string;            // "Buffer for months 7-10 when cashflow dips"
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
}

// ===== App State Machine =====

export type AppState =
  | { step: 'home'; profile: FinancialProfile }
  | { step: 'thinking'; profile: FinancialProfile; event: string }
  | { step: 'plan'; profile: FinancialProfile; event: string; result: PathfinderResult }
  | { step: 'error'; profile: FinancialProfile; event: string; message: string };

export type AppAction =
  | { type: 'SUBMIT_EVENT'; event: string }
  | { type: 'UPDATE_PROFILE'; profile: FinancialProfile }
  | { type: 'COMPLETE_THINKING'; result: PathfinderResult }
  | { type: 'THINKING_ERROR'; message: string }
  | { type: 'RESET' };

// ===== Suggestion Chip =====

export interface SuggestionChip {
  emoji: string;
  label: string;
  prompt: string;
}
