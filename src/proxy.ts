import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { updateSession } from "@/lib/supabase/proxy";

/** Picks the best supported locale from an Accept-Language header, honoring q-values. */
function fromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { base: tag.toLowerCase().split("-")[0], q: q ? Number(q.slice(2)) : 1 };
    })
    .filter((entry) => entry.base && Number.isFinite(entry.q) && entry.q > 0)
    .sort((a, b) => b.q - a.q);
  return ranked.map((entry) => entry.base).find((base): base is Locale => isLocale(base)) ?? null;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1];
  if (isLocale(first)) {
    // Signed-in visitors get their session refreshed; the marketing pages skip the auth round trip.
    const signedIn = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
    return signedIn ? updateSession(request) : NextResponse.next();
  }

  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookie) ? cookie : (fromAcceptLanguage(request.headers.get("accept-language")) ?? defaultLocale);

  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  const response = NextResponse.redirect(url, 307);
  response.headers.set("Vary", "Accept-Language, Cookie");
  return response;
}

export const config = {
  // Skip Next internals and any path with a file extension (sitemap.xml, robots.txt, icon.svg…).
  matcher: ["/((?!_next|_vercel|api|.*\\..*).*)"],
};

