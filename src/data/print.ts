"use client";

import type { PrintFormat, PrintSettings } from "@/domain/playbook/print";
import { read, useStored, write } from "./store";

/** Print settings per format, as last used in this workspace. Values are checked on read (sanitizeSettings). */
export type StoredPrintSettings = Partial<Record<PrintFormat, unknown>>;

const NONE: StoredPrintSettings = {};
const key = (workspaceId: string) => `print.${workspaceId}`;

export function useStoredPrintSettings(workspaceId: string): StoredPrintSettings {
  return useStored(key(workspaceId), NONE);
}

export function savePrintSettings(workspaceId: string, format: PrintFormat, settings: PrintSettings) {
  write(key(workspaceId), { ...read(key(workspaceId), NONE), [format]: settings });
}
