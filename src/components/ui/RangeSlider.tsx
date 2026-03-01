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
        <div className="flex flex-col gap-3 py-2">
            <div className="flex justify-between items-center px-1">
                <label className="text-[13px] font-semibold tracking-wide text-[var(--ws-text-secondary)]">
                    {label}
                </label>
                <span className="text-[16px] font-bold text-[var(--ws-text-primary)] tabular-nums">
                    {formatValue(value)}
                </span>
            </div>
            <div className="px-1">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={handleChange}
                    className="w-full h-2 bg-[var(--ws-border)] rounded-full appearance-none cursor-pointer accent-[var(--ws-text-primary)] outline-none hover:opacity-90 transition-opacity"
                />
            </div>
        </div>
    );
}
