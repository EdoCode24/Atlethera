"use client";

import { useState } from "react";
import { useApp } from "@/components/app/AppContext";
import { Button, Choice, Dialog, TextArea, TextField } from "@/components/app/ui";
import { Icon } from "@/components/ui/Icon";
import { removeAccess, type Access } from "@/data/access";
import { rosterRepo } from "@/data/roster";
import { PLAYER_STATUSES, fullName, positionGroups, validatePlayer, type Player, type PlayerError, type PlayerStatus } from "@/domain/team/roster";
import type { SportId } from "@/domain/sports/types";
import { fill } from "@/lib/fill";
import { cn } from "@/lib/cn";

interface Draft {
  firstName: string;
  lastName: string;
  number: string;
  positions: string[];
  status: PlayerStatus;
  injuryNote: string;
  returnDate: string;
  height: string;
  weight: string;
  birthDate: string;
  phone: string;
  email: string;
  notes: string;
}

const toDraft = (p: Player | null): Draft => ({
  firstName: p?.firstName ?? "",
  lastName: p?.lastName ?? "",
  number: p?.number?.toString() ?? "",
  positions: p?.positions ?? [],
  status: p?.status ?? "active",
  injuryNote: p?.injury?.note ?? "",
  returnDate: p?.injury?.returnDate ?? "",
  height: p?.heightCm?.toString() ?? "",
  weight: p?.weightKg?.toString() ?? "",
  birthDate: p?.birthDate ?? "",
  phone: p?.phone ?? "",
  email: p?.email ?? "",
  notes: p?.notes ?? "",
});

/** "" is "not given"; anything else must read as a number (a comma counts as the decimal point). */
const toNumber = (s: string) => (s.trim() === "" ? null : Number(s.trim().replace(",", ".")));

/**
 * Adds a player, or edits one. Mount it with a `key` per player so the fields start from that
 * player's values.
 */
