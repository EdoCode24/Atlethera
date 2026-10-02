"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LogoMark, Wordmark } from "@/components/layout/Wordmark";
import { LiveBanner } from "@/components/meetings/live/LiveBanner";
import { Icon, type IconName } from "@/components/ui/Icon";
import { logOut, switchWorkspace, useAccount, type PackageId, type Role } from "@/data/account";
import { dismissDroppedChanges, retrySync, useDroppedChanges, useHydrated, useSyncStatus } from "@/data/store";
import { sports } from "@/domain/sports";
import type { AppDictionary } from "@/i18n/app/tr";
import { cn } from "@/lib/cn";
import { useApp, useHref } from "./AppContext";
import { LocaleSwitch, useBackdropClose } from "./ui";

interface NavItem {
  key: keyof AppDictionary["shell"]["nav"];
  icon: IconName;
  /** Path under /panel, or null while the module is still being built. */
  path: string | null;
}

const NAV: Record<PackageId, NavItem[]> = {
  coach: [
    { key: "dashboard", icon: "dashboard", path: "" },
    { key: "playbook", icon: "playbook", path: "/playbook" },
    { key: "roster", icon: "team", path: "/roster" },
    { key: "practice", icon: "training", path: "/practice" },
    { key: "calendar", icon: "program", path: "/calendar" },
    { key: "meetings", icon: "meeting", path: "/meetings" },
    { key: "video", icon: "video", path: "/video" },
    { key: "stats", icon: "stats", path: "/stats" },
    { key: "evaluation", icon: "check", path: "/evaluation" },
  ],
  pt: [
    { key: "dashboard", icon: "dashboard", path: "" },
    { key: "athletes", icon: "athletes", path: null },
    { key: "programs", icon: "program", path: null },
    { key: "training", icon: "training", path: null },
    { key: "nutrition", icon: "nutrition", path: null },
    { key: "progress", icon: "progress", path: null },
    { key: "performance", icon: "timer", path: null },
  ],
};

export function navFor(pkg: PackageId) {
  return NAV[pkg];
}

