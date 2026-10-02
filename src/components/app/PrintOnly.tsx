"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const noChanges = () => () => {};

/**
 * A sheet that only exists on paper: hidden on screen, and while the page is printed (from a
 * button or Ctrl+P) it is the only thing that prints. See `.doc-print-root` in globals.css.
 */
export function PrintOnly({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(noChanges, () => true, () => false);
  if (!mounted) return null;
  return createPortal(<div className="doc-print-root">{children}</div>, document.body);
}
