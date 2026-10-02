"use client";

import { cn } from "@/lib/cn";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "md" | "lg";
}

/**
 * Two or more equal-width toggle buttons with a sliding indicator. Buttons use
 * aria-pressed so the choice is announced without building a full tablist.
 */
export function SegmentedControl<T extends string>({ label, options, value, onChange, className, size = "md" }: SegmentedControlProps<T>) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "relative grid rounded-[0.85rem] bg-night-900 p-1 shadow-[inset_0_0_0_1px_var(--color-hairline-strong)]",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="keep-fade absolute inset-y-1 left-1 rounded-[0.62rem] bg-volt transition-transform duration-500 ease-(--ease-out-expo)"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-10 rounded-[0.62rem] px-4 font-semibold whitespace-nowrap transition-colors duration-300",
              size === "lg" ? "h-11 text-[0.95rem]" : "h-9 text-[0.85rem]",
              active ? "text-night-950" : "text-chalk-dim hover:text-chalk",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
