import { describe, expect, it } from "vitest";
import { combineTests } from "@/domain/sports/combine";
import { averageRating, defaultCriteria, history, personalBest, sportTests, teamBest, trend, validResult, type Evaluation, type TestSession } from "./evaluation";

const criteria = defaultCriteria(["Teknik", "Taktik", "Fiziksel"]);
const evaluation = (id: string, date: string, ratings: Record<string, number>): Evaluation => ({
  id,
  playerId: "p",
  date,
  ratings,
  strengths: "",
  improve: "",
  notes: "",
  createdAt: `${date}T10:00:00Z`,
  updatedAt: `${date}T10:00:00Z`,
});

describe("ratings", () => {
  it("averages the rated criteria still in use", () => {
    expect(criteria.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
    expect(averageRating({ c1: 4, c2: 3 }, criteria)).toBe(3.5);
    expect(averageRating({ gone: 5, c1: 2 }, criteria)).toBe(2);
    expect(averageRating({}, criteria)).toBeNull();
  });

  it("lists newest first and reads the trend", () => {
    const list = [evaluation("a", "2026-08-01", { c1: 2, c2: 2 }), evaluation("b", "2026-09-01", { c1: 4, c2: 3 }), { ...evaluation("x", "2026-09-10", { c1: 5 }), playerId: "other" }];
    expect(history(list, "p").map((e) => e.id)).toEqual(["b", "a"]);
    expect(trend(list, "p", criteria)).toBe(1.5);
    expect(trend(list, "other", criteria)).toBeNull();
  });
});

describe("tests", () => {
  const forty = combineTests.forty;
  const vertical = combineTests.vertical;
  const sessions: TestSession[] = [
    { id: "s1", date: "2026-08-01", title: "", results: { a: { forty: 4.9, vertical: 70 }, b: { forty: 4.7 } }, createdAt: "" },
    { id: "s2", date: "2026-09-01", title: "", results: { a: { forty: 4.8, vertical: 68 } }, createdAt: "" },
  ];

  it("keeps the sport's tests", () => {
    expect(sportTests("flag-football").map((t) => t.id)).not.toContain("bench225");
    expect(sportTests("american-football").map((t) => t.id)).toContain("bench225");
  });

  it("finds personal and team bests in the right direction", () => {
    expect(personalBest(sessions, "a", forty)).toEqual({ value: 4.8, date: "2026-09-01" });
    expect(personalBest(sessions, "a", vertical)).toEqual({ value: 70, date: "2026-08-01" });
    expect(personalBest(sessions, "c", forty)).toBeNull();
    expect(teamBest(sessions, ["a", "b"], forty)).toBe(4.7);
    expect(teamBest(sessions, ["a", "b"], vertical)).toBe(70);
  });

  it("catches readings no test gives", () => {
    expect(validResult(forty, 4.62)).toBe(true);
    expect(validResult(forty, 462)).toBe(false);
    expect(validResult(combineTests.bench225, 12.5)).toBe(false);
  });
});
