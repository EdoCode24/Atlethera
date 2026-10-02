import { locale as rootLocale } from "next/root-params";
import { Wordmark } from "@/components/layout/Wordmark";
import { ButtonLink } from "@/components/ui/Button";
import { defaultLocale, isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

export default async function NotFound() {
  const value = await rootLocale();
  const locale = isLocale(value) ? value : defaultLocale;
  const dict = await getDictionary(locale);

  return (
    <main className="container-page flex min-h-dvh flex-col items-start justify-center gap-6 py-24">
      <a href={`/${locale}`} aria-label={dict.nav.home}>
        <Wordmark />
      </a>
      <h1 className="display max-w-[14ch] text-display-lg">{dict.notFound.title}</h1>
      <p className="max-w-[40ch] text-lead text-chalk-dim">{dict.notFound.body}</p>
      <ButtonLink href={`/${locale}`}>{dict.notFound.cta}</ButtonLink>
    </main>
  );
}
