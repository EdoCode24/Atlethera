"use client";

import { useRef, useState } from "react";
import { EditOnly, useCanEdit } from "@/components/app/access";
import { useApp, useHref } from "@/components/app/AppContext";
import { Button, IconButton } from "@/components/app/ui";
import { LinkedPlays, bare } from "@/components/practice/parts";
import { PlayPicker } from "@/components/practice/PlayPicker";
import { useTeam } from "@/components/team/hooks";
import { CoachOnly, Select, panel } from "@/components/team/ui";
import { Icon } from "@/components/ui/Icon";
import { useEvents } from "@/data/calendar";
import { usePlaybooks } from "@/data/playbooks";
import { useHydrated } from "@/data/store";
import { videoRepo, useVideos } from "@/data/videos";
import { parseDay } from "@/domain/team/calendar";
import { fullName, sortPlayers } from "@/domain/team/roster";
import { formatTime, parseTime, parseVideoUrl, sortClips, type Clip } from "@/domain/team/video";
import { localeTags } from "@/i18n/config";
import { fill } from "@/lib/fill";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/plural";
import { VideoDialog } from "./VideoDialog";
import { VideoPlayer, type PlayerHandle } from "./VideoPlayer";

/** Where to start: `?t=83` from a clip link elsewhere (the profile). */
function startFromUrl(): number {
  if (typeof window === "undefined") return 0;
  const t = Number(new URLSearchParams(window.location.search).get("t"));
  return Number.isFinite(t) && t > 0 ? t : 0;
}

