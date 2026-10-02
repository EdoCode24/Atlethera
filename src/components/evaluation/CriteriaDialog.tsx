"use client";

import { useState } from "react";
import { useApp } from "@/components/app/AppContext";
import { Button, Dialog, IconButton } from "@/components/app/ui";
import { Icon } from "@/components/ui/Icon";
import { evaluationRepo } from "@/data/evaluation";
import { newId } from "@/domain/playbook/formations";
import type { Criterion } from "@/domain/team/evaluation";
import { fill } from "@/lib/fill";

/** Names, adds and removes the criteria players are rated on. Ids stay, so renaming keeps old ratings. */
export function CriteriaDialog({ criteria, workspaceId, onClose }: { criteria: Criterion[]; workspaceId: string; onClose: () => void }) {
  const { t } = useApp();
  const e = t.evaluation;
  const [items, setItems] = useState(criteria);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const kept = items.map((c) => ({ ...c, name: c.name.trim() })).filter((c) => c.name);
    if (!kept.length) {
      setError(e.criteriaEmpty);
      return;
    }
    evaluationRepo.setCriteria(workspaceId, kept);
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      onSubmit={save}
      title={e.criteriaTitle}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit">{t.common.save}</Button>
        </>
      }
    >
      <p className="text-[0.95rem] text-chalk-dim">{e.criteriaBody}</p>
      <ul className="mt-4 space-y-2">
        {items.map((c, i) => (
          <li key={c.id} className="flex items-center gap-2">
            <label className="flex-1">
              <span className="sr-only">{e.criterionName}</span>
              <input
                value={c.name}
                autoFocus={i === items.length - 1 && c.name === ""}
                onChange={(ev) => {
                  setError(null);
                  setItems(items.map((x) => (x.id === c.id ? { ...x, name: ev.target.value } : x)));
                }}
                className="h-11 w-full rounded-[0.7rem] bg-night-950/70 px-3.5 text-chalk shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] outline-none focus:shadow-[inset_0_0_0_1.5px_var(--color-chalk)]"
              />
            </label>
            <IconButton label={fill(e.removeCriterion, { name: c.name })} onClick={() => setItems(items.filter((x) => x.id !== c.id))} className="hover:text-signal">
              <Icon name="trash" className="size-[1.1rem]" />
            </IconButton>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-[0.88rem] text-signal">{error}</p>}
      <Button variant="ghost" className="mt-3 h-10 px-3.5 text-[0.88rem]" onClick={() => setItems([...items, { id: newId("cr"), name: "" }])}>
        <Icon name="plus" className="size-4" />
        {e.addCriterion}
      </Button>
    </Dialog>
  );
}
