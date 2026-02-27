"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { FinancialProfile, PathfinderResult, SearchMetadata } from "@/lib/types";
import { callPathfinder } from "@/lib/claude";
import ThinkingStep from "./ThinkingStep";
import ThinkingProgress from "./ThinkingProgress";

interface ThinkingViewProps {
  profile: FinancialProfile;
  event: string;
  onComplete: (result: PathfinderResult, searchMetadata: SearchMetadata | null) => void;
  onError: (message: string) => void;
}

// Generate context-aware thinking lines from the event and profile
function generateThinkingLines(
  event: string,
  profile: FinancialProfile
): string[] {
  const lines: string[] = [];
  const e = event.toLowerCase();
  const householdIncome = profile.annualIncome + profile.partnerIncome;

  lines.push(
    `Analyzing $${(householdIncome / 1000).toFixed(0)}K household income in ${profile.province}`
  );

  if (/baby|child|parental|pregnan|newborn/.test(e)) {
    lines.push("Calculating EI parental leave benefits");
    lines.push("Estimating child costs and Canada Child Benefit");
  }
  if (/home|house|buy|mortgage|condo|property|real estate/.test(e)) {
    lines.push("Simulating mortgage payments and housing costs");
    lines.push("Checking HBP and FHSA eligibility");
  }
  if (/business|start|bakery|restaurant|shop|company|entrepreneur|launch/.test(e)) {
    lines.push("Researching business startup costs");
    lines.push("Modeling self-employment tax impact");
  }
  if (/school|education|degree|program|university|college|tuition/.test(e)) {
    lines.push("Estimating education costs and student funding");
  }
  if (/travel|break|sabbatical|year off|time off/.test(e)) {
    lines.push("Projecting income gap during career break");
  }
  if (/quit|leave.*job|freelance|contract|gig|consult/.test(e)) {
    lines.push("Modeling variable income scenarios");
  }
  if (/move|relocat|immigrat|country|abroad|israel|europe|us/.test(e)) {
    lines.push("Analyzing relocation financial impact");
  }
  if (/retire|pension|cpp|oas/.test(e)) {
    lines.push("Projecting retirement income sources");
  }
  if (/invest|stock|etf|portfolio|crypto/.test(e)) {
    lines.push("Reviewing investment allocation strategy");
  }
  if (/debt|loan|credit|pay off/.test(e)) {
    lines.push("Modeling debt repayment scenarios");
  }

  lines.push(
    `Reviewing TFSA ($${(profile.tfsaBalance / 1000).toFixed(1)}K), RRSP ($${(profile.rrspBalance / 1000).toFixed(1)}K) allocation`
  );
  lines.push("Searching for current rates and data");
  lines.push("Building your personalized financial plan");

  return [...new Set(lines)].slice(0, 7);
}

const LINE_DELAY = 1200;
const PROGRESS_DURATION = 1500;
const PROGRESS_INTERVAL = 25;
const POST_PROGRESS_PAUSE = 500;

const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export default function ThinkingView({
  profile,
  event,
  onComplete,
  onError,
}: ThinkingViewProps) {
  const thinkingLines = generateThinkingLines(event, profile);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [completedIndices, setCompletedIndices] = useState<Set<number>>(
    new Set()
  );
  const [showProgress, setShowProgress] = useState(false);
  const [progress, setProgress] = useState(0);
  const [heroImage, setHeroImage] = useState<string | null>(null);
  const hasStarted = useRef(false);
  const apiResult = useRef<PathfinderResult | null>(null);
  const apiSearchMeta = useRef<SearchMetadata | null>(null);
  const apiError = useRef<string | null>(null);

  const runSequence = useCallback(async () => {
    // Fire API call in parallel
    const apiPromise = callPathfinder(profile, event)
      .then((response) => {
        apiResult.current = response.result;
        apiSearchMeta.current = response.searchMetadata;
      })
      .catch((err) => {
        apiError.current =
          err instanceof Error ? err.message : "Something went wrong";
      });

    // Fire image generation in parallel (optional, non-blocking)
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
      .catch(() => {
        // Image gen is optional, fail silently
      });

    await delay(400);

    // Reveal lines one by one
    for (let i = 0; i < thinkingLines.length; i++) {
      if (i > 0) {
        setCompletedIndices((prev) => new Set(prev).add(i - 1));
      }
      setActiveIndex(i);
      await delay(LINE_DELAY);
    }

    // Mark last line complete
    setCompletedIndices(
      (prev) => new Set(prev).add(thinkingLines.length - 1)
    );
    setActiveIndex(-1);

    await delay(400);

    // Show progress bar
    setShowProgress(true);
    const totalSteps = PROGRESS_DURATION / PROGRESS_INTERVAL;
    const increment = 100 / totalSteps;

    for (let i = 0; i <= totalSteps; i++) {
      await delay(PROGRESS_INTERVAL);
      setProgress(Math.min(i * increment, 100));
    }

    // Wait for API to finish
    await apiPromise;

    await delay(POST_PROGRESS_PAUSE);

    // Route to result or error
    if (apiResult.current) {
      onComplete(apiResult.current, apiSearchMeta.current);
    } else {
      onError(apiError.current || "Failed to generate financial plan");
    }
  }, [profile, event, thinkingLines, onComplete, onError]);

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
    <motion.div
      className="w-full max-w-[420px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Hero image (fades in when ready) */}
      <AnimatePresence>
        {heroImage && (
          <motion.div
            className="w-full mb-6 flex justify-center"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" as const }}
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
        Pathfinder is analyzing...
      </motion.p>

      {/* Thinking lines */}
      <div>
        <AnimatePresence mode="sync">
          {thinkingLines.map(
            (line, i) =>
              i <= activeIndex || completedIndices.has(i) ? (
                <ThinkingStep key={i} text={line} status={getStatus(i)} />
              ) : null
          )}
        </AnimatePresence>
      </div>

      {/* Progress bar */}
      <AnimatePresence>
        {showProgress && (
          <motion.div
            className="mt-8"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <ThinkingProgress progress={progress} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
