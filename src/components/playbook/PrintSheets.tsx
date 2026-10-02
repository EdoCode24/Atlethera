"use client";

import { createContext, memo, useContext, type CSSProperties, type ReactNode } from "react";
import { useApp } from "@/components/app/AppContext";
import { endMarker, norm, polylineD, sub } from "@/domain/playbook/geometry";
import {
  bodySize,
  CARD_PAD,
  categoryColor,
  diagramLayout,
  diagramSpots,
  chunk,
  findStyle,
  flowList,
  FOOTER_H,
  gridCell,
  HEADER_GAP,
  HEADER_H,
  innerSize,
  INK,
  LABEL_FONT,
  labelLayout,
  longestName,
  PAPER,
  planCards,
  PLAYBOOK_MIN_ASPECT,
  playsPerPage,
  primaryCategory,
  SHEET_MARGIN,
  SHEET_ROW,
  sheetListRows,
  STROKE_SCALE,
  tightestSpacing,
  WRISTBAND_ROW,
  wristbandListRows,
  type IconSize,
  type LabelColor,
  type LabelLayout,
  type LabelStyle,
  type LineWeight,
  type ListGroup,
  type NumberedPlay,
  type PaperSize,
  type PlayLabels,
  type PrintFilter,
  type PrintFormat,
  type PrintSettings,
  type PrintStyle,
  type Size,
} from "@/domain/playbook/print";
import { ROUTE_TREE, type RouteTemplate } from "@/domain/playbook/routes";
import type { Category, Play, Playbook, PlayerSpot, Vec } from "@/domain/playbook/types";
import { fill } from "@/lib/fill";
import { PRINT_FILL, PlayField, playerRadius, staticView } from "./PlayField";

/** CSS pixels per inch: the preview lays pages out at true size and scales them down. */
export const PX_PER_IN = 96;

/** The preview's scale (1 = life size on screen). Printing ignores it. */
export const PreviewScale = createContext(1);

const inch = (v: number) => `${v.toFixed(4)}in`;
/** A font size given in inches, in points. */
const pt = (inches: number) => `${(inches * 72).toFixed(2)}pt`;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Hairline widths in inches: the dashed cut line, the rule between wristband cells, a box border. */
const CUT = 0.5 / 72;
const RULE = 1 / 72;
const BORDER = 0.75 / 72;
const INK_TEXT = "#1b1f1c";
const MUTED = "#5b625e";
const FRAME = "#c3c9c2";
const STRIPE = "#eceee9";

export interface SheetsProps {
  format: PrintFormat;
  book: Playbook;
  plays: NumberedPlay[];
  groups: ListGroup<NumberedPlay>[];
  categories: Category[];
  filter: PrintFilter;
  settings: PrintSettings;
  /** Team name for page headers. */
  team: string;
  /** "Playbook · side · category", for headers and footers. */
  caption: string;
}

// ── Page frame ──────────────────────────────────────────────────────────────

/**
 * One sheet of paper at true size. On screen it is scaled into the preview (the frame keeps the
 * scaled size in the layout); in print the frame and the scale fall away and the sheet fills a page.
 */
function Sheet({ paper, n, total, children }: { paper: PaperSize; n: number; total: number; children: ReactNode }) {
  const { t } = useApp();
  const scale = useContext(PreviewScale);
  const size = PAPER[paper];
  return (
    <div className="pb-page pb-flow flex flex-col items-center-safe gap-2">
      <div
        className="pb-flow overflow-hidden bg-white shadow-[0_24px_60px_-24px_rgb(0_0_0/0.9),0_0_0_1px_rgb(242_244_237/0.08)]"
        style={{ width: size.w * PX_PER_IN * scale, height: size.h * PX_PER_IN * scale }}
      >
        <div
          className="pb-sheet"
          style={{ width: inch(size.w), height: inch(size.h), padding: inch(SHEET_MARGIN), transform: `scale(${scale})`, "--sheet-h": inch(size.h) } as CSSProperties}
        >
          {children}
        </div>
      </div>
      <p className="pb-chrome tabular text-[0.75rem] text-mist">{fill(t.print.pageOf, { n, total })}</p>
    </div>
  );
}

function initials(name: string, locale: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]);
  return letters.join("").toLocaleUpperCase(locale) || "A";
}

/** Team block, title and page number across the top of a call sheet, playbook page or route tree. */
function PageHeader({ team, title, subtitle, page }: { team: string; title: string; subtitle: string; page?: string }) {
  const { locale } = useApp();
  return (
    <header className="flex items-center gap-[0.12in] border-b-[1.5pt] border-[#101410]" style={{ height: inch(HEADER_H), marginBottom: inch(HEADER_GAP), paddingBottom: "0.06in" }}>
      <span className="display grid size-[0.38in] shrink-0 place-items-center bg-[#101410] text-[13pt] leading-none text-white">{initials(team, locale)}</span>
      <div className="min-w-0 flex-1">
        <p className="display pb-line text-[16pt] leading-[1.1]">{title}</p>
        <p className="pb-line mt-[0.02in] text-[8.5pt] leading-[1.2]" style={{ color: MUTED }}>
          {subtitle}
        </p>
      </div>
      {page && (
        <p className="tabular shrink-0 self-end text-[8.5pt] leading-[1.2]" style={{ color: MUTED }}>
          {page}
        </p>
      )}
    </header>
  );
}

