import { describe, expect, it } from "vitest";
import { combineTests, sports, sportOrder } from "./index";

describe.each(sportOrder)("%s module", (id) => {
  const sport = sports[id];

  it("has unique position group ids", () => {
    const ids = sport.positionGroups.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("points every position group at stat groups that exist", () => {
    const statIds = new Set(sport.statGroups.map((g) => g.id));
    for (const group of sport.positionGroups) {
      for (const statId of group.statGroups) expect(statIds).toContain(statId);
    }
  });

  it("uses combine tests that exist, and KPIs are a subset of them", () => {
    for (const test of sport.combine) expect(combineTests).toHaveProperty(test);
    for (const kpi of sport.kpis) expect(sport.combine).toContain(kpi);
  });

  it("lines up exactly one full side of players per team", () => {
    const { players } = sport.formation;
    const offense = players.filter((p) => p.side === "offense");
    const defense = players.filter((p) => p.side === "defense");
    expect(offense).toHaveLength(sport.playersPerSide);
    expect(defense).toHaveLength(sport.playersPerSide);
    expect(new Set(players.map((p) => p.id)).size).toBe(players.length);
  });

  it("keeps every player on the field, offense behind and defense beyond the line", () => {
    const { lengthYd, widthYd } = sport.field;
    const { losX, players } = sport.formation;
    const groups = new Set(sport.positionGroups.map((g) => g.id));
    for (const p of players) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(lengthYd);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(widthYd);
      expect(groups).toContain(p.group);
      if (p.side === "offense") expect(p.x).toBeLessThan(losX);
      else expect(p.x).toBeGreaterThan(losX);
    }
  });
});

describe("field specs", () => {
  it("American football: 120 × 53⅓ yd with NFL hashes", () => {
    const { field } = sports["american-football"];
    expect(field.lengthYd).toBe(120);
    expect(field.widthYd).toBeCloseTo(53.33, 2);
    expect(field.widthYd - 2 * field.hashFromSidelineYd!).toBeCloseTo(6.17, 2);
  });

  it("Flag football: IFAF 70 × 25 yd, no-run zones inside the field of play", () => {
    const { field, formation } = sports["flag-football"];
    expect(field.lengthYd).toBe(70);
    expect(field.widthYd).toBe(25);
    for (const [start, end] of field.noRunZones!) {
      expect(end - start).toBe(5);
      expect(start).toBeGreaterThanOrEqual(field.endZoneYd);
      expect(end).toBeLessThanOrEqual(field.lengthYd - field.endZoneYd);
    }
    const rusher = formation.players.find((p) => p.group === "rsh")!;
    expect(rusher.x - formation.losX).toBeGreaterThanOrEqual(field.rushLineYd!);
  });
});
