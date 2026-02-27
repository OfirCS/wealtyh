"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PathfinderResult, QuickAction, RiskWarning } from "@/lib/types";
import ImpactSummary from "./ImpactSummary";
import AccountImpactCards from "./AccountImpactCards";
import CashflowCard from "./CashflowSidebar";

interface PlanViewProps {
  result: PathfinderResult;
  event: string;
  onReset: () => void;
}

const ACTION_ICONS: Record<QuickAction["type"], string> = {
  move: "↗",
  create_fund: "🎯",
  automate: "🔄",
  open_account: "➕",
  pause: "⏸",
  adjust: "⚙",
  pay_off: "✓",
};

const PRIORITY_COLORS: Record<QuickAction["priority"], string> = {
  do_now: "#2DE589",
  this_week: "#FFD60A",
  this_month: "#6BA3FF",
  next_quarter: "#9B9895",
};

const PRIORITY_LABELS: Record<QuickAction["priority"], string> = {
  do_now: "Now",
  this_week: "This week",
  this_month: "This month",
  next_quarter: "Later",
};

function ActionCard({
  action,
  index,
}: {
  action: QuickAction;
  index: number;
}) {
  return (
    <motion.div
      className="bg-[var(--ws-bg-surface)] rounded-[20px] p-4 shadow-sm border border-[var(--ws-border)] flex items-start gap-3.5"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 * index, ease: "easeOut" as const }}
    >
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0 text-[18px]"
        style={{ backgroundColor: `${PRIORITY_COLORS[action.priority]}20` }}
      >
        {ACTION_ICONS[action.type]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-[var(--ws-text-primary)] leading-snug">
          {action.title}
        </p>
        <p className="text-[13px] text-[var(--ws-text-secondary)] leading-snug mt-0.5">
          {action.why}
        </p>
        {action.automation && (
          <p className="text-[12px] text-[var(--ws-text-tertiary)] mt-1">
            {action.automation.frequency} &middot;{" "}
            {action.automation.duration_months
              ? `${action.automation.duration_months} months`
              : "ongoing"}{" "}
            {action.automation.target_amount
              ? `→ $${action.automation.target_amount.toLocaleString()}`
              : ""}
          </p>
        )}
      </div>

      {/* CTA */}
      <button
        className="flex-shrink-0 mt-0.5 px-3.5 py-1.5 rounded-full text-[13px] font-bold cursor-pointer transition-opacity hover:opacity-80"
        style={{
          backgroundColor: PRIORITY_COLORS[action.priority],
          color: action.priority === "this_week" ? "#1A1A1A" : "#fff",
        }}
      >
        {PRIORITY_LABELS[action.priority]}
      </button>
    </motion.div>
  );
}

function RiskBanner({
  warning,
  index,
}: {
  warning: RiskWarning;
  index: number;
}) {
  return (
    <motion.div
      className="bg-[#FFFBEB] border border-[#F5E6B8] rounded-[16px] px-4 py-3 flex items-start gap-2.5"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 + index * 0.05 }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0 mt-[2px] text-[#B8860B]"
      >
        <path
          d="M8 1.5L14.5 13.5H1.5L8 1.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M8 6.5V9.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
      </svg>
      <p className="text-[var(--ws-text-secondary)] text-[13px] leading-snug">
        {warning.text}
      </p>
    </motion.div>
  );
}

function AdvisorNote({
  flag,
  index,
}: {
  flag: { title: string; explanation: string; urgency: string };
  index: number;
}) {
  return (
    <motion.div
      className="bg-[var(--ws-bg-surface)] rounded-[20px] p-5 shadow-sm border border-[var(--ws-border)]"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.35 + index * 0.1 }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[13px]">&#x1F512;</span>
        <p className="text-[var(--ws-text-tertiary)] uppercase text-[10px] tracking-[0.08em] font-semibold">
          Advisor Note
        </p>
      </div>
      <p className="text-[var(--ws-text-primary)] font-medium text-[15px] leading-snug mb-1">
        {flag.title}
      </p>
      <p className="text-[var(--ws-text-secondary)] text-[13px] leading-relaxed line-clamp-2 mb-3">
        {flag.explanation}
      </p>
      <span className="text-[var(--ws-text-primary)] text-[13px] font-medium cursor-pointer hover:underline">
        Talk to an advisor &rarr;
      </span>
    </motion.div>
  );
}

export default function PlanView({ result, event, onReset }: PlanViewProps) {
  const [activeTab, setActiveTab] = useState<"impacts" | "actions" | "cashflow">("actions");

  return (
    <motion.div
      className="pb-20"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="mx-auto max-w-[480px]">
        {/* Sticky Header with Tabs */}
        <div className="sticky top-[60px] z-40 bg-[var(--ws-bg-primary)] px-5 pt-6 pb-2 border-b border-[var(--ws-border)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[var(--ws-text-primary)] text-[28px] font-serif tracking-tight leading-none mb-1">
                Your Pathfinder
              </p>
              <p className="text-[var(--ws-text-secondary)] italic text-[14px] truncate max-w-[280px]">
                &ldquo;{event}&rdquo;
              </p>
            </div>
          </div>

          <div className="flex bg-[#E8E4DD] p-[3px] rounded-full w-full">
            {(["actions", "impacts", "cashflow"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 text-[13px] font-bold py-1.5 rounded-full capitalize transition-all duration-200 relative ${
                  activeTab === tab
                    ? "text-[var(--ws-text-primary)] shadow-sm bg-[var(--ws-bg-surface)]"
                    : "text-[#88837E] hover:text-[var(--ws-text-primary)]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 py-6">
          <AnimatePresence mode="wait">
            {activeTab === "actions" && (
              <motion.div
                key="actions"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
              >
                <p className="text-[13px] text-[var(--ws-text-secondary)] mb-4">
                  {result.quick_actions.length} actions based on your data
                </p>
                <div className="flex flex-col gap-3">
                  {result.quick_actions.map((action, i) => (
                    <ActionCard key={i} action={action} index={i} />
                  ))}
                </div>

                {/* Risk warnings after actions */}
                {result.risk_warnings.length > 0 && (
                  <div className="mt-6 flex flex-col gap-3">
                    {result.risk_warnings.map((w, i) => (
                      <RiskBanner key={i} warning={w} index={i} />
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "impacts" && (
              <motion.div
                key="impacts"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
              >
                <ImpactSummary summary={result.impact_summary} event={event} hideHeader />
                <div className="h-4" />
                <AccountImpactCards impacts={result.account_impacts} />
              </motion.div>
            )}

            {activeTab === "cashflow" && (
              <motion.div
                key="cashflow"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
              >
                <CashflowCard cashflow={result.monthly_cashflow} />

                {result.advisor_flags.length > 0 && (
                  <div className="mt-8 flex flex-col gap-4">
                    <h3 className="text-[18px] font-semibold text-[var(--ws-text-primary)]">
                      Advisor Flags
                    </h3>
                    {result.advisor_flags.map((flag, i) => (
                      <AdvisorNote key={i} flag={flag} index={i} />
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="pt-8 pb-12 text-center">
            <button
              onClick={onReset}
              className="text-[var(--ws-text-tertiary)] text-[14px] underline underline-offset-2 hover:text-[var(--ws-text-secondary)] transition-colors cursor-pointer bg-transparent border-none"
            >
              Recalculate new scenario
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
