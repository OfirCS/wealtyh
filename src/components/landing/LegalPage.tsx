import Link from 'next/link';
import { LogoMark } from '@/components/ui/Logo';

/** Plain words on one calm page. Used for the privacy policy and the terms. */
export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <div className="pf-paper h-[100dvh] overflow-y-auto">
      <div className="mx-auto w-full max-w-[640px] px-5 pb-16 pt-6 sm:px-8">
        <Link href="/" className="flex w-fit items-center gap-2.5">
          <LogoMark size={22} />
          <span className="font-serif text-[22px] leading-none" style={{ fontWeight: 500 }}>Pathfinder</span>
        </Link>
        <h1 className="mt-10 font-serif text-[44px] leading-none tracking-tight">{title}</h1>
        <p className="mt-2 text-[14px] text-[var(--pf-text-tertiary)]">Updated {updated}</p>
        <div className="pf-legal mt-8">{children}</div>
        {contact && <p className="mt-8 text-[15px] text-[var(--pf-text-secondary)]">Questions: <a className="underline" href={`mailto:${contact}`}>{contact}</a></p>}
        <p className="mt-8 flex gap-5 border-t border-[var(--pf-border)] pt-4 text-[14px]">
          <Link className="pf-link" href="/privacy">Privacy</Link>
          <Link className="pf-link" href="/terms">Terms</Link>
        </p>
      </div>
    </div>
  );
}
