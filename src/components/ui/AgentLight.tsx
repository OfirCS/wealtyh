/** The agent's one sign of life: a pilot light that stays lit, and breathes while it works. */
export default function AgentLight({ working = false, size = 8, onDark = false }: { working?: boolean; size?: number; onDark?: boolean }) {
  return (
    <span
      aria-hidden
      className={`pf-light shrink-0 ${working ? 'pf-light-on' : ''} ${onDark ? 'pf-light-dark' : ''}`}
      style={{ width: size, height: size }}
    />
  );
}
