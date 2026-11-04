"use client";

import { motion } from "framer-motion";

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "outline";
  fullWidth?: boolean;
  className?: string;
  type?: "button" | "submit";
}

export default function Button({
  children,
  onClick,
  disabled = false,
  variant = "primary",
  fullWidth = false,
  className = "",
  type = "button",
}: ButtonProps) {
  const baseStyles =
    "rounded-full font-semibold px-6 py-3.5 text-[16px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pf-text-primary)] focus-visible:ring-offset-2 flex justify-center items-center gap-2";

  const variantStyles =
    variant === "primary"
      ? "bg-[var(--pf-text-primary)] text-[var(--pf-text-primary)]"
      : "bg-transparent border border-[var(--pf-border)] text-[var(--pf-text-primary)]";

  const widthStyles = fullWidth ? "w-full" : "";

  const disabledStyles = disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer";

  return (
    <motion.button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`${baseStyles} ${variantStyles} ${widthStyles} ${disabledStyles} ${className}`}
      whileHover={
        disabled
          ? undefined
          : {
            scale: 1.01,
            boxShadow: "0 4px 12px rgba(50, 48, 47, 0.10)",
          }
      }
      whileTap={disabled ? undefined : { scale: 0.99 }}
    >
      {children}
    </motion.button>
  );
}
