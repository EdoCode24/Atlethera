import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { Flip } from "gsap/Flip";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, Flip, DrawSVGPlugin);
gsap.defaults({ ease: "expo.out", duration: 0.9 });

if (typeof window !== "undefined") {
  ScrollTrigger.config({ ignoreMobileResize: true });
}

const motionOk = "(prefers-reduced-motion: no-preference)";

/** Media conditions shared by every animated section. */
export const MQ = {
  reduce: "(prefers-reduced-motion: reduce)",
  motion: motionOk,
  /** Room for pinned, scrubbed choreography. */
  desktop: `(min-width: 1024px) and (min-height: 640px) and ${motionOk}`,
  /** Everything else that still allows motion. */
  compact: `(max-width: 1023px) and ${motionOk}, (max-height: 639px) and ${motionOk}`,
  finePointer: `(hover: hover) and (pointer: fine) and ${motionOk}`,
} as const;

export { gsap, useGSAP, ScrollTrigger, SplitText, Flip, DrawSVGPlugin };
