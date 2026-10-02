import { describe, expect, it } from "vitest";
import { editorReducer, initEditor, END_CYCLE, reseat, type EditorAction, type EditorState } from "./editor";
import { buildPath, dist, endMarker, mirrorPlayers, pointAt, routeGeometry, sample, zigzag, zoneCenter } from "./geometry";
import { defaultFormation, fitSpecialDepth, frontFormation, opponentFormation, specialFormation } from "./formations";
import { SPECIAL_TEAMS, SPECIAL_UNITS } from "./special";
import { DEFENSE_FRONTS, FRONTS, type DefenseFront } from "./fronts";
import { backfieldDepth, clonePlay, defaultBackfield, formationExtent, newPlay, newPlaybook, withFittedDepth } from "./factory";
import { planPlayback, positionAt } from "./playback";
import { naturalSide, ROUTE_TREE, templateRoute, templateStart } from "./routes";
import type { Play, PlayerSpot, Route } from "./types";

const route = (points: [number, number][], extra: Partial<Route> = {}): Route => ({
  points: points.map(([x, y]) => ({ x, y })),
  line: "solid",
  end: "arrow",
  corners: "sharp",
  ...extra,
});

const player = (x: number, y: number, r: Route | null = null): PlayerSpot => ({
  id: `p${x}-${y}`,
  label: "X",
  color: "amber",
  shape: "circle",
  x,
  y,
  starred: false,
  route: r,
  zone: null,
});

describe("geometry", () => {
  it("samples a straight route to its true length", () => {
    const s = sample(buildPath([{ x: 0, y: 0 }, { x: 0, y: 5 }, { x: 5, y: 5 }], "sharp"));
    expect(s.length).toBeCloseTo(10, 5);
    expect(pointAt(s, 7.5).p.x).toBeCloseTo(2.5, 5);
  });

  it("rounds corners into shorter curves that keep both ends", () => {
    const vertices = [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }];
    const sharp = sample(buildPath(vertices, "sharp"));
    const round = sample(buildPath(vertices, "rounded"));
    expect(round.length).toBeLessThan(sharp.length);
    expect(round.pts[0]).toEqual(vertices[0]);
    expect(round.pts[round.pts.length - 1]).toEqual(vertices[2]);
  });

  it("zigzags only across the first segment of a motion route", () => {
    const geo = routeGeometry({ x: 0, y: 0 }, route([[0, 6], [8, 6]], { line: "zigzag" }))!;
    expect(geo.firstSegmentEnd).toBeCloseTo(6, 1);
    expect(geo.zigzag.every((p) => p.y <= 6.5)).toBe(true);
    expect(geo.body[0].y).toBeCloseTo(6, 1);
    expect(geo.body[geo.body.length - 1]).toEqual({ x: 8, y: 6 });
  });

  it("zigzag wiggles around the path and lands on its end", () => {
    const s = sample(buildPath([{ x: 0, y: 0 }, { x: 0, y: 10 }], "sharp"));
    const z = zigzag(s);
    expect(z[z.length - 1]).toEqual({ x: 0, y: 10 });
    expect(Math.max(...z.map((p) => Math.abs(p.x)))).toBeGreaterThan(0.3);
  });

  it("draws arrow, T and dot ends", () => {
    const tip = { x: 0, y: 10 };
    const dir = { x: 0, y: 1 };
    expect(endMarker("arrow", tip, dir).lines[0][1]).toEqual(tip);
    const t = endMarker("block", tip, dir).lines[0];
    expect(t[0].y).toBeCloseTo(10, 6);
    expect(t[1].y).toBeCloseTo(10, 6);
    expect(endMarker("dot", tip, dir).ring).toEqual(tip);
  });

  it("keeps the corner where a motion ends sharp, with rounded corners after it", () => {
    // Z shifts in motion to (10,-1.75), then runs up and breaks to the corner.
    const start = { x: 20.6, y: -1.75 };
    const r = route([[10, -1.75], [10, 5], [4, 8.5]], { line: "zigzag", corners: "rounded" });
    const geo = routeGeometry(start, r)!;
    // The motion is the straight first segment and the zigzag ends on its handle.
    expect(geo.firstSegmentEnd).toBeCloseTo(10.6, 5);
    expect(geo.zigzag.at(-1)!.x).toBeCloseTo(10, 5);
    expect(geo.zigzag.at(-1)!.y).toBeCloseTo(-1.75, 5);
    expect(geo.zigzag.every((p) => Math.abs(p.y + 1.75) < 0.5)).toBe(true);
    expect(geo.body[0].x).toBeCloseTo(10, 5);
    expect(geo.body[0].y).toBeCloseTo(-1.75, 5);
    // The corner after the snap is still rounded: the path passes inside it.
    expect(Math.min(...geo.sampled.pts.map((p) => dist(p, { x: 10, y: 5 })))).toBeGreaterThan(0.3);
    // Playback stops the motion on the spot the coach set.
    const plan = planPlayback([{ ...player(start.x, start.y, r), id: "z" }], 6);
    expect(plan.snapAt).toBeCloseTo(10.6 / 6, 5);
    const atSnap = positionAt(plan.tracks[0], plan, plan.snapAt, 6);
    expect(atSnap.x).toBeCloseTo(10, 5);
    expect(atSnap.y).toBeCloseTo(-1.75, 5);
  });

  it("shrinks the end marker on a short last leg, never below 0.45", () => {
    const at = (points: [number, number][]) => routeGeometry({ x: 0, y: 0 }, route(points))!.tipScale;
    expect(at([[0, 8]])).toBe(1);
    expect(at([[0, 7], [3, 7]])).toBe(1);
    // A hitch turns back about a yard and a half: the arrowhead shrinks with the leg.
    const hitch = at([[0, 5], [1, 4]]);
    expect(hitch).toBeLessThan(1);
    expect(hitch).toBeGreaterThan(0.45);
    expect(at([[0, 5], [0, 5.2]])).toBe(0.45);
    // On a zoomed-in board (smaller markers) the same leg keeps a bigger share.
    expect(routeGeometry({ x: 0, y: 0 }, route([[0, 5], [1, 4]]), 0.7)!.tipScale).toBeGreaterThan(hitch);
  });

  it("flips a play left to right, routes included", () => {
    const [m] = mirrorPlayers([player(4, 0, route([[4, 6], [10, 6]]))], 30);
    expect(m.x).toBe(26);
    expect(m.route!.points).toEqual([{ x: 26, y: 6 }, { x: 20, y: 6 }]);
  });

  it("renames side-coded players on a flip, so labels stay true to their side", () => {
    const width = 160 / 3;
    // American football offense: the line still reads LT LG C RG RT from left to right.
    const line = (list: PlayerSpot[]) =>
      list
        .filter((p) => ["LT", "LG", "C", "RG", "RT"].includes(p.label))
        .sort((a, b) => a.x - b.x)
        .map((p) => p.label);
    const offense = defaultFormation("american-football", "offense", 11, width);
    const flipped = mirrorPlayers(offense, width);
    expect(line(flipped)).toEqual(["LT", "LG", "C", "RG", "RT"]);
    // The man who was the right tackle carries his (mirrored) assignment as the left tackle.
    const rt = offense.find((p) => p.label === "RT")!;
    expect(flipped.find((p) => p.id === rt.id)!.label).toBe("LT");
    // Kickoff: L1 is the far-left man again and takes the left side's colour; roles never change.
    const { own, opponent } = specialFormation("kickoff", width);
    const flippedOwn = mirrorPlayers(own, width);
    const far = [...flippedOwn].sort((a, b) => a.x - b.x);
    expect([far[0].label, far[0].color]).toEqual(["L1", "amber"]);
    expect([far.at(-1)!.label, far.at(-1)!.color]).toEqual(["R1", "violet"]);
    expect(flippedOwn.find((p) => p.label === "K")).toBeDefined();
    // The grey return team keeps its own view: its right tackle still stands on our left.
    const ghosts = mirrorPlayers(opponent, width);
    expect(ghosts.find((p) => p.label === "RT")!.x).toBeLessThan(width / 2);
    expect(ghosts.filter((p) => ["KR", "KR2"].includes(p.label))).toHaveLength(2);
    // Labels that name a role, not a side, stay; a lane player in a custom colour keeps it.
    const roles = ["PR", "KR2", "LB", "LS", "L", "R", "S", "X", "GUN"].map((label) => ({ ...player(10, 0), label }));
    expect(mirrorPlayers(roles, width).map((p) => p.label)).toEqual(roles.map((p) => p.label));
    const [custom] = mirrorPlayers([{ ...player(10, 0), label: "L2", color: "teal" }], width);
    expect([custom.label, custom.color]).toEqual(["R2", "teal"]);
    // Every pair swaps both ways.
    for (const [l, r] of [["LE", "RE"], ["LW", "RW"], ["LU", "RU"], ["EL", "ER"], ["CL", "CR"], ["BL", "BR"], ["AL", "AR"], ["SL", "SR"], ["L9", "R9"]]) {
      expect(mirrorPlayers([{ ...player(10, 0), label: l }], width)[0].label).toBe(r);
      expect(mirrorPlayers([{ ...player(10, 0), label: r }], width)[0].label).toBe(l);
    }
  });

  it("puts a zone at the end of the route, or on the player", () => {
    expect(zoneCenter(player(4, -4, route([[4, -9]])))).toEqual({ x: 4, y: -9 });
    expect(zoneCenter(player(4, -4))).toEqual({ x: 4, y: -4 });
  });
});

