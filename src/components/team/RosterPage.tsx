"use client";

import { useState } from "react";
import { useApp, useHref } from "@/components/app/AppContext";
import { EditOnly, useCanEdit } from "@/components/app/access";
import { Button, IconButton } from "@/components/app/ui";
import { Icon } from "@/components/ui/Icon";
import { useTeamAccess } from "@/data/access";
import { useHydrated } from "@/data/store";
import { sports } from "@/domain/sports";
import type { Side, SportId } from "@/domain/sports/types";
import { PLAYER_STATUSES, age, duplicateNumbers, fullName, groupOf, positionGroups, sortPlayers, type Player, type PlayerStatus, type RosterSort } from "@/domain/team/roster";
import { fill } from "@/lib/fill";
import { cn } from "@/lib/cn";
import { AccessChip, AccessDialog } from "./AccessDialog";
import { BulkAddDialog } from "./BulkAddDialog";
import { DepthChart } from "./DepthChart";
import { useTeam } from "./hooks";
import { PlayerDialog } from "./PlayerDialog";
import { CoachOnly, Jersey, ModuleHeader, PositionChips, SearchField, Select, StatusBadge, Tabs, panel } from "./ui";

type View = "list" | "depth";
type SideFilter = "all" | Side;

interface Filters {
  query: string;
  side: SideFilter;
  group: string;
  status: "all" | PlayerStatus;
  sort: RosterSort;
}

