"use client";

import { useState } from "react";
import { useCanEdit } from "@/components/app/access";
import { useApp, useHref } from "@/components/app/AppContext";
import { Button, Dialog, TextField } from "@/components/app/ui";
import { NumberCell } from "@/components/stats/parts";
import { useTeam } from "@/components/team/hooks";
import { CoachOnly, Jersey, panel } from "@/components/team/ui";
import { Icon } from "@/components/ui/Icon";
import { useAccount } from "@/data/account";
import { evaluationRepo } from "@/data/evaluation";
import { useHydrated } from "@/data/store";
import { sportTests, validResult } from "@/domain/team/evaluation";
import { fullName, sortPlayers } from "@/domain/team/roster";
import { localeTags } from "@/i18n/config";
import { parseDay } from "@/domain/team/calendar";
import { formatStat } from "@/domain/team/stats";
import { fill } from "@/lib/fill";
import { cn } from "@/lib/cn";
import { useEvaluation } from "./parts";

/** One test day: every player's readings in the sport's tests. */
export function TestSessionPage({ sessionId }: { sessionId: string }) {
  const { t, locale } = useApp();
  const href = useHref();
  const hydrated = useHydrated();
  const { workspace, sport, roster } = useTeam();
  const { data } = useEvaluation(workspace?.id);
  const [confirming, setConfirming] = useState(false);
  const canEdit = useCanEdit();
  const { playerId } = useAccount();

  if (!workspace || !hydrated) return null;
  if (!sport) return <CoachOnly />;

  const e = t.evaluation;
  const back = (
    <a href={href("/panel/evaluation")} className="inline-flex min-h-11 items-center gap-1.5 text-[0.92rem] font-medium text-chalk-dim hover:text-chalk">
      <Icon name="chevronLeft" className="size-4" />
      {e.back}
    </a>
  );
  const session = data.tests.find((s) => s.id === sessionId);
  if (!session) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 lg:py-14">
        {back}
        <p className="mt-8 text-chalk-dim">{e.sessionNotFound}</p>
      </div>
    );
  }

  const tests = sportTests(sport);
  // Everyone who can take part, and anyone with a reading here even if inactive now.
  const players = sortPlayers(
    roster.players.filter((p) => (canEdit ? p.status !== "inactive" || session.results[p.id] : p.id === playerId)),
    sport,
    "number",
    locale,
  );
  const setResult = (playerId: string, testId: string, value: number | null) =>
    evaluationRepo.updateSession(workspace.id, session.id, (s) => {
      const line = { ...(s.results[playerId] ?? {}) };
      if (value === null) delete line[testId];
      else line[testId] = value;
      return { ...s, results: { ...s.results, [playerId]: line } };
    });
  const unusual = players.some((p) => tests.some((test) => {
    const v = session.results[p.id]?.[test.id];
    return v !== undefined && !validResult(test, v);
  }));

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:py-14">
      {back}

      {!canEdit ? (
        <div className="mt-6">
          <p className="text-[0.9rem] font-semibold text-volt">{new Intl.DateTimeFormat(localeTags[locale].intl, { day: "numeric", month: "long", year: "numeric" }).format(parseDay(session.date))}</p>
          <h1 className="display mt-2 text-display-md">{session.title || e.sessionDefault}</h1>
        </div>
      ) : (
      <div className="mt-6 flex flex-wrap items-end gap-4">
        <div className="min-w-[14rem] flex-1">
          <TextField label={e.sessionTitle} placeholder={e.sessionDefault} value={session.title} onChange={(ev) => evaluationRepo.updateSession(workspace.id, session.id, (s) => ({ ...s, title: ev.target.value }))} autoComplete="off" />
        </div>
        <div className="w-[12rem]">
          <TextField label={e.date} type="date" value={session.date} onChange={(ev) => ev.target.value && evaluationRepo.updateSession(workspace.id, session.id, (s) => ({ ...s, date: ev.target.value }))} />
        </div>
        <Button variant="ghost" className="text-signal" onClick={() => setConfirming(true)}>
          <Icon name="trash" className="size-[1.1rem]" />
          {e.deleteSession}
        </Button>
      </div>
      )}

      <div className={cn(panel, "mt-8 overflow-x-auto rounded-[var(--radius-card)]")}>
        {players.length === 0 ? (
          <p className="p-6 text-chalk-dim">{e.noPlayers}</p>
        ) : (
          <table className="w-full text-[0.92rem]">
            <thead>
              <tr className="border-b border-hairline text-[0.8rem] text-mist">
                <th scope="col" className="sticky left-0 z-10 bg-night-850 py-2.5 pr-3 pl-4 text-left font-medium">
                  {t.stats.player}
                </th>
                {tests.map((test) => (
                  <th key={test.id} scope="col" className="px-1.5 py-2.5 text-right font-medium" title={test.better === "lower" ? e.lowerBetter : e.higherBetter}>
                    <span className="block whitespace-nowrap text-chalk-dim">{test.name[locale]}</span>
                    <span className="block">{e.units[test.unit]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {players.map((player) => (
                <tr key={player.id}>
                  <th scope="row" className="sticky left-0 z-10 bg-night-850 py-1.5 pr-3 pl-4 text-left font-normal">
                    <span className="flex items-center gap-2.5 whitespace-nowrap">
                      <Jersey number={player.number} className="w-7 text-right text-[1.2rem]" />
                      <span className="font-semibold">{fullName(player)}</span>
                    </span>
                  </th>
                  {tests.map((test) => {
                    const v = session.results[player.id]?.[test.id];
                    return (
                      <td key={test.id} className="px-1.5 py-1.5 text-right">
                        {canEdit ? (
                          <NumberCell
                            value={v ?? null}
                            onChange={(value) => setResult(player.id, test.id, value)}
                            label={fill(e.resultOf, { name: fullName(player), test: test.name[locale] })}
                            decimals={test.unit === "s" || test.unit === "kg"}
                            warn={v !== undefined && !validResult(test, v)}
                          />
                        ) : (
                          <span className="tabular block px-2 text-chalk">{formatStat(v ?? null, test.unit === "s" ? 2 : 0, localeTags[locale].intl)}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {unusual && (
        <p className="mt-3 text-[0.88rem] text-amber" role="status">
          {e.outOfRange}
        </p>
      )}

      {confirming && canEdit && (
        <Dialog
          open
          onClose={() => setConfirming(false)}
          title={e.deleteSession}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                {t.common.cancel}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  evaluationRepo.removeSession(workspace.id, session.id);
                  window.location.assign(href("/panel/evaluation"));
                }}
              >
                {t.common.delete}
              </Button>
            </>
          }
        >
          <p className="text-chalk-dim">{fill(e.deleteSessionConfirm, { title: session.title || e.sessionDefault })}</p>
        </Dialog>
      )}
    </div>
  );
}
