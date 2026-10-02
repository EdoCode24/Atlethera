import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

const surface = "rounded-[var(--radius-card)] bg-night-900 p-4 shadow-[inset_0_0_0_1px_var(--color-hairline-strong)]";

export function AthleteCardMock({
  initials,
  name,
  facts,
  goalsLabel,
  goals,
}: {
  initials: string;
  name: string;
  facts: { label: string; value: string }[];
  goalsLabel: string;
  goals: string[];
}) {
  return (
    <div className={surface}>
      <div className="flex items-center gap-3">
        <span className="display grid size-12 place-items-center rounded-full bg-volt text-[1.2rem] text-night-950">{initials}</span>
        <p className="text-[1.05rem] font-semibold">{name}</p>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2">
        {facts.map((f) => (
          <div key={f.label} data-anim-item className="rounded-lg bg-night-950/60 px-3 py-2">
            <dt className="text-[0.68rem] text-mist">{f.label}</dt>
            <dd className="display tabular mt-0.5 text-[1.3rem] leading-none">{f.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-[0.72rem] text-mist">{goalsLabel}</p>
      <ul className="mt-1.5 space-y-1.5">
        {goals.map((g) => (
          <li key={g} data-anim-item className="flex items-center gap-2 text-[0.84rem]">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-volt" />
            {g}
          </li>
        ))}
      </ul>
    </div>
  );
}

const kindStyle: Record<string, string> = {
  strength: "bg-volt text-night-950",
  speed: "bg-ice/85 text-night-950",
  conditioning: "bg-amber/85 text-night-950",
  recovery: "bg-chalk/12 text-chalk-dim",
  rest: "bg-transparent text-mist shadow-[inset_0_0_0_1px_var(--color-hairline)]",
};

export function ProgramWeekMock({ label, days }: { label: string; days: { day: string; title: string; kind: string }[] }) {
  return (
    <div className={surface}>
      <p className="text-[0.72rem] text-mist">{label}</p>
      <ol className="mt-3 grid grid-cols-7 gap-1.5">
        {days.map((d) => (
          <li key={d.day} className="flex flex-col gap-1.5">
            <span className="text-center text-[0.66rem] font-semibold text-chalk-dim">{d.day}</span>
            <span
              data-anim-item
              className={cn("flex h-28 items-end rounded-lg p-1.5 text-[0.62rem] leading-tight font-semibold [writing-mode:vertical-rl] rotate-180", kindStyle[d.kind])}
            >
              {d.title}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function SessionLogMock({
  title,
  head,
  rows,
}: {
  title: string;
  head: { exercise: string; sets: string; load: string; rpe: string };
  rows: { exercise: string; sets: string; load: string; rpe: number; done: boolean }[];
}) {
  return (
    <div className={surface}>
      <p className="text-[0.84rem] font-semibold">{title}</p>
      <table className="mt-3 w-full text-left text-[0.76rem]">
        <thead className="text-[0.66rem] text-mist">
          <tr>
            <th className="pb-2 font-medium">{head.exercise}</th>
            <th className="pb-2 font-medium">{head.sets}</th>
            <th className="pb-2 font-medium">{head.load}</th>
            <th className="pb-2 text-right font-medium">{head.rpe}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.map((r) => (
            <tr key={r.exercise} data-anim-item>
              <td className="py-1.5 pr-2">
                <span className="flex items-center gap-1.5">
                  <span className={cn("grid size-4 shrink-0 place-items-center rounded-[4px]", r.done ? "bg-volt text-night-950" : "shadow-[inset_0_0_0_1px_var(--color-hairline-strong)]")}>
                    {r.done && <Icon name="check" className="size-3" />}
                  </span>
                  <span className="truncate">{r.exercise}</span>
                </span>
              </td>
              <td className="tabular py-1.5 text-chalk-dim">{r.sets}</td>
              <td className="tabular py-1.5 text-chalk-dim">{r.load}</td>
              <td className="tabular py-1.5 text-right font-semibold">{r.rpe}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const RING = 2 * Math.PI * 15.9155;

/** Dash settings that lay ring segments end to end, with a small gap between them. */
export function ringArcs(shares: number[]) {
  let start = 0;
  return shares.map((share) => {
    const length = share * RING;
    const arc = { dasharray: `${Math.max(0, length - 0.8)} ${RING}`, dashoffset: -start };
    start += length;
    return arc;
  });
}

export function MacroRingsMock({
  label,
  kcal,
  kcalUnit,
  macros,
  cta,
  href,
}: {
  label: string;
  kcal: string;
  kcalUnit: string;
  macros: { key: "protein" | "carbs" | "fat"; label: string; grams: string; share: number }[];
  cta: string;
  href: string;
}) {
  const colors = { protein: "var(--color-volt)", carbs: "var(--color-ice)", fat: "var(--color-amber)" };
  const arcs = ringArcs(macros.map((m) => m.share));
  return (
    <div className={surface}>
      <p className="text-[0.72rem] text-mist">{label}</p>
      <div className="mt-3 flex items-center gap-5">
        <div className="relative size-32 shrink-0">
          <svg viewBox="0 0 36 36" className="size-full -rotate-90" aria-hidden="true">
            <circle cx="18" cy="18" r="15.9155" fill="none" stroke="rgb(242 244 237 / 0.08)" strokeWidth="3.2" />
            {macros.map((m, i) => (
                <circle
                  key={m.key}
                  data-ring
                  cx="18"
                  cy="18"
                  r="15.9155"
                  fill="none"
                  stroke={colors[m.key]}
                  strokeWidth="3.2"
                  strokeDasharray={arcs[i].dasharray}
                  strokeDashoffset={arcs[i].dashoffset}
                />
            ))}
          </svg>
          <p className="absolute inset-0 grid place-items-center text-center">
            <span>
              <span className="display tabular block text-[1.6rem] leading-none">{kcal}</span>
              <span className="text-[0.66rem] text-mist">{kcalUnit}</span>
            </span>
          </p>
        </div>
        <dl className="flex-1 space-y-2 text-[0.8rem]">
          {macros.map((m) => (
            <div key={m.key} className="flex items-center justify-between gap-2">
              <dt className="flex items-center gap-2 text-chalk-dim">
                <span aria-hidden="true" className="size-2 rounded-full" style={{ background: colors[m.key] }} />
                {m.label}
              </dt>
              <dd className="tabular font-semibold">{m.grams}</dd>
            </div>
          ))}
        </dl>
      </div>
      <a href={href} className="mt-4 inline-flex items-center gap-1.5 text-[0.8rem] font-semibold text-volt underline decoration-volt/40 underline-offset-4 hover:decoration-volt">
        {cta}
      </a>
    </div>
  );
}

export function LineChartMock({
  label,
  values,
  goal,
  goalLabel,
  weekLabels,
  format,
  lowerIsBetter = false,
  height = 120,
}: {
  label: string;
  values: number[];
  goal?: number;
  goalLabel?: string;
  weekLabels: string[];
  format: (v: number) => string;
  lowerIsBetter?: boolean;
  height?: number;
}) {
  const W = 300;
  const H = height;
  const all = goal !== undefined ? [...values, goal] : values;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const pad = 8;
  const y = (v: number) => {
    const t = (v - min) / (max - min || 1);
    return pad + (lowerIsBetter ? t : 1 - t) * (H - pad * 2);
  };
  const x = (i: number) => pad + (i / (values.length - 1)) * (W - pad * 2);
  const last = values[values.length - 1];
  const path = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");

  return (
    <div className={surface}>
      <div className="flex items-baseline justify-between">
        <p className="text-[0.72rem] text-mist">{label}</p>
        <p className="display tabular text-[1.4rem] leading-none normal-case">{format(last)}</p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full overflow-visible" aria-hidden="true">
        {goal !== undefined && (
          <>
            <line x1="0" x2={W} y1={y(goal)} y2={y(goal)} stroke="var(--color-chalk)" strokeWidth="1" strokeDasharray="4 4" opacity="0.35" />
            <text x={W} y={y(goal) - 5} textAnchor="end" fill="var(--color-mist)" fontSize="10">
              {goalLabel}
            </text>
          </>
        )}
        <path data-line d={path} fill="none" stroke="var(--color-volt)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        {values.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r="2.6" fill="var(--color-night-900)" stroke="var(--color-volt)" strokeWidth="1.6" />
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-[0.62rem] text-mist">
        {weekLabels.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
    </div>
  );
}

export function TestTableMock({
  head,
  rows,
}: {
  head: { test: string; latest: string; target: string };
  rows: { name: string; latest: string; target: string; progress: number }[];
}) {
  return (
    <div className={surface}>
      <table className="w-full text-left text-[0.78rem]">
        <thead className="text-[0.66rem] text-mist">
          <tr>
            <th className="pb-2 font-medium">{head.test}</th>
            <th className="pb-2 text-right font-medium">{head.latest}</th>
            <th className="pb-2 text-right font-medium">{head.target}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.map((r) => (
            <tr key={r.name} data-anim-item>
              <td className="py-1.5 pr-2">
                {r.name}
                <span className="mt-1 block h-1 overflow-hidden rounded-full bg-chalk/8">
                  <span data-bar className="block h-full rounded-full bg-volt" style={{ width: `${Math.round(r.progress * 100)}%` }} />
                </span>
              </td>
              <td className="tabular py-1.5 text-right font-semibold">{r.latest}</td>
              <td className="tabular py-1.5 text-right text-mist">{r.target}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
