"use client";

import { useState, type ReactNode } from "react";
import { useApp, useHref } from "@/components/app/AppContext";
import { Button } from "@/components/app/ui";
import { Icon } from "@/components/ui/Icon";
import { useAccount } from "@/data/account";
import { useTeamAccess } from "@/data/access";
import { useEvents } from "@/data/calendar";
import { usePlans } from "@/data/practice";
import { useGames } from "@/data/stats";
import { useVideos } from "@/data/videos";
import { clipsOf, formatTime } from "@/domain/team/video";
import { useHydrated } from "@/data/store";
import { sports } from "@/domain/sports";
import { playerAttendance } from "@/domain/team/practice";
import { combineLines, formatStat, hasGroup, statDigits, statValue } from "@/domain/team/stats";
import { localeTags } from "@/i18n/config";
import { age, fullName, groupOf } from "@/domain/team/roster";
import { fill } from "@/lib/fill";
import { plural } from "@/lib/plural";
import { cn } from "@/lib/cn";
import { useCanEdit } from "@/components/app/access";
import { EvaluationDialog } from "@/components/evaluation/EvaluationDialog";
import { RatingMeter, useEvaluation, useRatingFormat } from "@/components/evaluation/parts";
import { averageRating, history, personalBest, sportTests } from "@/domain/team/evaluation";
import { useTeam, useToday } from "./hooks";
import { AccessChip, AccessDialog } from "./AccessDialog";
import { PlayerDialog } from "./PlayerDialog";
import { CoachOnly, Jersey, StatusBadge, panel } from "./ui";

function Card({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn(panel, "rounded-[var(--radius-card)] p-5", className)}>
      <h2 className="text-[0.85rem] font-medium text-mist">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-[0.9rem] text-chalk-dim">{label}</dt>
      <dd className="tabular text-right font-medium">{children}</dd>
    </div>
  );
}

const none = <span className="text-mist/60">–</span>;