describe("route templates", () => {
  it("follows the coach's tree: 1 to 9 plus 66, with unique ids", () => {
    expect(ROUTE_TREE.map((t) => t.id)).toEqual(["1", "2", "3", "4", "5", "6", "66", "7", "8", "9"]);
  });

  it("breaks outside routes to the near sideline and inside routes to the middle", () => {
    const left = player(4, 0);
    const right = player(26, 0);
    const out = templateRoute(left, "3", 30).points.at(-1)!;
    const inn = templateRoute(left, "4", 30).points.at(-1)!;
    expect(out.x).toBeLessThan(left.x);
    expect(inn.x).toBeGreaterThan(left.x);
    expect(templateRoute(right, "3", 30).points.at(-1)!.x).toBeGreaterThan(right.x);
    expect(templateRoute(right, "8", 30).points.at(-1)!.x).toBeLessThan(right.x);
    // 6 comes back toward the sideline, 66 toward the middle, from the same 8-yard stem.
    expect(templateRoute(left, "6", 30).points.at(-1)!.x).toBeLessThan(left.x);
    expect(templateRoute(left, "66", 30).points.at(-1)!.x).toBeGreaterThan(left.x);
  });

  it("lets the coach pick the side a route breaks to", () => {
    const center = player(15, 0);
    for (const id of ["1", "2", "3", "4", "5", "6", "66", "7", "8"]) {
      expect(templateRoute(center, id, 30, undefined, "left").points.at(-1)!.x).toBeLessThan(center.x);
      expect(templateRoute(center, id, 30, undefined, "right").points.at(-1)!.x).toBeGreaterThan(center.x);
    }
    // The stem stays straight: only the break changes side.
    expect(templateRoute(center, "3", 30, undefined, "left").points[0]).toEqual({ x: 15, y: 5 });
  });

  it("shrinks a template evenly to fit under the deepest visible yard", () => {
    const x = player(10, 0);
    const full = templateRoute(x, "7", 30);
    const fit = templateRoute(x, "7", 30, undefined, undefined, 10);
    expect(Math.max(...fit.points.map((p) => p.y))).toBeLessThanOrEqual(10);
    // Same shape: every corner scales by the same factor.
    const f = fit.points[1].y / full.points[1].y;
    expect((fit.points[1].x - x.x) / (full.points[1].x - x.x)).toBeCloseTo(f, 2);
    expect(templateRoute(x, "5", 30, undefined, undefined, 10)).toEqual(templateRoute(x, "5", 30));
  });

  it("reports the natural side and none for straight routes", () => {
    expect(naturalSide(player(4, 0), "3", 30)).toBe("left");
    expect(naturalSide(player(4, 0), "4", 30)).toBe("right");
    expect(naturalSide(player(26, 0), "3", 30)).toBe("right");
    expect(naturalSide(player(15, 0), "9", 30)).toBeNull();
  });

  it("keeps a motion and runs the template from its end, after the snap", () => {
    // Z in jet motion from the right half to the left half of a 30-yard field.
    const z = player(20.6, -1.75, route([[10, -1.75]], { line: "zigzag", end: "dot" }));
    expect(templateStart(z)).toEqual({ x: 10, y: -1.75 });
    const go = templateRoute(z, "9", 30, z.route!);
    expect(go.points).toEqual([{ x: 10, y: -1.75 }, { x: 10, y: 10.75 }]);
    expect([go.line, go.end]).toEqual(["zigzag", "dot"]);
    // Out and in follow the side of the field he is on at the snap.
    expect(naturalSide(z, "3", 30)).toBe("left");
    expect(templateRoute(z, "3", 30, z.route!).points.at(-1)!.x).toBeLessThan(10);
    // A template replaces an earlier route after the motion, and shrinks from the motion's end.
    const withRoute = { ...z, route: { ...z.route!, points: [{ x: 10, y: -1.75 }, { x: 10, y: 3 }, { x: 14, y: 6 }] } };
    const fit = templateRoute(withRoute, "7", 30, withRoute.route, undefined, 6);
    expect(fit.points[0]).toEqual({ x: 10, y: -1.75 });
    expect(fit.points).toHaveLength(3);
    expect(Math.max(...fit.points.map((p) => p.y))).toBeLessThanOrEqual(6);
    // Playback: only the motion runs before the snap.
    const plan = planPlayback([{ ...z, route: go, id: "z" }], 6);
    expect(plan.snapAt).toBeCloseTo(10.6 / 6, 5);
    // A template is never motion: a zigzag style with nothing drawn turns solid.
    const armed = player(20.6, -1.75, route([], { line: "zigzag" }));
    const plain = templateRoute(armed, "9", 30, armed.route!);
    expect(plain.line).toBe("solid");
    expect(plain.points).toEqual([{ x: 20.6, y: 10.75 }]);
  });

  it("keeps templates on the field", () => {
    const edge = player(1, 0);
    for (const t of ROUTE_TREE) for (const side of [undefined, "left", "right"] as const) for (const p of templateRoute(edge, t.id, 25, undefined, side).points) expect(p.x).toBeGreaterThanOrEqual(0.5);
  });
});

