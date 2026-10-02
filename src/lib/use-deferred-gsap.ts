"use client";

import type { RefObject } from "react";
import { deferSetup } from "./deferred";
import { useGSAP } from "./gsap";

/**
 * Like useGSAP, but the setup runs in idle time after hydration (see lib/deferred.ts).
 * Everything the setup creates belongs to the component's GSAP context and is reverted
 * on unmount.
 */
export function useDeferredGSAP(setup: () => void, config: { scope: RefObject<Element | null>; dependencies?: unknown[] }) {
  useGSAP(
    (_context, contextSafe) => {
      const el = config.scope.current;
      if (!el || !contextSafe) return;
      return deferSetup(el, contextSafe(setup));
    },
    { scope: config.scope, dependencies: config.dependencies ?? [] },
  );
}
