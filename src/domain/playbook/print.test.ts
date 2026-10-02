import { describe, expect, it } from "vitest";
import { newPlay, newPlaybook } from "./factory";
import {
  CATEGORY_COLORS,
  cardGrid,
  categoryColor,
  chunk,
  CONTENT_PAD,
  contentFrame,
  defaultPaper,
  defaultSettings,
  diagramBox,
  diagramLayout,
  diagramSpots,
  FORMAT_SETTINGS,
  FORMAT_STYLES,
  filterCount,
  findStyle,
  fitFrame,
  flowList,
  groupPlays,
  INK,
  innerSize,
  labelBarHeight,
  labelLayout,
  longestName,
  MIN_DIAGRAM_ASPECT,
  MIN_LABEL_IN,
  MIN_TOKEN_IN,
  PAPER,
  pageCount,
  planCards,
  PLAYBOOK_MIN_ASPECT,
  playsPerPage,
  PRINT_FORMATS,
  primaryCategory,
  ROUTE_HEADROOM,
  sanitizeSettings,
  selectPlays,
  SETTING_OPTIONS,
  sheetListRows,
  sidePlays,
  tightestSpacing,
  tokenScale,
  wristbandListRows,
  type DiagramInput,
  type ListGroup,
} from "./print";
import type { Playbook, PlaySide, Vec } from "./types";

function book(): Playbook {
  const b = newPlaybook({
    workspaceId: "w",
    name: "Test",
    sport: "american-football",
    playersPerSide: 11,
    fieldWidth: 160 / 3,
    fieldLines: "five",
    categoryNames: { offense: ["Run", "Pass"], defense: ["Base"], special: ["Kickoff", "Punt"] },
  });
  const [run, pass] = b.categories.offense;
  const add = (side: PlaySide, name: string, categoryIds: string[]) => b.plays.push(newPlay(b, { side, name, categoryIds, notes: "", author: "t" }));
  add("offense", "Dive", [run.id]);
  add("defense", "Cover 2", []);
  add("offense", "Mesh", [pass.id]);
  add("offense", "Screen", []);
  add("offense", "PA Boot", [pass.id, run.id]);
  add("special", "Kick deep", [b.categories.special![0].id]);
  return b;
}

describe("print: formats and settings", () => {
  it("lists the styles of the reference app, with the right defaults", () => {
    expect(FORMAT_STYLES.wristband).toHaveLength(11);
    expect(FORMAT_STYLES.wristbandList).toHaveLength(3);
    expect(FORMAT_STYLES.callSheet).toHaveLength(14);
    expect(FORMAT_STYLES.callSheetList).toHaveLength(4);
    expect(FORMAT_STYLES.playbook).toHaveLength(8);
    expect(FORMAT_STYLES.scout).toHaveLength(3);
    expect(FORMAT_STYLES.routeTree).toHaveLength(1);
    expect(defaultSettings("wristband", "a4").style).toBe("8");
    expect(defaultSettings("callSheet", "a4").style).toBe("4x6");
    expect(defaultSettings("callSheet", "a4").iconSize).toBe("small");
    expect(defaultSettings("wristband", "a4").iconSize).toBe("medium");
  });

  it("parses call sheet grids as columns × rows and counts plays per page", () => {
    const counts = FORMAT_STYLES.callSheet.map((s) => playsPerPage(s));
    expect(counts).toEqual([24, 24, 18, 18, 16, 15, 15, 12, 12, 10, 10, 9, 8, 8]);
    expect(findStyle("callSheet", "6x4")).toMatchObject({ cols: 6, rows: 4 });
    expect(FORMAT_STYLES.wristband.map((s) => playsPerPage(s))).toEqual([8, 6, 4, 4, 3, 2, 1, 15, 12, 10, 9]);
    expect(findStyle("wristband", "4").strip).toBe(true);
    expect(findStyle("wristband", "nope").id).toBe("8");
  });

  it("offers every setting a format shows, and a paper size everywhere", () => {
    for (const f of PRINT_FORMATS) {
      expect(FORMAT_SETTINGS[f]).toContain("paper");
      const d = defaultSettings(f, "letter");
      for (const key of FORMAT_SETTINGS[f]) expect(SETTING_OPTIONS[key] as readonly unknown[]).toContain(d[key]);
    }
    expect(SETTING_OPTIONS.width).toHaveLength(9);
    expect(SETTING_OPTIONS.copies).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(FORMAT_SETTINGS.callSheet).not.toContain("width");
    expect(FORMAT_SETTINGS.wristbandList).not.toContain("zoom");
  });

  it("defaults to A4 in Turkish and Letter in English", () => {
    expect(defaultPaper("tr")).toBe("a4");
    expect(defaultPaper("en")).toBe("letter");
  });

  it("keeps valid stored settings and drops anything else", () => {
    const s = sanitizeSettings("wristband", { style: "12", width: 4.5, zoom: 80, copies: 3, labels: "nope", paper: "letter", extra: 1 }, "a4");
    expect(s.style).toBe("12");
    expect(s.width).toBe(4.5);
    expect(s.zoom).toBe(100);
    expect(s.copies).toBe(3);
    expect(s.labels).toBe("both");
    expect(s.paper).toBe("letter");
    expect(sanitizeSettings("scout", null, "a4")).toEqual(defaultSettings("scout", "a4"));
    expect(sanitizeSettings("scout", { style: "8" }, "a4").style).toBe("1");
  });
});

