import type { ReactNode } from "react";
import type { PrintFormat, PrintStyle } from "@/domain/playbook/print";

/** Small drawings of each format and style, on the app's dark surface: paper in chalk, ink in night. */
const PAPER = "#f2f4ed";
const INK = "#0e120f";
const LINE = "#b9c0b8";
const ACCENTS = ["#ff6a3d", "#ffb547", "#7fd6ff", "#d7ff3a", "#b48cff"];

/** A tiny play: a line of scrimmage, a few players, two routes. Drawn in a 20 × 14 box. */
function MiniPlay({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const sx = w / 20;
  const sy = h / 14;
  const p = (px: number, py: number) => `${x + px * sx},${y + py * sy}`;
  return (
    <g>
      <line x1={x + 1 * sx} x2={x + 19 * sx} y1={y + 9 * sy} y2={y + 9 * sy} stroke={LINE} strokeWidth={Math.max(0.4, sy * 0.35)} />
      <polyline points={`${p(4, 10)} ${p(4, 4)} ${p(8, 3)}`} fill="none" stroke={ACCENTS[0]} strokeWidth={Math.max(0.5, sy * 0.55)} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={`${p(16, 10)} ${p(16, 5)} ${p(12, 2.5)}`} fill="none" stroke={ACCENTS[2]} strokeWidth={Math.max(0.5, sy * 0.55)} strokeLinecap="round" strokeLinejoin="round" />
      {[4, 8, 10, 12, 16].map((px, i) => (
        <circle key={px} cx={x + px * sx} cy={y + (i === 2 ? 12 : 10) * sy} r={Math.max(0.6, Math.min(sx, sy) * 0.95)} fill={i === 2 ? ACCENTS[3] : INK} />
      ))}
    </g>
  );
}

/** A grid of play cells with a dark label bar on each. */
function CellGrid({ x, y, w, h, cols, rows, bar = 0.2 }: { x: number; y: number; w: number; h: number; cols: number; rows: number; bar?: number }) {
  const gap = Math.max(0.6, Math.min(w, h) * 0.025);
  const cw = (w - gap * (cols - 1)) / cols;
  const ch = (h - gap * (rows - 1)) / rows;
  const cells: ReactNode[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const cx = x + c * (cw + gap);
      const cy = y + r * (ch + gap);
      const bh = Math.max(1, ch * bar);
      cells.push(
        <g key={`${r}-${c}`}>
          <rect x={cx} y={cy} width={cw} height={ch} fill="#ffffff" stroke={INK} strokeWidth={0.4} />
          <rect x={cx} y={cy} width={cw} height={bh} fill={INK} />
          <MiniPlay x={cx} y={cy + bh} w={cw} h={ch - bh} />
        </g>,
      );
    }
  return <g>{cells}</g>;
}

/** Striped list rows with a dark number column, split into columns; `groups` adds coloured header bars. */
function ListColumns({ x, y, w, h, cols, rows, groups }: { x: number; y: number; w: number; h: number; cols: number; rows: number; groups?: boolean }) {
  const gap = w * 0.04;
  const cw = (w - gap * (cols - 1)) / cols;
  const rh = h / rows;
  const out: ReactNode[] = [];
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) {
      const cx = x + c * (cw + gap);
      const cy = y + r * rh;
      const header = groups && (r + c * 2) % 5 === 0;
      out.push(
        header ? (
          <rect key={`${c}-${r}`} x={cx} y={cy} width={cw} height={rh} fill={ACCENTS[(r + c) % ACCENTS.length]} />
        ) : (
          <g key={`${c}-${r}`}>
            <rect x={cx} y={cy} width={cw} height={rh} fill={r % 2 ? "#e2e6df" : "#ffffff"} />
            <rect x={cx} y={cy} width={Math.max(1.2, cw * 0.16)} height={rh} fill={INK} />
            <rect x={cx + cw * 0.24} y={cy + rh * 0.35} width={cw * (0.35 + ((r * 7 + c * 3) % 5) * 0.08)} height={rh * 0.3} fill="#8f9891" />
          </g>
        ),
      );
    }
  return <g>{out}</g>;
}

function Page({ x, y, w, h, children }: { x: number; y: number; w: number; h: number; children?: ReactNode }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={1.2} fill={PAPER} />
      {children}
    </g>
  );
}

function Header({ x, y, w }: { x: number; y: number; w: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w * 0.1} height={w * 0.1} fill={INK} />
      <rect x={x + w * 0.14} y={y + w * 0.015} width={w * 0.4} height={w * 0.035} fill={INK} />
      <rect x={x + w * 0.14} y={y + w * 0.065} width={w * 0.28} height={w * 0.02} fill="#8f9891" />
      <rect x={x} y={y + w * 0.12} width={w} height={0.5} fill={INK} />
    </g>
  );
}

