"use client";

import { useMemo, useState } from "react";
import { EditOnly, useCanEdit } from "@/components/app/access";
import { useApp, useHref } from "@/components/app/AppContext";
import { Button, Dialog, TextField } from "@/components/app/ui";
import { useTeam, useToday } from "@/components/team/hooks";
import { CoachOnly, Jersey, ModuleHeader, PositionChips, Tabs, panel } from "@/components/team/ui";
import { Icon } from "@/components/ui/Icon";
import { useAccount } from "@/data/account";
import { evaluationRepo } from "@/data/evaluation";
import { useHydrated } from "@/data/store";
import { sports } from "@/domain/sports";
import { parseDay } from "@/domain/team/calendar";
import { averageRating, history, personalBest, sportTests, teamBest, trend } from "@/domain/team/evaluation";
import { fullName, sortPlayers, type Player } from "@/domain/team/roster";
import { formatStat } from "@/domain/team/stats";
import { localeTags } from "@/i18n/config";
import { fill } from "@/lib/fill";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/plural";
import { CriteriaDialog } from "./CriteriaDialog";
import { EvaluationDialog } from "./EvaluationDialog";
import { RatingMeter, useEvaluation, useRatingFormat } from "./parts";

type View = "ratings" | "tests";

export function EvaluationPage() {
  const { t, locale } = useApp();
  const href = useHref();
  const hydrated = useHydrated();
  const today = useToday();
  const { workspace, sport, roster } = useTeam();
  const { data, criteria } = useEvaluation(workspace?.id);
  const rating = useRatingFormat();
  const [view, setView] = useState<View>("ratings");
  const [evaluating, setEvaluating] = useState<Player | null>(null);
  const [editingCriteria, setEditingCriteria] = useState(false);
  const [addingSession, setAddingSession] = useState(false);
  const canEdit = useCanEdit();
  const { playerId } = useAccount();
  const intl = localeTags[locale].intl;
  const day = useMemo(() => new Intl.DateTimeFormat(intl, { day: "numeric", month: "long", year: "numeric" }), [intl]);

  if (!workspace || !hydrated || !today) return null;
  if (!sport) return <CoachOnly />;

  const e = t.evaluation;
  const players = sortPlayers(
    // A player sees their own evaluation only (the server sends no one else's).
    roster.players.filter((p) => (canEdit ? p.status !== "inactive" : p.id === playerId)),
    sport,
    "number",
    locale,
  );
  const tests = sportTests(sport);
  const sessions = [...data.tests].sort((a, b) => b.date.localeCompare(a.date));
  const tested = players.filter((p) => data.tests.some((s) => s.results[p.id] && Object.keys(s.results[p.id]).length));

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:py-14">
      <ModuleHeader eyebrow={sports[sport].name[locale]} title={canEdit ? e.title : t.shell.myEvaluation} body={canEdit ? e.body : e.bodyPlayer} />

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
        <Tabs
          idBase="evaluation"
          label={e.title}
          value={view}
          onChange={setView}
          tabs={[
            { value: "ratings", label: e.tabs.ratings },
            { value: "tests", label: e.tabs.tests },
          ]}
        />
        {!canEdit ? null : view === "ratings" ? (
          <Button variant="ghost" className="h-10 px-3.5 text-[0.88rem]" onClick={() => setEditingCriteria(true)}>
            <Icon name="sliders" className="size-4" />
            {e.editCriteria}
          </Button>
        ) : (
          <Button className="h-10 px-4 text-[0.9rem]" onClick={() => setAddingSession(true)}>
            <Icon name="plus" className="size-4" />
            {e.addSession}
          </Button>
        )}
      </div>

      <div id="evaluation-panel" role="tabpanel" aria-labelledby={`evaluation-tab-${view}`} className="mt-6">
        {view === "ratings" ? (
          players.length === 0 ? (
            <div className={cn(panel, "p-8 text-center")}>
              <p className="text-chalk-dim">{e.noPlayers}</p>
              <a href={href("/panel/roster")} className="mt-5 inline-flex h-11 items-center rounded-[0.7rem] bg-volt px-5 font-semibold text-night-950 hover:bg-volt-soft">
                {t.practice.attendance.toRoster}
              </a>
            </div>
          ) : (
            <ul className={cn(panel, "divide-y divide-hairline overflow-hidden rounded-[var(--radius-card)]")}>
              {players.map((player) => {
                const [latest] = history(data.evaluations, player.id);
                const mean = latest ? averageRating(latest.ratings, criteria) : null;
                const change = trend(data.evaluations, player.id, criteria);
                return (
                  <li key={player.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 sm:px-5">
                    <Jersey number={player.number} className="w-8 text-right text-[1.5rem]" />
                    <span className="min-w-0 flex-1 basis-44">
                      <a href={href(`/panel/roster/${player.id}`)} className="block truncate font-semibold hover:underline">
                        {fullName(player)}
                      </a>
                      <PositionChips positions={player.positions.slice(0, 2)} className="mt-1" />
                    </span>
                    <span className="flex min-w-[11rem] flex-col gap-1">
                      {mean !== null ? (
                        <span className="flex items-center gap-2.5 text-[0.95rem] font-semibold">
                          <RatingMeter value={mean} />
                          <span className="tabular">{fill(e.average, { value: rating(mean) })}</span>
                          {change !== null && change !== 0 && (
                            <span className={cn("inline-flex items-center", change > 0 ? "text-volt" : "text-signal")} title={fill(change > 0 ? e.trendUp : e.trendDown, { value: rating(Math.abs(change)) })}>
                              <Icon name="arrowDown" className={cn("size-3.5", change > 0 && "rotate-180")} />
                              <span className="sr-only">{fill(change > 0 ? e.trendUp : e.trendDown, { value: rating(Math.abs(change)) })}</span>
                            </span>
                          )}
                        </span>
                      ) : null}
                      <span className="text-[0.82rem] text-mist">{latest ? fill(e.lastEvaluated, { date: day.format(parseDay(latest.date)) }) : e.never}</span>
                    </span>
                    <EditOnly>
                      <Button variant="ghost" className="h-10 px-3.5 text-[0.88rem]" onClick={() => setEvaluating(player)} aria-label={`${e.evaluate}: ${fullName(player)}`}>
                        {e.evaluate}
                      </Button>
                    </EditOnly>
                  </li>
                );
              })}
            </ul>
          )
        ) : (
          <div className="space-y-10">
            <section aria-labelledby="sessions-title">
              <h2 id="sessions-title" className="text-[1.1rem] font-semibold">
                {e.sessions}
              </h2>
              {sessions.length === 0 ? (
                <p className={cn(panel, "mt-3 p-6 text-chalk-dim")}>{canEdit ? e.noSessions : t.common.nothingYet}</p>
              ) : (
                <ul className={cn(panel, "mt-3 divide-y divide-hairline overflow-hidden rounded-[var(--radius-card)]")}>
                  {sessions.map((s) => {
                    const count = Object.values(s.results).filter((r) => Object.keys(r).length).length;
                    return (
                      <li key={s.id}>
                        <a href={href(`/panel/evaluation/tests/${s.id}`)} className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-chalk/[0.03] sm:px-5">
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold group-hover:underline">{s.title || e.sessionDefault}</span>
                            <span className="mt-0.5 block text-[0.85rem] text-mist">{day.format(parseDay(s.date))}</span>
                          </span>
                          <span className="text-[0.9rem] text-chalk-dim">{plural(locale, e.tested, count)}</span>
                          <Icon name="chevronLeft" className="size-4 rotate-180 text-mist" />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section aria-labelledby="bests-title">
              <h2 id="bests-title" className="text-[1.1rem] font-semibold">
                {e.bests}
              </h2>
              <p className="mt-1 text-[0.9rem] text-mist">{e.bestsBody}</p>
              {tested.length === 0 ? (
                <p className={cn(panel, "mt-3 p-6 text-mist")}>{e.noBests}</p>
              ) : (
                <div className={cn(panel, "mt-3 overflow-x-auto rounded-[var(--radius-card)]")}>
                  <table className="w-full text-[0.92rem]">
                    <thead>
                      <tr className="border-b border-hairline text-[0.8rem] text-mist">
                        <th scope="col" className="sticky left-0 bg-night-850 py-2.5 pr-3 pl-4 text-left font-medium">
                          {t.stats.player}
                        </th>
                        {tests.map((test) => (
                          <th key={test.id} scope="col" className="px-3 py-2.5 text-right font-medium" title={test.better === "lower" ? e.lowerBetter : e.higherBetter}>
                            <span className="block whitespace-nowrap text-chalk-dim">{test.name[locale]}</span>
                            <span className="block">{e.units[test.unit]}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {tested.map((player) => (
                        <tr key={player.id}>
                          <th scope="row" className="sticky left-0 bg-night-850 py-2 pr-3 pl-4 text-left font-normal">
                            <a href={href(`/panel/roster/${player.id}`)} className="flex items-center gap-2.5 whitespace-nowrap hover:underline">
                              <Jersey number={player.number} className="w-7 text-right text-[1.2rem]" />
                              <span className="font-semibold">{fullName(player)}</span>
                            </a>
                          </th>
                          {tests.map((test) => {
                            const pb = personalBest(data.tests, player.id, test);
                            const top = pb !== null && pb.value === teamBest(data.tests, tested.map((p) => p.id), test);
                            return (
                              <td key={test.id} className={cn("tabular px-3 py-2 text-right", top ? "font-semibold text-volt" : "text-chalk-dim")}>
                                {formatStat(pb?.value ?? null, test.unit === "s" ? 2 : 0, intl)}
                                {top && <span className="sr-only">{`, ${e.teamBest}`}</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {evaluating && canEdit && <EvaluationDialog player={evaluating} criteria={criteria} evaluation={null} today={today} workspaceId={workspace.id} onClose={() => setEvaluating(null)} />}
      {editingCriteria && canEdit && <CriteriaDialog criteria={criteria} workspaceId={workspace.id} onClose={() => setEditingCriteria(false)} />}
      {addingSession && canEdit && <NewSessionDialog today={today} workspaceId={workspace.id} onClose={() => setAddingSession(false)} />}
    </div>
  );
}

function NewSessionDialog({ today, workspaceId, onClose }: { today: string; workspaceId: string; onClose: () => void }) {
  const { t } = useApp();
  const href = useHref();
  const e = t.evaluation;
  const [date, setDate] = useState(today);
  const [title, setTitle] = useState("");
  const create = () => {
    const session = evaluationRepo.addSession(workspaceId, date || today, title);
    window.location.assign(href(`/panel/evaluation/tests/${session.id}`));
  };
  return (
    <Dialog
      open
      onClose={onClose}
      onSubmit={create}
      title={e.addSession}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit">{t.common.create}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField label={e.sessionTitle} placeholder={e.sessionTitlePlaceholder} value={title} onChange={(ev) => setTitle(ev.target.value)} autoFocus autoComplete="off" />
        <div className="max-w-[12rem]">
          <TextField label={e.date} type="date" value={date} onChange={(ev) => setDate(ev.target.value)} />
        </div>
      </div>
    </Dialog>
  );
}
