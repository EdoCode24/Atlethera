"use client";

import { emptyPlan, type PracticePlan } from "@/domain/team/practice";
import { read, useStored, write } from "./store";

type Plans = Record<string, PracticePlan>;

const key = (workspaceId: string) => `practice.${workspaceId}`;
const NONE: Plans = {};

export function usePlans(workspaceId: string | undefined): Plans {
  return useStored(workspaceId ? key(workspaceId) : "practice.none", NONE);
}

export const practiceRepo = {
  /** Changes one practice's plan, starting from an empty one the first time. */
  update(workspaceId: string, eventId: string, change: (plan: PracticePlan) => PracticePlan) {
    const plans = read(key(workspaceId), NONE);
    const next = change(plans[eventId] ?? emptyPlan(eventId));
    write(key(workspaceId), { ...plans, [eventId]: { ...next, updatedAt: new Date().toISOString() } });
  },
  /** Drops the plans of practices that left the calendar. */
  drop(workspaceId: string, eventIds: string[]) {
    const plans = read(key(workspaceId), NONE);
    if (!eventIds.some((id) => id in plans)) return;
    const next = { ...plans };
    for (const id of eventIds) delete next[id];
    write(key(workspaceId), next);
  },
};