export function PlayerProfile({ playerId }: { playerId: string }) {
  const { t, locale } = useApp();
  const href = useHref();
  const hydrated = useHydrated();
  const { workspace, sport, roster, format } = useTeam();
  const events = useEvents(workspace?.id);
  const plans = usePlans(workspace?.id);
  const games = useGames(workspace?.id);
  const videos = useVideos(workspace?.id);
  const { data: evaluation, criteria } = useEvaluation(workspace?.id);
  const rating = useRatingFormat();
  const today = useToday();
  const canEdit = useCanEdit();
  const { playerId: myPlayerId } = useAccount();
  const { access, refresh: refreshAccess } = useTeamAccess(workspace?.id, canEdit);
  const [editing, setEditing] = useState(false);
  const [managing, setManaging] = useState(false);
  const [evaluating, setEvaluating] = useState<string | "new" | null>(null);

  if (!workspace || !hydrated) return null;
  if (!sport) return <CoachOnly />;

  const r = t.roster;
  const back = (
    <a href={href("/panel/roster")} className="inline-flex min-h-11 items-center gap-1.5 text-[0.92rem] font-medium text-chalk-dim hover:text-chalk">
      <Icon name="chevronLeft" className="size-4" />
      {r.profile.back}
    </a>
  );
  const player = roster.players.find((p) => p.id === playerId);
  if (!player) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 lg:py-14">
        {back}
        <p className="mt-8 text-chalk-dim">{r.profile.notFound}</p>
      </div>
    );
  }

  const years = age(player.birthDate);
  const places = player.positions.map((pos) => ({ pos, place: (roster.depth[pos] ?? []).indexOf(player.id) + 1 }));
  const primary = player.positions[0] ? groupOf(sport, player.positions[0]) : null;
  // Only plans of practices still on the calendar count.
  const practiceIds = new Set(events.filter((e) => e.kind === "practice").map((e) => e.id));
  const attendance = playerAttendance(
    Object.values(plans).filter((pl) => practiceIds.has(pl.eventId)),
    player.id,
  );
  const percent = new Intl.NumberFormat(localeTags[locale].intl, { style: "percent" });
  const gameLines = events
    .filter((e) => e.kind === "game")
    .map((e) => games[e.id]?.players[player.id])
    .filter((line) => line !== undefined);
  const season = sports[sport].statGroups
    .map((g) => {
      const lines = gameLines.filter((line) => hasGroup(line, g.id));
      return { group: g, played: lines.length, line: combineLines(lines) };
    })
    .filter((x) => x.played > 0);
  const evaluations = history(evaluation.evaluations, player.id);
  const latest = evaluations[0];
  const latestMean = latest ? averageRating(latest.ratings, criteria) : null;
  const moments = clipsOf(videos, player.id);
  // The coach sees everything; a player sees their own profile in full, a teammate's team-facing card.
  const personal = canEdit || myPlayerId === player.id;
  const bests = sportTests(sport)
    .map((test) => ({ test, best: personalBest(evaluation.tests, player.id, test) }))
    .filter((x) => x.best !== null);

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 lg:py-14">
      {back}

      <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-5">
        <Jersey number={player.number} className="text-[clamp(4.5rem,3rem+6vw,8rem)] leading-[0.85] text-volt" />
        <div className="min-w-0 flex-1">
          {primary && <p className="text-[0.9rem] font-semibold text-chalk-dim">{primary.name[locale]}</p>}
          <h1 className="display mt-1 text-display-md">{fullName(player)}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {player.positions.length > 0 && <span className="text-[0.95rem] font-semibold">{player.positions.join(" / ")}</span>}
            <StatusBadge status={player.status} />
          </div>
        </div>
        {canEdit && (
          <Button variant="ghost" onClick={() => setEditing(true)}>
            <Icon name="pencil" className="size-[1.1rem]" />
            {r.profile.edit}
          </Button>
        )}
      </div>

      {player.status === "injured" && player.injury && (player.injury.note || player.injury.returnDate) && (
        <p className="mt-6 rounded-[var(--radius-card)] bg-signal/10 px-5 py-3.5 text-[0.95rem] text-chalk shadow-[inset_0_0_0_1px_rgb(255_106_61/0.35)]">
          <span className="font-semibold text-signal">{r.statuses.injured}</span>
          {player.injury.note && <span>: {player.injury.note}</span>}
          {player.injury.returnDate && <span className="text-chalk-dim">. {fill(r.returns, { date: format.day(player.injury.returnDate) })}</span>}
        </p>
      )}

      <div className="mt-8 grid gap-3 md:grid-cols-2">
        {canEdit && (
          <Card title={t.access.manage} className="md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <AccessChip access={access[player.id]} className="text-[0.95rem]" />
              <Button variant="ghost" className="h-10 px-3.5 text-[0.88rem]" onClick={() => setManaging(true)}>
                {t.access.manage}
              </Button>
            </div>
          </Card>
        )}
        {personal && (
        <Card title={r.profile.details}>
          <dl className="divide-y divide-hairline">
            <Row label={r.form.height}>{player.heightCm !== null ? format.number(player.heightCm) : none}</Row>
            <Row label={r.form.weight}>{player.weightKg !== null ? format.number(player.weightKg) : none}</Row>
            <Row label={r.form.birthDate}>{player.birthDate ? `${format.day(player.birthDate)}${years !== null ? ` (${years})` : ""}` : none}</Row>
          </dl>
        </Card>
        )}

        <Card title={r.profile.depth}>
          {places.length === 0 ? (
            <p className="text-[0.92rem] text-mist">{r.depth.empty}</p>
          ) : (
            <dl className="divide-y divide-hairline">
              {places.map(({ pos, place }) => (
                <Row key={pos} label={pos}>
                  {place === 1 ? <span className="text-volt">{r.depth.starter}</span> : fill(r.profile.depthPlace, { n: place })}
                </Row>
              ))}
            </dl>
          )}
        </Card>

        {personal && (
        <Card title={t.practice.rate}>
          {attendance.rate === null ? (
            <p className="text-[0.92rem] text-mist">{t.practice.rateNone}</p>
          ) : (
            <>
              <p className="display tabular text-[2.4rem] leading-none">{percent.format(attendance.rate)}</p>
              <p className="mt-2 text-[0.9rem] text-chalk-dim">{fill(t.practice.rateLine, { attended: attendance.attended, taken: attendance.taken })}</p>
            </>
          )}
        </Card>

        )}

        {personal && (
        <Card title={r.profile.contact}>
          {!player.phone && !player.email ? (
            <p className="text-[0.92rem] text-mist">{r.profile.noContact}</p>
          ) : (
            <ul className="space-y-1">
              {player.phone && (
                <li>
                  <a href={`tel:${player.phone.replace(/\s/g, "")}`} className="font-medium hover:underline">
                    {player.phone}
                  </a>
                </li>
              )}
              {player.email && (
                <li>
                  <a href={`mailto:${player.email}`} className="font-medium break-all hover:underline">
                    {player.email}
                  </a>
                </li>
              )}
            </ul>
          )}
        </Card>

        )}

        {personal && (
        <Card title={t.evaluation.profileCard}>
          {!latest || latestMean === null ? (
            <p className="text-[0.92rem] text-mist">{t.evaluation.profileNone}</p>
          ) : (
            <>
              <p className="flex items-center gap-3">
                <span className="display tabular text-[2.4rem] leading-none">{rating(latestMean)}</span>
                <RatingMeter value={latestMean} />
              </p>
              <p className="mt-1 text-[0.85rem] text-mist">{fill(t.evaluation.lastEvaluated, { date: format.day(latest.date) })}</p>
              <dl className="mt-3 divide-y divide-hairline">
                {criteria
                  .filter((c) => latest.ratings[c.id] !== undefined)
                  .map((c) => (
                    <Row key={c.id} label={c.name}>
                      {latest.ratings[c.id]}
                    </Row>
                  ))}
              </dl>
              {latest.strengths && <p className="mt-3 text-[0.9rem] text-chalk-dim"><span className="font-semibold text-chalk">{t.evaluation.strengths}: </span>{latest.strengths}</p>}
              {latest.improve && <p className="mt-1 text-[0.9rem] text-chalk-dim"><span className="font-semibold text-chalk">{t.evaluation.improve}: </span>{latest.improve}</p>}
              {evaluations.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-[0.88rem] font-semibold text-chalk-dim hover:text-chalk">{`${t.evaluation.history} (${evaluations.length})`}</summary>
                  <ul className="mt-2 space-y-1">
                    {evaluations.map((ev) => {
                      const m = averageRating(ev.ratings, criteria);
                      return (
                        <li key={ev.id}>
                          {canEdit ? (
                            <button type="button" onClick={() => setEvaluating(ev.id)} className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-[0.9rem] hover:bg-chalk/5">
                              <span>{format.day(ev.date)}</span>
                              <span className="tabular font-semibold">{m === null ? "–" : rating(m)}</span>
                            </button>
                          ) : (
                            <p className="flex items-center justify-between gap-3 px-2 py-1.5 text-[0.9rem]">
                              <span>{format.day(ev.date)}</span>
                              <span className="tabular font-semibold">{m === null ? "–" : rating(m)}</span>
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </details>
              )}
            </>
          )}
          {canEdit && (
            <Button variant="ghost" className="mt-4 h-10 px-3.5 text-[0.88rem]" onClick={() => setEvaluating("new")}>
              {t.evaluation.evaluate}
            </Button>
          )}
        </Card>

        )}

        {personal && (
        <Card title={t.evaluation.profileTests}>
          {bests.length === 0 ? (
            <p className="text-[0.92rem] text-mist">{t.evaluation.profileTestsNone}</p>
          ) : (
            <dl className="divide-y divide-hairline">
              {bests.map(({ test, best }) => (
                <Row key={test.id} label={test.name[locale]}>
                  {`${formatStat(best!.value, test.unit === "s" ? 2 : 0, localeTags[locale].intl)} ${t.evaluation.units[test.unit]}`}
                </Row>
              ))}
            </dl>
          )}
        </Card>

        )}

        <Card title={t.stats.seasonCard} className="md:col-span-2">
          {season.length === 0 ? (
            <p className="text-[0.92rem] text-mist">{t.stats.seasonNone}</p>
          ) : (
            <div className="space-y-4">
              {season.map(({ group, played, line }) => (
                <div key={group.id}>
                  <p className="text-[0.9rem] font-semibold">
                    {group.label[locale]} <span className="font-normal text-mist">{plural(locale, t.stats.gamesCount, played)}</span>
                  </p>
                  <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
                    {group.stats.map((st) => (
                      <div key={st.key} title={st.label[locale]}>
                        <dt className="text-[0.75rem] text-mist">{st.abbr}</dt>
                        <dd className="tabular text-[1.05rem] font-semibold">{formatStat(statValue(line, group.id, st.key), statDigits(group.id, st.key), localeTags[locale].intl)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title={t.video.profileCard} className="md:col-span-2">
          {moments.length === 0 ? (
            <p className="text-[0.92rem] text-mist">{t.video.profileNone}</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {moments.map(({ video, clip }) => (
                <li key={clip.id}>
                  <a href={href(`/panel/video/${video.id}?t=${clip.at}`)} className="flex items-baseline gap-3 py-2 hover:underline">
                    <span className="tabular w-14 shrink-0 font-semibold text-volt">{formatTime(clip.at)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{clip.label}</span>
                      <span className="block text-[0.82rem] text-mist">{video.title}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {canEdit && (
        <Card title={r.profile.notes} className="md:col-span-2">
          {player.notes ? <p className="text-[0.95rem] whitespace-pre-line text-chalk-dim">{player.notes}</p> : <p className="text-[0.92rem] text-mist">{r.profile.noNotes}</p>}
        </Card>
        )}
      </div>


      {managing && (
        <AccessDialog player={player} access={access[player.id]} team={workspace.name} workspaceId={workspace.id} onClose={() => setManaging(false)} onChanged={refreshAccess} />
      )}
      {evaluating && today && (
        <EvaluationDialog
          player={player}
          criteria={criteria}
          evaluation={evaluating === "new" ? null : (evaluation.evaluations.find((ev) => ev.id === evaluating) ?? null)}
          today={today}
          workspaceId={workspace.id}
          onClose={() => setEvaluating(null)}
        />
      )}
      {editing && (
        <PlayerDialog
          open
          onClose={() => setEditing(false)}
          onDeleted={() => window.location.assign(href("/panel/roster"))}
          access={access[player.id]}
          player={player}
          players={roster.players}
          sport={sport}
          workspaceId={workspace.id}
        />
      )}
    </div>
  );
}
