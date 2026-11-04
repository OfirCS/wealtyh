'use client';

export default function Footer() {
  return (
    <footer className="flex items-center gap-3 text-[13px] text-[var(--pf-text-tertiary)]">
      <a href="https://github.com/OfirCS/wealtyh" target="_blank" rel="noopener noreferrer" className="hover:underline">
        Source
      </a>
      <span aria-hidden>·</span>
      <a href="mailto:hello@pathfinder.fyi?subject=Sponsor%20Pathfinder" className="hover:underline">
        Sponsor
      </a>
    </footer>
  );
}
