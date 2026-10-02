"use client";

import { useToday } from "@/components/team/hooks";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useAccount } from "@/data/account";
import { usePlaybooks } from "@/data/playbooks";
import { useEvents } from "@/data/calendar";
import { useRoster } from "@/data/roster";
import { sports } from "@/domain/sports";
import { parseDay, upcoming } from "@/domain/team/calendar";
import { localeTags } from "@/i18n/config";
import { fill } from "@/lib/fill";
import { plural } from "@/lib/plural";
import { useApp, useHref } from "./AppContext";
import { navFor } from "./AppShell";

export function Dashboard() {
  const { t, locale } = useApp();
  const href = useHref();
  const { user, workspace, canEdit, playerId, role } = useAccount();
  const books = usePlaybooks(workspace?.id);
  const roster = useRoster(workspace?.id);
  const events = useEvents(workspace?.id);
  const today = useToday();
  if (!user || !workspace) return null;

  const firstName = user.name.split(" ")[0];
  const soon = navFor(workspace.package).filter((n) => n.path === null);
  // Open sections that have no card of their own above.
  const carded = ["dashboard", "playbook", "calendar", ...(canEdit ? ["roster"] : [])];
  const more = workspace.package === "coach" ? navFor("coach").filter((n) => n.path !== null && !carded.includes(n.key)) : [];
  const plays = books.reduce((n, b) => n + b.plays.length, 0);
  const players = roster.players;
  const count = (s: string) => players.filter((p) => p.status === s).length;
  const modules: { key: string; icon: IconName; title: string; line: string; cta: string; path: string }[] = [
    {
      key: "playbook",
      icon: "playbook",
      title: t.dashboard.playbooks,
      line: `${plural(locale, t.playbook.counts.playbooks, books.length)}, ${plural(locale, t.playbook.counts.plays, plays)}`,
      cta: books.length || !canEdit ? t.dashboard.openPlaybook : t.dashboard.newPlaybook,
      path: "/panel/playbook",
    },
  ];
  // A player's own page takes the roster card's place.
  const me = !canEdit && playerId ? players.find((p) => p.id === playerId) : undefined;
  if (me) {
    modules.push({
      key: "me",
      icon: "athletes",
      title: t.dashboard.myProfile,
      line: [me.number !== null ? `#${me.number}` : null, me.positions.join(" / ") || null].filter(Boolean).join(", ") || `${me.firstName} ${me.lastName}`,
      cta: t.dashboard.openProfile,
      path: `/panel/roster/${me.id}`,
    });
  } else {
    modules.push({
      key: "roster",
      icon: "team",
      title: t.dashboard.roster,
      line: players.length ? fill(t.roster.summary, { total: players.length, active: count("active"), injured: count("injured") }) : t.dashboard.rosterEmpty,
      cta: players.length || !canEdit ? t.dashboard.openRoster : t.dashboard.addPlayers,
      path: "/panel/roster",
    });
  }
  const next = today ? upcoming(events, today, 1)[0] : undefined;
  if (next) {
    const when = new Intl.DateTimeFormat(localeTags[locale].intl, { weekday: "long", day: "numeric", month: "long" }).format(parseDay(next.date));
    modules.push({
      key: "calendar",
      icon: "program",
      title: t.dashboard.calendar,
      line: fill(t.dashboard.nextEvent, { title: next.title, when: next.start ? `${when} ${next.start}` : when }),
      cta: t.dashboard.openCalendar,
      path: "/panel/calendar",
    });
  } else {
    modules.push({ key: "calendar", icon: "program", title: t.dashboard.calendar, line: t.dashboard.noUpcoming, cta: canEdit ? t.calendar.addEvent : t.dashboard.openCalendar, path: "/panel/calendar" });
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:py-14">
      <h1 className="display text-display-md">{fill(t.dashboard.hello, { name: firstName })}</h1>
      <p className="mt-4 max-w-[46rem] text-lead text-chalk-dim">
        {workspace.package === "coach" && workspace.sport
          ? fill(canEdit ? t.dashboard.coachBody : t.dashboard.playerBody, { team: workspace.name, sport: sports[workspace.sport].name[locale] })
          : fill(t.dashboard.ptBody, { team: workspace.name })}
      </p>

      {workspace.package === "coach" && (
        <ul className="mt-10 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((m) => (
            <li key={m.key}>
              <a
                href={href(m.path)}
                className="group flex h-full flex-col gap-5 rounded-[var(--radius-panel)] bg-night-850 p-6 shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] transition-colors hover:bg-night-800 sm:p-7"
              >
                <span className="flex items-center gap-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-volt text-night-950">
                    <Icon name={m.icon} className="size-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[1.25rem] font-semibold">{m.title}</span>
                    <span className="mt-0.5 block text-[0.95rem] text-chalk-dim">{m.line}</span>
                  </span>
                </span>
                <span className="mt-auto text-[0.95rem] font-semibold text-volt underline decoration-volt/40 underline-offset-[6px] group-hover:decoration-volt">{m.cta}</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {/* The other open sections, one tap away. */}
      {more.length > 0 && (
        <nav className="mt-12" aria-labelledby="more-title">
          <h2 id="more-title" className="text-[1.1rem] font-semibold">
            {t.dashboard.moreTitle}
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {more.map((item) => (
              <li key={item.key}>
                <a href={href(`/panel${item.path}`)} className="flex min-h-14 items-center gap-3 rounded-[var(--radius-card)] bg-night-900 p-4 font-medium text-chalk-dim shadow-[inset_0_0_0_1px_var(--color-hairline)] transition-colors hover:bg-night-800 hover:text-chalk">
                  <Icon name={item.icon} className="size-5 text-mist" />
                  {item.key === "evaluation" && role === "player" ? t.shell.myEvaluation : t.shell.nav[item.key]}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {soon.length > 0 && (
        <section className="mt-12" aria-labelledby="soon-title">
          <h2 id="soon-title" className="text-[1.1rem] font-semibold">
            {t.dashboard.soonTitle}
          </h2>
          <p className="mt-1 text-[0.92rem] text-mist">{t.dashboard.soonBody}</p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {soon.map((item) => (
              <li key={item.key} className="flex items-center gap-3 rounded-[var(--radius-card)] bg-night-900 p-4 shadow-[inset_0_0_0_1px_var(--color-hairline)]">
                <Icon name={item.icon} className="size-5 text-mist" />
                <span className="flex-1 font-medium text-chalk-dim">{t.shell.nav[item.key]}</span>
                <span className="rounded-md bg-chalk/6 px-1.5 py-0.5 text-[0.7rem] font-semibold text-mist">{t.common.soon}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