describe("playback", () => {
  it("runs motion before the snap, then everyone together", () => {
    const motion = { ...player(4, 0, route([[10, 0], [10, 6]], { line: "zigzag" })), id: "m" };
    const runner = { ...player(20, 0, route([[20, 12]])), id: "r" };
    const plan = planPlayback([motion, runner], 6);
    expect(plan.snapAt).toBeCloseTo(1, 1);
    const [m, r] = plan.tracks;
    expect(positionAt(r, plan, 0.9, 6)).toEqual({ x: 20, y: 0 });
    expect(positionAt(m, plan, 1, 6).x).toBeCloseTo(10, 1);
    expect(positionAt(r, plan, 2, 6).y).toBeCloseTo(6, 1);
    expect(plan.duration).toBeCloseTo(3, 1);
  });

  it("leaves players without a route where they stand", () => {
    const plan = planPlayback([player(15, -4)]);
    expect(positionAt(plan.tracks[0], plan, 5)).toEqual({ x: 15, y: -4 });
    expect(plan.duration).toBe(0);
  });
});

describe("formations", () => {
  it("lines up the 5v5 flag default from the reference, scaled to the field", () => {
    const offense = defaultFormation("flag-football", "offense", 5, 30);
    expect(offense.map((p) => p.label)).toEqual(["C", "Q", "X", "Y", "Z"]);
    expect(offense.find((p) => p.label === "C")!.shape).toBe("square");
    const narrow = defaultFormation("flag-football", "offense", 5, 25);
    expect(narrow.find((p) => p.label === "C")!.x).toBeCloseTo(12.5, 2);
  });

  it("grows the flag side from 4 to 9", () => {
    for (let n = 4; n <= 9; n++) {
      expect(defaultFormation("flag-football", "offense", n, 30)).toHaveLength(n);
      expect(defaultFormation("flag-football", "defense", n, 30)).toHaveLength(n);
    }
  });

  it("keeps the rusher at least 7 yards off the line", () => {
    const rusher = defaultFormation("flag-football", "defense", 5, 30).find((p) => p.label === "R")!;
    expect(-rusher.y).toBeGreaterThanOrEqual(7);
  });

  it("stands the own side below the line and the opponent above it", () => {
    for (const sport of ["flag-football", "american-football"] as const) {
      for (const side of ["offense", "defense"] as const) {
        const width = sport === "flag-football" ? 30 : 160 / 3;
        const own = defaultFormation(sport, side, sport === "flag-football" ? 5 : 11, width);
        const opp = opponentFormation(sport, side, sport === "flag-football" ? 5 : 11, width);
        expect(own.every((p) => p.y <= 0)).toBe(true);
        expect(opp.every((p) => p.y >= 0)).toBe(true);
        expect([...own, ...opp].every((p) => p.x >= 0 && p.x <= width)).toBe(true);
      }
    }
  });

  it("keeps the quarterback a notch closer to the centre than the reference", () => {
    const q = defaultFormation("flag-football", "offense", 5, 30).find((p) => p.label === "Q")!;
    expect(q.y).toBeCloseTo(-3.3, 2);
    const af = defaultFormation("american-football", "offense", 11, 160 / 3);
    for (const label of ["QB", "RB"]) expect(af.find((p) => p.label === label)!.y).toBeCloseTo(-4.5, 2);
  });

  it("measures the backfield from the deepest token", () => {
    const r = 0.8;
    const team = [player(10, 0), { ...player(15, -3.3) }];
    expect(formationExtent(team, r)).toBeCloseTo(3.3 + r, 5);
    // A star reaches further than a circle, a triangle a little less.
    expect(formationExtent([{ ...player(15, -3.3), starred: true }], r)).toBeCloseTo(3.3 + r * 1.45, 5);
    expect(formationExtent([{ ...player(15, -3.3), shape: "triangle" }], r)).toBeCloseTo(3.3 + r * 0.9, 5);
    // Nobody behind the line: still room for one token.
    expect(formationExtent([player(10, 2)], r)).toBe(r);
    // "Less" leans the team on the edge; the other settings leave more turf behind it.
    const less = backfieldDepth(team, r, "less");
    expect(less).toBeGreaterThan(3.3 + r);
    expect(less).toBeLessThan(3.3 + r + 0.6);
    expect(backfieldDepth(team, r, "standard")).toBeCloseTo(less + 2.5, 5);
    expect(backfieldDepth(team, r, "more")).toBeCloseTo(less + 6, 5);
  });

  it("lines up every American football front with its name's numbers", () => {
    const counts = { "4-3": [4, 3, 4], "3-4": [3, 4, 4], "4-2-5": [4, 2, 5], "3-3-5": [3, 3, 5], "5-2": [5, 2, 4] } as const;
    const width = 160 / 3;
    for (const front of DEFENSE_FRONTS) {
      const players = FRONTS[front].players;
      expect(players).toHaveLength(11);
      const by = (g: string) => players.filter((p) => p.group === g).length;
      expect([by("DL"), by("LB"), by("DB")]).toEqual([...counts[front]]);
      expect(players.every((p) => p.label.length <= 3)).toBe(true);
      const own = frontFormation(front, width);
      expect(own.every((p) => p.y < 0 && p.x > 0 && p.x < width)).toBe(true);
      // The strong side (toward the tight end) is on the defense's left in its own view.
      const strong = players.filter((p) => p.lateral > 1).length;
      expect(own.filter((p) => p.x < width / 2 - 1).length).toBe(strong);
    }
  });

  it("shows the chosen front as the ghosts of an offensive play", () => {
    const width = 160 / 3;
    const ghosts = opponentFormation("american-football", "offense", 11, width, "3-4");
    expect(ghosts.map((p) => p.label).sort()).toEqual(FRONTS["3-4"].players.map((p) => p.label).sort());
    expect(ghosts.every((p) => p.y > 0)).toBe(true);
    // The Sam sets to the offense's tight end, which is on the offense's right.
    expect(ghosts.find((p) => p.label === "S")!.x).toBeGreaterThan(width / 2);
  });

  it("keeps what was drawn on positions that stay in a new front", () => {
    const width = 160 / 3;
    const before = frontFormation("4-3", width).map((p) =>
      p.label === "M" ? { ...p, starred: true, route: { points: [{ x: p.x, y: p.y + 3 }], line: "solid" as const, end: "arrow" as const, corners: "sharp" as const } } : p,
    );
    const after = reseat(before, frontFormation("3-4", width));
    const mike = after.find((p) => p.label === "M")!;
    const old = before.find((p) => p.label === "M")!;
    expect(mike.id).toBe(old.id);
    expect(mike.starred).toBe(true);
    // The route keeps its target: only its start follows the new alignment.
    expect(mike.route!.points[0]).toEqual({ x: old.x, y: old.y + 3 });
    expect(after.find((p) => p.label === "J")!.route).toBeNull();
  });

  it("fits every special-teams unit on one screen, true to scale near the ball", () => {
    for (const unit of SPECIAL_UNITS) {
      const { own, opponent } = specialFormation(unit, 160 / 3);
      const all = [...own, ...opponent];
      const depth = Math.max(0, ...all.map((p) => -p.y)) + Math.max(0, ...all.map((p) => p.y));
      expect(depth).toBeLessThanOrEqual(19.01);
      // Fitting again changes nothing.
      expect(fitSpecialDepth(own, opponent)).toEqual({ own, opponent });
    }
    // The kickoff team stays exactly where the rules put it (5 yards behind the ball).
    const kick = specialFormation("kickoff", 160 / 3).own.filter((p) => p.label !== "K");
    expect(kick.every((p) => p.y === -5)).toBe(true);
  });

  it("lines up every special-teams unit and the unit facing it", () => {
    const width = 160 / 3;
    for (const unit of SPECIAL_UNITS) {
      const { own, opponent } = specialFormation(unit, width);
      expect(own).toHaveLength(11);
      expect(opponent).toHaveLength(11);
      // Ours below the ball, theirs in front of it, everyone on the field.
      expect(own.every((p) => p.y <= 0)).toBe(true);
      expect(opponent.every((p) => p.y >= 0)).toBe(true);
      expect([...own, ...opponent].every((p) => p.x > 0 && p.x < width && p.label.length <= 3)).toBe(true);
    }
    // Kickoff rules: the kicking team at most 5 yards behind the ball (the kicker excepted),
    // the return team at least 10 yards away.
    const kick = SPECIAL_TEAMS.kickoff;
    expect(kick.own.filter((p) => p.label !== "K").every((p) => p.y >= -5)).toBe(true);
    expect(kick.opponent.every((p) => p.y >= 10)).toBe(true);
    // A punt has at least seven on the line.
    expect(SPECIAL_TEAMS.punt.own.filter((p) => p.y >= -1).length).toBeGreaterThanOrEqual(7);
  });

  it("starts a special-teams play with its unit, both sides shown, in its category", () => {
    const book = newPlaybook({
      workspaceId: "w",
      name: "AF",
      sport: "american-football",
      playersPerSide: 11,
      fieldWidth: 160 / 3,
      fieldLines: "five",
      categoryNames: { offense: [], defense: [], special: ["Punt"] },
    });
    const play = newPlay(book, { side: "special", unit: "punt", name: "Spread", categoryIds: [], notes: "", author: "T" });
    expect(play.unit).toBe("punt");
    expect(play.settings.showOpponent).toBe(true);
    // On the board the punter stays behind the protector and the returner behind the jammers,
    // with the deep spots compressed to fit one screen.
    const y = (list: typeof play.players, label: string) => list.find((p) => p.label === label)!.y;
    expect(y(play.players, "P")).toBeLessThan(y(play.players, "PP"));
    expect(y(play.opponent, "PR")).toBeGreaterThan(y(play.opponent, "JAM"));
    expect(book.categories.special?.map((c) => c.name)).toEqual(["Punt"]);
  });

  it("keeps the left corner on the left when the front changes", () => {
    const width = 160 / 3;
    const before = frontFormation("4-3", width).map((p) => (p.label === "CB" && p.x < width / 2 ? { ...p, starred: true } : p));
    for (const front of ["4-2-5", "3-3-5", "4-3"] as const) {
      const after = reseat(before, frontFormation(front, width));
      const star = after.find((p) => p.starred)!;
      expect(star.label).toBe("CB");
      expect(star.x).toBeLessThan(width / 2);
    }
  });

  it("hands a position's drawing to the same job under another name in the new front", () => {
    const width = 160 / 3;
    const drawn = (front: DefenseFront, label: string) =>
      frontFormation(front, width).map((p) => (p.label === label ? { ...p, starred: true, route: route([[p.x + 1, 3]]), zone: { radius: 3 } } : p));
    for (const [from, label, to, now] of [
      ["5-2", "NG", "3-4", "NT"],
      ["4-3", "NT", "5-2", "NG"],
      ["4-3", "SS", "3-3-5", "SP"],
      ["3-3-5", "SP", "4-2-5", "SS"],
      ["4-2-5", "NB", "3-3-5", "B"],
      ["3-3-5", "B", "4-2-5", "NB"],
    ] as const) {
      const before = drawn(from, label);
      const old = before.find((p) => p.label === label)!;
      const after = reseat(before, frontFormation(to, width), from).find((p) => p.id === old.id);
      expect(after?.label, `${from} ${label} → ${to}`).toBe(now);
      expect(after!.starred).toBe(true);
      expect(after!.zone).toEqual({ radius: 3 });
      expect(after!.route).toEqual(old.route);
    }
  });

  it("keeps drawn targets where they are on a front change", () => {
    const width = 160 / 3;
    // Cover 3: the free safety's deep-middle zone, and a Sam hook zone.
    const before = frontFormation("4-3", width).map((p) =>
      p.label === "FS" ? { ...p, route: route([[width / 2, -14]]), zone: { radius: 5 } } : p.label === "S" ? { ...p, zone: { radius: 3 } } : p,
    );
    const fs = before.find((p) => p.label === "FS")!;
    const sam = before.find((p) => p.label === "S")!;
    const after = reseat(before, frontFormation("3-3-5", width), "4-3");
    const newFs = after.find((p) => p.id === fs.id)!;
    expect(newFs.x).not.toBe(fs.x);
    expect(zoneCenter(newFs)).toEqual({ x: width / 2, y: -14 });
    // The Sam moves more than a yard, so his zone stays where it was and he drops to it.
    const newSam = after.find((p) => p.id === sam.id)!;
    expect(dist(newSam, sam)).toBeGreaterThan(1);
    expect(zoneCenter(newSam)).toEqual({ x: sam.x, y: sam.y });
    expect(newSam.route!.points).toHaveLength(1);
    // A small shift (the Mike from 4-3 to 3-4, about a yard) carries the zone along, with no stub drop.
    const mike = frontFormation("4-3", width).map((p) => (p.label === "M" ? { ...p, zone: { radius: 4 } } : p));
    const newMike = reseat(mike, frontFormation("3-4", width), "4-3").find((p) => p.label === "M")!;
    expect(newMike.route).toBeNull();
    expect(newMike.zone).toEqual({ radius: 4 });
  });

  it("keeps the coach's own label and colour through a front change", () => {
    const width = 160 / 3;
    for (const mirrored of [false, true]) {
      const base = frontFormation("4-3", width);
      const before = (mirrored ? mirrorPlayers(base, width) : base).map((p) =>
        p.label === "W"
          ? { ...p, label: "WIL", color: "signal" as const, route: route([[p.x - 2, -8]]), zone: { radius: 4 } }
          : p.label === "S"
            ? { ...p, label: "SAM" }
            : p.label === "SS"
              ? { ...p, color: "violet" as const }
              : p,
      );
      const next = frontFormation("3-4", width);
      const after = reseat(before, mirrored ? mirrorPlayers(next, width) : next, "4-3");
      const wil = before.find((p) => p.label === "WIL")!;
      const moved = after.find((p) => p.id === wil.id)!;
      expect(moved.label).toBe("WIL");
      expect(moved.color).toBe("signal");
      expect(moved.zone).toEqual({ radius: 4 });
      expect(moved.route).toEqual(wil.route);
      // He takes the W's spot of the new front, and the Sam the S's.
      const spot = (label: string) => (mirrored ? mirrorPlayers(next, width) : next).find((p) => p.label === label)!;
      expect([moved.x, moved.y]).toEqual([spot("W").x, spot("W").y]);
      const sam = after.find((p) => p.label === "SAM")!;
      expect([sam.x, sam.y]).toEqual([spot("S").x, spot("S").y]);
      expect(after.find((p) => p.label === "SS")!.color).toBe("violet");
      // Default colours follow the new front.
      expect(after.filter((p) => p.label === "CB").map((p) => p.color).sort()).toEqual(["amber", "teal"]);
      expect(after).toHaveLength(11);
      expect(new Set(after.map((p) => p.id)).size).toBe(11);
    }
  });

  it("brings the nose and the strong safety through a round trip of fronts", () => {
    const width = 160 / 3;
    const start: PlayerSpot[] = frontFormation("4-3", width).map((p) => ({ ...p, route: route([[p.x, p.y + 2]]) }));
    let players = start;
    let front: DefenseFront = "4-3";
    for (const next of ["3-4", "4-2-5", "3-3-5", "5-2", "4-3"] as const) {
      players = reseat(players, frontFormation(next, width), front);
      front = next;
    }
    const kept = start.filter((o) => players.some((p) => p.id === o.id && p.route === o.route));
    expect(kept.map((p) => p.label).sort()).toEqual(["CB", "CB", "DE", "DE", "FS", "M", "NT", "SS", "W"]);
  });

  it("names every special-teams unit from its own view, the same in both of its diagrams", () => {
    const width = 160 / 3;
    // The same unit carries the same names and spots as ours and as the grey opponent.
    for (const [kick, receive] of [["kickoff", "kickReturn"], ["punt", "puntReturn"], ["fieldGoal", "fieldGoalBlock"]] as const) {
      expect(SPECIAL_TEAMS[kick].opponent).toEqual(SPECIAL_TEAMS[receive].own);
      expect(SPECIAL_TEAMS[kick].own).toEqual(SPECIAL_TEAMS[receive].opponent);
    }
    // Own view: ours face up (left is left on screen), theirs face down (their left is our right).
    const left = /^(L[TGEWU1-9]|[ECBAS]L)$/;
    const right = /^(R[TGEWU1-9]|[ECBAS]R)$/;
    for (const unit of SPECIAL_UNITS) {
      const { own, opponent } = specialFormation(unit, width);
      for (const p of own) {
        if (left.test(p.label)) expect(p.x, `${unit} ${p.label}`).toBeLessThan(width / 2);
        if (right.test(p.label)) expect(p.x, `${unit} ${p.label}`).toBeGreaterThan(width / 2);
      }
      for (const p of opponent) {
        if (left.test(p.label)) expect(p.x, `${unit} ghost ${p.label}`).toBeGreaterThan(width / 2);
        if (right.test(p.label)) expect(p.x, `${unit} ghost ${p.label}`).toBeLessThan(width / 2);
      }
    }
    // The punt returner is the PR, in the returners' bright colour.
    expect(SPECIAL_TEAMS.puntReturn.own.find((p) => p.y === Math.max(...SPECIAL_TEAMS.puntReturn.own.map((q) => q.y)))).toMatchObject({ label: "PR", color: "volt" });
    // Lane colours follow the side: amber on the left, violet on the right.
    for (const unit of SPECIAL_UNITS) {
      for (const p of [...SPECIAL_TEAMS[unit].own, ...SPECIAL_TEAMS[unit].opponent]) {
        if (/^L\d$/.test(p.label)) expect(p.color).toBe("amber");
        if (/^R\d$/.test(p.label)) expect(p.color).toBe("violet");
      }
    }
  });

  it("opens receiving units with room behind them and kicking units on the edge", () => {
    expect(defaultBackfield("offense")).toBe("less");
    expect(defaultBackfield("defense")).toBe("standard");
    const book = newPlaybook({
      workspaceId: "w",
      name: "AF",
      sport: "american-football",
      playersPerSide: 11,
      fieldWidth: 160 / 3,
      fieldLines: "five",
      categoryNames: { offense: [], defense: [], special: [] },
    });
    const backfield = (unit: (typeof SPECIAL_UNITS)[number]) =>
      newPlay(book, { side: "special", unit, name: unit, categoryIds: [], notes: "", author: "T" }).settings.backfield;
    expect(SPECIAL_UNITS.map(backfield)).toEqual(["less", "standard", "less", "standard", "less", "standard"]);
  });

  it("fits a special-teams play once, and never squeezes the coach's spots again", () => {
    const book = newPlaybook({
      workspaceId: "w",
      name: "AF",
      sport: "american-football",
      playersPerSide: 11,
      fieldWidth: 160 / 3,
      fieldLines: "five",
      categoryNames: { offense: [], defense: [], special: [] },
    });
    const kickoff = newPlay(book, { side: "special", unit: "kickoff", name: "K", categoryIds: [], notes: "", author: "T" });
    expect(kickoff.depthFitted).toBe(true);
    expect(newPlay(book, { side: "offense", name: "O", categoryIds: [], notes: "", author: "T" }).depthFitted).toBeUndefined();
    // The coach drags the second returner 3.5 yards up-field, past the depth budget.
    const dragged: Play = { ...kickoff, opponent: kickoff.opponent.map((p) => (p.label === "KR2" ? { ...p, y: p.y + 3.5 } : p)) };
    expect(withFittedDepth(dragged)).toBe(dragged);
    // A play saved before the board compressed depth is fitted once and flagged.
    const t = SPECIAL_TEAMS.kickoff;
    const legacy: Play = {
      ...kickoff,
      depthFitted: undefined,
      opponent: t.opponent.map((p, i) => ({ ...kickoff.opponent[i], y: p.y })),
    };
    const fitted = withFittedDepth(legacy);
    expect(fitted.depthFitted).toBe(true);
    expect(Math.max(...fitted.opponent.map((p) => p.y))).toBeLessThan(Math.max(...legacy.opponent.map((p) => p.y)));
    expect(withFittedDepth(fitted)).toBe(fitted);
  });

  it("gives the ninth flag player a spot off the sideline, away from his colour", () => {
    for (const width of [25, 30]) {
      for (let n = 4; n <= 9; n++) {
        const team = defaultFormation("flag-football", "offense", n, width);
        for (const a of team) for (const b of team) if (a !== b && a.color === b.color) expect(dist(a, b)).toBeGreaterThan(8);
        if (n === 9) {
          const w = team.find((p) => p.label === "W")!;
          expect(Math.min(w.x, width - w.x)).toBeGreaterThan(5);
          expect(Math.min(...team.filter((p) => p !== w).map((p) => dist(p, w)))).toBeGreaterThan(2);
        }
      }
    }
  });

  it("leaves no empty drop behind when a zone player returns to his spot", () => {
    const width = 160 / 3;
    const start = frontFormation("4-3", width).map((p) => (p.label === "S" ? { ...p, zone: { radius: 4 } } : p));
    const away = reseat(start, frontFormation("3-4", width), "4-3");
    const back = reseat(away, frontFormation("4-3", width), "3-4");
    const sam = back.find((p) => p.label === "S")!;
    expect(sam.zone).toEqual({ radius: 4 });
    expect(sam.route?.points.length ?? 0).toBe(0);
  });

  it("uses all 11 American football players", () => {
    expect(defaultFormation("american-football", "offense", 11, 160 / 3)).toHaveLength(11);
    expect(defaultFormation("american-football", "defense", 11, 160 / 3)).toHaveLength(11);
  });
});

