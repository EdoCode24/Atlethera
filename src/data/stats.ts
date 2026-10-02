"use client";

import { emptyGame, type GameStats } from "@/domain/team/stats";
import { read, useStored, write } from "./store";

type Games = Record<string, GameStats>;

const key = (workspaceId: string) => `games.${workspaceId}`;
const NONE: Games = {};

export function useGames(workspaceId: string | undefined): Games {
  return useStored(workspaceId ? key(workspaceId) : "games.none", NONE);
}

export const statsRepo = {
  /** Changes one game's score and stats, starting from an empty sheet the first time. */
  update(workspaceId: string, eventId: string, change: (game: GameStats) => GameStats) {
    const games = read(key(workspaceId), NONE);
    const next = change(games[eventId] ?? emptyGame(eventId));
    write(key(workspaceId), { ...games, [eventId]: { ...next, updatedAt: new Date().toISOString() } });
  },
  /** Drops the stats of games that left the calendar. */
  drop(workspaceId: string, eventIds: string[]) {
    const games = read(key(workspaceId), NONE);
    if (!eventIds.some((id) => id in games)) return;
    const next = { ...games };
    for (const id of eventIds) delete next[id];
    write(key(workspaceId), next);
  },
};
