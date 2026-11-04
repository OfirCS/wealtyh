'use client';

import { useRef, useState } from 'react';
import { playSound } from '@/lib/sounds';

/** Position and size as fractions of the canvas, so a layout survives window resizes. */
export interface CardLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CanvasCardProps {
  title: string;
  layout: CardLayout;
  canvas: { width: number; height: number };
  zIndex: number;
  action?: React.ReactNode;
  onChange: (layout: CardLayout) => void;
  onFocus: () => void;
  children: React.ReactNode;
}

const SNAP = 12;
const MIN_WIDTH = 240;
const MIN_HEIGHT = 150;

function snap(value: number): number {
  return Math.round(value / SNAP) * SNAP;
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

interface Gesture {
  mode: 'move' | 'resize';
  pointerX: number;
  pointerY: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A sheet on the canvas: drag it by its title, resize it from the corner. */
export default function CanvasCard({ title, layout, canvas, zIndex, action, onChange, onFocus, children }: CanvasCardProps) {
  const gesture = useRef<Gesture | null>(null);
  const [live, setLive] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const frame = live ?? {
    x: layout.x * canvas.width,
    y: layout.y * canvas.height,
    width: layout.w * canvas.width,
    height: layout.h * canvas.height,
  };

  const begin = (mode: Gesture['mode']) => (event: React.PointerEvent) => {
    if ((event.target as HTMLElement).closest('button, select, input')) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { mode, pointerX: event.clientX, pointerY: event.clientY, ...frame };
    setLive(frame);
    onFocus();
  };

  const track = (event: React.PointerEvent) => {
    const current = gesture.current;
    if (!current) return;
    const dx = event.clientX - current.pointerX;
    const dy = event.clientY - current.pointerY;
    if (current.mode === 'move') {
      setLive({
        ...current,
        x: clamp(current.x + dx, 0, canvas.width - current.width),
        y: clamp(current.y + dy, 0, canvas.height - current.height),
      });
    } else {
      setLive({
        ...current,
        width: clamp(current.width + dx, MIN_WIDTH, canvas.width - current.x),
        height: clamp(current.height + dy, MIN_HEIGHT, canvas.height - current.y),
      });
    }
  };

  const finish = () => {
    if (!gesture.current || !live) return;
    gesture.current = null;
    const width = clamp(snap(live.width), MIN_WIDTH, canvas.width);
    const height = clamp(snap(live.height), MIN_HEIGHT, canvas.height);
    onChange({
      x: clamp(snap(live.x), 0, canvas.width - width) / canvas.width,
      y: clamp(snap(live.y), 0, canvas.height - height) / canvas.height,
      w: width / canvas.width,
      h: height / canvas.height,
    });
    setLive(null);
    playSound('tap');
  };

  const dragging = live !== null;

  return (
    <section
      aria-label={title}
      onPointerDown={onFocus}
      className={`absolute left-0 top-0 flex flex-col overflow-hidden rounded-[14px] border bg-[var(--pf-bg-primary)] ${dragging ? 'border-[var(--pf-text-primary)] shadow-[0_18px_40px_rgba(0,0,0,0.16)]' : 'border-[var(--pf-border)] shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-[transform,width,height] duration-300 ease-out'}`}
      style={{ transform: `translate(${frame.x}px, ${frame.y}px)`, width: frame.width, height: frame.height, zIndex: dragging ? 30 : zIndex }}
    >
      <header
        onPointerDown={begin('move')}
        onPointerMove={track}
        onPointerUp={finish}
        className={`flex h-10 shrink-0 touch-none select-none items-center justify-between gap-3 border-b border-[var(--pf-border)] px-3 ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        <h2 className="truncate text-[14px] font-semibold">{title}</h2>
        {action}
      </header>
      <div className="flex min-h-0 flex-1 flex-col p-2">{children}</div>
      <div
        aria-hidden
        onPointerDown={begin('resize')}
        onPointerMove={track}
        onPointerUp={finish}
        className="absolute bottom-0 right-0 h-5 w-5 cursor-nwse-resize touch-none"
        style={{ background: 'linear-gradient(135deg, transparent 50%, var(--pf-border) 50%, var(--pf-border) 60%, transparent 60%, transparent 72%, var(--pf-border) 72%, var(--pf-border) 82%, transparent 82%)' }}
      />
    </section>
  );
}
