"use client";

import type { CSSProperties } from "react";
import { useApp } from "@/components/app/AppContext";
import { Icon } from "@/components/ui/Icon";
import { endMarker, norm, polylineD, sub } from "@/domain/playbook/geometry";
import { naturalSide, ROUTE_TREE, templateOffsets, type BreakSide } from "@/domain/playbook/routes";
import type { PlayerSpot, Vec } from "@/domain/playbook/types";
import { cn } from "@/lib/cn";
import { PLAYER_FILL } from "./PlayField";

const flip = (v: Vec): Vec => ({ x: v.x, y: -v.y });
/** The deepest corner of any template in the tree, in yards. */
const DEEPEST = Math.max(...ROUTE_TREE.flatMap((t) => t.points.map((p) => p.y)));

/** A small drawing of one route from the player's spot, facing the way it would be placed. */
function RouteGlyph({ points, color }: { points: Vec[]; color: string }) {
  const path = [{ x: 0, y: 0 }, ...points];
  const tip = path[path.length - 1];
  const marker = endMarker("arrow", tip, norm(sub(tip, path[path.length - 2])), 2.2);
  const common = { fill: "none", stroke: color, strokeWidth: 1.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="-10 -21.5 20 24" aria-hidden="true" className="h-14 w-full">
      <line x1={-10} x2={10} y1={0} y2={0} stroke="currentColor" strokeWidth={0.5} opacity={0.25} />
      <path d={polylineD(path, flip)} {...common} />
      {marker.lines.map((line, i) => (
        <path key={i} d={polylineD(line, flip)} {...common} />
      ))}
      <circle cx={0} cy={0} r={1.5} fill={color} />
    </svg>
  );
}

interface RouteTreeProps {
  /** "column": a slim two-column strip beside the field; "row": one swipeable row (phones). */
  layout?: "column" | "row";
  /** Yards of field above the player on screen; deeper templates are shortened to fit. */
  room?: number;
  player: PlayerSpot;
  fieldWidth: number;
  /** The template last placed on this player, if any. */
  activeId: string | null;
  /** The break side the coach picked; null follows the route tree. */
  side: BreakSide | null;
  onApply: (id: string) => void;
  onSide: (side: BreakSide) => void;
}

/**
 * The template picker: every route of the tree drawn the way it would land on this player, and a
 * left/right switch for the break. A player in the middle of the field has no "near sideline",
 * so the coach picks the side.
 */
export function RouteTree({ layout = "column", room = Infinity, player, fieldWidth, activeId, side, onApply, onSide }: RouteTreeProps) {
  const { t, locale } = useApp();
  const tb = t.playbook.toolbar;
  const color = PLAYER_FILL[player.color].fill;
  const current = side ?? (activeId ? naturalSide(player, activeId, fieldWidth) : null);
  const straight = activeId !== null && naturalSide(player, activeId, fieldWidth) === null;
  const central = Math.abs(player.x - fieldWidth / 2) < fieldWidth * 0.12;

  return (
    <div className="px-2.5 pt-2.5 pb-2">
      <div className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-2", layout === "column" && "flex-col items-stretch")}>
        <p className="text-[0.8rem] font-semibold text-chalk">{tb.templateTitle}</p>
        <div className={cn("flex items-center gap-2", layout === "column" && "flex-col items-stretch gap-1")}>
          <span className="text-[0.75rem] text-mist">{straight ? tb.straight : tb.direction}</span>
          <div role="group" aria-label={tb.direction} className="grid grid-cols-2 rounded-[0.7rem] bg-night-950/70 p-0.5 shadow-[inset_0_0_0_1px_var(--color-hairline)]">
            {(["left", "right"] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={current === s}
                disabled={straight}
                onClick={() => onSide(s)}
                className={cn(
                  "flex h-9 items-center justify-center gap-1 rounded-[0.55rem] px-2.5 text-[0.8rem] font-semibold transition-colors duration-150 disabled:opacity-35",
                  current === s ? "bg-chalk text-night-950" : "text-chalk-dim hover:text-chalk",
                )}
              >
                {s === "left" && <Icon name="chevronLeft" className="size-3.5" />}
                {tb.sides[s]}
                {s === "right" && <Icon name="chevronLeft" className="size-3.5 rotate-180" />}
              </button>
            ))}
          </div>
        </div>
      </div>
      {central && side === null && <p className="mt-1.5 text-[0.75rem] text-amber">{tb.centerHint}</p>}
      {room < DEEPEST && <p className="mt-1.5 text-[0.72rem] leading-snug text-mist">{tb.shrinkNote}</p>}
      <div
        className={cn(
          "mt-2.5 gap-1.5",
          layout === "column" ? "grid grid-cols-2" : "grid auto-cols-[4.6rem] grid-flow-col overflow-x-auto overscroll-contain pb-1",
        )}
      >
        {ROUTE_TREE.map((tpl) => {
          const active = tpl.id === activeId;
          return (
            <button
              key={tpl.id}
              type="button"
              aria-label={`${tpl.id}: ${tpl.name[locale]}`}
              aria-pressed={active}
              onClick={() => onApply(tpl.id)}
              className={cn(
                "group relative flex flex-col items-stretch rounded-[0.7rem] px-1 pt-1 pb-1.5 text-chalk-dim transition-colors duration-150",
                active ? "bg-chalk/12 shadow-[inset_0_0_0_1.5px_var(--tpl-color)]" : "bg-chalk/[0.04] hover:bg-chalk/10 hover:text-chalk",
              )}
              style={{ "--tpl-color": color } as CSSProperties}
            >
              <span className="display absolute top-1 left-1.5 text-[1.05rem] leading-none text-chalk">{tpl.id}</span>
              <RouteGlyph points={templateOffsets(player, tpl.id, fieldWidth, side ?? undefined)} color={active ? color : "currentColor"} />
              <span className="truncate px-0.5 text-center text-[0.68rem] font-semibold">{tpl.name[locale]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
