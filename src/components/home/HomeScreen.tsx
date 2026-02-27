"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SUGGESTION_CHIPS } from "@/lib/defaults";
import type { FinancialProfile } from "@/lib/types";
import PromptInput from "@/components/prompt/PromptInput";
import CurrencyInput from "@/components/ui/CurrencyInput";
import RangeSlider from "@/components/ui/RangeSlider";
import SelectInput from "@/components/ui/SelectInput";

interface HomeScreenProps {
  profile: FinancialProfile;
  onProfileChange: (profile: FinancialProfile) => void;
  onSubmit: (event: string) => void;
}

const PROVINCE_OPTIONS = [
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

const PROVINCE_LABELS: Record<string, string> = Object.fromEntries(
  PROVINCE_OPTIONS.map((o) => [o.value, o.label])
);

const EMPLOYMENT_OPTIONS = [
  { value: "employed", label: "Employed" },
  { value: "self_employed", label: "Self-employed" },
  { value: "freelance", label: "Freelance" },
  { value: "unemployed", label: "Unemployed" },
  { value: "student", label: "Student" },
  { value: "retired", label: "Retired" },
];

const HOUSING_OPTIONS = [
  { value: "rent", label: "Renting" },
  { value: "own", label: "Own" },
];

function formatCurrency(value: number): string {
  if (value >= 1000) return `$${value.toLocaleString("en-CA")}`;
  return `$${value}`;
}

function SnapshotRow({
  label,
  value,
  isSeparator,
}: {
  label?: string;
  value?: string;
  isSeparator?: boolean;
}) {
  if (isSeparator) {
    return (
      <div
        className="my-1.5"
        style={{ borderTop: "1px solid var(--ws-border)" }}
      />
    );
  }
  return (
    <div className="flex items-baseline justify-between py-[3px]">
      <span className="text-[14px] text-[var(--ws-text-secondary)]">
        {label}
      </span>
      <span className="text-[14px] font-medium text-[var(--ws-text-primary)] tabular-nums">
        {value}
      </span>
    </div>
  );
}

export default function HomeScreen({
  profile,
  onProfileChange,
  onSubmit,
}: HomeScreenProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<FinancialProfile>(profile);
  const [tfsaExpanded, setTfsaExpanded] = useState(false);

  const p = profile;
  const savings = p.chequingBalance + p.savingsBalance;
  const monthlyOut =
    p.housingExpense +
    p.essentialExpenses +
    p.discretionarySpending +
    p.debtPayments;

  const startEdit = useCallback(() => {
    setDraft(profile);
    setIsEditing(true);
  }, [profile]);

  const saveEdit = useCallback(() => {
    onProfileChange(draft);
    setIsEditing(false);
  }, [draft, onProfileChange]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const updateField = useCallback(
    <K extends keyof FinancialProfile>(key: K, value: FinancialProfile[K]) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  return (
    <div className="w-full h-full px-5 py-3 pb-4 flex flex-col">
      <AnimatePresence mode="wait">
        {!isEditing ? (
          <motion.div
            key="display"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex flex-col gap-2.5"
          >
            <div className="flex justify-between items-center mb-1 px-1">
              <h2 className="text-[28px] font-bold tracking-tight text-[var(--ws-text-primary)]">Accounts</h2>
              <button
                type="button"
                onClick={startEdit}
                className="w-8 h-8 rounded-full border border-[var(--ws-border)] bg-[var(--ws-bg-surface)] flex items-center justify-center text-[var(--ws-text-secondary)] shadow-sm hover:bg-[var(--ws-bg-primary)] transition-colors"
                aria-label="Edit accounts"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 20H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M16.5 3.50023C16.8978 3.1024 17.4374 2.87891 18 2.87891C18.2786 2.87891 18.5544 2.93378 18.8118 3.04038C19.0692 3.14699 19.303 3.30324 19.5 3.50023C19.697 3.69721 19.8532 3.93106 19.9598 4.18843C20.0665 4.4458 20.1213 4.72165 20.1213 5.00023C20.1213 5.2788 20.0665 5.55465 19.9598 5.81202C19.8532 6.06939 19.697 6.30324 19.5 6.50023L7 19.0002L3 20.0002L4 16.0002L16.5 3.50023Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {/* Credit Card Card */}
            <div className="bg-[var(--ws-bg-surface)] rounded-[16px] p-4 shadow-sm border border-[var(--ws-border)] flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#32302F] rounded-[8px] flex items-center justify-center shadow-inner">
                  <span className="text-white font-bold text-[18px]">W</span>
                </div>
                <span className="text-[17px] font-semibold text-[var(--ws-text-primary)]">Credit card</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[17px] font-bold text-[var(--ws-text-primary)]">$853.37</span>
                <span className="text-[13px] font-bold text-[#148749] tracking-tight">+$57.64 cash back</span>
              </div>
            </div>

            {/* Chequing Card */}
            <div className="bg-[var(--ws-bg-surface)] rounded-[16px] p-4 shadow-sm border border-[var(--ws-border)] flex items-center justify-between cursor-pointer">
              <span className="text-[17px] font-semibold text-[var(--ws-text-secondary)]">Chequing</span>
              <div className="flex items-center gap-2">
                <span className="text-[17px] font-bold text-[var(--ws-text-primary)]">{formatCurrency(p.chequingBalance)}</span>
                <div className="w-7 h-7 rounded-full bg-[var(--ws-bg-primary)] flex items-center justify-center text-[var(--ws-text-primary)]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>

            {/* USD Savings Card */}
            <div className="bg-[var(--ws-bg-surface)] rounded-[16px] p-4 shadow-sm border border-[var(--ws-border)] flex items-end justify-between cursor-pointer">
              <div className="flex flex-col gap-1">
                <span className="text-[18px]" role="img" aria-label="US Flag">🇺🇸</span>
                <span className="text-[15px] font-medium text-[var(--ws-text-secondary)]">USD savings</span>
              </div>
              <span className="text-[17px] font-bold text-[var(--ws-text-primary)] pb-0.5">{formatCurrency(p.savingsBalance)} USD</span>
            </div>

            {/* TFSA Collapsible Card */}
            <div
              className="bg-[var(--ws-bg-surface)] rounded-[16px] p-4 shadow-sm border border-[var(--ws-border)] flex flex-col cursor-pointer transition-all duration-300"
              onClick={() => setTfsaExpanded(!tfsaExpanded)}
            >
              <div className={`flex items-center justify-between transition-all duration-300 ${tfsaExpanded ? "mb-4" : ""}`}>
                <span className="text-[17px] font-semibold text-[var(--ws-text-secondary)]">TFSA</span>
                <div className="flex items-center gap-2">
                  <span className="text-[17px] font-bold text-[var(--ws-text-primary)]">{formatCurrency(p.tfsaBalance)}</span>
                  <div className="w-7 h-7 rounded-full bg-[var(--ws-bg-primary)] flex items-center justify-center text-[var(--ws-text-primary)] border border-[var(--ws-border)]">
                    {tfsaExpanded ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18 15L12 9L6 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {tfsaExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col gap-4 mt-2">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[20px] mb-1">✈️</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[15px] font-medium text-[var(--ws-text-secondary)]">TFSA</span>
                            <span className="px-1.5 py-0.5 bg-[var(--ws-bg-primary)] rounded font-semibold text-[11px] text-[var(--ws-text-primary)] tracking-wide">Managed</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[16px] font-bold text-[var(--ws-text-primary)]">{formatCurrency(p.tfsaBalance * 0.25)}</span>
                          <span className="text-[13px] font-bold text-[#148749] tracking-tight">+29.92% all time</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[20px] mb-1">🏦</span>
                          <span className="text-[15px] font-medium text-[var(--ws-text-secondary)]">TFSA</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[16px] font-bold text-[var(--ws-text-primary)]">{formatCurrency(p.tfsaBalance * 0.62)}</span>
                          <span className="text-[13px] font-bold text-[#148749] tracking-tight">+20.67% all time</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[20px] mb-1">👶🏼</span>
                          <span className="text-[15px] font-medium text-[var(--ws-text-secondary)]">TFSA</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[16px] font-bold text-[var(--ws-text-primary)]">{formatCurrency(p.tfsaBalance * 0.13)}</span>
                          <span className="text-[13px] font-bold text-[#148749] tracking-tight">+6.17% all time</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* FHSA */}
            <div className="bg-[var(--ws-bg-surface)] rounded-[16px] p-4 shadow-sm border border-[var(--ws-border)] flex items-end justify-between cursor-pointer">
              <div className="flex flex-col gap-1">
                <span className="text-[20px]">🏠</span>
                <span className="text-[15px] font-medium text-[var(--ws-text-secondary)]">FHSA</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[16px] font-bold text-[var(--ws-text-primary)]">{formatCurrency(p.fhsaBalance || 5253.27)}</span>
                <span className="text-[13px] font-bold text-[#148749] tracking-tight">+5.07% all time</span>
              </div>
            </div>

            {/* RRSP */}
            <div className="bg-[var(--ws-bg-surface)] rounded-[16px] p-4 shadow-sm border border-[var(--ws-border)] flex items-end justify-between cursor-pointer">
              <div className="flex flex-col gap-1">
                <span className="text-[20px]">⛔️</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[15px] font-medium text-[var(--ws-text-secondary)]">RRSP</span>
                  <span className="px-1.5 py-0.5 bg-[var(--ws-bg-primary)] rounded font-semibold text-[11px] text-[var(--ws-text-primary)] tracking-wide">Managed</span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[16px] font-bold text-[var(--ws-text-primary)]">{formatCurrency(p.rrspBalance)}</span>
                <span className="text-[13px] font-bold text-[#148749] tracking-tight">+26.15% all time</span>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="edit"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="rounded-[var(--ws-radius-lg)] p-5 mb-3 bg-[var(--ws-bg-surface)] border border-[var(--ws-border)] shadow-sm"
          >
            <div className="flex justify-between items-center mb-4">
              <p className="text-[13px] font-semibold text-[var(--ws-text-tertiary)] uppercase tracking-[0.04em]">
                Edit Your Profile
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="text-[12px] text-[var(--ws-text-tertiary)] hover:text-[var(--ws-text-secondary)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  className="text-[12px] font-semibold text-[var(--ws-text-primary)] hover:opacity-80 transition-opacity cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Income */}
            <p className="text-[11px] font-semibold text-[var(--ws-text-tertiary)] uppercase tracking-wider mb-2">
              Income
            </p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <CurrencyInput
                label="Annual Income"
                value={draft.annualIncome}
                onChange={(v) => updateField("annualIncome", v)}
              />
              <CurrencyInput
                label="Partner Income"
                value={draft.partnerIncome}
                onChange={(v) => updateField("partnerIncome", v)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <SelectInput
                label="Employment"
                value={draft.employmentType}
                onChange={(v) => updateField("employmentType", v as FinancialProfile["employmentType"])}
                options={EMPLOYMENT_OPTIONS}
              />
              <SelectInput
                label="Province"
                value={draft.province}
                onChange={(v) => updateField("province", v)}
                options={PROVINCE_OPTIONS}
              />
            </div>

            <div className="my-3" style={{ borderTop: "1px solid var(--ws-border)" }} />

            {/* Accounts */}
            <p className="text-[11px] font-semibold text-[var(--ws-text-tertiary)] uppercase tracking-wider mb-2">
              Accounts (Drag to Demo)
            </p>
            <div className="flex flex-col gap-3 mb-4">
              <RangeSlider
                label="Chequing"
                value={draft.chequingBalance}
                min={0}
                max={150000}
                step={500}
                onChange={(v) => updateField("chequingBalance", v)}
                formatValue={formatCurrency}
              />
              <RangeSlider
                label="USD Savings"
                value={draft.savingsBalance}
                min={0}
                max={150000}
                step={500}
                onChange={(v) => updateField("savingsBalance", v)}
                formatValue={(v) => formatCurrency(v) + " USD"}
              />
              <RangeSlider
                label="TFSA Balance"
                value={draft.tfsaBalance}
                min={0}
                max={200000}
                step={1000}
                onChange={(v) => updateField("tfsaBalance", v)}
                formatValue={formatCurrency}
              />
              <RangeSlider
                label="FHSA"
                value={draft.fhsaBalance || 0}
                min={0}
                max={60000}
                step={500}
                onChange={(v) => updateField("fhsaBalance", v)}
                formatValue={formatCurrency}
              />
              <RangeSlider
                label="RRSP Balance"
                value={draft.rrspBalance}
                min={0}
                max={200000}
                step={1000}
                onChange={(v) => updateField("rrspBalance", v)}
                formatValue={formatCurrency}
              />
              <div className="grid grid-cols-2 gap-3 mt-2">
                <CurrencyInput
                  label="TFSA Room"
                  value={draft.tfsaRoom}
                  onChange={(v) => updateField("tfsaRoom", v)}
                />
                <CurrencyInput
                  label="RRSP Room"
                  value={draft.rrspRoom}
                  onChange={(v) => updateField("rrspRoom", v)}
                />
                <CurrencyInput
                  label="Non-Registered"
                  value={draft.nonRegBalance}
                  onChange={(v) => updateField("nonRegBalance", v)}
                />
              </div>
            </div>

            <div className="my-3" style={{ borderTop: "1px solid var(--ws-border)" }} />

            {/* Housing & Expenses */}
            <p className="text-[11px] font-semibold text-[var(--ws-text-tertiary)] uppercase tracking-wider mb-2">
              Housing & Expenses
            </p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <SelectInput
                label="Housing"
                value={draft.housingType}
                onChange={(v) => updateField("housingType", v as "rent" | "own")}
                options={HOUSING_OPTIONS}
              />
              <CurrencyInput
                label="Housing Cost/mo"
                value={draft.housingExpense}
                onChange={(v) => updateField("housingExpense", v)}
              />
              <CurrencyInput
                label="Essentials/mo"
                value={draft.essentialExpenses}
                onChange={(v) => updateField("essentialExpenses", v)}
              />
              <CurrencyInput
                label="Discretionary/mo"
                value={draft.discretionarySpending}
                onChange={(v) => updateField("discretionarySpending", v)}
              />
              <CurrencyInput
                label="Debt Payments/mo"
                value={draft.debtPayments}
                onChange={(v) => updateField("debtPayments", v)}
              />
              {draft.housingType === "own" && (
                <CurrencyInput
                  label="Mortgage Balance"
                  value={draft.mortgageBalance}
                  onChange={(v) => updateField("mortgageBalance", v)}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 mt-1">
        <PromptInput onSubmit={onSubmit} chips={SUGGESTION_CHIPS} />
      </div>
    </div>
  );
}