describe("editor", () => {
  const book = newPlaybook({
    workspaceId: "w",
    name: "Deneme 2",
    sport: "flag-football",
    playersPerSide: 5,
    fieldWidth: 30,
    fieldLines: "five",
    categoryNames: { offense: ["Koşu", "Pas"], defense: ["Base", "Red zone"], special: [] },
  });
  const play = newPlay(book, { side: "offense", name: "Play 1", categoryIds: [], notes: "", author: "Test" });
  const x = play.players.find((p) => p.label === "X")!;

  function run(...actions: EditorAction[]): EditorState {
    return actions.reduce(editorReducer, initEditor(play));
  }

  it("adds one segment per tap and removes one per press of the red button", () => {
    let s = run({ type: "select", id: x.id }, { type: "addPoint", to: { x: 4, y: 6 } }, { type: "addPoint", to: { x: 12, y: 6 } });
    expect(s.play.players.find((p) => p.id === x.id)!.route!.points).toHaveLength(2);
    s = editorReducer(s, { type: "removeLastPoint" });
    expect(s.play.players.find((p) => p.id === x.id)!.route!.points).toHaveLength(1);
    s = editorReducer(s, { type: "removeLastPoint" });
    expect(s.play.players.find((p) => p.id === x.id)!.route!.points).toHaveLength(0);
  });

  it("does nothing to routes without a selected player", () => {
    const s = run({ type: "addPoint", to: { x: 4, y: 6 } });
    expect(s.play.players.every((p) => p.route === null)).toBe(true);
  });

  it("cycles the end style arrow, T, dot and back", () => {
    let s = run({ type: "select", id: x.id });
    const ends: string[] = [];
    for (let i = 0; i < 3; i++) {
      s = editorReducer(s, { type: "cycleEnd" });
      ends.push(s.play.players.find((p) => p.id === x.id)!.route!.end);
    }
    expect(ends).toEqual([END_CYCLE[1], END_CYCLE[2], END_CYCLE[0]]);
  });

  it("restyles the existing route and keeps the style for new segments", () => {
    const s = run(
      { type: "select", id: x.id },
      { type: "addPoint", to: { x: 4, y: 6 } },
      { type: "toggleCorners" },
      { type: "toggleZigzag" },
      { type: "addPoint", to: { x: 12, y: 6 } },
    );
    const r = s.play.players.find((p) => p.id === x.id)!.route!;
    expect(r.corners).toBe("rounded");
    expect(r.line).toBe("zigzag");
    expect(r.points).toHaveLength(2);
  });

  it("moves the route with its player", () => {
    const s = run({ type: "select", id: x.id }, { type: "addPoint", to: { x: 4, y: 6 } }, { type: "movePlayer", id: x.id, to: { x: x.x + 2, y: -1 }, commit: true });
    const moved = s.play.players.find((p) => p.id === x.id)!;
    expect(moved.route!.points[0]).toEqual({ x: 6, y: 5 });
  });

  it("snaps to a half-yard grid when snapping is on", () => {
    const s = run({ type: "setSettings", patch: { snap: true } }, { type: "select", id: x.id }, { type: "addPoint", to: { x: 4.2, y: 6.74 } });
    expect(s.play.players.find((p) => p.id === x.id)!.route!.points[0]).toEqual({ x: 4, y: 6.5 });
  });

  it("refuses edits while locked", () => {
    const s = run({ type: "select", id: x.id }, { type: "setLocked", locked: true }, { type: "addPoint", to: { x: 4, y: 6 } });
    expect(s.selectedId).toBeNull();
    expect(s.play.players.every((p) => !p.route || p.route.points.length === 0)).toBe(true);
  });

  it("undoes and redoes", () => {
    let s = run({ type: "select", id: x.id }, { type: "toggleStar" });
    expect(s.play.players.find((p) => p.id === x.id)!.starred).toBe(true);
    s = editorReducer(s, { type: "undo" });
    expect(s.play.players.find((p) => p.id === x.id)!.starred).toBe(false);
    s = editorReducer(s, { type: "redo" });
    expect(s.play.players.find((p) => p.id === x.id)!.starred).toBe(true);
  });

  it("clamps zone radius to its range", () => {
    const s = run({ type: "select", id: x.id }, { type: "toggleZone" }, { type: "setZoneRadius", radius: 99 });
    expect(s.play.players.find((p) => p.id === x.id)!.zone!.radius).toBe(9);
  });

  it("keeps the lock out of the undo history, and undoes nothing while locked", () => {
    const starred = (s: EditorState) => s.play.players.find((p) => p.id === x.id)!.starred;
    let s = run({ type: "select", id: x.id }, { type: "toggleStar" }, { type: "setLocked", locked: true });
    expect(s.past).toHaveLength(1);
    expect(s.play.locked).toBe(true);
    // Undo and redo do nothing while locked.
    expect(editorReducer(s, { type: "undo" })).toBe(s);
    expect(editorReducer(s, { type: "redo" })).toBe(s);
    s = editorReducer(s, { type: "setLocked", locked: false });
    s = editorReducer(s, { type: "undo" });
    expect([starred(s), s.play.locked]).toEqual([false, false]);
    s = editorReducer(s, { type: "redo" });
    expect([starred(s), s.play.locked]).toEqual([true, false]);
    // A step saved while the play was locked (a field option) does not lock it again on undo.
    s = run({ type: "setLocked", locked: true }, { type: "setSettings", patch: { theme: "light" } }, { type: "setLocked", locked: false });
    s = editorReducer(editorReducer(s, { type: "undo" }), { type: "redo" });
    expect([s.play.settings.theme, s.play.locked]).toEqual(["light", false]);
    s = editorReducer(s, { type: "undo" });
    expect([s.play.settings.theme, s.play.locked]).toEqual(["dark", false]);
  });

  it("adds no undo step for an action that changes nothing", () => {
    let s = run({ type: "select", id: x.id }, { type: "addPoint", to: { x: 4, y: 6 } });
    expect(s.past).toHaveLength(1);
    // Removing from an empty route, re-picking the current field option or colour.
    s = editorReducer(s, { type: "removeLastPoint" });
    s = editorReducer(s, { type: "removeLastPoint" });
    s = editorReducer(s, { type: "removeLastPoint" });
    expect(s.past).toHaveLength(2);
    for (const a of [{ type: "setSettings", patch: { theme: "dark" } }, { type: "setPlayer", patch: { color: x.color } }, { type: "setLocked", locked: false }] as EditorAction[]) {
      expect(editorReducer(s, a).past).toHaveLength(2);
    }
    // A press on a route corner that moves nothing, then a real drag of it: one step.
    s = run({ type: "select", id: x.id }, { type: "addPoint", to: { x: 4, y: 6 } }, { type: "beginGesture" });
    expect(s.past).toHaveLength(1);
    s = editorReducer(s, { type: "beginGesture" });
    s = editorReducer(s, { type: "movePoint", index: 0, to: { x: 5, y: 6 } });
    s = editorReducer(s, { type: "movePoint", index: 0, to: { x: 6, y: 7 } });
    expect(s.past).toHaveLength(2);
    s = editorReducer(s, { type: "undo" });
    expect(s.play.players.find((p) => p.id === x.id)!.route!.points).toEqual([{ x: 4, y: 6 }]);
    // A drag that ends where it started leaves no step either.
    s = run({ type: "beginGesture" }, { type: "movePlayer", id: x.id, to: { x: x.x, y: x.y }, commit: false });
    expect(s.past).toHaveLength(0);
  });

  it("ignores a blank label", () => {
    const label = (s: EditorState) => s.play.players.find((p) => p.id === x.id)!;
    let s = run({ type: "select", id: x.id }, { type: "setPlayer", patch: { label: "" } }, { type: "setPlayer", patch: { label: "  " } });
    expect(label(s).label).toBe("X");
    expect(s.past).toHaveLength(0);
    s = editorReducer(s, { type: "setPlayer", patch: { label: " ", color: "teal" } });
    expect([label(s).label, label(s).color]).toEqual(["X", "teal"]);
    s = editorReducer(s, { type: "setPlayer", patch: { label: "WR" } });
    expect(label(s).label).toBe("WR");
  });

  it("rounds route points when a player moves", () => {
    const s = run(
      { type: "select", id: x.id },
      { type: "addPoint", to: { x: 4.1, y: 8.05 } },
      { type: "movePlayer", id: x.id, to: { x: 6.9, y: -0.3 }, commit: true },
    );
    expect(s.play.players.find((p) => p.id === x.id)!.route!.points).toEqual([{ x: 7.1, y: 7.75 }]);
    expect(s.past).toHaveLength(2);
  });

  it("changes the zone size in one undo step while the slider is dragged", () => {
    let s = run({ type: "select", id: x.id }, { type: "toggleZone" }, { type: "beginGesture" });
    for (const radius of [4.5, 5, 6, 7, 9]) s = editorReducer(s, { type: "setZoneRadius", radius, commit: false });
    expect(s.play.players.find((p) => p.id === x.id)!.zone!.radius).toBe(9);
    expect(s.past).toHaveLength(2);
    s = editorReducer(s, { type: "undo" });
    expect(s.play.players.find((p) => p.id === x.id)!.zone!.radius).toBe(4);
    // Without the flag each change is its own step.
    s = editorReducer(s, { type: "setZoneRadius", radius: 6 });
    expect(s.past).toHaveLength(2);
  });

  it("applies a template after motion without losing the motion", () => {
    const s = run(
      { type: "select", id: x.id },
      { type: "toggleZigzag" },
      { type: "addPoint", to: { x: 10, y: 0 } },
      { type: "applyTemplate", id: "9", fieldWidth: 30 },
    );
    const r = s.play.players.find((p) => p.id === x.id)!.route!;
    expect(r.line).toBe("zigzag");
    expect(r.points).toEqual([{ x: 10, y: 0 }, { x: 10, y: 12.5 }]);
  });

  it("flips side-coded labels with the play and keeps role labels", () => {
    const s = run({ type: "flip", fieldWidth: 30 });
    const flipped = s.play.players.find((p) => p.id === x.id)!;
    expect(flipped.label).toBe("X");
    expect(flipped.x).toBeCloseTo(30 - x.x, 5);
  });

  it("copies a play with fresh ids and position notes carried over", () => {
    const withNote = { ...play, positionNotes: { [x.id]: "Derin koş" } };
    const copy = clonePlay(withNote, { name: "Play 1 kopya" });
    expect(copy.id).not.toBe(play.id);
    expect(copy.players.map((p) => p.id)).not.toContain(x.id);
    expect(Object.values(copy.positionNotes)).toEqual(["Derin koş"]);
    expect(dist(copy.players[0], play.players[0])).toBe(0);
  });
});
