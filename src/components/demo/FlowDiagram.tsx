'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DebugLog, SearchMetadata } from '@/lib/types';

type Phase = 'idle' | 'thinking' | 'ready' | 'error';

interface PipelineStepStatus {
  id: string;
  status: 'active' | 'complete';
  label?: string;
  detail?: string;
}

interface FlowDiagramProps {
  appStep: 'home' | 'thinking' | 'plan' | 'error';
  isPromptOpen: boolean;
  searchMetadata?: SearchMetadata | null;
  debugLog?: DebugLog | null;
  pipelineSteps?: Record<string, PipelineStepStatus>;
}

interface FriendlyStep {
  id: string;
  title: string;
  body: string;
  icon: React.ReactNode;
}

const STEPS: FriendlyStep[] = [
  {
    id: 'understand',
    title: 'Read your situation',
    body: 'Looks at your numbers and the change you want to make.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v6m0 10v6M4.22 4.22l4.24 4.24m7.08 7.08l4.24 4.24M1 12h6m10 0h6M4.22 19.78l4.24-4.24m7.08-7.08l4.24-4.24" />
      </svg>
    ),
  },
  {
    id: 'research',
    title: 'Pull live data',
    body: 'Looks up current rates, costs, and rules — only when needed.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    id: 'plan',
    title: 'Build your plan',
    body: 'Writes specific next steps you can take this week.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
];

function getActiveStepIndex(
  appStep: FlowDiagramProps['appStep'],
  pipelineSteps: Record<string, PipelineStepStatus>,
): number {
  if (appStep !== 'thinking') return -1;
  if (pipelineSteps['guardrails']?.status === 'active' || pipelineSteps['generate']?.status === 'active' || pipelineSteps['analyze']?.status === 'active') return 2;
  if (pipelineSteps['search']?.status === 'active') return 1;
  if (pipelineSteps['router']?.status === 'active') return 0;
  return 0;
}

function getCompletedThrough(
  appStep: FlowDiagramProps['appStep'],
  pipelineSteps: Record<string, PipelineStepStatus>,
): number {
  if (appStep === 'plan') return 3;
  if (appStep !== 'thinking') return -1;
  let completed = -1;
  if (pipelineSteps['router']?.status === 'complete') completed = 0;
  if (pipelineSteps['search']?.status === 'complete' || (pipelineSteps['router']?.status === 'complete' && pipelineSteps['analyze'])) completed = Math.max(completed, 1);
  if (pipelineSteps['guardrails']?.status === 'complete') completed = 2;
  return completed;
}

