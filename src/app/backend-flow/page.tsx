'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import FlowDiagram from '@/components/demo/FlowDiagram';
import type { DebugLog, SearchMetadata } from '@/lib/types';

type DemoStep = 'home' | 'thinking' | 'plan' | 'error';

const STEP_OPTIONS: DemoStep[] = ['home', 'thinking', 'plan', 'error'];

const SAMPLE_SEARCH: SearchMetadata = {
  queries: [
    'current 5-year fixed mortgage rate Canada',
    'Ontario childcare cost 2026',
  ],
  sources: [
    { title: 'RateHub', url: 'https://www.ratehub.ca' },
    { title: 'CMHC', url: 'https://www.cmhc-schl.gc.ca' },
    { title: 'Bank of Canada', url: 'https://www.bankofcanada.ca' },
  ],
};

function buildDebugLog(step: DemoStep, searchUsed: boolean): DebugLog | null {
  if (step === 'home') return null;

  if (step === 'thinking') {
    return {
      entries: [
        { step: 'Router', detail: searchUsed ? 'Search needed: rates + costs' : 'No search needed' },
        ...(searchUsed ? [{ step: 'Search', detail: 'Found 3 sources' }] : []),
      ],
      actionsBeforeGuardrails: 0,
      actionsAfterGuardrails: 0,
      removedActions: [],
    };
  }

  if (step === 'error') {
    return {
      entries: [
        { step: 'Router', detail: searchUsed ? 'Search needed: rates + costs' : 'No search needed' },
        ...(searchUsed ? [{ step: 'Search', detail: 'Found 3 sources' }] : []),
        { step: 'Generate', detail: 'Model output parsing failed' },
      ],
      actionsBeforeGuardrails: 0,
      actionsAfterGuardrails: 0,
      removedActions: [],
    };
  }

  return {
    entries: [
      { step: 'Router', detail: searchUsed ? 'Search needed: rates + costs' : 'No search needed' },
      ...(searchUsed ? [{ step: 'Search', detail: 'Found 3 sources' }] : []),
      { step: 'Generate', detail: 'AI produced 5 actions' },
      { step: 'Guardrail', detail: 'Removed 1, kept 4' },
    ],
    actionsBeforeGuardrails: 5,
    actionsAfterGuardrails: 4,
    removedActions: ['"Move $10,000 from Chequing → FHSA" — $0 room in FHSA'],
  };
}

export default function BackendFlowPage() {
  const [step, setStep] = useState<DemoStep>('thinking');
  const [isPromptOpen, setIsPromptOpen] = useState(true);
  const [searchUsed, setSearchUsed] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const requestedStep = params.get('step');
    if (requestedStep && STEP_OPTIONS.includes(requestedStep as DemoStep)) {
      setStep(requestedStep as DemoStep);
    }
    setIsPromptOpen(params.get('promptOpen') !== '0');
    setSearchUsed(params.get('searchUsed') !== '0');
  }, []);

  const searchMetadata = useMemo<SearchMetadata | null | undefined>(() => {
    if (step !== 'plan' && step !== 'error') return undefined;
    return searchUsed ? SAMPLE_SEARCH : null;
  }, [step, searchUsed]);

  const debugLog = useMemo(() => buildDebugLog(step, searchUsed), [step, searchUsed]);

  return (
    <div className="min-h-screen bg-[#0f1012] text-white p-4 sm:p-6">
      <div className="max-w-[1280px] mx-auto flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div>
            <h1 className="text-[20px] sm:text-[24px] font-semibold tracking-tight">Backend Flow Demo</h1>
            <p className="text-[13px] text-white/65">Live visual of what Pathfinder is thinking in the backend.</p>
          </div>
          <Link
            href="/"
            className="px-3 py-2 rounded-lg text-[13px] font-medium border border-white/15 hover:border-white/30 transition-colors"
          >
            Back to App
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4 flex flex-wrap gap-3 items-center">
          <p className="text-[12px] text-white/70 w-full">
            Quick controls for demo mode. This page is safe to keep open on a second screen while Pathfinder runs.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-white/70">Step</span>
            <div className="flex gap-1">
              {STEP_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setStep(option)}
                  className={`px-2.5 py-1.5 rounded-md text-[12px] border transition-colors ${
                    step === option
                      ? 'bg-white text-black border-white'
                      : 'bg-transparent text-white/80 border-white/20 hover:border-white/35'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsPromptOpen((v) => !v)}
            className={`px-3 py-1.5 rounded-md text-[12px] border transition-colors ${
              isPromptOpen ? 'bg-[#1b6f46] border-[#1b6f46] text-white' : 'bg-transparent border-white/20 text-white/80'
            }`}
          >
            Prompt Open: {isPromptOpen ? 'Yes' : 'No'}
          </button>

          <button
            type="button"
            onClick={() => setSearchUsed((v) => !v)}
            className={`px-3 py-1.5 rounded-md text-[12px] border transition-colors ${
              searchUsed ? 'bg-[#2e7d32] border-[#2e7d32] text-white' : 'bg-transparent border-white/20 text-white/80'
            }`}
          >
            Search Used: {searchUsed ? 'Yes' : 'No'}
          </button>
        </div>

        <div className="w-full h-[680px] sm:h-[820px] rounded-[24px] overflow-hidden border border-white/10">
          <FlowDiagram
            appStep={step}
            isPromptOpen={isPromptOpen}
            searchMetadata={searchMetadata}
            debugLog={debugLog}
          />
        </div>
      </div>
    </div>
  );
}
