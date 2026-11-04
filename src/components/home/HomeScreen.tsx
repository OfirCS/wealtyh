"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getDynamicSuggestionChips } from "@/lib/defaults";
import { formatMoney, formatSigned, getMoneyPicture } from "@/lib/money";
import type { AppliedSummary, CustomFund, FinancialProfile } from "@/lib/types";
import PromptInput from "@/components/prompt/PromptInput";
import { Ticking } from "@/components/ui/Ticking";
import Sheet from "@/components/ui/Sheet";
import Footer from "@/components/ui/Footer";
import NumbersList from "./NumbersList";
import SampleSheet from "./SampleSheet";

interface HomeScreenProps {
  profile: FinancialProfile;
  customFunds: CustomFund[];
  hasNumbers: boolean;
  appliedSummary?: AppliedSummary;
  onProfileChange: (profile: FinancialProfile) => void;
  onCustomFundsChange: (customFunds: CustomFund[]) => void;
  onSubmit: (event: string) => void;
  onUseSample: () => void;
  /** Left to spend this month, when a budget exists. */
  budgetLeft: number | null;
  onOpenBudget: () => void;
}

const FIRST_CHIPS = [
  { label: "Having a baby", prompt: "We're having a baby", emoji: "" },
  { label: "Buying a first home", prompt: "Buying my first home", emoji: "" },
  { label: "Taking a career break", prompt: "Taking a 6 month career break", emoji: "" },
  { label: "Paying off debt", prompt: "I want to pay off my debt", emoji: "" },
  { label: "Lost my job", prompt: "I got laid off", emoji: "" },
];

const BALANCE_LABELS: Record<string, string> = {
  chequingBalance: "Chequing",
  savingsBalance: "Savings",
  tfsaBalance: "TFSA",
  rrspBalance: "RRSP",
  fhsaBalance: "FHSA",
  nonRegBalance: "Other investments",
};

export default function HomeScreen({
  profile,
  customFunds,
  hasNumbers,
  appliedSummary,
  onProfileChange,
  onCustomFundsChange,
  onSubmit,
  onUseSample,
  budgetLeft,
  onOpenBudget,
}: HomeScreenProps) {
  const [summaryVisible, setSummaryVisible] = useState(true);
  const [showNumbers, setShowNumbers] = useState(false);
  const money = getMoneyPicture(profile, customFunds);
  const chips = useMemo(
    () => (hasNumbers ? getDynamicSuggestionChips(profile, customFunds, 5) : FIRST_CHIPS),
    [hasNumbers, profile, customFunds],
  );

  const changes = useMemo(() => {
    if (!appliedSummary) return [];
    return [
      ...Object.entries(appliedSummary.balanceChanges).map(([field, delta]) => `${BALANCE_LABELS[field] ?? field} ${formatSigned(delta ?? 0)}`),
      ...Object.entries(appliedSummary.fundChanges).map(([name, delta]) => `${name} ${formatSigned(delta)}`),
    ];
  }, [appliedSummary]);

  const showSummary = summaryVisible && !!appliedSummary && appliedSummary.actions.length > 0;

  if (!hasNumbers) {
    return (
      <div className="grid h-full min-h-0 items-center gap-x-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", bounce: 0, duration: 0.8 }}>
          <h1 className="pf-title-xl font-serif">What&rsquo;s changing in your life?</h1>
          <p className="mt-4 max-w-[500px] text-[17px] leading-relaxed text-[var(--pf-text-secondary)] sm:text-[18px]">
            Tell Pathfinder and show it your spending. No passwords, no bank login, no typing in numbers.
          </p>
          <div className="mt-[clamp(20px,5vh,40px)]">
            <PromptInput onSubmit={onSubmit} chips={chips} placeholder="We're having a baby in the spring" autoFocus />
          </div>
          <p className="mt-6 text-[14px] text-[var(--pf-text-tertiary)]">
            Free, with no signup.{" "}
            <button type="button" className="pf-link underline decoration-current" onClick={onUseSample}>Try it with sample numbers</button>
          </p>
        </motion.div>
        <SampleSheet onOpen={onOpenBudget} />
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 gap-x-16 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-h-0 flex-col justify-center gap-[clamp(20px,4.5vh,44px)]">
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", bounce: 0, duration: 0.7 }}>
          <p className="text-[15px] text-[var(--pf-text-secondary)]">Your money</p>
          <h1 className="pf-amount mt-1 font-serif">
            <Ticking value={money.totalMoney} format={formatMoney} />
          </h1>
          <p className="mt-3 text-[16px] text-[var(--pf-text-secondary)]">
            {money.leftOver >= 0
              ? <><span className="text-[var(--pf-text-primary)]">{formatMoney(money.leftOver)}</span> left each month</>
              : <><span className="text-[var(--pf-text-primary)]">{formatMoney(-money.leftOver)}</span> short each month</>}
            {" · "}cash lasts <span className="text-[var(--pf-text-primary)]">{money.runwayMonths.toFixed(1)} months</span>
          </p>
          {budgetLeft !== null && (
            <button type="button" className="pf-link mt-1 text-[16px]" onClick={onOpenBudget}>
              {budgetLeft >= 0 ? `${formatMoney(budgetLeft)} left in this month's budget` : `${formatMoney(-budgetLeft)} over this month's budget`} →
            </button>
          )}

          <AnimatePresence>
            {showSummary && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="mt-4 flex items-start justify-between gap-4 rounded-[14px] bg-[var(--pf-bg-elevated)] p-4">
                  <div>
                    <p className="text-[15px] font-semibold">✓ Your plan is saved</p>
                    {changes.length > 0 && <p className="mt-1 line-clamp-2 text-[14px] text-[var(--pf-text-secondary)]">{changes.join(" · ")}</p>}
                  </div>
                  <button type="button" className="pf-link shrink-0" aria-label="Dismiss" onClick={() => setSummaryVisible(false)}>Close</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        <section>
          <h2 className="mb-3 font-serif text-[clamp(22px,3.6vh,32px)] leading-tight">What&rsquo;s changing?</h2>
          <PromptInput onSubmit={onSubmit} chips={chips} placeholder="Tell me what's coming up" />
        </section>

        <button type="button" className="pf-link self-start lg:hidden" onClick={() => setShowNumbers(true)}>See my numbers</button>
      </div>

      <aside className="hidden min-h-0 flex-col justify-center lg:flex">
        <NumbersList
          compact
          profile={profile}
          customFunds={customFunds}
          onProfileChange={onProfileChange}
          onCustomFundsChange={onCustomFundsChange}
          onShowAll={() => setShowNumbers(true)}
        />
        <p className="mt-5 text-[13px] leading-relaxed text-[var(--pf-text-tertiary)]">
          For learning, not financial advice.
        </p>
        <div className="mt-1"><Footer /></div>
      </aside>

      <AnimatePresence>
        {showNumbers && (
          <Sheet title="Your numbers" onClose={() => setShowNumbers(false)}>
            <NumbersList
              profile={profile}
              customFunds={customFunds}
              onProfileChange={onProfileChange}
              onCustomFundsChange={onCustomFundsChange}
            />
          </Sheet>
        )}
      </AnimatePresence>
    </div>
  );
}
