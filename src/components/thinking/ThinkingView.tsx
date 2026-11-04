"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { CustomFund, DebugLog, FinancialProfile, PathfinderResult, SearchMetadata, ThinkingStep } from "@/lib/types";
import { callPathfinderStream } from "@/lib/claude";
import type { StreamEvent } from "@/lib/claude";
import { playSound } from "@/lib/sounds";
import AgentSteps from "@/components/ui/AgentSteps";
import type { AgentStep } from "@/components/ui/AgentSteps";

interface ThinkingViewProps {
  profile: FinancialProfile;
  customFunds: CustomFund[];
  event: string;
  onComplete: (result: PathfinderResult, searchMetadata: SearchMetadata | null, debugLog: DebugLog | null) => void;
  onError: (message: string) => void;
}

/** The search step reports its sources as JSON. Show them as readable site names. */
function readableDetail(detail?: string): string | undefined {
  if (!detail?.startsWith("[")) return detail;
  try {
    const sources = JSON.parse(detail) as { url: string }[];
    const sites = sources.map((source) => new URL(source.url).hostname.replace("www.", ""));
    return [...new Set(sites)].slice(0, 3).join(", ");
  } catch {
    return undefined;
  }
}

export default function ThinkingView({ profile, customFunds, event, onComplete, onError }: ThinkingViewProps) {
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const hasStarted = useRef(false);

  const handleEvent = useCallback((evt: StreamEvent) => {
    if (evt.type === "step") {
      if (evt.status === "complete") playSound("tap");
      setSteps((prev) => {
        const step: AgentStep = { id: evt.id, label: evt.label, status: evt.status, detail: readableDetail(evt.detail) };
        const existing = prev.findIndex((item) => item.id === evt.id);
        if (existing < 0) return [...prev, step];
        const next = [...prev];
        next[existing] = step;
        return next;
      });
    } else if (evt.type === "thinking_steps") {
      setThinkingSteps(evt.steps);
    }
  }, []);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    let finalResult: PathfinderResult | null = null;
    let finalSearchMeta: SearchMetadata | null = null;
    let finalDebugLog: DebugLog | null = null;

    callPathfinderStream(profile, event, customFunds, (evt) => {
      handleEvent(evt);
      if (evt.type === "complete") {
        finalResult = evt.result;
        finalSearchMeta = evt.searchMetadata ?? null;
        finalDebugLog = evt.debugLog ?? null;
      } else if (evt.type === "error") {
        onError(evt.message);
      }
    })
      .then(() => {
        if (finalResult) {
          playSound("complete");
          setTimeout(() => onComplete(finalResult!, finalSearchMeta, finalDebugLog), 350);
        }
      })
      .catch((err) => {
        onError(err instanceof Error ? err.message : "Something went wrong");
      });
  }, [profile, customFunds, event, onComplete, onError, handleEvent]);

  const insights = thinkingSteps.flatMap((step) => step.insights.slice(0, 1).map((insight) => insight.text));

  return (
    <div className="mx-auto flex h-full max-w-[640px] flex-col justify-center">
      <h1 className="pf-title-lg line-clamp-3 font-serif">{event}</h1>

      <div className="mt-8"><AgentSteps steps={steps} /></div>

      {insights.length > 0 && (
        <motion.ul className="mt-6 flex flex-col gap-2 border-t border-[var(--pf-border)] pt-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {insights.slice(0, 2).map((insight) => (
            <li key={insight} className="line-clamp-2 text-[16px] leading-snug text-[var(--pf-text-secondary)]">{insight}</li>
          ))}
        </motion.ul>
      )}
    </div>
  );
}
