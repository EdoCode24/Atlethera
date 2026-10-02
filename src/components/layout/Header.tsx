"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { scrollToTarget, useLenis } from "@/components/providers/SmoothScroll";
import { buttonClass } from "@/components/ui/Button";
import { navSections, sectionIds } from "@/content/site";
import type { Dictionary } from "@/i18n/dictionaries/tr";
import { LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { MQ } from "@/lib/gsap";
import { Wordmark } from "./Wordmark";

interface HeaderProps {
  locale: Locale;
  nav: Dictionary["nav"];
}

const allSections = Object.values(sectionIds);

export function Header({ locale, nav }: HeaderProps) {
  const [hidden, setHidden] = useState(false);
  const [solid, setSolid] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lenisRef = useLenis();
  const otherLocale: Locale = locale === "tr" ? "en" : "tr";

  // Hide on the way down, return on the way up; draw the progress bar without re-rendering.
  useEffect(() => {
    const reduce = window.matchMedia(MQ.reduce);
    let lastY = window.scrollY;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progressRef.current?.style.setProperty("transform", `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`);
      setSolid(y > 24);
      if (reduce.matches || y < 160) setHidden(false);
      else if (y > lastY + 6) setHidden(true);
      else if (y < lastY - 6) setHidden(false);
      lastY = y;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // The section crossing the middle of the viewport is the active one.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const id of allSections) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const lenis = lenisRef.current;
    if (menuOpen) lenis?.stop();
    else lenis?.start();
  }, [menuOpen, lenisRef]);

  const go = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    const wasOpen = menuOpen;
    if (wasOpen) {
      dialogRef.current?.close();
      lenisRef.current?.start();
    }
    scrollToTarget(lenisRef.current, target);
    history.replaceState(null, "", `#${id}`);
    target.focus({ preventScroll: true });
  };

  const rememberLocale = () => {
    document.cookie = `${LOCALE_COOKIE}=${otherLocale}; path=/; max-age=31536000; samesite=lax`;
  };

  const languageHref = `/${otherLocale}${active && active !== sectionIds.top ? `#${active}` : ""}`;

  const openMenu = () => {
    dialogRef.current?.showModal();
    setMenuOpen(true);
  };

  return (
    <>
      <a
        href="#main"
        className="fixed left-4 top-3 z-[80] -translate-y-24 rounded-md bg-volt px-4 py-2 font-semibold text-night-950 focus-visible:translate-y-0"
      >
        {nav.skip}
      </a>

      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-[transform,background-color,box-shadow] duration-500 ease-(--ease-out-expo)",
          hidden && !menuOpen && "-translate-y-full",
          solid ? "bg-night-950/75 shadow-[0_1px_0_var(--color-hairline)] backdrop-blur-md" : "bg-transparent",
        )}
      >
        <div className="container-page flex h-18 items-center gap-6">
          <a href={`/${locale}`} aria-label={nav.home} className="rounded-md">
            <Wordmark />
          </a>

          <nav aria-label={nav.primary} className="ml-auto hidden lg:block">
            <ul className="flex items-center gap-1">
              {navSections.map((id) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    onClick={(e) => go(e, id)}
                    aria-current={active === id ? "location" : undefined}
                    className={cn(
                      "relative rounded-md px-3 py-2 text-[0.92rem] transition-colors duration-300",
                      active === id ? "text-chalk" : "text-mist hover:text-chalk",
                    )}
                  >
                    {nav.links[id]}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute inset-x-3 -bottom-0.5 h-px origin-left bg-volt transition-transform duration-500 ease-(--ease-out-expo)",
                        active === id ? "scale-x-100" : "scale-x-0",
                      )}
                    />
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:ml-2">
            <a
              href={languageHref}
              hrefLang={otherLocale}
              lang={otherLocale}
              onClick={rememberLocale}
              aria-label={nav.switchLabel}
              className="grid h-10 min-w-10 place-items-center rounded-md px-2 text-[0.8rem] font-semibold tracking-[0.06em] text-mist shadow-[inset_0_0_0_1px_var(--color-hairline)] transition-colors hover:text-chalk"
            >
              {otherLocale.toUpperCase()}
            </a>
            <a href={`/${locale}/login`} className="hidden rounded-md px-3 py-2 text-[0.92rem] text-chalk-dim transition-colors hover:text-chalk sm:block">
              {nav.login}
            </a>
            <span className="hidden sm:block">
              <a href={`/${locale}/signup`} className={buttonClass("primary", "h-10 px-4 text-[0.88rem]")}>
                {nav.signup}
              </a>
            </span>
            <button
              type="button"
              onClick={openMenu}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              className="grid size-10 place-items-center rounded-md text-chalk shadow-[inset_0_0_0_1px_var(--color-hairline)] lg:hidden"
            >
              <span className="sr-only">{nav.menu}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
                <path d="M4 8h16M4 16h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px overflow-hidden">
          <div ref={progressRef} className="h-full origin-left scale-x-0 bg-volt/80" />
        </div>
      </header>

      <dialog
        ref={dialogRef}
        onClose={() => setMenuOpen(false)}
        data-lenis-prevent
        aria-label={nav.primary}
        className="m-0 h-dvh max-h-none w-full max-w-none bg-night-950/96 p-0 text-chalk backdrop:bg-transparent open:flex open:flex-col"
      >
        <div className="container-page flex h-18 shrink-0 items-center justify-between">
          <Wordmark />
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="grid size-10 place-items-center rounded-md shadow-[inset_0_0_0_1px_var(--color-hairline)]"
          >
            <span className="sr-only">{nav.close}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <nav aria-label={nav.primary} className="container-page flex flex-1 flex-col justify-center pb-16">
          <ul className="flex flex-col gap-1">
            {navSections.map((id) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  onClick={(e) => go(e, id)}
                  className="display block py-1.5 text-[clamp(2.6rem,11vw,4rem)] leading-[0.95] text-chalk transition-colors hover:text-volt"
                >
                  {nav.links[id]}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap gap-3">
            <a href={`/${locale}/signup`} className={buttonClass("primary")}>
              {nav.signup}
            </a>
            <a href={`/${locale}/login`} className={buttonClass("ghost")}>
              {nav.login}
            </a>
          </div>
        </nav>
      </dialog>
    </>
  );
}
