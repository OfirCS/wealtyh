"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PathfinderResult, QuickAction, RiskWarning, SearchMetadata } from "@/lib/types";
import ImpactSummary from "./ImpactSummary";
import AccountImpactCards from "./AccountImpactCards";
import CashflowCard from "./CashflowSidebar";
import ConfirmationSheet from "@/components/ui/ConfirmationSheet";

interface PlanViewProps {
  result: PathfinderResult;
  event: string;
  searchMetadata: SearchMetadata | null;
  onReset: () => void;
  onApplyActions: (confirmedIndices: number[], actions: QuickAction[]) => void;
}

const ACTION_ICONS: Record<QuickAction["type"], string> = {
  move: "\u2197",
  create_fund: "\u25CE",
  automate: "\u21BB",
  open_account: "+",
  pause: "\u2161",
  adjust: "\u2736",
  pay_off: "\u2713",
};

const PRIORITY_COLORS: Record<QuickAction["priority"], string> = {
  do_now: "#2DE589",
  this_week: "#E8E4DD",
  this_month: "#E8E4DD",
  next_quarter: "#E8E4DD",
};

const PRIORITY_TEXT_COLORS: Record<QuickAction["priority"], string> = {
  do_now: "#FFFFFF",
  this_week: "#5F5C58",
  this_month: "#5F5C58",
  next_quarter: "#5F5C58",
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
  onTap,
}: {
  action: QuickAction;
  index: number;
  onTap: () => void;
}) {
  return (
    <motion.button
      className="group w-full bg-[var(--ws-bg-surface)] rounded-[22px] p-4 sm:p-5 shadow-[0_1px_2px_rgba(42,39,36,0.08)] border border-[#DDD8D1] flex items-start gap-3.5 text-left cursor-pointer transition-all hover:shadow-[0_6px_18px_rgba(42,39,36,0.12)] active:scale-[0.99]"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 * index, ease: "easeOut" as const }}
      onClick={onTap}
    >
      {/* Icon */}
      <div className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0 text-[20px] font-medium bg-[#DFF0E6] text-[#2A2724]">
        {ACTION_ICONS[action.type]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[17px] font-semibold text-[var(--ws-text-primary)] leading-[1.24] tracking-[-0.02em]">
          {action.title}
        </p>
        <p className="text-[13px] text-[var(--ws-text-secondary)] leading-[1.35] mt-1">
          {action.why}
        </p>
        {action.automation && (
          <div className="flex items-center gap-2 mt-2.5">
            <span className="text-[11px] font-semibold px-2 py-0.5 bg-[var(--ws-bg-primary)] rounded-full text-[var(--ws-text-secondary)] capitalize">
              {action.automation.frequency}
            </span>
            {action.automation.duration_months ? (
              <span className="text-[11px] text-[var(--ws-text-tertiary)]">
                {action.automation.duration_months} months
              </span>
            ) : null}
            {action.automation.target_amount ? (
              <span className="text-[11px] font-medium text-[var(--ws-accent-green)]">
                &rarr; ${action.automation.target_amount.toLocaleString()}
              </span>
            ) : null}
          </div>
        )}
      </div>

      {/* Priority badge */}
      <div
        className="flex-shrink-0 mt-0.5 px-3.5 py-1.5 rounded-full text-[12px] font-semibold leading-none min-w-[70px] text-center"
        style={{
          backgroundColor: PRIORITY_COLORS[action.priority],
          color: PRIORITY_TEXT_COLORS[action.priority],
        }}
      >
        {PRIORITY_LABELS[action.priority]}
      </div>
    </motion.button>
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
      className="bg-[#FFFAEB] border border-[#EFE4BC] rounded-[16px] px-4 py-3.5 flex items-start gap-2.5"
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
        <path d="M8 1.5L14.5 13.5H1.5L8 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8 6.5V9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
      </svg>
      <p className="text-[#7E6418] text-[13px] leading-[1.35]">
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
      className="bg-[var(--ws-bg-surface)] rounded-[20px] p-5 shadow-[0_1px_2px_rgba(42,39,36,0.08)] border border-[#DDD8D1]"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.35 + index * 0.1 }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-full bg-[var(--ws-bg-primary)] border border-[var(--ws-border)] flex items-center justify-center">
          <span className="text-[11px]">i</span>
        </div>
        <p className="text-[var(--ws-text-tertiary)] uppercase text-[10px] tracking-[0.08em] font-semibold">
          Advisor Note &middot; {flag.urgency}
        </p>
      </div>
      <p className="text-[var(--ws-text-primary)] font-medium text-[15px] leading-snug mb-1">
        {flag.title}
      </p>
      <p className="text-[var(--ws-text-secondary)] text-[13px] leading-relaxed mb-3">
        {flag.explanation}
      </p>
      <span className="text-[var(--ws-text-primary)] text-[13px] font-medium cursor-pointer hover:underline">
        Talk to an advisor &rarr;
      </span>
    </motion.div>
  );
}