// ── Diagrams and labels ─────────────────────────────────────────────────────

interface DiagramLook {
  zoom?: number;
  icon?: IconSize;
  weight?: LineWeight;
}

/**
 * A play on paper, in the print palette. The frame is the playbook thumbnail's (staticView: the
 * whole width, backfield to the far end of the play, special teams up to the other unit), grown
 * to this box's shape with the extra turf mostly up-field, then zoomed without dropping a player
 * (diagramLayout). A box much taller than the play gets a shorter diagram (centred, or at the
 * top) instead of empty turf. Tokens never print smaller than a readable dot.
 */
const Diagram = memo(function Diagram({
  book,
  play,
  w,
  h,
  zoom = 100,
  icon = "medium",
  weight = "medium",
  align = "center",
  framed = false,
  minAspect,
}: { book: Playbook; play: Play; w: number; h: number; align?: "center" | "top"; framed?: boolean; minAspect?: number } & DiagramLook) {
  const special = play.side === "special";
  const facing = special ? play.opponent : undefined;
  // A very wide aspect makes staticView return exactly the play's depth: the far end down to the backfield.
  const depth = staticView(book.sport, book.fieldWidth, play.settings, play.players, play.side, facing, 14, 1000);
  // Tokens on paper; special teams frame up to the other unit even when it is hidden.
  const shown = play.settings.showOpponent ? [...play.players, ...play.opponent] : play.players;
  const { drawn, view, k, minLabel } = diagramLayout({
    depth,
    fieldWidth: book.fieldWidth,
    spots: diagramSpots(special ? [...play.players, ...play.opponent] : shown),
    players: shown,
    box: { w, h },
    minAspect,
    zoom,
    radius: playerRadius(book.sport),
    icon,
    special,
    spacing: special ? tightestSpacing(shown) : Infinity,
  });
  return (
    <div className={`flex shrink-0 justify-center overflow-hidden ${align === "top" ? "items-start" : "items-center"}`} style={{ width: inch(w), height: inch(h) }}>
      <div className="bg-white" style={{ width: inch(drawn.w), height: inch(drawn.h), outline: framed ? `${inch(BORDER)} solid ${FRAME}` : undefined, outlineOffset: framed ? `-${inch(BORDER)}` : undefined }}>
        <PlayField
          sport={book.sport}
          fieldWidth={book.fieldWidth}
          fieldLines={book.fieldLines}
          settings={play.settings}
          players={play.players}
          opponent={play.opponent}
          view={view}
          sizeScale={k}
          strokeScale={STROKE_SCALE[weight]}
          minLabel={minLabel}
          palette="print"
          className="block size-full"
        />
      </div>
    </div>
  );
});

/**
 * The bar over a wristband or call sheet cell: play number and/or name, in the category colour.
 * On a two-line bar the name wraps once and the number grows to match.
 */
function PlayLabel({ entry, labels, style, color, layout }: { entry: NumberedPlay; labels: PlayLabels; style: LabelStyle; color: LabelColor; layout: LabelLayout }) {
  const showNumber = labels !== "name";
  const showName = labels !== "number";
  const { h, lines, font: fs } = layout;
  // The one-line bar height, which the padding and number cell follow.
  const unit = fs / LABEL_FONT[style];
  const nameClass = lines === 2 ? "line-clamp-2 leading-[1.18] [overflow-wrap:anywhere]" : "pb-line";
  if (style === "prominent") {
    return (
      <div
        className={`flex shrink-0 items-center overflow-hidden font-bold ${showName ? "" : "justify-center"}`}
        style={{ height: inch(h), background: color.bg, color: color.fg, fontSize: pt(fs), gap: inch(unit * 0.28), paddingInline: inch(unit * 0.28) }}
      >
        {showNumber && (
          <span className="display tabular shrink-0 leading-none" style={{ fontSize: pt(fs * (lines === 2 ? 1.6 : 1.15)) }}>
            {entry.number}
          </span>
        )}
        {showNumber && showName && <span aria-hidden="true" className="shrink-0 self-stretch" style={{ width: "0.5pt", background: color.fg, opacity: 0.55, marginBlock: inch(unit * 0.22) }} />}
        {showName && <span className={`min-w-0 ${nameClass}`}>{entry.play.name}</span>}
      </div>
    );
  }
  return (
    <div
      className={`flex shrink-0 items-stretch overflow-hidden ${showName ? "" : "justify-center"}`}
      style={{ height: inch(h), fontSize: pt(fs), borderBottom: `0.75pt solid ${color.bg}`, color: INK_TEXT }}
    >
      {showNumber && (
        <span
          className="display tabular grid shrink-0 place-items-center leading-none"
          style={{ background: color.bg, color: color.fg, minWidth: inch(unit * 1.25), paddingInline: inch(unit * 0.15), fontSize: lines === 2 ? pt(fs * 1.4) : undefined }}
        >
          {entry.number}
        </span>
      )}
      {showName && (
        <span className={`min-w-0 self-center font-semibold ${nameClass}`} style={{ paddingInline: inch(unit * 0.25) }}>
          {entry.play.name}
        </span>
      )}
    </div>
  );
}

