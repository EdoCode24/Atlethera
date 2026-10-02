import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Reveal } from "./Reveal";
import { YardLine } from "./YardLine";

interface SectionProps {
  id: string;
  yard: number;
  toward: "up" | "down" | null;
  labelledBy: string;
  className?: string;
  children: ReactNode;
}

/** A page section that starts on its own yard line. */
export function Section({ id, yard, toward, labelledBy, className, children }: SectionProps) {
  return (
    <section id={id} aria-labelledby={labelledBy} tabIndex={-1} className={cn("relative outline-none", className)}>
      <YardLine yard={yard} toward={toward} />
      {children}
    </section>
  );
}

interface SectionIntroProps {
  id: string;
  /** Which package the section belongs to, when it belongs to one. */
  badge?: string;
  title: string;
  body?: string;
  className?: string;
  children?: ReactNode;
}

export function SectionIntro({ id, badge, title, body, className, children }: SectionIntroProps) {
  return (
    <div className={cn("max-w-[44rem]", className)}>
      {badge && (
        <p className="mb-4 text-[0.95rem] font-semibold text-volt">{badge}</p>
      )}
      <Reveal as="h2" id={id} className="display text-display-lg">
        {title}
      </Reveal>
      {body && <p className="mt-6 max-w-[36rem] text-lead text-chalk-dim">{body}</p>}
      {children}
    </div>
  );
}
