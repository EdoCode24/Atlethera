"use client";

import { useRef, type AnchorHTMLAttributes, type ReactNode } from "react";
import { gsap, MQ, useGSAP } from "@/lib/gsap";
import { buttonClass } from "./Button";

interface MagneticButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: "primary" | "ghost";
  children: ReactNode;
}

/** A button link that leans toward a fine pointer. Touch and reduced motion get a plain link. */
export function MagneticButton({ variant = "primary", className, children, ...rest }: MagneticButtonProps) {
  const ref = useRef<HTMLAnchorElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(MQ.finePointer, () => {
        const label = el.querySelector<HTMLElement>("[data-magnet-label]");
        const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3" });
        const yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3" });
        const lxTo = label ? gsap.quickTo(label, "x", { duration: 0.5, ease: "power3" }) : null;
        const lyTo = label ? gsap.quickTo(label, "y", { duration: 0.5, ease: "power3" }) : null;

        const move = (event: PointerEvent) => {
          const rect = el.getBoundingClientRect();
          const dx = event.clientX - (rect.left + rect.width / 2);
          const dy = event.clientY - (rect.top + rect.height / 2);
          xTo(dx * 0.22);
          yTo(dy * 0.3);
          lxTo?.(dx * 0.1);
          lyTo?.(dy * 0.12);
        };
        const leave = () => {
          xTo(0);
          yTo(0);
          lxTo?.(0);
          lyTo?.(0);
        };
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerleave", leave);
        return () => {
          el.removeEventListener("pointermove", move);
          el.removeEventListener("pointerleave", leave);
        };
      });
    },
    { scope: ref },
  );

  return (
    <a ref={ref} className={buttonClass(variant, className)} {...rest}>
      <span data-magnet-label className="inline-flex items-center gap-2">
        {children}
      </span>
    </a>
  );
}
