"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PathfinderResult, QuickAction, RiskWarning, SearchMetadata, ThinkingStep, DebugLog, FinancialProfile, CustomFund } from "@/lib/types";
import ImpactSummary from "./ImpactSummary";
import AccountImpactCards from "./AccountImpactCards";
import CashflowCard from "./CashflowSidebar";
import ConfirmationSheet from "@/components/ui/ConfirmationSheet";
import WhatIfInput from "./WhatIfInput";

interface PlanViewProps {
  result: PathfinderResult;
  event: string;
  profile: FinancialProfile;
  customFunds: CustomFund[];
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
  do_now: "var(--ws-text-inverse)",
  this_week: "var(--ws-text-inverse)",
  this_month: "var(--ws-text-inverse)",
  next_quarter: "var(--ws-text-tertiary)",
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
      className={`group w-full flex items-start gap-3 sm:gap-4 text-left cursor-pointer transition-all p-3 -mx-3 rounded-[16px] ${action.priority === 'do_now'
        ? 'bg-[var(--ws-bg-primary)] border border-[var(--ws-accent-green)]/30 shadow-[0_4px_24px_rgba(72,102,53,0.12)]'
        : 'bg-transparent hover:bg-[var(--ws-bg-primary)] border border-transparent'
        }`}
      initial={{ opacity: 0, x: -15 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", bounce: 0, duration: 0.6, delay: 0.05 * index }}
      onClick={onTap}
    >
      {/* Icon */}
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 text-[16px] sm:text-[18px] bg-[var(--ws-bg-primary)] text-[var(--ws-text-primary)] border border-[var(--ws-border)]">
        {ACTION_ICONS[action.type]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5 pb-1">
        <p className="font-serif text-[16px] sm:text-[18px] text-[var(--ws-text-primary)] leading-tight tracking-tight mt-0.5 group-hover:text-[var(--ws-text-secondary)] transition-colors">
          {action.title}
        </p>

        <div className="flex flex-col gap-1.5 mt-2">
          {/* Account Details */}
          {(action.from_account || action.to_account) && (
            <div className="flex flex-wrap items-center gap-1.5 text-[12px] font-medium text-[var(--ws-text-primary)]">
              {action.from_account && (
                <span className="px-2 py-0.5 rounded-md bg-[var(--ws-bg-surface)] border border-[var(--ws-border)]">
                  {action.from_account}
                </span>
              )}
              {action.from_account && action.to_account && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-[var(--ws-text-tertiary)] shrink-0">
                  <path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {action.to_account && (
                <span className="px-2 py-0.5 rounded-md bg-[var(--ws-bg-surface)] border border-[var(--ws-border)]">
                  {action.to_account}
                </span>
              )}
              {typeof action.amount === 'number' && action.amount > 0 && (
                <span className="ml-1 text-[var(--ws-accent-green)] font-semibold">
                  ${action.amount.toLocaleString("en-CA")}
                </span>
              )}
            </div>
          )}

          {action.why && (
            <p className="text-[13px] text-[var(--ws-text-secondary)] leading-snug">
              {action.why}
            </p>
          )}

          {action.automation && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 bg-[var(--ws-text-primary)] rounded-md text-[var(--ws-bg-primary)] capitalize tracking-wide">
                Auto &middot; {action.automation.frequency}
              </span>
              {action.automation.duration_months ? (
                <span className="text-[11px] font-medium text-[var(--ws-text-tertiary)]">
                  {action.automation.duration_months}mo
                </span>
              ) : null}
              {action.automation.target_amount ? (
                <span className="text-[11px] font-bold text-[var(--ws-text-primary)]">
                  Target: ${action.automation.target_amount.toLocaleString()}
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Priority badge */}
      <div
        className="flex-shrink-0 mt-0.5 px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-semibold leading-none min-w-[50px] sm:min-w-[60px] text-center"
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

function AnalysisSection({ steps }: { steps: ThinkingStep[] }) {
  if (!steps || steps.length === 0) return null;

  return (
    <motion.div
      className="mb-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <p className="text-[11px] font-semibold text-[var(--ws-text-tertiary)] uppercase tracking-wider mb-3">
        Reasoning
      </p>
      <div className="flex flex-wrap gap-2">
        {steps.map((step, i) => {
          const firstInsight = step.insights?.[0];
          const sentimentColor = firstInsight?.type === 'positive'
            ? 'var(--ws-accent-green)'
            : firstInsight?.type === 'negative'
              ? 'var(--ws-accent-red)'
              : 'var(--ws-text-secondary)';

          return (
            <motion.div
              key={i}
              className="flex items-center gap-2 px-3 py-2 rounded-full bg-[var(--ws-bg-surface)] border border-[var(--ws-border)]"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", bounce: 0, duration: 0.4, delay: 0.05 * i }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: sentimentColor }}
              />
              <span className="text-[12px] text-[var(--ws-text-secondary)] leading-none whitespace-nowrap">
                {step.title}
              </span>
              {firstInsight && (
                <span
                  className="text-[11px] font-medium leading-none whitespace-nowrap"
                  style={{ color: sentimentColor }}
                >
                  {firstInsight.text.length > 30 ? firstInsight.text.slice(0, 28) + '…' : firstInsight.text}
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
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
                        const hostname = new URL(s.url).hostname.replace("www.", "");
                        // Don't show vertex redirect hostnames — use title or generic label
                        domain = hostname.includes("vertexaisearch.cloud.google.com") ? "" : hostname;
                      } catch {
                        domain = "";
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
                          {s.title || domain || "Web Source"}
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
          Log &middot; {log.actionsBeforeGuardrails} &rarr; {log.actionsAfterGuardrails} kept
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

const PRIORITY_ORDER: QuickAction['priority'][] = ['do_now', 'this_week', 'this_month', 'next_quarter'];
const PRIORITY_STEP_LABELS: Record<string, string> = {
  do_now: 'Do Now',
  this_week: 'This Week',
  this_month: 'This Month',
  next_quarter: 'Later',
};

function AnalysisDetailsSheet({
  result,
  event,
  onClose,
}: {
  result: PathfinderResult;
  event: string;
  onClose: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        className="relative w-full max-w-[500px] bg-[var(--ws-bg-surface)] rounded-[24px] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--ws-border)] bg-[var(--ws-bg-primary)]">
          <h3 className="text-[18px] font-bold text-[var(--ws-text-primary)]">Details</h3>
          <button onClick={onClose} className="text-[var(--ws-text-tertiary)] hover:text-[var(--ws-text-primary)] transition-colors p-1 cursor-pointer" title="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-6 overflow-y-auto flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-[var(--ws-bg-primary)] border border-[var(--ws-border)] flex items-center justify-center text-[var(--ws-text-primary)] shadow-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M12 8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <h4 className="text-[16px] font-semibold text-[var(--ws-text-primary)]">Summary</h4>
            </div>
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
                parts.push(`Analyzed ${steps} area${steps !== 1 ? 's' : ''} for "${event}".`);

                if (actions === 1) {
                  parts.push(`1 action${doNow === 1 ? ' — do now' : ''}.`);
                } else {
                  parts.push(`${actions} actions to ${nwDir}${doNow > 0 ? `, ${doNow} urgent` : ''}.`);
                }

                if (hasRisks && hasAdvisor) {
                  parts.push(`${result.risk_warnings.length} risk${result.risk_warnings.length !== 1 ? 's' : ''}, ${result.advisor_flags.length} advisor flag${result.advisor_flags.length !== 1 ? 's' : ''}.`);
                } else if (hasRisks) {
                  parts.push(`${result.risk_warnings.length} risk${result.risk_warnings.length !== 1 ? 's' : ''} flagged.`);
                } else if (hasAdvisor) {
                  parts.push(`${result.advisor_flags.length} advisor topic${result.advisor_flags.length !== 1 ? 's' : ''}.`);
                }

                return parts.join(' ');
              })()}
            </p>
          </div>

          <AnalysisSection steps={result.thinking_steps} />

          {result.risk_warnings.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] text-[var(--ws-text-tertiary)] uppercase tracking-wider font-semibold">
                Risks
              </p>
              {result.risk_warnings.map((w, i) => (
                <RiskBanner key={i} warning={w} index={i} />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function PlanView({ result, event, profile, customFunds, searchMetadata, debugLog, onReset, onApplyActions }: PlanViewProps) {
  const [activeTab, setActiveTab] = useState<"actions" | "impacts" | "cashflow">("actions");
  const [tabDirection, setTabDirection] = useState(1);
  const [selectedAction, setSelectedAction] = useState<QuickAction | null>(null);
  const [confirmedActions, setConfirmedActions] = useState<Set<number>>(new Set());
  const [currentResult, setCurrentResult] = useState<PathfinderResult>(result);
  const [isRefining, setIsRefining] = useState(false);
  const [refinementHistory, setRefinementHistory] = useState<string[]>([]);
  const [showAnalysisDetails, setShowAnalysisDetails] = useState(false);

  const handleRefine = useCallback(async (adjustment: string) => {
    setIsRefining(true);
    try {
      const response = await fetch('/api/pathfinder/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile,
          customFunds,
          originalEvent: event,
          originalResult: currentResult,
          adjustment,
        }),
      });
      const data = await response.json();
      if (data.result) {
        setCurrentResult(data.result);
        setRefinementHistory(prev => [...prev, adjustment]);
        setConfirmedActions(new Set());
      }
    } catch (err) {
      console.error('Refine failed:', err);
    } finally {
      setIsRefining(false);
    }
  }, [profile, customFunds, event, currentResult]);

  const handleTabChange = (tab: "actions" | "impacts" | "cashflow") => {
    setTabDirection(TAB_ORDER[tab] > TAB_ORDER[activeTab] ? 1 : -1);
    setActiveTab(tab);
  };

  const handleActionConfirm = () => {
    if (selectedAction) {
      const idx = currentResult.quick_actions.indexOf(selectedAction);
      if (idx !== -1) {
        setConfirmedActions((prev) => new Set(prev).add(idx));
      }
    }
    setSelectedAction(null);
  };

  return (
    <>
      <div className="pb-8">
        <AnimatePresence>
          {showAnalysisDetails && (
            <AnalysisDetailsSheet
              result={currentResult}
              event={event}
              onClose={() => setShowAnalysisDetails(false)}
            />
          )}
        </AnimatePresence>

        <div className="mx-auto max-w-5xl w-full">
          {/* Sticky Header */}
          <div className="sticky top-0 z-40 bg-[var(--ws-bg-primary)] px-4 sm:px-10 pt-3 sm:pt-4 pb-3 border-b border-[var(--ws-border)]">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-3 sm:mb-4 gap-2 sm:gap-3">
              <div>
                <p className="text-[var(--ws-text-primary)] text-[32px] sm:text-[42px] font-serif tracking-tight leading-[1] mb-0.5 sm:mb-1">
                  Your Plan
                </p>
                <p className="text-[var(--ws-text-secondary)] text-[13px] sm:text-[14px] max-w-xl leading-relaxed truncate">
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

          <div className="px-4 sm:px-10 py-4 sm:py-5 w-full mt-1 sm:mt-2">
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
                  <div className="flex flex-row items-center gap-3 mb-4">
                    {searchMetadata && <SearchSourcesBanner metadata={searchMetadata} />}

                    <button
                      onClick={() => setShowAnalysisDetails(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--ws-bg-primary)] border border-[var(--ws-border)] text-[12px] font-medium text-[var(--ws-text-secondary)] hover:text-[var(--ws-text-primary)] transition-colors w-fit flex-shrink-0 cursor-pointer shadow-sm"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M12 8v8M9 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      Details
                    </button>
                  </div>

                  {/* Refinement badge */}
                  {refinementHistory.length > 0 && (
                    <motion.div
                      className="flex items-center gap-2 mb-4 mt-2"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[var(--ws-accent-green)]/10 text-[var(--ws-accent-green)]">
                        Refined {refinementHistory.length}x
                      </span>
                      <span className="text-[11px] text-[var(--ws-text-tertiary)]">
                        {refinementHistory[refinementHistory.length - 1]}
                      </span>
                    </motion.div>
                  )}

                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-[18px] font-semibold text-[var(--ws-text-primary)]">
                      Actions
                    </h2>
                    <p className="text-[12px] text-[var(--ws-text-secondary)]">
                      {currentResult.quick_actions.length} steps
                      {confirmedActions.size > 0 && (
                        <span className="text-[var(--ws-accent-green)] font-medium">
                          {" "}&middot; {confirmedActions.size} done
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Grouped actions by priority */}
                  <div className="flex flex-col gap-0 border border-[var(--ws-border)] bg-[var(--ws-bg-surface)] p-4 sm:p-5 rounded-[16px] sm:rounded-[20px]">
                    {(() => {
                      const actionGroups = PRIORITY_ORDER
                        .map(priority => ({
                          priority,
                          label: PRIORITY_STEP_LABELS[priority],
                          actions: currentResult.quick_actions
                            .map((action, originalIndex) => ({ action, originalIndex }))
                            .filter(({ action, originalIndex }) => action.priority === priority && !confirmedActions.has(originalIndex)),
                        }))
                        .filter(group => group.actions.length > 0);

                      return actionGroups.map((group, groupIdx) => (
                        <div key={group.priority}>
                          {groupIdx > 0 && (
                            <div className="flex justify-center py-1.5">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[var(--ws-text-tertiary)]">
                                <path d="M12 5v14M12 19l-4-4M12 19l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                          )}
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-6 h-6 rounded-full bg-[var(--ws-bg-primary)] border border-[var(--ws-border)] flex items-center justify-center text-[11px] font-bold text-[var(--ws-text-secondary)]">
                              {groupIdx + 1}
                            </div>
                            <span className="text-[12px] font-semibold text-[var(--ws-text-tertiary)] uppercase tracking-wider">
                              {group.label}
                            </span>
                          </div>
                          <AnimatePresence mode="popLayout">
                            {group.actions.map(({ action, originalIndex }, actionIdx) => {
                              const isLast = actionIdx === group.actions.length - 1;
                              return (
                                <motion.div
                                  key={`pending-${originalIndex}`}
                                  layout
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  transition={{ duration: 0.2 }}
                                  className="relative pl-0 w-full"
                                >
                                  {!isLast && (
                                    <div className="absolute left-[18px] sm:left-[20px] top-[44px] bottom-0 w-[1.5px] bg-[var(--ws-border)] -z-10" />
                                  )}
                                  <ActionCard
                                    action={action}
                                    index={originalIndex}
                                    onTap={() => setSelectedAction(action)}
                                  />
                                </motion.div>
                              );
                            })}
                          </AnimatePresence>
                        </div>
                      ));
                    })()}
                  </div>

                  {confirmedActions.size > 0 && (
                    <motion.div
                      className="mt-5 flex flex-col gap-2"
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
                        {currentResult.quick_actions.map((action, i) => {
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

                  {/* Risks section moved to details sheet */}

                  {/* What-If Refinement Input */}
                  <WhatIfInput onSubmit={handleRefine} isLoading={isRefining} />
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
                    <div className="mb-6">
                      <h2 className="text-[20px] font-semibold text-[var(--ws-text-primary)]">Financial Impact</h2>
                      <p className="text-[13px] text-[var(--ws-text-secondary)] mt-1">What changes if you follow this plan</p>
                    </div>
                    <ImpactSummary summary={currentResult.impact_summary} event={event} hideHeader actions={currentResult.quick_actions} />
                  </div>

                  <div>
                    <h3 className="text-[20px] font-semibold text-[var(--ws-text-primary)] mb-4">Accounts</h3>
                    <AccountImpactCards impacts={currentResult.account_impacts} actions={currentResult.quick_actions} />
                  </div>

                  {currentResult.advisor_flags.length > 0 && (
                    <div className="border-t border-[var(--ws-border)] pt-8">
                      <h3 className="text-[20px] font-semibold text-[var(--ws-text-primary)] mb-5">Advisor</h3>
                      <div className="flex flex-col gap-4">
                        {currentResult.advisor_flags.map((flag, i) => (
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
                  <div className="mb-4">
                    <h3 className="text-[20px] font-semibold text-[var(--ws-text-primary)]">Monthly Cash Flow</h3>
                    <p className="text-[13px] text-[var(--ws-text-secondary)] mt-1">Can you afford this plan?</p>
                  </div>
                  <CashflowCard cashflow={currentResult.monthly_cashflow} actions={currentResult.quick_actions} />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="pt-5 pb-5 flex flex-col items-center gap-3 border-t border-[var(--ws-border)] mt-5 w-full max-w-5xl mx-auto">
              {confirmedActions.size > 0 && (
                <button
                  onClick={() => onApplyActions(Array.from(confirmedActions), currentResult.quick_actions)}
                  className="w-full py-3.5 rounded-full text-[15px] font-semibold cursor-pointer transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{
                    backgroundColor: 'var(--ws-text-primary)',
                    color: 'var(--ws-bg-primary)',
                  }}
                >
                  Apply & Go Back
                </button>
              )}
              <button
                onClick={onReset}
                className="text-[var(--ws-text-tertiary)] text-[14px] underline underline-offset-2 hover:text-[var(--ws-text-secondary)] transition-colors cursor-pointer bg-transparent border-none"
              >
                Start over
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
