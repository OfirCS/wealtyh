"use client";

import { motion } from "framer-motion";
import type { ImpactSummary as ImpactSummaryType, ImpactCard, QuickAction } from "@/lib/types";

interface ImpactSummaryProps {
  summary: ImpactSummaryType;
  event: string;
  hideHeader?: boolean;
  actions?: QuickAction[];
}

const CARD_META: Record<string, { label: string; icon: string }> = {
  income_change: { label: "Income", icon: "$" },
  expense_change: { label: "Expenses", icon: "\u2212" },
  net_worth_change: { label: "Net Worth Change", icon: "\u2197" },
  timeline: { label: "Plan Duration", icon: "\u23F2" },
};

function valueColor(type: ImpactCard["type"]): string {
  switch (type) {
    case "positive":
      return "text-[var(--ws-accent-green)]";
    case "negative":
      return "text-[var(--ws-accent-red)]";
    case "neutral":
      return "text-[var(--ws-text-primary)]";
  }
}

function bgGlow(type: ImpactCard["type"]): string {
  return "bg-[var(--ws-bg-surface)] border-[var(--ws-border)] shadow-sm";
}

function ImpactCardComponent({
  card,
  labelKey,
  index,
  isHero = false,
}: {
  card: ImpactCard;
  labelKey: string;
  index: number;
  isHero?: boolean;
}) {
  const meta = CARD_META[labelKey] || { label: card.label, icon: "" };

  return (
    <motion.div
      className={`rounded-[16px] sm:rounded-[20px] ${isHero ? "p-6 sm:p-8 sm:py-10" : "p-4 sm:p-5"
        } border ${bgGlow(card.type)}`}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        bounce: 0,
        duration: 0.6,
        delay: 0.1 + index * 0.08,
      }}
    >
      <div className={`flex flex-col h-full justify-between gap-3 sm:gap-4 ${isHero ? "md:flex-row md:items-center md:gap-8" : ""}`}>
        <div className="flex items-center gap-1.5 sm:gap-2 lg:min-w-[140px]">
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[var(--ws-bg-primary)] border border-[var(--ws-border)] flex items-center justify-center text-[11px] sm:text-[13px] text-[var(--ws-text-primary)] shadow-sm">
            {meta.icon}
          </div>
          <p className="text-[var(--ws-text-secondary)] uppercase text-[10px] sm:text-[11px] tracking-wider font-medium">
            {meta.label}
          </p>
        </div>

        <div>
          <p className={`font-serif leading-tight tracking-tight ${valueColor(card.type)} ${isHero ? "text-[42px] sm:text-[56px] lg:text-[72px] mb-1 sm:mb-2" : "text-[24px] sm:text-[32px] mb-0.5"
            }`}>
            {card.value}
          </p>
          <p className={`text-[var(--ws-text-secondary)] leading-relaxed font-medium ${isHero ? "text-[14px] sm:text-[16px]" : "text-[13px] sm:text-[14px]"
            }`}>
            {card.label}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default function ImpactSummary({ summary, event, hideHeader, actions = [] }: ImpactSummaryProps) {
  const totalMonthlyAutomation = actions
    .filter(a => a.type === 'automate' && a.automation && a.automation.amount > 0)
    .reduce((sum, a) => sum + (a.automation?.amount ?? 0), 0);
  const secondaryEntries: { key: string; card: ImpactCard }[] = [
    { key: "income_change", card: summary.income_change },
    { key: "expense_change", card: summary.expense_change },
    { key: "timeline", card: summary.timeline },
  ];

  return (
    <div className="mb-4">
      {!hideHeader && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[var(--ws-text-primary)] text-[52px] font-serif tracking-[-0.04em] leading-[0.9]">
              Your Plan
            </p>
          </div>
          <p className="text-[var(--ws-text-secondary)] italic text-[14px]">
            &ldquo;{event}&rdquo;
          </p>
        </div>
      )}

      {/* Plain-English summary */}
      <motion.p
        className="text-[15px] sm:text-[16px] text-[var(--ws-text-primary)] leading-relaxed mb-6"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0, duration: 0.5, delay: 0.05 }}
      >
        {`Net worth ${summary.net_worth_change.type === "negative" ? "decreases" : "grows"} by ${summary.net_worth_change.value}. ${summary.income_change.label}. ${summary.expense_change.label}. Plan runs ${summary.timeline.value}.${totalMonthlyAutomation > 0 ? ` Includes $${totalMonthlyAutomation.toLocaleString('en-CA')}/mo in automated savings.` : ''}`}
      </motion.p>

      {/* Hero Card for Net Worth */}
      <div className="mb-3 sm:mb-4">
        <ImpactCardComponent
          card={summary.net_worth_change}
          labelKey="net_worth_change"
          index={0}
          isHero={true}
        />
      </div>

      {/* Grid for Secondary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {secondaryEntries.map((entry, i) => (
          <ImpactCardComponent
            key={entry.key}
            card={entry.card}
            labelKey={entry.key}
            index={i + 1}
            isHero={false}
          />
        ))}
      </div>
    </div>
  );
}
