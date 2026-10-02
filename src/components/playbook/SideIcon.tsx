import type { PlaySide } from "@/domain/playbook/types";

/** O for offense, X for defense, a ball on a kicking tee for special teams. */
export function SideIcon({ side, className = "size-3.5" }: { side: PlaySide; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className}>
      {side === "offense" ? (
        <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      ) : side === "defense" ? (
        <path d="m3 3 10 10M13 3 3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      ) : (
        <>
          <ellipse cx="8" cy="6.5" rx="3.2" ry="4.8" transform="rotate(35 8 6.5)" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M5 14.5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
