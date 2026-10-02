import { cn } from "@/lib/cn";

/**
 * A field seen from above, drawn faintly: yard lines every 5 yards and hash ticks
 * every yard. Used as section ground so the page keeps standing on a field.
 */
export function FieldTexture({ className }: { className?: string }) {
  const lines: number[] = [];
  for (let x = 0; x <= 100; x += 5) lines.push(x);
  let ticks = "";
  for (let x = 1; x < 100; x++) {
    if (x % 5 === 0) continue;
    ticks += `M${x} 0v0.9M${x} 22v0.9M${x} 30.4v0.9M${x} 52.4v0.9`;
  }

  return (
    <svg viewBox="0 0 100 53.3" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className={cn("field-texture pointer-events-none absolute inset-0 size-full text-chalk", className)}>
      <path d={ticks} stroke="currentColor" strokeWidth="0.12" opacity="0.18" />
      {lines.map((x) => (
        <line key={x} x1={x} x2={x} y1="0" y2="53.3" stroke="currentColor" strokeWidth={x % 10 === 0 ? 0.1 : 0.06} opacity={x % 10 === 0 ? 0.14 : 0.08} />
      ))}
    </svg>
  );
}