function SearchSourcesBanner({ metadata }: { metadata: SearchMetadata }) {
  const [expanded, setExpanded] = useState(false);

  if (!metadata.sources.length && !metadata.queries.length) return null;

  return (
    <motion.div
      className="bg-[var(--ws-bg-surface)] border border-[var(--ws-border)] rounded-[16px] overflow-hidden"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <button
        className="w-full px-4 py-3 flex items-center justify-between cursor-pointer bg-transparent border-none text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-[var(--ws-text-secondary)]">
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 10L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-[13px] font-semibold text-[var(--ws-text-secondary)]">
            Researched {metadata.sources.length} sources
          </span>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          className={`text-[var(--ws-text-secondary)] transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        >
          <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 border-t border-[var(--ws-border)]">
              {metadata.queries.length > 0 && (
                <div className="pt-2.5 mb-2">
                  <p className="text-[10px] text-[var(--ws-text-tertiary)] uppercase tracking-wider font-semibold mb-1">Searched for</p>
                  <div className="flex flex-wrap gap-1.5">
                    {metadata.queries.map((q, i) => (
                      <span key={i} className="text-[12px] text-[var(--ws-text-secondary)] bg-[var(--ws-bg-primary)] px-2 py-0.5 rounded-full">
                        {q}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {metadata.sources.length > 0 && (
                <div className="pt-1">
                  <p className="text-[10px] text-[var(--ws-text-tertiary)] uppercase tracking-wider font-semibold mb-1.5">Sources</p>
                  <div className="flex flex-col gap-1">
                    {metadata.sources.map((s, i) => {
                      let domain = "";
                      try {
                        domain = new URL(s.url).hostname.replace("www.", "");
                      } catch {
                        domain = s.url;
                      }
                      return (
                        <a
                          key={i}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12px] text-[var(--ws-text-secondary)] hover:underline truncate flex items-center gap-1.5"
                        >
                          <span className="w-4 h-4 rounded bg-[var(--ws-bg-primary)] flex items-center justify-center flex-shrink-0">
                            <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                              <path d="M5 1H2C1.44772 1 1 1.44772 1 2V10C1 10.5523 1.44772 11 2 11H10C10.5523 11 11 10.5523 11 10V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                              <path d="M7 1H11V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M11 1L6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                          </span>
                          {s.title || domain}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function PlanView({ result, event, searchMetadata, onReset, onApplyActions }: PlanViewProps) {
  const [activeTab, setActiveTab] = useState<"actions" | "impacts" | "cashflow">("actions");
  const [selectedAction, setSelectedAction] = useState<QuickAction | null>(null);
  const [confirmedActions, setConfirmedActions] = useState<Set<number>>(new Set());

  const handleActionConfirm = () => {
    if (selectedAction) {
      const idx = result.quick_actions.indexOf(selectedAction);
      if (idx !== -1) {
        setConfirmedActions((prev) => new Set(prev).add(idx));
      }
    }
    setSelectedAction(null);
  };

  return (
    <>
      <motion.div
        className="pb-20"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="mx-auto max-w-[480px]">
          {/* Sticky Header with Tabs */}
          <div className="sticky top-[60px] z-40 bg-[var(--ws-bg-primary)] px-5 pt-7 pb-3 border-b border-[var(--ws-border)]">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[var(--ws-text-primary)] text-[62px] sm:text-[58px] font-serif tracking-[-0.04em] leading-[0.9] mb-1">
                  Your Pathfinder
                </p>
                <p className="text-[var(--ws-text-secondary)] italic text-[14px] truncate max-w-[290px]">
                  &ldquo;{event}&rdquo;
                </p>
              </div>
            </div>

            <div className="flex bg-[#E8E4DD] p-[3px] rounded-full w-full">
              {(["actions", "impacts", "cashflow"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 text-[14px] font-semibold py-2 rounded-full capitalize transition-all duration-200 ${
                    activeTab === tab
                      ? "text-[var(--ws-text-primary)] shadow-[0_1px_2px_rgba(42,39,36,0.08)] bg-[var(--ws-bg-surface)]"
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
                  {/* Search sources banner */}
                  {searchMetadata && (
                    <div className="mb-4">
                      <SearchSourcesBanner metadata={searchMetadata} />
                    </div>
                  )}

                  <p className="text-[13px] text-[var(--ws-text-secondary)] mb-4">
                    {result.quick_actions.length} actions based on your data
                    {confirmedActions.size > 0 && (
                      <span className="text-[var(--ws-accent-green)] font-medium">
                        {" "}&middot; {confirmedActions.size} confirmed
                      </span>
                    )}
                  </p>
                  <div className="flex flex-col gap-4">
                    {result.quick_actions.map((action, i) => (
                      <div key={i} className="relative pl-4">
                        {confirmedActions.has(i) && (
                          <motion.div
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[var(--ws-accent-green)] border-[6px] border-[var(--ws-bg-primary)] flex items-center justify-center z-10"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 400 }}
                          >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </motion.div>
                        )}
                        <ActionCard
                          action={action}
                          index={i}
                          onTap={() => setSelectedAction(action)}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Risk warnings */}
                  {result.risk_warnings.length > 0 && (
                    <div className="mt-6 flex flex-col gap-3">
                      <p className="text-[11px] text-[var(--ws-text-tertiary)] uppercase tracking-wider font-semibold">
                        Things to watch
                      </p>
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

            <div className="pt-8 pb-12 flex flex-col items-center gap-4">
              {confirmedActions.size > 0 && (
                <button
                  onClick={() => onApplyActions(Array.from(confirmedActions), result.quick_actions)}
                  className="w-full py-3.5 rounded-full text-[15px] font-semibold cursor-pointer transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{
                    backgroundColor: 'var(--ws-text-primary)',
                    color: 'var(--ws-bg-primary)',
                  }}
                >
                  Back to Accounts
                </button>
              )}
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

      {/* Confirmation sheet overlay */}
      <AnimatePresence>
        {selectedAction && (
          <ConfirmationSheet
            action={selectedAction}
            onConfirm={handleActionConfirm}
            onCancel={() => setSelectedAction(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
