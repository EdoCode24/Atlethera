"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp, useHref } from "@/components/app/AppContext";
import { Button, Dialog } from "@/components/app/ui";
import { Icon } from "@/components/ui/Icon";
import { endLive, startLive, type LiveMeeting } from "@/data/live";
import { cn } from "@/lib/cn";

/** On a meeting's page: start, join or end its live room. */
export function LiveCard({ workspaceId, eventId, session, isCoach, invited }: { workspaceId: string; eventId: string; session: LiveMeeting | undefined; isCoach: boolean; invited: boolean }) {
  const { t } = useApp();
  const href = useHref();
  const router = useRouter();
  const l = t.live;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const room = href(`/panel/meetings/${eventId}/live`);

  return (
    <section
      aria-labelledby="live-title"
      className={cn(
        "mt-8 flex flex-wrap items-center gap-x-6 gap-y-4 rounded-[var(--radius-card)] p-5",
        session ? "bg-signal/10 shadow-[inset_0_0_0_1px_rgb(255_106_61/0.4)]" : "bg-night-850 shadow-[inset_0_0_0_1px_var(--color-hairline)]",
      )}
    >
      <div className="min-w-0 flex-1 basis-60">
        <h2 id="live-title" className="flex items-center gap-2 font-semibold">
          {session ? <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-signal" /> : <Icon name="broadcast" className="size-4 text-ice" />}
          {session ? `${l.card}: ${l.badge}` : l.card}
        </h2>
        <p className="mt-1 text-[0.9rem] text-chalk-dim">{session ? l.cardBodyLive : isCoach ? l.cardBodyCoach : invited ? l.notStarted : l.notInvited}</p>
        {error && (
          <p className="mt-2 text-[0.88rem] text-signal" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {session && (isCoach || invited) && (
          <a href={room} className="inline-flex h-11 items-center gap-2 rounded-[0.7rem] bg-volt px-5 font-semibold text-night-950 hover:bg-volt-soft">
            <Icon name="camera" className="size-5" />
            {isCoach ? l.rejoin : l.join}
          </a>
        )}
        {!session && isCoach && (
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const result = await startLive(workspaceId, eventId);
              setBusy(false);
              if (result.ok) router.push(room);
              else setError(result.error === "not_configured" ? l.states.notConfigured : l.states.error);
            }}
          >
            <Icon name="broadcast" className="size-5" />
            {busy ? l.starting : l.start}
          </Button>
        )}
        {session && isCoach && (
          <Button
            variant="ghost"
            className="text-signal"
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            {l.endForAll}
          </Button>
        )}
      </div>
      {confirming && session && (
        <Dialog
          open
          onClose={() => setConfirming(false)}
          title={l.endForAll}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                {t.common.cancel}
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await endLive(session.id);
                  setBusy(false);
                  setConfirming(false);
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
    </section>
  );
}
