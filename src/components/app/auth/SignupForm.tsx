"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PASSWORD_MIN, signUp, type SignUpError } from "@/data/account";
import { safeNext, useApp, useHref } from "../AppContext";
import { Button, TextField } from "../ui";
import { AuthCard } from "./AuthCard";

export function SignupForm() {
  const { t, locale } = useApp();
  const href = useHref();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"), locale);
  // An invite passes the player's first name along.
  const [name, setName] = useState(() => params.get("name") ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<SignUpError | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const result = await signUp({ name, email, password });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Invited players go back to their invite; coaches set up their team.
    if (next) {
      router.push(next);
      return;
    }
    const pkg = params.get("package");
    router.push(href(`/onboarding${pkg === "pt" || pkg === "coach" ? `?package=${pkg}` : ""}`));
  };

  const msg = (fields: SignUpError[]) => (error && fields.includes(error) ? t.auth.errors[error] : null);
  const failed = error === "failed" ? t.auth.errors.failed : null;

  return (
    <AuthCard
      title={t.auth.signupTitle}
      body={t.auth.signupBody}
      footer={
        <>
          {t.auth.haveAccount}{" "}
          <a href={href(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`)} className="font-semibold text-chalk underline decoration-hairline-strong underline-offset-4 hover:decoration-chalk">
            {t.auth.toLogin}
          </a>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        <TextField label={t.auth.name} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={msg(["nameRequired"])} required />
        <TextField
          label={t.auth.email}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={msg(["emailInvalid", "emailTaken"])}
          required
        />
        <TextField
          label={t.auth.password}
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={t.auth.passwordHint}
          error={msg(["passwordShort"])}
          required
        />
        {failed && <p className="text-[0.88rem] text-signal">{failed}</p>}
        <Button type="submit" disabled={busy} className="w-full">
          {t.auth.signupCta}
        </Button>
      </form>
    </AuthCard>
  );
}
