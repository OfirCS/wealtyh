"use client";

import { motion } from "framer-motion";
import type { AccountImpact } from "@/lib/types";
import { CountUp } from "@/components/ui/CountUp";

interface AccountImpactCardsProps {
  impacts: AccountImpact[];
}

function getStatusColor(status: AccountImpact["status"]) {
  switch (status) {
    case "positive":
      return "#2DE589";
    case "negative":
      return "#D23A3A";
    case "warning":
      return "#FFD60A";
    case "neutral":
    default:
      return "#9B9895";
  }
}

function getStatusLabel(status: AccountImpact["status"]) {
  switch (status) {
    case "positive":
      return "Growing";
    case "negative":
      return "Decreasing";
    case "warning":
      return "Watch";
    case "neutral":
    default:
      return "No change";
  }
}

function formatAmount(amount: number): string {
  return `$${amount.toLocaleString("en-CA")}`;
}

export default function AccountImpactCards({ impacts }: AccountImpactCardsProps) {
  const changedImpacts = impacts?.filter(
    (impact) => impact.current_balance !== impact.projected_balance
  );

  if (!changedImpacts || changedImpacts.length === 0) return null;

  return (
    <div className="mb-8">
      <p className="text-[11px] text-[var(--ws-text-tertiary)] uppercase tracking-wider font-semibold mb-3">
        Projected Account Impact
      </p>
      <div className="flex flex-row overflow-x-auto snap-x hide-scrollbar gap-4 pb-4 -mx-4 px-4 sm:-mx-10 sm:px-10">
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
              transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 + i * 0.1 }}
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

              <div className="w-full h-px bg-[var(--ws-border)] my-0.5 sm:my-1 border-dashed"></div>

              {/* Main Balance Row */}
              <div className="flex flex-wrap items-baseline gap-2 sm:gap-3">
                <span className="font-serif text-[28px] sm:text-[38px] leading-tight tracking-tight text-[var(--ws-text-primary)]">
                  <CountUp value={impact.projected_balance} formatFn={formatAmount} duration={1.2} />
                </span>
                <span
                  className="font-serif text-[16px] sm:text-[20px] tracking-tight"
                  style={{ color }}
                >
                  {diffStr}
                </span>
              </div>

              {/* Impact text */}
              <div>
                <p className="text-[13px] sm:text-[14px] text-[var(--ws-text-secondary)] leading-relaxed">
                  {impact.impact_text}
                </p>
              </div>

              {/* Note */}
              {impact.note && (
                <div className="mt-0.5 sm:mt-1 bg-[var(--ws-bg-primary)] rounded-[10px] sm:rounded-xl py-2 px-3 sm:py-2.5 sm:px-3.5 border border-[var(--ws-border)] border-dashed">
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
