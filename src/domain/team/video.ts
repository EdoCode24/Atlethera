import type { PlayRef } from "./practice";

/**
 * Video analysis: game and practice film by link (YouTube, Vimeo or a video file), with clips
 * marked at moments in it, each naming what happened, who was in it and which play it was.
 */

export type VideoSource = "youtube" | "vimeo" | "file" | "link";

export interface Clip {
  id: string;
  /** Seconds from the start. */
  at: number;
  label: string;
  note: string;
  playerIds: string[];
  plays: PlayRef[];
}

export interface Video {
  id: string;
  title: string;
  url: string;
  /** The game or practice on the calendar it is film of, if any. */
  eventId: string | null;
  notes: string;
  clips: Clip[];
  createdAt: string;
  updatedAt: string;
}

export interface ParsedVideo {
  source: VideoSource;
  /** YouTube or Vimeo id. */
  id: string | null;
}

const YOUTUBE_ID = /^[\w-]{11}$/;

/** What a pasted link is: a YouTube or Vimeo video, a video file, or another page. Null if not a web link. */
export function parseVideoUrl(raw: string): ParsedVideo | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return YOUTUBE_ID.test(id) ? { source: "youtube", id } : { source: "link", id: null };
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const fromQuery = url.searchParams.get("v");
    const fromPath = url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/)?.[1];
    const id = fromQuery ?? fromPath ?? "";
    return YOUTUBE_ID.test(id) ? { source: "youtube", id } : { source: "link", id: null };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.match(/(?:^|\/)(\d{6,})(?:\/|$)/)?.[1];
    return id ? { source: "vimeo", id } : { source: "link", id: null };
  }
  if (/\.(mp4|webm|m4v|mov|ogv)$/i.test(url.pathname)) return { source: "file", id: null };
  return { source: "link", id: null };
}

/** The player to embed, starting at `start` seconds; null for links that only open in a new tab. */
export function embedUrl(parsed: ParsedVideo, url: string, origin: string): string | null {
  if (parsed.source === "youtube") return `https://www.youtube-nocookie.com/embed/${parsed.id}?enablejsapi=1&rel=0&playsinline=1&origin=${encodeURIComponent(origin)}`;
  if (parsed.source === "vimeo") return `https://player.vimeo.com/video/${parsed.id}?playsinline=1`;
  if (parsed.source === "file") return url;
  return null;
}

/** "1:23", "01:02:03" or "83" as seconds; null when it is not a time. */
export function parseTime(text: string): number | null {
  const t = text.trim();
  if (/^\d+$/.test(t)) return Number(t);
  const m = t.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const [, h, min, s] = m;
  if (Number(s) > 59 || (h !== undefined && Number(min) > 59)) return null;
  return Number(h ?? 0) * 3600 + Number(min) * 60 + Number(s);
}

/** Seconds as "1:23", or "1:02:03" past an hour. */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export function sortClips(clips: Clip[]): Clip[] {
  return [...clips].sort((a, b) => a.at - b.at);
}

/** The clips a player is tagged in, with the video each is in, newest video first. */
export function clipsOf(videos: Video[], playerId: string): { video: Video; clip: Clip }[] {
  return [...videos]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .flatMap((video) => sortClips(video.clips.filter((c) => c.playerIds.includes(playerId))).map((clip) => ({ video, clip })));
}
