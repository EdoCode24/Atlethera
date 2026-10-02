"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createWorkspace, useAccount, type PackageId } from "@/data/account";
import { useHydrated } from "@/data/store";
import { sports, sportOrder } from "@/domain/sports";
import type { SportId } from "@/domain/sports/types";
import { cn } from "@/lib/cn";
import { fill } from "@/lib/fill";
import { useApp, useHref } from "../AppContext";
import { Button, TextField } from "../ui";
import { AuthCard } from "./AuthCard";

function Option({ selected, onSelect, title, body }: { selected: boolean; onSelect: () => void; title: string; body?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col items-start rounded-[var(--radius-card)] p-5 text-left transition-colors",
        selected ? "bg-chalk text-night-950" : "bg-night-900 shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] hover:bg-night-800",
      )}
    >
      <span className="display text-[1.9rem] leading-none">{title}</span>
      {body && <span className={cn("mt-2 text-[0.9rem]", selected ? "text-night-800" : "text-chalk-dim")}>{body}</span>}
    </button>
  );
}

/** Package → sport (Coach only) → name, then the workspace is created. */
export function Onboarding() {
  const { t, locale } = useApp();
  const href = useHref();
  const router = useRouter();
  const params = useSearchParams();
  const hydrated = useHydrated();
  const { user, workspace } = useAccount();
  const preset = params.get("package");
  const [pkg, setPkg] = useState<PackageId | null>(preset === "pt" || preset === "coach" ? preset : null);
  const [sport, setSport] = useState<SportId | null>(null);
  const [name, setName] = useState("");
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) router.replace(href("/login"));
    else if (workspace) router.replace(href("/panel"));
  }, [hydrated, user, workspace, router, href]);

  const steps = pkg === "pt" ? ["package", "name"] : ["package", "sport", "name"];
  const current = steps[step];
  const o = t.onboarding;

  const canContinue = current === "package" ? pkg !== null : current === "sport" ? sport !== null : true;

  const next = async () => {
    if (current !== "name") {
      setStep(step + 1);
      return;
    }
    if (!name.trim()) {
      setError(o.nameRequired);
      return;
    }
    setBusy(true);
    const created = await createWorkspace({ package: pkg!, sport: pkg === "coach" ? sport : null, name });
    setBusy(false);
    if (created) router.replace(href("/panel"));
    else setError(t.auth.errors.failed);
  };

  if (!hydrated || !user) return null;

  const titles: Record<string, [string, string]> = {
    package: [o.packageTitle, o.packageBody],
    sport: [o.sportTitle, o.sportBody],
    name: pkg === "coach" ? [o.nameTitleCoach, o.nameBodyCoach] : [o.nameTitlePt, o.nameBodyPt],
  };

  return (
    <AuthCard wide title={titles[current][0]} body={titles[current][1]}>
      <form
        noValidate
        onSubmit={(e) => {
          // Enter in the name field finishes, like the button.
          e.preventDefault();
          if (canContinue) next();
        }}
      >
        <p className="mb-4 text-[0.82rem] font-semibold text-mist">{fill(o.step, { n: step + 1, total: steps.length })}</p>
        {current === "package" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Option selected={pkg === "pt"} onSelect={() => setPkg("pt")} title={o.pt.title} body={o.pt.body} />
            <Option selected={pkg === "coach"} onSelect={() => setPkg("coach")} title={o.coach.title} body={o.coach.body} />
          </div>
        )}
        {current === "sport" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {sportOrder.map((id) => (
              <Option key={id} selected={sport === id} onSelect={() => setSport(id)} title={sports[id].name[locale]} />
            ))}
          </div>
        )}
        {current === "name" && (
          <TextField
            label={pkg === "coach" ? o.nameTitleCoach : o.nameTitlePt}
            placeholder={pkg === "coach" ? o.namePlaceholderCoach : o.namePlaceholderPt}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            error={error}
            autoFocus
          />
        )}
        <div className="mt-8 flex justify-between gap-3">
          <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
            {t.common.back}
          </Button>
          <Button type="submit" disabled={!canContinue || busy}>
            {current === "name" ? o.finish : o.next}
          </Button>
        </div>
      </form>
    </AuthCard>
  );
}
