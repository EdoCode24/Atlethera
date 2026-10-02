"use client";

import { newId } from "@/domain/playbook/formations";
import type { Clip, Video } from "@/domain/team/video";
import { read, useStored, write } from "./store";

const key = (workspaceId: string) => `videos.${workspaceId}`;
const NONE: Video[] = [];

function load(workspaceId: string): Video[] {
  return read(key(workspaceId), NONE);
}

export function useVideos(workspaceId: string | undefined): Video[] {
  return useStored(workspaceId ? key(workspaceId) : "videos.none", NONE);
}

export type VideoInput = Pick<Video, "title" | "url" | "eventId" | "notes">;

export const videoRepo = {
  add(workspaceId: string, input: VideoInput): Video {
    const now = new Date().toISOString();
    const video: Video = { ...input, title: input.title.trim(), url: input.url.trim(), id: newId("vid"), clips: [], createdAt: now, updatedAt: now };
    write(key(workspaceId), [...load(workspaceId), video]);
    return video;
  },
  update(workspaceId: string, id: string, change: (video: Video) => Video) {
    write(
      key(workspaceId),
      load(workspaceId).map((v) => (v.id === id ? { ...change(v), updatedAt: new Date().toISOString() } : v)),
    );
  },
  remove(workspaceId: string, id: string) {
    write(
      key(workspaceId),
      load(workspaceId).filter((v) => v.id !== id),
    );
  },
  addClip(workspaceId: string, videoId: string, clip: Omit<Clip, "id">): Clip {
    const added = { ...clip, id: newId("clip") };
    videoRepo.update(workspaceId, videoId, (v) => ({ ...v, clips: [...v.clips, added] }));
    return added;
  },
  /** Film stays when its game or practice leaves the calendar; only the link goes. */
  unlinkEvents(workspaceId: string, eventIds: string[]) {
    const videos = load(workspaceId);
    if (!videos.some((v) => v.eventId && eventIds.includes(v.eventId))) return;
    write(
      key(workspaceId),
      videos.map((v) => (v.eventId && eventIds.includes(v.eventId) ? { ...v, eventId: null } : v)),
    );
  },
};