describe("print: play selection", () => {
  it("numbers plays within their side, in playbook order", () => {
    const b = book();
    expect(sidePlays(b, "offense").map((e) => [e.play.name, e.number])).toEqual([
      ["Dive", 1],
      ["Mesh", 2],
      ["Screen", 3],
      ["PA Boot", 4],
    ]);
    expect(sidePlays(b, "defense").map((e) => e.number)).toEqual([1]);
    expect(sidePlays(b, "special").map((e) => e.play.name)).toEqual(["Kick deep"]);
  });

  it("selects by category, uncategorized or all, keeping play numbers", () => {
    const b = book();
    const [run, pass] = b.categories.offense;
    expect(selectPlays(b, "offense", pass.id).map((e) => e.number)).toEqual([2, 4]);
    expect(selectPlays(b, "offense", run.id).map((e) => e.number)).toEqual([1, 4]);
    expect(selectPlays(b, "offense", "none").map((e) => e.number)).toEqual([3]);
    expect(filterCount(b, "offense", "all")).toBe(4);
    expect(filterCount(b, "defense", b.categories.defense[0].id)).toBe(0);
  });

  it("files a play under the printed category, else its first category in side order", () => {
    const b = book();
    const [run, pass] = b.categories.offense;
    const boot = b.plays.find((p) => p.name === "PA Boot")!;
    expect(primaryCategory(boot, b.categories.offense, "all")).toBe(run.id);
    expect(primaryCategory(boot, b.categories.offense, pass.id)).toBe(pass.id);
    expect(primaryCategory(b.plays.find((p) => p.name === "Screen")!, b.categories.offense, "all")).toBeNull();
  });

  it("colours labels by category, or in ink when off or uncategorized", () => {
    const cats = book().categories.offense;
    expect(categoryColor(cats[1].id, cats, "auto")).toEqual(CATEGORY_COLORS[1]);
    expect(categoryColor(cats[1].id, cats, "off")).toEqual(INK);
    expect(categoryColor(null, cats, "auto")).toEqual(INK);
  });

  it("groups the call sheet list by category, a play in each of its categories, uncategorized last", () => {
    const b = book();
    const [run, pass] = b.categories.offense;
    const groups = groupPlays(selectPlays(b, "offense", "all"), b.categories.offense, "all");
    expect(groups.map((g) => [g.id, g.items.map((e) => e.number)])).toEqual([
      [run.id, [1, 4]],
      [pass.id, [2, 4]],
      [null, [3]],
    ]);
    // Each group matches the sidebar count for its category.
    expect(groups[1].items).toHaveLength(filterCount(b, "offense", pass.id));
    expect(groupPlays(selectPlays(b, "offense", pass.id), b.categories.offense, pass.id)).toEqual([{ id: pass.id, items: selectPlays(b, "offense", pass.id) }]);
    expect(groupPlays([], b.categories.offense, "all")).toEqual([]);
  });
});

