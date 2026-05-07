'use client';

interface Sponsor {
  name: string;
  pitch: string;
  url: string;
}

const SPONSOR: Sponsor | null = (() => {
  const name = process.env.NEXT_PUBLIC_SPONSOR_NAME;
  const pitch = process.env.NEXT_PUBLIC_SPONSOR_PITCH;
  const url = process.env.NEXT_PUBLIC_SPONSOR_URL;
  if (!name || !pitch || !url) return null;
  return { name, pitch, url };
})();

export default function SponsorSlot() {
  const sponsor = SPONSOR ?? {
    name: 'Sponsor this slot',
    pitch: 'Reach Canadians making real money decisions. hello@pathfinder.fyi',
    url: 'mailto:hello@pathfinder.fyi?subject=Sponsor%20Pathfinder',
  };
  const isPlaceholder = !SPONSOR;

  return (
    <a
      href={sponsor.url}
      target={sponsor.url.startsWith('mailto:') ? undefined : '_blank'}
      rel="noopener noreferrer sponsored"
      className="block rounded-2xl px-4 py-3 transition-all hover:translate-y-[-1px]"
      style={{
        backgroundColor: 'var(--ws-bg-surface)',
        border: '1px dashed var(--ws-border)',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="text-[9px] font-bold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: 'var(--ws-bg-elevated)',
            color: 'var(--ws-text-tertiary)',
          }}
        >
          {isPlaceholder ? 'Ad slot' : 'Sponsored'}
        </span>
        <span
          className="text-[12px] font-semibold truncate"
          style={{ color: 'var(--ws-text-primary)' }}
        >
          {sponsor.name}
        </span>
      </div>
      <p
        className="text-[11px] leading-snug"
        style={{ color: 'var(--ws-text-secondary)' }}
      >
        {sponsor.pitch}
      </p>
    </a>
  );
}
