"use client";

import { useEffect, useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

export function CountUp({
    value,
    duration = 1.5,
    isCurrency = false,
    delay = 0,
    formatFn,
}: {
    value: number;
    duration?: number;
    isCurrency?: boolean;
    delay?: number;
    formatFn?: (val: number) => string;
}) {
    const [hasStarted, setHasStarted] = useState(false);

    const spring = useSpring(0, {
        duration: duration * 1000,
        bounce: 0,
    });

    const display = useTransform(spring, (current) => {
        if (formatFn) return formatFn(Math.round(current));
        const formatted = Math.round(current).toLocaleString();
        return isCurrency ? `$${formatted}` : formatted;
    });

    useEffect(() => {
        const timer = setTimeout(() => {
            setHasStarted(true);
            spring.set(value);
        }, delay * 1000);

        return () => clearTimeout(timer);
    }, [value, spring, delay]);

    return <motion.span>{display}</motion.span>;
}
