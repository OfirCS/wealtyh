const PATHS: Record<string, React.ReactNode> = {
  housing: <path d="m4 11 8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8Z" />,
  groceries: <><path d="M4 5h2l2 10h9l2-7H7" /><circle cx="10" cy="19" r="1.300" /><circle cx="16" cy="19" r="1.300" /></>,
  bills: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9.500 8h5M9.500 12h5" /></>,
  transport: <><path d="M5 11l1.500-5h11L19 11v6H5v-6Z" /><path d="M5 11h14" /><circle cx="8.500" cy="14" r=".6" /><circle cx="15.500" cy="14" r=".6" /><path d="M7 17v2M17 17v2" /></>,
  kids: <><circle cx="12" cy="12" r="8" /><path d="M9 14c.8 1 1.800 1.500 3 1.500s2.200-.5 3-1.500M9.500 10h0M14.500 10h0" /></>,
  health: <path d="M12 20s-7-4.500-7-10a4 4 0 0 1 7-2.500A4 4 0 0 1 19 10c0 5.500-7 10-7 10Z" />,
  eating: <path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5M17 3c-2 1-3 4-3 8h3v10" />,
  shopping: <><path d="M6 8h12l1 12H5L6 8Z" /><path d="M9 10V7a3 3 0 0 1 6 0v3" /></>,
  fun: <path d="m12 4 2.400 5 5.600.7-4.100 3.800 1.100 5.500-5-2.800-5 2.800 1.100-5.500L4 9.700 9.600 9 12 4Z" />,
  debt: <><rect x="3" y="6" width="18" height="12" rx="2.500" /><path d="M3 10h18" /></>,
};

const FALLBACK = <><circle cx="12" cy="12" r="8" /><path d="M12 8v8M8 12h8" /></>;

export default function CategoryIcon({ id }: { id: string }) {
  return (
    <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--pf-bg-elevated)]">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {PATHS[id] ?? FALLBACK}
      </svg>
    </span>
  );
}
