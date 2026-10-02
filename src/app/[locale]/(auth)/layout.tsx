import { notFound } from "next/navigation";
import { AppProvider } from "@/components/app/AppContext";
import { LocaleSwitch } from "@/components/app/ui";
import { Wordmark } from "@/components/layout/Wordmark";
import { FieldTexture } from "@/components/ui/FieldTexture";
import { getAppDictionary } from "@/i18n/app/get-app-dictionary";
import { isLocale } from "@/i18n/config";

export default async function AuthLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getAppDictionary(locale);

  return (
    <AppProvider locale={locale} t={t}>
      <div className="relative flex min-h-dvh flex-col overflow-hidden">
        <div aria-hidden="true" className="auth-ground pointer-events-none absolute inset-0">
          <FieldTexture />
        </div>
        <header className="container-page relative flex h-18 items-center justify-between">
          <a href={`/${locale}`} aria-label={t.common.toSite} className="rounded-md">
            <Wordmark />
          </a>
          <div className="flex items-center gap-4">
            <LocaleSwitch />
            {/* The wordmark links to the site too; the narrowest phones keep only that. */}
            <a href={`/${locale}`} className="hidden text-[0.9rem] text-mist transition-colors hover:text-chalk min-[400px]:block">
              {t.common.toSite}
            </a>
          </div>
        </header>
        <main id="main" className="container-page relative flex flex-1 items-start justify-center py-10 sm:items-center">
          {children}
        </main>
      </div>
    </AppProvider>
  );
}