function StepRow({
  step,
  state,
}: {
  step: FriendlyStep;
  state: 'idle' | 'active' | 'done';
}) {
  const isActive = state === 'active';
  const isDone = state === 'done';

  return (
    <div className="flex items-start gap-3 py-3">
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors"
        style={{
          backgroundColor: isActive
            ? 'var(--ws-accent-green)'
            : isDone
              ? 'var(--ws-bg-elevated)'
              : 'var(--ws-bg-surface)',
          color: isActive
            ? '#fff'
            : isDone
              ? 'var(--ws-text-primary)'
              : 'var(--ws-text-tertiary)',
          border: isDone || isActive ? '1px solid transparent' : '1px solid var(--ws-border)',
        }}
      >
        {isDone ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : isActive ? (
          <motion.span
            animate={{ scale: [0.9, 1.05, 0.9] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' as const }}
            className="flex"
          >
            {step.icon}
          </motion.span>
        ) : (
          step.icon
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-[14px] font-semibold leading-tight"
          style={{
            color: isActive
              ? 'var(--ws-text-primary)'
              : isDone
                ? 'var(--ws-text-primary)'
                : 'var(--ws-text-secondary)',
          }}
        >
          {step.title}
        </p>
        <p
          className="text-[12px] leading-snug mt-0.5"
          style={{ color: 'var(--ws-text-tertiary)' }}
        >
          {step.body}
        </p>
      </div>
    </div>
  );
}

function getPhase(appStep: FlowDiagramProps['appStep']): Phase {
  if (appStep === 'thinking') return 'thinking';
  if (appStep === 'plan') return 'ready';
  if (appStep === 'error') return 'error';
  return 'idle';
}

export default function FlowDiagram({
  appStep,
  isPromptOpen,
  searchMetadata,
  debugLog,
  pipelineSteps = {},
}: FlowDiagramProps) {
  const phase = getPhase(appStep);
  const activeIdx = useMemo(
    () => getActiveStepIndex(appStep, pipelineSteps),
    [appStep, pipelineSteps],
  );
  const completedThrough = useMemo(
    () => getCompletedThrough(appStep, pipelineSteps),
    [appStep, pipelineSteps],
  );

  const sourceCount = searchMetadata?.sources?.length ?? 0;
  const actionCount = debugLog?.actionsAfterGuardrails ?? 0;

  const headline =
    phase === 'thinking'
      ? 'Working on your plan'
      : phase === 'ready'
        ? 'Plan ready'
        : phase === 'error'
          ? 'Something went wrong'
          : isPromptOpen
            ? 'Tell me what’s changing'
            : 'How Pathfinder works';

  const subhead =
    phase === 'thinking'
      ? 'Usually 10–20 seconds'
      : phase === 'ready'
        ? `${actionCount} steps you can take${sourceCount > 0 ? ` · ${sourceCount} live sources` : ''}`
        : phase === 'error'
          ? 'No worries — try again'
          : 'Three steps, all behind the scenes';

  return (
    <div className="w-full h-full bg-[var(--ws-bg-primary)] flex flex-col overflow-hidden">
      <div className="shrink-0 px-6 pt-8 pb-5 border-b border-[var(--ws-border)]">
        <div className="flex items-center gap-2 mb-1">
          <motion.span
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor:
                phase === 'thinking'
                  ? 'var(--ws-accent-green)'
                  : phase === 'error'
                    ? 'var(--ws-accent-red)'
                    : 'var(--ws-text-tertiary)',
            }}
            animate={phase === 'thinking' ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
            transition={{ duration: 1.4, repeat: phase === 'thinking' ? Infinity : 0 }}
          />
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[var(--ws-text-tertiary)]">
            {phase === 'thinking' ? 'Live' : phase === 'ready' ? 'Done' : phase === 'error' ? 'Error' : 'Idle'}
          </p>
        </div>
        <h2 className="text-[18px] font-semibold leading-tight text-[var(--ws-text-primary)]">
          {headline}
        </h2>
        <p className="text-[12px] mt-1 text-[var(--ws-text-secondary)]">{subhead}</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar px-6 py-2">
        <div className="flex flex-col divide-y divide-[var(--ws-border)]">
          {STEPS.map((step, i) => {
            let state: 'idle' | 'active' | 'done';
            if (phase === 'ready') state = 'done';
            else if (phase === 'thinking') {
              if (i <= completedThrough) state = 'done';
              else if (i === activeIdx) state = 'active';
              else state = 'idle';
            } else state = 'idle';
            return <StepRow key={step.id} step={step} state={state} />;
          })}
        </div>

        <AnimatePresence>
          {phase === 'ready' && sourceCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6 pt-5 border-t border-[var(--ws-border)]"
            >
              <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[var(--ws-text-tertiary)] mb-2">
                Live sources used
              </p>
              <div className="flex flex-col gap-1.5">
                {searchMetadata?.sources?.slice(0, 4).map((source, idx) => (
                  <a
                    key={`${source.url}-${idx}`}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] text-[var(--ws-text-secondary)] hover:text-[var(--ws-text-primary)] truncate underline-offset-2 hover:underline"
                    title={source.url}
                  >
                    {source.title || source.url}
                  </a>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
