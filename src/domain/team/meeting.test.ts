import { describe, expect, it } from "vitest";
import { invitedPlayers, meetingGroups } from "./meeting";
import { newPlayer } from "./roster";

const player = (id: string, positions: string[], status: "active" | "injured" | "inactive" = "active") =>
  newPlayer({ firstName: id, positions, status }, id, new Date("2026-01-01T00:00:00Z"));

describe("meeting audience", () => {
  const roster = [player("qb", ["QB"]), player("wr", ["WR", "CB"]), player("lb", ["MLB"], "injured"), player("ol", ["OT"], "inactive"), player("none", [])];

  it("is the whole team, less inactive players, without groups", () => {
    expect(invitedPlayers(roster, [], "american-football").map((p) => p.id)).toEqual(["qb", "wr", "lb", "none"]);
  });

  it("is the players of the chosen groups", () => {
    expect(invitedPlayers(roster, ["cb", "lb"], "american-football").map((p) => p.id)).toEqual(["wr", "lb"]);
    expect(invitedPlayers(roster, ["ol"], "american-football")).toEqual([]);
  });

  it("keeps the sport's groups in field order", () => {
    expect(meetingGroups(["s", "qb", "rsh", "nope"], "flag-football")).toEqual(["qb", "rsh", "s"]);
  });
});