describe("print: pages", () => {
  it("chunks plays into pages in order", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 4)).toEqual([]);
  });

  it("uses true paper sizes in inches", () => {
    expect(PAPER.letter).toEqual({ w: 8.5, h: 11 });
    expect(PAPER.a4.w).toBeCloseTo(8.268, 3);
    expect(PAPER.a4.h).toBeCloseTo(11.693, 3);
    expect(innerSize("letter")).toEqual({ w: 7.7, h: 10.2 });
  });

  it("tiles wristband cards on a sheet without rotating them", () => {
    expect(cardGrid("letter", { w: 3, h: 2 })).toEqual({ cols: 2, rows: 5 });
    expect(cardGrid("a4", { w: 3, h: 2 })).toEqual({ cols: 2, rows: 5 });
    expect(cardGrid("letter", { w: 5, h: 3.5 })).toEqual({ cols: 1, rows: 2 });
    expect(cardGrid("a4", { w: 3.5, h: 2.5 })).toEqual({ cols: 2, rows: 4 });
  });

  it("repeats every card by copies, collated, and fills sheets", () => {
    const plays = Array.from({ length: 20 }, (_, i) => i + 1);
    const plan = planCards(plays, 8, 3, { w: 3, h: 2 }, "letter");
    expect(plan.cards).toBe(3);
    // 3 cards × 3 copies = 9 cards; 10 fit on a Letter sheet.
    expect(plan.sheets).toHaveLength(1);
    expect(plan.sheets[0]).toHaveLength(9);
    expect(plan.sheets[0][0]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(plan.sheets[0][2]).toEqual([17, 18, 19, 20]);
    expect(plan.sheets[0][3]).toEqual(plan.sheets[0][0]);
    // 20 cards × 12 copies; three 5 × 3.5 in cards fit down an A4 sheet.
    const big = planCards(plays, 1, 12, { w: 5, h: 3.5 }, "a4");
    expect(big.grid).toEqual({ cols: 1, rows: 3 });
    expect(big.sheets).toHaveLength(80);
  });

  it("fits list rows to the card height", () => {
    expect(wristbandListRows(2)).toBe(9);
    expect(wristbandListRows(3.5)).toBe(17);
    expect(sheetListRows("letter")).toBe(38);
    expect(sheetListRows("a4")).toBe(41);
  });

  it("flows grouped list rows down columns, repeating a header that runs on", () => {
    const groups: ListGroup<number>[] = [
      { id: "a", items: [1, 2, 3] },
      { id: "b", items: [4, 5, 6, 7] },
    ];
    const pages = flowList(groups, 2, 4);
    // a: header + 3 rows fills column 1; b starts column 2 and runs onto a second page.
    expect(pages).toHaveLength(2);
    expect(pages[0][0].map((r) => (r.kind === "header" ? `#${r.group}` : r.item))).toEqual(["#a", 1, 2, 3]);
    expect(pages[0][1].map((r) => (r.kind === "header" ? `#${r.group}` : r.item))).toEqual(["#b", 4, 5, 6]);
    expect(pages[1][0][0]).toEqual({ kind: "header", group: "b", continued: true });
    expect(pages[1][0][1]).toMatchObject({ kind: "item", item: 7 });
  });

  it("never leaves a group header alone at the bottom of a column", () => {
    const pages = flowList(
      [
        { id: "a", items: [1, 2] },
        { id: "b", items: [3] },
      ],
      3,
      4,
    );
    expect(pages[0][0]).toHaveLength(3);
    expect(pages[0][1][0]).toEqual({ kind: "header", group: "b", continued: false });
  });

  it("counts pages for every format", () => {
    const b = book();
    const plays = selectPlays(b, "offense", "all");
    const groups = groupPlays(plays, b.categories.offense, "all");
    const s = (f: Parameters<typeof defaultSettings>[0], extra = {}) => ({ ...defaultSettings(f, "letter"), ...extra });
    expect(pageCount("wristband", s("wristband"), plays, groups)).toBe(1);
    expect(pageCount("callSheet", s("callSheet"), plays, groups)).toBe(1);
    expect(pageCount("playbook", s("playbook"), plays, groups)).toBe(4);
    expect(pageCount("playbook", s("playbook", { style: "2-left-right" }), plays, groups)).toBe(2);
    expect(pageCount("scout", s("scout", { style: "2-top-bottom" }), plays, groups)).toBe(2);
    expect(pageCount("callSheetList", s("callSheetList"), plays, groups)).toBe(1);
    expect(pageCount("routeTree", s("routeTree"), [], [])).toBe(1);
    expect(pageCount("playbook", s("playbook"), [], [])).toBe(0);
  });
});

