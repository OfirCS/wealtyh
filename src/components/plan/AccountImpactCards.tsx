"use client";

import { motion } from "framer-motion";
import type { AccountImpact } from "@/lib/types";

interface AccountImpactCardsProps {
    impacts: AccountImpact[];
}

function getStatusColor(status: AccountImpact["status"]) {
    switch (status) {
        case "positive":
            return "text-[var(--ws-accent-green)]";
        case "negative":
            return "text-[var(--ws-accent-red)]";
        case "warning":
            return "text-[var(--ws-accent-yellow)]";
        case "neutral":
        default:
            return "text-[var(--ws-text-primary)]";
    }
}

function getStatusBgColor(status: AccountImpact["status"]) {
    switch (status) {
        case "positive":
            return "bg-[var(--ws-accent-green)] opacity-10";
        case "negative":
            return "bg-[var(--ws-accent-red)] opacity-10";
        case "warning":
            return "bg-[var(--ws-accent-yellow)] opacity-10";
        case "neutral":
        default:
            return "bg-[var(--ws-border)] opacity-30";
    }
}

function formatAmount(amount: number): string {
    return `$${amount.toLocaleString()}`;
}

export default function AccountImpactCards({ impacts }: AccountImpactCardsProps) {
    if (!impacts || impacts.length === 0) return null;

    return (
        <div className="mb-8">
            <h3 className="text-[var(--ws-text-primary)] text-[20px] font-serif tracking-tight mb-4">
                Account Impacts
            </h3>
            <div className="flex overflow-x-auto gap-4 snap-x snap-mandatory pb-4 -mx-5 px-5 hide-scrollbar">
                {impacts.map((impact, i) => (
                    <motion.div
                        key={i}
                        className="bg-[var(--ws-bg-surface)] rounded-[var(--ws-radius-lg)] border border-[var(--ws-border)] p-5 shadow-sm flex flex-col relative overflow-hidden w-[280px] shrink-0 scroll-ml-5 snap-start"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                            duration: 0.4,
                            ease: "easeOut",
                            delay: 0.2 + i * 0.1,
                        }}
                    >
                        {/* Soft background glow based on status */}
                        <div
                            className={`absolute -right-12 -top-12 w-32 h-32 rounded-full blur-2xl ${getStatusBgColor(
                                impact.status
                            )}`}
                        />

                        <div className="flex flex-col mb-4 relative z-10">
                            <h4 className="text-[var(--ws-text-primary)] font-medium text-[16px] mb-1">
                                {impact.account_name}
                            </h4>
                            <span
                                className={`text-[15px] font-bold ${getStatusColor(
                                    impact.status
                                )}`}
                            >
                                {impact.impact_text}
                            </span>
                        </div>

                        <div className="flex items-center gap-2 mb-4 relative z-10">
                            <span className="text-[17px] font-medium text-[var(--ws-text-tertiary)] line-through decoration-[var(--ws-border)]">
                                {formatAmount(impact.current_balance)}
                            </span>
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 16 16"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                className="text-[var(--ws-text-secondary)]"
                            >
                                <path
                                    d="M3.5 8H12.5M12.5 8L8.5 4M12.5 8L8.5 12"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                            <span className="text-[20px] font-semibold text-[var(--ws-text-primary)]">
                                {formatAmount(impact.projected_balance)}
                            </span>
                        </div>

                        <div className="mt-auto relative z-10">
                            {impact.note && (
                                <p className="text-[13px] text-[var(--ws-text-secondary)] bg-[var(--ws-bg-primary)] px-3 py-2.5 rounded-lg border border-[var(--ws-border)]">
                                    {impact.note}
                                </p>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
