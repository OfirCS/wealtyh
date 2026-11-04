"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/money";
import { playSound } from "@/lib/sounds";
import type { CustomFund, FinancialProfile } from "@/lib/types";

type AmountField = {
  [K in keyof FinancialProfile]: FinancialProfile[K] extends number ? K : never;
}[keyof FinancialProfile];

interface NumbersListProps {
  profile: FinancialProfile;
  customFunds: CustomFund[];
  onProfileChange: (profile: FinancialProfile) => void;
  onCustomFundsChange: (customFunds: CustomFund[]) => void;
  /** Side panel version: the largest balances only, with everything else a click away. */
  compact?: boolean;
  onShowAll?: () => void;
}

// The side panel stays this short so it fits any window height
const COMPACT_ROWS = 6;

const ACCOUNTS: { field: AmountField; label: string; owed?: boolean }[] = [
  { field: "chequingBalance", label: "Chequing" },
  { field: "savingsBalance", label: "Savings" },
  { field: "tfsaBalance", label: "TFSA" },
  { field: "rrspBalance", label: "RRSP" },
  { field: "fhsaBalance", label: "FHSA" },
  { field: "nonRegBalance", label: "Other investments" },
  { field: "creditCardBalance", label: "Credit cards", owed: true },
  { field: "mortgageBalance", label: "Mortgage", owed: true },
];

const DETAILS: { field: AmountField; label: string }[] = [
  { field: "annualIncome", label: "Yearly income" },
  { field: "partnerIncome", label: "Partner's yearly income" },
  { field: "housingExpense", label: "Housing, monthly" },
  { field: "essentialExpenses", label: "Essentials, monthly" },
  { field: "discretionarySpending", label: "Fun, monthly" },
  { field: "debtPayments", label: "Debt payments, monthly" },
  { field: "tfsaRoom", label: "TFSA room" },
  { field: "rrspRoom", label: "RRSP room" },
];

function Row({ label, value, owed, onChange }: { label: string; value: number; owed?: boolean; onChange: (value: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");

  const commit = () => {
    const digits = text.replace(/[^\d]/g, "");
    setEditing(false);
    if (digits && Number(digits) !== value) {
      onChange(Number(digits));
      playSound("pop");
    }
  };

  return (
    <li className="flex min-h-[46px] items-center justify-between gap-4 border-b border-[var(--pf-border)]">
      <span className="text-[16px]">{label}</span>
      {editing ? (
        <input
          autoFocus
          inputMode="numeric"
          aria-label={label}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onFocus={(event) => event.target.select()}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
            if (event.key === "Escape") setEditing(false);
          }}
          className="w-[130px] border-b-2 border-[var(--pf-text-primary)] bg-transparent text-right text-[16px] outline-none"
        />
      ) : (
        <button
          type="button"
          aria-label={`Change ${label}, now ${formatMoney(value)}`}
          onClick={() => {
            setText(String(value));
            setEditing(true);
          }}
          className="-mr-2 cursor-pointer rounded-md px-2 py-1 text-[16px] transition-colors hover:bg-[var(--pf-bg-hover)]"
        >
          {owed && value > 0 ? "−" : ""}{formatMoney(value)}
        </button>
      )}
    </li>
  );
}

/** Every number Pathfinder knows, each one a click away from being changed. */
export default function NumbersList({ profile, customFunds, onProfileChange, onCustomFundsChange, compact, onShowAll }: NumbersListProps) {
  const accounts = ACCOUNTS.filter((account) => compact ? profile[account.field] > 0 : true);
  const rows = [
    ...accounts.map((account) => ({
      key: account.field,
      label: account.label,
      owed: account.owed,
      value: profile[account.field],
      onChange: (value: number) => onProfileChange({ ...profile, [account.field]: value }),
    })),
    ...customFunds.map((fund) => ({
      key: fund.name,
      label: fund.name,
      owed: false,
      value: fund.balance,
      onChange: (value: number) => onCustomFundsChange(customFunds.map((item) => (item.name === fund.name ? { ...item, balance: value } : item))),
    })),
  ];
  const shown = compact ? [...rows].sort((a, b) => b.value - a.value).slice(0, COMPACT_ROWS) : rows;

  return (
    <section>
      {compact && <h2 className="border-b border-[var(--pf-text-primary)] pb-3 font-serif text-[24px]">Your numbers</h2>}
      <ul className={compact ? "" : "sm:grid sm:grid-cols-2 sm:gap-x-8"}>
        {shown.map((row) => <Row key={row.key} label={row.label} owed={row.owed} value={row.value} onChange={row.onChange} />)}
        {!compact && DETAILS.map((detail) => (
          <Row
            key={detail.field}
            label={detail.label}
            value={profile[detail.field]}
            onChange={(value) => onProfileChange({ ...profile, [detail.field]: value })}
          />
        ))}
      </ul>
      {compact && <button type="button" className="pf-link mt-3" onClick={onShowAll}>See all my numbers</button>}
    </section>
  );
}
