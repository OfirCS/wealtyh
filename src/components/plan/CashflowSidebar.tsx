"use client";

import { motion } from "framer-motion";
import type { CashflowPoint, QuickAction } from "@/lib/types";
import { CountUp } from "@/components/ui/CountUp";

interface CashflowCardProps {
  cashflow: CashflowPoint[];
  actions?: QuickAction[];
}

function formatAmount(amount: number): string {
  const abs = Math.abs(amount);
  const formatted =
    abs >= 1000
      ? `$${(abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}K`
      : `$${abs.toLocaleString()}`;
  return amount < 0 ? `-${formatted}` : `+${formatted}`;
}

function formatDollar(amount: number): string {
  const abs = Math.abs(amount);
  return `$${abs.toLocaleString("en-CA", { maximumFractionDigits: 0 })}`;
}

export default function CashflowCard({ cashflow, actions = [] }: CashflowCardProps) {
  if (!cashflow || cashflow.length === 0) return null;

  // Compute total monthly automation from actions
  const automationActions = actions.filter(a => a.type === 'automate' && a.automation && a.automation.amount > 0);
  const totalMonthlyAutomation = automationActions.reduce((sum, a) => sum + (a.automation?.amount ?? 0), 0);

  const maxAbs = Math.max(...cashflow.map((p) => Math.abs(p.amount)), 1);
  const current = cashflow[0];
  const lowestPhase = cashflow.reduce((min, p) => p.amount < min.amount ? p : min, cashflow[0]);
  const highestPhase = cashflow.reduce((max, p) => p.amount > max.amount ? p : max, cashflow[0]);
  const hasNegative = cashflow.some((p) => p.amount < 0);
  const allPositive = cashflow.every((p) => p.amount > 0);
  const endPhase = cashflow[cashflow.length - 1];
  const delta = endPhase.amount - current.amount;

  // Verdict logic
  const isComfortable = allPositive && lowestPhase.amount > current.amount * 0.3;
  const isTight = allPositive && !isComfortable;
  // hasNegative already defined

  const verdictColor = hasNegative
    ? "var(--ws-accent-red)"
    : isTight
      ? "#C08B00"
      : "var(--ws-accent-green)";
  const verdictBg = hasNegative
    ? "rgba(217, 67, 67, 0.08)"
    : isTight
      ? "rgba(192, 139, 0, 0.08)"
      : "rgba(43, 122, 66, 0.08)";
  const verdictText = hasNegative
    ? "Some months go negative — plan carefully"
    : isTight
      ? "Affordable, but some months are tighter"
      : "You can comfortably afford this plan";
  const verdictIcon = hasNegative ? "⚠" : isTight ? "→" : "✓";

  return (
    <div className="flex flex-col gap-8">
      {/* Verdict banner */}
      <motion.div
        className="flex items-center gap-3 px-5 py-4 rounded-[16px] border"
        style={{ backgroundColor: verdictBg, borderColor: `${verdictColor}20` }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0, duration: 0.5 }}
      >
        <span className="text-[18px] shrink-0" style={{ color: verdictColor }}>{verdictIcon}</span>
        <p className="text-[15px] font-semibold" style={{ color: verdictColor }}>
          {verdictText}
        </p>
      </motion.div>

      {/* Top: Current surplus + after plan */}
      <div className="flex flex-col md:flex-row gap-6 md:gap-10">
        {/* Current surplus card */}
        <motion.div
          className="flex-1 p-5 sm:p-6 rounded-[20px] border border-[var(--ws-border)] bg-[var(--ws-bg-surface)]"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", bounce: 0, duration: 0.6, delay: 0.1 }}
        >
          <p className="text-[11px] text-[var(--ws-text-tertiary)] uppercase tracking-wider font-semibold mb-2">
            Now
          </p>
          <p className={`font-serif text-[42px] sm:text-[52px] tracking-tight leading-none ${current.amount >= 0 ? "text-[var(--ws-text-primary)]" : "text-[var(--ws-accent-red)]"}`}>
            <CountUp value={current.amount} formatFn={formatAmount} duration={1.2} />
            <span className="font-sans text-[16px] text-[var(--ws-text-tertiary)] font-normal ml-1.5 tracking-normal">/mo</span>
          </p>
          <p className="text-[12px] text-[var(--ws-text-tertiary)] mt-2">Left over each month after bills</p>
        </motion.div>

        {/* After plan card */}
        <motion.div
          className="flex-1 p-5 sm:p-6 rounded-[20px] border border-[var(--ws-border)] bg-[var(--ws-bg-surface)]"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", bounce: 0, duration: 0.6, delay: 0.2 }}
        >
          <p className="text-[11px] text-[var(--ws-text-tertiary)] uppercase tracking-wider font-semibold mb-2">
            After Plan
          </p>
          <p className={`font-serif text-[42px] sm:text-[52px] tracking-tight leading-none ${endPhase.amount >= 0 ? "text-[var(--ws-text-primary)]" : "text-[var(--ws-accent-red)]"}`}>
            <CountUp value={endPhase.amount} formatFn={formatAmount} duration={1.2} />
            <span className="font-sans text-[16px] text-[var(--ws-text-tertiary)] font-normal ml-1.5 tracking-normal">/mo</span>
          </p>
          <p className="text-[12px] text-[var(--ws-text-tertiary)] mt-2">
            {delta === 0
              ? "Same as before — plan reallocates without reducing surplus"
              : delta > 0
                ? `+${formatDollar(delta)}/mo more than today`
                : `${formatDollar(Math.abs(delta))}/mo redirected to savings & goals`}
          </p>
          {totalMonthlyAutomation > 0 && (
            <p className="text-[11px] font-medium text-[var(--ws-accent-green)] mt-1.5">
              Includes ${formatDollar(totalMonthlyAutomation)}/mo in automatic deposits
            </p>
          )}
        </motion.div>
      </div>

      {/* Phase-by-phase breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0, duration: 0.6, delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[11px] text-[var(--ws-text-tertiary)] uppercase tracking-wider font-semibold">
              Surplus Over Time
            </p>
            <div className="flex items-center gap-4 mt-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[var(--ws-text-primary)]" />
                <span className="text-[11px] text-[var(--ws-text-tertiary)]">Now</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[var(--ws-accent-green)]" />
                <span className="text-[11px] text-[var(--ws-text-tertiary)]">After actions</span>
              </div>
              {hasNegative && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[var(--ws-accent-red)]" />
                  <span className="text-[11px] text-[var(--ws-text-tertiary)]">Deficit</span>
                </div>
              )}
            </div>
          </div>
          {hasNegative && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(164, 61, 18, 0.15)', color: 'var(--ws-accent-red)' }}>
              Deficit
            </span>
          )}
          {allPositive && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(72, 102, 53, 0.15)', color: 'var(--ws-accent-green)' }}>
              All positive
            </span>
          )}
        </div>

        <div className="space-y-4">
          {cashflow.map((point, i) => {
            const isNegative = point.amount < 0;
            const barWidth = Math.max(6, (Math.abs(point.amount) / maxAbs) * 100);
            const isLowest = point === lowestPhase && cashflow.length > 2;
            const isCurrent = i === 0;

            return (
              <motion.div
                key={i}
                className="group"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", bounce: 0, duration: 0.5, delay: 0.35 + i * 0.08 }}
              >
                <div className="flex items-center gap-4 mb-1.5">
                  {/* Phase name */}
                  <div className="w-[140px] sm:w-[160px] flex-shrink-0 flex items-center gap-2">
                    {isCurrent && (
                      <div className="w-2 h-2 rounded-full bg-[var(--ws-text-primary)] shrink-0" />
                    )}
                    <span className={`text-[13px] sm:text-[14px] font-semibold leading-tight ${isCurrent ? 'text-[var(--ws-text-primary)]' : 'text-[var(--ws-text-secondary)]'}`}>
                      {point.phase}
                    </span>
                  </div>

                  {/* Bar */}
                  <div className="flex-1 h-3 bg-[var(--ws-border)] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        backgroundColor: isNegative
                          ? "var(--ws-accent-red)"
                          : isCurrent
                            ? "var(--ws-text-primary)"
                            : "var(--ws-accent-green)",
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${barWidth}%` }}
                      transition={{
                        type: "spring",
                        bounce: 0,
                        duration: 0.8,
                        delay: 0.4 + i * 0.1,
                      }}
                    />
                  </div>

                  {/* Amount */}
                  <div className="w-[80px] text-right flex-shrink-0">
                    <span
                      className={`font-mono text-[15px] sm:text-[17px] font-bold tracking-tight leading-none ${isNegative ? "text-[var(--ws-accent-red)]" : isCurrent ? "text-[var(--ws-text-primary)]" : "text-[var(--ws-accent-green)]"}`}
                    >
                      <CountUp value={point.amount} formatFn={formatAmount} duration={1.2} />
                    </span>
                  </div>
                </div>

                {/* Annotation for notable phases */}
                {isLowest && point !== current && point.amount < current.amount && (
                  <p className="text-[11px] text-[var(--ws-text-tertiary)] ml-[160px] sm:ml-[180px] mt-0.5">
                    Tightest — {formatDollar(Math.abs(point.amount))}/mo
                  </p>
                )}
                {/* Automation annotations for non-current phases */}
                {!isCurrent && automationActions.length > 0 && (
                  <div className="flex flex-wrap gap-1 ml-[160px] sm:ml-[180px] mt-0.5">
                    {automationActions.map((a, j) => (
                      <span key={j} className="text-[10px] text-[var(--ws-accent-green)] font-medium">
                        {a.automation?.amount ? `$${a.automation.amount.toLocaleString('en-CA')}/mo` : ''} → {a.to_account}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Bottom summary */}
      <motion.div
        className="p-4 rounded-[16px] border border-[var(--ws-border)] bg-[var(--ws-bg-surface)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.4 }}
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--ws-bg-primary)] border border-[var(--ws-border)] flex items-center justify-center text-[14px] shrink-0 mt-0.5">
            {hasNegative ? '⚠️' : '✓'}
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[var(--ws-text-primary)] mb-0.5">
              {hasNegative
                ? "Tight months ahead"
                : lowestPhase.amount < current.amount * 0.5
                  ? "Reduced in some phases"
                  : "Strong throughout"}
            </p>
            <p className="text-[12px] text-[var(--ws-text-secondary)] leading-relaxed">
              {hasNegative
                ? `"${lowestPhase.phase}" has a ${formatDollar(Math.abs(lowestPhase.amount))}/mo gap — ensure savings cover it.`
                : lowestPhase.amount < current.amount
                  ? `Lowest: "${lowestPhase.phase}" at ${formatAmount(lowestPhase.amount)}/mo — still positive.`
                  : `All phases above ${formatAmount(lowestPhase.amount)}/mo.`}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
