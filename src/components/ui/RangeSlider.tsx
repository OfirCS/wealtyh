import { ChangeEvent } from "react";

interface RangeSliderProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (value: number) => void;
    formatValue?: (val: number) => string;
}

export default function RangeSlider({
    label,
    value,
    min,
    max,
    step = 1,
    onChange,
    formatValue = (v) => v.toString(),
}: RangeSliderProps) {
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        onChange(Number(e.target.value));
    };

    return (
        <div className="flex flex-col gap-2.5 bg-[var(--ws-bg-surface)] p-3.5 rounded-[12px] border border-[var(--ws-border)] shadow-sm">
            <div className="flex justify-between items-center">
                <label className="text-[14px] font-medium text-[var(--ws-text-secondary)]">
                    {label}
                </label>
                <span className="text-[15px] font-bold text-[var(--ws-text-primary)] tabular-nums">
                    {formatValue(value)}
                </span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={handleChange}
                className="w-full h-1.5 bg-[var(--ws-border)] rounded-full appearance-none cursor-pointer accent-[var(--ws-text-primary)] outline-none"
            />
        </div>
    );
}
