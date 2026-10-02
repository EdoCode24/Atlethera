"use client";

import { useState } from "react";
import { useApp } from "@/components/app/AppContext";
import { Button, Dialog, TextArea, TextField } from "@/components/app/ui";
import { Icon } from "@/components/ui/Icon";
import { evaluationRepo } from "@/data/evaluation";
import { RATINGS, averageRating, type Criterion, type Evaluation } from "@/domain/team/evaluation";
import { fullName, type Player } from "@/domain/team/roster";
import { fill } from "@/lib/fill";
import { cn } from "@/lib/cn";
import { RatingMeter, useRatingFormat } from "./parts";

/** Rates a player on each criterion (a second tap on a rating clears it), with notes. */
export function EvaluationDialog({
  player,
  criteria,
  evaluation,
  today,
  workspaceId,
  onClose,
}: {
  player: Player;
  criteria: Criterion[];
  /** The evaluation to edit; null starts a new one dated today. */
  evaluation: Evaluation | null;
  today: string;
  workspaceId: string;
  onClose: () => void;
}) {
  const { t } = useApp();
  const e = t.evaluation;
  const rating = useRatingFormat();
  const [date, setDate] = useState(evaluation?.date ?? today);
  const [ratings, setRatings] = useState<Record<string, number>>(evaluation?.ratings ?? {});
  const [strengths, setStrengths] = useState(evaluation?.strengths ?? "");
  const [improve, setImprove] = useState(evaluation?.improve ?? "");
  const [notes, setNotes] = useState(evaluation?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const mean = averageRating(ratings, criteria);

  const save = () => {
    if (mean === null) {
      setError(e.ratingsRequired);
      return;
    }
    evaluationRepo.saveEvaluation(workspaceId, criteria, { playerId: player.id, date, ratings, strengths: strengths.trim(), improve: improve.trim(), notes: notes.trim() }, evaluation?.id ?? null);
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      onSubmit={save}
      wide
      title={fill(e.dialogTitle, { name: fullName(player) })}
      footer={
        <>
          {evaluation && (
            <Button
              variant="ghost"
              className="mr-auto text-signal"
              onClick={() => {
                evaluationRepo.removeEvaluation(workspaceId, evaluation.id);
                onClose();
              }}
            >
              <Icon name="trash" className="size-[1.1rem]" />
              {e.deleteEvaluation}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit">{t.common.save}</Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="max-w-[12rem]">
          <TextField label={e.date} type="date" value={date} onChange={(ev) => setDate(ev.target.value)} />
        </div>

        <fieldset>
          <legend className="sr-only">{e.criteriaTitle}</legend>
          <ul className="divide-y divide-hairline rounded-[var(--radius-card)] shadow-[inset_0_0_0_1px_var(--color-hairline)]">
            {criteria.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
                <span className="font-medium" id={`crit-${c.id}`}>
                  {c.name}
                </span>
                <span role="group" aria-labelledby={`crit-${c.id}`} className="flex gap-1">
                  {RATINGS.map((n) => {
                    const on = ratings[c.id] === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={on}
                        aria-label={fill(e.ratingOf, { criterion: c.name, n })}
                        onClick={() => {
                          setError(null);
                          setRatings((r) => {
                            const next = { ...r };
                            if (next[c.id] === n) delete next[c.id];
                            else next[c.id] = n;
                            return next;
                          });
                        }}
                        className={cn(
                          "tabular grid size-10 place-items-center rounded-[0.6rem] text-[0.95rem] font-semibold transition-colors",
                          on ? "bg-volt text-night-950" : (ratings[c.id] ?? 0) > n ? "bg-volt/20 text-chalk" : "bg-chalk/6 text-chalk-dim hover:text-chalk",
                        )}
                      >
                        {n}
                      </button>
                    );
                  })}
                </span>
              </li>
            ))}
          </ul>
          <p className={cn("mt-2 flex items-center gap-3 text-[0.9rem]", error ? "text-signal" : "text-chalk-dim")} aria-live="polite">
            {error ??
              (mean !== null && (
                <>
                  <RatingMeter value={mean} />
                  {fill(e.average, { value: rating(mean) })}
                </>
              ))}
          </p>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextArea label={e.strengths} value={strengths} onChange={setStrengths} />
          <TextArea label={e.improve} value={improve} onChange={setImprove} />
        </div>
        <TextArea label={e.notes} value={notes} onChange={setNotes} />
      </div>
    </Dialog>
  );
}
