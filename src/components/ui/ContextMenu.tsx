'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight, Minus, Plus, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { playSound } from '@/lib/sounds';

export type MenuEntry =
  | {
    kind: 'action';
    label: string;
    icon?: LucideIcon;
    hint?: string;
    danger?: boolean;
    disabled?: boolean;
    checked?: boolean;
    /** Stay open after choosing, for ticking several things in a row. */
    keepOpen?: boolean;
    onSelect: () => void;
  }
  | { kind: 'submenu'; label: string; icon?: LucideIcon; value?: string; items: MenuEntry[] }
  | { kind: 'stepper'; label: string; icon?: LucideIcon; value: string; onLess?: () => void; onMore?: () => void }
  | { kind: 'search'; label: string; value: string; onChange: (value: string) => void }
  | { kind: 'heading'; label: string }
  | { kind: 'divider' };

export interface MenuPoint {
  clientX: number;
  clientY: number;
  preventDefault: () => void;
  stopPropagation: () => void;
}

const HOLD_MS = 500;
let holdTimer: number | undefined;
let held = false;

/** A touch screen has no right-click, so holding a row opens the same menu. */
export function holdToOpen(open: (point: MenuPoint) => void) {
  return {
    onTouchStart: (event: React.TouchEvent) => {
      const { clientX, clientY } = event.touches[0];
      held = false;
      holdTimer = window.setTimeout(() => {
        held = true;
        open({ clientX, clientY, preventDefault: () => undefined, stopPropagation: () => undefined });
      }, HOLD_MS);
    },
    onTouchMove: () => window.clearTimeout(holdTimer),
    onTouchCancel: () => window.clearTimeout(holdTimer),
    onTouchEnd: (event: React.TouchEvent) => {
      window.clearTimeout(holdTimer);
      // The finger coming up after a hold isn't a tap on the row
      if (held) event.preventDefault();
    },
  };
}

/** Holds the one menu that can be open at a time, and what it was opened on. */
export function useContextMenu<T>() {
  const [target, setTarget] = useState<(T & { x: number; y: number }) | null>(null);

  const open = useCallback((event: MenuPoint, info: T) => {
    event.preventDefault();
    event.stopPropagation();
    setTarget({ ...info, x: event.clientX, y: event.clientY });
    playSound('tap');
  }, []);

  const close = useCallback(() => setTarget(null), []);

  return { target, open, close };
}

const GAP = 8;

interface PanelProps {
  entries: MenuEntry[];
  x: number;
  y: number;
  /** The row this panel flew out of, so it can flip to the other side. */
  anchor?: DOMRect;
  depth: number;
  onClose: () => void;
  onBack?: () => void;
}

function selectable(entry: MenuEntry): boolean {
  return (entry.kind === 'action' && !entry.disabled) || entry.kind === 'submenu';
}

