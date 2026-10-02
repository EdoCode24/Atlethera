import { describe, expect, it } from "vitest";
import { addDays, addMonths, byDay, isIsoDay, monthGrid, newEvent, upcoming, validateEvent, weeklyDates, type EventInput } from "./calendar";

const input = (over: Partial<EventInput> = {}): EventInput => ({
  kind: "practice",
  title: "Antrenman",
  date: "2026-09-29",
  start: "19:00",
  end: "21:00",
  location: "",
  notes: "",
  opponent: "",
  venue: null,
  ...over,
});
const at = new Date("2026-09-01T00:00:00Z");

describe("calendar days", () => {
  it("reads only real days", () => {
    expect(isIsoDay("2026-02-28")).toBe(true);
    expect(isIsoDay("2026-02-30")).toBe(false);
    expect(isIsoDay("26-2-3")).toBe(false);
  });

  it("steps over month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-01");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-01");
  });

  it("lays out whole weeks from Monday or Sunday", () => {
    // September 2026 starts on a Tuesday and ends on a Wednesday.
    const monday = monthGrid("2026-09-10", 1);
    expect(monday[0][0]).toBe("2026-08-31");
    expect(monday.at(-1)!.at(-1)).toBe("2026-10-04");
    expect(monday).toHaveLength(5);
    const sunday = monthGrid("2026-09-10", 0);
    expect(sunday[0][0]).toBe("2026-08-30");
    expect(sunday.every((w) => w.length === 7)).toBe(true);
    // February 2027 starts on a Monday: four whole weeks.
    expect(monthGrid("2027-02-01", 1)).toHaveLength(4);
  });
});

describe("events", () => {
  it("checks the fields a coach fills in", () => {
    expect(validateEvent(input())).toEqual([]);
    expect(validateEvent(input({ title: " " }))).toContain("titleRequired");
    expect(validateEvent(input({ date: "2026-13-01" }))).toContain("dateInvalid");
    expect(validateEvent(input({ start: "25:00" }))).toContain("timeInvalid");
    expect(validateEvent(input({ start: null, end: "10:00" }))).toContain("timeInvalid");
    expect(validateEvent(input({ end: "18:30" }))).toEqual(["endBeforeStart"]);
    expect(validateEvent(input({ start: null, end: null }))).toEqual([]);
  });

  it("repeats weekly up to a limit", () => {
    expect(weeklyDates("2026-09-29", "2026-10-20")).toEqual(["2026-09-29", "2026-10-06", "2026-10-13", "2026-10-20"]);
    expect(validateEvent(input(), "2026-09-01")).toContain("untilInvalid");
    expect(validateEvent(input(), "2028-01-01")).toContain("tooMany");
    expect(validateEvent(input(), "2027-06-01")).toEqual([]);
  });

  it("keeps game details for games only", () => {
    const game = newEvent(input({ kind: "game", title: "Maç", opponent: " Ankara ", venue: null }), "g", null, at);
    expect(game).toMatchObject({ opponent: "Ankara", venue: "home" });
    const practice = newEvent(input({ opponent: "Ankara", venue: "away" }), "p", null, at);
    expect(practice).toMatchObject({ opponent: "", venue: null });
  });

  it("orders a day's events and finds what's next", () => {
    const events = [
      newEvent(input({ date: "2026-10-02", start: "19:00" }), "c", null, at),
      newEvent(input({ date: "2026-10-01", start: "20:00" }), "b", null, at),
      newEvent(input({ date: "2026-10-01", start: null, end: null, title: "Gün boyu" }), "a", null, at),
      newEvent(input({ date: "2026-09-01" }), "old", null, at),
    ];
    expect([...byDay(events).get("2026-10-01")!].map((e) => e.id)).toEqual(["a", "b"]);
    expect(upcoming(events, "2026-10-01", 2).map((e) => e.id)).toEqual(["a", "b"]);
  });
});
