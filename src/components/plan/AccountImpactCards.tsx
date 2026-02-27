"use client";

import { motion } from "framer-motion";
import type { AccountImpact } from "@/lib/types";

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
  if (!impacts || impacts.length === 0) return null;

  return (
    <div className="mb-4">
      <p className="text-[11px] text-[var(--ws-text-tertiary)] uppercase tracking-wider font-semibold mb-3">
        Your accounts after
      </p>
      <div className="flex flex-col gap-4">
        {impacts.map((impact, i) => {
          const color = getStatusColor(impact.status);
          const diff = impact.projected_balance - impact.current_balance;
          const diffStr = diff >= 0 ? `+${formatAmount(diff)}` : `-${formatAmount(Math.abs(diff))}`;

          return (
            <motion.div
              key={i}
              className="bg-[var(--ws-bg-surface)] rounded-[20px] border border-[#DDD8D1] p-4 shadow-[0_1px_2px_rgba(42,39,36,0.08)]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" as const, delay: 0.1 + i * 0.06 }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-[16px] font-semibold text-[var(--ws-text-primary)] tracking-[-0.01em]">
                    {impact.account_name}
                  </span>
                </div>
                <span
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: `${color}15`, color }}
                >
                  {getStatusLabel(impact.status)}
                </span>
              </div>

              {/* Balance change row */}
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[21px] font-semibold text-[var(--ws-text-primary)] tabular-nums tracking-[-0.02em]">
                  {formatAmount(impact.projected_balance)}
                </span>
                <span
                  className="text-[13px] font-semibold tabular-nums"
                  style={{ color }}
                >
                  {diffStr}
                </span>
              </div>

              {/* Impact text */}
              <p className="text-[13px] text-[var(--ws-text-secondary)] leading-snug">
                {impact.impact_text}
              </p>

              {/* Note */}
              {impact.note && (
                <p className="text-[12px] text-[var(--ws-text-tertiary)] mt-2 pl-3 border-l-2 border-[var(--ws-border)]">
                  {impact.note}
                </p>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
