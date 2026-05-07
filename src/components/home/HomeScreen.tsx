"use client";

import { useState, useCallback, useMemo, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { getDynamicSuggestionChips } from "@/lib/defaults";
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
  const [editSection, setEditSection] = useState<"accounts" | "expenses">("accounts");
  const [summaryVisible, setSummaryVisible] = useState(true);
  const [showPromptOverlay, setShowPromptOverlay] = useState(false);
  const [promptSeed, setPromptSeed] = useState("");
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );


  const p = profile;
  const suggestionChips = useMemo(
    () => getDynamicSuggestionChips(p, customFunds),
    [p, customFunds],
  );
  const promptPlaceholder = "What's changing in your life?";

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

  const hasAnyAccount =
    p.chequingBalance > 0 ||
    p.savingsBalance > 0 ||
    p.tfsaBalance > 0 ||
    p.fhsaBalance > 0 ||
    p.rrspBalance > 0 ||
    p.nonRegBalance > 0 ||
    p.creditCardBalance > 0 ||
    customFunds.length > 0;

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
            <div className="flex justify-between items-end mb-6 px-1 mt-4">
              <div className="flex flex-col">
                <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--ws-text-tertiary)] mb-1.5">
                  {hasAnyAccount ? 'Your money' : 'Welcome'}
                </span>
                <h2 className="text-[40px] leading-none font-serif tracking-tight text-[var(--ws-text-primary)] tabular-nums">
                  {hasAnyAccount ? formatCurrency(totalBalance) : 'Hi there'}
                </h2>
              </div>
              {hasAnyAccount && (
                <button
                  type="button"
                  onClick={startEdit}
                  className="text-[13px] font-medium text-[var(--ws-text-secondary)] hover:text-[var(--ws-text-primary)] transition-colors cursor-pointer underline-offset-4 hover:underline"
                  aria-label="Edit accounts"
                >
                  Edit
                </button>
              )}
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
                  <div className="bg-[var(--ws-bg-surface)] rounded-[16px] p-4 shadow-sm border border-[var(--ws-border)] flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <span className="text-[20px]" aria-hidden>{"💳"}</span>
                      <span className="text-[15px] font-semibold text-[var(--ws-text-primary)]">Credit card</span>
                    </div>
                    <span className="text-[16px] font-bold tabular-nums" style={{ color: '#D94343' }}>
                      −{formatCurrency(p.creditCardBalance)}
                    </span>
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
                  <div className="bg-[var(--ws-bg-surface)] rounded-[16px] p-4 shadow-sm border border-[var(--ws-border)] flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <span className="text-[20px]" aria-hidden>{"💳"}</span>
                      <span className="text-[15px] font-semibold text-[var(--ws-text-primary)]">Chequing</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[16px] font-bold text-[var(--ws-text-primary)] tabular-nums">
                        {formatCurrency(p.chequingBalance)}
                      </span>
                      {showSummary && appliedSummary?.balanceChanges.chequingBalance && (
                        <BalanceChange delta={appliedSummary.balanceChanges.chequingBalance} />
                      )}
                    </div>
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
                  <div className="bg-[var(--ws-bg-surface)] rounded-[16px] p-4 shadow-sm border border-[var(--ws-border)] flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <span className="text-[20px]" aria-hidden>{"\uD83D\uDCB5"}</span>
                      <span className="text-[15px] font-semibold text-[var(--ws-text-primary)]">Savings</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[16px] font-bold text-[var(--ws-text-primary)] tabular-nums">
                        {formatCurrency(p.savingsBalance)}
                      </span>
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
                  <div className="bg-[var(--ws-bg-surface)] rounded-[16px] p-4 shadow-sm border border-[var(--ws-border)] flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <span className="text-[20px]" aria-hidden>{"\uD83D\uDCC8"}</span>
                      <div className="flex flex-col">
                        <span className="text-[15px] font-semibold text-[var(--ws-text-primary)]">Tax-free savings</span>
                        <span className="text-[11px] text-[var(--ws-text-tertiary)]">TFSA</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[16px] font-bold text-[var(--ws-text-primary)] tabular-nums">
                        {formatCurrency(p.tfsaBalance)}
                      </span>
                      {showSummary && appliedSummary?.balanceChanges.tfsaBalance && (
                        <BalanceChange delta={appliedSummary.balanceChanges.tfsaBalance} />
                      )}
                    </div>
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
                  <div className="bg-[var(--ws-bg-surface)] rounded-[16px] p-4 shadow-sm border border-[var(--ws-border)] flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <span className="text-[20px]" aria-hidden>{"\uD83C\uDFE0"}</span>
                      <div className="flex flex-col">
                        <span className="text-[15px] font-semibold text-[var(--ws-text-primary)]">First home savings</span>
                        <span className="text-[11px] text-[var(--ws-text-tertiary)]">FHSA</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[16px] font-bold text-[var(--ws-text-primary)] tabular-nums">
                        {formatCurrency(p.fhsaBalance)}
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
                  <div className="bg-[var(--ws-bg-surface)] rounded-[16px] p-4 shadow-sm border border-[var(--ws-border)] flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <span className="text-[20px]" aria-hidden>{"\uD83C\uDFD6\uFE0F"}</span>
                      <div className="flex flex-col">
                        <span className="text-[15px] font-semibold text-[var(--ws-text-primary)]">Retirement</span>
                        <span className="text-[11px] text-[var(--ws-text-tertiary)]">RRSP</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[16px] font-bold text-[var(--ws-text-primary)] tabular-nums">
                        {formatCurrency(p.rrspBalance)}
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
                  <div className="bg-[var(--ws-bg-surface)] rounded-[16px] p-4 shadow-sm border border-[var(--ws-border)] flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <span className="text-[20px]" aria-hidden>{"\uD83D\uDCCA"}</span>
                      <span className="text-[15px] font-semibold text-[var(--ws-text-primary)]">Investments</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[16px] font-bold text-[var(--ws-text-primary)] tabular-nums">
                        {formatCurrency(p.nonRegBalance)}
                      </span>
                      {showSummary && appliedSummary?.balanceChanges.nonRegBalance && (
                        <BalanceChange delta={appliedSummary.balanceChanges.nonRegBalance} />
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Empty state — no accounts yet */}
            {!hasAnyAccount && (
              <motion.button
                key="empty-state"
                type="button"
                onClick={startEdit}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                className="w-full text-left rounded-[20px] border border-dashed border-[var(--ws-border-hover)] bg-[var(--ws-bg-surface)] p-5 hover:bg-[var(--ws-bg-hover)] transition-colors cursor-pointer"
                aria-label="Add your accounts"
              >
                <div className="flex items-start gap-3">
                  <div className="text-[26px]">👋</div>
                  <div className="flex-1">
                    <div className="text-[15px] font-semibold text-[var(--ws-text-primary)] mb-0.5">
                      Add your accounts
                    </div>
                    <div className="text-[13px] leading-relaxed text-[var(--ws-text-secondary)]">
                      Tap to fill in chequing, savings, TFSA, RRSP — whatever you have. It stays on your device.
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-1 text-[var(--ws-text-tertiary)]" aria-hidden>
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </div>
              </motion.button>
            )}

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
              className="w-full p-5 sm:p-6 rounded-[24px] bg-[var(--ws-text-primary)] text-[var(--ws-bg-primary)] flex flex-col items-start gap-2 cursor-pointer hover:translate-y-[-2px] transition-all duration-300 group shadow-[0_12px_30px_rgba(0,0,0,0.18)]"
              aria-label="Plan a life change"
            >
              <span className="text-[12px] uppercase tracking-[0.1em] font-semibold opacity-60">
                Ask Pathfinder
              </span>
              <span className="text-[22px] sm:text-[24px] font-serif leading-tight text-left">
                What&rsquo;s changing in your life?
              </span>
              <span className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-medium opacity-80 group-hover:opacity-100 transition-opacity">
                Try it
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </span>
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
