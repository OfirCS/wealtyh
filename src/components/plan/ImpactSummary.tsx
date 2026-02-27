"use client";

import { motion } from "framer-motion";
import type { ImpactSummary as ImpactSummaryType, ImpactCard } from "@/lib/types";

interface ImpactSummaryProps {
  summary: ImpactSummaryType;
  event: string;
  hideHeader?: boolean;
}

const CARD_LABELS: Record<string, string> = {
  income_change: "Income",
  expense_change: "Expenses",
  net_worth_change: "Net Worth",
  timeline: "Timeline",
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

function ImpactCardComponent({
  card,
  labelKey,
  index,
}: {
  card: ImpactCard;
  labelKey: string;
  index: number;
}) {
  return (
    <motion.div
      className="bg-[var(--ws-bg-surface)] rounded-lg p-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        ease: "easeOut",
        delay: 0.15 + index * 0.08,
      }}
    >
      <p className="text-[var(--ws-text-tertiary)] uppercase text-[10px] tracking-[0.08em] font-medium">
        {CARD_LABELS[labelKey] || card.label}
      </p>
      <p className={`text-[24px] font-bold leading-tight mt-1 ${valueColor(card.type)}`}>
        {card.value}
      </p>
      <p className="text-[var(--ws-text-secondary)] text-[12px] mt-0.5">
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

  const formattedDate = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="mb-4">
      {/* Header row */}
      {!hideHeader && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[var(--ws-text-primary)] text-[28px] font-serif tracking-tight">
              Your Pathfinder
            </p>
            <p className="text-[var(--ws-text-tertiary)] text-[13px] font-medium">
              {formattedDate}
            </p>
          </div>
          <p className="text-[var(--ws-text-secondary)] italic text-[14px]">
            &ldquo;{event}&rdquo;
          </p>
        </div>
      )}

      {/* 2x2 impact cards grid */}
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
