"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getDynamicSuggestionChips } from "@/lib/defaults";
import { formatMoney, formatSigned, getMoneyPicture } from "@/lib/money";
import type { AppliedSummary, CustomFund, FinancialProfile } from "@/lib/types";
import PromptInput from "@/components/prompt/PromptInput";
import { Ticking } from "@/components/ui/Ticking";
import Sheet from "@/components/ui/Sheet";
import NumbersList from "./NumbersList";

interface HomeScreenProps {
  /** Without real numbers there's nothing true to show yet, so this only asks. */
  hasNumbers: boolean;
  profile: FinancialProfile;
  customFunds: CustomFund[];
  appliedSummary?: AppliedSummary;
  onProfileChange: (profile: FinancialProfile) => void;
  onCustomFundsChange: (customFunds: CustomFund[]) => void;
  onSubmit: (event: string) => void;
}

const BALANCE_LABELS: Record<string, string> = {
  chequingBalance: "Chequing",
  savingsBalance: "Savings",
  tfsaBalance: "TFSA",
  rrspBalance: "RRSP",
  fhsaBalance: "FHSA",
  nonRegBalance: "Other investments",
};

export default function HomeScreen({
  hasNumbers,
  profile,
  customFunds,
  appliedSummary,
  onProfileChange,
  onCustomFundsChange,
  onSubmit,
}: HomeScreenProps) {
  const [summaryVisible, setSummaryVisible] = useState(true);
  const [showNumbers, setShowNumbers] = useState(false);
  const money = getMoneyPicture(profile, customFunds);
  const chips = useMemo(() => getDynamicSuggestionChips(profile, customFunds, 5), [profile, customFunds]);

  const changes = useMemo(() => {
    if (!appliedSummary) return [];
    return [
      ...Object.entries(appliedSummary.balanceChanges).map(([field, delta]) => `${BALANCE_LABELS[field] ?? field} ${formatSigned(delta ?? 0)}`),
      ...Object.entries(appliedSummary.fundChanges).map(([name, delta]) => `${name} ${formatSigned(delta)}`),
    ];
  }, [appliedSummary]);

  const showSummary = summaryVisible && !!appliedSummary && appliedSummary.actions.length > 0;

  return (
    <div className={`grid h-full min-h-0 gap-x-16 ${hasNumbers ? "lg:grid-cols-[minmax(0,1fr)_380px]" : "mx-auto max-w-[640px]"}`}>
      <div className="flex min-h-0 flex-col justify-center gap-[clamp(20px,4.5vh,44px)]">
        {hasNumbers && (
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", bounce: 0, duration: 0.7 }}>
          <p className="text-[15px] text-[var(--pf-text-secondary)]">Your money</p>
          <h1 className="pf-amount mt-1 font-serif">
            <Ticking value={money.totalMoney} format={formatMoney} />
          </h1>
          <p className="mt-3 text-[16px] text-[var(--pf-text-secondary)]">
            {money.leftOver >= 0
              ? <><span className="text-[var(--pf-text-primary)]">{formatMoney(money.leftOver)}</span> not budgeted each month</>
              : <><span className="text-[var(--pf-text-primary)]">{formatMoney(-money.leftOver)}</span> short each month</>}
            {" · "}cash lasts <span className="text-[var(--pf-text-primary)]">{money.runwayMonths.toFixed(1)} months</span>
          </p>

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

        )}

        <section>
          <h2 className="mb-3 font-serif text-[clamp(22px,3.6vh,32px)] leading-tight">What&rsquo;s changing?</h2>
          <PromptInput onSubmit={onSubmit} chips={hasNumbers ? chips : []} placeholder="Tell me what's coming up" />
        </section>

        {hasNumbers && <button type="button" className="pf-link self-start lg:hidden" onClick={() => setShowNumbers(true)}>See my numbers</button>}
      </div>

      {hasNumbers && <aside className="hidden min-h-0 flex-col justify-center lg:flex">
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
      </aside>}

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
