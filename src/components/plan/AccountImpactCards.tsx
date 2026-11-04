"use client";

import type { AccountImpact } from "@/lib/types";
import { formatMoney, formatSigned } from "@/lib/money";

interface AccountImpactCardsProps {
  impacts: AccountImpact[];
}

export default function AccountImpactCards({ impacts }: AccountImpactCardsProps) {
  const changed = impacts?.filter((impact) => impact.current_balance !== impact.projected_balance) ?? [];
  if (changed.length === 0) return null;

  return (
    <ul>
      {changed.map((impact) => (
        <li key={impact.account_name} className="flex min-h-[56px] flex-wrap items-center justify-between gap-x-4 gap-y-0.5 border-b border-[var(--pf-border)] py-2">
          <span className="text-[16px]">{impact.account_name}</span>
          <span className="text-[15px] text-[var(--pf-text-secondary)]">
            {formatMoney(impact.current_balance)} → <span className="text-[var(--pf-text-primary)]">{formatMoney(impact.projected_balance)}</span>
            <span className="ml-3 text-[var(--pf-text-tertiary)]">{formatSigned(impact.projected_balance - impact.current_balance)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
