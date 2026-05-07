'use client';

export default function Footer() {
  return (
    <footer
      className="hidden md:flex fixed bottom-3 left-1/2 -translate-x-1/2 z-30 items-center gap-3 text-[11px] pointer-events-none"
      style={{ color: 'var(--ws-text-tertiary)' }}
    >
      <span className="pointer-events-auto">
        Made for curious Canadians
      </span>
      <span aria-hidden>·</span>
      <a
        href="https://github.com/OfirCS/wealtyh"
        target="_blank"
        rel="noopener noreferrer"
        className="pointer-events-auto hover:underline"
      >
        Source
      </a>
      <span aria-hidden>·</span>
      <a
        href="mailto:hello@pathfinder.fyi?subject=Sponsor%20Pathfinder"
        className="pointer-events-auto hover:underline"
      >
        Sponsor
      </a>
    </footer>
  );
}
