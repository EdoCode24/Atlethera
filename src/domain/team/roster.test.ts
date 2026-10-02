import { describe, expect, it } from "vitest";
import { age, allPositions, duplicateNumbers, groupOf, moveInDepth, newPlayer, parseBulk, placeInDepth, sortPlayers, syncDepth, validatePlayer } from "./roster";

const player = (id: string, over: Partial<Parameters<typeof newPlayer>[0]> = {}) => newPlayer({ firstName: "Ali", lastName: id, ...over }, id, new Date("2026-01-01T00:00:00Z"));

describe("positions", () => {
  it("lists every position of the sport in field order", () => {
    expect(allPositions("flag-football")).toEqual(["QB", "C", "WR", "RB", "Rusher", "LB", "CB", "S"]);
    expect(allPositions("american-football")).toContain("MLB");
    expect(groupOf("american-football", "OT")?.id).toBe("ol");
    expect(groupOf("american-football", "K")?.side).toBe("special");
  });
});

describe("players", () => {
  it("validates names, numbers and measurements", () => {
    const base = { firstName: "Ali", lastName: "Veli", number: 12, heightCm: 180, weightKg: 80, birthDate: "2004-05-01" };
    expect(validatePlayer(base)).toEqual([]);
    expect(validatePlayer({ ...base, firstName: " ", lastName: "" })).toContain("nameRequired");
    expect(validatePlayer({ ...base, number: 100 })).toContain("numberRange");
    expect(validatePlayer({ ...base, number: 7.5 })).toContain("numberRange");
    expect(validatePlayer({ ...base, heightCm: 90 })).toContain("heightRange");
    expect(validatePlayer({ ...base, weightKg: 400 })).toContain("weightRange");
    expect(validatePlayer({ ...base, heightCm: Number.NaN, weightKg: Number.NaN })).toEqual(["heightRange", "weightRange"]);
    expect(validatePlayer({ ...base, birthDate: "01.05.2004" })).toContain("birthDate");
  });

  it("keeps an injury only for injured players", () => {
    expect(player("a", { status: "injured" }).injury).toEqual({ note: "", returnDate: null });
    expect(player("b", { status: "active", injury: { note: "x", returnDate: null } }).injury).toBeNull();
  });

  it("finds numbers worn twice", () => {
    expect([...duplicateNumbers([player("a", { number: 7 }), player("b", { number: 7 }), player("c", { number: 8 })])]).toEqual([7]);
  });

  it("works out age from the birth date", () => {
    expect(age("2004-05-01", new Date("2026-04-30T12:00:00"))).toBe(21);
    expect(age("2004-05-01", new Date("2026-05-01T12:00:00"))).toBe(22);
    expect(age(null)).toBeNull();
  });

  it("sorts by number, name or position", () => {
    const list = [player("Zeki", { number: 3, positions: ["WR"] }), player("Ayaz", { number: 12, positions: ["QB"] }), player("Mert", { number: null, positions: ["C"] })];
    expect(sortPlayers(list, "flag-football", "number").map((p) => p.lastName)).toEqual(["Zeki", "Ayaz", "Mert"]);
    expect(sortPlayers(list, "flag-football", "name").map((p) => p.lastName)).toEqual(["Ayaz", "Mert", "Zeki"]);
    expect(sortPlayers(list, "flag-football", "position").map((p) => p.lastName)).toEqual(["Ayaz", "Mert", "Zeki"]);
    const oneName = player("x", { firstName: "Pele", lastName: "" });
    expect(sortPlayers([...list, oneName], "flag-football", "name").map((p) => p.lastName || p.firstName)).toEqual(["Ayaz", "Mert", "Pele", "Zeki"]);
  });
});

describe("bulk paste", () => {
  it("reads number, name and positions in any order", () => {
    const lines = parseBulk("12 Ahmet Yılmaz QB\nMehmet Kaya, 7, WR/CB\n\nCan Demir 88 TE XY\ncem akın rb", "american-football");
    expect(lines).toHaveLength(4);
    expect(lines[0].input).toMatchObject({ firstName: "Ahmet", lastName: "Yılmaz", number: 12, positions: ["QB"] });
    expect(lines[1].input).toMatchObject({ firstName: "Mehmet", lastName: "Kaya", number: 7, positions: ["WR", "CB"] });
    expect(lines[2].input).toMatchObject({ firstName: "Can", lastName: "Demir", number: 88, positions: ["TE"] });
    expect(lines[2].unknown).toEqual(["XY"]);
    expect(lines[3].input).toMatchObject({ firstName: "Cem", lastName: "Akın", positions: ["RB"] });
  });

  it("keeps positions to the sport and all-caps names as names", () => {
    const [flag] = parseBulk("5 ALI CAN RUSHER", "flag-football");
    expect(flag.input).toMatchObject({ firstName: "ALI", lastName: "CAN", number: 5, positions: ["Rusher"] });
    expect(flag.unknown).toEqual([]);
  });

  it("reads line spots and one-position group abbreviations", () => {
    const [lt, rg] = parseBulk("71 Emre Koç LT\n64 Ozan Er RG", "american-football");
    expect(lt.input?.positions).toEqual(["OT"]);
    expect(rg.input?.positions).toEqual(["OG"]);
    const [rsh] = parseBulk("9 Deniz Aydın RSH", "flag-football");
    expect(rsh.input?.positions).toEqual(["Rusher"]);
    expect(rsh.unknown).toEqual([]);
  });
});

describe("depth chart", () => {
  it("lists every player under his positions, new ones last, and drops the rest", () => {
    const a = player("a", { positions: ["QB"] });
    const b = player("b", { positions: ["QB", "WR"] });
    const depth = syncDepth({ QB: ["b"], WR: ["gone"] }, [a, b]);
    expect(depth).toEqual({ QB: ["b", "a"], WR: ["b"] });
    expect(syncDepth(depth, [a])).toEqual({ QB: ["a"] });
  });

  it("moves and places players in a position's order", () => {
    const depth = { QB: ["a", "b", "c"] };
    expect(moveInDepth(depth, "QB", "b", -1).QB).toEqual(["b", "a", "c"]);
    expect(moveInDepth(depth, "QB", "a", -1)).toBe(depth);
    expect(placeInDepth(depth, "QB", "c", 0).QB).toEqual(["c", "a", "b"]);
  });
});
