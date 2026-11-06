'use client';

import { motion, useReducedMotion } from 'framer-motion';

interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

/** Rises into place the first time it's seen. */
export default function Reveal({ children, delay = 0, className }: RevealProps) {
  const stillOnly = useReducedMotion();
  return (
    <motion.div className={className} initial={stillOnly ? false : { opacity: 0, y: 26 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ type: 'spring', bounce: 0, duration: 0.8, delay }}>
      {children}
    </motion.div>
  );
}
