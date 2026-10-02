import { describe, expect, it } from "vitest";
import { clipsOf, embedUrl, formatTime, parseTime, parseVideoUrl, sortClips, type Clip, type Video } from "./video";

describe("video links", () => {
  it("recognises YouTube in its forms", () => {
    for (const url of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10", "https://youtu.be/dQw4w9WgXcQ", "https://m.youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube.com/embed/dQw4w9WgXcQ"]) {
      expect(parseVideoUrl(url)).toEqual({ source: "youtube", id: "dQw4w9WgXcQ" });
    }
    expect(parseVideoUrl("https://www.youtube.com/@team")).toEqual({ source: "link", id: null });
  });

  it("recognises Vimeo, video files and other pages", () => {
    expect(parseVideoUrl("https://vimeo.com/76979871")).toEqual({ source: "vimeo", id: "76979871" });
    expect(parseVideoUrl("https://cdn.example.com/game1.MP4")).toEqual({ source: "file", id: null });
    expect(parseVideoUrl("https://www.hudl.com/video/3/123/abc")).toEqual({ source: "link", id: null });
    expect(parseVideoUrl("not a link")).toBeNull();
    expect(parseVideoUrl("javascript:alert(1)")).toBeNull();
  });

  it("embeds what can be embedded", () => {
    const yt = parseVideoUrl("https://youtu.be/dQw4w9WgXcQ")!;
    expect(embedUrl(yt, "", "http://localhost:3000")).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ?enablejsapi=1");
    expect(embedUrl({ source: "link", id: null }, "https://hudl.com/x", "")).toBeNull();
  });
});

describe("times", () => {
  it("reads and writes clip times", () => {
    expect(parseTime("1:23")).toBe(83);
    expect(parseTime("01:02:03")).toBe(3723);
    expect(parseTime("95")).toBe(95);
    expect(parseTime("1:75")).toBeNull();
    expect(parseTime("abc")).toBeNull();
    expect(formatTime(83)).toBe("1:23");
    expect(formatTime(3723)).toBe("1:02:03");
  });

  it("orders clips and finds a player's", () => {
    const clip = (id: string, at: number, playerIds: string[] = []): Clip => ({ id, at, label: id, note: "", playerIds, plays: [] });
    expect(sortClips([clip("b", 90), clip("a", 10)]).map((c) => c.id)).toEqual(["a", "b"]);
    const video = (id: string, createdAt: string, clips: Clip[]): Video => ({ id, title: id, url: "", eventId: null, notes: "", clips, createdAt, updatedAt: createdAt });
    const videos = [video("old", "2026-01-01", [clip("x", 5, ["p"])]), video("new", "2026-02-01", [clip("z", 50, ["p"]), clip("y", 20, ["p", "q"]), clip("n", 1)])];
    expect(clipsOf(videos, "p").map((c) => `${c.video.id}/${c.clip.id}`)).toEqual(["new/y", "new/z", "old/x"]);
  });
});
