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
  if (!SPONSOR) return null;

  return (
    <a
      href={SPONSOR.url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="block rounded-[14px] bg-[var(--pf-bg-elevated)] p-4 transition-colors hover:bg-[var(--pf-bg-dark)]"
    >
      <span className="text-[13px] text-[var(--pf-text-tertiary)]">Sponsor</span>
      <span className="mt-1 block text-[15px] font-semibold">{SPONSOR.name}</span>
      <span className="mt-0.5 block text-[14px] text-[var(--pf-text-secondary)]">{SPONSOR.pitch}</span>
    </a>
  );
}
