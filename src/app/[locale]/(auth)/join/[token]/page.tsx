import type { Metadata } from "next";
import { JoinInvite } from "@/components/app/auth/JoinInvite";
import { getAppDictionary } from "@/i18n/app/get-app-dictionary";
import { defaultLocale, isLocale } from "@/i18n/config";

/** Invite tokens are only known at request time. */
export const dynamicParams = true;

export async function generateMetadata({ params }: PageProps<"/[locale]/join/[token]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getAppDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: `${t.join.title} | Atlethera`, robots: { index: false } };
}

export default async function JoinPage({ params }: PageProps<"/[locale]/join/[token]">) {
  const { token } = await params;
  return <JoinInvite token={token} />;
}
