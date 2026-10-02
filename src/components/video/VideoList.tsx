"use client";

import { useMemo, useState } from "react";
import { EditOnly, useCanEdit } from "@/components/app/access";
import { useApp, useHref } from "@/components/app/AppContext";
import { Button } from "@/components/app/ui";
import { useTeam } from "@/components/team/hooks";
import { CoachOnly, ModuleHeader, panel } from "@/components/team/ui";
import { Icon } from "@/components/ui/Icon";
import { useEvents } from "@/data/calendar";
import { useHydrated } from "@/data/store";
import { useVideos } from "@/data/videos";
import { sports } from "@/domain/sports";
import { parseDay } from "@/domain/team/calendar";
import { parseVideoUrl } from "@/domain/team/video";
import { localeTags } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/plural";
import { VideoDialog } from "./VideoDialog";

export function VideoList() {
  const { t, locale } = useApp();
  const href = useHref();
  const hydrated = useHydrated();
  const { workspace, sport } = useTeam();
  const events = useEvents(workspace?.id);
  const videos = useVideos(workspace?.id);
  const [adding, setAdding] = useState(false);
  const canEdit = useCanEdit();
  const day = useMemo(() => new Intl.DateTimeFormat(localeTags[locale].intl, { day: "numeric", month: "long", year: "numeric" }), [locale]);

  if (!workspace || !hydrated) return null;
  if (!sport) return <CoachOnly />;

  const v = t.video;
  const list = [...videos].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:py-14">
      <ModuleHeader
        eyebrow={sports[sport].name[locale]}
        title={v.title}
        body={v.body}
        actions={
          canEdit && (
            <Button onClick={() => setAdding(true)}>
              <Icon name="plus" className="size-5" />
              {v.add}
            </Button>
          )
        }
      />

      {list.length === 0 ? (
        <div className={cn(panel, "mt-10 p-8 text-center")}>
          <Icon name="video" className="mx-auto size-8 text-mist" />
          <p className="mx-auto mt-4 max-w-[30rem] text-chalk-dim">{canEdit ? v.empty : t.common.nothingYet}</p>
          <EditOnly>
            <Button className="mt-6" onClick={() => setAdding(true)}>
              {v.add}
            </Button>
          </EditOnly>
        </div>
      ) : (
        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((video) => {
            const source = parseVideoUrl(video.url)?.source ?? "link";
            const event = video.eventId ? events.find((e) => e.id === video.eventId) : null;
            return (
              <li key={video.id}>
                <a href={href(`/panel/video/${video.id}`)} className={cn(panel, "group flex h-full flex-col rounded-[var(--radius-card)] p-5 transition-colors hover:bg-night-800")}>
                  <span className="flex items-center gap-2 text-[0.82rem] font-semibold text-chalk-dim">
                    <Icon name={source === "link" ? "share" : "play"} className="size-3.5" />
                    {v.sources[source]}
                  </span>
                  <span className="mt-3 block text-[1.1rem] leading-snug font-semibold group-hover:underline">{video.title}</span>
                  {event && <span className="mt-1 block text-[0.88rem] text-mist">{`${day.format(parseDay(event.date))}, ${event.title}`}</span>}
                  <span className="mt-auto pt-4 text-[0.88rem] text-chalk-dim">{plural(locale, v.clipsCount, video.clips.length)}</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}

      {adding && canEdit && <VideoDialog video={null} events={events} workspaceId={workspace.id} onClose={() => setAdding(false)} />}
    </div>
  );
}
