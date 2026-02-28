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
  do_now: "#FCFCFC",
  this_week: "#3A3938",
  this_month: "#2D2D2C",
  next_quarter: "#2D2D2C",
};

const PRIORITY_TEXT_COLORS: Record<QuickAction["priority"], string> = {
  do_now: "#1D1D1C",
  this_week: "#FCFCFC",
  this_month: "#FCFCFC",
  next_quarter: "#9B9B9A",
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
      className="group w-full bg-transparent flex items-start gap-4 sm:gap-5 text-left cursor-pointer transition-all"
      initial={{ opacity: 0, x: -15 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.05 * index, ease: [0.25, 0.1, 0.25, 1] }}
      onClick={onTap}
    >
      {/* Icon */}
      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 text-[18px] sm:text-[20px] bg-[var(--ws-bg-primary)] text-[var(--ws-text-primary)] border border-[var(--ws-border)]">
        {ACTION_ICONS[action.type]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5 pb-6">
        <p className="font-serif text-[18px] sm:text-[22px] text-[var(--ws-text-primary)] leading-tight tracking-tight mt-1 sm:mt-1.5 group-hover:text-[var(--ws-text-secondary)] transition-colors">
          {action.title}
        </p>
        {action.why && (
          <p className="text-[13px] text-[var(--ws-text-secondary)] mt-1 leading-snug">
            {action.why}
          </p>
        )}
        {action.automation && (
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2 sm:mt-2.5">
            <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 bg-[var(--ws-bg-primary)] rounded-full text-[var(--ws-text-secondary)] capitalize">
              {action.automation.frequency}
            </span>
            {action.automation.duration_months ? (
              <span className="text-[10px] sm:text-[11px] text-[var(--ws-text-tertiary)]">
                {action.automation.duration_months} months
              </span>
            ) : null}
            {action.automation.target_amount ? (
              <span className="text-[10px] sm:text-[11px] font-medium text-[var(--ws-accent-green)]">
                &rarr; ${action.automation.target_amount.toLocaleString()}
              </span>
            ) : null}
          </div>
        )}
      </div>

      {/* Priority badge */}
      <div
        className="flex-shrink-0 mt-1 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-[12px] font-semibold leading-none min-w-[60px] sm:min-w-[70px] text-center"
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
      className="flex items-center gap-2"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 + index * 0.05, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0 text-[var(--ws-accent-red)]"
      >
        <path d="M8 1.5L14.5 13.5H1.5L8 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8 6.5V9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11.5" r="1.0" fill="currentColor" />
      </svg>
      <p className="text-[var(--ws-text-secondary)] text-[12px] sm:text-[13px]">
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
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--ws-bg-surface)] rounded-[16px] p-4 sm:px-5 sm:py-4 border border-[var(--ws-border)]"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35 + index * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <div className="flex flex-col gap-1">
        <p className="text-[var(--ws-text-tertiary)] uppercase text-[10px] tracking-wider font-semibold">
          Advisor Note &middot; {flag.urgency}
        </p>
        <p className="font-serif text-[18px] text-[var(--ws-text-primary)] leading-tight tracking-tight">
          {flag.title}
        </p>
      </div>
      <button className="text-[var(--ws-text-primary)] text-[13px] font-medium cursor-pointer flex items-center justify-center gap-1.5 px-4 py-2 rounded-full border border-[var(--ws-border)] hover:bg-[var(--ws-bg-primary)] transition-all flex-shrink-0">
        Talk to an advisor
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </motion.div>
  );
}

