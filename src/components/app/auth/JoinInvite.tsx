"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { acceptInvite, inviteInfo, type AcceptError, type InviteInfo } from "@/data/access";
import { logOut, switchWorkspace, useAccount } from "@/data/account";
import { sports } from "@/domain/sports";
import type { SportId } from "@/domain/sports/types";
import { fill } from "@/lib/fill";
import { useApp, useHref } from "../AppContext";
import { Button } from "../ui";
import { AuthCard } from "./AuthCard";

/**
 * The page an invite link opens: whose team, which roster record, then sign up (or log in) and
 * join. Coming back here signed in with ?go=1 (from the sign-up form) joins right away.
 */
export function JoinInvite({ token }: { token: string }) {
  const { t, locale } = useApp();
  const href = useHref();
  const router = useRouter();
  const params = useSearchParams();
  const { status, user } = useAccount();
  const j = t.join;
  const [info, setInfo] = useState<InviteInfo | null | undefined>(undefined);
  const [error, setError] = useState<AcceptError | null>(null);
  const [busy, setBusy] = useState(false);
  const autoTried = useRef(false);

  useEffect(() => {
    if (status === "loading" || status === "unconfigured") return;
    let cancelled = false;
    void inviteInfo(token).then((result) => {
      if (!cancelled) setInfo(result);
    });
    return () => {
      cancelled = true;
    };
  }, [token, status, user?.id]);

  const join = useCallback(async () => {
    setBusy(true);
    setError(null);
    const result = await acceptInvite(token);
    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }
    await switchWorkspace(result.workspaceId);
    router.replace(href("/panel"));
  }, [token, router, href]);

  // Just signed up or logged in from this invite: join without another click.
  useEffect(() => {
    if (autoTried.current || !user || info?.status !== "open" || params.get("go") !== "1") return;
    autoTried.current = true;
    void join();
  }, [user, info, params, join]);

  const here = `/${locale}/join/${token}?go=1`;
  // Non-breaking spaces keep "Mehmet K. #7" on one line.
  const name = info?.firstName ? `${info.firstName}${info.lastInitial ? ` ${info.lastInitial}.` : ""}${info.jersey !== null && info.jersey !== undefined ? ` #${info.jersey}` : ""}` : "";
  const sportName = info?.sport && info.sport in sports ? sports[info.sport as SportId].name[locale] : null;

  if (status === "unconfigured") {
    return (
      <AuthCard title={j.title} body={t.auth.unconfigured}>
        <span />
      </AuthCard>
    );
  }
  if (info === undefined || status === "loading") {
    return (
      <AuthCard title={j.title} body={j.loading}>
        <span />
      </AuthCard>
    );
  }
  if (info === null) {
    return (
      <AuthCard title={j.title} body={j.statuses.notFound}>
        <span />
      </AuthCard>
    );
  }

  const closed = info.status !== "open";

  return (
    <AuthCard title={fill(j.invited, { team: info.team })} body={[sportName, name ? fill(j.as, { name }) : null].filter(Boolean).join(". ")}>
      {info.status === "mine" ? (
        <div className="space-y-4">
          <p className="text-chalk-dim">{j.statuses.mine}</p>
          <Button className="w-full" onClick={() => router.replace(href("/panel"))}>
            {j.toPanel}
          </Button>
        </div>
      ) : closed ? (
        <p className="text-chalk-dim">{j.statuses[info.status as "used" | "expired" | "revoked"]}</p>
      ) : user ? (
        <div className="space-y-4">
          <p className="text-[0.92rem] text-chalk-dim">{j.readOnly}</p>
          <p className="text-[0.9rem] text-mist">{fill(j.signedInAs, { email: user.email })}</p>
          <Button className="w-full" onClick={join} disabled={busy}>
            {j.accept}
          </Button>
          <button
            type="button"
            onClick={async () => {
              await logOut();
              router.replace(`/${locale}/login?next=${encodeURIComponent(here)}`);
            }}
            className="w-full text-center text-[0.88rem] font-semibold text-mist underline underline-offset-4 hover:text-chalk"
          >
            {j.switchAccount}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[0.92rem] text-chalk-dim">{j.readOnly}</p>
          <a
            href={`/${locale}/signup?next=${encodeURIComponent(here)}${info.firstName ? `&name=${encodeURIComponent(info.firstName)}` : ""}`}
            className="flex h-11 w-full items-center justify-center rounded-[0.7rem] bg-volt px-5 font-semibold text-night-950 hover:bg-volt-soft"
          >
            {j.signup}
          </a>
          <a
            href={`/${locale}/login?next=${encodeURIComponent(here)}`}
            className="flex h-11 w-full items-center justify-center rounded-[0.7rem] px-5 font-semibold text-chalk shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] hover:bg-chalk/6"
          >
            {j.login}
          </a>
        </div>
      )}
      {error && (
        <p className="mt-4 text-[0.9rem] text-signal" role="alert">
          {j.errors[error]}
        </p>
      )}
    </AuthCard>
  );
}
