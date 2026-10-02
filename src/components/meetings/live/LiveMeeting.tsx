"use client";

import { useState } from "react";
import { useApp, useHref } from "@/components/app/AppContext";
import { Button } from "@/components/app/ui";
import { useTeam } from "@/components/team/hooks";
import { CoachOnly } from "@/components/team/ui";
import { Icon } from "@/components/ui/Icon";
import { useAccount } from "@/data/account";
import { useEvents } from "@/data/calendar";
import { liveToken, startLive, useLiveMeetings } from "@/data/live";
import { useMeetings } from "@/data/meetings";
import { usePlaybooks } from "@/data/playbooks";
import { useHydrated } from "@/data/store";
import { emptyMeeting, invitedPlayers } from "@/domain/team/meeting";
import { PreJoin, type JoinChoices } from "./PreJoin";
import { LiveRoom, type LeaveReason } from "./Room";

type Phase = { kind: "lobby" } | { kind: "connecting" } | { kind: "room"; url: string; token: string; choices: JoinChoices } | { kind: "out"; reason: LeaveReason | "notConfigured" };

/** The live room of a calendar meeting, over the whole screen: start or join, then the call. */
export function LiveMeeting({ eventId }: { eventId: string }) {
  const { t } = useApp();
  const href = useHref();
  const hydrated = useHydrated();
  const { workspace, sport, roster } = useTeam();
  const { user, role, playerId } = useAccount();
  const events = useEvents(workspace?.id);
  const meetings = useMeetings(workspace?.id);
  const books = usePlaybooks(workspace?.id);
  const { live, loaded } = useLiveMeetings(workspace?.id);
  const [phase, setPhase] = useState<Phase>({ kind: "lobby" });
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  if (!workspace || !hydrated || !user || !loaded) return <div className="fixed inset-0 z-50 bg-night-950" aria-busy="true" />;
  if (!sport) return <CoachOnly />;

  const l = t.live;
  const event = events.find((e) => e.id === eventId);
  const back = href(`/panel/meetings/${eventId}`);
  const frame = (children: React.ReactNode) => (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-night-950 text-chalk">
      <a href={back} className="absolute top-3 left-3 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-[0.92rem] font-medium text-chalk-dim hover:text-chalk">
        <Icon name="chevronLeft" className="size-4" />
        {l.back}
      </a>
      <div className="grid min-h-dvh place-items-center pt-14">{children}</div>
    </div>
  );

  if (!event || event.kind !== "meeting") return frame(<p className="text-chalk-dim">{t.meetings.notFound}</p>);

  const meeting = meetings[eventId] ?? emptyMeeting(eventId);
  const invited = invitedPlayers(roster.players, meeting.groups, sport);
  const isCoach = role === "coach";
  const session = live[eventId];

  if (!isCoach && !invited.some((p) => p.id === playerId)) return frame(<p className="max-w-md px-6 text-center text-chalk-dim">{l.notInvited}</p>);

  // The session ending while in the room means the meeting ended: the live signal can arrive
  // before LiveKit's own notice that the room is gone.
  const out = phase.kind === "out" ? phase.reason : phase.kind === "room" && !session ? "ended" : null;

  if (phase.kind === "room" && session) {
    return (
      <div className="fixed inset-0 z-50 bg-night-950 text-chalk">
        <LiveRoom
          url={phase.url}
          token={phase.token}
          choices={phase.choices}
          title={event.title}
          liveMeetingId={session.id}
          workspaceId={workspace.id}
          eventId={eventId}
          isCoach={isCoach}
          roster={roster.players}
          invited={invited}
          meeting={meeting}
          books={books}
          onLeave={(reason) => setPhase({ kind: "out", reason })}
        />
      </div>
    );
  }

  if (out) {
    const text = out === "notConfigured" ? l.states.notConfigured : l.states[out];
    return frame(
      <div className="max-w-md px-6 text-center">
        <p className="text-[1.05rem]">{text}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {session && out !== "ended" && out !== "notConfigured" && <Button onClick={() => setPhase({ kind: "lobby" })}>{l.states.rejoin}</Button>}
          <a href={back} className="inline-flex h-11 items-center rounded-[0.7rem] px-5 font-semibold shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] hover:bg-chalk/6">
            {l.back}
          </a>
        </div>
      </div>,
    );
  }

  if (!session) {
    if (!isCoach) return frame(<p className="max-w-md px-6 text-center text-chalk-dim">{l.notStarted}</p>);
    return frame(
      <div className="max-w-md px-6 text-center">
        <p className="text-[0.9rem] font-semibold text-ice">{l.card}</p>
        <h1 className="display mt-2 text-[2.2rem] leading-none">{event.title}</h1>
        <p className="mt-3 text-chalk-dim">{l.cardBodyCoach}</p>
        <Button
          className="mt-6"
          disabled={starting}
          onClick={async () => {
            setStarting(true);
            setStartError(null);
            const result = await startLive(workspace.id, eventId);
            setStarting(false);
            if (!result.ok) setStartError(result.error === "not_configured" ? l.states.notConfigured : l.states.error);
            // The session arrives through the live signal.
          }}
        >
          <Icon name="broadcast" className="size-5" />
          {starting ? l.starting : l.start}
        </Button>
        {startError && (
          <p className="mt-3 text-[0.9rem] text-signal" role="alert">
            {startError}
          </p>
        )}
      </div>,
    );
  }

  return frame(
    <PreJoin
      title={event.title}
      name={user.name}
      busy={phase.kind === "connecting"}
      onJoin={async (choices) => {
        setPhase({ kind: "connecting" });
        const result = await liveToken(session.id);
        if (!result.ok) {
          setPhase({ kind: "out", reason: result.error === "not_configured" ? "notConfigured" : "error" });
          return;
        }
        setPhase({ kind: "room", url: result.data.url, token: result.data.token, choices });
      }}
    />,
  );
}
