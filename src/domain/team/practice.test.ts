import { describe, expect, it } from "vitest";
import { addMinutes, attendanceCounts, clampMinutes, copyPeriods, durationMinutes, move, periodClock, playerAttendance, presetsFor, totalMinutes, unitsFor, type Attendance, type Period } from "./practice";

const period = (id: string, minutes: number): Period => ({ id, name: id, minutes, unit: "team", drill: "", plays: [{ playbookId: "b", playId: "p" }] });

describe("practice clock", () => {
  it("adds up the periods from the start time", () => {
    const periods = [period("a", 10), period("b", 25), period("c", 15)];
    expect(totalMinutes(periods)).toBe(50);
    expect(periodClock("19:00", periods)).toEqual([
      { start: "19:00", end: "19:10" },
      { start: "19:10", end: "19:35" },
      { start: "19:35", end: "19:50" },
    ]);
    expect(periodClock(null, periods)).toBeNull();
  });

  it("wraps past midnight and measures the practice", () => {
    expect(addMinutes("23:50", 20)).toBe("00:10");
    expect(durationMinutes("19:00", "21:00")).toBe(120);
    expect(durationMinutes("19:00", null)).toBeNull();
    expect(durationMinutes("21:00", "19:00")).toBeNull();
  });

  it("keeps a period's length sensible", () => {
    expect(clampMinutes(0)).toBe(1);
    expect(clampMinutes(7.6)).toBe(8);
    expect(clampMinutes(500)).toBe(240);
  });
});

describe("periods", () => {
  it("offers units and blocks the sport has", () => {
    expect(unitsFor("flag-football")).not.toContain("special");
    expect(presetsFor("flag-football").map((p) => p.preset)).not.toContain("special");
    expect(presetsFor("american-football").map((p) => p.preset)).toContain("special");
  });

  it("copies with new ids and separate play lists", () => {
    let n = 0;
    const source = [period("a", 10)];
    const [copy] = copyPeriods(source, () => `new${++n}`);
    expect(copy).toMatchObject({ id: "new1", name: "a", minutes: 10 });
    copy.plays.push({ playbookId: "x", playId: "y" });
    expect(source[0].plays).toHaveLength(1);
  });

  it("moves one place and stays put at the ends", () => {
    expect(move(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    const list = ["a", "b"];
    expect(move(list, 0, -1)).toBe(list);
  });
});

describe("attendance", () => {
  it("counts the roster's marks", () => {
    expect(attendanceCounts({ attendance: { a: "present", b: "late", c: "absent", gone: "present" } }, ["a", "b", "c", "d"])).toEqual({ present: 1, late: 1, absent: 1, excused: 0, unmarked: 1 });
  });

  it("rates a player over the practices where it was taken", () => {
    const marks: (Attendance | null)[] = ["present", "late", "absent", "excused", null];
    const plans = marks.map((m): { attendance: Record<string, Attendance> } => ({ attendance: m ? { a: m } : {} }));
    expect(playerAttendance(plans, "a")).toEqual({ taken: 3, attended: 2, excused: 1, rate: 2 / 3 });
    expect(playerAttendance(plans, "z").rate).toBeNull();
  });
});
