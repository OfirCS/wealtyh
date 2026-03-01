"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SUGGESTION_CHIPS } from "@/lib/defaults";
import type { FinancialProfile, CustomFund, AppliedSummary } from "@/lib/types";
import PromptInput from "@/components/prompt/PromptInput";
import CurrencyInput from "@/components/ui/CurrencyInput";
import RangeSlider from "@/components/ui/RangeSlider";
import SelectInput from "@/components/ui/SelectInput";

interface HomeScreenProps {
  profile: FinancialProfile;
  customFunds: CustomFund[];
  appliedSummary?: AppliedSummary;
  onProfileChange: (profile: FinancialProfile) => void;
  onCustomFundsChange: (customFunds: CustomFund[]) => void;
  onSubmit: (event: string) => void;
}

function RemoveButton({ onRemove }: { onRemove: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      className="absolute -top-2.5 -right-2.5 w-8 h-8 flex items-center justify-center rounded-full bg-[var(--ws-bg-primary)] shadow-[0_4px_12px_rgba(0,0,0,0.12)] border border-[#D94343]/20 text-[#D94343] opacity-100 md:opacity-0 group-hover:opacity-100 hover:bg-[#D94343] hover:text-white transition-all duration-300 z-10 hover:scale-110 active:scale-90"
      aria-label="Remove account"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  );
}

