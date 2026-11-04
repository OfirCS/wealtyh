"use client";

import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { CashflowPoint, CustomFund, DebugLog, FinancialProfile, PathfinderResult, QuickAction, SearchMetadata } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { playSound } from "@/lib/sounds";
import { IS_STATIC_DEMO, NO_AI_KEYS } from "@/lib/claude";
import { useElementHeight } from "@/lib/use-element-height";
import AccountImpactCards from "./AccountImpactCards";
import MoneyStages from "./MoneyStages";
import WhatIfInput from "./WhatIfInput";
import Sheet from "@/components/ui/Sheet";
import SponsorSlot from "@/components/ui/SponsorSlot";

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
const STEP_HEIGHT = 104;

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
  const [added, setAdded] = useState<ReadonlySet<number>>(new Set());
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
    setAdded((previous) => {
      const next = new Set(previous);
      if (next.has(index)) {
        next.delete(index);
        playSound("tap");
      } else {
        next.add(index);
        playSound("success");
      }
      return next;
    });
  };

  const handleRefine = useCallback(async (adjustment: string) => {
    setIsRefining(true);
    setRefineNote(null);

    const replacePlan = (next: PathfinderResult) => {
      playSound("complete");
      setCurrent(next);
      setAdded(new Set());
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
  const lead = current.thinking_steps.at(-1)?.insights?.[0]?.text;
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

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto] gap-y-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:grid-rows-[minmax(0,1fr)_auto] lg:gap-x-16">
      <motion.header
        className="flex min-h-0 flex-col justify-center"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0, duration: 0.6 }}
      >
        <p className="truncate text-[15px] text-[var(--pf-text-secondary)]">{capitalize(event)}</p>
        <h1 className="pf-title-lg mt-1 font-serif">{plainAnswer(current.monthly_cashflow)}</h1>
        {lead && <p className="mt-3 hidden text-[17px] leading-relaxed text-[var(--pf-text-secondary)] lg:line-clamp-3 [@media(max-height:720px)]:hidden">{lead}</p>}
        {sourceCount > 0 && (
          <button type="button" className="pf-link mt-2 self-start" onClick={() => setDetailTab("how")}>
            ✓ Checked {sourceCount} live sources
          </button>
        )}
        <section className="mt-[clamp(10px,2.4vh,24px)] rounded-[18px] bg-[var(--pf-bg-elevated)] p-4 sm:p-5" aria-label="Your money each month">
          <MoneyStages cashflow={current.monthly_cashflow} />
        </section>
      </motion.header>

      <section className="flex min-h-0 flex-col lg:justify-center lg:py-2">
        <div className="flex shrink-0 items-baseline justify-between border-b border-[var(--pf-text-primary)] pb-2">
          <h2 className="font-serif text-[24px]">What to do</h2>
          <div className="flex items-baseline gap-4">
            {pages > 1 && (
              <span className="flex items-center gap-3 text-[14px] text-[var(--pf-text-secondary)]">
                <button type="button" aria-label="Previous steps" disabled={currentPage === 0} className="cursor-pointer disabled:opacity-25" onClick={() => { setPage(currentPage - 1); playSound("tap"); }}>←</button>
                {currentPage + 1} of {pages}
                <button type="button" aria-label="More steps" disabled={currentPage === pages - 1} className="cursor-pointer disabled:opacity-25" onClick={() => { setPage(currentPage + 1); playSound("tap"); }}>→</button>
              </span>
            )}
            {actions.length > 1 && (
              <button
                type="button"
                className="pf-link"
                onClick={() => {
                  if (added.size === actions.length) {
                    setAdded(new Set());
                    playSound("tap");
                  } else {
                    setAdded(new Set(actions.map((_, index) => index)));
                    playSound("success");
                  }
                }}
              >
                {added.size === actions.length ? "Remove all" : "Add all"}
              </button>
            )}
          </div>
        </div>
        <ol ref={listRef} className="min-h-0 flex-1 lg:max-h-[calc(5*104px)] overflow-hidden">
          {visible.map(({ action, index }) => {
            const isAdded = added.has(index);
            return (
              <motion.li
                key={`${action.title}-${index}`}
                className="flex items-center gap-4 border-b border-[var(--pf-border)]"
                style={{ height: STEP_HEIGHT }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              >
                <button type="button" className="min-w-0 flex-1 cursor-pointer text-left" onClick={() => { setOpenStep(index); playSound("tap"); }}>
                  <span className="block text-[13px] text-[var(--pf-text-tertiary)]">{PRIORITY_LABELS[action.priority]}</span>
                  <span className={`line-clamp-2 font-serif text-[20px] leading-[1.15] transition-opacity ${isAdded ? "opacity-40" : ""}`}>{action.title}</span>
                  <span className="mt-0.5 line-clamp-1 text-[14px] text-[var(--pf-text-secondary)]">{action.why}</span>
                </button>
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  aria-pressed={isAdded}
                  aria-label={`${isAdded ? "Remove from plan:" : "Add to plan:"} ${action.title}`}
                  className={`pf-btn h-10 w-[92px] shrink-0 px-0 text-[14px] ${isAdded ? "pf-btn-primary" : "pf-btn-secondary"}`}
                >
                  {isAdded ? "✓ Added" : "Add"}
                </button>
              </motion.li>
            );
          })}
        </ol>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-[var(--pf-border)] pt-3 lg:col-span-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <button type="button" className="pf-link" onClick={() => setChanging(true)}>Change this plan</button>
          <button type="button" className="pf-link" onClick={() => setDetailTab(detailTabs[0].id)}>See the details</button>
          <button type="button" className="pf-link" onClick={onShare} aria-label="Copy share link">{shareLabel}</button>
          <button type="button" className="pf-link" onClick={onReset}>Start over</button>
        </div>
        {added.size > 0 ? (
          <button
            type="button"
            className="pf-btn pf-btn-primary h-11"
            onClick={() => {
              playSound("complete");
              onApplyActions(Array.from(added), actions);
            }}
          >
            Save my plan
          </button>
        ) : (
          <p className="text-[13px] text-[var(--pf-text-tertiary)]">For learning, not financial advice.</p>
        )}
      </footer>

      <AnimatePresence>
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
                <SponsorSlot />
                <p className="text-[14px] leading-relaxed text-[var(--pf-text-tertiary)]">For learning, not financial advice. Check with a professional before any big move.</p>
              </div>
            )}
          </Sheet>
        )}
      </AnimatePresence>
    </div>
  );
}
