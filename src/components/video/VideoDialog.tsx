"use client";

import { useMemo, useState } from "react";
import { useApp, useHref } from "@/components/app/AppContext";
import { Button, Dialog, TextArea, TextField } from "@/components/app/ui";
import { Select } from "@/components/team/ui";
import { Icon } from "@/components/ui/Icon";
import { videoRepo } from "@/data/videos";
import { parseDay, type TeamEvent } from "@/domain/team/calendar";
import { parseVideoUrl, type Video } from "@/domain/team/video";
import { localeTags } from "@/i18n/config";
import { fill } from "@/lib/fill";

/** Adds a video by link, or edits one; film can be tied to a game or practice on the calendar. */
export function VideoDialog({ video, events, workspaceId, onClose }: { video: Video | null; events: TeamEvent[]; workspaceId: string; onClose: () => void }) {
  const { t, locale } = useApp();
  const href = useHref();
  const f = t.video.form;
  const [title, setTitle] = useState(video?.title ?? "");
  const [url, setUrl] = useState(video?.url ?? "");
  const [eventId, setEventId] = useState(video?.eventId ?? "");
  const [notes, setNotes] = useState(video?.notes ?? "");
  const [errors, setErrors] = useState<{ title?: string; url?: string }>({});
  const [confirming, setConfirming] = useState(false);
  const day = useMemo(() => new Intl.DateTimeFormat(localeTags[locale].intl, { day: "numeric", month: "short", year: "numeric" }), [locale]);
  // Games and practices, newest first: film usually follows the day it was shot.
  const options = events
    .filter((e) => e.kind === "game" || e.kind === "practice")
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((e) => ({ value: e.id, label: `${day.format(parseDay(e.date))}, ${e.title}` }));

  const save = () => {
    const next = { title: title.trim() ? undefined : f.errors.titleRequired, url: parseVideoUrl(url) ? undefined : f.errors.urlInvalid };
    if (next.title || next.url) {
      setErrors(next);
      return;
    }
    const input = { title, url, eventId: eventId || null, notes: notes.trim() };
    if (video) {
      videoRepo.update(workspaceId, video.id, (v) => ({ ...v, ...input, title: title.trim(), url: url.trim() }));
      onClose();
    } else {
      const added = videoRepo.add(workspaceId, input);
      window.location.assign(href(`/panel/video/${added.id}`));
    }
  };

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        onSubmit={save}
        wide
        title={video ? f.titleEdit : f.titleNew}
        footer={
          <>
            {video && (
              <Button variant="ghost" className="mr-auto text-signal" onClick={() => setConfirming(true)}>
                <Icon name="trash" className="size-[1.1rem]" />
                {f.deleteTitle}
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button type="submit">{video ? t.common.save : f.add}</Button>
          </>
        }
      >
        <div className="space-y-5">
          <TextField
            label={f.title}
            placeholder={f.titlePlaceholder}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setErrors((x) => ({ ...x, title: undefined }));
            }}
            error={errors.title}
            autoComplete="off"
            autoFocus
          />
          <TextField
            label={f.url}
            type="url"
            placeholder="https://"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setErrors((x) => ({ ...x, url: undefined }));
            }}
            error={errors.url}
            hint={f.urlHint}
            autoComplete="off"
          />
          <Select label={f.event} value={eventId} onChange={setEventId} options={[{ value: "", label: f.noEvent }, ...options]} />
          <TextArea label={f.notes} value={notes} onChange={setNotes} />
        </div>
      </Dialog>
      {video && (
        <Dialog
          open={confirming}
          onClose={() => setConfirming(false)}
          title={f.deleteTitle}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                {t.common.cancel}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  videoRepo.remove(workspaceId, video.id);
                  window.location.assign(href("/panel/video"));
                }}
              >
                {t.common.delete}
              </Button>
            </>
          }
        >
          <p className="text-chalk-dim">{fill(f.deleteConfirm, { title: video.title })}</p>
        </Dialog>
      )}
    </>
  );
}
