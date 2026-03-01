"use client";

import { motion } from "framer-motion";
import type { AccountImpact, QuickAction } from "@/lib/types";
import { CountUp } from "@/components/ui/CountUp";

interface AccountImpactCardsProps {
  impacts: AccountImpact[];
  actions?: QuickAction[];
}

function getStatusColor(status: AccountImpact["status"]) {
  switch (status) {
    case "positive":
      return "var(--ws-accent-green)";
    case "negative":
      return "var(--ws-accent-red)";
    case "warning":
      return "#C08B00";
    case "neutral":
    default:
      return "var(--ws-text-tertiary)";
  }
}

function getStatusLabel(status: AccountImpact["status"]) {
  switch (status) {
    case "positive":
      return "Increases";
    case "negative":
      return "Decreases";
    case "warning":
      return "Watch";
    case "neutral":
    default:
      return "Unchanged";
  }
}

function formatAmount(amount: number): string {
  return `$${amount.toLocaleString("en-CA")}`;
}

function findRelatedActions(accountName: string, actions: QuickAction[]): string[] {
  const norm = accountName.toLowerCase().replace(/[^a-z]/g, '');
  const tags: string[] = [];
  for (const action of actions) {
    const fromNorm = action.from_account?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
    const toNorm = action.to_account?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
    if (fromNorm === norm || toNorm === norm) {
      if (action.type === 'automate' && action.automation) {
        tags.push(`Auto-deposit $${action.automation.amount.toLocaleString('en-CA')}/mo`);
      } else if (action.amount && action.amount > 0) {
        tags.push(action.title);
      }
    }
  }
  return tags;
}

export default function AccountImpactCards({ impacts, actions = [] }: AccountImpactCardsProps) {
  const changedImpacts = impacts?.filter(
    (impact) => impact.current_balance !== impact.projected_balance
  );

  if (!changedImpacts || changedImpacts.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="mb-3">
        <p className="text-[11px] text-[var(--ws-text-tertiary)] uppercase tracking-wider font-semibold">
          Account Balances
        </p>
        <p className="text-[13px] text-[var(--ws-text-secondary)] mt-1">
          Before &rarr; after this plan
        </p>
      </div>
      <div className="flex flex-row overflow-x-auto snap-x hide-scrollbar gap-4 pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        {changedImpacts.map((impact, i) => {
          const color = getStatusColor(impact.status);
          const diff = impact.projected_balance - impact.current_balance;
          const diffStr = diff >= 0 ? `+${formatAmount(diff)}` : `-${formatAmount(Math.abs(diff))}`;
          const isNeutral = impact.status === "neutral";

          return (
            <motion.div
              key={i}
              className={`min-w-[280px] sm:min-w-[320px] max-w-[320px] snap-center shrink-0 bg-[var(--ws-bg-surface)] rounded-[16px] sm:rounded-[20px] p-4 sm:p-5 border flex flex-col gap-2.5 relative overflow-hidden transition-all hover:border-[var(--ws-border-hover)] ${isNeutral ? "border-[var(--ws-border)] opacity-80" : "border-[var(--ws-border)] shadow-sm"
                }`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", bounce: 0, duration: 0.6, delay: 0.1 + i * 0.1 }}
            >
              {/* Subtle accent line on top */}
              {!isNeutral && (
                <div
                  className="absolute top-0 left-0 right-0 h-[2px] opacity-30"
                  style={{ backgroundColor: color }}
                />
              )}

              {/* Header: Name and Label */}
              <div className="flex flex-wrap items-center justify-between gap-2 mt-0.5 sm:mt-1">
                <span className="text-[14px] sm:text-[15px] font-medium text-[var(--ws-text-primary)]">
                  {impact.account_name}
                </span>
                <span
                  className="text-[10px] sm:text-[11px] font-medium px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-[var(--ws-bg-primary)] border"
                  style={{ color, borderColor: `${color}30` }}
                >
                  {getStatusLabel(impact.status)}
                </span>
              </div>

              <div className="w-full h-px bg-[var(--ws-border)] my-0.5 sm:my-1 opacity-50"></div>

              {/* Before → After */}
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-[18px] sm:text-[22px] text-[var(--ws-text-tertiary)] tracking-tight">
                  {formatAmount(impact.current_balance)}
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-[var(--ws-text-tertiary)] shrink-0">
                  <path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="font-serif text-[26px] sm:text-[34px] leading-tight tracking-tight text-[var(--ws-text-primary)]">
                  <CountUp value={impact.projected_balance} formatFn={formatAmount} duration={1.2} />
                </span>
              </div>

              {/* Diff badge */}
              <span
                className="text-[14px] sm:text-[16px] font-bold tracking-tight inline-block"
                style={{ color }}
              >
                {diffStr}
              </span>

              {/* Via tags — which action(s) caused this change */}
              {actions.length > 0 && (() => {
                const related = findRelatedActions(impact.account_name, actions);
                if (related.length === 0) return null;
                return (
                  <div className="flex flex-wrap gap-1.5">
                    {related.map((tag, j) => (
                      <span
                        key={j}
                        className="text-[10px] sm:text-[11px] font-medium px-2 py-0.5 rounded-md bg-[var(--ws-bg-primary)] border border-[var(--ws-border)] text-[var(--ws-text-secondary)]"
                      >
                        via: {tag}
                      </span>
                    ))}
                  </div>
                );
              })()}

              {/* Impact text */}
              <div>
                <p className="text-[13px] sm:text-[14px] text-[var(--ws-text-secondary)] leading-relaxed">
                  {impact.impact_text}
                </p>
              </div>

              {/* Note */}
              {impact.note && (
                <div className="mt-0.5 sm:mt-1 bg-[var(--ws-bg-elevated)] rounded-[10px] sm:rounded-xl py-2 px-3 sm:py-2.5 sm:px-3.5">
                  <p className="text-[12px] sm:text-[13px] text-[var(--ws-text-tertiary)] leading-snug">
                    <span className="font-semibold text-[var(--ws-text-secondary)]">Note:</span> {impact.note}
                  </p>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
