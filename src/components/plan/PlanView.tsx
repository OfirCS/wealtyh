"use client";

import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, ChevronLeft, ChevronRight } from "lucide-react";
import AgentLight from "@/components/ui/AgentLight";
import type { CashflowPoint, CustomFund, DebugLog, FinancialProfile, PathfinderResult, QuickAction, SearchMetadata } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { playSound } from "@/lib/sounds";
import { IS_STATIC_DEMO, NO_AI_KEYS } from "@/lib/claude";
import { useElementHeight } from "@/lib/use-element-height";
import AccountImpactCards from "./AccountImpactCards";
import MoneyStages from "./MoneyStages";
import WhatIfInput from "./WhatIfInput";
import Sheet from "@/components/ui/Sheet";

interface PlanViewProps {
  result: PathfinderResult;
  event: string;
  profile: FinancialProfile;
  customFunds: CustomFund[];
  searchMetadata: SearchMetadata | null;
  debugLog: DebugLog | null;
  shareLabel: string;
  onShare: () => void;
  onReset: () => void;
  onApplyActions: (confirmedIndices: number[], actions: QuickAction[]) => void;
}

type DetailTab = "numbers" | "moves" | "watch" | "pro" | "how";

const PRIORITY_ORDER: QuickAction["priority"][] = ["do_now", "this_week", "this_month", "next_quarter"];

const PRIORITY_LABELS: Record<QuickAction["priority"], string> = {
  do_now: "Now",
  this_week: "This week",
  this_month: "This month",
  next_quarter: "Later",
};

/** Each step takes exactly this much height, so the list can page instead of scroll. */
const STEP_HEIGHT = 92;
const APPROVED_PAUSE_MS = 900;

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The one sentence someone came here for: can I afford this? */
function plainAnswer(cashflow: CashflowPoint[]): string {
  if (cashflow.length === 0) return "Here's what I'd do.";
  const first = cashflow[0].amount;
  const lowest = Math.min(...cashflow.map((point) => point.amount));
  if (first < 0) return "You're already spending more than you bring home.";
  if (lowest < 0) return `You'd run about ${formatMoney(-lowest)} a month short for a while.`;
  if (lowest <= first * 0.3) return "You can afford this, but money gets tight for a while.";
  return "Good news. You can comfortably afford this.";
}