describe("print: diagrams", () => {
  it("grows a frame to the cell's shape without cropping it, mostly up-field", () => {
    const f = { x: -1, y: -14, w: 30, h: 20 };
    const tall = fitFrame(f, 1);
    expect(tall.w).toBeCloseTo(30);
    expect(tall.h).toBeCloseTo(30);
    // 10 extra yards: 6.5 up-field (top edge from -14 to -20.5), 3.5 behind (bottom from 6 to 9.5).
    expect(tall.y).toBeCloseTo(-20.5);
    expect(tall.y + tall.h).toBeCloseTo(9.5);
    const wide = fitFrame(f, 3);
    expect(wide.h).toBeCloseTo(20);
    expect(wide.w).toBeCloseTo(60);
    expect(wide.y).toBeCloseTo(-14);
    expect(wide.x + wide.w / 2).toBeCloseTo(14);
  });

  it("zooms out evenly but keeps the backfield in when zooming in", () => {
    const f = { x: 0, y: -15, w: 30, h: 20 };
    const out = fitFrame(f, 1.5, 50);
    expect(out.w).toBeCloseTo(60);
    expect(out.h).toBeCloseTo(40);
    expect(out.x + out.w / 2).toBeCloseTo(15);
    // Nothing wide to keep: the frame closes in around its centre.
    const zoomed = fitFrame(f, 1.5, 150, { x0: 10, x1: 20, top: -2 });
    expect(zoomed.w).toBeCloseTo(20);
    // The bottom edge stays where the original frame's was.
    expect(zoomed.y + zoomed.h).toBeCloseTo(5);
  });

  it("never zooms a player or the side of a route out of the frame", () => {
    const f = { x: 0, y: -15, w: 30, h: 20 };
    // Receivers split to x = 2 and x = 27: at 150 % the frame may not shrink past them.
    const keep = { x0: 1, x1: 28.5, top: -4 };
    const zoomed = fitFrame(f, 1.5, 150, keep);
    expect(zoomed.w).toBeCloseTo(27.5);
    expect(zoomed.x).toBeLessThanOrEqual(keep.x0 + 1e-9);
    expect(zoomed.x + zoomed.w).toBeGreaterThanOrEqual(keep.x1 - 1e-9);
    expect(zoomed.y + zoomed.h).toBeCloseTo(5);
    // An off-centre formation (trips right) pulls the frame over rather than cutting it.
    const trips = fitFrame(f, 1.5, 150, { x0: 12, x1: 29.5, top: -4 });
    expect(trips.x).toBeLessThanOrEqual(12);
    expect(trips.x + trips.w).toBeGreaterThanOrEqual(29.5);
    // A deep player (a safety 12 yards off) stays in view too, which holds the height.
    const deep = fitFrame(f, 3, 150, { x0: 10, x1: 20, top: -13 });
    expect(deep.y).toBeLessThanOrEqual(-13 + 1e-9);
  });

  it("closes in on compact formations but keeps wide ones sideline to sideline", () => {
    const W = 160 / 3;
    const depth = { y: -20, h: 30 };
    // Split receivers: the whole field, as on the playbook cards.
    expect(contentFrame(depth, W, [{ x: 3, y: 0 }, { x: 50, y: 0 }])).toEqual({ x: -1.2, y: -20, w: W + 2.4, h: 30 });
    // A field-goal unit around the middle: at least 40 % of the field, centred on it.
    const fg = contentFrame(depth, W, [{ x: 20.3, y: 5.5 }, { x: 33, y: 5.5 }, { x: 25.1, y: -9.4 }]);
    expect(fg.w).toBeCloseTo((W + 2.4) * 0.4);
    expect(fg.x + fg.w / 2).toBeCloseTo(26.65);
    // A punt unit with gunners: its own width plus room.
    const punt = contentFrame(depth, W, [{ x: 13.67, y: -0.5 }, { x: 39.67, y: -0.5 }]);
    expect(punt.w).toBeCloseTo(26 + 2 * CONTENT_PAD);
    // Never past the field's edge.
    const edge = contentFrame(depth, W, [{ x: 1, y: 0 }, { x: 8, y: 0 }]);
    expect(edge.x).toBeCloseTo(-1.2);
    expect(contentFrame(depth, W, [])).toEqual({ x: -1.2, y: -20, w: W + 2.4, h: 30 });
  });

  it("reaches up-field for a route deeper than the usual frame, keeping the backfield", () => {
    const deep = contentFrame({ y: -14, h: 20 }, 30, [{ x: 3, y: 0 }, { x: 27, y: 25 }]);
    expect(deep.y).toBeCloseTo(-(25 + ROUTE_HEADROOM));
    expect(deep.y + deep.h).toBeCloseTo(6);
    // Shallow routes leave the frame as it was.
    expect(contentFrame({ y: -14, h: 20 }, 30, [{ x: 3, y: 0 }, { x: 27, y: 8 }]).y).toBe(-14);
  });

  it("collects spots, route corners and zone edges for framing", () => {
    const p = {
      id: "a",
      label: "M",
      color: "amber" as const,
      shape: "circle" as const,
      x: 10,
      y: -4,
      starred: false,
      route: { points: [{ x: 12, y: -8 }], line: "solid" as const, end: "arrow" as const, corners: "sharp" as const },
      zone: { radius: 4 },
    };
    expect(diagramSpots([p])).toEqual([
      { x: 10, y: -4 },
      { x: 12, y: -8 },
      { x: 8, y: -8 },
      { x: 16, y: -8 },
    ]);
  });

  it("keeps diagrams from growing taller than the play needs", () => {
    const field = { x: -1.2, y: -14, w: 55.7, h: 21 };
    expect(diagramBox({ w: 2, h: 1.5 }, field)).toEqual({ w: 2, h: 1.5 });
    const tall = diagramBox({ w: 1, h: 3 }, field);
    expect(tall.w).toBe(1);
    expect(tall.h).toBeCloseTo(1 / MIN_DIAGRAM_ASPECT);
    // A kickoff is taller than wide: it keeps its own shape.
    const kickoff = { x: -1.2, y: -65, w: 55.7, h: 74 };
    expect(diagramBox({ w: 1, h: 3 }, kickoff).h).toBeCloseTo(74 / 55.7);
  });

  it("sizes label bars within readable limits, by the cell's width as well as its height", () => {
    expect(labelBarHeight(3, 0.5, "prominent")).toBe(0.12);
    expect(labelBarHeight(3, 1, "prominent")).toBeCloseTo(0.16);
    expect(labelBarHeight(3, 4, "prominent")).toBe(0.3);
    expect(labelBarHeight(3, 1, "compact")).toBeLessThan(labelBarHeight(3, 1, "prominent"));
    // A tall, narrow wristband column (0.7 × 1.9 in) no longer gets the 0.3 in bar of a big cell.
    expect(labelBarHeight(0.71, 1.9, "prominent")).toBeCloseTo(0.142);
  });

  it("wraps long names onto a second line only where the cell has height to spare", () => {
    // 4 plays in columns on a 3 × 2 in card: 0.71 × 1.9 in cells.
    const column = { w: 0.71, h: 1.9 };
    const two = labelLayout(column, "prominent", "both", "Kick Deep Middle".length);
    expect(two.lines).toBe(2);
    expect(two.h).toBeCloseTo(labelBarHeight(0.71, 1.9, "prominent") * 1.7);
    expect(two.font).toBeCloseTo(labelBarHeight(0.71, 1.9, "prominent") * 0.6);
    // Short names stay on one line, and so does a number-only label.
    expect(labelLayout(column, "prominent", "both", 3).lines).toBe(1);
    expect(labelLayout(column, "prominent", "number", 40).lines).toBe(1);
    // A wide call sheet cell fits the name on one line.
    expect(labelLayout({ w: 3.7, h: 1.9 }, "prominent", "both", 20).lines).toBe(1);
    // A wide, shallow cell would lose diagram scale to a second line, so it keeps one.
    expect(labelLayout({ w: 2.9, h: 0.9 }, "prominent", "both", 60).lines).toBe(1);
    expect(labelLayout(column, "compact", "name", 30).lines).toBe(2);
    expect(longestName(selectPlays(book(), "offense", "all"))).toBe("PA Boot".length);
  });

  it("lets playbook pages stop the diagram well before the page is full of empty turf", () => {
    const shallow = { x: -1.2, y: -14, w: 55.7, h: 21 };
    // "1 play" on A4: 7.47 × 9.4 in.
    const page = diagramBox({ w: 7.47, h: 9.4 }, shallow, PLAYBOOK_MIN_ASPECT);
    expect(page.w).toBe(7.47);
    expect(page.h).toBeCloseTo(7.47 / PLAYBOOK_MIN_ASPECT);
    // A kickoff, taller than wide, still uses its own shape.
    const kickoff = { x: -1.2, y: -65, w: 55.7, h: 74 };
    expect(diagramBox({ w: 3.6, h: 4.4 }, kickoff, PLAYBOOK_MIN_ASPECT).h).toBeCloseTo(4.4);
  });

  it("scales special-teams players to their spacing, others by icon size only", () => {
    expect(tokenScale("medium", false, 1, 0.84)).toBe(1);
    expect(tokenScale("large", false, 1, 0.84)).toBe(1.25);
    // Kickoff: players about 4 yards apart grow.
    expect(tokenScale("medium", true, 4, 0.84)).toBeCloseTo(2.38, 2);
    // Punt line: a yard apart, they shrink, but not below the floor.
    expect(tokenScale("medium", true, 1.2, 0.84)).toBeCloseTo(0.714, 2);
    expect(tokenScale("medium", true, 0.2, 0.84)).toBe(0.6);
    expect(tightestSpacing([])).toBe(Infinity);
  });
});

