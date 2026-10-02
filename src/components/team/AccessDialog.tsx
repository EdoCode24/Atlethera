"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useApp } from "@/components/app/AppContext";
import { Button, Dialog } from "@/components/app/ui";
import { Icon } from "@/components/ui/Icon";
import { createInvite, inviteUrl, removeAccess, revokeInvite, whatsappUrl, type Access, type InviteError } from "@/data/access";
import { fullName, type Player } from "@/domain/team/roster";
import { localeTags } from "@/i18n/config";
import { fill } from "@/lib/fill";
import { cn } from "@/lib/cn";

const TONE: Record<Access["state"], string> = {
  none: "text-mist",
  pending: "text-amber",
  linked: "text-volt",
};

/** A player's panel access as a small label (with a dot the colour of the state). */
export function AccessChip({ access, className }: { access: Access | undefined; className?: string }) {
  const { t } = useApp();
  const state = access?.state ?? "none";
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[0.82rem] font-medium", TONE[state], className)}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", state === "linked" ? "bg-volt" : state === "pending" ? "bg-amber" : "bg-mist/60")} />
      {t.access.states[state]}
    </span>
  );
}

const noChanges = () => () => {};

/** Invite links and linked accounts for one player: create, copy, send, revoke, remove. */
export function AccessDialog({ player, access, team, workspaceId, onClose, onChanged }: { player: Player; access: Access | undefined; team: string; workspaceId: string; onClose: () => void; onChanged: () => void }) {
  const { t, locale } = useApp();
  const a = t.access;
  const origin = useSyncExternalStore(noChanges, () => window.location.origin, () => "");
  const canShare = useSyncExternalStore(noChanges, () => typeof navigator.share === "function", () => false);
  const [token, setToken] = useState<string | null>(access?.state === "pending" ? access.token : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<InviteError | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const day = useMemo(() => new Intl.DateTimeFormat(localeTags[locale].intl, { day: "numeric", month: "long", year: "numeric" }), [locale]);
  const name = fullName(player);
  const url = token ? inviteUrl(origin, locale, token) : "";
  const message = fill(a.message, { team, url });

  const create = async () => {
    setBusy(true);
    setError(null);
    const result = await createInvite(workspaceId, player.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setToken(result.token);
    setCopied(false);
    onChanged();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard blocked: the field is selectable.
    }
  };

  const linked = access?.state === "linked" ? access : null;
  const expiresAt = access?.state === "pending" && access.token === token ? access.expiresAt : null;

  return (
    <Dialog
      open
      onClose={onClose}
      title={fill(a.manageOf, { name })}
      footer={
        <Button variant="ghost" onClick={onClose}>
          {t.common.close}
        </Button>
      }
    >
      {linked ? (
        <div className="space-y-4">
          <p className="text-chalk-dim">{fill(a.linkedBody, { name: linked.name || name, date: day.format(new Date(linked.since)) })}</p>
          {confirmRemove ? (
            <div className="rounded-[var(--radius-card)] bg-signal/10 p-4 shadow-[inset_0_0_0_1px_rgb(255_106_61/0.35)]">
              <p className="text-[0.92rem]">{fill(a.removeConfirm, { name: linked.name || name })}</p>
              <div className="mt-3 flex gap-2">
                <Button variant="ghost" className="h-10" onClick={() => setConfirmRemove(false)}>
                  {t.common.cancel}
                </Button>
                <Button
                  variant="danger"
                  className="h-10"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    await removeAccess(workspaceId, linked.userId);
                    setBusy(false);
                    onChanged();
                    onClose();
                  }}
                >
                  {a.remove}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" className="text-signal" onClick={() => setConfirmRemove(true)}>
              {a.remove}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-[0.95rem] text-chalk-dim">{a.body}</p>
          {token ? (
            <>
              <label className="block">
                <span className="text-[0.85rem] font-medium text-chalk-dim">{a.link}</span>
                <input
                  readOnly
                  value={url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="mt-2 h-12 w-full rounded-[0.7rem] bg-night-950/70 px-3.5 text-[0.9rem] text-chalk shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] outline-none focus:shadow-[inset_0_0_0_1.5px_var(--color-chalk)]"
                />
              </label>
              {expiresAt && <p className="-mt-3 text-[0.82rem] text-mist">{fill(a.expires, { date: day.format(new Date(expiresAt)) })}</p>}
              <div className="flex flex-wrap gap-2">
                <Button onClick={copy}>
                  <Icon name={copied ? "check" : "copy"} className="size-4" />
                  {copied ? a.copied : a.copy}
                </Button>
                <a href={whatsappUrl(message)} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-[0.7rem] px-4 font-semibold text-chalk shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] hover:bg-chalk/6">
                  {a.whatsapp}
                </a>
                {player.email && (
                  <a
                    href={`mailto:${player.email}?subject=${encodeURIComponent(fill(a.mailSubject, { team }))}&body=${encodeURIComponent(message)}`}
                    className="inline-flex h-11 items-center gap-2 rounded-[0.7rem] px-4 font-semibold text-chalk shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] hover:bg-chalk/6"
                  >
                    {a.email}
                  </a>
                )}
                {canShare && (
                  <Button variant="ghost" onClick={() => void navigator.share({ text: message }).catch(() => {})}>
                    <Icon name="share" className="size-4" />
                    {a.share}
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 border-t border-hairline pt-4">
                <Button variant="ghost" className="h-10 text-[0.88rem]" disabled={busy} onClick={create}>
                  {a.renew}
                </Button>
                <Button
                  variant="ghost"
                  className="h-10 text-[0.88rem] text-signal"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    await revokeInvite(token);
                    setBusy(false);
                    setToken(null);
                    onChanged();
                  }}
                >
                  {a.revoke}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-[0.92rem] text-mist">{fill(a.noneBody, { name })}</p>
              <Button onClick={create} disabled={busy}>
                <Icon name="plus" className="size-4" />
                {a.create}
              </Button>
            </>
          )}
          {error && (
            <p className="text-[0.88rem] text-signal" role="alert">
              {a.errors[error]}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
