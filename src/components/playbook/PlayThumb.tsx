"use client";

import type { Play, Playbook } from "@/domain/playbook/types";
import { PlayField, staticView } from "./PlayField";

/** A play as the playbook shows it in its grid: the whole width, backfield to downfield. */
export function PlayThumb({ book, play, className }: { book: Pick<Playbook, "sport" | "fieldWidth" | "fieldLines">; play: Play; className?: string }) {
  const special = play.side === "special";
  const facing = special && play.settings.showOpponent ? play.opponent : undefined;
  // Special teams: framed on the units, with bigger tokens.
  const frame = staticView(book.sport, book.fieldWidth, play.settings, play.players, play.side, facing, 14, 4 / 2.8, special ? 1.5 : 1, special);
  return (
    <PlayField
      sport={book.sport}
      fieldWidth={book.fieldWidth}
      fieldLines={book.fieldLines}
      settings={play.settings}
      players={play.players}
      opponent={play.opponent}
      view={frame}
      sizeScale={special ? 1.5 : 1}
      goalBehind={play.side === "defense"}
      className={className}
    />
  );
}
