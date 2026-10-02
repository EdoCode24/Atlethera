import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/app/auth/LoginForm";
import { getAppDictionary } from "@/i18n/app/get-app-dictionary";
import { defaultLocale, isLocale } from "@/i18n/config";

export async function generateMetadata({ params }: PageProps<"/[locale]/login">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getAppDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: `${t.auth.loginTitle} | Atlethera`, robots: { index: false } };
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
