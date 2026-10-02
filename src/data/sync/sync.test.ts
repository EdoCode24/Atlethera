import { describe, expect, it } from "vitest";
import type { Playbook, Play } from "@/domain/playbook/types";
import { newPlayer, type Roster } from "@/domain/team/roster";
import { decodePlaybooks, diffRows, encodePlaybooks, mergePlayerRoster, type Sent } from "./codecs";
import { affected, readsRow, route, rowsOf } from "./keys";
import { replayPlan } from "./outbox";

const WS = "5b1e1c9a-0000-4000-8000-000000000001";
const play = (id: string, name = id) => ({ id, name, side: "offense", players: [], opponent: [] }) as unknown as Play;
const book = (id: string, plays: Play[]) => ({ id, name: id, workspaceId: WS, plays }) as unknown as Playbook;

describe("key routing", () => {
  it("syncs the active team's data and keeps device preferences local", () => {
    expect(route(`roster.${WS}`, WS)).toEqual({ kind: "doc", name: "roster" });
    expect(route(`playbooks.${WS}`, WS)).toEqual({ kind: "playbooks" });
    expect(route(`print.${WS}`, WS)).toEqual({ kind: "local" });
    expect(route("hints.editor", WS)).toEqual({ kind: "local" });
    expect(route(`roster.other`, WS)).toEqual({ kind: "local" });
    expect(route(`roster.${WS}`, null)).toEqual({ kind: "local" });
  });

  it("gives players the public roster and their own row", () => {
    expect(rowsOf("roster", "coach", null)).toEqual(["roster"]);
    expect(rowsOf("roster", "player", "pl1")).toEqual(["roster.public", "me:pl1"]);
    expect(rowsOf("evaluation", "player", "pl1")).toEqual(["me:pl1"]);
    expect(rowsOf("calendar", "player", "pl1")).toEqual(["calendar"]);
  });

  it("knows which rows each role reads and what they feed", () => {
    expect(readsRow("roster", "player", "pl1")).toBe(false);
    expect(readsRow("me:pl2", "player", "pl1")).toBe(false);
    expect(readsRow("me:pl1", "player", "pl1")).toBe(true);
    expect(readsRow("roster.public", "coach", null)).toBe(false);
    expect(affected("me:pl1", "player", "pl1", WS)).toEqual([`roster.${WS}`, `evaluation.${WS}`]);
    expect(affected("play:x", "coach", null, WS)).toEqual([`playbooks.${WS}`]);
    expect(affected("me:pl1", "coach", null, WS)).toEqual([]);
    expect(affected("calendar", "player", "pl1", WS)).toEqual([`calendar.${WS}`]);
  });
});

describe("playbook rows", () => {
  it("round-trips, one row per play, in order", () => {
    const books = [book("b1", [play("p1"), play("p2")]), book("b2", [])];
    const rows = encodePlaybooks(books);
    expect([...rows.keys()].sort()).toEqual(["pb:b1", "pb:b2", "play:p1", "play:p2", "playbooks.order"]);
    expect(decodePlaybooks(rows)).toEqual(books);
  });

  it("leaves out rows that are missing", () => {
    const rows = encodePlaybooks([book("b1", [play("p1"), play("p2")])]);
    rows.delete("play:p2");
    expect(decodePlaybooks(rows)[0].plays.map((p) => p.id)).toEqual(["p1"]);
  });
});

describe("diff", () => {
  it("sends only what changed, and deletes what is gone", () => {
    const p1 = play("p1");
    const p2 = play("p2");
    const sent = new Map<string, Sent>();
    for (const [row, value] of encodePlaybooks([book("b1", [p1, p2])])) sent.set(row, { value });
    // Rename p2 and drop nothing: only p2 is sent; the book meta is equal in content.
    const next = encodePlaybooks([book("b1", [p1, { ...p2, name: "Mesh" }])]);
    const { upserts, deletes } = diffRows(next, sent, () => true);
    expect([...upserts.keys()]).toEqual(["play:p2"]);
    expect(deletes).toEqual([]);
    // Removing p1: its row goes, the book meta changes.
    const removed = diffRows(encodePlaybooks([book("b1", [p2])]), sent, (row) => row.startsWith("play:") || row.startsWith("pb:") || row === "playbooks.order");
    expect(removed.deletes).toEqual(["play:p1"]);
    expect([...removed.upserts.keys()].sort()).toEqual(["pb:b1"]);
  });
});

describe("player roster", () => {
  it("puts the player's own full record in place of the public card", () => {
    const own = newPlayer({ firstName: "Ali", phone: "+90 555", number: 7 }, "pl1");
    const other = newPlayer({ firstName: "Can" }, "pl2");
    const publicRoster: Roster = { players: [{ ...own, phone: "" }, other], depth: {} };
    const merged = mergePlayerRoster(publicRoster, own)!;
    expect(merged.players[0].phone).toBe("+90 555");
    expect(merged.players[1]).toBe(other);
    expect(mergePlayerRoster(undefined, own)).toBeUndefined();
  });
});

describe("outbox replay", () => {
  it("keeps changes made on the version the server still has", () => {
    const outbox = {
      calendar: { op: "upsert" as const, value: [], base: 3, seq: 1 },
      roster: { op: "upsert" as const, value: {}, base: 2, seq: 2 },
      "play:new": { op: "upsert" as const, value: {}, base: 0, seq: 3 },
    };
    const server = new Map([
      ["calendar", 3],
      ["roster", 4],
    ]);
    expect(replayPlan(outbox, server)).toEqual({ apply: ["calendar", "play:new"], dropped: ["roster"] });
  });
});
