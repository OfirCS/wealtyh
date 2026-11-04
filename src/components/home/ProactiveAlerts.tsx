"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { computeDerivedMetrics } from "@/lib/prompts";
import type { FinancialProfile, CustomFund } from "@/lib/types";

interface ProactiveAlertsProps {
  profile: FinancialProfile;
  customFunds: CustomFund[];
  onAlertTap: (prompt: string) => void;
}

interface Alert {
  icon: string;
  label: string;
  highlight: string;
  prompt: string;
  priority: number;
}

function generateAlerts(profile: FinancialProfile, customFunds: CustomFund[]): Alert[] {
  const metrics = computeDerivedMetrics(profile, customFunds);
  const alerts: Alert[] = [];

  // Credit card debt
  if (profile.creditCardBalance > 500) {
    const interest = Math.round(profile.creditCardBalance * 0.2);
    alerts.push({
      icon: "⚡",
      highlight: `$${interest.toLocaleString("en-CA")}/yr`,
      label: `/yr in card interest`,
      prompt: "Pay off my credit card debt",
      priority: 100,
    });
  }

  // Low emergency fund
  if (metrics.emergencyFundMonths < 3 && metrics.totalMonthlyExpenses > 0) {
    alerts.push({
      icon: "🛡",
      highlight: `${metrics.emergencyFundMonths} months`,
      label: ` emergency buffer`,
      prompt: "Build my emergency fund to 6 months",
      priority: 95,
    });
  }

  // First-time buyer with savings
  if (metrics.isFirstTimeBuyer && metrics.liquidAssets > 10000) {
    alerts.push({
      icon: "🏠",
      highlight: "FHSA",
      label: ` — triple tax benefit for first home`,
      prompt: "Should I open an FHSA for my first home?",
      priority: 88,
    });
  }

  // TFSA room
  if (profile.tfsaRoom > 3000) {
    alerts.push({
      icon: "📈",
      highlight: `$${profile.tfsaRoom.toLocaleString("en-CA")}`,
      label: ` unused TFSA room`,
      prompt: "Use my TFSA contribution room",
      priority: 85,
    });
  }

  // Surplus with no automation
  if (metrics.monthlySurplus > 500) {
    alerts.push({
      icon: "⚙",
      highlight: `$${Math.round(metrics.monthlySurplus).toLocaleString("en-CA")}/mo`,
      label: ` monthly surplus available`,
      prompt: "Set up automatic investing with my surplus",
      priority: 80,
    });
  }

  // RRSP room with good income
  if (profile.rrspRoom > 5000) {
    const taxSaving = Math.round(profile.rrspRoom * 0.3);
    alerts.push({
      icon: "💰",
      highlight: `$${taxSaving.toLocaleString("en-CA")}`,
      label: ` potential RRSP tax savings`,
      prompt: "Optimize my RRSP contributions",
      priority: 75,
    });
  }

  // Low savings rate
  if (metrics.savingsRate < 10 && metrics.savingsRate >= 0) {
    alerts.push({
      icon: "📊",
      highlight: `${metrics.savingsRate}%`,
      label: ` savings rate`,
      prompt: "Help me save more each month",
      priority: 70,
    });
  }

  return alerts.sort((a, b) => b.priority - a.priority).slice(0, 3);
}

export default function ProactiveAlerts({ profile, customFunds, onAlertTap }: ProactiveAlertsProps) {
  const alerts = useMemo(() => generateAlerts(profile, customFunds), [profile, customFunds]);

  if (alerts.length === 0) return null;

  return (
    <div className="w-full">
      <p className="text-[11px] font-semibold text-[var(--pf-text-tertiary)] uppercase tracking-wider mb-3 px-1">
        Pathfinder noticed
      </p>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        {alerts.map((alert, i) => (
          <motion.button
            key={alert.prompt}
            onClick={() => onAlertTap(alert.prompt)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-[var(--pf-bg-surface)] border border-[var(--pf-border)] rounded-[14px] text-left cursor-pointer hover:bg-[var(--pf-bg-primary)] transition-colors group min-h-[64px]"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.5, delay: 0.1 * i }}
          >
            <span className="text-[18px] flex-shrink-0">{alert.icon}</span>
            <p className="flex-1 text-[13px] text-[var(--pf-text-secondary)] leading-snug min-w-0">
              <span className="text-[var(--pf-text-primary)] font-semibold">{alert.highlight}</span>
              {alert.label}
            </p>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              className="flex-shrink-0 text-[var(--pf-text-tertiary)] group-hover:text-[var(--pf-text-secondary)] transition-colors"
            >
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
