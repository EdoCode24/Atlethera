"use client";

import {
  RoomAudioRenderer,
  RoomContext,
  VideoTrack,
  isTrackReference,
  useAudioPlayback,
  useChat,
  useConnectionState,
  useIsMuted,
  useIsSpeaking,
  useParticipants,
  useRoomContext,
  useSequentialRoomConnectDisconnect,
  useTrackToggle,
  useTracks,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { ConnectionState, DisconnectReason, Room, RoomEvent, Track, VideoPresets, type LocalVideoTrack, type Participant } from "livekit-client";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useApp, useHref } from "@/components/app/AppContext";
import { Button, Dialog } from "@/components/app/ui";
import { resolvePlay } from "@/components/practice/parts";
import { Icon, type IconName } from "@/components/ui/Icon";
import { endLive, meetingJoins } from "@/data/live";
import { meetingRepo } from "@/data/meetings";
import type { Playbook } from "@/domain/playbook/types";
import type { Meeting } from "@/domain/team/meeting";
import { fullName, type Player } from "@/domain/team/roster";
import { fill } from "@/lib/fill";
import { cn } from "@/lib/cn";
import type { JoinChoices } from "./PreJoin";

export type LeaveReason = "left" | "ended" | "duplicate" | "error";

interface Meta {
  role?: "coach" | "player";
  playerId?: string | null;
}

function metaOf(p: Participant): Meta {
  try {
    return p.metadata ? (JSON.parse(p.metadata) as Meta) : {};
  } catch {
    return {};
  }
}

const noChanges = () => () => {};

/** A LiveKit room for one live meeting: connect, show everyone, and leave cleanly. */
export function LiveRoom({
  url,
  token,
  choices,
  title,
  liveMeetingId,
  workspaceId,
  eventId,
  isCoach,
  roster,
  invited,
  meeting,
  books,
  onLeave,
}: {
  url: string;
  token: string;
  choices: JoinChoices;
  title: string;
  liveMeetingId: string;
  workspaceId: string;
  eventId: string;
  isCoach: boolean;
  roster: Player[];
  invited: Player[];
  meeting: Meeting;
  books: Playbook[];
  onLeave: (reason: LeaveReason) => void;
}) {
  const [room] = useState(() => new Room({ adaptiveStream: true, dynacast: true, videoCaptureDefaults: { resolution: VideoPresets.h540.resolution } }));
  const { connect, disconnect } = useSequentialRoomConnectDisconnect(room);
  // Read at connect time: the connection is made once per token.
  const latest = useRef({ choices, onLeave });
  useEffect(() => {
    latest.current = { choices, onLeave };
  });

  useEffect(() => {
    let cancelled = false;
    const onDisconnected = (reason?: DisconnectReason) => {
      if (cancelled) return;
      const leave = latest.current.onLeave;
      if (reason === DisconnectReason.ROOM_DELETED) leave("ended");
      else if (reason === DisconnectReason.DUPLICATE_IDENTITY) leave("duplicate");
      else if (reason !== DisconnectReason.CLIENT_INITIATED) leave("error");
    };
    room.on(RoomEvent.Disconnected, onDisconnected);
    void connect(url, token)
      .then(async () => {
        if (cancelled) return;
        const { choices: start } = latest.current;
        await room.localParticipant.setCameraEnabled(start.camera).catch(() => {});
        await room.localParticipant.setMicrophoneEnabled(start.microphone).catch(() => {});
      })
      .catch(() => {
        if (!cancelled) latest.current.onLeave("error");
      });
    return () => {
      cancelled = true;
      room.off(RoomEvent.Disconnected, onDisconnected);
      void disconnect();
    };
  }, [room, url, token, connect, disconnect]);

  return (
    <RoomContext.Provider value={room}>
      <RoomAudioRenderer />
      {isCoach && <AutoAttendance workspaceId={workspaceId} eventId={eventId} liveMeetingId={liveMeetingId} invited={invited} />}
      <RoomLayout title={title} liveMeetingId={liveMeetingId} isCoach={isCoach} roster={roster} invited={invited} meeting={meeting} books={books} onLeave={onLeave} />
    </RoomContext.Provider>
  );
}

// ── Attendance ─────────────────────────────────────────────────────────────

