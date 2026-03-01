'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DebugLog, SearchMetadata } from '@/lib/types';

type StepStatus = 'active' | 'done' | 'pending' | 'skipped' | 'error';
type PipelineId = 'input' | 'router' | 'search' | 'generate' | 'guardrails' | 'ready';

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

interface PipelineNode {
  id: PipelineId;
  label: string;
  sublabel: string;
  icon: string;
}

const NODES: PipelineNode[] = [
  { id: 'input', label: 'Input', sublabel: 'Event', icon: '›_' },
  { id: 'router', label: 'Router', sublabel: 'haiku', icon: '⚡' },
  { id: 'search', label: 'Search', sublabel: 'Grounding', icon: '🌐' },
  { id: 'generate', label: 'Generate', sublabel: 'sonnet', icon: '✦' },
  { id: 'guardrails', label: 'Guard', sublabel: 'Validate', icon: '🛡' },
  { id: 'ready', label: 'Output', sublabel: 'Ready', icon: '✓' },
];

function getSearchUsed(
  searchMetadata: SearchMetadata | null | undefined,
  debugLog: DebugLog | null | undefined,
): boolean {
  if (searchMetadata?.sources?.length) return true;
  return debugLog?.entries?.some((entry) => entry.step.toLowerCase() === 'search') ?? false;
}

function deriveStatuses(
  appStep: FlowDiagramProps['appStep'],
  isPromptOpen: boolean,
  searchUsed: boolean,
  pipelineSteps: Record<string, PipelineStepStatus>,
): Record<PipelineId, StepStatus> {
  const base: Record<PipelineId, StepStatus> = {
    input: 'pending', router: 'pending', search: 'pending',
    generate: 'pending', guardrails: 'pending', ready: 'pending',
  };

  if (appStep === 'home') {
    base.input = isPromptOpen ? 'active' : 'pending';
    return base;
  }

  if (appStep === 'thinking') {
    // Use real SSE events from the backend
    base.input = 'done';
    const stepIds: PipelineId[] = ['router', 'search', 'generate', 'guardrails'];
    // Map real backend step IDs (analyze maps to generate visually since they run in parallel)
    for (const id of stepIds) {
      const real = pipelineSteps[id];
      if (real) {
        base[id] = real.status === 'complete' ? 'done' : 'active';
      }
    }
    // The "analyze" step from backend runs alongside generate — map it
    const analyze = pipelineSteps['analyze'];
    if (analyze && !pipelineSteps['generate']) {
      // If analyze is running but generate hasn't started, show generate as pending
    }
    // If no search step was received but router is done, search was skipped
    if (base.router === 'done' && !pipelineSteps['search'] && (pipelineSteps['generate'] || pipelineSteps['analyze'])) {
      base.search = 'skipped';
    }
    return base;
  }

  // plan + error — all complete
  base.input = 'done';
  base.router = 'done';
  base.search = searchUsed ? 'done' : 'skipped';
  base.generate = 'done';
  base.guardrails = 'done';
  base.ready = appStep === 'error' ? 'error' : 'active';
  return base;
}

/* ── Connector line between nodes ── */
function Connector({ fromStatus, toStatus }: { fromStatus: StepStatus; toStatus: StepStatus }) {
  const isLit = fromStatus === 'done' || fromStatus === 'active';
  const isFlowing = fromStatus === 'done' && (toStatus === 'active');

  return (
    <div className="flex justify-center h-5 relative">
      {/* Vertical line */}
      <div
        className="w-px h-full transition-colors duration-500"
        style={{ backgroundColor: isLit ? 'var(--ws-accent-green)' : 'var(--ws-border)' }}
      />
      {/* Animated pulse traveling down */}
      {isFlowing && (
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: 'var(--ws-accent-green)' }}
          animate={{ top: [0, 20], opacity: [1, 0] }}
          transition={{ duration: 1, repeat: Infinity, ease: 'easeOut' as const }}
        />
      )}
    </div>
  );
}

