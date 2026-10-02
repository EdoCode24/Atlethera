"use client";

import { useEffect, useImperativeHandle, useRef, useSyncExternalStore, type Ref } from "react";
import { embedUrl, type ParsedVideo } from "@/domain/team/video";

export interface PlayerHandle {
  /** Jumps to a moment and plays from there. */
  seek: (seconds: number) => void;
  /** Where the video is, if the player has said so. */
  time: () => number | null;
}

const noChanges = () => () => {};
const YOUTUBE = "https://www.youtube-nocookie.com";
const VIMEO = "https://player.vimeo.com";

function postTo(frame: HTMLIFrameElement | null, source: ParsedVideo["source"], message: unknown) {
  frame?.contentWindow?.postMessage(JSON.stringify(message), source === "youtube" ? YOUTUBE : VIMEO);
}

/**
 * YouTube and Vimeo in their own players, driven through postMessage (no extra script): they
 * report the time as the video plays and take seek commands. Video files play in <video>.
 * `onTime` fires once the player first reports a time, so "current moment" can be offered.
 */
export function VideoPlayer({ parsed, url, title, start = 0, onTime, ref }: { parsed: ParsedVideo; url: string; title: string; start?: number; onTime?: () => void; ref?: Ref<PlayerHandle> }) {
  const origin = useSyncExternalStore(noChanges, () => window.location.origin, () => "");
  const frame = useRef<HTMLIFrameElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const time = useRef<number | null>(null);
  const told = useRef(false);
  const onTimeRef = useRef(onTime);
  useEffect(() => {
    onTimeRef.current = onTime;
  });

  const post = (message: unknown) => postTo(frame.current, parsed.source, message);

  useImperativeHandle(ref, () => ({
    seek(seconds) {
      if (parsed.source === "file" && video.current) {
        video.current.currentTime = seconds;
        void video.current.play().catch(() => {});
      } else if (parsed.source === "youtube") {
        post({ event: "command", func: "seekTo", args: [seconds, true], id: 1, channel: "widget" });
        post({ event: "command", func: "playVideo", args: [], id: 1, channel: "widget" });
      } else if (parsed.source === "vimeo") {
        post({ method: "setCurrentTime", value: seconds });
        post({ method: "play" });
      }
      time.current = seconds;
    },
    time: () => (parsed.source === "file" && video.current ? video.current.currentTime : time.current),
  }));

  // The embedded players report their time by message.
  useEffect(() => {
    if (parsed.source !== "youtube" && parsed.source !== "vimeo") return;
    const heard = (seconds: unknown) => {
      if (typeof seconds !== "number") return;
      time.current = seconds;
      if (!told.current) {
        told.current = true;
        onTimeRef.current?.();
      }
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== YOUTUBE && e.origin !== VIMEO) return;
      let data: { event?: string; info?: { currentTime?: unknown }; data?: { seconds?: unknown } };
      try {
        data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (data?.info && "currentTime" in data.info) heard(data.info.currentTime);
      if (data?.event === "playProgress" || data?.event === "timeupdate") heard(data.data?.seconds);
      if (data?.event === "ready") {
        postTo(frame.current, parsed.source, { method: "addEventListener", value: "playProgress" });
        postTo(frame.current, parsed.source, { method: "addEventListener", value: "timeupdate" });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [parsed.source]);

  if (!origin) return <div className="aspect-video w-full rounded-[var(--radius-card)] bg-night-900" />;
  const src = embedUrl(parsed, url, origin);
  if (!src) return null;

  if (parsed.source === "file") {
    return (
      <video
        ref={video}
        src={`${src}${start ? `#t=${start}` : ""}`}
        controls
        playsInline
        preload="metadata"
        onTimeUpdate={() => {
          if (!told.current) {
            told.current = true;
            onTimeRef.current?.();
          }
        }}
        className="aspect-video w-full rounded-[var(--radius-card)] bg-black"
      />
    );
  }

  const withStart = parsed.source === "youtube" ? `${src}${start ? `&start=${Math.floor(start)}` : ""}` : `${src}${start ? `#t=${Math.floor(start)}s` : ""}`;
  return (
    <iframe
      ref={frame}
      src={withStart}
      title={title}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      onLoad={() => {
        // YouTube starts reporting once it is listened to.
        if (parsed.source === "youtube") post({ event: "listening", id: 1, channel: "widget" });
      }}
      className="aspect-video w-full rounded-[var(--radius-card)] bg-black"
    />
  );
}
