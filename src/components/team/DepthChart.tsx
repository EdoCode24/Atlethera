"use client";

import { useCanEdit } from "@/components/app/access";
import { useApp, useHref } from "@/components/app/AppContext";
import { IconButton } from "@/components/app/ui";
import { Icon } from "@/components/ui/Icon";
import { rosterRepo } from "@/data/roster";
import { fullName, positionGroups, type Player, type Roster } from "@/domain/team/roster";
import type { Side, SportId } from "@/domain/sports/types";
import { fill } from "@/lib/fill";
import { cn } from "@/lib/cn";
import { Jersey } from "./ui";

/** Every position of the sport, side by side, each with its players in order: the starter first. */
export function DepthChart({ roster, sport, workspaceId }: { roster: Roster; sport: SportId; workspaceId: string }) {
  const { t, locale } = useApp();
  const canEdit = useCanEdit();
  const href = useHref();
  const byId = new Map(roster.players.map((p) => [p.id, p]));
  const groups = positionGroups(sport);
  const sides = [...new Set(groups.map((g) => g.side))] as Side[];

  return (
    <div className="space-y-10">
      <p className="max-w-[44rem] text-[0.92rem] text-mist">{canEdit ? t.roster.depth.body : t.roster.depth.bodyReadOnly}</p>
      {sides.map((side) => (
        <section key={side} aria-labelledby={`depth-${side}`}>
          <h2 id={`depth-${side}`} className="text-[1.1rem] font-semibold">
            {t.roster.sides[side]}
          </h2>
          <div className="mt-4 grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups
              .filter((g) => g.side === side)
              .flatMap((g) => g.positions.map((pos) => ({ pos, group: g })))
              .map(({ pos, group }) => {
                const list = (roster.depth[pos] ?? []).map((id) => byId.get(id)).filter((p): p is Player => !!p);
                return (
                  <div key={pos} className="rounded-[var(--radius-card)] bg-night-850 p-4 shadow-[inset_0_0_0_1px_var(--color-hairline)]">
                    <h3 className="flex items-baseline gap-2">
                      <span className="display text-[1.6rem] leading-none">{pos}</span>
                      {/* The group names the position where the abbreviation alone doesn't (FB: running back); special teams already have their heading. */}
                      {side !== "special" && (group.positions.length > 1 || group.abbr !== pos) && group.name[locale].toLocaleLowerCase(locale) !== pos.toLocaleLowerCase(locale) && <span className="text-[0.8rem] text-mist">{group.name[locale]}</span>}
                    </h3>
                    {list.length === 0 ? (
                      <p className="mt-3 text-[0.85rem] text-mist">{t.roster.depth.empty}</p>
                    ) : (
                      <ol className="mt-3 space-y-1">
                        {list.map((p, i) => (
                          <li key={p.id} className={cn("flex items-center gap-2 rounded-[0.6rem] py-1 pr-1 pl-2", i === 0 && "bg-volt/10")}>
                            <span className={cn("tabular w-4 text-[0.8rem] font-semibold", i === 0 ? "text-volt" : "text-mist")} aria-hidden="true">
                              {i + 1}
                            </span>
                            <Jersey number={p.number} className="w-7 text-right text-[1.2rem]" />
                            <span className="min-w-0 flex-1">
                              <a href={href(`/panel/roster/${p.id}`)} className={cn("block truncate text-[0.92rem] font-medium hover:underline", p.status !== "active" && "text-chalk-dim")}>
                                {fullName(p)}
                              </a>
                              {p.status !== "active" && (
                                <span className={cn("block text-[0.75rem] font-semibold", p.status === "injured" ? "text-signal" : "text-mist")}>{t.roster.statuses[p.status]}</span>
                              )}
                            </span>
                            {i === 0 && <span className="sr-only">{t.roster.depth.starter}</span>}
                            {canEdit && list.length > 1 && (
                              <span className="flex">
                                <IconButton
                                  label={fill(t.roster.depth.up, { name: fullName(p) })}
                                  disabled={i === 0}
                                  onClick={() => rosterRepo.moveInDepth(workspaceId, pos, p.id, -1)}
                                  className="size-9"
                                >
                                  <Icon name="arrowDown" className="size-4 rotate-180" />
                                </IconButton>
                                <IconButton
                                  label={fill(t.roster.depth.down, { name: fullName(p) })}
                                  disabled={i === list.length - 1}
                                  onClick={() => rosterRepo.moveInDepth(workspaceId, pos, p.id, 1)}
                                  className="size-9"
                                >
                                  <Icon name="arrowDown" className="size-4" />
                                </IconButton>
                              </span>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