export function VideoPage({ videoId }: { videoId: string }) {
  const { t, locale } = useApp();
  const href = useHref();
  const hydrated = useHydrated();
  const { workspace, sport, roster } = useTeam();
  const events = useEvents(workspace?.id);
  const videos = useVideos(workspace?.id);
  const books = usePlaybooks(workspace?.id);
  const player = useRef<PlayerHandle>(null);
  const [start] = useState(startFromUrl);
  const [hasTime, setHasTime] = useState(false);
  const [time, setTime] = useState("");
  const [label, setLabel] = useState("");
  const [timeError, setTimeError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  const canEdit = useCanEdit();

  if (!workspace || !hydrated) return null;
  if (!sport) return <CoachOnly />;

  const v = t.video;
  const back = (
    <a href={href("/panel/video")} className="inline-flex min-h-11 items-center gap-1.5 text-[0.92rem] font-medium text-chalk-dim hover:text-chalk">
      <Icon name="chevronLeft" className="size-4" />
      {v.back}
    </a>
  );
  const video = videos.find((x) => x.id === videoId);
  const parsed = video ? parseVideoUrl(video.url) : null;
  if (!video || !parsed) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 lg:py-14">
        {back}
        <p className="mt-8 text-chalk-dim">{v.notFound}</p>
      </div>
    );
  }

  const event = video.eventId ? events.find((e) => e.id === video.eventId) : null;
  const clips = sortClips(video.clips);
  const playable = parsed.source !== "link";
  const setClip = (id: string, patch: Partial<Clip>) => videoRepo.update(workspace.id, video.id, (x) => ({ ...x, clips: x.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const players = sortPlayers(
    roster.players.filter((p) => p.status !== "inactive"),
    sport,
    "number",
    locale,
  );
  const pickingClip = clips.find((c) => c.id === picking);

  const addClip = () => {
    const at = parseTime(time);
    if (at === null) {
      setTimeError(true);
      return;
    }
    videoRepo.addClip(workspace.id, video.id, { at, label: label.trim() || v.newClip, note: "", playerIds: [], plays: [] });
    setTime("");
    setLabel("");
  };

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:py-14">
      {back}

      <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[0.9rem] font-semibold text-volt">{v.sources[parsed.source]}</p>
          <h1 className="display mt-2 text-display-md">{video.title}</h1>
          {event && (
            <p className="mt-3 text-chalk-dim">
              {`${new Intl.DateTimeFormat(localeTags[locale].intl, { day: "numeric", month: "long", year: "numeric" }).format(parseDay(event.date))}, ${event.title}`}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!playable && (
            <a href={video.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-[0.7rem] bg-volt px-5 font-semibold text-night-950 hover:bg-volt-soft">
              <Icon name="share" className="size-[1.1rem]" />
              {v.openLink}
            </a>
          )}
          <EditOnly>
            <Button variant="ghost" onClick={() => setEditing(true)}>
              <Icon name="pencil" className="size-[1.1rem]" />
              {v.edit}
            </Button>
          </EditOnly>
        </div>
      </div>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="lg:sticky lg:top-6">
          {playable ? (
            <VideoPlayer ref={player} parsed={parsed} url={video.url} title={video.title} start={start} onTime={() => setHasTime(true)} />
          ) : (
            <p className={cn(panel, "rounded-[var(--radius-card)] p-6 text-chalk-dim")}>{v.linkOnly}</p>
          )}
          {video.notes && <p className="mt-4 text-[0.95rem] whitespace-pre-line text-chalk-dim">{video.notes}</p>}
        </div>

        <section aria-labelledby="clips-title" className={cn(panel, "rounded-[var(--radius-card)] p-4 sm:p-5")}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="clips-title" className="text-[1.05rem] font-semibold">
              {v.clips}
            </h2>
            <span className="text-[0.85rem] text-mist">{plural(locale, v.clipsCount, clips.length)}</span>
          </div>

          {canEdit && (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              addClip();
            }}
            className="mt-3 space-y-2 rounded-[0.9rem] bg-night-900 p-3 shadow-[inset_0_0_0_1px_var(--color-hairline)]"
          >
            <div className="flex gap-2">
              <label className="w-24 shrink-0">
                <span className="sr-only">{v.time}</span>
                <input
                  value={time}
                  inputMode="numeric"
                  placeholder="12:45"
                  aria-invalid={timeError || undefined}
                  aria-describedby="clip-time-hint"
                  onChange={(e) => {
                    setTime(e.target.value);
                    setTimeError(false);
                  }}
                  className={cn(
                    "tabular h-11 w-full rounded-[0.6rem] bg-night-950/70 px-3 text-chalk outline-none placeholder:text-mist/60",
                    timeError ? "shadow-[inset_0_0_0_1.5px_var(--color-signal)]" : "shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] focus:shadow-[inset_0_0_0_1.5px_var(--color-chalk)]",
                  )}
                />
              </label>
              {playable && (
                <Button
                  variant="ghost"
                  className="h-11 px-3 text-[0.85rem]"
                  disabled={!hasTime}
                  onClick={() => {
                    const now = player.current?.time();
                    if (now !== null && now !== undefined) {
                      setTime(formatTime(now));
                      setTimeError(false);
                    }
                  }}
                >
                  {v.currentTime}
                </Button>
              )}
            </div>
            <p id="clip-time-hint" className={cn("text-[0.8rem]", timeError ? "text-signal" : "text-mist")}>
              {timeError ? v.timeInvalid : v.timeHint}
            </p>
            <label className="block">
              <span className="sr-only">{v.label}</span>
              <input
                value={label}
                placeholder={v.labelPlaceholder}
                onChange={(e) => setLabel(e.target.value)}
                className="h-11 w-full rounded-[0.6rem] bg-night-950/70 px-3 text-chalk shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] outline-none placeholder:text-mist/60 focus:shadow-[inset_0_0_0_1.5px_var(--color-chalk)]"
              />
            </label>
            <Button type="submit" className="h-10 w-full text-[0.9rem]">
              <Icon name="plus" className="size-4" />
              {v.addClip}
            </Button>
          </form>
          )}

          {clips.length === 0 ? (
            <p className="mt-4 text-[0.92rem] text-mist">{canEdit ? v.noClips : t.common.nothingYet}</p>
          ) : (
            <ol className="mt-4 space-y-2">
              {clips.map((clip) => {
                const tagged = clip.playerIds.map((id) => roster.players.find((p) => p.id === id)).filter((p) => p !== undefined);
                const untagged = players.filter((p) => !clip.playerIds.includes(p.id));
                return (
                  <li key={clip.id} id={`clip-${clip.id}`} className="rounded-[0.9rem] p-2.5 shadow-[inset_0_0_0_1px_var(--color-hairline)]">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!playable}
                        onClick={() => player.current?.seek(clip.at)}
                        aria-label={fill(v.jumpTo, { time: formatTime(clip.at) })}
                        className="tabular inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[0.55rem] bg-volt/15 px-2.5 text-[0.88rem] font-semibold text-volt transition-colors hover:bg-volt/25 disabled:bg-chalk/8 disabled:text-chalk-dim"
                      >
                        {playable && <Icon name="play" className="size-3" />}
                        {formatTime(clip.at)}
                      </button>
                      {canEdit ? (
                        <>
                          <label className="min-w-0 flex-1">
                            <span className="sr-only">{v.label}</span>
                            <input value={clip.label} onChange={(e) => setClip(clip.id, { label: e.target.value })} className={cn(bare, "h-9 font-semibold")} />
                          </label>
                          <IconButton label={v.removeClip} onClick={() => videoRepo.update(workspace.id, video.id, (x) => ({ ...x, clips: x.clips.filter((c) => c.id !== clip.id) }))} className="size-9 hover:text-signal">
                            <Icon name="trash" className="size-4" />
                          </IconButton>
                        </>
                      ) : (
                        <span className="min-w-0 flex-1 px-2 font-semibold">{clip.label}</span>
                      )}
                    </div>
                    {canEdit ? (
                      <label className="mt-1 block">
                        <span className="sr-only">{v.note}</span>
                        <textarea rows={1} value={clip.note} placeholder={v.note} onChange={(e) => setClip(clip.id, { note: e.target.value })} className={cn(bare, "resize-y py-1.5 text-[0.9rem]")} />
                      </label>
                    ) : (
                      clip.note && <p className="mt-1 px-2 text-[0.9rem] whitespace-pre-line text-chalk-dim">{clip.note}</p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 px-2">
                      {tagged.map((p) => (
                        <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-chalk/8 py-0.5 pr-1 pl-2.5 text-[0.8rem] font-semibold">
                          {p.number !== null ? `${p.number} ` : ""}
                          {fullName(p)}
                          {canEdit ? (
                            <button type="button" aria-label={fill(v.untag, { name: fullName(p) })} onClick={() => setClip(clip.id, { playerIds: clip.playerIds.filter((id) => id !== p.id) })} className="grid size-6 place-items-center rounded-full text-mist hover:text-chalk">
                              <Icon name="close" className="size-3" />
                            </button>
                          ) : (
                            <span className="w-1.5" />
                          )}
                        </span>
                      ))}
                      {canEdit && untagged.length > 0 && (
                        <Select
                          hideLabel
                          label={`${v.tagPlayer}: ${clip.label}`}
                          value=""
                          onChange={(id) => id && setClip(clip.id, { playerIds: [...clip.playerIds, id] })}
                          options={[{ value: "", label: `${v.tagPlayer}…` }, ...untagged.map((p) => ({ value: p.id, label: `${p.number ?? "–"}  ${fullName(p)}` }))]}
                          className="w-44"
                        />
                      )}
                    </div>
                    <div className="mt-2">
                      <LinkedPlays plays={clip.plays} books={books} onChange={(plays) => setClip(clip.id, { plays })} onPick={() => setPicking(clip.id)} />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      {editing && canEdit && <VideoDialog video={video} events={events} workspaceId={workspace.id} onClose={() => setEditing(false)} />}
      {pickingClip && canEdit && <PlayPicker books={books} selected={pickingClip.plays} onClose={() => setPicking(null)} onPick={(plays) => setClip(pickingClip.id, { plays })} />}
    </div>
  );
}