function matches(p: Player, f: Filters, sport: SportId, locale: string) {
  const groups = p.positions.map((pos) => groupOf(sport, pos));
  if (f.side !== "all" && !groups.some((g) => g?.side === f.side)) return false;
  if (f.group !== "all" && !groups.some((g) => g?.id === f.group)) return false;
  if (f.status !== "all" && p.status !== f.status) return false;
  const q = f.query.trim().toLocaleLowerCase(locale).replace(/^#/, "");
  if (!q) return true;
  return (
    fullName(p).toLocaleLowerCase(locale).includes(q) ||
    String(p.number ?? "") === q ||
    p.positions.some((pos) => pos.toLocaleLowerCase(locale) === q)
  );
}

export function RosterPage() {
  const { t, locale } = useApp();
  const href = useHref();
  const hydrated = useHydrated();
  const { workspace, sport, roster, format } = useTeam();
  const canEdit = useCanEdit();
  const { access, refresh: refreshAccess } = useTeamAccess(workspace?.id, canEdit);
  const [managing, setManaging] = useState<string | null>(null);
  const [view, setView] = useState<View>("list");
  const [filters, setFilters] = useState<Filters>({ query: "", side: "all", group: "all", status: "all", sort: "number" });
  // "new" opens an empty form; a player id opens that player's.
  const [editing, setEditing] = useState<string | null>(null);
  const [bulk, setBulk] = useState(false);

  if (!workspace || !hydrated) return null;
  if (!sport) return <CoachOnly />;

  const r = t.roster;
  const players = roster.players;
  const groups = positionGroups(sport);
  const sides = [...new Set(groups.map((g) => g.side))];
  const shown = sortPlayers(
    players.filter((p) => matches(p, filters, sport, locale)),
    sport,
    filters.sort,
    locale,
  );
  const twice = duplicateNumbers(players);
  const count = (s: PlayerStatus) => players.filter((p) => p.status === s).length;
  const editingPlayer = editing && editing !== "new" ? (players.find((p) => p.id === editing) ?? null) : null;
  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:py-14">
      <ModuleHeader
        eyebrow={sports[sport].name[locale]}
        title={r.title}
        body={r.body}
        actions={
          canEdit && (
            <>
              <Button variant="ghost" onClick={() => setBulk(true)}>
                {r.bulkAdd}
              </Button>
              <Button onClick={() => setEditing("new")}>
                <Icon name="plus" className="size-5" />
                {r.addPlayer}
              </Button>
            </>
          )
        }
      />

      {players.length === 0 ? (
        <div className={cn(panel, "mt-10 p-8 text-center")}>
          <Icon name="team" className="mx-auto size-8 text-mist" />
          <p className="mx-auto mt-4 max-w-[28rem] text-chalk-dim">{r.empty}</p>
          <EditOnly>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button onClick={() => setEditing("new")}>{r.addPlayer}</Button>
              <Button variant="ghost" onClick={() => setBulk(true)}>
                {r.bulkAdd}
              </Button>
            </div>
          </EditOnly>
        </div>
      ) : (
        <>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
            <Tabs
              idBase="roster"
              label={r.title}
              value={view}
              onChange={setView}
              tabs={[
                { value: "list", label: r.tabs.list },
                { value: "depth", label: r.tabs.depth },
              ]}
            />
            <p className="text-[0.92rem] text-mist">{fill(r.summary, { total: players.length, active: count("active"), injured: count("injured") })}</p>
          </div>

          <div id="roster-panel" role="tabpanel" aria-labelledby={`roster-tab-${view}`} className="mt-6">
            {view === "depth" ? (
              <DepthChart roster={roster} sport={sport} workspaceId={workspace.id} />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(14rem,1fr)_auto_auto_auto_auto]">
                  <SearchField label={r.search} placeholder={r.searchPlaceholder} value={filters.query} onChange={(v) => setFilter("query", v)} className="col-span-2 lg:col-span-1" />
                  <Select
                    hideLabel
                    label={r.sides.all}
                    value={filters.side}
                    onChange={(v) => setFilters((f) => ({ ...f, side: v, group: "all" }))}
                    options={[{ value: "all" as SideFilter, label: r.sides.all }, ...sides.map((s) => ({ value: s as SideFilter, label: r.sides[s] }))]}
                  />
                  <Select
                    hideLabel
                    label={r.group}
                    value={filters.group}
                    onChange={(v) => setFilter("group", v)}
                    options={[
                      { value: "all", label: r.allGroups },
                      ...groups.filter((g) => filters.side === "all" || g.side === filters.side).map((g) => ({ value: g.id, label: `${g.abbr} · ${g.name[locale]}` })),
                    ]}
                  />
                  <Select
                    hideLabel
                    label={r.status}
                    value={filters.status}
                    onChange={(v) => setFilter("status", v)}
                    options={[{ value: "all" as const, label: r.anyStatus }, ...PLAYER_STATUSES.map((s) => ({ value: s, label: r.statuses[s] }))]}
                  />
                  <Select
                    hideLabel
                    label={r.sort}
                    value={filters.sort}
                    onChange={(v) => setFilter("sort", v)}
                    options={(["number", "name", "position"] as RosterSort[]).map((s) => ({ value: s, label: `${r.sort}: ${r.sorts[s]}` }))}
                  />
                </div>

                {shown.length === 0 ? (
                  <p className={cn(panel, "mt-6 p-8 text-center text-chalk-dim")}>{r.noMatch}</p>
                ) : (
                  <>
                    {/* Phones: one card per player. */}
                    <ul className="mt-6 space-y-2 md:hidden">
                      {shown.map((p) => (
                        <li key={p.id} className={cn(panel, "flex items-center gap-4 rounded-[var(--radius-card)] p-3 pl-4")}>
                          <Jersey number={p.number} className="w-9 text-right text-[1.9rem]" />
                          <a href={href(`/panel/roster/${p.id}`)} className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{fullName(p)}</span>
                            <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <PositionChips positions={p.positions} />
                              {p.status !== "active" && <StatusBadge status={p.status} />}
                              {canEdit && <AccessChip access={access[p.id]} />}
                            </span>
                          </a>
                          <EditOnly>
                            <IconButton label={r.form.titleEdit} onClick={() => setEditing(p.id)}>
                              <Icon name="pencil" className="size-[1.1rem]" />
                            </IconButton>
                          </EditOnly>
                        </li>
                      ))}
                    </ul>

                    {/* Wider screens: the table a coach reads down. */}
                    <div className={cn(panel, "mt-6 hidden overflow-hidden md:block")}>
                      <table className="w-full text-left text-[0.95rem]">
                        <thead>
                          <tr className="border-b border-hairline text-[0.8rem] text-mist">
                            <th scope="col" className="w-16 py-3 pr-2 pl-5 text-right font-medium">
                              {r.columns.number}
                            </th>
                            <th scope="col" className="px-3 py-3 font-medium">
                              {r.columns.name}
                            </th>
                            <th scope="col" className="px-3 py-3 font-medium">
                              {r.columns.positions}
                            </th>
                            <th scope="col" className="px-3 py-3 font-medium">
                              {r.columns.status}
                            </th>
                            {canEdit && (
                              <>
                                <th scope="col" className="hidden px-3 py-3 font-medium lg:table-cell">
                                  {r.columns.body}
                                </th>
                                <th scope="col" className="hidden px-3 py-3 text-right font-medium lg:table-cell">
                                  {r.columns.age}
                                </th>
                                <th scope="col" className="px-3 py-3 font-medium">
                                  {t.access.column}
                                </th>
                                <th scope="col" className="w-14 py-3 pr-3">
                                  <span className="sr-only">{r.form.titleEdit}</span>
                                </th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-hairline">
                          {shown.map((p) => {
                            const years = age(p.birthDate);
                            return (
                              <tr key={p.id} className="transition-colors hover:bg-chalk/[0.03]">
                                <td className="py-2 pr-2 pl-5 text-right">
                                  <span className="inline-flex items-center gap-1.5">
                                    {p.number !== null && twice.has(p.number) && (
                                      <span title={r.duplicateNumber} className="text-amber">
                                        <Icon name="info" className="size-4" />
                                        <span className="sr-only">{r.duplicateNumber}</span>
                                      </span>
                                    )}
                                    <Jersey number={p.number} className="text-[1.6rem]" />
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  <a href={href(`/panel/roster/${p.id}`)} className="font-semibold hover:underline">
                                    {fullName(p)}
                                  </a>
                                  {p.injury?.note && <span className="mt-0.5 block text-[0.82rem] text-mist">{p.injury.note}</span>}
                                </td>
                                <td className="px-3 py-2">
                                  <PositionChips positions={p.positions} />
                                </td>
                                <td className="px-3 py-2">
                                  <StatusBadge status={p.status} quiet />
                                  {p.injury?.returnDate && <span className="mt-0.5 block text-[0.78rem] text-mist">{fill(r.returns, { date: format.day(p.injury.returnDate) })}</span>}
                                </td>
                                {canEdit && (
                                  <>
                                    <td className="tabular hidden px-3 py-2 text-chalk-dim lg:table-cell">
                                      {p.heightCm || p.weightKg ? [p.heightCm && fill(r.cm, { n: format.number(p.heightCm) }), p.weightKg && fill(r.kg, { n: format.number(p.weightKg) })].filter(Boolean).join(" / ") : <span className="text-mist/60">–</span>}
                                    </td>
                                    <td className="tabular hidden px-3 py-2 text-right text-chalk-dim lg:table-cell">{years ?? <span className="text-mist/60">–</span>}</td>
                                    <td className="px-3 py-2">
                                      <button type="button" onClick={() => setManaging(p.id)} aria-label={`${t.access.manage}: ${fullName(p)}`} className="rounded-md px-1 py-1 hover:bg-chalk/6">
                                        <AccessChip access={access[p.id]} />
                                      </button>
                                    </td>
                                    <td className="py-1 pr-3 text-right">
                                      <IconButton label={`${r.form.titleEdit}: ${fullName(p)}`} onClick={() => setEditing(p.id)}>
                                        <Icon name="pencil" className="size-[1.1rem]" />
                                      </IconButton>
                                    </td>
                                  </>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}

      {editing !== null && (
        <PlayerDialog
          key={editing}
          open
          onClose={() => setEditing(null)}
          player={editingPlayer}
          players={players}
          sport={sport}
          workspaceId={workspace.id}
          access={editingPlayer ? access[editingPlayer.id] : undefined}
        />
      )}
      {bulk && <BulkAddDialog open onClose={() => setBulk(false)} sport={sport} workspaceId={workspace.id} />}
      {managing && players.find((p) => p.id === managing) && (
        <AccessDialog
          key={managing}
          player={players.find((p) => p.id === managing)!}
          access={access[managing]}
          team={workspace.name}
          workspaceId={workspace.id}
          onClose={() => setManaging(null)}
          onChanged={refreshAccess}
        />
      )}
    </div>
  );
}
