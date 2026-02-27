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
      return "bg-[#EAF8F0]";
    case "negative":
      return "bg-[#FCEEEE]";
    case "neutral":
      return "bg-[var(--ws-bg-surface)]";
  }
}

function ImpactCardComponent({
  card,
  labelKey,
  index,
}: {
  card: ImpactCard;
  labelKey: string;
  index: number;
}) {
  const meta = CARD_META[labelKey] || { label: card.label, icon: "" };

  return (
    <motion.div
      className={`rounded-[18px] p-4 border border-[#DDD8D1] shadow-[0_1px_2px_rgba(42,39,36,0.08)] ${bgGlow(card.type)}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        ease: "easeOut" as const,
        delay: 0.15 + index * 0.08,
      }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[12px] font-semibold w-4 text-center text-[var(--ws-text-secondary)]">{meta.icon}</span>
        <p className="text-[var(--ws-text-tertiary)] uppercase text-[10px] tracking-[0.08em] font-semibold">
          {meta.label}
        </p>
      </div>
      <p className={`text-[24px] font-semibold leading-tight tracking-[-0.02em] ${valueColor(card.type)}`}>
        {card.value}
      </p>
      <p className="text-[var(--ws-text-secondary)] text-[12px] mt-1">
        {card.label}
      </p>
    </motion.div>
  );
}

export default function ImpactSummary({ summary, event, hideHeader }: ImpactSummaryProps) {
  const cardEntries: { key: string; card: ImpactCard }[] = [
    { key: "income_change", card: summary.income_change },
    { key: "expense_change", card: summary.expense_change },
    { key: "net_worth_change", card: summary.net_worth_change },
    { key: "timeline", card: summary.timeline },
  ];

  return (
    <div className="mb-4">
      {!hideHeader && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[var(--ws-text-primary)] text-[52px] font-serif tracking-[-0.04em] leading-[0.9]">
              Your Pathfinder
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
      <div className="grid grid-cols-2 gap-3">
        {cardEntries.map((entry, i) => (
          <ImpactCardComponent
            key={entry.key}
            card={entry.card}
            labelKey={entry.key}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}
