import type { Metadata } from "next";
import { Suspense } from "react";
import { SignupForm } from "@/components/app/auth/SignupForm";
import { getAppDictionary } from "@/i18n/app/get-app-dictionary";
import { defaultLocale, isLocale } from "@/i18n/config";

export async function generateMetadata({ params }: PageProps<"/[locale]/signup">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getAppDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: `${t.auth.signupTitle} | Atlethera`, robots: { index: false } };
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
