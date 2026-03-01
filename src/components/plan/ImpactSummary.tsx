"use client";

import { motion } from "framer-motion";
import type { ImpactSummary as ImpactSummaryType, ImpactCard } from "@/lib/types";

interface ImpactSummaryProps {
  summary: ImpactSummaryType;
  event: string;
  hideHeader?: boolean;
}

const CARD_META: Record<string, { label: string; icon: string }> = {
  income_change: { label: "Income", icon: "$" },
  expense_change: { label: "Expenses", icon: "\u2212" },
  net_worth_change: { label: "Net Worth", icon: "\u2197" },
  timeline: { label: "Timeline", icon: "\u23F2" },
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
  switch (type) {
    case "positive":
      return "bg-[rgba(45,229,137,0.05)] border-[var(--ws-accent-green)]/20";
    case "negative":
      return "bg-[rgba(210,58,58,0.05)] border-[var(--ws-accent-red)]/20";
    case "neutral":
      return "bg-[var(--ws-bg-surface)] border-[var(--ws-border)] opacity-80";
  }
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
          <p className={`font-serif leading-tight tracking-tight ${valueColor(card.type)} mb-0.5 sm:mb-1 ${isHero ? "text-[42px] sm:text-[56px] lg:text-[72px]" : "text-[24px] sm:text-[32px]"
            }`}>
            {card.value}
          </p>
          <p className={`text-[var(--ws-text-tertiary)] leading-relaxed ${isHero ? "text-[14px] sm:text-[16px]" : "text-[12px] sm:text-[13px]"
            }`}>
            {card.label}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default function ImpactSummary({ summary, event, hideHeader }: ImpactSummaryProps) {
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

      <p className="text-[11px] text-[var(--ws-text-tertiary)] uppercase tracking-wider font-semibold mb-3">
        Financial impact
      </p>

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
