'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Star } from 'lucide-react';

interface PunchCardProps {
  spots: number;
  punched: number;
  /** Today's spot is still open. */
  waiting: boolean;
  reward: number;
  /** Stamp the newest punch as the card appears. */
  stampLatest?: boolean;
}

const STAMPED = { scale: 1.9, rotate: -14, opacity: 0 };

/** An empty spot is a day still to come, never a day missed. The last one pays out. */
export default function PunchCard({ spots, punched, waiting, reward, stampLatest = false }: PunchCardProps) {
  const [settled, setSettled] = useState(stampLatest ? punched - 1 : punched);
  // A full card starts over, so its first punches are new again
  if (punched < settled) setSettled(0);

  return (
    <ol aria-label={`${punched} of ${spots} days. A full card earns ${reward} points.`} className="flex w-full items-center justify-between gap-1">
      {Array.from({ length: spots }, (_, spot) => {
        const reached = spot < punched;
        const last = spot === spots - 1;
        return (
          <li key={spot} className={`pf-punch-spot ${last ? 'pf-punch-reward' : ''} ${last && reached ? 'pf-punch-won' : ''} ${waiting && spot === punched ? 'pf-punch-next' : ''}`}>
            {last ? <Star fill="currentColor" strokeWidth={0} aria-hidden /> : reached && (
              <motion.span initial={spot < settled ? false : STAMPED} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', bounce: 0.35, duration: 0.45, delay: stampLatest ? 0.25 : 0 }}>
                <Check strokeWidth={3.25} />
              </motion.span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
