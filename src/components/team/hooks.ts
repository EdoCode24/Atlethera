"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useApp } from "@/components/app/AppContext";
import { useAccount } from "@/data/account";
import { useRoster } from "@/data/roster";
import { toIsoDay } from "@/domain/team/calendar";
import { localeTags } from "@/i18n/config";

/** The signed-in coach's team: workspace, sport, roster and date formatters for the Coach modules. */
export function useTeam() {
  const { locale } = useApp();
  const { user, workspace } = useAccount();
  const roster = useRoster(workspace?.id);
  const format = useMemo(() => {
    const day = new Intl.DateTimeFormat(localeTags[locale].intl, { dateStyle: "medium" });
    const number = new Intl.NumberFormat(localeTags[locale].intl, { maximumFractionDigits: 1 });
    return {
      /** An ISO date (yyyy-mm-dd), read as a local calendar day. */
      day: (iso: string) => day.format(new Date(`${iso}T00:00:00`)),
      /** A measurement with the locale's decimal mark: 92,5 in Turkish. */
      number: (n: number) => number.format(n),
    };
  }, [locale]);
  const sport = workspace?.package === "coach" ? workspace.sport : null;
  return { user, workspace, sport, roster, format };
}

const noChanges = () => () => {};

/** Today as yyyy-mm-dd in the browser's time zone; null during the server render and hydration. */
export function useToday(): string | null {
  return useSyncExternalStore(noChanges, () => toIsoDay(new Date()), () => null);
}
