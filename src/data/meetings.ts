"use client";

import { emptyMeeting, type Meeting } from "@/domain/team/meeting";
import { read, useStored, write } from "./store";

type Meetings = Record<string, Meeting>;

const key = (workspaceId: string) => `meetings.${workspaceId}`;
const NONE: Meetings = {};

export function useMeetings(workspaceId: string | undefined): Meetings {
  return useStored(workspaceId ? key(workspaceId) : "meetings.none", NONE);
}

export const meetingRepo = {
  /** Changes one meeting, starting from an empty one the first time. Returning it unchanged writes nothing. */
  update(workspaceId: string, eventId: string, change: (meeting: Meeting) => Meeting) {
    const meetings = read(key(workspaceId), NONE);
    const current = meetings[eventId];
    const next = change(current ?? emptyMeeting(eventId));
    if (current && next === current) return;
    write(key(workspaceId), { ...meetings, [eventId]: { ...next, updatedAt: new Date().toISOString() } });
  },
  /** Drops what belonged to meetings that left the calendar. */
  drop(workspaceId: string, eventIds: string[]) {
    const meetings = read(key(workspaceId), NONE);
    if (!eventIds.some((id) => id in meetings)) return;
    const next = { ...meetings };
    for (const id of eventIds) delete next[id];
    write(key(workspaceId), next);
  },
};
