"use client";

import { newId } from "@/domain/playbook/formations";
import { newEvent, weeklyDates, type EventInput, type TeamEvent } from "@/domain/team/calendar";
import { meetingRepo } from "./meetings";
import { practiceRepo } from "./practice";
import { statsRepo } from "./stats";
import { videoRepo } from "./videos";
import { read, useStored, write } from "./store";

const key = (workspaceId: string) => `calendar.${workspaceId}`;
const NONE: TeamEvent[] = [];

function load(workspaceId: string): TeamEvent[] {
  return read(key(workspaceId), NONE);
}

export function useEvents(workspaceId: string | undefined): TeamEvent[] {
  return useStored(workspaceId ? key(workspaceId) : "calendar.none", NONE);
}

export const calendarRepo = {
  /** Adds an event, or one per week through `until` as a series. */
  add(workspaceId: string, input: EventInput, until: string | null = null): TeamEvent[] {
    const dates = until ? weeklyDates(input.date, until) : [input.date];
    const seriesId = dates.length > 1 ? newId("sr") : null;
    const added = dates.map((date) => newEvent({ ...input, date }, newId("ev"), seriesId));
    write(key(workspaceId), [...load(workspaceId), ...added]);
    return added;
  },
  update(workspaceId: string, id: string, input: EventInput) {
    write(
      key(workspaceId),
      load(workspaceId).map((e) => (e.id === id ? { ...newEvent(input, e.id, e.seriesId), createdAt: e.createdAt } : e)),
    );
  },
  /** Removes one event, or it and the later events of its series. */
  remove(workspaceId: string, id: string, scope: "one" | "following" = "one") {
    const events = load(workspaceId);
    const target = events.find((e) => e.id === id);
    if (!target) return;
    const gone = (e: TeamEvent) => e.id === id || (scope === "following" && target.seriesId !== null && e.seriesId === target.seriesId && e.date >= target.date);
    write(
      key(workspaceId),
      events.filter((e) => !gone(e)),
    );
    // What hangs off the removed events goes with them.
    const ids = events.filter(gone).map((e) => e.id);
    practiceRepo.drop(workspaceId, ids);
    meetingRepo.drop(workspaceId, ids);
    statsRepo.drop(workspaceId, ids);
    videoRepo.unlinkEvents(workspaceId, ids);
  },
};
