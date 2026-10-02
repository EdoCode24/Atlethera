import { describe, expect, it } from "vitest";
import { newPlay, newPlaybook } from "@/domain/playbook/factory";
import type { Playbook, PlaySide } from "@/domain/playbook/types";
import type { SportId } from "@/domain/sports/types";
import { categoryKey, copyBlock, playCopyFor } from "./playbooks";

const TR: Record<PlaySide, string[]> = { offense: ["Koşu", "Pas"], defense: ["Base", "Red zone"], special: ["Kickoff", "Kickoff dönüşü", "Punt", "Punt dönüşü", "Field goal / PAT", "Field goal blok"] };
const EN: Record<PlaySide, string[]> = { offense: ["Run", "Pass"], defense: ["Base", "Red zone"], special: ["Kickoff", "Kickoff return", "Punt", "Punt return", "Field goal / PAT", "Field goal block"] };

const book = (name: string, playersPerSide: number, fieldWidth: number, categoryNames = TR, sport: SportId = "flag-football"): Playbook =>
  newPlaybook({ workspaceId: "ws", name, sport, playersPerSide, fieldWidth, fieldLines: "five", categoryNames });

const cat = (b: Playbook, side: PlaySide, name: string) => (b.categories[side] ?? []).find((c) => c.name === name)!.id;

describe("copy to another playbook", () => {
  it("only takes playbooks of the same sport and team size", () => {
    const seven = book("2026", 7, 30);
    expect(copyBlock(seven, book("Summer", 5, 25))).toBe("players");
    expect(copyBlock(seven, book("AF", 11, 53.33, TR, "american-football"))).toBe("sport");
    expect(copyBlock(seven, book("IFAF", 7, 25))).toBeNull();
    const play = newPlay(seven, { side: "offense", name: "Trips", categoryIds: [], notes: "", author: "a" });
    expect(playCopyFor(seven, play, book("Summer", 5, 25))).toBeNull();
  });

  it("fits x to a narrower field: players, ghosts and route corners, depth untouched", () => {
    const from = book("2026", 7, 30);
    const to = book("IFAF", 7, 25);
    const play = newPlay(from, { side: "offense", name: "Trips", categoryIds: [], notes: "", author: "a" });
    const y = play.players.find((p) => p.label === "Y")!;
    play.players = play.players.map((p) => (p.id === y.id ? { ...p, route: { points: [{ x: 27, y: 6 }, { x: 30, y: 12 }], line: "solid", end: "arrow", corners: "sharp" }, zone: { radius: 4 } } : p));
    play.positionNotes = { [y.id]: "Go deep" };

    const copy = playCopyFor(from, play, to)!;
    expect(copy.players).toHaveLength(7);
    expect(copy.players.find((p) => p.label === "C")!.x).toBe(12.5);
    for (const p of [...copy.players, ...copy.opponent]) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(25);
      for (const pt of p.route?.points ?? []) expect(pt.x).toBeLessThanOrEqual(25);
    }
    const y2 = copy.players.find((p) => p.label === "Y")!;
    expect(y2.route!.points).toEqual([{ x: 22.5, y: 6 }, { x: 25, y: 12 }]);
    expect(y2.y).toBe(y.y);
    expect(y2.zone).toEqual({ radius: 4 });
    expect(copy.opponent.map((p) => p.x)).toEqual(play.opponent.map((p) => Math.round(((p.x * 25) / 30) * 100) / 100));
    // Fresh ids; the notes follow their player.
    expect(y2.id).not.toBe(y.id);
    expect(copy.positionNotes).toEqual({ [y2.id]: "Go deep" });
    // The source is untouched.
    expect(play.players.find((p) => p.label === "C")!.x).toBe(15);
  });

  it("keeps x as it is on a field of the same width", () => {
    const from = book("A", 5, 25);
    const play = newPlay(from, { side: "defense", name: "Cover 2", categoryIds: [], notes: "", author: "a" });
    const copy = playCopyFor(from, play, book("B", 5, 25))!;
    expect(copy.players.map((p) => p.x)).toEqual(play.players.map((p) => p.x));
  });

  it("matches categories by name in either language", () => {
    const en = book("Varsity", 11, 53.33, EN, "american-football");
    const tr = book("Varsity TR", 11, 53.33, TR, "american-football");
    const pass = newPlay(en, { side: "offense", name: "Spider 2 Y Banana", categoryIds: [cat(en, "offense", "Pass")], notes: "", author: "a" });
    expect(playCopyFor(en, pass, tr)!.categoryIds).toEqual([cat(tr, "offense", "Pas")]);
    const run = newPlay(tr, { side: "offense", name: "Power", categoryIds: [cat(tr, "offense", "Koşu")], notes: "", author: "a" });
    expect(playCopyFor(tr, run, en)!.categoryIds).toEqual([cat(en, "offense", "Run")]);
    const redZone = newPlay(tr, { side: "defense", name: "Goal line", categoryIds: [cat(tr, "defense", "Red zone")], notes: "", author: "a" });
    expect(playCopyFor(tr, redZone, en)!.categoryIds).toEqual([cat(en, "defense", "Red zone")]);
    const punt = newPlay(en, { side: "special", unit: "puntReturn", name: "Wall left", categoryIds: [cat(en, "special", "Punt return")], notes: "", author: "a" });
    expect(playCopyFor(en, punt, tr)!.categoryIds).toEqual([cat(tr, "special", "Punt dönüşü")]);
    // A coach's own category still matches by name, whatever the case.
    en.categories.offense.push({ id: "c-screen", name: "Screen" });
    tr.categories.offense.push({ id: "c-screen-tr", name: "SCREEN" });
    const screen = newPlay(en, { side: "offense", name: "Bubble", categoryIds: ["c-screen"], notes: "", author: "a" });
    expect(playCopyFor(en, screen, tr)!.categoryIds).toEqual(["c-screen-tr"]);
  });

  it("compares category names without case in both languages", () => {
    expect(categoryKey(" PAS ")).toBe(categoryKey("pas"));
    expect(categoryKey("İleri")).toBe(categoryKey("ileri"));
    expect(categoryKey("INSIDE")).toBe(categoryKey("inside"));
    expect(categoryKey("Pas")).not.toBe(categoryKey("Pass"));
  });
});
