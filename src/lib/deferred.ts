"use client";

import { ScrollTrigger } from "./gsap";

/**
 * Animation setup for sections below the fold runs after hydration, when the browser is
 * idle, one section per task and in document order. That keeps the hydration task short
 * (faster first paint, less blocking time) while pins are still created top to bottom,
 * which ScrollTrigger needs to measure positions correctly.
 */

interface Task {
  el: Element;
  run: () => void;
  cancelled: boolean;
}

const queue: Task[] = [];
let scheduled = false;
let flushing = false;
let readyResolve: (() => void) | null = null;
let ready: Promise<void> | null = null;

function whenIdle(cb: () => void) {
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(cb, { timeout: 900 });
  else window.setTimeout(cb, 120);
}

function yieldToMain() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}

async function flush() {
  flushing = true;
  while (queue.length > 0) {
    queue.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    const task = queue.shift()!;
    if (!task.cancelled && task.el.isConnected) task.run();
    await yieldToMain();
  }
  flushing = false;
  scheduled = false;
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
  const resolve = readyResolve;
  ready = null;
  readyResolve = null;
  resolve?.();
}

/** Queues `run` for idle time. Returns a function that cancels it if it has not run yet. */
export function deferSetup(el: Element, run: () => void): () => void {
  const task: Task = { el, run, cancelled: false };
  queue.push(task);
  if (!ready) ready = new Promise((resolve) => (readyResolve = resolve));
  if (!scheduled && !flushing) {
    scheduled = true;
    whenIdle(() => void flush());
  }
  return () => {
    task.cancelled = true;
  };
}

/** Resolves once every queued setup has run (immediately if nothing is queued). */
export function setupsReady(): Promise<void> {
  return ready ?? Promise.resolve();
}