/* ── Single pipeline node ── */
function PipelineNodeCard({
  node,
  status,
}: {
  node: PipelineNode;
  status: StepStatus;
}) {
  const isActive = status === 'active';
  const isDone = status === 'done';
  const isSkipped = status === 'skipped';
  const isError = status === 'error';

  const borderColor = isActive ? 'var(--ws-accent-green)' : isDone ? 'var(--ws-border)' : isError ? 'var(--ws-accent-red)' : 'var(--ws-border)';
  const bgColor = isActive ? 'rgba(43, 122, 66, 0.05)' : 'transparent';

  return (
    <motion.div
      className="rounded-xl border px-3.5 py-2.5 relative overflow-hidden"
      style={{ borderColor, backgroundColor: bgColor }}
      animate={isActive ? {
        boxShadow: [
          '0 0 0px rgba(74,222,128,0)',
          '0 0 16px rgba(74,222,128,0.12)',
          '0 0 0px rgba(74,222,128,0)',
        ],
      } : { boxShadow: '0 0 0px rgba(0,0,0,0)' }}
      transition={{ duration: 2, repeat: isActive ? Infinity : 0 }}
    >
      {/* Active scanning line effect */}
      {isActive && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, transparent 0%, rgba(43, 122, 66, 0.1) 50%, transparent 100%)',
          }}
          animate={{ y: [-40, 40] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' as const }}
        />
      )}

      <div className="flex items-center gap-3 relative">
        {/* Status indicator */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[13px] shrink-0 border border-[var(--ws-border)]"
          style={{
            backgroundColor: 'var(--ws-bg-primary)',
            color: isActive ? 'var(--ws-accent-green)' : isDone ? 'var(--ws-text-primary)' : isError ? 'var(--ws-accent-red)' : 'var(--ws-text-tertiary)',
          }}
        >
          {isActive ? (
            <motion.span
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              {node.icon}
            </motion.span>
          ) : isDone ? (
            <span style={{ color: 'var(--ws-text-primary)' }}>✓</span>
          ) : isSkipped ? (
            <span style={{ color: 'var(--ws-text-tertiary)' }}>—</span>
          ) : isError ? (
            <span>✕</span>
          ) : (
            <span>{node.icon}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p
              className="text-[13px] font-semibold leading-tight truncate"
              style={{
                color: isActive ? 'var(--ws-text-primary)' : isDone ? 'var(--ws-text-primary)' : isError ? 'var(--ws-accent-red)' : isSkipped ? 'var(--ws-text-tertiary)' : 'var(--ws-text-secondary)',
              }}
            >
              {node.label}
            </p>
            {isActive && (
              <motion.span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm"
                style={{ backgroundColor: 'rgba(43, 122, 66, 0.1)', color: 'var(--ws-accent-green)' }}
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                RUNNING
              </motion.span>
            )}
            {isDone && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm"
                style={{ backgroundColor: 'var(--ws-bg-surface)', color: 'var(--ws-text-tertiary)' }}
              >
                DONE
              </span>
            )}
            {isSkipped && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm"
                style={{ backgroundColor: 'var(--ws-bg-surface)', color: 'var(--ws-text-tertiary)' }}
              >
                SKIP
              </span>
            )}
            {isError && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm"
                style={{ backgroundColor: 'rgba(217, 67, 67, 0.1)', color: 'var(--ws-accent-red)' }}
              >
                ERROR
              </span>
            )}
          </div>
          <p
            className="text-[11px] leading-tight mt-0.5"
            style={{ color: isActive ? 'var(--ws-accent-green)' : isDone ? 'var(--ws-text-secondary)' : 'var(--ws-text-tertiary)' }}
          >
            {node.sublabel}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default function FlowDiagram({
  appStep,
  isPromptOpen,
  searchMetadata,
  debugLog,
  pipelineSteps = {},
}: FlowDiagramProps) {
  const searchUsed = useMemo(() => getSearchUsed(searchMetadata, debugLog), [searchMetadata, debugLog]);
  const statuses = useMemo(() => deriveStatuses(appStep, isPromptOpen, searchUsed, pipelineSteps), [appStep, isPromptOpen, searchUsed, pipelineSteps]);

  const sourceCount = searchMetadata?.sources?.length ?? 0;
  const removedCount = debugLog?.removedActions?.length ?? 0;
  const afterGuardrails = debugLog?.actionsAfterGuardrails ?? 0;
  const recentNotes = debugLog?.entries?.slice(-3) ?? [];

  return (
    <div className="w-full h-full bg-[var(--ws-bg-primary)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-5 pt-8 pb-5 mb-2 border-b border-[var(--ws-border)]">
        <div className="flex items-center gap-2.5 mb-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--ws-accent-green)]" />
          <h2 className="text-[14px] font-semibold text-[var(--ws-text-primary)] tracking-wide uppercase">
            System Pipeline
          </h2>
        </div>
        <p className="text-[12px] text-[var(--ws-text-secondary)] font-medium pl-5">
          v1 — {appStep === 'thinking' ? 'running' : appStep === 'plan' ? 'done' : 'idle'}
        </p>
      </div>

      {/* Pipeline flow */}
      <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar px-6 pb-6">
        <div className="flex flex-col mt-4">
          {NODES.map((node, i) => (
            <div key={node.id}>
              <PipelineNodeCard node={node} status={statuses[node.id]} />
              {i < NODES.length - 1 && (
                <Connector
                  fromStatus={statuses[NODES[i].id]}
                  toStatus={statuses[NODES[i + 1].id]}
                />
              )}
            </div>
          ))}
        </div>

        {/* Telemetry strip */}
        <div className="mt-8 pt-6 border-t border-[var(--ws-border)]">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Sources', value: sourceCount, color: 'var(--ws-text-primary)' },
              { label: 'Kept', value: afterGuardrails, color: 'var(--ws-accent-green)' },
              { label: 'Dropped', value: removedCount, color: removedCount > 0 ? 'var(--ws-accent-red)' : 'var(--ws-text-tertiary)' },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center bg-[var(--ws-bg-surface)] border border-[var(--ws-border)] rounded-[12px] py-2.5 shadow-sm">
                <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--ws-text-tertiary)]">
                  {stat.label}
                </p>
                <p className="text-[18px] font-semibold mt-1 leading-none" style={{ color: stat.color }}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Log feed */}
        <AnimatePresence>
          {recentNotes.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-6 pt-6 border-t border-[var(--ws-border)]"
            >
              <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--ws-text-tertiary)] mb-3">Recent Logs</p>
              <div className="flex flex-col gap-2.5">
                {recentNotes.map((note, idx) => (
                  <div key={`${note.step}-${idx}`} className="flex gap-2.5 items-start bg-[var(--ws-bg-surface)] p-2.5 rounded-[12px] border border-[var(--ws-border)]">
                    <span className="text-[10px] font-bold text-[var(--ws-accent-green)] shrink-0 mt-[1px] uppercase tracking-wide">
                      {note.step.slice(0, 4)}
                    </span>
                    <span className="text-[11px] font-medium text-[var(--ws-text-secondary)] leading-[1.4] break-words">
                      {note.detail}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