function BalanceChange({ delta }: { delta: number }) {
  if (delta === 0) return null;
  const positive = delta > 0;
  const formatted = `${positive ? "+" : "-"}$${Math.abs(delta).toLocaleString("en-CA")}`;
  return (
    <span
      className="text-[13px] font-semibold tabular-nums"
      style={{ color: positive ? "#148749" : "#D94343" }}
    >
      {formatted}
    </span>
  );
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

export default function HomeScreen({
  profile,
  customFunds,
  appliedSummary,
  onProfileChange,
  onCustomFundsChange,
  onSubmit,
}: HomeScreenProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<FinancialProfile>(profile);
  const [tfsaExpanded, setTfsaExpanded] = useState(false);
  const [chequingExpanded, setChequingExpanded] = useState(false);
  const [editSection, setEditSection] = useState<"income" | "accounts" | "expenses">("income");
  const [summaryVisible, setSummaryVisible] = useState(true);
  const [showPromptOverlay, setShowPromptOverlay] = useState(false);


  const p = profile;
  const totalBalance =
    (p.chequingBalance > 0 ? p.chequingBalance : 0) +
    (p.savingsBalance > 0 ? p.savingsBalance : 0) +
    (p.tfsaBalance > 0 ? p.tfsaBalance : 0) +
    (p.rrspBalance > 0 ? p.rrspBalance : 0) +
    (p.fhsaBalance > 0 ? p.fhsaBalance : 0) +
    (p.nonRegBalance > 0 ? p.nonRegBalance : 0) -
    (p.creditCardBalance > 0 ? p.creditCardBalance : 0) +
    customFunds.reduce((sum, f) => sum + (f.balance > 0 ? f.balance : 0), 0);
  const showSummary = summaryVisible && !!appliedSummary && appliedSummary.actions.length > 0;

  const startEdit = useCallback(() => {
    setDraft(profile);
    setIsEditing(true);
    setEditSection("income");
    setSummaryVisible(false);
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
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", bounce: 0, duration: 0.6 }}
            className="flex flex-col gap-2.5"
          >
            <div className="flex justify-between items-start mb-6 px-1 mt-4">
              <div className="flex flex-col">
                <span className="text-[14px] font-medium text-[var(--ws-text-secondary)] mb-1">Total balance</span>
                <h2 className="text-[40px] leading-none font-serif tracking-tight text-[var(--ws-text-primary)]">
                  {formatCurrency(totalBalance)}
                </h2>
              </div>
              <button
                type="button"
                onClick={startEdit}
                className="w-10 h-10 rounded-full bg-[var(--ws-bg-surface)] border border-[var(--ws-border)] flex items-center justify-center text-[var(--ws-text-secondary)] hover:text-[var(--ws-text-primary)] transition-colors cursor-pointer"
                aria-label="Edit accounts"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
            </div>

            {/* Success Banner */}
            <AnimatePresence>
              {showSummary && appliedSummary && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                  className="overflow-hidden"
                >
                  <div
                    className="rounded-[16px] px-4 py-3 shadow-sm border flex items-center justify-between"
                    style={{
                      backgroundColor: "rgba(20, 135, 73, 0.08)",
                      borderColor: "rgba(20, 135, 73, 0.2)",
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                        <path d="M20 6L9 17L4 12" stroke="#148749" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-[14px] font-semibold" style={{ color: "#148749" }}>
                        Done
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSummaryVisible(false)}
                      className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors cursor-pointer"
                      aria-label="Dismiss"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6L18 18" stroke="#148749" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Credit Card Card */}
            <AnimatePresence>
              {p.creditCardBalance > 0 && (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.9, height: 0, filter: "blur(8px)", marginBottom: 0 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                  className="relative group w-full"
                >
                  <RemoveButton onRemove={() => onProfileChange({ ...p, creditCardBalance: 0 })} />
                  <div className="bg-[var(--ws-bg-surface)] rounded-[16px] p-4 shadow-sm border border-[var(--ws-border)] flex items-center justify-between cursor-pointer w-full">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-[#32302F] rounded-[8px] flex items-center justify-center shadow-inner">
                        <span className="text-white font-bold text-[18px]">W</span>
                      </div>
                      <span className="text-[17px] font-semibold text-[var(--ws-text-primary)]">Credit card</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[17px] font-bold text-[var(--ws-text-primary)]">{formatCurrency(p.creditCardBalance)}</span>
                      <span className="text-[13px] font-bold text-[#148749] tracking-tight">+$57.64 cash back</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Chequing Collapsible Card */}
            <AnimatePresence>
              {p.chequingBalance > 0 && (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.9, height: 0, filter: "blur(8px)", marginBottom: 0 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                  className="relative group w-full"
                >
                  <RemoveButton onRemove={() => onProfileChange({ ...p, chequingBalance: 0 })} />
                  <div
                    className="bg-[var(--ws-bg-surface)] rounded-[16px] p-4 shadow-sm border border-[var(--ws-border)] flex flex-col cursor-pointer transition-all duration-300 w-full"
                    onClick={() => setChequingExpanded(!chequingExpanded)}
                  >
                    <div className={`flex items-center justify-between transition-all duration-300 ${chequingExpanded ? "mb-4" : ""}`}>
                      <span className="text-[17px] font-semibold text-[var(--ws-text-secondary)]">Chequing</span>
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-2">
                          <span className="text-[17px] font-bold text-[var(--ws-text-primary)]">{formatCurrency(p.chequingBalance)}</span>
                          <div className="w-7 h-7 rounded-[8px] bg-[#32302F] flex items-center justify-center text-[var(--ws-text-primary)] transition-transform duration-300">
                            {chequingExpanded ? (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="rotate-180 transition-transform">
                                <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            ) : (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-transform">
                                <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                        </div>
                        {showSummary && appliedSummary?.balanceChanges.chequingBalance && (
                          <BalanceChange delta={appliedSummary.balanceChanges.chequingBalance} />
                        )}
                      </div>
                    </div>

                    <AnimatePresence>
                      {chequingExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                          className="overflow-hidden"
                        >
                          <div className="flex flex-col gap-4 mt-2">
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className="text-[20px] mb-1">{"\u{1F4B3}"}</span>
                                <span className="text-[15px] font-medium text-[var(--ws-text-secondary)]">Main Chequing</span>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-[16px] font-bold text-[var(--ws-text-primary)]">{formatCurrency(p.chequingBalance * 0.85)}</span>
                                <span className="text-[13px] text-[var(--ws-text-tertiary)]">Everyday spending</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className="text-[20px] mb-1">{"\u{1F3E6}"}</span>
                                <span className="text-[15px] font-medium text-[var(--ws-text-secondary)]">Joint Account</span>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-[16px] font-bold text-[var(--ws-text-primary)]">{formatCurrency(p.chequingBalance * 0.15)}</span>
                                <span className="text-[13px] text-[var(--ws-text-tertiary)]">Shared expenses</span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* USD Savings Card */}
            <AnimatePresence>
              {p.savingsBalance > 0 && (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.9, height: 0, filter: "blur(8px)", marginBottom: 0 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                  className="relative group w-full"
                >
                  <RemoveButton onRemove={() => onProfileChange({ ...p, savingsBalance: 0 })} />
                  <div className="bg-[var(--ws-bg-surface)] rounded-[16px] p-4 shadow-sm border border-[var(--ws-border)] flex items-end justify-between cursor-pointer w-full">
                    <div className="flex flex-col gap-1">
                      <span className="text-[18px]" role="img" aria-label="US Flag">{"\uD83C\uDDFA\uD83C\uDDF8"}</span>
                      <span className="text-[15px] font-medium text-[var(--ws-text-secondary)]">USD savings</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[17px] font-bold text-[var(--ws-text-primary)] pb-0.5">{formatCurrency(p.savingsBalance)} USD</span>
                      {showSummary && appliedSummary?.balanceChanges.savingsBalance && (
                        <BalanceChange delta={appliedSummary.balanceChanges.savingsBalance} />
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* TFSA Collapsible Card */}
            <AnimatePresence>
              {p.tfsaBalance > 0 && (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.9, height: 0, filter: "blur(8px)", marginBottom: 0 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                  className="relative group w-full"
                >
                  <RemoveButton onRemove={() => onProfileChange({ ...p, tfsaBalance: 0 })} />
                  <div
                    className="bg-[var(--ws-bg-surface)] rounded-[16px] p-4 shadow-sm border border-[var(--ws-border)] flex flex-col cursor-pointer transition-all duration-300 w-full"
                    onClick={() => setTfsaExpanded(!tfsaExpanded)}
                  >
                    <div className={`flex items-center justify-between transition-all duration-300 ${tfsaExpanded ? "mb-4" : ""}`}>
                      <span className="text-[17px] font-semibold text-[var(--ws-text-secondary)]">TFSA</span>
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-2">
                          <span className="text-[17px] font-bold text-[var(--ws-text-primary)]">{formatCurrency(p.tfsaBalance)}</span>
                          <div className="w-7 h-7 rounded-[8px] bg-[#32302F] flex items-center justify-center text-[var(--ws-text-primary)] transition-transform duration-300">
                            {tfsaExpanded ? (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="rotate-180 transition-transform">
                                <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            ) : (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-transform">
                                <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                        </div>
                        {showSummary && appliedSummary?.balanceChanges.tfsaBalance && (
                          <BalanceChange delta={appliedSummary.balanceChanges.tfsaBalance} />
                        )}
                      </div>
                    </div>

                    <AnimatePresence>
                      {tfsaExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                          className="overflow-hidden"
                        >
                          <div className="flex flex-col gap-4 mt-2">
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className="text-[20px] mb-1">{"\u2708\uFE0F"}</span>
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
                                <span className="text-[20px] mb-1">{"\uD83C\uDFE6"}</span>
                                <span className="text-[15px] font-medium text-[var(--ws-text-secondary)]">TFSA</span>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-[16px] font-bold text-[var(--ws-text-primary)]">{formatCurrency(p.tfsaBalance * 0.62)}</span>
                                <span className="text-[13px] font-bold text-[#148749] tracking-tight">+20.67% all time</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className="text-[20px] mb-1">{"\uD83D\uDC76\uD83C\uDFFB"}</span>
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
                </motion.div>
              )}
            </AnimatePresence>

            {/* FHSA */}
            <AnimatePresence>
              {p.fhsaBalance > 0 && (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.9, height: 0, filter: "blur(8px)", marginBottom: 0 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                  className="relative group w-full"
                >
                  <RemoveButton onRemove={() => onProfileChange({ ...p, fhsaBalance: 0 })} />
                  <div className="bg-[var(--ws-bg-surface)] rounded-[16px] p-4 shadow-sm border border-[var(--ws-border)] flex items-end justify-between cursor-pointer w-full">
                    <div className="flex flex-col gap-1">
                      <span className="text-[20px]">{"\uD83C\uDFE0"}</span>
                      <span className="text-[15px] font-medium text-[var(--ws-text-secondary)]">FHSA</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[16px] font-bold text-[var(--ws-text-primary)]">{formatCurrency(p.fhsaBalance)}</span>
                      <span className="text-[13px] font-bold text-[#148749] tracking-tight">+5.07% all time</span>
                      {showSummary && appliedSummary?.balanceChanges.fhsaBalance && (
                        <BalanceChange delta={appliedSummary.balanceChanges.fhsaBalance} />
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* RRSP */}
            <AnimatePresence>
              {p.rrspBalance > 0 && (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.9, height: 0, filter: "blur(8px)", marginBottom: 0 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                  className="relative group w-full"
                >
                  <RemoveButton onRemove={() => onProfileChange({ ...p, rrspBalance: 0 })} />
                  <div className="bg-[var(--ws-bg-surface)] rounded-[16px] p-4 shadow-sm border border-[var(--ws-border)] flex items-end justify-between cursor-pointer w-full">
                    <div className="flex flex-col gap-1">
                      <span className="text-[20px]">{"\u26D4\uFE0F"}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[15px] font-medium text-[var(--ws-text-secondary)]">RRSP</span>
                        <span className="px-1.5 py-0.5 bg-[var(--ws-bg-primary)] rounded font-semibold text-[11px] text-[var(--ws-text-primary)] tracking-wide">Managed</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[16px] font-bold text-[var(--ws-text-primary)]">{formatCurrency(p.rrspBalance)}</span>
                      <span className="text-[13px] font-bold text-[#148749] tracking-tight">+26.15% all time</span>
                      {showSummary && appliedSummary?.balanceChanges.rrspBalance && (
                        <BalanceChange delta={appliedSummary.balanceChanges.rrspBalance} />
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Non-Registered */}
            <AnimatePresence>
              {p.nonRegBalance > 0 && (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.9, height: 0, filter: "blur(8px)", marginBottom: 0 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                  className="relative group w-full"
                >
                  <RemoveButton onRemove={() => onProfileChange({ ...p, nonRegBalance: 0 })} />
                  <div className="bg-[var(--ws-bg-surface)] rounded-[16px] p-4 shadow-sm border border-[var(--ws-border)] flex items-end justify-between cursor-pointer w-full">
                    <div className="flex flex-col gap-1">
                      <span className="text-[20px]">{"\uD83D\uDCCA"}</span>
                      <span className="text-[15px] font-medium text-[var(--ws-text-secondary)]">Non-Registered</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[16px] font-bold text-[var(--ws-text-primary)]">{formatCurrency(p.nonRegBalance)}</span>
                      <span className="text-[13px] font-bold text-[#148749] tracking-tight">+12.34% all time</span>
                      {showSummary && appliedSummary?.balanceChanges.nonRegBalance && (
                        <BalanceChange delta={appliedSummary.balanceChanges.nonRegBalance} />
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Custom Funds (created via confirmed actions) */}
            <AnimatePresence>
              {customFunds.map((fund, i) => {
                const isNew = showSummary && appliedSummary?.newFundNames.includes(fund.name);
                const fundDelta = showSummary ? appliedSummary?.fundChanges[fund.name] : undefined;
                return (
                  <motion.div
                    layout
                    key={fund.name + i}
                    initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 0.9, height: 0, filter: "blur(8px)", marginBottom: 0 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.6, delay: 0.05 * i }}
                    className="relative group w-full"
                  >
                    <RemoveButton onRemove={() => onCustomFundsChange(customFunds.filter(f => f.name !== fund.name))} />
                    <div className="bg-[var(--ws-bg-surface)] rounded-[16px] p-4 shadow-sm border border-[var(--ws-border)] flex items-end justify-between cursor-pointer w-full">
                      <div className="flex flex-col gap-1">
                        <span className="text-[20px]">{fund.emoji || "\u{1F4B0}"}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-medium text-[var(--ws-text-secondary)]">{fund.name}</span>
                          {isNew && (
                            <span
                              className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                              style={{ backgroundColor: "rgba(20, 135, 73, 0.12)", color: "#148749" }}
                            >
                              New
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[16px] font-bold text-[var(--ws-text-primary)] pb-0.5">{formatCurrency(fund.balance)}</span>
                        {fundDelta ? <BalanceChange delta={fundDelta} /> : null}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        ) : (
          /* ── EDIT MODE ── */
          <motion.div
            key="edit"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", bounce: 0, duration: 0.6 }}
            className="flex flex-col gap-4"
          >
            {/* Edit header */}
            <div className="flex justify-between items-center px-1">
              <h2 className="text-[22px] font-bold tracking-tight text-[var(--ws-text-primary)]">
                Edit Snapshot
              </h2>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="text-[13px] text-[var(--ws-text-tertiary)] hover:text-[var(--ws-text-secondary)] transition-colors cursor-pointer bg-transparent border-none"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  className="text-[13px] font-bold text-[var(--ws-text-primary)] cursor-pointer bg-transparent border-none hover:opacity-80 transition-opacity"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Section tabs */}
            <div className="flex bg-[#E8E4DD] p-[3px] rounded-full">
              {(["income", "accounts", "expenses"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setEditSection(tab)}
                  className={`flex-1 text-[12px] font-bold py-1.5 rounded-full capitalize transition-all duration-200 ${editSection === tab
                    ? "text-[var(--ws-text-primary)] shadow-sm bg-[var(--ws-bg-surface)]"
                    : "text-[#88837E] hover:text-[var(--ws-text-primary)]"
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {editSection === "income" && (
                <motion.div
                  key="income"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.15 }}
                  className="bg-[var(--ws-bg-surface)] rounded-[20px] border border-[var(--ws-border)] p-5 shadow-sm"
                >
                  <p className="text-[11px] font-semibold text-[var(--ws-text-tertiary)] uppercase tracking-wider mb-4">
                    Income & Employment
                  </p>
                  <div className="flex flex-col gap-4">
                    <CurrencyInput
                      label="Your annual income"
                      value={draft.annualIncome}
                      onChange={(v) => updateField("annualIncome", v)}
                    />
                    <CurrencyInput
                      label="Partner annual income"
                      value={draft.partnerIncome}
                      onChange={(v) => updateField("partnerIncome", v)}
                    />
                    <SelectInput
                      label="Employment type"
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
                  <p className="text-[12px] text-[var(--ws-text-tertiary)] mt-4 leading-relaxed">
                    Used for tax and benefit calculations.
                  </p>
                </motion.div>
              )}

              {editSection === "accounts" && (
                <motion.div
                  key="accounts"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.15 }}
                  className="bg-[var(--ws-bg-surface)] rounded-[20px] border border-[var(--ws-border)] p-5 shadow-sm"
                >
                  <p className="text-[11px] font-semibold text-[var(--ws-text-tertiary)] uppercase tracking-wider mb-4">
                    Account Balances
                  </p>
                  <div className="flex flex-col gap-4">
                    <RangeSlider
                      label="Chequing"
                      value={draft.chequingBalance}
                      min={0} max={150000} step={500}
                      onChange={(v) => updateField("chequingBalance", v)}
                      formatValue={formatCurrency}
                    />
                    <RangeSlider
                      label="Savings (USD)"
                      value={draft.savingsBalance}
                      min={0} max={150000} step={500}
                      onChange={(v) => updateField("savingsBalance", v)}
                      formatValue={(v) => formatCurrency(v) + " USD"}
                    />
                    <RangeSlider
                      label="TFSA"
                      value={draft.tfsaBalance}
                      min={0} max={200000} step={1000}
                      onChange={(v) => updateField("tfsaBalance", v)}
                      formatValue={formatCurrency}
                    />
                    <RangeSlider
                      label="FHSA"
                      value={draft.fhsaBalance}
                      min={0} max={60000} step={500}
                      onChange={(v) => updateField("fhsaBalance", v)}
                      formatValue={formatCurrency}
                    />
                    <RangeSlider
                      label="RRSP"
                      value={draft.rrspBalance}
                      min={0} max={200000} step={1000}
                      onChange={(v) => updateField("rrspBalance", v)}
                      formatValue={formatCurrency}
                    />

                    <div className="border-t border-[var(--ws-border)] pt-3 mt-1">
                      <p className="text-[11px] text-[var(--ws-text-tertiary)] uppercase tracking-wider font-semibold mb-3">
                        Contribution room
                      </p>
                      <div className="grid grid-cols-2 gap-3">
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
                      </div>
                    </div>
                    <CurrencyInput
                      label="Credit Card Balance"
                      value={draft.creditCardBalance}
                      onChange={(v) => updateField("creditCardBalance", v)}
                    />
                  </div>
                </motion.div>
              )}

              {editSection === "expenses" && (
                <motion.div
                  key="expenses"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.15 }}
                  className="bg-[var(--ws-bg-surface)] rounded-[20px] border border-[var(--ws-border)] p-5 shadow-sm"
                >
                  <p className="text-[11px] font-semibold text-[var(--ws-text-tertiary)] uppercase tracking-wider mb-4">
                    Monthly expenses
                  </p>
                  <div className="flex flex-col gap-4">
                    <SelectInput
                      label="Housing type"
                      value={draft.housingType}
                      onChange={(v) => updateField("housingType", v as "rent" | "own")}
                      options={HOUSING_OPTIONS}
                    />
                    <CurrencyInput
                      label={draft.housingType === "rent" ? "Rent / month" : "Mortgage / month"}
                      value={draft.housingExpense}
                      onChange={(v) => updateField("housingExpense", v)}
                    />
                    <CurrencyInput
                      label="Essentials / month"
                      value={draft.essentialExpenses}
                      onChange={(v) => updateField("essentialExpenses", v)}
                    />
                    <CurrencyInput
                      label="Fun spending / month"
                      value={draft.discretionarySpending}
                      onChange={(v) => updateField("discretionarySpending", v)}
                    />
                    <CurrencyInput
                      label="Debt payments / month"
                      value={draft.debtPayments}
                      onChange={(v) => updateField("debtPayments", v)}
                    />
                    {draft.housingType === "own" && (
                      <CurrencyInput
                        label="Mortgage balance"
                        value={draft.mortgageBalance}
                        onChange={(v) => updateField("mortgageBalance", v)}
                      />
                    )}
                  </div>

                  {/* Quick summary */}
                  <div className="mt-4 pt-3 border-t border-[var(--ws-border)]">
                    <div className="flex justify-between items-center">
                      <span className="text-[13px] text-[var(--ws-text-secondary)]">Total monthly outflow</span>
                      <span className="text-[15px] font-bold text-[var(--ws-text-primary)] tabular-nums">
                        {formatCurrency(
                          draft.housingExpense +
                          draft.essentialExpenses +
                          draft.discretionarySpending +
                          draft.debtPayments
                        )}/mo
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button (FAB) + Bottom Sheet Overlay */}
      <AnimatePresence>
        {!showPromptOverlay && !isEditing && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            className="fixed bottom-6 right-6 sm:bottom-10 sm:right-10 z-40 flex flex-col items-center gap-2"
          >
            <button
              type="button"
              onClick={() => setShowPromptOverlay(true)}
              className="w-14 h-14 rounded-full bg-[var(--ws-text-primary)] text-[var(--ws-bg-primary)] shadow-[0_8px_30px_rgb(0,0,0,0.5)] border border-[var(--ws-text-primary)]/20 flex flex-col items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-transform group"
              aria-label="Open Pathfinder"
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v5" />
                <path d="M12 16v5" />
                <path d="M3 12h5" />
                <path d="M16 12h5" />
                <path d="M6 6l3.5 3.5" />
                <path d="M14.5 15.5l3.5 3.5" />
                {/* Winding path tweak cutting through */}
                <path d="M5 19 L 10 14 C 12 12, 12 12, 14 10 L 19 5" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPromptOverlay && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setShowPromptOverlay(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 z-50 flex flex-col justify-end w-full max-w-5xl mx-auto"
            >
              <PromptInput
                onSubmit={(val) => {
                  setShowPromptOverlay(false);
                  setTimeout(() => {
                    onSubmit(val);
                  }, 300);
                }}
                chips={SUGGESTION_CHIPS}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