/** A diagram box with a number badge and a name line above it. */
function PlayBox({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const bh = Math.min(h * 0.14, w * 0.12);
  return (
    <g>
      <rect x={x} y={y} width={bh} height={bh} fill={INK} />
      <rect x={x + bh * 1.3} y={y + bh * 0.3} width={w * 0.45} height={bh * 0.4} fill="#5b625e" />
      <rect x={x} y={y + bh * 1.2} width={w} height={h - bh * 1.2} fill="#ffffff" stroke={LINE} strokeWidth={0.5} />
      <MiniPlay x={x} y={y + bh * 1.2} w={w} h={h - bh * 1.2} />
    </g>
  );
}

function NoteLines({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const n = Math.max(2, Math.floor(h / 3.2));
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <g key={i}>
          <circle cx={x + 1.2} cy={y + 1.5 + i * (h / n)} r={1} fill={ACCENTS[i % ACCENTS.length]} />
          <rect x={x + 3.2} y={y + 1.2 + i * (h / n)} width={w - 3.2} height={0.6} fill="#9aa39c" />
        </g>
      ))}
    </g>
  );
}

function ScoutCard({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const hb = Math.min(h * 0.1, 6);
  const fh = Math.min(h * 0.42, w * 0.6);
  const fy = y + hb + (h - hb - fh) / 2;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#ffffff" stroke={LINE} strokeWidth={0.5} />
      <rect x={x} y={y} width={w} height={hb} fill="#dfe3dc" />
      <rect x={x + hb * 0.2} y={y + hb * 0.15} width={hb * 0.7} height={hb * 0.7} fill={INK} />
      <rect x={x + hb * 1.2} y={y + hb * 0.38} width={w * 0.35} height={hb * 0.26} fill="#5b625e" />
      <rect x={x + w * 0.25} y={fy - h * 0.08} width={w * 0.5} height={Math.max(0.8, h * 0.025)} fill="#cfd4cc" />
      <line x1={x + 2} x2={x + w - 2} y1={fy} y2={fy} stroke={LINE} strokeWidth={0.4} />
      <MiniPlay x={x + 1} y={fy} w={w - 2} h={fh} />
      <line x1={x + 2} x2={x + w - 2} y1={fy + fh} y2={fy + fh} stroke={LINE} strokeWidth={0.4} />
      <rect x={x + w * 0.3} y={fy + fh + h * 0.055} width={w * 0.4} height={Math.max(0.8, h * 0.025)} fill="#cfd4cc" />
    </g>
  );
}

