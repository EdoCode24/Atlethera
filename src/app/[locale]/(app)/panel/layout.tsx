import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppProvider } from "@/components/app/AppContext";
import { AppShell } from "@/components/app/AppShell";
import { getAppDictionary } from "@/i18n/app/get-app-dictionary";
import { isLocale } from "@/i18n/config";
import { supabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServer, currentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Atlethera", robots: { index: false } };

export default async function PanelLayout({ children, params }: LayoutProps<"/[locale]/panel">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getAppDictionary(locale);

  // Signed-out visitors and accounts without a team go where they belong before any panel renders.
  // (Without the Supabase keys the shell explains what is missing instead.)
  if (supabaseEnv()) {
    const user = await currentUser();
    if (!user) redirect(`/${locale}/login`);
    const supabase = await createSupabaseServer();
    const { count } = await supabase.from("memberships").select("workspace_id", { count: "exact", head: true }).eq("user_id", user.id);
    if (!count) redirect(`/${locale}/onboarding`);
  }

  return (
    <AppProvider locale={locale} t={t}>
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}
