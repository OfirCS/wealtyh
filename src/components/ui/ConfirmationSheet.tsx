"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { QuickAction } from "@/lib/types";

interface ConfirmationSheetProps {
  action: QuickAction;
  onConfirm: () => void;
  onCancel: () => void;
}

const TYPE_LABELS: Record<QuickAction["type"], string> = {
  move: "Transfer",
  create_fund: "New Goal",
  automate: "Automation",
  open_account: "Open Account",
  pause: "Pause",
  adjust: "Adjust",
  pay_off: "Pay Off",
};

function formatAmount(amount?: number): string {
  if (!amount) return "";
  return `$${amount.toLocaleString("en-CA")}`;
}

export default function ConfirmationSheet({
  action,
  onConfirm,
  onCancel,
}: ConfirmationSheetProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const isTransfer = action.type === "move" || action.type === "pay_off";
  const isAutomation = action.type === "automate" && action.automation;

  const handleConfirm = () => {
    if (isTransfer && !confirmed) {
      setConfirmed(true);
      return;
    }

    // Trigger success animation instead of closing immediately
    setIsSuccess(true);

    // Auto-dismiss after providing satisfying feedback
    setTimeout(() => {
      onConfirm();
    }, 1500);
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      {/* Sheet */}
      <motion.div
        className="relative w-full max-w-[430px] bg-[var(--ws-bg-surface)] rounded-[28px] shadow-2xl overflow-hidden"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
      >
        <div className="px-6 pb-8 pt-6">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold text-[var(--ws-text-tertiary)] uppercase tracking-[0.06em]">
              {TYPE_LABELS[action.type]}
            </span>
          </div>
          <h3 className="text-[22px] font-bold text-[var(--ws-text-primary)] leading-tight mb-4">
            {action.title}
          </h3>

          {/* Transfer details */}
          {isTransfer && (
            <div className="bg-[var(--ws-bg-surface)] rounded-[20px] border border-[var(--ws-border)] p-5 mb-5 relative flex items-center justify-between">
              <div className="flex-1">
                <p className="text-[11px] text-[var(--ws-text-tertiary)] uppercase tracking-wider mb-1">From</p>
                <p className="text-[16px] font-semibold text-[var(--ws-text-primary)]">
                  {action.from_account || "Chequing"}
                </p>
              </div>

              <div className="shrink-0 w-8 h-8 rounded-full bg-[var(--ws-bg-primary)] border border-[var(--ws-border)] flex items-center justify-center z-10 mx-2 shadow-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[var(--ws-text-secondary)]">
                  <path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <div className="flex-1 text-right">
                <p className="text-[11px] text-[var(--ws-text-tertiary)] uppercase tracking-wider mb-1">To</p>
                <p className="text-[16px] font-semibold text-[var(--ws-text-primary)]">
                  {action.to_account || "Savings"}
                </p>
              </div>
            </div>
          )}

          {isTransfer && typeof action.amount === 'number' && action.amount > 0 && (
            <div className="mb-6 flex justify-center">
              <p className="text-[40px] font-medium text-[var(--ws-text-primary)] tracking-tight tabular-nums">
                {formatAmount(action.amount)}
              </p>
            </div>
          )}

          {/* Automation builder visual */}
          {isAutomation && action.automation && (
            <div className="bg-[#1A1A1A] rounded-[24px] p-5 mb-5 border border-[var(--ws-border)] shadow-sm">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-[#183626] flex items-center justify-center border border-[#2DE58920]">
                    <span className="text-[15px]">&#x1F504;</span>
                  </div>
                  <div>
                    <p className="text-[11px] text-[var(--ws-text-tertiary)] uppercase tracking-[0.05em] mb-0.5" style={{ textShadow: "0px 1px 2px rgba(0,0,0,0.5)" }}>Every</p>
                    <p className="text-[16px] font-semibold text-[var(--ws-text-primary)] capitalize">
                      {action.automation.frequency}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-[#1C2333] flex items-center justify-center border border-[#6BA3FF20]">
                    <span className="text-[15px]">&#x1F4B0;</span>
                  </div>
                  <div>
                    <p className="text-[11px] text-[var(--ws-text-tertiary)] uppercase tracking-[0.05em] mb-0.5">Amount</p>
                    <p className="text-[16px] font-semibold text-[var(--ws-text-primary)]">
                      {formatAmount(action.automation.amount)}
                    </p>
                  </div>
                </div>
                {action.automation.duration_months && (
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full bg-[#332A13] flex items-center justify-center border border-[#FFD60A20]">
                      <span className="text-[15px]">&#x23F3;</span>
                    </div>
                    <div>
                      <p className="text-[11px] text-[var(--ws-text-tertiary)] uppercase tracking-[0.05em] mb-0.5">Duration</p>
                      <p className="text-[16px] font-semibold text-[var(--ws-text-primary)]">
                        {action.automation.duration_months} months
                      </p>
                    </div>
                  </div>
                )}
                {action.automation.target_amount && (
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full bg-[#361818] flex items-center justify-center border border-[#D23A3A20]">
                      <span className="text-[15px]">&#x1F3AF;</span>
                    </div>
                    <div>
                      <p className="text-[11px] text-[var(--ws-text-tertiary)] uppercase tracking-[0.05em] mb-0.5">Target</p>
                      <p className="text-[16px] font-semibold text-[var(--ws-text-primary)]">
                        {formatAmount(action.automation.target_amount)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              {/* Visual timeline */}
              {action.automation.duration_months && action.automation.target_amount && (
                <div className="mt-6 pt-5 border-t border-[var(--ws-border)]">
                  <div className="flex justify-between items-end mb-1.5 px-1">
                    <span className="text-[12px] text-[var(--ws-text-tertiary)] font-medium">Now</span>
                    <span className="text-[12px] text-[var(--ws-text-tertiary)] font-medium">
                      {action.automation.duration_months}mo
                    </span>
                  </div>
                  <div className="h-2.5 bg-[#2B2B2A] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-[#528A36] rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      transition={{ type: "spring", bounce: 0, duration: 1.5, delay: 0.2 }}
                    />
                  </div>
                  <p className="text-center text-[13px] font-bold text-[#528A36] mt-2.5 tracking-tight">
                    {formatAmount(action.automation.target_amount)} goal
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Goal creation visual */}
          {action.type === "create_fund" && (
            <div className="bg-[var(--ws-bg-surface)] rounded-[20px] p-5 mb-5 border border-[var(--ws-border)] flex flex-col justify-center items-center text-center">
              <div className="w-14 h-14 rounded-full bg-[var(--ws-bg-primary)] border border-[var(--ws-border)] shadow-sm flex items-center justify-center mb-4">
                <span className="text-[24px]">🎯</span>
              </div>
              <p className="text-[18px] font-semibold text-[var(--ws-text-primary)] mb-1">
                {action.to_account || "New Goal"}
              </p>
              <p className="text-[13px] text-[var(--ws-text-secondary)]">
                Savings Goal
              </p>

              {typeof action.amount === 'number' && action.amount > 0 && (
                <div className="mt-5 pt-4 border-t border-[var(--ws-border)] w-full">
                  <p className="text-[11px] text-[var(--ws-text-tertiary)] uppercase tracking-wider mb-1">Initial Deposit</p>
                  <p className="text-[28px] font-medium text-[var(--ws-text-primary)] tracking-tight">{formatAmount(action.amount)}</p>
                </div>
              )}
            </div>
          )}

          {/* Open account visual */}
          {action.type === "open_account" && (
            <div className="bg-[var(--ws-bg-surface)] rounded-[20px] p-5 mb-5 border border-[var(--ws-border)] flex flex-col justify-center items-center text-center">
              <div className="w-14 h-14 rounded-full bg-[var(--ws-text-primary)] flex items-center justify-center mb-4 shadow-sm">
                <span className="text-white font-serif italic text-[24px]">W</span>
              </div>
              <p className="text-[18px] font-semibold text-[var(--ws-text-primary)] mb-1">
                {action.to_account || action.title}
              </p>
              <p className="text-[13px] text-[var(--ws-text-secondary)]">
                New Account
              </p>
            </div>
          )}

          {/* Why section */}
          <p className="text-[14px] text-[var(--ws-text-secondary)] leading-relaxed mb-6">
            {action.why}
          </p>

          {/* Action states (Initial -> Confirm -> Success) */}
          <AnimatePresence mode="wait">
            {isSuccess ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-6"
              >
                <div className="w-16 h-16 rounded-full bg-[var(--ws-accent-green)] flex items-center justify-center mb-4">
                  <svg
                    width="24" height="24" viewBox="0 0 24 24" fill="none"
                  >
                    <motion.path
                      d="M5 13l4 4L19 7"
                      stroke="white"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.5, ease: "easeOut" as const }}
                    />
                  </svg>
                </div>
                <h3 className="text-[20px] font-bold text-[var(--ws-text-primary)] tracking-tight mb-2">
                  {isAutomation ? "Active" : action.type === "create_fund" ? "Created" : action.type === "open_account" ? "Opened" : "Sent"}
                </h3>
                <p className="text-[14px] text-[var(--ws-text-secondary)] text-center">
                  Done.
                </p>
              </motion.div>
            ) : isTransfer && confirmed ? (
              <motion.div
                key="confirmed"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-3"
              >
                <div className="bg-[var(--ws-bg-elevated)] border border-[var(--ws-border)] rounded-[12px] px-4 py-3 flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-[var(--ws-text-secondary)] flex-shrink-0">
                    <path d="M8 1.5L14.5 13.5H1.5L8 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M8 6.5V9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
                  </svg>
                  <p className="text-[13px] text-[var(--ws-text-primary)]">
                    Move {formatAmount(action.amount)}: {action.from_account || "Chequing"} &rarr; {action.to_account || "Savings"}
                  </p>
                </div>
                <button
                  onClick={handleConfirm}
                  className="w-full py-3.5 rounded-full text-[16px] font-bold cursor-pointer transition-all active:scale-[0.98]"
                  style={{ backgroundColor: "var(--ws-text-primary)", color: "var(--ws-bg-primary)" }}
                >
                  Confirm
                </button>
                <button
                  onClick={onCancel}
                  className="w-full py-2 text-[14px] text-[var(--ws-text-tertiary)] cursor-pointer bg-transparent border-none hover:text-[var(--ws-text-secondary)] transition-colors"
                >
                  Cancel
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="initial"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col gap-3"
              >
                <button
                  onClick={handleConfirm}
                  className="w-full py-3.5 rounded-full text-[16px] font-bold cursor-pointer transition-all active:scale-[0.98]"
                  style={{ backgroundColor: "var(--ws-text-primary)", color: "var(--ws-bg-primary)" }}
                >
                  {isTransfer ? "Review" : isAutomation ? "Set up" : action.type === "create_fund" ? "Create" : action.type === "open_account" ? "Open" : "Confirm"}
                </button>
                <button
                  onClick={onCancel}
                  className="w-full py-2 text-[14px] text-[var(--ws-text-tertiary)] cursor-pointer bg-transparent border-none hover:text-[var(--ws-text-secondary)] transition-colors"
                >
                  Not now
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
