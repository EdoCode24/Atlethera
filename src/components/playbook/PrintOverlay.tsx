"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "@/components/app/AppContext";
import { Button, IconButton } from "@/components/app/ui";
import { Icon } from "@/components/ui/Icon";
import { savePrintSettings, useStoredPrintSettings } from "@/data/print";
import { sidesFor } from "@/domain/playbook/factory";
import {
  defaultPaper,
  filterCount,
  findStyle,
  FORMAT_SETTINGS,
  FORMAT_STYLES,
  groupPlays,
  pageCount,
  PAPER,
  planCards,
  playsPerPage,
  PRINT_FORMATS,
  sanitizeSettings,
  selectPlays,
  SETTING_OPTIONS,
  wristbandListRows,
  type PrintFilter,
  type PrintFormat,
  type PrintSettings,
  type PrintStyle,
  type SettingKey,
} from "@/domain/playbook/print";
import type { Category, Playbook, PlaySide } from "@/domain/playbook/types";
import type { AppDictionary } from "@/i18n/app/tr";
import { localeTags, type Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { fill } from "@/lib/fill";
import { plural } from "@/lib/plural";
import { PreviewScale, PrintPages, PX_PER_IN } from "./PrintSheets";
import { FormatThumb, StyleThumb } from "./PrintThumbs";
import { SideIcon } from "./SideIcon";


function styleName(t: AppDictionary, locale: Locale, format: PrintFormat, style: PrintStyle): string {
  const names = t.print.styleNames;
  if (format === "callSheet") return fill(names.grid, { n: style.cols * style.rows, cols: style.cols, rows: style.rows });
  if (format === "wristbandList" || format === "callSheetList") return plural(locale, t.print.count.columns, style.cols);
  if (format === "routeTree") return names.tree;
  if (style.id === "4-columns") return names.fourColumns;
  if (style.notes === "below") return names.notesBelow;
  if (style.notes === "side") return names.notesSide;
  if (style.id === "2-top-bottom") return names.topBottom;
  if (style.id === "2-left-right") return names.leftRight;
  return plural(locale, t.print.count.plays, style.cols * style.rows);
}

const heading = "text-[0.75rem] font-semibold tracking-[0.08em] text-mist uppercase";

/** Preview scales the zoom buttons step through (1 = life size). */
const PREVIEW_STEPS = [0.25, 0.35, 0.5, 0.75, 1, 1.5, 2, 3];

const zoomButton = "grid size-9 place-items-center rounded-full text-chalk-dim transition-colors hover:bg-chalk/8 hover:text-chalk disabled:opacity-35 disabled:hover:bg-transparent";

/** Watches an element's content box. */
function useBoxSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** A setting as a row of joined buttons, one of them pressed. */
function Segmented<T extends string | number>({ label, value, options, onChange, hint }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; hint?: string }) {
  const n = options.length;
  const cols = n <= 5 ? n : n === 6 ? 3 : Math.ceil(n / 2);
  return (
    <fieldset>
      <legend className="text-[0.82rem] font-semibold text-chalk-dim">{label}</legend>
      <div className="mt-2 grid gap-1 rounded-[0.75rem] bg-night-950/70 p-1 shadow-[inset_0_0_0_1px_var(--color-hairline)]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
            className={cn(
              "tabular h-9 truncate rounded-[0.55rem] px-1 text-[0.78rem] font-semibold transition-colors duration-150",
              o.value === value ? "bg-chalk text-night-950" : "text-chalk-dim hover:bg-chalk/8 hover:text-chalk",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {hint && <p className="mt-1.5 text-[0.75rem] leading-snug text-mist">{hint}</p>}
    </fieldset>
  );
}

function FormatPicker({ book, onPick }: { book: Playbook; onPick: (f: PrintFormat) => void }) {
  const { t, locale } = useApp();
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
        <p className="text-[0.9rem] font-semibold text-volt">{book.name}</p>
        <p className="display mt-2 text-display-md">{t.print.formatsTitle}</p>
        <p className="mt-3 max-w-[42rem] text-chalk-dim">{t.print.formatsBody}</p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRINT_FORMATS.map((f) => {
            const wide = f === "routeTree";
            return (
              <li key={f} className={cn(wide && "sm:col-span-2 lg:col-span-3")}>
                <button
                  type="button"
                  onClick={() => onPick(f)}
                  className={cn(
                    "group flex h-full w-full overflow-hidden rounded-[var(--radius-card)] bg-night-850 text-left shadow-[inset_0_0_0_1px_var(--color-hairline-strong)] transition-colors duration-200 hover:bg-night-800",
                    wide ? "flex-row items-stretch" : "flex-col",
                  )}
                >
                  <span className={cn("grid shrink-0 place-items-center bg-night-900", wide ? "w-32 border-r border-hairline sm:w-48" : "aspect-[16/9] border-b border-hairline")}>
                    <FormatThumb format={f} className={wide ? "h-20 w-full" : "h-[86%] w-full"} />
                  </span>
                  <span className="flex min-w-0 flex-1 items-start gap-3 p-4">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{t.print.formats[f].title}</span>
                      <span className="mt-1 block text-[0.85rem] leading-snug text-mist">{t.print.formats[f].body}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-[0.75rem] font-semibold text-mist">
                      {plural(locale, t.print.count.styles, FORMAT_STYLES[f].length)}
                      <Icon name="chevronLeft" className="size-4 rotate-180 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 flex items-start gap-2 text-[0.84rem] text-mist">
          <Icon name="info" className="mt-0.5 size-4 shrink-0" />
          {t.print.pdfTip}
        </p>
      </div>
    </div>
  );
}

interface ScreenProps {
  format: PrintFormat;
  settings: PrintSettings;
  update: (patch: Partial<PrintSettings>) => void;
  book: Playbook;
  sides: PlaySide[];
  side: PlaySide;
  setSide: (s: PlaySide) => void;
  filter: PrintFilter;
  setFilter: (f: PrintFilter) => void;
  categories: Category[];
  printable: boolean;
  pagesProps: Omit<Parameters<typeof PrintPages>[0], "format" | "settings">;
}

function FormatScreen({ format, settings, update, book, sides, side, setSide, filter, setFilter, categories, printable, pagesProps }: ScreenProps) {
  const { t, locale } = useApp();
  const [box, size] = useBoxSize<HTMLDivElement>();
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const paper = PAPER[settings.paper];
  // "Fit": whole pages fit the preview column; the page label under each takes about 28 px.
  const fit = Math.min(size.w / (paper.w * PX_PER_IN), (size.h - 28) / (paper.h * PX_PER_IN));
  const fitScale = size.w > 0 ? Math.min(1, Math.max(0.2, fit)) : 0.4;
  const scale = zoom === "fit" ? fitScale : zoom;
  const smaller = [...PREVIEW_STEPS].reverse().find((z) => z < scale - 0.001);
  const larger = PREVIEW_STEPS.find((z) => z > scale + 0.001);
  const tree = format === "routeTree";
  const intl = localeTags[locale].intl;
  const inches = new Intl.NumberFormat(intl, { maximumFractionDigits: 2 });
  const percent = new Intl.NumberFormat(intl, { style: "percent" });

  const optionLabel = (key: SettingKey, v: string | number): string => {
    if (key === "width" || key === "height") return `${inches.format(v as number)}″`;
    if (key === "zoom") return percent.format((v as number) / 100);
    if (key === "copies") return String(v);
    const labels = t.print.options[key as keyof AppDictionary["print"]["options"]] as Record<string, string>;
    return labels[String(v)];
  };

  const filterRow = (f: PrintFilter, label: string) => {
    const n = filterCount(book, side, f);
    const on = filter === f;
    return (
      <li key={f}>
        <button
          type="button"
          aria-pressed={on}
          onClick={() => setFilter(f)}
          className={cn(
            "flex min-h-10 w-full items-center gap-2 rounded-[0.6rem] px-2.5 text-left text-[0.88rem] transition-colors duration-150",
            on ? "bg-chalk/10 font-semibold text-chalk" : n === 0 ? "text-mist/60 hover:bg-chalk/5" : "text-chalk-dim hover:bg-chalk/6 hover:text-chalk",
          )}
        >
          <span className={cn("grid size-4 shrink-0 place-items-center", on ? "text-volt" : "text-transparent")}>
            <Icon name="check" className="size-4" />
          </span>
          <span className="min-w-0 flex-1 py-2 leading-snug break-words">{label}</span>
          <span className="tabular text-[0.8rem] text-mist">{n}</span>
        </button>
      </li>
    );
  };

  return (
    <div
      className={cn(
        "pb-flow flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain md:grid md:overflow-hidden",
        tree ? "md:grid-cols-[minmax(0,1fr)_17rem] lg:grid-cols-[minmax(0,1fr)_20rem]" : "md:grid-cols-[14rem_minmax(0,1fr)_17rem] lg:grid-cols-[16.5rem_minmax(0,1fr)_20rem]",
      )}
    >
      {!tree && (
        <aside aria-label={t.print.plays} className="pb-chrome shrink-0 border-b border-hairline bg-night-900 p-4 md:min-h-0 md:overflow-y-auto md:border-r md:border-b-0 lg:p-5">
          <p className={heading}>{t.print.plays}</p>
          <div role="group" aria-label={t.print.plays} className={cn("mt-3 grid gap-1 rounded-[0.8rem] bg-night-950/60 p-1", sides.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
            {sides.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={side === s}
                onClick={() => setSide(s)}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-1 rounded-[0.6rem] px-1 py-1.5 text-center text-[0.72rem] leading-tight font-semibold transition-colors duration-150",
                  side === s ? "bg-chalk text-night-950" : "text-chalk-dim hover:text-chalk",
                )}
              >
                <SideIcon side={s} />
                {t.playbook.sides[s]}
              </button>
            ))}
          </div>
          <ul className="mt-4 space-y-0.5">
            {filterRow("all", t.playbook.allPlays[side])}
            {categories.map((c) => filterRow(c.id, c.name))}
            {filterRow("none", t.playbook.uncategorized)}
          </ul>
        </aside>
      )}

      <section aria-label={t.print.preview} className="pb-flow relative h-[70dvh] shrink-0 bg-night-800/50 md:h-auto md:min-h-0">
        <div ref={box} className="pb-flow absolute inset-0 overflow-auto overscroll-contain p-4 pb-20 sm:p-6 sm:pb-20">
          {printable ? (
            <PreviewScale value={scale}>
              <div className="pb-flow flex flex-col items-center-safe gap-6">
                <PrintPages format={format} settings={settings} {...pagesProps} />
              </div>
            </PreviewScale>
          ) : (
            <div className="pb-chrome grid h-full place-items-center">
              <p className="max-w-[18rem] text-center text-chalk-dim">{t.print.noPlays}</p>
            </div>
          )}
        </div>
        {printable && (
          <div
            role="group"
            aria-label={t.print.previewScale}
            className="pb-chrome absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-night-900/95 p-1 shadow-[0_0_0_1px_var(--color-hairline-strong),0_12px_30px_-10px_rgb(0_0_0/0.8)] backdrop-blur-sm"
          >
            <button type="button" aria-label={t.print.zoomOut} title={t.print.zoomOut} disabled={!smaller} onClick={() => smaller && setZoom(smaller)} className={zoomButton}>
              <Icon name="minus" className="size-4" />
            </button>
            <span className="tabular w-12 text-center text-[0.78rem] font-semibold text-chalk-dim" aria-live="polite">
              {percent.format(scale)}
            </span>
            <button type="button" aria-label={t.print.zoomIn} title={t.print.zoomIn} disabled={!larger} onClick={() => larger && setZoom(larger)} className={zoomButton}>
              <Icon name="plus" className="size-4" />
            </button>
            <button
              type="button"
              aria-pressed={zoom === "fit"}
              aria-label={t.print.fitPageLabel}
              title={t.print.fitPageLabel}
              onClick={() => setZoom("fit")}
              className={cn("h-9 rounded-full px-3 text-[0.78rem] font-semibold transition-colors", zoom === "fit" ? "bg-chalk text-night-950" : "text-chalk-dim hover:bg-chalk/8 hover:text-chalk")}
            >
              {t.print.fitPage}
            </button>
          </div>
        )}
      </section>

      <aside aria-label={t.print.settings} className="pb-chrome shrink-0 border-t border-hairline bg-night-900 md:min-h-0 md:overflow-y-auto md:border-t-0 md:border-l">
        <div className="space-y-6 p-4 lg:p-5">
          {!tree && (
            <section aria-label={t.print.style}>
              <p className={heading}>{t.print.style}</p>
              <ul className="mt-3 grid grid-cols-3 gap-1.5">
                {FORMAT_STYLES[format].map((st) => {
                  const on = st.id === settings.style;
                  return (
                    <li key={st.id}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => update({ style: st.id })}
                        className={cn(
                          "relative flex h-full w-full flex-col items-center gap-1 rounded-[0.7rem] px-1 pt-1.5 pb-2 transition-colors duration-150",
                          on ? "bg-chalk/12 text-chalk shadow-[inset_0_0_0_1.5px_var(--color-volt)]" : "bg-chalk/[0.04] text-chalk-dim hover:bg-chalk/10 hover:text-chalk",
                        )}
                      >
                        {on && (
                          <span className="absolute top-1 left-1 grid size-4 place-items-center rounded-full bg-volt text-night-950">
                            <Icon name="check" className="size-3" />
                          </span>
                        )}
                        <StyleThumb format={format} style={st} className="h-11 w-full" />
                        <span className="text-center text-[0.68rem] leading-tight font-semibold">{styleName(t, locale, format, st)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <div className="space-y-5">
            <p className={heading}>{t.print.settings}</p>
            {FORMAT_SETTINGS[format].map((key) => (
              <Segmented<string | number>
                key={key}
                label={t.print.settingNames[key]}
                value={settings[key]}
                options={(SETTING_OPTIONS[key] as readonly (string | number)[]).map((v) => ({ value: v, label: optionLabel(key, v) }))}
                onChange={(v) => update({ [key]: v } as Partial<PrintSettings>)}
                hint={key === "colorCoding" ? t.print.colorHint : undefined}
              />
            ))}
          </div>
          <p className="flex items-start gap-2 text-[0.78rem] leading-snug text-mist">
            <Icon name="info" className="mt-0.5 size-3.5 shrink-0" />
            {t.print.pdfTip}
          </p>
        </div>
      </aside>
    </div>
  );
}

export interface PrintOverlayProps {
  book: Playbook;
  workspaceId: string;
  /** Team name for page headers. */
  team: string;
  /** The playbook screen's current side and category, preselected. */
  initialSide?: PlaySide;
  initialFilter?: PrintFilter;
  onClose: () => void;
}

/**
 * Full-screen print flow: pick a format, then the plays, a style and settings, with a live
 * preview of the real pages. Print hands the pages to the browser (window.print); the print
 * stylesheet hides everything else and lays each sheet on its own page at true size.
 */
export function PrintOverlay({ book, workspaceId, team, initialSide, initialFilter = "all", onClose }: PrintOverlayProps) {
  const { t, locale } = useApp();
  const titleId = useId();
  const sides = sidesFor(book.sport);
  const [format, setFormat] = useState<PrintFormat | null>(null);
  const [side, setSideState] = useState<PlaySide>(() => (initialSide && sides.includes(initialSide) ? initialSide : sides[0]));
  const [filter, setFilter] = useState<PrintFilter>(initialFilter);
  const stored = useStoredPrintSettings(workspaceId);
  const settings = format ? sanitizeSettings(format, stored[format], defaultPaper(locale)) : null;
  const categories = useMemo(() => book.categories[side] ?? [], [book, side]);
  // A category deleted meanwhile falls back to every play of the side.
  const active = filter === "all" || filter === "none" || categories.some((c) => c.id === filter) ? filter : "all";
  const plays = useMemo(() => selectPlays(book, side, active), [book, side, active]);
  const groups = useMemo(() => groupPlays(plays, categories, active), [plays, categories, active]);
  const printable = format === "routeTree" || plays.length > 0;
  const root = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const close = useRef(onClose);

  useEffect(() => {
    close.current = onClose;
  });

  // Modal: the page behind goes inert and stops scrolling; the print stylesheet switches to this
  // overlay; focus comes back to the button that opened it.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const quieted: Element[] = [];
    for (const child of Array.from(document.body.children)) {
      if (child === el || child.hasAttribute("inert")) continue;
      child.setAttribute("inert", "");
      quieted.push(child);
    }
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.classList.add("pb-printing");
    html.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      close.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      for (const child of quieted) child.removeAttribute("inert");
      html.classList.remove("pb-printing");
      html.style.overflow = overflow;
      opener?.focus();
    };
  }, []);

  // Each step announces itself: focus moves to its title.
  useEffect(() => {
    title.current?.focus();
  }, [format]);

  const setSide = (s: PlaySide) => {
    setSideState(s);
    setFilter("all");
  };
  const update = (patch: Partial<PrintSettings>) => {
    if (format && settings) savePrintSettings(workspaceId, format, { ...settings, ...patch });
  };

  const filterLabel = active === "all" ? t.playbook.allPlays[side] : active === "none" ? t.playbook.uncategorized : (categories.find((c) => c.id === active)?.name ?? "");
  const caption = `${book.name} · ${t.playbook.sides[side]} · ${filterLabel}`;

  let summary = "";
  if (format && settings) {
    const pages = plural(locale, t.print.count.pages, printable ? pageCount(format, settings, plays, groups) : 0);
    const n = plural(locale, t.print.count.plays, plays.length);
    if (format === "routeTree") summary = pages;
    else if (format === "wristband" || format === "wristbandList") {
      const style = findStyle(format, settings.style);
      const perCard = format === "wristband" ? playsPerPage(style) : style.cols * wristbandListRows(settings.height);
      const cards = planCards(plays, perCard, 1, { w: settings.width, h: settings.height }, settings.paper).cards;
      summary = `${n}, ${plural(locale, t.print.count.cards, cards)} × ${plural(locale, t.print.count.copies, settings.copies)}, ${pages}`;
    } else summary = `${n}, ${pages}`;
  }

  const paper = settings ? PAPER[settings.paper] : null;

  return createPortal(
    <div ref={root} role="dialog" aria-modal="true" aria-labelledby={titleId} className="pb-print-root fixed inset-0 z-[70] flex flex-col bg-night-950 text-chalk">
      {paper && <style>{`@page { size: ${paper.w.toFixed(4)}in ${paper.h.toFixed(4)}in; margin: 0; }`}</style>}
      <header className="pb-chrome flex h-16 shrink-0 items-center gap-1.5 border-b border-hairline bg-night-900 px-2 sm:gap-2 sm:px-4">
        {format ? (
          <IconButton label={t.print.back} onClick={() => setFormat(null)}>
            <Icon name="chevronLeft" className="size-5" />
          </IconButton>
        ) : (
          <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center text-volt">
            <Icon name="printer" className="size-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 id={titleId} ref={title} tabIndex={-1} className="truncate text-[1rem] font-semibold outline-none">
            {format ? t.print.formats[format].title : t.print.title}
          </h2>
          <p className="truncate text-[0.78rem] text-mist" aria-live="polite">
            {format ? `${book.name} · ${summary}` : book.name}
          </p>
        </div>
        {format && (
          <Button onClick={() => window.print()} disabled={!printable} className="h-10 shrink-0 px-3 sm:px-5">
            <Icon name="printer" className="size-[1.15rem]" />
            <span className="sr-only sm:not-sr-only">{t.print.print}</span>
          </Button>
        )}
        <IconButton label={t.common.close} onClick={onClose}>
          <Icon name="close" className="size-5" />
        </IconButton>
      </header>

      {format && settings ? (
        <FormatScreen
          format={format}
          settings={settings}
          update={update}
          book={book}
          sides={sides}
          side={side}
          setSide={setSide}
          filter={active}
          setFilter={setFilter}
          categories={categories}
          printable={printable}
          pagesProps={{ book, plays, groups, categories, filter: active, team, caption }}
        />
      ) : (
        <FormatPicker book={book} onPick={setFormat} />
      )}
    </div>,
    document.body,
  );
}
