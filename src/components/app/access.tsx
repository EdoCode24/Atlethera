"use client";

import type { ReactNode } from "react";
import { useCanEdit } from "@/data/account";

/**
 * Coaches change things; players only look. These keep the screens honest about it (the store
 * and the server refuse a player's writes anyway):
 * - <EditOnly> renders its children for coaches only: add/edit/delete buttons, dialog triggers.
 * - <ReadOnlyScope> disables every field inside for players, and globals.css makes a disabled
 *   field read as plain text ([data-readonly]).
 */

export { useCanEdit };

export function EditOnly({ children }: { children: ReactNode }) {
  return useCanEdit() ? <>{children}</> : null;
}

export function ReadOnlyScope({ children }: { children: ReactNode }) {
  const canEdit = useCanEdit();
  return (
    <fieldset disabled={!canEdit} data-readonly={!canEdit || undefined} className="contents">
      {children}
    </fieldset>
  );
}
