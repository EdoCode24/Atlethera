"use client";

import { useMemo } from "react";
import { useApp } from "@/components/app/AppContext";
import { useAccount } from "@/data/account";
import { usePlaybooks } from "@/data/playbooks";
import { localeTags } from "@/i18n/config";

/** The signed-in coach's workspace, playbooks and a date formatter. */
export function usePlaybookContext() {
  const { locale } = useApp();
  const { user, workspace } = useAccount();
  const books = usePlaybooks(workspace?.id);
  const formatDate = useMemo(() => {
    const f = new Intl.DateTimeFormat(localeTags[locale].intl, { dateStyle: "medium", timeStyle: "short" });
    return (iso: string) => f.format(new Date(iso));
  }, [locale]);
  return { user, workspace, books, formatDate };
}
