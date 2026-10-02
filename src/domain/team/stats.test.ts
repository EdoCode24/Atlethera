import { describe, expect, it } from "vitest";
import { sports } from "@/domain/sports";
import { newPlayer } from "./roster";
import { allowsNegative, combineLines, formatStat, hasGroup, isEntered, leadStat, passerRating, playerStatGroups, result, seasonRecord, statValue } from "./stats";

describe("results", () => {
  it("reads a final score", () => {
    expect(result({ us: 21, them: 14 })).toBe("win");
    expect(result({ us: 7, them: 7 })).toBe("tie");
    expect(result({ us: null, them: 3 })).toBeNull();
  });

  it("adds up the season", () => {
    expect(seasonRecord([{ us: 21, them: 14 }, { us: 3, them: 10 }, { us: 7, them: 7 }, { us: null, them: null }])).toEqual({ win: 1, loss: 1, tie: 1, pointsFor: 31, pointsAgainst: 31, played: 3 });
  });
});

describe("stats", () => {
  it("works out rates from counts", () => {
    const line = { "passing.cmp": 20, "passing.att": 30, "passing.yds": 250, "passing.td": 2, "passing.int": 1, "rushing.car": 8, "rushing.yds": 36 };
    expect(statValue(line, "passing", "cmpPct")).toBeCloseTo(66.67, 1);
    expect(statValue(line, "rushing", "ypc")).toBe(4.5);
    expect(statValue(line, "receiving", "ypr")).toBeNull();
    expect(statValue(line, "passing", "yds")).toBe(250);
    expect(isEntered("passing", "cmpPct")).toBe(false);
    expect(isEntered("passing", "cmp")).toBe(true);
  });

  it("rates passers the NFL way", () => {
    // A perfect game tops out at 158.3.
    expect(passerRating(20, 20, 400, 5, 0)).toBeCloseTo(158.3, 1);
    expect(passerRating(0, 10, 0, 0, 3)).toBe(0);
    expect(passerRating(20, 30, 250, 2, 1)).toBeCloseTo(100.7, 1);
    expect(passerRating(0, 0, 0, 0, 0)).toBeNull();
  });

  it("combines games: counts add, bests keep the top, averages are weighed", () => {
    const season = combineLines([
      { "receiving.rec": 5, "receiving.yds": 60, "kicking.lng": 42, "punting.punts": 2, "punting.avg": 40 },
      { "receiving.rec": 3, "receiving.yds": 30, "kicking.lng": 38, "punting.punts": 6, "punting.avg": 44 },
    ]);
    expect(season["receiving.rec"]).toBe(8);
    expect(season["receiving.yds"]).toBe(90);
    expect(season["kicking.lng"]).toBe(42);
    expect(season["punting.avg"]).toBe(43);
    expect(statValue(season, "receiving", "ypr")).toBe(11.25);
  });

  it("knows which groups a player keeps", () => {
    const te = newPlayer({ firstName: "a", positions: ["TE", "WR"] }, "a");
    expect(playerStatGroups(te, "american-football")).toEqual(["receiving", "blocking"]);
    expect(hasGroup({ "receiving.rec": 1 }, "receiving")).toBe(true);
    expect(hasGroup({ "receiving.rec": 1 }, "rushing")).toBe(false);
  });

  it("leads with yards where there are yards", () => {
    const [passing] = sports["american-football"].statGroups;
    expect(leadStat(passing)).toBe("yds");
    const defense = sports["american-football"].statGroups.find((g) => g.id === "defense")!;
    expect(leadStat(defense)).toBe("tkl");
    expect(allowsNegative("yds")).toBe(true);
    expect(allowsNegative("tkl")).toBe(false);
  });

  it("formats for the locale", () => {
    expect(formatStat(66.666, 1, "tr-TR")).toBe("66,7");
    expect(formatStat(1250, 0, "en-US")).toBe("1,250");
    expect(formatStat(null, 0, "en-US")).toBe("–");
  });
});
