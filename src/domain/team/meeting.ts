import type { SportId } from "@/domain/sports/types";
import type { Attendance, PlayRef } from "./practice";
import { groupOf, positionGroups, type Player } from "./roster";

/**
 * A meeting's own page: who it is for (the whole team or some position groups), the agenda with
 * the plays to watch, what was decided, and who came.
 */

export interface AgendaItem {
  id: string;
  title: string;
  minutes: number;
  notes: string;
  plays: PlayRef[];
}

export interface Meeting {
  /** The meeting on the calendar this belongs to. */
  eventId: string;
  /** Position group ids; empty means the whole team. */
  groups: string[];
  agenda: AgendaItem[];
  notes: string;
  /** Keyed by player id. */
  attendance: Record<string, Attendance>;
  updatedAt: string;
}

export function emptyMeeting(eventId: string, now = new Date()): Meeting {
  return { eventId, groups: [], agenda: [], notes: "", attendance: {}, updatedAt: now.toISOString() };
}

/** Groups kept to the sport's, in field order. */
export function meetingGroups(groups: string[], sport: SportId): string[] {
  return positionGroups(sport)
    .map((g) => g.id)
    .filter((id) => groups.includes(id));
}

/**
 * The players a meeting is for: everyone on the roster who is not inactive, or only those who
 * play in one of its groups.
 */
export function invitedPlayers(players: Player[], groups: string[], sport: SportId): Player[] {
  const wanted = meetingGroups(groups, sport);
  return players.filter((p) => p.status !== "inactive" && (wanted.length === 0 || p.positions.some((pos) => wanted.includes(groupOf(sport, pos)?.id ?? ""))));
}