export function PlayerDialog({
  open,
  onClose,
  player,
  players,
  sport,
  workspaceId,
  onDeleted,
  access,
}: {
  open: boolean;
  onClose: () => void;
  /** The player to edit; null adds a new one. */
  player: Player | null;
  /** The whole roster, to warn about a number someone else wears. */
  players: Player[];
  sport: SportId;
  workspaceId: string;
  onDeleted?: () => void;
  /** The player's panel access: a linked account leaves the team with the player. */
  access?: Access;
}) {
  const { t, locale } = useApp();
  const f = t.roster.form;
  const [draft, setDraft] = useState(() => toDraft(player));
  const [errors, setErrors] = useState<PlayerError[]>([]);
  const [confirming, setConfirming] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors([]);
  };
  const error = (e: PlayerError) => (errors.includes(e) ? f.errors[e] : null);

  const number = toNumber(draft.number);
  const numberTaken = number !== null && players.some((p) => p.id !== player?.id && p.number === number);

  const togglePosition = (pos: string) => set("positions", draft.positions.includes(pos) ? draft.positions.filter((p) => p !== pos) : [...draft.positions, pos]);

  const save = () => {
    const fields = {
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      number,
      heightCm: toNumber(draft.height),
      weightKg: toNumber(draft.weight),
      birthDate: draft.birthDate || null,
    };
    const problems = validatePlayer(fields);
    if (problems.length) {
      setErrors(problems);
      return;
    }
    const values = {
      ...fields,
      positions: draft.positions,
      status: draft.status,
      injury: draft.status === "injured" ? { note: draft.injuryNote.trim(), returnDate: draft.returnDate || null } : null,
      phone: draft.phone.trim(),
      email: draft.email.trim(),
      notes: draft.notes.trim(),
    };
    if (player) rosterRepo.update(workspaceId, player.id, values);
    else rosterRepo.add(workspaceId, values);
    onClose();
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        onSubmit={save}
        wide
        title={player ? f.titleEdit : f.titleNew}
        footer={
          <>
            {player && (
              <Button variant="ghost" className="mr-auto text-signal" onClick={() => setConfirming(true)}>
                <Icon name="trash" className="size-[1.1rem]" />
                {f.deleteTitle}
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button type="submit">{player ? t.common.save : f.add}</Button>
          </>
        }
      >
        <div className="space-y-7">
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_9rem]">
            <TextField label={f.firstName} value={draft.firstName} onChange={(e) => set("firstName", e.target.value)} error={error("nameRequired")} autoComplete="off" autoFocus />
            <TextField label={f.lastName} value={draft.lastName} onChange={(e) => set("lastName", e.target.value)} autoComplete="off" />
            <TextField
              label={f.number}
              value={draft.number}
              inputMode="numeric"
              maxLength={2}
              onChange={(e) => set("number", e.target.value.replace(/[^\d]/g, ""))}
              error={error("numberRange")}
              hint={numberTaken ? t.roster.duplicateNumber : undefined}
            />
          </div>

          <fieldset>
            <legend className="text-[0.85rem] font-medium text-chalk-dim">{f.positions}</legend>
            <p className="mt-1 text-[0.82rem] text-mist">{f.positionsHint}</p>
            <div className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {positionGroups(sport).map((g) => (
                <div key={g.id}>
                  <p className="text-[0.8rem] text-mist">{g.name[locale]}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {g.positions.map((pos) => {
                      const order = draft.positions.indexOf(pos);
                      return (
                        <button
                          key={pos}
                          type="button"
                          aria-pressed={order >= 0}
                          aria-label={order === 0 ? `${pos}, ${f.primary}` : pos}
                          onClick={() => togglePosition(pos)}
                          className={cn(
                            "inline-flex min-h-10 min-w-12 items-center justify-center gap-1.5 rounded-[0.6rem] px-3 text-[0.88rem] font-semibold transition-colors",
                            order === 0 ? "bg-volt text-night-950" : order > 0 ? "bg-chalk text-night-950" : "bg-chalk/6 text-chalk-dim hover:text-chalk",
                          )}
                        >
                          {pos}
                          {order === 0 && <Icon name="star" className="size-3.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>

          <div>
            <Choice
              label={f.status}
              value={draft.status}
              onChange={(s) => set("status", s)}
              options={PLAYER_STATUSES.map((s) => ({ value: s, label: t.roster.statuses[s] }))}
            />
            {draft.status === "injured" && (
              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_12rem]">
                <TextField label={f.injuryNote} placeholder={f.injuryPlaceholder} value={draft.injuryNote} onChange={(e) => set("injuryNote", e.target.value)} />
                <TextField label={f.returnDate} type="date" value={draft.returnDate} onChange={(e) => set("returnDate", e.target.value)} />
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label={f.height} inputMode="decimal" value={draft.height} onChange={(e) => set("height", e.target.value)} error={error("heightRange")} />
            <TextField label={f.weight} inputMode="decimal" value={draft.weight} onChange={(e) => set("weight", e.target.value)} error={error("weightRange")} />
            <TextField label={f.birthDate} type="date" value={draft.birthDate} onChange={(e) => set("birthDate", e.target.value)} error={error("birthDate")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label={f.phone} type="tel" autoComplete="off" value={draft.phone} onChange={(e) => set("phone", e.target.value)} />
            <TextField label={f.email} type="email" autoComplete="off" value={draft.email} onChange={(e) => set("email", e.target.value)} />
          </div>

          <TextArea label={f.notes} placeholder={f.notesPlaceholder} value={draft.notes} onChange={(v) => set("notes", v)} />
        </div>
      </Dialog>

      {player && (
        <Dialog
          open={open && confirming}
          onClose={() => setConfirming(false)}
          title={f.deleteTitle}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                {t.common.cancel}
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  if (access?.state === "linked") await removeAccess(workspaceId, access.userId);
                  rosterRepo.remove(workspaceId, player.id);
                  onClose();
                  onDeleted?.();
                }}
              >
                {t.common.delete}
              </Button>
            </>
          }
        >
          <p className="text-chalk-dim">{fill(f.deleteConfirm, { name: fullName(player) })}</p>
          {access?.state === "linked" && <p className="mt-2 text-[0.9rem] text-amber">{t.access.deleteLinked}</p>}
        </Dialog>
      )}
    </>
  );
}
