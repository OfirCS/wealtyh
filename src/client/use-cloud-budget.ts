'use client';

import { useEffect, useRef, useState } from 'react';
import type { Budget } from '@/lib/budget';
import { api, ApiProblem } from './api';

const VERSION_KEY = 'pathfinder.cloud.v1';
/** Long enough that a run of edits is one save. */
const SAVE_DELAY_MS = 2000;

function readVersion(): number {
  try {
    return Number(window.localStorage.getItem(VERSION_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeVersion(version: number): void {
  try {
    window.localStorage.setItem(VERSION_KEY, String(version));
  } catch {
    // Ignore storage failures (private mode/quota)
  }
}

interface Remote {
  budget: Budget;
  version: number;
}

/** A newer budget, if there is one. The version is only recorded once the budget is really in use. */
async function pull(): Promise<Remote | null> {
  const remote = await api.budget();
  return remote.data && remote.version > readVersion() ? { budget: remote.data as Budget, version: remote.version } : null;
}

/** Signing in on a new device: finds this family's budget, if there is one, without a rescan. */
export async function restoreBudget(googleAccessToken: string): Promise<Budget | null> {
  try {
    await api.session(googleAccessToken);
    const remote = await pull();
    if (remote) writeVersion(remote.version);
    return remote?.budget ?? null;
  } catch {
    return null;
  }
}

/**
 * Keeps one budget across a family's devices. With no database, or offline, every call quietly
 * fails and the device simply keeps its own copy, as it always has.
 */
export function useCloudBudget(enabled: boolean, budget: Budget | null, onRemote: (budget: Budget) => void): void {
  const [ready, setReady] = useState(false);
  const saved = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void (async () => {
      try {
        await api.session();
        const remote = await pull();
        if (!live) return;
        if (remote) {
          writeVersion(remote.version);
          saved.current = JSON.stringify(remote.budget);
          onRemote(remote.budget);
        }
        setReady(true);
      } catch {
        // Stays off for this visit
      }
    })();
    return () => {
      live = false;
    };
  }, [enabled, onRemote]);

  useEffect(() => {
    if (!enabled || !ready || !budget) return;
    const text = JSON.stringify(budget);
    if (text === saved.current) return;

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const { version } = await api.saveBudget(readVersion(), budget);
          writeVersion(version);
          saved.current = text;
        } catch (problem) {
          // Another device got there first, so its version is the one to work from
          if (!(problem instanceof ApiProblem) || problem.code !== 'stale') return;
          const remote = await pull().catch(() => null);
          if (remote) {
            writeVersion(remote.version);
            saved.current = JSON.stringify(remote.budget);
            onRemote(remote.budget);
          }
        }
      })();
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [enabled, ready, budget, onRemote]);
}
