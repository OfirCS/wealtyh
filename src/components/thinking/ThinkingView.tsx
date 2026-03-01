"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { FinancialProfile, CustomFund, PathfinderResult, SearchMetadata, DebugLog, ThinkingStep as ThinkingStepType } from "@/lib/types";
import { callPathfinder, callPathfinderThink } from "@/lib/claude";
import ThinkingStep from "./ThinkingStep";
import ThinkingProgress from "./ThinkingProgress";

interface ThinkingViewProps {
  profile: FinancialProfile;
  customFunds: CustomFund[];
  event: string;
  onComplete: (result: PathfinderResult, searchMetadata: SearchMetadata | null, debugLog: DebugLog | null) => void;
  onError: (message: string) => void;
}

// Placeholder lines shown while pre-think is in flight
const PLACEHOLDER_LINES = [
  "Reading your accounts...",
  "Running scenarios...",
];

const LINE_DELAY = 800;
const PROGRESS_DURATION = 1500;
const PROGRESS_INTERVAL = 25;
const POST_PROGRESS_PAUSE = 500;

const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export default function ThinkingView({
  profile,
  customFunds,
  event,
  onComplete,
  onError,
}: ThinkingViewProps) {
  const [displayLines, setDisplayLines] = useState<string[]>(PLACEHOLDER_LINES);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [completedIndices, setCompletedIndices] = useState<Set<number>>(new Set());
  const [showProgress, setShowProgress] = useState(false);
  const [progress, setProgress] = useState(0);
  const [heroImage, setHeroImage] = useState<string | null>(null);
  const hasStarted = useRef(false);
  const apiResult = useRef<PathfinderResult | null>(null);
  const apiSearchMeta = useRef<SearchMetadata | null>(null);
  const apiDebugLog = useRef<DebugLog | null>(null);
  const apiError = useRef<string | null>(null);
  const preThinkResolved = useRef(false);
  const realThinkingLines = useRef<string[]>([]);

  const runSequence = useCallback(async () => {
    // Fire ALL three calls in parallel
    const apiPromise = callPathfinder(profile, event, customFunds)
      .then((response) => {
        apiResult.current = response.result;
        apiSearchMeta.current = response.searchMetadata;
        apiDebugLog.current = response.debugLog;
      })
      .catch((err) => {
        apiError.current =
          err instanceof Error ? err.message : "Something went wrong";
      });

    // Pre-think: get real thinking steps fast (~1-2s)
    const preThinkPromise = callPathfinderThink(profile, event, customFunds)
      .then((steps) => {
        if (steps.length > 0) {
          realThinkingLines.current = steps.map((s) => s.title);
          preThinkResolved.current = true;
        }
      })
      .catch(() => {
        // Pre-think is optional — fall back to placeholders
      });

    // Image generation (optional, non-blocking)
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

    await delay(400);

    // Show placeholder lines first
    for (let i = 0; i < PLACEHOLDER_LINES.length; i++) {
      if (i > 0) {
        setCompletedIndices((prev) => new Set(prev).add(i - 1));
      }
      setActiveIndex(i);
      await delay(LINE_DELAY);
    }
    setCompletedIndices((prev) => new Set(prev).add(PLACEHOLDER_LINES.length - 1));
    setActiveIndex(-1);

    // Wait for pre-think if it hasn't resolved yet (give it up to 3s extra)
    if (!preThinkResolved.current) {
      await Promise.race([preThinkPromise, delay(3000)]);
    }

    // If real thinking lines arrived, switch to them and animate
    if (preThinkResolved.current && realThinkingLines.current.length > 0) {
      const lines = realThinkingLines.current;
      setDisplayLines(lines);
      setCompletedIndices(new Set());
      setActiveIndex(-1);

      await delay(300);

      for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
          setCompletedIndices((prev) => new Set(prev).add(i - 1));
        }
        setActiveIndex(i);
        await delay(LINE_DELAY);
      }
      setCompletedIndices((prev) => new Set(prev).add(lines.length - 1));
      setActiveIndex(-1);
    }

    await delay(400);

    // Show progress bar — cap at 90% until API responds
    setShowProgress(true);
    const totalSteps = PROGRESS_DURATION / PROGRESS_INTERVAL;
    const increment = 90 / totalSteps;

    for (let i = 0; i <= totalSteps; i++) {
      await delay(PROGRESS_INTERVAL);
      setProgress(Math.min(i * increment, 90));
    }

    // Wait for API to finish, then jump to 100%
    await apiPromise;
    setProgress(100);

    await delay(POST_PROGRESS_PAUSE);

    // Route to result or error
    if (apiResult.current) {
      onComplete(apiResult.current, apiSearchMeta.current, apiDebugLog.current);
    } else {
      onError(apiError.current || "Failed to generate financial plan");
    }
  }, [profile, customFunds, event, onComplete, onError]);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    runSequence();
  }, [runSequence]);

  const getStatus = (index: number): "pending" | "active" | "complete" => {
    if (completedIndices.has(index)) return "complete";
    if (index === activeIndex) return "active";
    return "pending";
  };

  return (
    <div className="w-full max-w-[420px]">
      {/* Hero image (fades in when ready) */}
      <AnimatePresence>
        {heroImage && (
          <motion.div
            className="w-full mb-6 flex justify-center"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{
              opacity: 1,
              scale: [1, 1.05, 1],
              boxShadow: [
                "0px 0px 0px rgba(0,0,0,0)",
                "0px 10px 30px rgba(0,0,0,0.15)",
                "0px 0px 0px rgba(0,0,0,0)"
              ]
            }}
            transition={{
              type: "spring", bounce: 0, duration: 0.8,
              scale: {
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              },
              boxShadow: {
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }
            }}
          >
            <div className="w-[160px] h-[160px] rounded-[24px] overflow-hidden shadow-lg border border-white/20">
              <img
                src={heroImage}
                alt="Your financial path"
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User prompt */}
      <motion.p
        className="text-[14px] italic leading-relaxed mb-6"
        style={{ color: "var(--ws-text-secondary)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        &ldquo;{event}&rdquo;
      </motion.p>

      {/* Analyzing headline */}
      <motion.p
        className="text-[18px] font-semibold leading-snug mb-8"
        style={{ color: "var(--ws-text-primary)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        Analyzing...
      </motion.p>

      {/* Thinking lines (real AI or placeholder) */}
      <div className="flex flex-col gap-1">
        <AnimatePresence mode="sync">
          {displayLines.map((line, i) => (
            <ThinkingStep key={`${line}-${i}`} text={line} status={getStatus(i)} />
          ))}
        </AnimatePresence>
      </div>

      {/* Progress bar */}
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