/** A cell with a label bar on top and the diagram under it. */
function DiagramCell({
  entry,
  w,
  h,
  s,
  label,
  book,
  categories,
  filter,
}: {
  entry: NumberedPlay;
  w: number;
  h: number;
  s: PrintSettings;
  label: LabelLayout;
  book: Playbook;
  categories: Category[];
  filter: PrintFilter;
}) {
  const color = categoryColor(primaryCategory(entry.play, categories, filter), categories, s.colorCoding);
  return (
    <div className="flex flex-col overflow-hidden bg-white" style={{ width: inch(w), height: inch(h) }}>
      <PlayLabel entry={entry} labels={s.labels} style={s.labelStyle} color={color} layout={label} />
      <Diagram book={book} play={entry.play} w={w} h={h - label.h} zoom={s.zoom} icon={s.iconSize} weight={s.lineWeight} />
    </div>
  );
}

/** A player token for the position notes. */
function Token({ p, size }: { p: PlayerSpot; size: number }) {
  const c = PRINT_FILL[p.color];
  const stroke = c.stroke ?? "rgb(16 20 16 / 0.7)";
  const shape =
    p.shape === "square" ? (
      <rect x={-1} y={-1} width={2} height={2} rx={0.2} fill={c.fill} stroke={stroke} strokeWidth={0.12} />
    ) : p.shape === "triangle" ? (
      <polygon points="0,-1.2 1.25,0.9 -1.25,0.9" fill={c.fill} stroke={stroke} strokeWidth={0.12} strokeLinejoin="round" />
    ) : (
      <circle r={1} fill={c.fill} stroke={stroke} strokeWidth={0.12} />
    );
  const fs = p.label.length > 2 ? 0.72 : 0.95;
  return (
    <svg viewBox="-1.35 -1.35 2.7 2.7" aria-hidden="true" className="shrink-0" style={{ width: inch(size), height: inch(size) }}>
      {shape}
      <text y={fs * 0.36 + (p.shape === "triangle" ? 0.2 : 0)} textAnchor="middle" fontSize={fs} className="pf-label" fill={c.text}>
        {p.label}
      </text>
    </svg>
  );
}

// ── Wristbands ──────────────────────────────────────────────────────────────

/** Cards tiled on a sheet, every card edged by a dashed cut line, with a footer line under them. */
function CardSheet({ grid, card, caption, n, total, children }: { grid: { cols: number; rows: number }; card: Size; caption: string; n: number; total: number; children: ReactNode }) {
  const { t } = useApp();
  return (
    <div className="relative flex h-full flex-col">
      <div
        className="grid content-start justify-center"
        style={{ gridTemplateColumns: `repeat(${grid.cols}, ${inch(card.w)})`, gridAutoRows: inch(card.h), maxHeight: `calc(100% - ${inch(FOOTER_H)})` }}
      >
        {children}
      </div>
      <p className="mt-auto flex justify-between gap-4 text-[6.5pt] leading-[1.2]" style={{ color: MUTED, height: inch(FOOTER_H), paddingTop: inch(0.04) }}>
        <span className="pb-line min-w-0">
          {caption} · {t.print.cutHint}
        </span>
        <span className="tabular shrink-0">
          {n} / {total}
        </span>
      </p>
    </div>
  );
}

/** One wristband card: its cut line on the right and bottom (the sheet's first row and column get the rest). */
function Card({ card, index, cols, children }: { card: Size; index: number; cols: number; children: ReactNode }) {
  const dashed = `${inch(CUT)} dashed #8a918c`;
  return (
    <div
      className="overflow-hidden bg-white"
      style={{
        width: inch(card.w),
        height: inch(card.h),
        padding: inch(CARD_PAD),
        borderRight: dashed,
        borderBottom: dashed,
        borderLeft: index % cols === 0 ? dashed : undefined,
        borderTop: index < cols ? dashed : undefined,
      }}
    >
      {children}
    </div>
  );
}

