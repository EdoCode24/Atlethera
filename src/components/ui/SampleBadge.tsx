import { cn } from "@/lib/cn";

/** Marks a mockup as illustrative, so no sample number reads as a real result. */
export function SampleBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-night-950/70 px-2.5 py-1 text-[0.7rem] font-medium text-mist shadow-[inset_0_0_0_1px_var(--color-hairline)]",
        className,
      )}
    >
      {label}
    </span>
  );
}
