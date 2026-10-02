/**
 * The plays shown in the homepage hero, drawn and run by the real playbook engine.
 * They are examples of what a coach draws, labelled as a sample view on the page.
 */
import { defaultFormation, opponentFormation } from "@/domain/playbook/formations";
import type { PlayerSpot, Route } from "@/domain/playbook/types";
import type { SportId } from "@/domain/sports/types";

export interface HeroPlay {
  fieldWidth: number;
  players: PlayerSpot[];
  opponent: PlayerSpot[];
}

type RouteSpec = { dx: number; dy: number }[] | ((p: PlayerSpot) => { x: number; y: number }[]);

function withRoutes(players: PlayerSpot[], routes: Record<string, { to: RouteSpec; style?: Partial<Route> }>): PlayerSpot[] {
  return players.map((p) => {
    const spec = routes[p.label];
    if (!spec) return p;
    const points = typeof spec.to === "function" ? spec.to(p) : spec.to.map((o) => ({ x: p.x + o.dx, y: p.y + o.dy }));
    return { ...p, route: { points, line: "solid", end: "arrow", corners: "sharp", ...spec.style } };
  });
}

function flagMesh(): HeroPlay {
  const width = 30;
  // Z's motion runs 1.75 yards off the line; the quarterback stands deep enough for it to pass.
  const formation = defaultFormation("flag-football", "offense", 5, width).map((p) => (p.label === "Q" ? { ...p, y: -4.3 } : p));
  const players = withRoutes(formation, {
    X: { to: [{ dx: 0, dy: 3 }, { dx: 17, dy: 4 }] },
    Y: { to: [{ dx: 0, dy: 2 }, { dx: -17, dy: 2.8 }] },
    // Pre-snap motion across the formation, then a corner.
    Z: { to: (p) => [{ x: 12, y: p.y }, { x: 12, y: 8 }, { x: 5, y: 13 }], style: { line: "zigzag", corners: "rounded" } },
    C: { to: [{ dx: 0, dy: 6.5 }, { dx: -1.5, dy: 5.8 }] },
  });
  return { fieldWidth: width, players, opponent: opponentFormation("flag-football", "offense", 5, width) };
}

function afMesh(): HeroPlay {
  const width = 160 / 3;
  const players = withRoutes(defaultFormation("american-football", "offense", 11, width), {
    X: { to: [{ dx: 0, dy: 4.8 }, { dx: 31, dy: 6.3 }] },
    TE: { to: [{ dx: 0, dy: 3.8 }, { dx: -18, dy: 5 }] },
    H: { to: [{ dx: 0, dy: 12.8 }, { dx: 11, dy: 12.8 }] },
    Z: { to: [{ dx: 0, dy: 12.8 }, { dx: 4.2, dy: 18.8 }] },
    RB: { to: [{ dx: 6, dy: 1.5 }, { dx: 11, dy: 4.5 }], style: { corners: "rounded" } },
    LT: { to: [{ dx: 0, dy: 1.6 }], style: { end: "block" } },
    LG: { to: [{ dx: 0, dy: 1.6 }], style: { end: "block" } },
    C: { to: [{ dx: 0, dy: 1.6 }], style: { end: "block" } },
    RG: { to: [{ dx: 0, dy: 1.6 }], style: { end: "block" } },
    RT: { to: [{ dx: 0, dy: 1.6 }], style: { end: "block" } },
  });
  return { fieldWidth: width, players, opponent: opponentFormation("american-football", "offense", 11, width) };
}

export function heroPlays(): Record<SportId, HeroPlay> {
  return { "american-football": afMesh(), "flag-football": flagMesh() };
}
