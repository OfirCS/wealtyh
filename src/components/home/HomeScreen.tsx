"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { getDynamicSuggestionChips } from "@/lib/defaults";
import { computeDerivedMetrics, getCanadianRuleSet } from "@/lib/prompts";
import type { FinancialProfile, CustomFund, AppliedSummary } from "@/lib/types";
import PromptInput from "@/components/prompt/PromptInput";
import ProactiveAlerts from "./ProactiveAlerts";
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
  onPromptOpenChange?: (isOpen: boolean) => void;
}

function RemoveButton({ onRemove }: { onRemove: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      className="absolute -top-2.5 -right-2.5 w-8 h-8 flex items-center justify-center rounded-full bg-[var(--ws-bg-primary)] shadow-[0_4px_12px_rgba(0,0,0,0.12)] border border-[var(--ws-border)] text-[var(--ws-text-primary)] opacity-100 md:opacity-0 group-hover:opacity-100 hover:bg-[#D94343] hover:border-[#D94343] hover:text-white transition-all duration-300 z-10 hover:scale-110 active:scale-90"
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
  onPromptOpenChange,
}: HomeScreenProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<FinancialProfile>(profile);
  const [tfsaExpanded, setTfsaExpanded] = useState(false);
  const [chequingExpanded, setChequingExpanded] = useState(false);
  const [editSection, setEditSection] = useState<"accounts" | "expenses">("accounts");
  const [summaryVisible, setSummaryVisible] = useState(true);
  const [showPromptOverlay, setShowPromptOverlay] = useState(false);
  const [promptSeed, setPromptSeed] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);


  const p = profile;
  const rules = useMemo(() => getCanadianRuleSet(), []);
  const metrics = useMemo(() => computeDerivedMetrics(p, customFunds), [p, customFunds]);
  const suggestionChips = useMemo(
    () => getDynamicSuggestionChips(p, customFunds),
    [p, customFunds],
  );
  const promptPlaceholder = "What's changing in your life?";
  const pathfinderTriggerLabel = "Try Pathfinder via Wealthsimple";

  const totalBalance =
    (p.chequingBalance > 0 ? p.chequingBalance : 0) +
    (p.savingsBalance > 0 ? p.savingsBalance : 0) +
    (p.tfsaBalance > 0 ? p.tfsaBalance : 0) +
    (p.rrspBalance > 0 ? p.rrspBalance : 0) +
    (p.fhsaBalance > 0 ? p.fhsaBalance : 0) +
    (p.nonRegBalance > 0 ? p.nonRegBalance : 0) -
    (p.creditCardBalance > 0 ? p.creditCardBalance : 0) +
    customFunds.reduce((sum, f) => sum + (f.balance > 0 ? f.balance : 0), 0);

  const monthlyOutflow =
    p.housingExpense +
    p.essentialExpenses +
    p.discretionarySpending +
    p.debtPayments;
  const chequingReserve = Math.min(p.chequingBalance, monthlyOutflow);
  const chequingAvailable = Math.max(0, p.chequingBalance - chequingReserve);
  const chequingReserveMonths = monthlyOutflow > 0 ? chequingReserve / monthlyOutflow : 0;
  const estimatedCardInterest = (p.creditCardBalance * 0.1999) / 12;
  const fhsaRoomLeft = metrics.isFirstTimeBuyer ? Math.max(0, rules.fhsaAnnualRoom - p.fhsaBalance) : 0;
  const rrspRefundEstimate = Math.round(Math.min(p.rrspRoom, Math.max(0, metrics.monthlySurplus * 12)) * 0.3);
  const tfsaFillMonths = metrics.monthlySurplus > 0 ? p.tfsaRoom / metrics.monthlySurplus : null;
  const showSummary = summaryVisible && !!appliedSummary && appliedSummary.actions.length > 0;

  const startEdit = useCallback(() => {
    setDraft(profile);
    setIsEditing(true);
    setEditSection("accounts");
    setSummaryVisible(false);
  }, [profile]);

  const saveEdit = useCallback(() => {
    onProfileChange(draft);
    setIsEditing(false);
  }, [draft, onProfileChange]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const openPromptOverlay = useCallback((seed = "") => {
    setPromptSeed(seed);
    setShowPromptOverlay(true);
    onPromptOpenChange?.(true);
  }, [onPromptOpenChange]);

  const closePromptOverlay = useCallback(() => {
    setShowPromptOverlay(false);
    onPromptOpenChange?.(false);
  }, [onPromptOpenChange]);

  const handlePathfinderClick = useCallback(() => {
    openPromptOverlay("");
  }, [openPromptOverlay]);


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
                <span className="text-[14px] font-medium text-[var(--ws-text-secondary)] mb-1">Total</span>
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
                      <span className="text-[13px] font-semibold text-[#D94343] tracking-tight">
                        ~{formatCurrency(estimatedCardInterest)}/mo interest
                      </span>
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
                      <div className="flex items-center gap-2">
                      <span className="text-[17px] font-semibold text-[var(--ws-text-secondary)]">Chequing</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--ws-accent-green)]/10 text-[var(--ws-accent-green)]">1.25%</span>
                    </div>
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-2">
                          <span className="text-[17px] font-bold text-[var(--ws-text-primary)]">{formatCurrency(p.chequingBalance)}</span>
                          <div className="w-7 h-7 rounded-[8px] bg-[var(--ws-bg-elevated)] border border-[var(--ws-border)] flex items-center justify-center text-[var(--ws-text-tertiary)] transition-transform duration-300">
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
                                <span className="text-[20px] mb-1">{"\u{1F4C5}"}</span>
                                <span className="text-[15px] font-medium text-[var(--ws-text-secondary)]">Reserved</span>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-[16px] font-bold text-[var(--ws-text-primary)]">{formatCurrency(chequingReserve)}</span>
                                <span className="text-[13px] text-[var(--ws-text-tertiary)]">
                                  {chequingReserveMonths.toFixed(1)}mo of bills
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className="text-[20px] mb-1">{"\u{1F4B8}"}</span>
                                <span className="text-[15px] font-medium text-[var(--ws-text-secondary)]">Available</span>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-[16px] font-bold text-[var(--ws-text-primary)]">{formatCurrency(chequingAvailable)}</span>
                                <span className="text-[13px] text-[var(--ws-text-tertiary)]">Ready to move</span>
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
                      <span className="text-[18px]" role="img" aria-label="Savings">{"\uD83D\uDCB5"}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-medium text-[var(--ws-text-secondary)]">Savings</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--ws-accent-green)]/10 text-[var(--ws-accent-green)]">2.25%</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[17px] font-bold text-[var(--ws-text-primary)] pb-0.5">{formatCurrency(p.savingsBalance)}</span>
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
                      <div className="flex items-center gap-2">
                        <span className="text-[17px] font-semibold text-[var(--ws-text-secondary)]">TFSA</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--ws-accent-green)]/10 text-[var(--ws-accent-green)]">Tax-free</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-2">
                          <span className="text-[17px] font-bold text-[var(--ws-text-primary)]">{formatCurrency(p.tfsaBalance)}</span>
                          <div className="w-7 h-7 rounded-[8px] bg-[var(--ws-bg-elevated)] border border-[var(--ws-border)] flex items-center justify-center text-[var(--ws-text-tertiary)] transition-transform duration-300">
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
                                <span className="text-[20px] mb-1">{"\uD83D\uDCC5"}</span>
                                <span className="text-[15px] font-medium text-[var(--ws-text-secondary)]">Room left</span>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-[16px] font-bold text-[var(--ws-text-primary)]">{formatCurrency(p.tfsaRoom)}</span>
                                <span className="text-[13px] text-[var(--ws-text-tertiary)]">This year</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className="text-[20px] mb-1">{"\u23F1\uFE0F"}</span>
                                <span className="text-[15px] font-medium text-[var(--ws-text-secondary)]">Time to fill</span>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-[16px] font-bold text-[var(--ws-text-primary)]">
                                  {tfsaFillMonths !== null ? `${tfsaFillMonths.toFixed(1)} mo` : "n/a"}
                                </span>
                                <span className="text-[13px] text-[var(--ws-text-tertiary)]">
                                  {metrics.monthlySurplus > 0
                                    ? `At ${formatCurrency(metrics.monthlySurplus)}/mo`
                                    : "No surplus"}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className="text-[20px] mb-1">{"\uD83D\uDCCA"}</span>
                                <span className="text-[15px] font-medium text-[var(--ws-text-secondary)]">Utilization</span>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-[16px] font-bold text-[var(--ws-text-primary)]">{metrics.tfsaUtilization}%</span>
                                <span className="text-[13px] text-[var(--ws-text-tertiary)]">
                                  {formatCurrency(p.tfsaBalance)} invested
                                </span>
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
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-medium text-[var(--ws-text-secondary)]">FHSA</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--ws-accent-green)]/10 text-[var(--ws-accent-green)]">Triple tax</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[16px] font-bold text-[var(--ws-text-primary)]">{formatCurrency(p.fhsaBalance)}</span>
                      <span className="text-[13px] text-[var(--ws-text-tertiary)]">
                        {metrics.isFirstTimeBuyer
                          ? `${formatCurrency(fhsaRoomLeft)} room left`
                          : "Not eligible (homeowner)"}
                      </span>
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
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-medium text-[var(--ws-text-secondary)]">RRSP</span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--ws-accent-green)]/10 text-[var(--ws-accent-green)]">Tax-deferred</span>
                        </div>
                        <span className="px-1.5 py-0.5 bg-[var(--ws-bg-primary)] rounded font-semibold text-[11px] text-[var(--ws-text-primary)] tracking-wide">Managed</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[16px] font-bold text-[var(--ws-text-primary)]">{formatCurrency(p.rrspBalance)}</span>
                      <span className="text-[13px] text-[var(--ws-text-tertiary)]">
                        {formatCurrency(p.rrspRoom)} room | ~{formatCurrency(rrspRefundEstimate)} refund
                      </span>
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
                      <span className="text-[13px] text-[var(--ws-text-tertiary)]">No room limits</span>
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
                Edit Profile
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
            <div className="flex bg-[var(--ws-bg-dark)] p-[3px] rounded-full">
              {(["accounts", "expenses"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setEditSection(tab)}
                  className={`flex-1 text-[12px] font-bold py-1.5 rounded-full capitalize transition-all duration-200 ${editSection === tab
                    ? "text-[var(--ws-text-primary)] shadow-sm bg-[var(--ws-bg-elevated)]"
                    : "text-[var(--ws-text-tertiary)] hover:text-[var(--ws-text-primary)]"
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
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
                    Balances
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
                      label="Savings"
                      value={draft.savingsBalance}
                      min={0} max={150000} step={500}
                      onChange={(v) => updateField("savingsBalance", v)}
                      formatValue={formatCurrency}
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
                    <RangeSlider
                      label="Non-Registered"
                      value={draft.nonRegBalance}
                      min={0} max={200000} step={1000}
                      onChange={(v) => updateField("nonRegBalance", v)}
                      formatValue={formatCurrency}
                    />

                    <div className="border-t border-[var(--ws-border)] pt-3 mt-1">
                      <p className="text-[11px] text-[var(--ws-text-tertiary)] uppercase tracking-wider font-semibold mb-3">
                        Room
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
                      label="Credit card"
                      value={draft.creditCardBalance}
                      onChange={(v) => updateField("creditCardBalance", v)}
                    />

                    <div className="border-t border-[var(--ws-border)] pt-3 mt-1">
                      <p className="text-[11px] text-[var(--ws-text-tertiary)] uppercase tracking-wider font-semibold mb-3">
                        Location
                      </p>
                      <SelectInput
                        label="Province"
                        value={draft.province}
                        onChange={(v) => updateField("province", v)}
                        options={PROVINCE_OPTIONS}
                      />
                    </div>
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
                    Expenses
                  </p>
                  <div className="flex flex-col gap-4">
                    <SelectInput
                      label="Housing"
                      value={draft.housingType}
                      onChange={(v) => updateField("housingType", v as "rent" | "own")}
                      options={HOUSING_OPTIONS}
                    />
                    <CurrencyInput
                      label={draft.housingType === "rent" ? "Rent/mo" : "Mortgage/mo"}
                      value={draft.housingExpense}
                      onChange={(v) => updateField("housingExpense", v)}
                    />
                    <CurrencyInput
                      label="Essentials/mo"
                      value={draft.essentialExpenses}
                      onChange={(v) => updateField("essentialExpenses", v)}
                    />
                    <CurrencyInput
                      label="Fun/mo"
                      value={draft.discretionarySpending}
                      onChange={(v) => updateField("discretionarySpending", v)}
                    />
                    <CurrencyInput
                      label="Debt/mo"
                      value={draft.debtPayments}
                      onChange={(v) => updateField("debtPayments", v)}
                    />
                    {draft.housingType === "own" && (
                      <CurrencyInput
                        label="Mortgage"
                        value={draft.mortgageBalance}
                        onChange={(v) => updateField("mortgageBalance", v)}
                      />
                    )}
                  </div>

                  {/* Quick summary */}
                  <div className="mt-4 pt-3 border-t border-[var(--ws-border)]">
                    <div className="flex justify-between items-center">
                      <span className="text-[13px] text-[var(--ws-text-secondary)]">Total/mo</span>
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



      {/* Action Button (Closed Prompt) */}
      <AnimatePresence>
        {!showPromptOverlay && !isEditing && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", bounce: 0, duration: 0.5 }}
            className="w-full mt-2 mb-8"
          >
            <button
              type="button"
              onClick={handlePathfinderClick}
              className="w-full h-14 md:h-16 px-5 sm:px-6 rounded-[24px] bg-[var(--ws-bg-primary)] shadow-[var(--ws-shadow-lg)] border border-[var(--ws-border)] flex items-center gap-3 sm:gap-4 cursor-pointer hover:border-[var(--ws-text-tertiary)] hover:translate-y-[-2px] transition-all duration-300 group"
              aria-label="Open Pathfinder"
            >
              <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-[var(--ws-text-primary)] text-[var(--ws-bg-primary)] flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v5" />
                  <path d="M12 16v5" />
                  <path d="M3 12h5" />
                  <path d="M16 12h5" />
                  <path d="M6 6l3.5 3.5" />
                  <path d="M14.5 15.5l3.5 3.5" />
                  <path d="M5 19 L 10 14 C 12 12, 12 12, 14 10 L 19 5" />
                </svg>
              </div>
              <span className="font-medium text-[15px] sm:text-[16px] text-[var(--ws-text-secondary)] flex-1 truncate">
                {pathfinderTriggerLabel}
              </span>
              <div className="shrink-0 text-[13px] font-bold text-[var(--ws-text-inverse)] bg-[var(--ws-text-primary)] px-3.5 py-1.5 rounded-full transition-transform group-hover:scale-105">
                Ask
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {showPromptOverlay && mounted && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          <motion.div
            key="prompt-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-md z-40"
            onClick={closePromptOverlay}
          />
          <motion.div
            key="prompt-sheet"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0, transition: { duration: 0.3 } }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-6 left-0 right-0 z-50 flex flex-col justify-end w-full max-w-4xl mx-auto px-4"
          >
              <PromptInput
                onSubmit={(val) => {
                  closePromptOverlay();
                  setTimeout(() => {
                    onSubmit(val);
                  }, 300);
                }}
                chips={suggestionChips}
                placeholder={promptPlaceholder}
                initialText={promptSeed}
                autoFocus
              />
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
