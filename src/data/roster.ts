"use client";

import { newId } from "@/domain/playbook/formations";
import { EMPTY_ROSTER, moveInDepth, newPlayer, placeInDepth, syncDepth, type Player, type PlayerInput, type Roster } from "@/domain/team/roster";
import { read, useStored, write } from "./store";

const key = (workspaceId: string) => `roster.${workspaceId}`;

function load(workspaceId: string): Roster {
  return read(key(workspaceId), EMPTY_ROSTER);
}

/** Saves the roster with its depth chart kept in step with the players. */
function save(workspaceId: string, players: Player[], depth: Record<string, string[]>) {
  write(key(workspaceId), { players, depth: syncDepth(depth, players) } satisfies Roster);
}

export function useRoster(workspaceId: string | undefined): Roster {
  return useStored(workspaceId ? key(workspaceId) : "roster.none", EMPTY_ROSTER);
}

export const rosterRepo = {
  add(workspaceId: string, input: PlayerInput): Player {
    const r = load(workspaceId);
    const player = newPlayer(input, newId("pl"));
    save(workspaceId, [...r.players, player], r.depth);
    return player;
  },
  addMany(workspaceId: string, inputs: PlayerInput[]): Player[] {
    const r = load(workspaceId);
    const added = inputs.map((input) => newPlayer(input, newId("pl")));
    save(workspaceId, [...r.players, ...added], r.depth);
    return added;
  },
  update(workspaceId: string, id: string, patch: Partial<Omit<Player, "id" | "createdAt">>) {
    const r = load(workspaceId);
    const players = r.players.map((p) => {
      if (p.id !== id) return p;
      const next = { ...p, ...patch, updatedAt: new Date().toISOString() };
      // An injury belongs to injured players only.
      if (next.status !== "injured") next.injury = null;
      else if (!next.injury) next.injury = { note: "", returnDate: null };
      return next;
    });
    save(workspaceId, players, r.depth);
  },
  remove(workspaceId: string, id: string) {
    const r = load(workspaceId);
    save(
      workspaceId,
      r.players.filter((p) => p.id !== id),
      r.depth,
    );
  },
  moveInDepth(workspaceId: string, position: string, playerId: string, delta: -1 | 1) {
    const r = load(workspaceId);
    save(workspaceId, r.players, moveInDepth(r.depth, position, playerId, delta));
  },
  placeInDepth(workspaceId: string, position: string, playerId: string, index: number) {
    const r = load(workspaceId);
    save(workspaceId, r.players, placeInDepth(r.depth, position, playerId, index));
  },
};