function SearchSourcesBanner({ metadata }: { metadata: SearchMetadata }) {
  const [expanded, setExpanded] = useState(false);

  if (!metadata.sources.length && !metadata.queries.length) return null;

  return (
    <motion.div
      className="w-full flex flex-col gap-2"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-fit flex items-center justify-between gap-3 bg-[var(--ws-bg-surface)] border border-[var(--ws-border)] rounded-full px-3 py-1.5 hover:bg-[var(--ws-bg-primary)] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-[var(--ws-bg-primary)] border border-[var(--ws-border)] flex items-center justify-center text-[var(--ws-text-primary)]">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2.5" />
              <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-[12px] font-medium text-[var(--ws-text-secondary)]">
            Verified using {metadata.sources.length} live sources
          </p>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={`text-[var(--ws-text-tertiary)] transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}>
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
            <div className="bg-[var(--ws-bg-surface)] border border-[var(--ws-border)] rounded-[16px] p-4 mt-1 flex flex-col gap-4">
              {metadata.queries.length > 0 && (
                <div>
                  <p className="text-[10px] text-[var(--ws-text-tertiary)] uppercase tracking-wider font-semibold mb-2">
                    Queries
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {metadata.queries.map((q, i) => (
                      <span key={i} className="text-[12px] text-[var(--ws-text-primary)] bg-[var(--ws-bg-primary)] border border-[var(--ws-border)] px-2.5 py-1 rounded-full">
                        {q}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {metadata.sources.length > 0 && (
                <div className={metadata.queries.length > 0 ? "pt-3 border-t border-[var(--ws-border)]" : ""}>
                  <p className="text-[10px] text-[var(--ws-text-tertiary)] uppercase tracking-wider font-semibold mb-2">
                    Sources
                  </p>
                  <div className="flex flex-col gap-2">
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
                          className="text-[13px] text-[var(--ws-text-secondary)] hover:text-[var(--ws-text-primary)] transition-colors truncate flex items-center gap-1.5"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
                            <path d="M5 1H2C1.44772 1 1 1.44772 1 2V10C1 10.5523 1.44772 11 2 11H10C10.5523 11 11 10.5523 11 10V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            <path d="M7 1H11V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M11 1L6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
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
        <div className="mx-auto max-w-5xl w-full">
          {/* Sticky Header with Tabs */}
          <div className="sticky top-[60px] z-40 bg-[var(--ws-bg-primary)] px-4 sm:px-10 pt-4 sm:pt-8 pb-3 sm:pb-4 border-b border-[var(--ws-border)]">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-4 sm:mb-8 gap-3 sm:gap-4">
              <div>
                <p className="text-[var(--ws-text-primary)] text-[42px] sm:text-[64px] font-serif tracking-tight leading-[1] mb-1 sm:mb-2">
                  Your Pathfinder
                </p>
                <p className="text-[var(--ws-text-secondary)] text-[14px] sm:text-[16px] max-w-xl leading-relaxed">
                  Based on your simulation: <span className="text-[var(--ws-text-primary)] font-medium">&ldquo;{event}&rdquo;</span>
                </p>
              </div>
            </div>

            <div className="flex bg-[var(--ws-bg-surface)] p-1 rounded-full w-full sm:w-fit min-w-[320px] border border-[var(--ws-border)]">
              {(["actions", "impacts", "cashflow"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 text-[13px] sm:text-[14px] font-medium py-2 sm:py-2.5 px-4 sm:px-6 rounded-full capitalize transition-all duration-300 ${activeTab === tab
                    ? "text-[var(--ws-text-inverse)] bg-[var(--ws-text-primary)] shadow-sm"
                    : "text-[var(--ws-text-secondary)] hover:text-[var(--ws-text-primary)]"
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 sm:px-10 py-5 sm:py-8 w-full">
            <AnimatePresence mode="popLayout">
              {activeTab === "actions" && (
                <motion.div
                  key="actions"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                  className="w-full"
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
                        {" "}&middot; {confirmedActions.size} completed
                      </span>
                    )}
                  </p>
                  <div className="flex flex-col gap-0 border border-[var(--ws-border)] bg-[var(--ws-bg-surface)] p-6 sm:p-8 rounded-[16px] sm:rounded-[24px]">
                    <AnimatePresence mode="popLayout">
                      {result.quick_actions.map((action, i) => {
                        if (confirmedActions.has(i)) return null;

                        const isLast = i === result.quick_actions.length - 1;

                        return (
                          <motion.div
                            key={`pending-${i}`}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="relative pl-0 w-full"
                          >
                            {!isLast && (
                              <div className="absolute left-[20px] sm:left-[24px] top-[40px] bottom-0 w-[2px] bg-[var(--ws-border)] -z-10" />
                            )}
                            <ActionCard
                              action={action}
                              index={i}
                              onTap={() => setSelectedAction(action)}
                            />
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  {confirmedActions.size > 0 && (
                    <motion.div
                      className="mt-8 flex flex-col gap-4"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-5 h-5 rounded-full bg-[var(--ws-accent-green)] flex items-center justify-center">
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                        <h3 className="text-[16px] font-semibold text-[var(--ws-text-primary)]">
                          Completed
                        </h3>
                      </div>
                      <AnimatePresence mode="popLayout">
                        {result.quick_actions.map((action, i) => {
                          if (!confirmedActions.has(i)) return null;
                          return (
                            <motion.div
                              key={`completed-${i}`}
                              layout
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.2 }}
                              className="relative pl-0 opacity-60 w-full grayscale"
                            >
                              <ActionCard
                                action={action}
                                index={i}
                                onTap={() => { }}
                              />
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </motion.div>
                  )}

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
                  className="w-full max-w-3xl"
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
                  className="w-full max-w-3xl"
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
