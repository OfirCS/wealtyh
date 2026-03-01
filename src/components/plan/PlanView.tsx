"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PathfinderResult, QuickAction, RiskWarning, SearchMetadata, ThinkingStep, DebugLog } from "@/lib/types";
import ImpactSummary from "./ImpactSummary";
import AccountImpactCards from "./AccountImpactCards";
import CashflowCard from "./CashflowSidebar";
import ConfirmationSheet from "@/components/ui/ConfirmationSheet";

interface PlanViewProps {
  result: PathfinderResult;
  event: string;
  searchMetadata: SearchMetadata | null;
  debugLog: DebugLog | null;
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
      transition={{ type: "spring", bounce: 0, duration: 0.6, delay: 0.05 * index }}
      onClick={onTap}
    >
      {/* Icon */}
      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 text-[18px] sm:text-[20px] bg-[var(--ws-bg-primary)] text-[var(--ws-text-primary)] border border-[var(--ws-border)]">
        {ACTION_ICONS[action.type]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5 pb-4">
        <p className="font-serif text-[18px] sm:text-[20px] text-[var(--ws-text-primary)] leading-tight tracking-tight mt-1 sm:mt-1 group-hover:text-[var(--ws-text-secondary)] transition-colors">
          {action.title}
        </p>
        {action.why && (
          <p className="text-[13px] text-[var(--ws-text-secondary)] mt-1 leading-snug">
            {action.why}
          </p>
        )}
        {action.derived_from && (
          <div className="flex items-start gap-1.5 mt-1.5 px-2.5 py-1.5 rounded-[10px] bg-[var(--ws-bg-primary)] border border-[var(--ws-border)]">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 mt-0.5 text-[var(--ws-text-tertiary)]">
              <path d="M8 1C4.134 1 1 4.134 1 8s3.134 7 7 7 7-3.134 7-7-3.134-7-7-7z" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 5v3M8 10.5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <p className="text-[11px] text-[var(--ws-text-tertiary)] leading-snug">
              {action.derived_from}
            </p>
          </div>
        )}
        {action.automation && (
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
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
      transition={{ type: "spring", bounce: 0, duration: 0.6, delay: 0.2 + index * 0.05 }}
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
      transition={{ type: "spring", bounce: 0, duration: 0.6, delay: 0.35 + index * 0.1 }}
    >
      <div className="flex flex-col gap-1">
        <p className="text-[var(--ws-text-tertiary)] uppercase text-[10px] tracking-wider font-semibold">
          Advisor &middot; {flag.urgency}
        </p>
        <p className="font-serif text-[18px] text-[var(--ws-text-primary)] leading-tight tracking-tight">
          {flag.title}
        </p>
      </div>
      <button className="text-[var(--ws-text-primary)] text-[13px] font-medium cursor-pointer flex items-center justify-center gap-1.5 px-4 py-2 rounded-full border border-[var(--ws-border)] hover:bg-[var(--ws-bg-primary)] transition-all flex-shrink-0">
        Book call
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </motion.div>
  );
}

const INSIGHT_COLORS: Record<string, string> = {
  positive: "var(--ws-accent-green)",
  negative: "var(--ws-accent-red)",
  neutral: "var(--ws-text-secondary)",
};

function AnalysisSection({ steps }: { steps: ThinkingStep[] }) {
  const [expanded, setExpanded] = useState(false);

  if (!steps || steps.length === 0) return null;

  return (
    <motion.div
      className="mb-5"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-fit flex items-center gap-2 mb-3 cursor-pointer bg-transparent border-none"
      >
        <div className="w-5 h-5 rounded-full bg-[var(--ws-accent-green)] flex items-center justify-center">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <path d="M12 3v18M3 12h18" stroke="white" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
        <p className="text-[13px] font-semibold text-[var(--ws-text-primary)]">
          Analysis
        </p>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          className={`text-[var(--ws-text-tertiary)] transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
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
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col border border-[var(--ws-border)] rounded-[16px] p-5 sm:p-6 bg-[var(--ws-bg-surface)]">
              {steps.map((step, i) => (
                <div key={i} className="relative pl-6 pb-6 last:pb-0">
                  {/* Timeline connector line */}
                  {i < steps.length - 1 && (
                    <div className="absolute left-[7px] top-6 bottom-[-8px] w-[2px] bg-[var(--ws-border)] -z-10" />
                  )}

                  {/* Timeline dot */}
                  <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-[var(--ws-bg-primary)] border-2 border-[var(--ws-border)] flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--ws-text-tertiary)]" />
                  </div>

                  <motion.div
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.5, delay: 0.05 * i }}
                  >
                    <p className="text-[14px] font-semibold text-[var(--ws-text-primary)] mb-2.5">
                      {step.title}
                    </p>

                    {step.insights?.length > 0 && (
                      <div className="flex flex-col gap-2">
                        {step.insights.map((insight, j) => {
                          const Icon = insight.type === 'positive'
                            ? <span className="text-[12px] leading-none text-[var(--ws-accent-green)] font-bold">✓</span>
                            : insight.type === 'negative'
                              ? <span className="text-[12px] leading-none text-[var(--ws-accent-red)] font-bold">!</span>
                              : <span className="text-[12px] leading-none text-[var(--ws-text-tertiary)] font-bold">·</span>;

                          return (
                            <div key={j} className="flex items-start gap-2">
                              <div className="pt-0.5 w-3 flex justify-center flex-shrink-0">
                                {Icon}
                              </div>
                              <p
                                className="text-[13px] leading-relaxed"
                                style={{ color: INSIGHT_COLORS[insight.type] || INSIGHT_COLORS.neutral }}
                              >
                                {insight.text}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </motion.div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
      transition={{ type: "spring", bounce: 0, duration: 0.6, delay: 0.1 }}
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
            {metadata.sources.length} sources
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

const STEP_COLORS: Record<string, string> = {
  Router: "var(--ws-accent-blue, #4A90D9)",
  Search: "var(--ws-accent-green)",
  Generate: "var(--ws-text-primary)",
  Guardrail: "var(--ws-accent-red)",
};

function DebugPanel({ log }: { log: DebugLog }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      className="mb-5"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-fit flex items-center gap-2 mb-2 cursor-pointer bg-transparent border-none"
      >
        <div className="w-4 h-4 rounded-[4px] bg-[var(--ws-text-tertiary)] flex items-center justify-center">
          <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
            <path d="M2 4L6 8L10 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-[12px] font-mono text-[var(--ws-text-tertiary)]">
          Decision log &middot; {log.actionsBeforeGuardrails} generated &rarr; {log.actionsAfterGuardrails} kept
        </p>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          className={`text-[var(--ws-text-tertiary)] transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
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
            <div className="bg-[#1a1a19] border border-[var(--ws-border)] rounded-[12px] p-4 font-mono text-[11px] flex flex-col gap-3">
              {log.entries.map((entry, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                      style={{ color: STEP_COLORS[entry.step] || "var(--ws-text-secondary)", backgroundColor: "rgba(255,255,255,0.05)" }}
                    >
                      {entry.step}
                    </span>
                    <span className="text-[var(--ws-text-secondary)]">{entry.detail}</span>
                  </div>
                  {entry.data && (
                    <p className="text-[var(--ws-text-tertiary)] pl-4 text-[10px] leading-relaxed break-all">
                      {entry.data}
                    </p>
                  )}
                </div>
              ))}

              {log.removedActions.length > 0 && (
                <div className="pt-2 border-t border-[var(--ws-border)]">
                  <p className="text-[var(--ws-accent-red)] text-[10px] font-bold uppercase mb-1">Removed</p>
                  {log.removedActions.map((r, i) => (
                    <p key={i} className="text-[var(--ws-text-tertiary)] text-[10px] leading-relaxed">
                      {r}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const TAB_ORDER = { actions: 0, impacts: 1, cashflow: 2 } as const;

export default function PlanView({ result, event, searchMetadata, debugLog, onReset, onApplyActions }: PlanViewProps) {
  const [activeTab, setActiveTab] = useState<"actions" | "impacts" | "cashflow">("actions");
  const [tabDirection, setTabDirection] = useState(1);
  const [selectedAction, setSelectedAction] = useState<QuickAction | null>(null);
  const [confirmedActions, setConfirmedActions] = useState<Set<number>>(new Set());

  const handleTabChange = (tab: "actions" | "impacts" | "cashflow") => {
    setTabDirection(TAB_ORDER[tab] > TAB_ORDER[activeTab] ? 1 : -1);
    setActiveTab(tab);
  };

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
      <div className="pb-20">
        <div className="mx-auto max-w-5xl w-full">
          {/* Sticky Header */}
          <div className="sticky top-[60px] z-40 bg-[var(--ws-bg-primary)] px-4 sm:px-10 pt-4 sm:pt-8 pb-3 sm:pb-4 border-b border-[var(--ws-border)]">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-4 sm:mb-8 gap-3 sm:gap-4">
              <div>
                <p className="text-[var(--ws-text-primary)] text-[42px] sm:text-[64px] font-serif tracking-tight leading-[1] mb-1 sm:mb-2">
                  Your Plan
                </p>
                <p className="text-[var(--ws-text-secondary)] text-[14px] sm:text-[16px] max-w-xl leading-relaxed truncate">
                  &ldquo;{event}&rdquo;
                </p>
              </div>
            </div>

            <div className="flex bg-[var(--ws-bg-surface)] p-1 rounded-full w-full sm:w-fit min-w-[320px] border border-[var(--ws-border)]">
              {(["actions", "impacts", "cashflow"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
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

          <div className="px-4 sm:px-10 py-5 sm:py-8 w-full mt-2 sm:mt-4">
            <AnimatePresence mode="wait" initial={false}>
              {activeTab === "actions" && (
                <motion.div
                  key="actions"

                  variants={{
                    initial: { opacity: 0, x: tabDirection * 20 },
                    animate: { opacity: 1, x: 0, transition: { type: "spring", bounce: 0, duration: 0.35 } },
                    exit: { opacity: 0, transition: { duration: 0.08 } },
                  }}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="w-full max-w-5xl mx-auto flex flex-col pt-2"
                >
                  {/* Agent Summary HUD */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="mb-8"
                  >
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 bg-[var(--ws-bg-surface)] p-5 sm:p-6 rounded-[16px] sm:rounded-[20px] border border-[var(--ws-border)]">
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-10 h-10 rounded-full bg-[var(--ws-bg-primary)] border border-[var(--ws-border)] flex items-center justify-center text-[var(--ws-text-primary)] shadow-sm">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" stroke="currentColor" strokeWidth="1.5" />
                            <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M12 8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <h3 className="text-[16px] font-semibold text-[var(--ws-text-primary)]">
                          Pathfinder Analysis
                        </h3>
                        <p className="text-[14px] leading-relaxed text-[var(--ws-text-secondary)]">
                          {(() => {
                            const steps = result.thinking_steps.length;
                            const actions = result.quick_actions.length;
                            const doNow = result.quick_actions.filter(a => a.priority === 'do_now').length;
                            const hasRisks = result.risk_warnings.length > 0;
                            const hasAdvisor = result.advisor_flags.length > 0;
                            const nw = result.impact_summary.net_worth_change;
                            const nwDir = nw.value.startsWith('+') || nw.value.startsWith('$') ? 'grow' : nw.value.startsWith('-') ? 'protect' : 'optimize';

                            const parts: string[] = [];
                            parts.push(`I analyzed your finances across ${steps} dimension${steps !== 1 ? 's' : ''} for your "${event}" scenario.`);

                            if (actions === 1) {
                              parts.push(`There's 1 key action to take${doNow === 1 ? ' right away' : ''}.`);
                            } else {
                              parts.push(`I identified ${actions} actions to ${nwDir} your finances${doNow > 0 ? `, ${doNow} of which ${doNow === 1 ? 'is' : 'are'} urgent` : ''}.`);
                            }

                            if (hasRisks && hasAdvisor) {
                              parts.push(`I flagged ${result.risk_warnings.length} risk${result.risk_warnings.length !== 1 ? 's' : ''} and ${result.advisor_flags.length} item${result.advisor_flags.length !== 1 ? 's' : ''} to discuss with an advisor.`);
                            } else if (hasRisks) {
                              parts.push(`I also flagged ${result.risk_warnings.length} risk${result.risk_warnings.length !== 1 ? 's' : ''} to watch out for.`);
                            } else if (hasAdvisor) {
                              parts.push(`I also identified ${result.advisor_flags.length} topic${result.advisor_flags.length !== 1 ? 's' : ''} worth discussing with an advisor.`);
                            }

                            return parts.join(' ');
                          })()}
                        </p>
                      </div>
                    </div>
                  </motion.div>

                  {searchMetadata && <SearchSourcesBanner metadata={searchMetadata} />}

                  <div className="flex items-center justify-between mb-4 mt-2">
                    <h2 className="text-[20px] font-semibold text-[var(--ws-text-primary)]">
                      Recommended Actions
                    </h2>
                    <p className="text-[13px] text-[var(--ws-text-secondary)]">
                      {result.quick_actions.length} explicit steps
                      {confirmedActions.size > 0 && (
                        <span className="text-[var(--ws-accent-green)] font-medium">
                          {" "}&middot; {confirmedActions.size} done
                        </span>
                      )}
                    </p>
                  </div>

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
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
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

                  {result.risk_warnings.length > 0 && (
                    <div className="mt-8 flex flex-col gap-3 border-t border-[var(--ws-border)] pt-8">
                      <p className="text-[11px] text-[var(--ws-text-tertiary)] uppercase tracking-wider font-semibold">
                        Risks
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
                  variants={{
                    initial: { opacity: 0, x: tabDirection * 20 },
                    animate: { opacity: 1, x: 0, transition: { type: "spring", bounce: 0, duration: 0.35 } },
                    exit: { opacity: 0, transition: { duration: 0.08 } },
                  }}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="w-full max-w-5xl mx-auto flex flex-col gap-8 sm:gap-12 pt-2"
                >
                  <div>
                    <h2 className="text-[20px] font-semibold text-[var(--ws-text-primary)] mb-6">Financial Impact</h2>
                    <ImpactSummary summary={result.impact_summary} event={event} hideHeader />
                  </div>

                  <div>
                    <h3 className="text-[20px] font-semibold text-[var(--ws-text-primary)] mb-4">Account Changes</h3>
                    <AccountImpactCards impacts={result.account_impacts} />
                  </div>

                  {result.advisor_flags.length > 0 && (
                    <div className="border-t border-[var(--ws-border)] pt-8">
                      <h3 className="text-[20px] font-semibold text-[var(--ws-text-primary)] mb-5">Advisor Flags</h3>
                      <div className="flex flex-col gap-4">
                        {result.advisor_flags.map((flag, i) => (
                          <AdvisorNote key={i} flag={flag} index={i} />
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === "cashflow" && (
                <motion.div
                  key="cashflow"
                  variants={{
                    initial: { opacity: 0, x: tabDirection * 20 },
                    animate: { opacity: 1, x: 0, transition: { type: "spring", bounce: 0, duration: 0.35 } },
                    exit: { opacity: 0, transition: { duration: 0.08 } },
                  }}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="w-full max-w-5xl mx-auto pt-2"
                >
                  <h3 className="text-[20px] font-semibold text-[var(--ws-text-primary)] mb-4">Monthly Cash Flow</h3>
                  <CashflowCard cashflow={result.monthly_cashflow} />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="pt-8 pb-8 flex flex-col items-center gap-4 border-t border-[var(--ws-border)] mt-8 w-full max-w-5xl mx-auto">
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
                New scenario
              </button>
            </div>
          </div>
        </div>
      </div>

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
