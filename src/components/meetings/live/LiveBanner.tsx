"use client";

import { usePathname } from "next/navigation";
import { useApp, useHref } from "@/components/app/AppContext";
import { useAccount } from "@/data/account";
import { useEvents } from "@/data/calendar";
import { useLiveMeetings } from "@/data/live";
import { useMeetings } from "@/data/meetings";
import { useRoster } from "@/data/roster";
import { invitedPlayers } from "@/domain/team/meeting";
import { fill } from "@/lib/fill";

/** Across the panel: a meeting that is live now, for everyone it is for, one tap from joining. */
export function LiveBanner() {
  const { t } = useApp();
  const href = useHref();
  const pathname = usePathname();
  const { workspace, role, playerId } = useAccount();
  const { live } = useLiveMeetings(workspace?.id);
  const events = useEvents(workspace?.id);
  const meetings = useMeetings(workspace?.id);
  const roster = useRoster(workspace?.id);
  const sport = workspace?.sport ?? null;
  if (!sport) return null;

  const now = Object.values(live)
    .map((s) => events.find((e) => e.id === s.eventId && e.kind === "meeting"))
    .filter((e) => e !== undefined)
    .filter((e) => role === "coach" || invitedPlayers(roster.players, meetings[e.id]?.groups ?? [], sport).some((p) => p.id === playerId))
    // Not on the page that is already the room.
    .filter((e) => !pathname.endsWith(`/meetings/${e.id}/live`));
  if (!now.length) return null;

  return (
    <div role="status" className="border-b border-signal/30 bg-signal/10">
      {now.map((e) => (
        <div key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 sm:px-8">
          <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-signal" />
          <span className="min-w-0 flex-1 truncate text-[0.92rem] font-semibold">{fill(t.live.banner, { title: e.title })}</span>
          <a href={href(`/panel/meetings/${e.id}/live`)} className="inline-flex h-9 items-center rounded-[0.6rem] bg-volt px-4 text-[0.88rem] font-semibold text-night-950 hover:bg-volt-soft">
            {role === "coach" ? t.live.rejoin : t.live.bannerJoin}
          </a>
        </div>
      ))}
    </div>
  );
}