/** In the coach's browser: invited players who join are marked present (if not marked yet). */
function AutoAttendance({ workspaceId, eventId, liveMeetingId, invited }: { workspaceId: string; eventId: string; liveMeetingId: string; invited: Player[] }) {
  const room = useRoomContext();
  // Keyed by the ids, not the array: the parent builds a new array on every render.
  const invitedKey = invited.map((p) => p.id).join(",");
  const invitedIds = useMemo(() => new Set(invitedKey.split(",").filter(Boolean)), [invitedKey]);
  useEffect(() => {
    const mark = (ids: (string | null | undefined)[]) => {
      const fresh = ids.filter((id): id is string => !!id && invitedIds.has(id));
      if (!fresh.length) return;
      meetingRepo.update(workspaceId, eventId, (m) => {
        const unmarked = fresh.filter((id) => !m.attendance[id]);
        if (!unmarked.length) return m;
        return { ...m, attendance: { ...m.attendance, ...Object.fromEntries(unmarked.map((id) => [id, "present" as const])) } };
      });
    };
    // Players who came while the coach was away, and those in the room now.
    void meetingJoins(liveMeetingId).then(mark);
    mark([...room.remoteParticipants.values()].map((p) => metaOf(p).playerId));
    const onJoin = (p: Participant) => mark([metaOf(p).playerId]);
    room.on(RoomEvent.ParticipantConnected, onJoin);
    return () => {
      room.off(RoomEvent.ParticipantConnected, onJoin);
    };
  }, [room, workspaceId, eventId, liveMeetingId, invitedIds]);
  return null;
}

// ── Layout ─────────────────────────────────────────────────────────────────

type Panel = "chat" | "people" | "agenda" | null;

function RoomLayout({
  title,
  liveMeetingId,
  isCoach,
  roster,
  invited,
  meeting,
  books,
  onLeave,
}: {
  title: string;
  liveMeetingId: string;
  isCoach: boolean;
  roster: Player[];
  invited: Player[];
  meeting: Meeting;
  books: Playbook[];
  onLeave: (reason: LeaveReason) => void;
}) {
  const { t } = useApp();
  const l = t.live;
  const room = useRoomContext();
  const state = useConnectionState();
  const { canPlayAudio, startAudio } = useAudioPlayback(room);
  const participants = useParticipants();
  const chat = useChat();
  const [panel, setPanel] = useState<Panel>(null);
  const [seen, setSeen] = useState(0);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const unread = panel === "chat" ? 0 : Math.max(0, chat.chatMessages.length - seen);
  // Leaving the chat counts everything in it as read.
  const choosePanel = (next: Panel) => {
    if (panel === "chat") setSeen(chat.chatMessages.length);
    setPanel(next);
  };

  const leave = () => {
    void room.disconnect();
    onLeave("left");
  };

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-hairline px-4">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-signal/15 px-2 py-1 text-[0.75rem] font-bold text-signal">
          <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-signal" />
          {l.badge}
        </span>
        <h1 className="min-w-0 flex-1 truncate font-semibold">{title}</h1>
        <span className="inline-flex items-center gap-1.5 text-[0.85rem] text-chalk-dim" data-testid="participant-count">
          <Icon name="team" className="size-4" />
          {participants.length}
        </span>
      </header>

      {state === ConnectionState.Reconnecting && (
        <p role="status" className="bg-amber/15 px-4 py-2 text-center text-[0.88rem] text-amber">
          {l.reconnecting}
        </p>
      )}
      {!canPlayAudio && (
        <p className="bg-ice/10 px-4 py-2 text-center text-[0.88rem]">
          <button type="button" onClick={() => void startAudio()} className="font-semibold text-ice underline underline-offset-2">
            {l.startAudio}
          </button>
        </p>
      )}

      <div className="flex min-h-0 flex-1">
        <Stage roster={roster} />
        {panel && (
          <aside
            aria-label={panel === "chat" ? l.controls.chat : panel === "people" ? l.controls.people : l.controls.agenda}
            className="fixed inset-x-0 bottom-0 z-20 flex max-h-[70dvh] flex-col rounded-t-[var(--radius-card)] border-t border-hairline bg-night-900 md:static md:max-h-none md:w-[22rem] md:rounded-none md:border-t-0 md:border-l"
          >
            <div className="flex items-center justify-between border-b border-hairline px-4 py-2">
              <p className="font-semibold">{panel === "chat" ? l.controls.chat : panel === "people" ? l.controls.people : l.controls.agenda}</p>
              <button type="button" onClick={() => choosePanel(null)} aria-label={l.controls.close} className="grid size-10 place-items-center rounded-md text-mist hover:text-chalk">
                <Icon name="close" className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {panel === "chat" && <ChatPanel chat={chat} />}
              {panel === "people" && <PeoplePanel participants={participants} invited={invited} isCoach={isCoach} />}
              {panel === "agenda" && <AgendaPanel meeting={meeting} books={books} />}
            </div>
          </aside>
        )}
      </div>

      <ControlBar
        panel={panel}
        onPanel={(p) => choosePanel(panel === p ? null : p)}
        unread={unread}
        isCoach={isCoach}
        onLeave={leave}
        onEnd={() => setConfirmEnd(true)}
      />

      {confirmEnd && (
        <Dialog
          open
          onClose={() => setConfirmEnd(false)}
          title={l.endForAll}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmEnd(false)}>
                {t.common.cancel}
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  setConfirmEnd(false);
                  await endLive(liveMeetingId);
                  void room.disconnect();
                  onLeave("ended");
                }}
              >
                {l.endForAll}
              </Button>
            </>
          }
        >
          <p className="text-chalk-dim">{l.endConfirm}</p>
        </Dialog>
      )}
    </div>
  );
}

