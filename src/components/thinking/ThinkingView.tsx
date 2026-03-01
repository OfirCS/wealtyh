"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { FinancialProfile, CustomFund, PathfinderResult, SearchMetadata, DebugLog, ThinkingStep } from "@/lib/types";
import { callPathfinderStream } from "@/lib/claude";
import type { StreamEvent } from "@/lib/claude";
import type { PipelineStepStatus } from "@/components/app/HomeClient";
import ThinkingProgress from "./ThinkingProgress";

interface ThinkingViewProps {
  profile: FinancialProfile;
  customFunds: CustomFund[];
  event: string;
  onComplete: (result: PathfinderResult, searchMetadata: SearchMetadata | null, debugLog: DebugLog | null) => void;
  onError: (message: string) => void;
  onPipelineStep?: (step: PipelineStepStatus) => void;
}

interface AgentStep {
  id: string;
  label: string;
  status: "pending" | "active" | "complete";
  detail?: string;
}

const STEP_COLORS: Record<string, string> = {
  router: "var(--ws-text-primary)",
  search: "var(--ws-text-primary)",
  analyze: "var(--ws-text-primary)",
  generate: "var(--ws-text-primary)",
  guardrails: "var(--ws-text-primary)",
};


export default function ThinkingView({
  profile,
  customFunds,
  event,
  onComplete,
  onError,
  onPipelineStep,
}: ThinkingViewProps) {
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [heroImage, setHeroImage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const hasStarted = useRef(false);
  const totalStepsRef = useRef(5); // max: router, search, analyze, generate, guardrails
  const completedStepsRef = useRef(0);

  const updateProgress = useCallback(() => {
    completedStepsRef.current += 1;
    const pct = Math.min((completedStepsRef.current / totalStepsRef.current) * 100, 95);
    setProgress(pct);
  }, []);

  const handleEvent = useCallback((evt: StreamEvent) => {
    if (evt.type === "step") {
      setSteps((prev) => {
        const existing = prev.findIndex((s) => s.id === evt.id);
        const step: AgentStep = {
          id: evt.id,
          label: evt.label,
          status: evt.status === "active" ? "active" : "complete",
          detail: evt.detail,
        };
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = step;
          return next;
        }
        return [...prev, step];
      });
      if (evt.status === "complete") {
        updateProgress();
      }
      // Forward to sidebar pipeline
      onPipelineStep?.({ id: evt.id, status: evt.status as 'active' | 'complete', label: evt.label, detail: evt.detail });
    } else if (evt.type === "thinking_steps") {
      setThinkingSteps(evt.steps);
    }
    // complete and error are handled in the main flow
  }, [updateProgress, onPipelineStep]);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    setShowProgress(true);

    // Fire image generation separately
    fetch("/api/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lifeEvent: event }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.imageBase64) {
          setHeroImage(`data:image/png;base64,${data.imageBase64}`);
        }
      })
      .catch(() => { });

    // Start streaming
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
          setProgress(100);
          setTimeout(() => {
            onComplete(finalResult!, finalSearchMeta, finalDebugLog);
          }, 500);
        }
      })
      .catch((err) => {
        onError(err instanceof Error ? err.message : "Something went wrong");
      });
  }, [profile, customFunds, event, onComplete, onError, handleEvent]);

  return (
    <div className="w-full max-w-[420px]">
      {/* Hero image */}
      <AnimatePresence>
        {heroImage && (
          <motion.div
            className="w-full mb-6 flex justify-center"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.8 }}
          >
            <div className="w-[160px] h-[160px] rounded-[24px] overflow-hidden shadow-lg border border-white/20">
              <img src={heroImage} alt="Your financial path" className="w-full h-full object-cover" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User prompt */}
      <motion.p
        className="text-[14px] italic leading-relaxed mb-4"
        style={{ color: "var(--ws-text-secondary)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        &ldquo;{event}&rdquo;
      </motion.p>

      {/* Agent headline */}
      <motion.div
        className="flex items-center gap-3 mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <div className="relative flex items-center justify-center w-5 h-5">
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-[var(--ws-text-primary)] border-t-transparent"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        </div>
        <p className="font-serif text-[24px] font-semibold tracking-tight leading-none" style={{ color: "var(--ws-text-primary)" }}>
          Working on it
        </p>
      </motion.div>

      {/* Agent steps */}
      <div className="flex flex-col gap-0.5">
        <AnimatePresence mode="sync">
          {steps.map((step, i) => (
            <motion.div
              key={step.id}
              className="flex items-start gap-3 py-2"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring", bounce: 0, duration: 0.5, delay: 0.05 * i }}
            >
              {/* Status icon */}
              <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center mt-0.5">
                {step.status === "active" && (
                  <motion.svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    style={{ color: STEP_COLORS[step.id] || "var(--ws-text-primary)" }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  >
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" fill="transparent" />
                    <motion.circle
                      cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="transparent"
                      strokeDasharray="40 100"
                      animate={{ strokeDashoffset: [0, -100] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" as const }}
                    />
                  </motion.svg>
                )}
                {step.status === "complete" && (
                  <motion.span
                    className="text-[14px] leading-none font-bold"
                    style={{ color: "var(--ws-accent-green)" }}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                  >
                    &#10003;
                  </motion.span>
                )}
                {step.status === "pending" && (
                  <span className="text-[16px] leading-none" style={{ color: "var(--ws-text-tertiary)" }}>&#9675;</span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-[1px]">
                <p
                  className="text-[15px] font-semibold tracking-tight"
                  style={{
                    color: step.status === "active" ? "var(--ws-text-primary)" : step.status === "complete" ? "var(--ws-text-primary)" : "var(--ws-text-tertiary)",
                  }}
                >
                  {step.label}
                </p>

                {step.id === "search" && step.detail && (step.status === "active" || step.status === "complete") ? (
                  <motion.div
                    className="flex flex-wrap gap-2 mt-2"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {(() => {
                      // Parse structured JSON sources from stream, or fall back to comma-separated
                      let sources: { title: string; url: string }[] = [];
                      try {
                        const parsed = JSON.parse(step.detail);
                        if (Array.isArray(parsed)) sources = parsed;
                      } catch {
                        // Legacy: comma-separated string
                        sources = step.detail.split(', ').map(s => ({ title: s, url: '' }));
                      }
                      return sources.map((source, idx) => {
                        const displayName = source.title?.replace(/^www\./, '') || 'Web Result';
                        const chip = (
                          <div
                            key={idx}
                            className="px-3 py-1.5 rounded-md border flex items-center gap-2 shadow-sm"
                            style={{
                              backgroundColor: "var(--ws-bg-surface)",
                              borderColor: "var(--ws-border)",
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ws-accent-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                            </svg>
                            <span className="text-[12px] font-medium text-[var(--ws-text-primary)] tracking-tight truncate max-w-[200px]">
                              {displayName}
                            </span>
                          </div>
                        );
                        if (source.url) {
                          return (
                            <a key={idx} href={source.url} target="_blank" rel="noopener noreferrer" className="no-underline hover:opacity-80 transition-opacity">
                              {chip}
                            </a>
                          );
                        }
                        return chip;
                      });
                    })()}
                  </motion.div>
                ) : (
                  step.detail && step.status === "complete" && (
                    <motion.div
                      className="text-[13.5px] mt-1.5 text-[var(--ws-text-secondary)] font-medium leading-relaxed"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      {step.detail.includes(' — ') ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[var(--ws-text-primary)] font-semibold">{step.detail.split(' — ')[0]}</span>
                          <span className="opacity-80 italic">&quot;{step.detail.split(' — ')[1]}&quot;</span>
                        </div>
                      ) : (
                        step.detail
                      )}
                    </motion.div>
                  )
                )}

                {/* Compact thinking steps — one line each */}
                {step.id === "analyze" && thinkingSteps.length > 0 && step.status === "complete" && (
                  <motion.div
                    className="mt-2.5 flex flex-col gap-0"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {thinkingSteps.map((ts, j) => {
                      const topInsight = ts.insights?.[0];
                      const tone = topInsight?.type ?? "neutral";
                      const toneColor = tone === "positive" ? "var(--ws-accent-green)" : tone === "negative" ? "var(--ws-accent-red)" : "var(--ws-text-tertiary)";
                      return (
                        <motion.div
                          key={j}
                          className="flex items-start gap-2.5 py-1.5"
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.25, delay: 0.12 * j }}
                        >
                          <span className="mt-[5px] shrink-0">
                            {tone === "positive" ? (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={toneColor} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : tone === "negative" ? (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={toneColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                              </svg>
                            ) : (
                              <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: toneColor, opacity: 0.5 }} />
                            )}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className="text-[12.5px] font-semibold text-[var(--ws-text-primary)]">
                              {ts.title}
                            </span>
                            {topInsight && (
                              <span className="text-[12px] font-medium ml-1.5" style={{ color: toneColor }}>
                                — {topInsight.text}
                              </span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Progress */}
      <AnimatePresence>
        {showProgress && (
          <motion.div
            className="mt-8"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.6 }}
          >
            <ThinkingProgress progress={progress} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