/** The route tree: routes branching from one player, numbers at the tips. */
function Tree({ x, y, s, color = PAPER }: { x: number; y: number; s: number; color?: string }) {
  const routes: [number, number][][] = [
    [[-13, 4]],
    [[0, 2.5], [10.5, 4.5]],
    [[0, 5], [-9, 5]],
    [[0, 7], [11, 7]],
    [[0, 7], [-8, 11]],
    [[0, 7], [6, 12.5]],
    [[0, 12.5]],
  ];
  return (
    <g>
      <line x1={x - 15 * s} x2={x + 13 * s} y1={y} y2={y} stroke={color} strokeWidth={0.35 * s} opacity={0.35} />
      {routes.map((pts, i) => (
        <polyline
          key={i}
          points={[[0, 0], ...pts].map(([px, py]) => `${x + px * s},${y - py * s}`).join(" ")}
          fill="none"
          stroke={ACCENTS[i % ACCENTS.length]}
          strokeWidth={0.45 * s}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      <circle cx={x} cy={y} r={1.1 * s} fill={color} />
    </g>
  );
}

/** The picture on a format card. */
export function FormatThumb({ format, className }: { format: PrintFormat; className?: string }) {
  let body: ReactNode;
  switch (format) {
    case "wristband":
      body = (
        <g>
          <rect x={22} y={14} width={116} height={62} rx={4} fill="#1b221e" />
          <Page x={28} y={19} w={104} h={52}>
            <CellGrid x={31} y={22} w={98} h={46} cols={4} rows={2} />
          </Page>
        </g>
      );
      break;
    case "wristbandList":
      body = (
        <g>
          <rect x={22} y={14} width={116} height={62} rx={4} fill="#1b221e" />
          <Page x={28} y={19} w={104} h={52}>
            <ListColumns x={31} y={22} w={98} h={46} cols={2} rows={8} />
          </Page>
        </g>
      );
      break;
    case "callSheet":
      body = (
        <Page x={52} y={6} w={56} h={78}>
          <Header x={55} y={9} w={50} />
          <CellGrid x={55} y={17} w={50} h={64} cols={4} rows={6} bar={0.24} />
        </Page>
      );
      break;
    case "callSheetList":
      body = (
        <Page x={52} y={6} w={56} h={78}>
          <Header x={55} y={9} w={50} />
          <ListColumns x={55} y={17} w={50} h={64} cols={2} rows={16} groups />
        </Page>
      );
      break;
    case "playbook":
      body = (
        <g>
          <Page x={40} y={10} w={52} h={74} />
          <Page x={48} y={6} w={56} h={78}>
            <Header x={51} y={9} w={50} />
            <PlayBox x={51} y={17} w={50} h={36} />
            <NoteLines x={51} y={57} w={50} h={22} />
          </Page>
        </g>
      );
      break;
    case "scout":
      body = (
        <Page x={52} y={6} w={56} h={78}>
          <ScoutCard x={55} y={9} w={50} h={72} />
        </Page>
      );
      break;
    case "routeTree":
      body = <Tree x={80} y={72} s={4.2} />;
      break;
  }
  return (
    <svg viewBox="0 0 160 90" aria-hidden="true" className={className}>
      {body}
    </svg>
  );
}

/** The picture on a style tile: the layout of one card or page in that style. */
export function StyleThumb({ format, style, className }: { format: PrintFormat; style: PrintStyle; className?: string }) {
  let body: ReactNode;
  if (format === "wristband") {
    body = (
      <Page x={4} y={9} w={52} h={30}>
        {style.strip ? (
          <g>
            <CellGrid x={6} y={11} w={19} h={26} cols={1} rows={2} bar={0} />
            <rect x={26} y={11} width={8} height={26} fill={INK} />
            <CellGrid x={35} y={11} w={19} h={26} cols={1} rows={2} bar={0} />
          </g>
        ) : (
          <CellGrid x={6} y={11} w={48} h={26} cols={style.cols} rows={style.rows} bar={style.rows > 2 ? 0.26 : 0.2} />
        )}
      </Page>
    );
  } else if (format === "wristbandList") {
    body = (
      <Page x={4} y={9} w={52} h={30}>
        <ListColumns x={6} y={11} w={48} h={26} cols={style.cols} rows={7} />
      </Page>
    );
  } else if (format === "callSheet") {
    body = (
      <g>
        <Page x={17} y={3} w={30} h={40} />
        <Page x={13} y={1} w={30} h={40}>
          <CellGrid x={15} y={4} w={26} h={35} cols={style.cols} rows={style.rows} bar={0.22} />
        </Page>
      </g>
    );
  } else if (format === "callSheetList") {
    body = (
      <Page x={15} y={2} w={30} h={40}>
        <ListColumns x={17} y={5} w={26} h={35} cols={style.cols} rows={14} groups />
      </Page>
    );
  } else if (format === "playbook") {
    const inner = { x: 17, y: 5, w: 26, h: 35 };
    const gap = 1.5;
    const boxes: ReactNode[] = [];
    if (style.notes === "below") {
      boxes.push(<PlayBox key="p" x={inner.x} y={inner.y} w={inner.w} h={19} />, <NoteLines key="n" x={inner.x} y={inner.y + 21} w={inner.w} h={13} />);
    } else if (style.notes === "side") {
      boxes.push(<PlayBox key="p" x={inner.x} y={inner.y} w={15} h={inner.h} />, <NoteLines key="n" x={inner.x + 16.5} y={inner.y + 5} w={9.5} h={24} />);
    } else {
      const cw = (inner.w - gap * (style.cols - 1)) / style.cols;
      const ch = (inner.h - gap * (style.rows - 1)) / style.rows;
      for (let r = 0; r < style.rows; r++) for (let c = 0; c < style.cols; c++) boxes.push(<PlayBox key={`${r}-${c}`} x={inner.x + c * (cw + gap)} y={inner.y + r * (ch + gap)} w={cw} h={ch} />);
    }
    body = (
      <Page x={15} y={2} w={30} h={40}>
        {boxes}
      </Page>
    );
  } else if (format === "scout") {
    const cards: ReactNode[] = [];
    const inner = { x: 17, y: 4, w: 26, h: 36 };
    const gap = 1.5;
    const cw = (inner.w - gap * (style.cols - 1)) / style.cols;
    const ch = (inner.h - gap * (style.rows - 1)) / style.rows;
    for (let r = 0; r < style.rows; r++) for (let c = 0; c < style.cols; c++) cards.push(<ScoutCard key={`${r}-${c}`} x={inner.x + c * (cw + gap)} y={inner.y + r * (ch + gap)} w={cw} h={ch} />);
    body = (
      <Page x={15} y={2} w={30} h={40}>
        {cards}
      </Page>
    );
  } else {
    body = (
      <Page x={15} y={2} w={30} h={40}>
        <Tree x={30} y={22} s={1} color={INK} />
        <CellGrid x={17} y={26} w={26} h={13} cols={5} rows={2} bar={0} />
      </Page>
    );
  }
  return (
    <svg viewBox="0 0 60 44" aria-hidden="true" className={className}>
      {body}
    </svg>
  );
}