function WristbandCard({ entries, style, card, longest, props }: { entries: NumberedPlay[]; style: PrintStyle; card: Size; longest: number; props: SheetsProps }) {
  const { settings: s, book, categories, filter } = props;
  const inner = { w: card.w - 2 * CARD_PAD - 2 * CUT - 2 * RULE, h: card.h - 2 * CARD_PAD - 2 * CUT - 2 * RULE };
  const color = (e: NumberedPlay) => categoryColor(primaryCategory(e.play, categories, filter), categories, s.colorCoding);

  if (style.strip) {
    // "4 plays": no bars on the cells; each row's two labels stack in a strip between the columns.
    const stripW = clamp(card.w * 0.17, 0.5, 0.85);
    const cellW = (inner.w - stripW - 2 * RULE) / 2;
    const cellH = (inner.h - RULE) / 2;
    const rows = [0, 1].map((r) => [entries[r * 2], entries[r * 2 + 1]] as const);
    return (
      <div
        className="grid"
        style={{ gridTemplateColumns: `${inch(cellW)} ${inch(stripW)} ${inch(cellW)}`, gridTemplateRows: `repeat(2, ${inch(cellH)})`, gap: inch(RULE), background: "#101410", border: `${inch(RULE)} solid #101410` }}
      >
        {rows.map(([left, right], r) => [
          <div key={`l${r}`} className="bg-white">
            {left && <Diagram book={book} play={left.play} w={cellW} h={cellH} zoom={s.zoom} icon={s.iconSize} weight={s.lineWeight} />}
          </div>,
          <div key={`s${r}`} className="flex flex-col" style={{ gap: inch(RULE) }}>
            {[left, right].map((e, j) =>
              e ? <StripLabel key={j} entry={e} pointsRight={j === 1} labels={s.labels} color={color(e)} w={stripW} h={(cellH - RULE) / 2} /> : <div key={j} className="flex-1 bg-white" />,
            )}
          </div>,
          <div key={`r${r}`} className="bg-white">
            {right && <Diagram book={book} play={right.play} w={cellW} h={cellH} zoom={s.zoom} icon={s.iconSize} weight={s.lineWeight} />}
          </div>,
        ])}
      </div>
    );
  }

  const cell = { w: (inner.w - RULE * (style.cols - 1)) / style.cols, h: (inner.h - RULE * (style.rows - 1)) / style.rows };
  const label = labelLayout(cell, s.labelStyle, s.labels, longest);
  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: `repeat(${style.cols}, ${inch(cell.w)})`, gridTemplateRows: `repeat(${style.rows}, ${inch(cell.h)})`, gap: inch(RULE), background: "#101410", border: `${inch(RULE)} solid #101410` }}
    >
      {Array.from({ length: style.cols * style.rows }, (_, i) => {
        const e = entries[i];
        return e ? (
          <DiagramCell key={e.play.id} entry={e} w={cell.w} h={cell.h} s={s} label={label} book={book} categories={categories} filter={filter} />
        ) : (
          <div key={`empty${i}`} className="bg-white" />
        );
      })}
    </div>
  );
}

/** A label in the "4 plays" strip, with a small arrow toward its diagram. */
function StripLabel({ entry, pointsRight, labels, color, w, h }: { entry: NumberedPlay; pointsRight: boolean; labels: PlayLabels; color: LabelColor; w: number; h: number }) {
  const num = Math.min(h * 0.34, w * 0.34);
  const arrow = num * 0.45;
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden text-center leading-none" style={{ background: color.bg, color: color.fg, padding: inch(0.03) }}>
      <svg viewBox="0 0 10 10" aria-hidden="true" className="absolute top-1/2 -translate-y-1/2" style={{ width: inch(arrow), height: inch(arrow), [pointsRight ? "right" : "left"]: inch(0.02) }}>
        <path d={pointsRight ? "M2 1 9 5 2 9Z" : "M8 1 1 5 8 9Z"} fill={color.fg} />
      </svg>
      {labels !== "name" && (
        <span className="display tabular" style={{ fontSize: pt(num) }}>
          {entry.number}
        </span>
      )}
      {labels !== "number" && (
        <span className="line-clamp-2 leading-[1.18] font-semibold [overflow-wrap:anywhere]" style={{ fontSize: pt(Math.min(num * 0.42, 0.1)), marginTop: labels === "both" ? inch(0.02) : undefined, maxWidth: inch(w - arrow * 2.4) }}>
          {entry.play.name}
        </span>
      )}
    </div>
  );
}

function WristbandPages(props: SheetsProps) {
  const s = props.settings;
  const style = findStyle("wristband", s.style);
  const card = { w: s.width, h: s.height };
  const plan = planCards(props.plays, playsPerPage(style), s.copies, card, s.paper);
  const longest = longestName(props.plays);
  return plan.sheets.map((cards, i) => (
    <Sheet key={i} paper={s.paper} n={i + 1} total={plan.sheets.length}>
      <CardSheet grid={plan.grid} card={card} caption={props.caption} n={i + 1} total={plan.sheets.length}>
        {cards.map((entries, j) => (
          <Card key={j} card={card} index={j} cols={plan.grid.cols}>
            <WristbandCard entries={entries} style={style} card={card} longest={longest} props={props} />
          </Card>
        ))}
      </CardSheet>
    </Sheet>
  ));
}

/** A striped list row: the number in a dark (or category-coloured) cell, then the name. */
function ListRow({ entry, h, numW, showNumber, color, stripe, fs }: { entry: NumberedPlay; h: number; numW: number; showNumber: boolean; color: LabelColor; stripe: boolean; fs: number }) {
  return (
    <div className="flex items-stretch leading-[1.2]" style={{ height: inch(h), background: stripe ? STRIPE : "#ffffff", fontSize: pt(fs), color: INK_TEXT }}>
      <span className="display tabular grid shrink-0 place-items-center leading-none" style={{ width: inch(numW), background: color.bg, color: color.fg, fontSize: pt(fs * 1.12) }}>
        {showNumber ? entry.number : null}
      </span>
      <span className="pb-line min-w-0 flex-1 self-center font-semibold" style={{ paddingInline: inch(Math.max(0.04, h * 0.3)) }}>
        {entry.play.name}
      </span>
    </div>
  );
}

