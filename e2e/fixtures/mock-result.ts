/**
 * Mock PathfinderAPIResult for E2E tests.
 * Shape matches the real /api/pathfinder response.
 */
export const mockPathfinderResponse = {
  result: {
    thinking_steps: [
      {
        title: 'Analyzing your finances',
        insights: [
          { text: 'Strong emergency savings recommended', type: 'positive' },
          { text: 'Current chequing balance is healthy', type: 'neutral' },
        ],
      },
    ],
    impact_summary: {
      income_change: { value: '$0', label: 'Income', type: 'neutral' },
      expense_change: { value: '-$200/mo', label: 'Expenses', type: 'negative' },
      net_worth_change: { value: '+$5K', label: 'Net Worth', type: 'positive' },
      timeline: { value: '6 months', label: 'Timeline', type: 'neutral' },
    },
    quick_actions: [
      {
        title: 'Move $2,000 to Emergency Fund',
        why: 'Build a 3-month buffer for unexpected expenses',
        type: 'move',
        amount: 2000,
        from_account: 'Chequing',
        to_account: 'Emergency Fund',
        priority: 'do_now',
      },
      {
        title: 'Set up $200/mo auto-deposit to TFSA',
        why: 'Maximize tax-free growth with consistent contributions',
        type: 'automate',
        amount: 200,
        from_account: 'Chequing',
        to_account: 'TFSA',
        automation: { amount: 200, frequency: 'monthly' },
        priority: 'this_week',
      },
    ],
    advisor_flags: [],
    risk_warnings: [
      { text: 'Keep at least $3,000 in chequing for bills', severity: 'medium' },
    ],
    account_impacts: [
      {
        account_name: 'Chequing',
        current_balance: 10400,
        projected_balance: 8200,
        impact_text: '-$2,200 from transfers',
        status: 'warning',
      },
      {
        account_name: 'TFSA',
        current_balance: 34500,
        projected_balance: 35700,
        impact_text: '+$1,200 from auto-deposits',
        status: 'positive',
      },
    ],
    monthly_cashflow: [
      { phase: 'Month 1', amount: 2800 },
      { phase: 'Month 2', amount: 2600 },
      { phase: 'Month 3', amount: 2600 },
      { phase: 'Month 6', amount: 3000 },
    ],
  },
  searchMetadata: null,
};