// ── Stage and tiles ────────────────────────────────────────────────────────

function Stage({ roster }: { roster: Player[] }) {
  const { t } = useApp();
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const shares = tracks.filter((tr) => tr.source === Track.Source.ScreenShare && isTrackReference(tr));
  const cameras = tracks.filter((tr) => tr.source === Track.Source.Camera);
  const n = cameras.length;
  // Two people stack on a phone, like Meet: side by side the tiles get too small.
  const cols = n <= 1 ? "grid-cols-1" : n === 2 ? "grid-cols-1 sm:grid-cols-2" : n <= 4 ? "grid-cols-2" : n <= 9 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";

  if (shares.length) {
    const share = shares[0];
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-3 lg:flex-row" data-layout="focus">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-[1rem] bg-black">
          {isTrackReference(share) && <VideoTrack trackRef={share} className="size-full object-contain" data-testid="screen-share" />}
          <p className="absolute top-2 left-2 rounded-md bg-night-950/75 px-2 py-1 text-[0.8rem] font-semibold">
            {fill(t.live.sharing, { name: share.participant.name || share.participant.identity })}
          </p>
        </div>
        <div className="flex shrink-0 gap-2 overflow-x-auto lg:w-56 lg:flex-col lg:overflow-y-auto">
          {cameras.map((tr) => (
            <div key={`${tr.participant.identity}-cam`} className="w-40 shrink-0 lg:w-full">
              <Tile trackRef={tr} roster={roster} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1 overflow-y-auto p-3" data-layout="grid">
      <div className={cn("mx-auto grid max-w-6xl content-center gap-3", cols, n <= 2 && "h-full")}>
        {cameras.map((tr) => (
          <Tile key={`${tr.participant.identity}-cam`} trackRef={tr} roster={roster} />
        ))}
      </div>
    </div>
  );
}

function Tile({ trackRef, roster }: { trackRef: TrackReferenceOrPlaceholder; roster: Player[] }) {
  const { t } = useApp();
  const participant = trackRef.participant;
  const speaking = useIsSpeaking(participant);
  const micMuted = useIsMuted({ participant, source: Track.Source.Microphone });
  const camMuted = useIsMuted(trackRef);
  const meta = metaOf(participant);
  const player = meta.playerId ? roster.find((p) => p.id === meta.playerId) : undefined;
  const name = participant.name || participant.identity;
  const videoOn = isTrackReference(trackRef) && !camMuted;
  return (
    <div
      data-identity={participant.identity}
      data-video-on={videoOn || undefined}
      data-speaking={speaking || undefined}
      className={cn(
        "relative aspect-video overflow-hidden rounded-[1rem] bg-night-850 transition-shadow",
        speaking ? "shadow-[inset_0_0_0_2.5px_var(--color-volt)]" : "shadow-[inset_0_0_0_1px_var(--color-hairline)]",
      )}
    >
      {videoOn && isTrackReference(trackRef) ? (
        <VideoTrack trackRef={trackRef} className={cn("size-full object-cover", participant.isLocal && "-scale-x-100")} />
      ) : (
        <div className="grid size-full place-items-center">
          <span className="display grid size-11 place-items-center rounded-full bg-chalk/10 text-[1.15rem] sm:size-16 sm:text-[1.6rem]">{player?.number ?? name.slice(0, 1).toLocaleUpperCase()}</span>
        </div>
      )}
      <p className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-md bg-night-950/75 px-2 py-1 text-[0.8rem] font-semibold">
        {micMuted && <Icon name="micOff" className="size-3.5 shrink-0 text-signal" aria-label={t.live.muted} />}
        <span className="truncate">{player ? fullName(player) : name}</span>
        {participant.isLocal && <span className="shrink-0 text-mist">{`(${t.live.you})`}</span>}
        {meta.role === "coach" && <span className="shrink-0 rounded bg-volt px-1 text-[0.68rem] text-night-950">{t.live.coach}</span>}
      </p>
    </div>
  );
}

// ── Controls ───────────────────────────────────────────────────────────────

function ControlButton({ icon, label, active, danger, onClick, badge, pressed }: { icon: IconName; label: string; active?: boolean; danger?: boolean; onClick: () => void; badge?: number; pressed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={cn(
        "relative grid size-12 place-items-center rounded-full transition-colors",
        danger ? "bg-signal text-night-950 hover:bg-signal/85" : active ? "bg-chalk text-night-950" : "bg-night-800 text-chalk hover:bg-night-700",
      )}
    >
      <Icon name={icon} className="size-5" />
      {!!badge && <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-volt px-1 text-[0.7rem] font-bold text-night-950">{badge}</span>}
    </button>
  );
}

function ControlBar({ panel, onPanel, unread, isCoach, onLeave, onEnd }: { panel: Panel; onPanel: (p: Exclude<Panel, null>) => void; unread: number; isCoach: boolean; onLeave: () => void; onEnd: () => void }) {
  const { t } = useApp();
  const c = t.live.controls;
  const room = useRoomContext();
  const mic = useTrackToggle({ source: Track.Source.Microphone });
  const cam = useTrackToggle({ source: Track.Source.Camera });
  const share = useTrackToggle({ source: Track.Source.ScreenShare, captureOptions: { audio: true } });
  // Phones and some browsers can't share a screen: no button rather than an error.
  const canShare = useSyncExternalStore(noChanges, () => typeof navigator.mediaDevices?.getDisplayMedia === "function", () => false);
  const touch = useSyncExternalStore(noChanges, () => window.matchMedia("(pointer: coarse)").matches, () => false);
  const [facing, setFacing] = useState<"user" | "environment">("user");

  const flip = async () => {
    const next = facing === "user" ? "environment" : "user";
    const track = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track as LocalVideoTrack | undefined;
    await track?.restartTrack({ facingMode: next }).catch(() => {});
    setFacing(next);
  };

  return (
    <nav aria-label={t.live.card} className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-t border-hairline px-3 py-3">
      <ControlButton icon={mic.enabled ? "mic" : "micOff"} label={mic.enabled ? c.micOn : c.micOff} active={mic.enabled} pressed={mic.enabled} onClick={() => void mic.toggle()} />
      <ControlButton icon={cam.enabled ? "camera" : "cameraOff"} label={cam.enabled ? c.camOn : c.camOff} active={cam.enabled} pressed={cam.enabled} onClick={() => void cam.toggle()} />
      {touch && cam.enabled && <ControlButton icon="flipCamera" label={c.flip} onClick={() => void flip()} />}
      {canShare && <ControlButton icon="screen" label={share.enabled ? c.shareOn : c.shareOff} active={share.enabled} pressed={share.enabled} onClick={() => void share.toggle().catch(() => {})} />}
      <span className="mx-1 hidden h-8 w-px bg-hairline sm:block" />
      <ControlButton icon="chat" label={c.chat} active={panel === "chat"} pressed={panel === "chat"} badge={unread} onClick={() => onPanel("chat")} />
      <ControlButton icon="team" label={c.people} active={panel === "people"} pressed={panel === "people"} onClick={() => onPanel("people")} />
      <ControlButton icon="program" label={c.agenda} active={panel === "agenda"} pressed={panel === "agenda"} onClick={() => onPanel("agenda")} />
      <span className="mx-1 hidden h-8 w-px bg-hairline sm:block" />
      <ControlButton icon="leave" label={c.leave} danger onClick={onLeave} />
      {isCoach && (
        <Button variant="ghost" className="h-12 rounded-full px-4 text-[0.88rem] text-signal" onClick={onEnd}>
          {t.live.endForAll}
        </Button>
      )}
    </nav>
  );
}

// ── Side panels ────────────────────────────────────────────────────────────

function ChatPanel({ chat }: { chat: ReturnType<typeof useChat> }) {
  const { t } = useApp();
  const [text, setText] = useState("");
  const time = useMemo(() => new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }), []);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const message = text.trim();
    if (!message) return;
    setText("");
    await chat.send(message).catch(() => setText(message));
  };
  return (
    <div className="flex h-full min-h-[16rem] flex-col">
      <ol className="flex-1 space-y-3 p-4" aria-live="polite">
        {chat.chatMessages.length === 0 && <li className="text-[0.9rem] text-mist">{t.live.chat.empty}</li>}
        {chat.chatMessages.map((m) => (
          <li key={`${m.timestamp}-${m.from?.identity ?? ""}`}>
            <p className="text-[0.78rem] text-mist">
              <span className="font-semibold text-chalk-dim">{m.from?.isLocal ? t.live.you : m.from?.name || m.from?.identity}</span> {time.format(new Date(m.timestamp))}
            </p>
            <p className="mt-0.5 text-[0.92rem] break-words whitespace-pre-line">{m.message}</p>
          </li>
        ))}
      </ol>
      <form onSubmit={submit} className="flex gap-2 border-t border-hairline p-3">
        <label className="min-w-0 flex-1">
          <span className="sr-only">{t.live.chat.placeholder}</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.live.chat.placeholder}
            maxLength={500}
            className="h-11 w-full rounded-[0.7rem] bg-night-950/70 px-3 text-chalk shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] outline-none focus:shadow-[inset_0_0_0_1.5px_var(--color-chalk)]"
          />
        </label>
        <Button type="submit" className="h-11 px-4" disabled={chat.isSending || !text.trim()}>
          {t.live.chat.send}
        </Button>
      </form>
    </div>
  );
}

