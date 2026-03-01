"use client";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
}

export default function SelectInput({
  label,
  value,
  onChange,
  options,
}: SelectInputProps) {
  return (
    <div className="flex flex-col gap-2 group">
      <label className="text-[13px] font-semibold tracking-wide text-[var(--ws-text-secondary)] pl-1 transition-colors group-focus-within:text-[var(--ws-text-primary)]">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-[16px] border border-transparent bg-[var(--ws-bg-primary)] shadow-[inset_0_1px_3px_rgba(0,0,0,0.15)] px-4 py-4 pr-10 text-[16px] font-medium text-[var(--ws-text-primary)] focus:bg-[var(--ws-bg-surface)] focus:border-[var(--ws-text-primary)] focus:ring-1 focus:ring-[var(--ws-text-primary)] focus:shadow-none focus:outline-none transition-all duration-200 cursor-pointer"
        >
          <option value="" disabled>
            Select...
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {/* Custom chevron */}
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4 6L8 10L12 6"
              stroke="var(--ws-text-tertiary)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
