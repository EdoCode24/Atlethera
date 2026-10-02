import { pointAt, routeGeometry, type Sampled } from "./geometry";
import type { PlayerSpot, Vec } from "./types";

/** Running speed on the animated diagram, in yards per second at 1× speed. */
export const YARDS_PER_SECOND = 6;

export interface Track {
  id: string;
  start: Vec;
  path: Sampled | null;
  /** For a motion (zigzag) route: how far the player runs before the snap. */
  motionLength: number;
}

export interface PlaybackPlan {
  tracks: Track[];
  /** Seconds of pre-snap motion. */
  snapAt: number;
  /** Seconds until the last player stops. */
  duration: number;
}

/**
 * Motion runs first: players with a zigzag route cover their first segment before the snap.
 * At the snap everyone moves together, motion players carrying on from where they are.
 */
export function planPlayback(players: PlayerSpot[], yardsPerSecond = YARDS_PER_SECOND): PlaybackPlan {
  const tracks: Track[] = players.map((p) => {
    const geo = p.route ? routeGeometry(p, p.route) : null;
    return {
      id: p.id,
      start: { x: p.x, y: p.y },
      path: geo?.sampled ?? null,
      motionLength: geo && p.route?.line === "zigzag" ? geo.firstSegmentEnd : 0,
    };
  });
  const snapAt = Math.max(0, ...tracks.map((t) => t.motionLength / yardsPerSecond));
  const duration = Math.max(snapAt, ...tracks.map((t) => (t.path ? snapAt + (t.path.length - t.motionLength) / yardsPerSecond : 0)));
  return { tracks, snapAt, duration };
}

export function positionAt(track: Track, plan: Pick<PlaybackPlan, "snapAt">, seconds: number, yardsPerSecond = YARDS_PER_SECOND): Vec {
  if (!track.path) return track.start;
  const distance =
    seconds <= plan.snapAt
      ? Math.min(track.motionLength, seconds * yardsPerSecond)
      : track.motionLength + (seconds - plan.snapAt) * yardsPerSecond;
  return pointAt(track.path, distance).p;
}