function PeoplePanel({ participants, invited, isCoach }: { participants: Participant[]; invited: Player[]; isCoach: boolean }) {
  const { t } = useApp();
  const here = new Set(participants.map((p) => metaOf(p).playerId).filter(Boolean));
  const missing = invited.filter((p) => !here.has(p.id));
  return (
    <div className="space-y-5 p-4">
      <section>
        <h3 className="text-[0.82rem] font-medium text-mist">{fill(t.live.people.here, { n: participants.length })}</h3>
        <ul className="mt-2 space-y-1.5">
          {participants.map((p) => (
            <li key={p.identity} className="flex items-center gap-2 text-[0.92rem]">
              <Icon name={p.isMicrophoneEnabled ? "mic" : "micOff"} className={cn("size-4", p.isMicrophoneEnabled ? "text-volt" : "text-mist")} />
              <span className="min-w-0 flex-1 truncate">{p.name || p.identity}</span>
              {p.isLocal && <span className="text-[0.8rem] text-mist">{t.live.you}</span>}
              {metaOf(p).role === "coach" && <span className="rounded bg-volt px-1 text-[0.68rem] font-semibold text-night-950">{t.live.coach}</span>}
            </li>
          ))}
        </ul>
      </section>
      {isCoach && missing.length > 0 && (
        <section>
          <h3 className="text-[0.82rem] font-medium text-mist">{fill(t.live.people.missing, { n: missing.length })}</h3>
          <ul className="mt-2 space-y-1 text-[0.9rem] text-chalk-dim">
            {missing.map((p) => (
              <li key={p.id}>{`${p.number !== null ? `${p.number} ` : ""}${fullName(p)}`}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function AgendaPanel({ meeting, books }: { meeting: Meeting; books: Playbook[] }) {
  const { t } = useApp();
  const href = useHref();
  if (!meeting.agenda.length) return <p className="p-4 text-[0.9rem] text-mist">{t.live.agendaEmpty}</p>;
  return (
    <ol className="space-y-4 p-4">
      {meeting.agenda.map((item, i) => (
        <li key={item.id}>
          <p className="font-semibold">
            <span className="mr-2 text-mist">{i + 1}</span>
            {item.title}
          </p>
          {item.notes && <p className="mt-1 text-[0.88rem] whitespace-pre-line text-chalk-dim">{item.notes}</p>}
          {item.plays.length > 0 && (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {item.plays.map((ref) => {
                const found = resolvePlay(books, ref);
                return (
                  found && (
                    <li key={`${ref.playbookId}/${ref.playId}`}>
                      {/* A new tab, so opening a play doesn't leave the call. */}
                      <a href={href(`/panel/playbook/${ref.playbookId}/${ref.playId}`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md bg-chalk/8 px-2 py-1 text-[0.8rem] font-semibold hover:bg-chalk/12">
                        <Icon name="playbook" className="size-3.5" />
                        {found.play.name}
                      </a>
                    </li>
                  )
                );
              })}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}