describe("print: diagram layout", () => {
  const W = 160 / 3;
  const R = 0.84;
  // The default American-football offense (factory): linemen 1.8 yd apart, X and Z split wide.
  const offense: Vec[] = [
    { x: 23.07, y: -0.8 },
    { x: 24.87, y: -0.8 },
    { x: 26.67, y: -0.8 },
    { x: 28.47, y: -0.8 },
    { x: 30.27, y: -0.8 },
    { x: 32.3, y: -0.8 },
    { x: 6.5, y: -0.8 },
    { x: 17, y: -1.8 },
    { x: 46.8, y: -1.8 },
    { x: 26.67, y: -4.5 },
    { x: 29.1, y: -4.5 },
  ];
  // X and Z run verticals to 20 yards.
  const routes: Vec[] = [
    { x: 6.5, y: 20 },
    { x: 46.8, y: 20 },
  ];
  const input = (box: { w: number; h: number }, extra: Partial<DiagramInput> = {}): DiagramInput => ({
    depth: { y: -14, h: 14 + 6.3 },
    fieldWidth: W,
    spots: [...offense, ...routes],
    players: offense,
    box,
    radius: R,
    icon: "medium",
    special: false,
    spacing: Infinity,
    ...extra,
  });
  type Layout = ReturnType<typeof diagramLayout>;
  const inside = (l: Layout, p: Vec, r: number) =>
    p.x - r >= l.view.x - 1e-6 && p.x + r <= l.view.x + l.view.w + 1e-6 && -p.y - r >= l.view.y - 1e-6 && -p.y + r <= l.view.y + l.view.h + 1e-6;
  const printedToken = (l: Layout) => 2 * R * l.k * (l.drawn.w / l.view.w);

  it("keeps every player and the side of every route in a call sheet cell up to 150 %", () => {
    for (const zoom of [100, 125, 150]) {
      const l = diagramLayout(input({ w: 3.6, h: 1.55 }, { zoom, icon: "small" }));
      for (const p of offense) expect(inside(l, p, R * l.k)).toBe(true);
      for (const p of routes) expect(p.x >= l.view.x && p.x <= l.view.x + l.view.w).toBe(true);
    }
  });

  it("puts zoom the frame cannot give into bigger tokens and lines", () => {
    // A tall wristband cell: the frame is already as narrow as the receivers allow.
    const at100 = diagramLayout(input({ w: 0.71, h: 0.7 }));
    const at150 = diagramLayout(input({ w: 0.71, h: 0.7 }, { zoom: 150 }));
    expect(at150.view.w).toBeGreaterThan(at100.view.w * 0.8);
    // Tokens print exactly 1.5 × their 100 % size, part from the tighter frame and the rest from k.
    expect(printedToken(at150)).toBeCloseTo(printedToken(at100) * 1.5, 4);
    for (const p of offense) expect(inside(at150, p, R * at150.k)).toBe(true);
    // Zooming out never shrinks tokens below the floor.
    expect(printedToken(diagramLayout(input({ w: 0.71, h: 0.7 }, { zoom: 50 })))).toBeGreaterThanOrEqual(MIN_TOKEN_IN - 1e-9);
  });

  it("never prints a token smaller than the floor, and scales the floor with the icon size", () => {
    for (const icon of ["small", "medium", "large"] as const) {
      const l = diagramLayout(input({ w: 0.71, h: 0.7 }, { icon }));
      expect(printedToken(l)).toBeCloseTo(MIN_TOKEN_IN * { small: 0.8, medium: 1, large: 1.25 }[icon], 4);
      for (const p of offense) expect(inside(l, p, R * l.k)).toBe(true);
    }
    // A full playbook page is far above the floor, so players keep their size in yards.
    expect(diagramLayout(input({ w: 7.47, h: 9.4 }, { minAspect: PLAYBOOK_MIN_ASPECT })).k).toBeCloseTo(1, 9);
  });

  it("leaves off position letters too small to read, and keeps them on a playbook page", () => {
    const wrist = diagramLayout(input({ w: 0.71, h: 0.7 }));
    // PlayField draws two-letter labels at 0.95 × the token radius.
    expect(R * wrist.k * 0.95).toBeLessThan(wrist.minLabel);
    const page = diagramLayout(input({ w: 7.47, h: 9.4 }, { minAspect: PLAYBOOK_MIN_ASPECT }));
    expect(R * page.k * 0.95).toBeGreaterThan(page.minLabel);
    expect(page.minLabel * (page.drawn.w / page.view.w)).toBeCloseTo(MIN_LABEL_IN);
  });

  it("frames a wide, shallow play on a portrait playbook page without 50 yards of turf above it", () => {
    const l = diagramLayout(input({ w: 7.47, h: 9.4 }, { minAspect: PLAYBOOK_MIN_ASPECT }));
    expect(l.drawn.h).toBeCloseTo(7.47 / PLAYBOOK_MIN_ASPECT);
    expect(l.view.h).toBeLessThan(45);
    // The wristband shape would have drawn about 75 yards of field.
    expect(diagramLayout(input({ w: 7.47, h: 9.4 })).view.h).toBeGreaterThan(70);
  });
});