function NavList({ pkg, role, onNavigate }: { pkg: PackageId; role: Role | null; onNavigate?: () => void }) {
  const { t } = useApp();
  const href = useHref();
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {NAV[pkg].map((item) => {
        const label = item.key === "evaluation" && role === "player" ? t.shell.myEvaluation : t.shell.nav[item.key];
        if (item.path === null) {
          return (
            <li key={item.key}>
              <span aria-disabled="true" className="flex min-h-11 items-center gap-3 rounded-[0.7rem] px-3 text-[0.92rem] text-mist/80">
                <Icon name={item.icon} className="size-[1.1rem] shrink-0" />
                <span className="flex-1">{label}</span>
                <span className="rounded-md bg-chalk/6 px-1.5 py-0.5 text-[0.68rem] font-semibold text-mist">{t.common.soon}</span>
              </span>
            </li>
          );
        }
        const target = href(`/panel${item.path}`);
        const active = item.path === "" ? pathname === target : pathname.startsWith(target);
        return (
          <li key={item.key}>
            <a
              href={target}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-[0.7rem] px-3 text-[0.92rem] font-medium transition-colors",
                active ? "bg-chalk/10 text-chalk" : "text-chalk-dim hover:bg-chalk/6 hover:text-chalk",
              )}
            >
              <Icon name={item.icon} className={cn("size-[1.1rem] shrink-0", active && "text-volt")} />
              {label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** Whether the coach's changes have reached the server; players don't write, so they see nothing. */
function SyncPill() {
  const { t } = useApp();
  const status = useSyncStatus();
  const s = t.shell.sync;
  if (status === "loading") return null;
  const tone = status === "error" ? "text-signal" : status === "offline" ? "text-amber" : "text-mist";
  const dot = status === "error" ? "bg-signal" : status === "offline" ? "bg-amber" : status === "saving" ? "bg-chalk/60 animate-pulse" : "bg-volt";
  return (
    <p className={cn("mt-2 flex items-center gap-2 text-[0.76rem]", tone)} role="status" aria-live="polite">
      <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", dot)} />
      <span className="min-w-0 flex-1">{s[status]}</span>
      {status === "error" && (
        <button type="button" onClick={retrySync} className="font-semibold text-chalk underline underline-offset-2">
          {s.retry}
        </button>
      )}
    </p>
  );
}

/** Shown until the account and the team's data are in. */
function LoadingShell() {
  const { t } = useApp();
  const { status } = useAccount();
  const sync = useSyncStatus();
  const text = status === "unconfigured" ? t.shell.unconfigured : sync === "offline" ? t.shell.sync.loadingOffline : t.shell.sync.loading;
  return (
    <div className="grid min-h-dvh place-items-center px-6" aria-busy={status !== "unconfigured"}>
      <p className={cn("max-w-sm text-center text-[0.92rem]", status === "unconfigured" ? "text-signal" : "text-mist")} role="status">
        {text}
      </p>
    </div>
  );
}

/** The signed-in frame: sidebar on wide screens, a drawer on narrow ones. */
export function AppShell({ children }: { children: ReactNode }) {
  const { t, locale } = useApp();
  const href = useHref();
  const router = useRouter();
  const hydrated = useHydrated();
  const { user, workspace, role, memberships } = useAccount();
  const dropped = useDroppedChanges();
  const [menuOpen, setMenuOpen] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const backdrop = useBackdropClose(() => setMenuOpen(false));

  useEffect(() => {
    if (!hydrated) return;
    if (!user) router.replace(href("/login"));
    else if (!workspace) router.replace(href("/onboarding"));
  }, [hydrated, user, workspace, router, href]);

  useEffect(() => {
    const el = drawer.current;
    if (!el) return;
    if (menuOpen && !el.open) el.showModal();
    if (!menuOpen && el.open) el.close();
  }, [menuOpen]);

  if (!hydrated || !user || !workspace) return <LoadingShell />;

  const sportName = workspace.sport ? sports[workspace.sport].name[locale] : null;
  const signOut = async () => {
    await logOut();
    router.replace(href("/login"));
  };

  const identity = (
    <div className="rounded-[var(--radius-card)] bg-night-850 p-3.5 shadow-[inset_0_0_0_1px_var(--color-hairline)]">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate font-semibold">{workspace.name}</p>
        {role === "player" && <span className="shrink-0 rounded-md bg-ice/15 px-1.5 py-0.5 text-[0.7rem] font-semibold text-ice">{t.shell.roles.player}</span>}
      </div>
      <p className="mt-0.5 text-[0.8rem] text-mist">
        {t.shell.packages[workspace.package]}
        {sportName ? `, ${sportName}` : ""}
      </p>
      {role === "coach" && <SyncPill />}
      {memberships.length > 1 && (
        <label className="mt-3 block">
          <span className="sr-only">{t.shell.teams}</span>
          <select
            value={workspace.id}
            onChange={(e) => void switchWorkspace(e.target.value)}
            className="h-9 w-full cursor-pointer rounded-[0.6rem] bg-night-950/70 px-2 text-[0.82rem] text-chalk shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] outline-none"
          >
            {memberships.map((m) => (
              <option key={m.workspace.id} value={m.workspace.id} className="bg-night-900">
                {`${m.workspace.name} (${t.shell.roles[m.role]})`}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );

  const account = (
    <div className="border-t border-hairline pt-4">
      <div className="flex items-center gap-3">
        <span className="display grid size-9 shrink-0 place-items-center rounded-full bg-chalk/10 text-[0.95rem]">
          {user.name.slice(0, 1).toLocaleUpperCase(locale)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.88rem] font-semibold">{user.name}</span>
          <span className="block truncate text-[0.76rem] text-mist">{user.email}</span>
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <LocaleSwitch />
        <button type="button" onClick={signOut} className="rounded-md px-2 py-1.5 text-[0.8rem] font-semibold text-mist transition-colors hover:text-chalk">
          {t.shell.logout}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-[17rem] shrink-0 flex-col gap-6 border-r border-hairline bg-night-900 px-4 py-5 lg:flex">
        <a href={href("/panel")} className="px-2" aria-label={t.shell.nav.dashboard}>
          <Wordmark />
        </a>
        {identity}
        <nav aria-label={t.shell.mainNav} className="flex-1 overflow-y-auto">
          <NavList pkg={workspace.package} role={role} />
        </nav>
        {account}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-hairline bg-night-950/90 px-4 backdrop-blur-md lg:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={t.shell.menu}
            className="grid size-11 place-items-center rounded-[0.7rem] shadow-[inset_0_0_0_1px_var(--color-hairline)]"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
              <path d="M4 8h16M4 16h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <a href={href("/panel")} className="flex items-center gap-2" aria-label={t.shell.nav.dashboard}>
            <LogoMark className="size-6" />
          </a>
          <p className="min-w-0 flex-1 truncate text-[0.92rem] font-semibold">{workspace.name}</p>
        </header>
        <main id="main" className="flex-1">
          {workspace.package === "coach" && <LiveBanner />}
          {dropped > 0 && (
            <div role="alert" className="flex flex-wrap items-center gap-3 border-b border-amber/30 bg-amber/10 px-5 py-3 text-[0.9rem] text-chalk sm:px-8">
              <span className="min-w-0 flex-1">{t.shell.dropped}</span>
              <button type="button" onClick={dismissDroppedChanges} className="font-semibold underline underline-offset-2">
                {t.shell.dismiss}
              </button>
            </div>
          )}
          {children}
        </main>
      </div>

      <dialog
        ref={drawer}
        onClose={() => setMenuOpen(false)}
        {...backdrop}
        className="m-0 h-dvh max-h-none w-[min(20rem,86vw)] max-w-none bg-night-900 p-0 text-chalk backdrop:bg-night-950/70 lg:hidden"
      >
        {menuOpen && (
          <div className="flex h-full flex-col gap-6 px-4 py-5">
            <Wordmark className="px-2" />
            {identity}
            <nav aria-label={t.shell.mainNav} className="flex-1 overflow-y-auto">
              <NavList pkg={workspace.package} role={role} onNavigate={() => setMenuOpen(false)} />
            </nav>
            {account}
          </div>
        )}
      </dialog>
    </div>
  );
}