/** The same answer in one plain sentence, from the numbers themselves. */
function plainSummary(cashflow: CashflowPoint[]): string {
  if (cashflow.length === 0) return "";
  const first = cashflow[0].amount;
  const lowest = Math.min(...cashflow.map((point) => point.amount));
  const today = first >= 0 ? `You have ${formatMoney(first)} left each month today.` : `You're ${formatMoney(-first)} short each month today.`;
  if (lowest >= first) return `${today} That holds through this plan.`;
  if (lowest < 0) return `${today} At the tightest point you'd be ${formatMoney(-lowest)} short each month.`;
  if (lowest === 0) return `${today} At the tightest point, nothing is left over.`;
  return `${today} At the tightest point that drops to ${formatMoney(lowest)}.`;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--pf-border)] py-2.5 text-[16px]">
      <dt className="text-[var(--pf-text-secondary)]">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function WorkLog({ log, searchMetadata }: { log: DebugLog; searchMetadata: SearchMetadata | null }) {
  const router = log.entries.find((entry) => entry.step === "Router");
  const search = log.entries.find((entry) => entry.step === "Search");
  const sources = searchMetadata?.sources ?? [];
  const removed = log.removedActions;

  const rows = [
    { title: "Read your situation", body: router?.data },
    ...(search ? [{ title: sources.length > 0 ? `Checked ${sources.length} live sources` : "Tried to reach live data", body: sources.length > 0 ? undefined : search.detail }] : []),
    { title: "Drafted a plan", body: `${log.actionsBeforeGuardrails} steps proposed` },
    { title: "Checked every dollar", body: `${log.actionsAfterGuardrails} of ${log.actionsBeforeGuardrails} fit your real balances` },
  ];

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.title}>
            <p className="text-[16px] font-medium">{row.title}</p>
            {row.body && <p className="text-[15px] leading-snug text-[var(--pf-text-secondary)]">{row.body}</p>}
          </li>
        ))}
      </ol>
      {removed.length > 0 && (
        <ul className="flex flex-col gap-1">
          {removed.map((item) => <li key={item} className="text-[14px] text-[var(--pf-text-secondary)]">Removed: {item}</li>)}
        </ul>
      )}
      {sources.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-[var(--pf-border)] pt-3">
          {sources.map((source) => (
            <li key={source.url} className="truncate text-[14px]">
              <a href={source.url} target="_blank" rel="noopener noreferrer" className="pf-link underline decoration-current">
                {source.title || source.url}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PlanView({
  result,
  event,
  profile,
  customFunds,
  searchMetadata,
  debugLog,
  shareLabel,
  onShare,
  onReset,
  onApplyActions,
}: PlanViewProps) {
  const [chosen, setChosen] = useState<ReadonlySet<number>>(() => new Set(result.quick_actions.map((_, index) => index)));
  const [reviewing, setReviewing] = useState(false);
  const [approved, setApproved] = useState(false);
  const [current, setCurrent] = useState<PathfinderResult>(result);
  const [isRefining, setIsRefining] = useState(false);
  const [refineNote, setRefineNote] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [openStep, setOpenStep] = useState<number | null>(null);
  const [changing, setChanging] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab | null>(null);
  const [listRef, listHeight] = useElementHeight<HTMLOListElement>();

  const isLocal = current.source === "local";
  const sourceCount = searchMetadata?.sources.length ?? 0;

  const actions = useMemo(
    () => [...current.quick_actions].sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)),
    [current],
  );

  const perPage = Math.max(1, Math.floor(listHeight / STEP_HEIGHT));
  const pages = Math.max(1, Math.ceil(actions.length / perPage));
  const currentPage = Math.min(page, pages - 1);
  const visible = actions
    .map((action, index) => ({ action, index }))
    .slice(currentPage * perPage, (currentPage + 1) * perPage);

  const toggle = (index: number) => {
    setChosen((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    playSound("tap");
  };

  const approve = () => {
    setApproved(true);
    playSound("complete");
    setTimeout(() => onApplyActions(Array.from(chosen), actions), APPROVED_PAUSE_MS);
  };

  const handleRefine = useCallback(async (adjustment: string) => {
    setIsRefining(true);
    setRefineNote(null);

    const replacePlan = (next: PathfinderResult) => {
      playSound("complete");
      setCurrent(next);
      setChosen(new Set(next.quick_actions.map((_, index) => index)));
      setPage(0);
      setChanging(false);
    };

    const planLocally = async () => {
      const { buildLocalPlan } = await import("@/lib/local-plan");
      await new Promise((resolve) => setTimeout(resolve, 500));
      const next = buildLocalPlan(profile, customFunds, `${event}. ${adjustment}`);
      if (JSON.stringify(next) === JSON.stringify(current)) {
        setRefineNote("That didn't change the plan. Try a new length or dollar amount.");
      } else {
        replacePlan(next);
      }
    };

    try {
      if (IS_STATIC_DEMO) {
        await planLocally();
        return;
      }

      const response = await fetch("/api/pathfinder/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, customFunds, originalEvent: event, originalResult: current, adjustment }),
      });
      const data = await response.json();
      if (data.code === NO_AI_KEYS) await planLocally();
      else if (data.result) replacePlan(data.result);
      else setRefineNote(data.error ?? "Couldn't update the plan. Try again.");
    } catch (error) {
      console.error("Refine failed:", error);
      setRefineNote("Couldn't update the plan. Try again.");
    } finally {
      setIsRefining(false);
    }
  }, [profile, customFunds, event, current]);

  const impact = current.impact_summary;
  const facts = [impact.income_change, impact.expense_change, impact.net_worth_change, impact.timeline]
    .filter((card) => card.value !== "$0");
  const hasMoves = current.account_impacts.some((item) => item.current_balance !== item.projected_balance);

  const detailTabs: { id: DetailTab; label: string }[] = [
    ...(facts.length > 0 ? [{ id: "numbers" as const, label: "The numbers" }] : []),
    ...(hasMoves ? [{ id: "moves" as const, label: "Money moves" }] : []),
    ...(current.risk_warnings.length > 0 ? [{ id: "watch" as const, label: "Watch for" }] : []),
    ...(current.advisor_flags.length > 0 ? [{ id: "pro" as const, label: "Ask a pro" }] : []),
    { id: "how", label: "How I did this" },
  ];
  const selectedStep = openStep !== null ? actions[openStep] : null;

  const chosenSteps = actions.filter((_, index) => chosen.has(index));
  const totalMoved = chosenSteps.reduce((sum, action) => sum + (action.amount && action.amount > 0 ? action.amount : 0), 0);
  const stepWord = chosen.size === 1 ? "step" : "steps";

  return (
    <div className="mx-auto grid h-full min-h-0 w-full max-w-[1280px] grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] gap-x-14 gap-y-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:grid-rows-1">
      <motion.header
        className="flex min-h-0 flex-col justify-center lg:py-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0, duration: 0.6 }}
      >
        <p className="truncate text-[15px] text-[var(--pf-text-secondary)]">{capitalize(event)}</p>
        <h1 className="pf-title-lg mt-1.5 font-serif">{plainAnswer(current.monthly_cashflow)}</h1>
        <p className="mt-3 hidden max-w-[56ch] text-[17px] leading-relaxed text-[var(--pf-text-secondary)] sm:block">{plainSummary(current.monthly_cashflow)}</p>

        <section className="mt-[clamp(14px,3.6vh,36px)] hidden sm:block [@media(max-height:560px)]:hidden" aria-label="Your money each month">
          <MoneyStages cashflow={current.monthly_cashflow} />
        </section>

        <div className="mt-[clamp(12px,3vh,28px)] hidden flex-wrap items-center gap-x-5 gap-y-1 sm:flex">
          {sourceCount > 0 && (
            <button type="button" className="pf-link flex items-center gap-1.5" onClick={() => setDetailTab("how")}>
              <Check size={14} strokeWidth={2.5} className="text-[var(--pf-good)]" /> Checked {sourceCount} live sources
            </button>
          )}
          <button type="button" className="pf-link" onClick={() => setChanging(true)}>Change this plan</button>
          <button type="button" className="pf-link" onClick={() => setDetailTab(detailTabs[0].id)}>See the details</button>
          <button type="button" className="pf-link" onClick={onShare} aria-label="Copy share link">{shareLabel}</button>
          <button type="button" className="pf-link" onClick={onReset}>Start over</button>
        </div>
      </motion.header>

      <motion.section
        className="pf-card flex min-h-0 flex-col p-4 sm:p-5 lg:my-auto lg:max-h-[min(100%,640px)]"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0, duration: 0.6, delay: 0.08 }}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 pb-1">
          <h2 className="flex items-center gap-2 text-[15px] font-medium"><AgentLight /> What I&rsquo;d do</h2>
          {pages > 1 && (
            <span className="flex items-center gap-1.5 text-[13px] text-[var(--pf-text-secondary)]">
              <button type="button" aria-label="Previous steps" disabled={currentPage === 0} className="cursor-pointer disabled:opacity-25" onClick={() => { setPage(currentPage - 1); playSound("tap"); }}><ChevronLeft size={16} /></button>
              {currentPage + 1} of {pages}
              <button type="button" aria-label="More steps" disabled={currentPage === pages - 1} className="cursor-pointer disabled:opacity-25" onClick={() => { setPage(currentPage + 1); playSound("tap"); }}><ChevronRight size={16} /></button>
            </span>
          )}
        </div>

        <ol ref={listRef} className="min-h-[92px] flex-1 overflow-hidden lg:min-h-[276px]">
          {visible.map(({ action, index }) => {
            const isChosen = chosen.has(index);
            return (
              <motion.li
                key={`${action.title}-${index}`}
                className="flex items-center gap-3 border-b border-[var(--pf-border)] last:border-b-0"
                style={{ height: STEP_HEIGHT }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isChosen}
                  aria-label={`${isChosen ? "Leave out" : "Include"}: ${action.title}`}
                  onClick={() => toggle(index)}
                  className={`flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors ${isChosen ? "bg-[var(--pf-text-primary)] text-[var(--pf-text-inverse)]" : "shadow-[inset_0_0_0_1.5px_var(--pf-text-tertiary)]"}`}
                >
                  {isChosen && <Check size={14} strokeWidth={3} />}
                </button>
                <button type="button" className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left" onClick={() => { setOpenStep(index); playSound("tap"); }}>
                  <span className={`min-w-0 flex-1 transition-opacity ${isChosen ? "" : "opacity-45"}`}>
                    <span className="line-clamp-2 text-[16px] font-medium leading-snug">{action.title}</span>
                    <span className="mt-0.5 line-clamp-1 text-[14px] text-[var(--pf-text-secondary)]">{PRIORITY_LABELS[action.priority]} · {action.why}</span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-[var(--pf-text-tertiary)]" />
                </button>
              </motion.li>
            );
          })}
        </ol>

        <div className="shrink-0 pt-3">
          <button type="button" disabled={chosen.size === 0} className="pf-btn pf-btn-primary h-[50px] w-full text-[16px]" onClick={() => { setReviewing(true); playSound("tap"); }}>
            {chosen.size === 0 ? "Pick a step to continue" : `Review ${chosen.size} ${stepWord}`}
            {chosen.size > 0 && <ArrowRight size={17} />}
          </button>
          <p className="mt-2 text-center text-[13px] text-[var(--pf-text-tertiary)]">Nothing happens until you approve. For learning, not financial advice.</p>
        </div>
      </motion.section>

      <AnimatePresence>
        {reviewing && (
          <Sheet title={approved ? "Done" : "Review your plan"} onClose={() => { if (!approved) setReviewing(false); }}>
            {approved ? (
              <div className="flex flex-col items-center py-6 text-center">
                <motion.span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--pf-good)] text-[var(--pf-text-inverse)]" initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.4, duration: 0.5 }}><Check size={26} strokeWidth={3} /></motion.span>
                <p className="mt-4 font-serif text-[26px] leading-tight">Your plan is saved.</p>
                <p className="mt-1 text-[15px] text-[var(--pf-text-secondary)]">I&rsquo;ll keep an eye on it from here.</p>
              </div>
            ) : (
              <>
                <ul>
                  {chosenSteps.map((action) => (
                    <li key={action.title} className="flex items-start justify-between gap-4 border-b border-[var(--pf-border)] py-3 last:border-b-0">
                      <span className="min-w-0">
                        <span className="block text-[16px] font-medium leading-snug">{action.title}</span>
                        <span className="text-[14px] text-[var(--pf-text-secondary)]">
                          {[action.from_account, action.to_account].filter(Boolean).join(" to ") || PRIORITY_LABELS[action.priority]}
                        </span>
                      </span>
                      {typeof action.amount === "number" && action.amount > 0 && <span className="shrink-0 font-serif text-[20px] leading-tight">{formatMoney(action.amount)}</span>}
                    </li>
                  ))}
                </ul>
                {totalMoved > 0 && (
                  <div className="mt-1 flex items-baseline justify-between border-t border-[var(--pf-text-primary)] pt-3">
                    <span className="text-[15px] font-medium">Total</span>
                    <span className="font-serif text-[24px] leading-none">{formatMoney(totalMoved)}</span>
                  </div>
                )}
                <p className="mt-3 rounded-[12px] bg-[var(--pf-bg-primary)] px-3.5 py-2.5 text-[14px] leading-snug text-[var(--pf-text-secondary)]">
                  Pathfinder doesn&rsquo;t move real money. Approving saves this plan and updates your numbers here, so you can make the moves yourself.
                </p>
                <div className="mt-4 flex gap-2.5">
                  <button type="button" className="pf-btn pf-btn-secondary h-[50px] flex-1" onClick={() => setReviewing(false)}>Go back</button>
                  <button type="button" className="pf-btn pf-btn-primary h-[50px] flex-[2]" onClick={approve}>Approve</button>
                </div>
              </>
            )}
          </Sheet>
        )}

        {selectedStep && (
          <Sheet title={selectedStep.title} onClose={() => setOpenStep(null)}>
            {selectedStep.why && <p className="text-[17px] leading-relaxed text-[var(--pf-text-secondary)]">{selectedStep.why}</p>}
            <dl className="mt-3">
              {selectedStep.from_account && <Detail label="From" value={selectedStep.from_account} />}
              {selectedStep.to_account && <Detail label="To" value={selectedStep.to_account} />}
              {typeof selectedStep.amount === "number" && selectedStep.amount > 0 && <Detail label="Amount" value={formatMoney(selectedStep.amount)} />}
              {selectedStep.automation && <Detail label={`Every ${selectedStep.automation.frequency === "monthly" ? "month" : selectedStep.automation.frequency === "weekly" ? "week" : "two weeks"}`} value={formatMoney(selectedStep.automation.amount)} />}
              {selectedStep.automation?.duration_months && <Detail label="For" value={`${selectedStep.automation.duration_months} month${selectedStep.automation.duration_months === 1 ? "" : "s"}`} />}
              {selectedStep.automation?.target_amount && <Detail label="Until you reach" value={formatMoney(selectedStep.automation.target_amount)} />}
            </dl>
            {selectedStep.derived_from && <p className="mt-3 text-[15px] leading-relaxed text-[var(--pf-text-tertiary)]">How I got this: {selectedStep.derived_from}</p>}
            <p className="mt-3 text-[14px] text-[var(--pf-text-tertiary)]">No real money moves. Saving only updates your numbers here.</p>
          </Sheet>
        )}

        {changing && (
          <Sheet title="Change this plan" onClose={() => setChanging(false)}>
            <WhatIfInput
              onSubmit={handleRefine}
              isLoading={isRefining}
              hint={refineNote ?? (isLocal ? "Try a new length or dollar amount." : undefined)}
            />
          </Sheet>
        )}

        {detailTab && (
          <Sheet title="The details" onClose={() => setDetailTab(null)}>
            <div className="mb-4 flex flex-wrap gap-2">
              {detailTabs.map((tab) => (
                <button key={tab.id} type="button" className="pf-pill" aria-pressed={detailTab === tab.id} onClick={() => { setDetailTab(tab.id); playSound("tap"); }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {detailTab === "numbers" && (
              <dl>{facts.map((card) => <Detail key={card.label} label={card.label} value={card.value} />)}</dl>
            )}
            {detailTab === "moves" && <AccountImpactCards impacts={current.account_impacts} />}
            {detailTab === "watch" && (
              <ul className="flex flex-col gap-2">
                {current.risk_warnings.map((warning) => (
                  <li key={warning.text} className="text-[16px] leading-relaxed text-[var(--pf-text-secondary)]">{warning.text}</li>
                ))}
              </ul>
            )}
            {detailTab === "pro" && (
              <ul className="flex flex-col gap-4">
                {current.advisor_flags.map((flag) => (
                  <li key={flag.title}>
                    <p className="text-[16px] font-medium">{flag.title}</p>
                    <p className="mt-0.5 text-[16px] leading-relaxed text-[var(--pf-text-secondary)]">{flag.explanation}</p>
                  </li>
                ))}
              </ul>
            )}
            {detailTab === "how" && (
              <div className="flex flex-col gap-3">
                {isLocal ? (
                  <p className="text-[16px] leading-relaxed text-[var(--pf-text-secondary)]">
                    From your numbers and built-in Canadian rules, without AI or live rates. Tax is a rough estimate.
                  </p>
                ) : debugLog ? (
                  <WorkLog log={debugLog} searchMetadata={searchMetadata} />
                ) : (
                  <p className="text-[16px] leading-relaxed text-[var(--pf-text-secondary)]">This plan was shared with you, so its working notes aren&rsquo;t included.</p>
                )}
                <p className="text-[14px] leading-relaxed text-[var(--pf-text-tertiary)]">For learning, not financial advice. Check with a professional before any big move.</p>
              </div>
            )}
          </Sheet>
        )}
      </AnimatePresence>
    </div>
  );
}
