"use client";

import { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { FinancialProfile } from "@/lib/types";

interface OnboardingScreenProps {
  initialProfile: FinancialProfile;
  onComplete: (profile: FinancialProfile) => void;
  onSkip: () => void;
}

type TemplateId = "starter" | "saver" | "buyer" | "family" | "blank";

interface Template {
  id: TemplateId;
  emoji: string;
  title: string;
  hint: string;
  apply: (p: FinancialProfile) => FinancialProfile;
}

const TEMPLATES: Template[] = [
  {
    id: "starter",
    emoji: "🌱",
    title: "Just starting",
    hint: "First job, paying off school, building savings",
    apply: (p) => ({
      ...p,
      annualIncome: 45000,
      employmentType: "employed",
      chequingBalance: 1500,
      savingsBalance: 1000,
      tfsaBalance: 500,
      tfsaRoom: 7000,
      rrspRoom: 8000,
      housingType: "rent",
      housingExpense: 1400,
      essentialExpenses: 700,
      discretionarySpending: 400,
      debtPayments: 200,
      creditCardBalance: 0,
    }),
  },
  {
    id: "saver",
    emoji: "💰",
    title: "Saving up",
    hint: "Building a buffer, no big purchase yet",
    apply: (p) => ({
      ...p,
      annualIncome: 70000,
      employmentType: "employed",
      chequingBalance: 4000,
      savingsBalance: 8000,
      tfsaBalance: 12000,
      tfsaRoom: 7000,
      rrspRoom: 12600,
      housingType: "rent",
      housingExpense: 1800,
      essentialExpenses: 900,
      discretionarySpending: 600,
      debtPayments: 0,
      creditCardBalance: 0,
    }),
  },
  {
    id: "buyer",
    emoji: "🏠",
    title: "First-time buyer",
    hint: "Saving for a down payment",
    apply: (p) => ({
      ...p,
      annualIncome: 90000,
      employmentType: "employed",
      chequingBalance: 5000,
      savingsBalance: 15000,
      tfsaBalance: 20000,
      tfsaRoom: 7000,
      fhsaBalance: 8000,
      rrspBalance: 12000,
      rrspRoom: 16200,
      housingType: "rent",
      housingExpense: 2100,
      essentialExpenses: 1000,
      discretionarySpending: 600,
      debtPayments: 200,
      creditCardBalance: 0,
    }),
  },
  {
    id: "family",
    emoji: "👨‍👩‍👧",
    title: "Family mode",
    hint: "Kids, partners, big plans",
    apply: (p) => ({
      ...p,
      annualIncome: 75000,
      partnerIncome: 60000,
      employmentType: "employed",
      chequingBalance: 6000,
      savingsBalance: 10000,
      tfsaBalance: 18000,
      tfsaRoom: 7000,
      rrspBalance: 22000,
      rrspRoom: 13500,
      housingType: "own",
      housingExpense: 2400,
      mortgageBalance: 380000,
      essentialExpenses: 1500,
      discretionarySpending: 800,
      debtPayments: 300,
      creditCardBalance: 0,
    }),
  },
  {
    id: "blank",
    emoji: "✨",
    title: "Start blank",
    hint: "I'll fill in my own numbers",
    apply: (p) => p,
  },
];

const PROVINCES = [
  { value: "AB", label: "Alberta" },
  { value: "BC", label: "British Columbia" },
  { value: "MB", label: "Manitoba" },
  { value: "NB", label: "New Brunswick" },
  { value: "NL", label: "Newfoundland & Labrador" },
  { value: "NS", label: "Nova Scotia" },
  { value: "NT", label: "Northwest Territories" },
  { value: "NU", label: "Nunavut" },
  { value: "ON", label: "Ontario" },
  { value: "PE", label: "Prince Edward Island" },
  { value: "QC", label: "Quebec" },
  { value: "SK", label: "Saskatchewan" },
  { value: "YT", label: "Yukon" },
];

function fmt(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString("en-CA")}`;
  return `$${n}`;
}

export default function OnboardingScreen({ initialProfile, onComplete, onSkip }: OnboardingScreenProps) {
  const [step, setStep] = useState<0 | 1>(0);
  const [picked, setPicked] = useState<TemplateId | null>(null);
  const [draft, setDraft] = useState<FinancialProfile>(initialProfile);

  const pickTemplate = useCallback(
    (id: TemplateId) => {
      setPicked(id);
      const t = TEMPLATES.find((x) => x.id === id)!;
      const next = t.apply({ ...initialProfile });
      setDraft(next);
      // small delay so the user sees the highlight
      setTimeout(() => setStep(1), 280);
    },
    [initialProfile],
  );

  const update = useCallback(<K extends keyof FinancialProfile>(key: K, value: FinancialProfile[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  }, []);

  const monthlyExpenses = useMemo(
    () => draft.housingExpense + draft.essentialExpenses + draft.discretionarySpending + draft.debtPayments,
    [draft],
  );

  const totalSaved = useMemo(
    () =>
      draft.chequingBalance +
      draft.savingsBalance +
      draft.tfsaBalance +
      draft.fhsaBalance +
      draft.rrspBalance +
      draft.nonRegBalance,
    [draft],
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-6 sm:py-10 overflow-y-auto"
      style={{
        background:
          "radial-gradient(1200px 600px at 20% 10%, rgba(43,122,66,0.10), transparent 60%), radial-gradient(900px 500px at 90% 90%, rgba(18,18,18,0.06), transparent 60%), #FBFAF7",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", bounce: 0, duration: 0.5 }}
        className="w-full max-w-[560px] bg-white rounded-[28px] border border-[var(--ws-border)] shadow-[0_24px_70px_rgba(0,0,0,0.12)] overflow-hidden"
      >
        {/* Header */}
        <div className="px-7 pt-7 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {[0, 1].map((i) => (
              <span
                key={i}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === step ? 28 : 14,
                  backgroundColor: i <= step ? "var(--ws-text-primary)" : "var(--ws-border)",
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="text-[12px] font-medium text-[var(--ws-text-tertiary)] hover:text-[var(--ws-text-primary)] transition-colors cursor-pointer"
          >
            Skip
          </button>
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="step-0"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.25 }}
              className="px-7 pb-7"
            >
              <div className="mb-5">
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--ws-text-tertiary)] mb-2">
                  Welcome
                </p>
                <h1 className="text-[28px] sm:text-[32px] leading-[1.1] font-serif tracking-tight text-[var(--ws-text-primary)] mb-2">
                  Let&rsquo;s get you set up in 30 seconds.
                </h1>
                <p className="text-[14px] leading-relaxed text-[var(--ws-text-secondary)]">
                  Pick the option that&rsquo;s closest to you. We&rsquo;ll fill in rough numbers — you can edit anything next.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {TEMPLATES.map((t) => {
                  const isPicked = picked === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => pickTemplate(t.id)}
                      className="text-left rounded-[18px] p-4 border transition-all duration-200 cursor-pointer hover:translate-y-[-2px] hover:shadow-[0_8px_22px_rgba(0,0,0,0.08)]"
                      style={{
                        borderColor: isPicked ? "var(--ws-text-primary)" : "var(--ws-border)",
                        backgroundColor: isPicked ? "var(--ws-text-primary)" : "var(--ws-bg-primary)",
                        color: isPicked ? "var(--ws-bg-primary)" : "var(--ws-text-primary)",
                      }}
                    >
                      <div className="text-[22px] mb-1.5">{t.emoji}</div>
                      <div className="text-[15px] font-semibold mb-0.5">{t.title}</div>
                      <div
                        className="text-[12px] leading-snug"
                        style={{ color: isPicked ? "rgba(255,255,255,0.75)" : "var(--ws-text-tertiary)" }}
                      >
                        {t.hint}
                      </div>
                    </button>
                  );
                })}
              </div>

              <p className="text-[11px] text-[var(--ws-text-tertiary)] mt-5 leading-relaxed">
                🔒 Nothing leaves your browser. No accounts, no signup, no bank link.
              </p>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.25 }}
              className="px-7 pb-7"
            >
              <div className="mb-5">
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--ws-text-tertiary)] mb-2">
                  Quick numbers
                </p>
                <h2 className="text-[24px] sm:text-[26px] leading-[1.15] font-serif tracking-tight text-[var(--ws-text-primary)] mb-2">
                  A rough picture is enough.
                </h2>
                <p className="text-[14px] leading-relaxed text-[var(--ws-text-secondary)]">
                  Slide to a ballpark. You can fine-tune later — and you don&rsquo;t need to be exact.
                </p>
              </div>

              <div className="space-y-5">
                {/* Province */}
                <div>
                  <label className="text-[12px] font-semibold uppercase tracking-wider text-[var(--ws-text-tertiary)] mb-1.5 block">
                    Where do you live?
                  </label>
                  <div className="relative">
                    <select
                      value={draft.province}
                      onChange={(e) => update("province", e.target.value)}
                      className="w-full appearance-none rounded-[14px] border border-[var(--ws-border)] bg-[var(--ws-bg-surface)] px-4 py-3 pr-10 text-[15px] font-medium text-[var(--ws-text-primary)] focus:outline-none focus:border-[var(--ws-text-primary)] cursor-pointer"
                    >
                      {PROVINCES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <svg
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                      width="14"
                      height="14"
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                <SoftSlider
                  label="Income (yearly)"
                  value={draft.annualIncome}
                  min={0}
                  max={250000}
                  step={2500}
                  display={(v) => (v === 0 ? "Skip" : `${fmt(v)}/yr`)}
                  onChange={(v) => update("annualIncome", v)}
                />

                <SoftSlider
                  label="Total saved (rough)"
                  value={totalSaved}
                  min={0}
                  max={300000}
                  step={500}
                  display={(v) => (v === 0 ? "Nothing yet" : fmt(v))}
                  onChange={(v) => {
                    // Distribute proportionally across existing balances; if all zero, dump into savings.
                    const cur = totalSaved;
                    if (cur === 0) {
                      update("savingsBalance", v);
                    } else {
                      const ratio = v / cur;
                      setDraft((d) => ({
                        ...d,
                        chequingBalance: Math.round(d.chequingBalance * ratio),
                        savingsBalance: Math.round(d.savingsBalance * ratio),
                        tfsaBalance: Math.round(d.tfsaBalance * ratio),
                        fhsaBalance: Math.round(d.fhsaBalance * ratio),
                        rrspBalance: Math.round(d.rrspBalance * ratio),
                        nonRegBalance: Math.round(d.nonRegBalance * ratio),
                      }));
                    }
                  }}
                />

                <SoftSlider
                  label="Rent or mortgage (monthly)"
                  value={draft.housingExpense}
                  min={0}
                  max={6000}
                  step={50}
                  display={(v) => (v === 0 ? "None" : `${fmt(v)}/mo`)}
                  onChange={(v) => update("housingExpense", v)}
                />

                <div className="flex items-center justify-between rounded-[14px] bg-[var(--ws-bg-surface)] px-4 py-3 border border-[var(--ws-border)]">
                  <span className="text-[13px] font-semibold text-[var(--ws-text-secondary)]">
                    Estimated monthly spend
                  </span>
                  <span className="text-[16px] font-bold text-[var(--ws-text-primary)] tabular-nums">
                    {fmt(monthlyExpenses)}/mo
                  </span>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="text-[13px] font-medium text-[var(--ws-text-tertiary)] hover:text-[var(--ws-text-primary)] transition-colors cursor-pointer px-2"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => onComplete(draft)}
                  className="ml-auto inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-semibold cursor-pointer hover:translate-y-[-1px] active:translate-y-0 transition-transform shadow-[0_8px_22px_rgba(0,0,0,0.18)]"
                  style={{
                    backgroundColor: "var(--ws-text-primary)",
                    color: "var(--ws-bg-primary)",
                  }}
                >
                  Looks good
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

interface SoftSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: (v: number) => string;
  onChange: (v: number) => void;
}

function SoftSlider({ label, value, min, max, step, display, onChange }: SoftSliderProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[12px] font-semibold uppercase tracking-wider text-[var(--ws-text-tertiary)]">
          {label}
        </label>
        <span className="text-[14px] font-bold text-[var(--ws-text-primary)] tabular-nums">
          {display(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-[var(--ws-border)] rounded-full appearance-none cursor-pointer accent-[var(--ws-text-primary)] outline-none"
      />
    </div>
  );
}