function WristbandListPages(props: SheetsProps) {
  const { settings: s, categories, filter } = props;
  const style = findStyle("wristbandList", s.style);
  const card = { w: s.width, h: s.height };
  const rows = wristbandListRows(card.h);
  const plan = planCards(props.plays, style.cols * rows, s.copies, card, s.paper);
  const inner = { w: card.w - 2 * CARD_PAD - 2 * CUT, h: card.h - 2 * CARD_PAD - 2 * CUT };
  const gap = 0.04;
  const colW = (inner.w - gap * (style.cols - 1)) / style.cols;
  const named = s.listLabels === "name";
  const numW = named ? 0.07 : Math.min(0.32, colW * 0.24);
  return plan.sheets.map((cards, i) => (
    <Sheet key={i} paper={s.paper} n={i + 1} total={plan.sheets.length}>
      <CardSheet grid={plan.grid} card={card} caption={props.caption} n={i + 1} total={plan.sheets.length}>
        {cards.map((entries, j) => {
          const columns = chunk(entries, rows);
          return (
            <Card key={j} card={card} index={j} cols={plan.grid.cols}>
              <div className="grid" style={{ gridTemplateColumns: `repeat(${style.cols}, ${inch(colW)})`, columnGap: inch(gap) }}>
                {Array.from({ length: style.cols }, (_, c) => (
                  <div key={c}>
                    {(columns[c] ?? []).map((e, r) => (
                      <ListRow
                        key={e.play.id}
                        entry={e}
                        h={WRISTBAND_ROW}
                        numW={numW}
                        showNumber={!named}
                        color={categoryColor(primaryCategory(e.play, categories, filter), categories, s.colorCoding)}
                        stripe={r % 2 === 1}
                        fs={WRISTBAND_ROW * 0.5}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </CardSheet>
    </Sheet>
  ));
}

// ── Call sheets ─────────────────────────────────────────────────────────────

function CallSheetPages(props: SheetsProps) {
  const { t } = useApp();
  const { settings: s, book, categories, filter } = props;
  const style = findStyle("callSheet", s.style);
  const pages = chunk(props.plays, playsPerPage(style));
  const gap = 0.06;
  const cell = gridCell(bodySize(s.paper), style.cols, style.rows, gap);
  const inner = { w: cell.w - 2 * BORDER, h: cell.h - 2 * BORDER };
  const label = labelLayout(inner, s.labelStyle, s.labels, longestName(props.plays));
  return pages.map((entries, i) => (
    <Sheet key={i} paper={s.paper} n={i + 1} total={pages.length}>
      <PageHeader team={props.team} title={props.team} subtitle={props.caption} page={fill(t.print.pageOf, { n: i + 1, total: pages.length })} />
      <div className="grid" style={{ gridTemplateColumns: `repeat(${style.cols}, ${inch(cell.w)})`, gridTemplateRows: `repeat(${style.rows}, ${inch(cell.h)})`, gap: inch(gap) }}>
        {entries.map((e) => (
          <div key={e.play.id} style={{ border: `${inch(BORDER)} solid #101410` }}>
            <DiagramCell entry={e} w={inner.w} h={inner.h} s={s} label={label} book={book} categories={categories} filter={filter} />
          </div>
        ))}
      </div>
    </Sheet>
  ));
}

function CallSheetListPages(props: SheetsProps) {
  const { t } = useApp();
  const { settings: s, categories } = props;
  const style = findStyle("callSheetList", s.style);
  const pages = flowList(props.groups, style.cols, sheetListRows(s.paper));
  const named = s.listLabels === "name";
  const count = new Map(props.groups.map((g) => [g.id, g.items.length]));
  const groupName = (id: string | null) => (id === null ? t.playbook.uncategorized : (categories.find((c) => c.id === id)?.name ?? ""));
  const fs = SHEET_ROW * 0.42;
  return pages.map((columns, i) => (
    <Sheet key={i} paper={s.paper} n={i + 1} total={pages.length}>
      <PageHeader team={props.team} title={props.team} subtitle={props.caption} page={fill(t.print.pageOf, { n: i + 1, total: pages.length })} />
      <div className="grid" style={{ gridTemplateColumns: `repeat(${style.cols}, minmax(0, 1fr))`, columnGap: inch(0.16) }}>
        {columns.map((col, c) => (
          <div key={c} className="min-w-0">
            {col.map((row, r) => {
              if (row.kind === "header") {
                const color = categoryColor(row.group, categories, s.colorCoding);
                return (
                  <div
                    key={`h${r}`}
                    className="flex items-center justify-between gap-2 overflow-hidden leading-[1.2] font-bold whitespace-nowrap uppercase"
                    style={{ height: inch(SHEET_ROW), background: color.bg, color: color.fg, fontSize: pt(fs * 0.95), paddingInline: inch(0.08), letterSpacing: "0.04em" }}
                  >
                    <span className="pb-line min-w-0">
                      {groupName(row.group)}
                      {row.continued ? ` (${t.print.continued})` : ""}
                    </span>
                    <span className="tabular shrink-0 opacity-80">{count.get(row.group)}</span>
                  </div>
                );
              }
              return <ListRow key={`${row.group}-${row.item.play.id}`} entry={row.item} h={SHEET_ROW} numW={named ? 0.08 : 0.36} showNumber={!named} color={INK} stripe={r % 2 === 0} fs={fs} />;
            })}
          </div>
        ))}
      </div>
    </Sheet>
  ));
}

// ── Playbook pages ──────────────────────────────────────────────────────────

/** Number badge and play name over a diagram. */
function PlayHeading({ entry, labels, h }: { entry: NumberedPlay; labels: PlayLabels; h: number }) {
  return (
    <div className="flex shrink-0 items-center overflow-hidden" style={{ height: inch(h), gap: inch(h * 0.3) }}>
      {labels !== "name" && (
        <span className="display tabular grid shrink-0 place-items-center leading-none text-white" style={{ width: inch(h), height: inch(h), background: INK.bg, fontSize: pt(h * 0.6) }}>
          {entry.number}
        </span>
      )}
      {labels !== "number" && (
        <span className="pb-line min-w-0 leading-[1.2] font-bold" style={{ fontSize: pt(h * 0.56), color: INK_TEXT }}>
          {entry.play.name}
        </span>
      )}
    </div>
  );
}

function PlayBox({ entry, w, h, labels, book }: { entry: NumberedPlay; w: number; h: number; labels: PlayLabels; book: Playbook }) {
  const head = clamp(h * 0.07, 0.26, 0.42);
  const gap = 0.07;
  return (
    <div className="flex flex-col" style={{ width: inch(w), height: inch(h), gap: inch(gap) }}>
      <PlayHeading entry={entry} labels={labels} h={head} />
      <Diagram book={book} play={entry.play} w={w} h={h - head - gap} align="top" framed minAspect={PLAYBOOK_MIN_ASPECT} />
    </div>
  );
}

/** Play notes, then one row per position note, then ruled lines to write on. */
function NotesPanel({ play, w, h }: { play: Play; w: number; h: number }) {
  const { t } = useApp();
  const notes = play.notes.trim();
  const positions = play.players.filter((p) => play.positionNotes[p.id]?.trim());
  const heading = "font-bold uppercase leading-[1.2] tracking-[0.06em]";
  return (
    <div className="flex flex-col overflow-hidden" style={{ width: inch(w), height: inch(h), color: INK_TEXT }}>
      <p className={heading} style={{ fontSize: "8.5pt", color: MUTED }}>
        {t.print.notes}
      </p>
      {notes && (
        <p className="mt-[0.08in] text-[10pt] leading-[1.35] whitespace-pre-wrap" style={{ overflowWrap: "anywhere" }}>
          {notes}
        </p>
      )}
      {positions.length > 0 && (
        <>
          <p className={`${heading} mt-[0.18in]`} style={{ fontSize: "8.5pt", color: MUTED }}>
            {t.print.positionNotes}
          </p>
          <ul className="mt-[0.08in] space-y-[0.07in]">
            {positions.map((p) => (
              <li key={p.id} className="flex items-start gap-[0.08in] text-[10pt] leading-[1.3]">
                <Token p={p} size={0.24} />
                <span className="min-w-0 pt-[0.03in]" style={{ overflowWrap: "anywhere" }}>
                  {play.positionNotes[p.id]}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {/* Writing lines fill the rest; the ones that do not fit are clipped away whole. */}
      <div aria-hidden="true" className="mt-[0.12in] min-h-0 flex-1 overflow-hidden">
        {Array.from({ length: 40 }, (_, i) => (
          <div key={i} style={{ height: "0.3in", borderBottom: `0.75pt solid ${FRAME}` }} />
        ))}
      </div>
    </div>
  );
}

function PlaybookPages(props: SheetsProps) {
  const { t } = useApp();
  const { settings: s, book } = props;
  const style = findStyle("playbook", s.style);
  const pages = chunk(props.plays, playsPerPage(style));
  const body = bodySize(s.paper);
  const gap = 0.22;
  return pages.map((entries, i) => {
    const e = entries[0];
    let content: ReactNode;
    if (style.notes === "below") {
      const dh = body.h * 0.56;
      content = (
        <div className="flex flex-col" style={{ gap: inch(gap) }}>
          <PlayBox entry={e} w={body.w} h={dh} labels={s.labels} book={book} />
          <NotesPanel play={e.play} w={body.w} h={body.h - dh - gap} />
        </div>
      );
    } else if (style.notes === "side") {
      const dw = body.w * 0.6;
      content = (
        <div className="flex" style={{ gap: inch(gap) }}>
          <PlayBox entry={e} w={dw} h={body.h} labels={s.labels} book={book} />
          <NotesPanel play={e.play} w={body.w - dw - gap} h={body.h} />
        </div>
      );
    } else {
      const cell = gridCell(body, style.cols, style.rows, gap);
      content = (
        <div className="grid" style={{ gridTemplateColumns: `repeat(${style.cols}, ${inch(cell.w)})`, gridTemplateRows: `repeat(${style.rows}, ${inch(cell.h)})`, gap: inch(gap) }}>
          {entries.map((x) => (
            <PlayBox key={x.play.id} entry={x} w={cell.w} h={cell.h} labels={s.labels} book={book} />
          ))}
        </div>
      );
    }
    return (
      <Sheet key={i} paper={s.paper} n={i + 1} total={pages.length}>
        <PageHeader team={props.team} title={book.name} subtitle={`${props.team} · ${props.caption}`} page={fill(t.print.pageOf, { n: i + 1, total: pages.length })} />
        {content}
      </Sheet>
    );
  });
}

// ── Scout cards ─────────────────────────────────────────────────────────────

function ScoutCard({ entry, w, h, labels, book }: { entry: NumberedPlay; w: number; h: number; labels: PlayLabels; book: Playbook }) {
  const { t } = useApp();
  const head = clamp(h * 0.06, 0.34, 0.5);
  const pad = 0.18;
  const bodyH = h - 2 * BORDER - head;
  const dw = w - 2 * BORDER - 2 * pad;
  const dh = Math.min(bodyH * 0.52, dw * 0.75);
  const mark = Math.min(dw * 0.1, 0.5);
  const watermark = "display pb-line max-w-full pe-[0.14em] italic leading-[1.15]";
  const rule = <div aria-hidden="true" className="w-full shrink-0" style={{ height: "0.75pt", background: FRAME }} />;
  return (
    <div className="flex flex-col overflow-hidden bg-white" style={{ width: inch(w), height: inch(h), border: `${inch(BORDER)} solid ${FRAME}` }}>
      <div className="flex shrink-0 items-center" style={{ height: inch(head), background: "#e6e9e3", paddingInline: inch(head * 0.18) }}>
        <PlayHeading entry={entry} labels={labels} h={head * 0.68} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center" style={{ paddingInline: inch(pad) }}>
        <div className="flex-1" />
        <p className={watermark} style={{ fontSize: pt(mark), color: "rgb(16 20 16 / 0.14)", marginBottom: inch(mark * 0.3) }}>
          {book.name}
        </p>
        {rule}
        <Diagram book={book} play={entry.play} w={dw} h={dh} />
        {rule}
        <p className={watermark} style={{ fontSize: pt(mark), color: "rgb(16 20 16 / 0.14)", marginTop: inch(mark * 0.3) }}>
          {t.print.opponent}
        </p>
        <div className="flex-1" />
      </div>
    </div>
  );
}

function ScoutPages(props: SheetsProps) {
  const { settings: s, book } = props;
  const style = findStyle("scout", s.style);
  const pages = chunk(props.plays, playsPerPage(style));
  const inner = innerSize(s.paper);
  const gap = 0.3;
  const cell = gridCell(inner, style.cols, style.rows, gap);
  const two = style.cols * style.rows > 1;
  return pages.map((entries, i) => (
    <Sheet key={i} paper={s.paper} n={i + 1} total={pages.length}>
      <div className="relative grid" style={{ gridTemplateColumns: `repeat(${style.cols}, ${inch(cell.w)})`, gridTemplateRows: `repeat(${style.rows}, ${inch(cell.h)})`, gap: inch(gap) }}>
        {entries.map((e) => (
          <ScoutCard key={e.play.id} entry={e} w={cell.w} h={cell.h} labels={s.labels} book={book} />
        ))}
        {two && (
          // Cut line down the middle of the gap between the two cards.
          <div
            aria-hidden="true"
            className="absolute"
            style={
              style.cols > 1
                ? { left: inch(cell.w + gap / 2), top: 0, bottom: 0, borderLeft: `${inch(CUT)} dashed #8a918c` }
                : { top: inch(cell.h + gap / 2), left: 0, right: 0, borderTop: `${inch(CUT)} dashed #8a918c` }
            }
          />
        )}
      </div>
    </Sheet>
  ));
}

// ── Route tree ──────────────────────────────────────────────────────────────

const TREE_COLORS = ["#c92a2a", "#d9480f", "#b08900", "#2b8a3e", "#0b7285", "#1864ab", "#6741d9", "#a61e4d", "#5c940d", "#343a40"];
const flipY = (v: Vec): Vec => ({ x: v.x, y: -v.y });

/** The whole tree from one player on the left half of the field: x > 0 runs toward the middle. */
function TreeDrawing({ w, h }: { w: number; h: number }) {
  const { t } = useApp();
  return (
    <svg viewBox="-17 -16.8 33 19.6" preserveAspectRatio="xMidYMid meet" aria-hidden="true" style={{ width: inch(w), height: inch(h) }} className="block">
      {[5, 10, 15].map((y) => (
        <g key={y}>
          <line x1={-17} x2={16} y1={-y} y2={-y} stroke={FRAME} strokeWidth={0.07} strokeDasharray="0.5 0.4" />
          <text x={-16.8} y={-y - 0.3} fontSize={0.72} fill="#8a918c" className="pf-num">
            {fill(t.print.yards, { n: y })}
          </text>
        </g>
      ))}
      <line x1={-17} x2={16} y1={0} y2={0} stroke="#101410" strokeWidth={0.14} />
      {ROUTE_TREE.map((tpl, i) => {
        const path = [{ x: 0, y: 0 }, ...tpl.points];
        const tip = path[path.length - 1];
        const dir = norm(sub(tip, path[path.length - 2]));
        const marker = endMarker("arrow", tip, dir, 1);
        const color = TREE_COLORS[i % TREE_COLORS.length];
        const at = { x: tip.x + dir.x * 1.75, y: tip.y + dir.y * 1.75 };
        const common = { fill: "none", stroke: color, strokeWidth: 0.26, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
        return (
          <g key={tpl.id}>
            <path d={polylineD(path, flipY)} {...common} />
            {marker.lines.map((line, j) => (
              <path key={j} d={polylineD(line, flipY)} {...common} />
            ))}
            <circle cx={at.x} cy={-at.y} r={0.95} fill={color} />
            <text x={at.x} y={-at.y + 0.36} textAnchor="middle" fontSize={tpl.id.length > 1 ? 0.8 : 1} fill="#ffffff" className="pf-label">
              {tpl.id}
            </text>
          </g>
        );
      })}
      <circle cx={0} cy={0} r={0.85} fill="#101410" />
    </svg>
  );
}

function RouteCard({ tpl, color, w, h }: { tpl: RouteTemplate; color: string; w: number; h: number }) {
  const { locale } = useApp();
  const path = [{ x: 0, y: 0 }, ...tpl.points];
  // Every card at one scale (16 yards across), each centred on its own route.
  const xs = path.map((p) => p.x);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const tip = path[path.length - 1];
  const marker = endMarker("arrow", tip, norm(sub(tip, path[path.length - 2])), 1.1);
  const common = { fill: "none", stroke: color, strokeWidth: 0.36, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <div className="flex flex-col overflow-hidden" style={{ width: inch(w), height: inch(h), border: `${inch(BORDER)} solid ${FRAME}`, borderRadius: "0.06in", padding: "0.08in" }}>
      <div className="flex items-baseline gap-[0.06in] leading-none">
        <span className="display" style={{ fontSize: "22pt", color }}>
          {tpl.id}
        </span>
        <span className="pb-line min-w-0 text-[10pt] leading-[1.2] font-semibold" style={{ color: INK_TEXT }}>
          {tpl.name[locale]}
        </span>
      </div>
      <svg viewBox={`${cx - 8} -14.2 16 15.6`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" className="mt-[0.04in] block min-h-0 w-full flex-1">
        <line x1={cx - 8} x2={cx + 8} y1={0} y2={0} stroke={FRAME} strokeWidth={0.2} />
        <path d={polylineD(path, flipY)} {...common} />
        {marker.lines.map((line, j) => (
          <path key={j} d={polylineD(line, flipY)} {...common} />
        ))}
        <circle cx={0} cy={0} r={0.7} fill="#101410" />
      </svg>
    </div>
  );
}

function RouteTreePages(props: SheetsProps) {
  const { t } = useApp();
  const s = props.settings;
  const body = bodySize(s.paper);
  const caption = 0.42;
  const treeH = Math.min(body.h * 0.48, body.w / 1.6);
  const gap = 0.12;
  const gridTop = 0.16;
  const cell = gridCell({ w: body.w, h: body.h - caption - treeH - gridTop }, 5, 2, gap);
  return [
    <Sheet key="tree" paper={s.paper} n={1} total={1}>
      <PageHeader team={props.team} title={t.print.formats.routeTree.title} subtitle={props.team} />
      <p className="text-[9.5pt] leading-[1.35]" style={{ height: inch(caption), color: MUTED }}>
        {t.print.routeTreeBody}
      </p>
      <TreeDrawing w={body.w} h={treeH} />
      <div className="grid" style={{ marginTop: inch(gridTop), gridTemplateColumns: `repeat(5, ${inch(cell.w)})`, gridTemplateRows: `repeat(2, ${inch(cell.h)})`, gap: inch(gap) }}>
        {ROUTE_TREE.map((tpl, i) => (
          <RouteCard key={tpl.id} tpl={tpl} color={TREE_COLORS[i % TREE_COLORS.length]} w={cell.w} h={cell.h} />
        ))}
      </div>
    </Sheet>,
  ];
}

/** Every page of the chosen format, in order (each page a direct child of the preview list). */
export function PrintPages(props: SheetsProps) {
  switch (props.format) {
    case "wristband":
      return <WristbandPages {...props} />;
    case "wristbandList":
      return <WristbandListPages {...props} />;
    case "callSheet":
      return <CallSheetPages {...props} />;
    case "callSheetList":
      return <CallSheetListPages {...props} />;
    case "playbook":
      return <PlaybookPages {...props} />;
    case "scout":
      return <ScoutPages {...props} />;
    case "routeTree":
      return <RouteTreePages {...props} />;
  }
}