function Panel({ entries, x, y, anchor, depth, onClose, onBack }: PanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y, ready: false });
  const [active, setActive] = useState(-1);
  const [opened, setOpened] = useState<{ index: number; rect: DOMRect } | null>(null);
  const hoverTimer = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    const { width, height } = panel.getBoundingClientRect();
    let left = x;
    if (left + width > window.innerWidth - GAP) left = anchor ? anchor.left - width + 4 : window.innerWidth - width - GAP;
    const top = Math.max(GAP, Math.min(y, window.innerHeight - height - GAP));
    setPosition({ left: Math.max(GAP, left), top, ready: true });
    panel.focus({ preventScroll: true });
  }, [x, y, anchor]);

  const openSubmenu = (index: number, element: HTMLElement) => setOpened({ index, rect: element.getBoundingClientRect() });

  const choose = (entry: MenuEntry, index: number, element: HTMLElement) => {
    if (entry.kind === 'submenu') {
      openSubmenu(index, element);
    } else if (entry.kind === 'action' && !entry.disabled) {
      entry.onSelect();
      playSound('tap');
      if (!entry.keepOpen) onClose();
    }
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (opened) return;
    const rows = entries.map((entry, index) => ({ entry, index })).filter(({ entry }) => selectable(entry));
    const place = rows.findIndex(({ index }) => index === active);
    if (event.key === 'ArrowDown') setActive(rows[(place + 1) % rows.length]?.index ?? -1);
    else if (event.key === 'ArrowUp') setActive(rows[(place - 1 + rows.length) % rows.length]?.index ?? -1);
    else if (event.key === 'Escape') onClose();
    else if (event.key === 'ArrowLeft' && onBack) onBack();
    else if ((event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowRight') && active >= 0) {
      const element = ref.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
      if (element && !(event.key === 'ArrowRight' && entries[active].kind !== 'submenu')) choose(entries[active], active, element);
    } else return;
    event.preventDefault();
    event.stopPropagation();
  };

  const openedEntry = opened ? entries[opened.index] : null;

  return (
    <>
      <div
        ref={ref}
        role="menu"
        tabIndex={-1}
        data-own-focus
        onKeyDown={onKeyDown}
        onContextMenu={(event) => event.preventDefault()}
        className="hide-scrollbar fixed z-[70] max-h-[calc(100dvh-16px)] min-w-[216px] overflow-y-auto rounded-[14px] bg-[var(--pf-bg-surface)] p-1.5 shadow-[0_0_0_1px_rgba(28,27,27,0.07),0_14px_40px_rgba(28,27,27,0.16)]"
        style={{ left: position.left, top: position.top, visibility: position.ready ? 'visible' : 'hidden' }}
      >
        {entries.map((entry, index) => {
          if (entry.kind === 'divider') return <div key={`divider-${index}`} className="mx-2 my-1 h-px bg-[var(--pf-border)]" />;
          if (entry.kind === 'heading') return <p key={`heading-${index}`} className="px-2.5 pb-0.5 pt-1.5 text-[12px] font-medium text-[var(--pf-text-tertiary)]">{entry.label}</p>;

          if (entry.kind === 'search') {
            return (
              <label key={entry.label} className="flex h-9 items-center gap-2.5 rounded-[9px] bg-[var(--pf-bg-elevated)] px-2.5 text-[14px]">
                <Search size={15} strokeWidth={1.75} className="shrink-0 text-[var(--pf-text-secondary)]" />
                <span className="sr-only">{entry.label}</span>
                <input
                  value={entry.value}
                  onChange={(event) => entry.onChange(event.target.value)}
                  onKeyDown={(event) => { if (event.key !== 'Escape') event.stopPropagation(); }}
                  placeholder={entry.label}
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[var(--pf-text-tertiary)]"
                />
              </label>
            );
          }

          if (entry.kind === 'stepper') {
            const Icon = entry.icon;
            return (
              <div key={entry.label} role="group" aria-label={entry.label} className="flex h-9 items-center gap-2.5 rounded-[9px] px-2.5 text-[14px]">
                {Icon && <Icon size={15} strokeWidth={1.75} className="shrink-0 text-[var(--pf-text-secondary)]" />}
                <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                <button type="button" aria-label={`Less ${entry.label}`} disabled={!entry.onLess} onClick={() => { entry.onLess?.(); playSound('tap'); }} className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-[var(--pf-bg-elevated)] hover:bg-[var(--pf-bg-dark)] disabled:cursor-default disabled:opacity-30"><Minus size={13} /></button>
                <span className="w-[52px] text-center text-[13px] text-[var(--pf-text-secondary)]">{entry.value}</span>
                <button type="button" aria-label={`More ${entry.label}`} disabled={!entry.onMore} onClick={() => { entry.onMore?.(); playSound('tap'); }} className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-[var(--pf-bg-elevated)] hover:bg-[var(--pf-bg-dark)] disabled:cursor-default disabled:opacity-30"><Plus size={13} /></button>
              </div>
            );
          }

          const Icon = entry.icon;
          const isOpen = opened?.index === index;
          const disabled = entry.kind === 'action' && entry.disabled;
          return (
            <button
              key={entry.label}
              type="button"
              role={entry.kind === 'action' && entry.checked !== undefined ? 'menuitemcheckbox' : 'menuitem'}
              aria-checked={entry.kind === 'action' ? entry.checked : undefined}
              aria-haspopup={entry.kind === 'submenu' ? 'menu' : undefined}
              aria-expanded={entry.kind === 'submenu' ? isOpen : undefined}
              data-index={index}
              disabled={disabled}
              onClick={(event) => choose(entry, index, event.currentTarget)}
              onMouseEnter={(event) => {
                setActive(index);
                window.clearTimeout(hoverTimer.current);
                const element = event.currentTarget;
                hoverTimer.current = window.setTimeout(() => {
                  if (entry.kind === 'submenu') openSubmenu(index, element);
                  else setOpened(null);
                }, 90);
              }}
              className={`flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 text-left text-[14px] disabled:cursor-default disabled:opacity-40 ${active === index || isOpen ? 'bg-[var(--pf-bg-elevated)]' : ''} ${entry.kind === 'action' && entry.danger ? 'text-[var(--pf-warn)]' : ''}`}
            >
              {Icon && <Icon size={15} strokeWidth={1.75} className={`shrink-0 ${entry.kind === 'action' && entry.danger ? '' : 'text-[var(--pf-text-secondary)]'}`} />}
              <span className="min-w-0 flex-1 truncate">{entry.label}</span>
              {entry.kind === 'action' && entry.hint && <span className="shrink-0 text-[12px] text-[var(--pf-text-tertiary)]">{entry.hint}</span>}
              {entry.kind === 'action' && entry.checked && <Check size={15} strokeWidth={2.25} className="shrink-0" />}
              {entry.kind === 'submenu' && entry.value && <span className="max-w-[92px] shrink-0 truncate text-[12px] text-[var(--pf-text-tertiary)]">{entry.value}</span>}
              {entry.kind === 'submenu' && <ChevronRight size={14} className="shrink-0 text-[var(--pf-text-tertiary)]" />}
            </button>
          );
        })}
      </div>

      {openedEntry?.kind === 'submenu' && opened && (
        <Panel
          key={opened.index}
          entries={openedEntry.items}
          x={opened.rect.right - 4}
          y={opened.rect.top - 6}
          anchor={opened.rect}
          depth={depth + 1}
          onClose={onClose}
          onBack={() => { setOpened(null); ref.current?.focus(); }}
        />
      )}
    </>
  );
}

interface ContextMenuProps {
  at: { x: number; y: number } | null;
  /** Built fresh on every render, so ticks update while the menu is open. */
  items: MenuEntry[];
  onClose: () => void;
}

export default function ContextMenu({ at, items, onClose }: ContextMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const isOpen = at !== null;

  useEffect(() => {
    if (!isOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', onClose);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onClose);
      window.removeEventListener('resize', onClose);
    };
  }, [isOpen, onClose]);

  if (!at) return null;

  return createPortal(
    <div ref={rootRef}>
      <Panel key={`${at.x}-${at.y}`} entries={items} x={at.x} y={at.y} depth={0} onClose={onClose} />
    </div>,
    document.body,
  );
}
