"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { logIn, useAccount } from "@/data/account";
import { safeNext, useApp, useHref } from "../AppContext";
import { Button, TextField } from "../ui";
import { AuthCard } from "./AuthCard";

export function LoginForm() {
  const { t, locale } = useApp();
  const href = useHref();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"), locale);
  const { user, status } = useAccount();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A signed-in visitor has nothing to do here.
  useEffect(() => {
    if (user) router.replace(next ?? href("/panel"));
  }, [user, router, href, next]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const result = await logIn({ email, password });
    setBusy(false);
    if (!result.ok) setError(result.error === "invalid" ? t.auth.errors.invalid : t.auth.errors.failed);
  };

  return (
    <AuthCard
      title={t.auth.loginTitle}
      body={t.auth.loginBody}
      footer={
        <>
          {t.auth.noAccount}{" "}
          <a href={href(`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`)} className="font-semibold text-chalk underline decoration-hairline-strong underline-offset-4 hover:decoration-chalk">
            {t.auth.toSignup}
          </a>
        </>
      }
    >
      {status === "unconfigured" && <p className="mb-5 text-[0.9rem] text-signal">{t.auth.unconfigured}</p>}
      <form onSubmit={submit} noValidate className="space-y-5">
        <TextField label={t.auth.email} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <TextField
          label={t.auth.password}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error}
          required
        />
        <Button type="submit" disabled={busy} className="w-full">
          {t.auth.loginCta}
        </Button>
      </form>
    </AuthCard>
  );
}
