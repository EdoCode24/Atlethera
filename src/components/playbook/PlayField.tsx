import { memo, type PointerEventHandler, type Ref } from "react";
import { endMarker, polylineD, routeGeometry, zoneCenter } from "@/domain/playbook/geometry";
import { backfieldDepth } from "@/domain/playbook/factory";
import type { FieldLines, FieldSettings, PlayerColor, PlayerSpot, PlaySide, Vec } from "@/domain/playbook/types";
import type { SportId } from "@/domain/sports/types";

/** Fill colours for players, routes and zones. Labels switch to dark on light fills. */
export const PLAYER_FILL: Record<PlayerColor, { fill: string; text: string }> = {
  volt: { fill: "#d7ff3a", text: "#050706" },
  ice: { fill: "#7fd6ff", text: "#050706" },
  amber: { fill: "#ffb547", text: "#050706" },
  signal: { fill: "#ff6a3d", text: "#050706" },
  violet: { fill: "#b48cff", text: "#050706" },
  teal: { fill: "#3fd6b4", text: "#050706" },
  chalk: { fill: "#f2f4ed", text: "#050706" },
  slate: { fill: "#6b7771", text: "#f2f4ed" },
};

/**
 * Paper versions of the player colours: deep enough to read as lines on white, with a route
 * colour of their own where the token fill is light (chalk becomes an open token with ink routes).
 */
export const PRINT_FILL: Record<PlayerColor, { fill: string; text: string; route: string; stroke?: string }> = {
  volt: { fill: "#8fb800", text: "#101410", route: "#6b8a00" },
  ice: { fill: "#1f8fd1", text: "#ffffff", route: "#1f8fd1" },
  amber: { fill: "#f08c00", text: "#101410", route: "#d97a00" },
  signal: { fill: "#e03e12", text: "#ffffff", route: "#e03e12" },
  violet: { fill: "#7048e8", text: "#ffffff", route: "#7048e8" },
  teal: { fill: "#0c9a7c", text: "#ffffff", route: "#0c9a7c" },
  chalk: { fill: "#ffffff", text: "#101410", route: "#343a36", stroke: "#101410" },
  slate: { fill: "#5b6660", text: "#ffffff", route: "#5b6660" },
};

/** Routes of grey (slate) players on the night turf: lighter than the token, so blocks and lines show. */
const SLATE_ROUTE = "#a4afa9";

/** Night turf and a whiteboard-like day field. The line of scrimmage is broadcast blue in both. */
const PALETTE = {
  dark: {
    outside: "#07100b",
    turf: "#0e2416",
    stripe: "#122d1c",
    endZone: "#17391f",
    line: "#f2f4ed",
    los: "#5cb8ff",
    ghostFill: "rgb(7 16 11 / 0.7)",
    ghostStroke: "rgb(242 244 237 / 0.42)",
    ghostText: "#c6ccc4",
    outline: "rgb(5 7 6 / 0.55)",
  },
  light: {
    outside: "#d3d9ce",
    turf: "#eef2ea",
    stripe: "#e7ece2",
    endZone: "#dbe7d4",
    line: "#1b1f1c",
    los: "#1f6fd1",
    ghostFill: "rgb(238 242 234 / 0.8)",
    ghostStroke: "rgb(27 31 28 / 0.45)",
    ghostText: "#3b433e",
    outline: "rgb(5 7 6 / 0.3)",
  },
  /** Paper: white field, grey lines, an ink line of scrimmage, no mowing stripes or shadows. */
  print: {
    outside: "#ffffff",
    turf: "#ffffff",
    stripe: "#ffffff",
    endZone: "#eef0ec",
    line: "#101410",
    los: "#101410",
    ghostFill: "#f3f4f1",
    ghostStroke: "#8a918c",
    ghostText: "#4d5550",
    outline: "rgb(16 20 16 / 0.7)",
  },
} as const;

export type FieldPalette = "screen" | "print";

const paletteOf = (palette: FieldPalette, settings: FieldSettings) => PALETTE[palette === "print" ? "print" : settings.theme === "light" ? "light" : "dark"];

/** NFL inbound lines (hash marks), yards from each sideline. */
const AF_HASH = 23.583;

/** Screen-independent drawing: yards in, SVG units out (y flips so up-field is up). */
export const toSvg = (v: Vec): Vec => ({ x: v.x, y: -v.y });

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function playerRadius(sport: SportId): number {
  // American football linemen stand about 1.8 yards apart, so their tokens stay a touch smaller.
  return sport === "american-football" ? 0.84 : 0.95;
}

function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(3)},${(cy + r * Math.sin(a)).toFixed(3)}`);
  }
  return pts.join(" ");
}

function Shape({ p, r, fill, stroke, strokeWidth, opacity }: { p: PlayerSpot; r: number; fill: string; stroke?: string; strokeWidth?: number; opacity?: number }) {
  const { x, y } = toSvg(p);
  const common = { fill, stroke, strokeWidth, opacity };
  if (p.starred) return <polygon points={starPoints(x, y, r * 1.45, r * 0.72)} {...common} strokeLinejoin="round" />;
  if (p.shape === "square") return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} rx={r * 0.2} {...common} />;
  if (p.shape === "triangle") {
    const h = r * 1.25;
    return <polygon points={`${x},${y - h} ${x + h * 1.05},${y + h * 0.72} ${x - h * 1.05},${y + h * 0.72}`} {...common} strokeLinejoin="round" />;
  }
  return <circle cx={x} cy={y} r={r} {...common} />;
}

/** Memoised: during playback only the players move, so routes are not re-sampled every frame. */
const RouteDrawing = memo(function RouteDrawing({ p, stroke, width, size }: { p: PlayerSpot; stroke: string; width: number; size: number }) {
  if (!p.route) return null;
  const geo = routeGeometry(p, p.route, size);
  if (!geo) return null;
  const dash = p.route.line === "dashed" ? `${width * 2.6} ${width * 1.8}` : undefined;
  const marker = endMarker(p.route.end, geo.tip, geo.dir, size * geo.tipScale);
  const common = { fill: "none", stroke, strokeWidth: width, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <g data-route>
      {geo.zigzag.length > 1 && <path d={polylineD(geo.zigzag, toSvg)} {...common} />}
      {geo.body.length > 1 && <path d={polylineD(geo.body, toSvg)} {...common} strokeDasharray={dash} />}
      {marker.lines.map((line, i) => (
        <path key={i} d={polylineD(line, toSvg)} {...common} />
      ))}
      {marker.ring && <circle cx={marker.ring.x} cy={-marker.ring.y} r={0.34 * size * geo.tipScale} {...common} />}
    </g>
  );
});

interface FieldProps {
  width: number;
  view: ViewBox;
  settings: FieldSettings;
  lines: FieldLines;
  sport: SportId;
  k: number;
  palette: FieldPalette;
  goalBehind: boolean;
  compressBeyond: number | null;
  compressedLabel?: string;
}

/** One path for every one-yard tick along both sidelines (and the hash marks in American football). */
function tickPath(width: number, sport: SportId, from: number, to: number): string {
  const len = 0.7;
  const xs: [number, number][] = [
    [0, len],
    [width - len, width],
  ];
  if (sport === "american-football") xs.push([AF_HASH - len / 2, AF_HASH + len / 2], [width - AF_HASH - len / 2, width - AF_HASH + len / 2]);
  let d = "";
  for (let y = Math.ceil(from); y <= to; y++) {
    if (y % 5 === 0) continue;
    for (const [a, b] of xs) d += `M${a} ${-y}H${b}`;
  }
  return d;
}

const Field = memo(function Field({ width, view, settings, lines, sport, k, palette, goalBehind, compressBeyond, compressedLabel }: FieldProps) {
  const c = paletteOf(palette, settings);
  const print = palette === "print";
  const yTop = -view.y;
  const yBottom = -(view.y + view.h);
  const marks: number[] = [];
  // The goal line: up-field on offense, behind us on defense (the goal the defense protects).
  const dir = goalBehind ? -1 : 1;
  const goal = settings.ballOn === null ? null : settings.ballOn * dir;
  const beforeGoal = (y: number) => goal === null || y * dir < goal * dir;
  // On a compressed special-teams board, yard marks exist only where depth is true to scale.
  const trueDepth = (y: number) => compressBeyond === null || Math.abs(y) <= compressBeyond;
  // Five-yard lines, but none in or past the end zone.
  if (lines !== "none") for (let y = Math.ceil(yBottom / 5) * 5; y <= yTop; y += 5) if (y !== 0 && beforeGoal(y) && trueDepth(y)) marks.push(y);
  // Mowing stripes, five yards each, lined up with the line of scrimmage.
  const bands: number[] = [];
  if (!print) for (let y = Math.floor(yBottom / 5) * 5; y < yTop; y += 5) if (Math.abs(y / 5) % 2 === 1) bands.push(y);
  const sideline = 0.2 * k;

  return (
    <g>
      <rect x={view.x} y={view.y} width={view.w} height={view.h} fill={c.outside} />
      <rect x={0} y={view.y} width={width} height={view.h} fill={c.turf} />
      {bands.map((y) => (
        <rect key={y} x={0} y={-(y + 5)} width={width} height={5} fill={c.stripe} />
      ))}
      {goal !== null && (
        <g>
          {/* End zone: a solid tint with its name; the flag no-run zone before it is hatched. */}
          <rect x={0} y={-Math.max(goal, goal + 10 * dir)} width={width} height={10} fill={c.endZone} />
          {/* Past the end line is out of bounds. */}
          {dir > 0
            ? -(goal + 10) > view.y && <rect x={0} y={view.y} width={width} height={-(goal + 10) - view.y} fill={c.outside} />
            : -(goal - 10) < view.y + view.h && <rect x={0} y={-(goal - 10)} width={width} height={view.y + view.h + (goal - 10)} fill={c.outside} />}
          <line x1={0} x2={width} y1={-(goal + 10 * dir)} y2={-(goal + 10 * dir)} stroke={c.line} strokeWidth={0.2 * k} opacity={0.75} />
          <text x={width / 2} y={-(goal + 5 * dir) + 0.9} textAnchor="middle" fontSize={2.4} className="pf-num" fill={c.line} opacity={0.18} letterSpacing={0.4}>
            END ZONE
          </text>
          {sport === "flag-football" && <rect x={0} y={-Math.max(goal, goal - 5 * dir)} width={width} height={5} fill="url(#pf-hatch)" opacity={0.5} />}
        </g>
      )}
      <path
        d={tickPath(
          width,
          sport,
          Math.max(yBottom, -40, compressBeyond === null ? -Infinity : -compressBeyond, goal !== null && dir < 0 ? goal : -Infinity),
          Math.min(yTop, 60, compressBeyond ?? Infinity, goal !== null && dir > 0 ? goal : Infinity),
        )}
        stroke={c.line}
        strokeWidth={0.07 * k}
        opacity={0.3}
      />
      {compressBeyond !== null &&
        [1, -1].map((side) => {
          // A torn-paper line where the depth stops being true to scale.
          const y = side * (compressBeyond + 0.6);
          if (y < yBottom || y > yTop) return null;
          const pts: string[] = [];
          for (let x = 0, up = true; x <= width + 0.01; x += 0.9, up = !up) pts.push(`${x.toFixed(2)},${(-y + (up ? -0.22 : 0.22)).toFixed(2)}`);
          return (
            <g key={side} opacity={0.4}>
              <polyline points={pts.join(" ")} fill="none" stroke={c.line} strokeWidth={0.06 * k} strokeDasharray={`${0.35 * k} ${0.25 * k}`} />
              {compressedLabel && (
                <text x={1} y={-y + (side > 0 ? -0.6 : 1.3) * k} fontSize={0.95 * k} fill={c.line} className="pf-num">
                  {compressedLabel}
                </text>
              )}
            </g>
          );
        })}
      {marks.map((y) => (
        <g key={y}>
          <line x1={0} x2={width} y1={-y} y2={-y} stroke={c.line} strokeWidth={0.08 * k} opacity={0.26} />
          {lines === "fiveNumbered" && (
            <>
              <text x={1.2} y={-y - 0.35} fontSize={0.95} fill={c.line} opacity={0.45} className="pf-num">
                {Math.abs(y)}
              </text>
              <text x={width - 1.2} y={-y - 0.35} fontSize={0.95} fill={c.line} opacity={0.45} textAnchor="end" className="pf-num">
                {Math.abs(y)}
              </text>
            </>
          )}
        </g>
      ))}
      {goal !== null && <line x1={0} x2={width} y1={-goal} y2={-goal} stroke={c.line} strokeWidth={0.24 * k} opacity={0.9} />}
      <line x1={0} x2={width} y1={0} y2={0} stroke={c.los} strokeWidth={0.16 * k} opacity={0.95} />
      <line x1={-sideline / 2} x2={-sideline / 2} y1={view.y} y2={view.y + view.h} stroke={c.line} strokeWidth={sideline} opacity={0.75} />
      <line x1={width + sideline / 2} x2={width + sideline / 2} y1={view.y} y2={view.y + view.h} stroke={c.line} strokeWidth={sideline} opacity={0.75} />
    </g>
  );
});

export interface PlayFieldProps {
  sport: SportId;
  fieldWidth: number;
  fieldLines: FieldLines;
  settings: FieldSettings;
  players: PlayerSpot[];
  opponent: PlayerSpot[];
  view: ViewBox;
  /**
   * Scales players, strokes and markers (1 = the reference size in yards). A big screen that
   * zooms the field in passes less than 1 so they keep the same size on screen.
   */
  sizeScale?: number;
  selectedId?: string | null;
  /** Current spots during playback; routes stay where they were drawn. */
  positions?: Record<string, Vec> | null;
  guide?: Vec | null;
  showHandles?: boolean;
  /** Route opacity while players run (playback). */
  runningRouteOpacity?: number;
  /** "print": white paper look with ink lines and print colours, no stripes or shadows. */
  palette?: FieldPalette;
  /** Multiplies the route line width only (print: thin, medium, thick). */
  strokeScale?: number;
  /** Position letters smaller than this (SVG units) are left off; print uses it where they would be unreadable. */
  minLabel?: number;
  /** Defense: the end zone ("ball on") is the goal behind us, not up-field. */
  goalBehind?: boolean;
  /** Special teams: depth past this many yards from the ball is compressed; no yard marks there. */
  compressBeyond?: number | null;
  /** Words shown at the compression line. */
  compressedLabel?: string;
  label?: string;
  className?: string;
  svgRef?: Ref<SVGSVGElement>;
  onPointerDown?: PointerEventHandler<SVGSVGElement>;
  onPointerMove?: PointerEventHandler<SVGSVGElement>;
  onPointerUp?: PointerEventHandler<SVGSVGElement>;
  onPointerCancel?: PointerEventHandler<SVGSVGElement>;
  onPointerLeave?: PointerEventHandler<SVGSVGElement>;
}

export function PlayField({
  sport,
  fieldWidth,
  fieldLines,
  settings,
  players,
  opponent,
  view,
  sizeScale = 1,
  selectedId,
  positions,
  guide,
  showHandles,
  runningRouteOpacity = 0.5,
  palette = "screen",
  strokeScale = 1,
  minLabel = 0,
  goalBehind = false,
  compressBeyond = null,
  compressedLabel,
  label,
  className,
  svgRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
}: PlayFieldProps) {
  const k = sizeScale;
  const r = playerRadius(sport) * k;
  const c = paletteOf(palette, settings);
  const print = palette === "print";
  // Paper and the light field share the deep inks: pale colours vanish on white.
  const ink = print || settings.theme === "light";
  const fills = ink ? PRINT_FILL : PLAYER_FILL;
  const routeColor = (p: PlayerSpot) => (ink ? PRINT_FILL[p.color].route : p.color === "slate" ? SLATE_ROUTE : PLAYER_FILL[p.color].fill);
  const routeWidth = (sport === "american-football" ? 0.18 : 0.2) * k * strokeScale;
  const dimmed = (id: string) => selectedId != null && selectedId !== id;
  const at = (p: PlayerSpot): PlayerSpot => (positions?.[p.id] ? { ...p, ...positions[p.id] } : p);
  const selected = players.find((p) => p.id === selectedId) ?? null;

  return (
    <svg
      ref={svgRef}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      preserveAspectRatio="xMidYMid slice"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={className}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel ?? onPointerUp}
      onPointerLeave={onPointerLeave}
    >
      <defs>
        <pattern id="pf-hatch" width="1" height="1" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="0.18" height="1" fill={c.line} opacity="0.25" />
        </pattern>
      </defs>

      <Field
        width={fieldWidth}
        view={view}
        settings={settings}
        lines={fieldLines}
        sport={sport}
        k={k}
        palette={palette}
        goalBehind={goalBehind}
        compressBeyond={compressBeyond}
        compressedLabel={compressedLabel}
      />

      {players.map((p) =>
        p.zone ? (
          <circle
            key={`z${p.id}`}
            cx={zoneCenter(p).x}
            cy={-zoneCenter(p).y}
            r={p.zone.radius}
            fill={routeColor(p)}
            opacity={dimmed(p.id) ? 0.14 : 0.28}
          />
        ) : null,
      )}

      {guide && (
        <g stroke={c.line} strokeWidth={0.05 * k} opacity={0.35}>
          <line x1={view.x} x2={view.x + view.w} y1={-guide.y} y2={-guide.y} />
          <line x1={guide.x} x2={guide.x} y1={view.y} y2={view.y + view.h} />
        </g>
      )}

      {settings.showOpponent &&
        opponent.map((p) => (
          <g key={p.id}>
            <Shape p={p} r={r * 0.92} fill={c.ghostFill} stroke={c.ghostStroke} strokeWidth={0.08 * k} />
            {r * 0.9 >= minLabel && (
              <text
                x={p.x}
                y={-p.y + r * (p.label.length > 2 ? 0.3 : 0.34)}
                textAnchor="middle"
                fontSize={r * (p.label.length > 2 ? 0.6 : 0.9)}
                className="pf-label"
                fill={c.ghostText}
                opacity={0.8}
              >
                {p.label}
              </text>
            )}
          </g>
        ))}

      {players.map((p) => (
        <g key={`r${p.id}`} opacity={dimmed(p.id) ? 0.7 : positions ? runningRouteOpacity : 1}>
          <RouteDrawing p={p} stroke={routeColor(p)} width={routeWidth} size={k} />
        </g>
      ))}

      {positions &&
        players.map((p) =>
          p.route && p.route.points.length > 0 ? <circle key={`s${p.id}`} cx={p.x} cy={-p.y} r={0.28 * k} fill={PLAYER_FILL[p.color].fill} opacity={0.8} /> : null,
        )}

      {players.map((p) => {
        const q = at(p);
        const colors = fills[p.color];
        const isSelected = p.id === selectedId;
        const text = q.label.length > 2 ? r * (p.shape === "triangle" && !p.starred ? 0.6 : 0.72) : r * 0.95;
        const outline = ink ? (PRINT_FILL[p.color].stroke ?? c.outline) : c.outline;
        return (
          <g key={p.id} data-player-id={p.id} opacity={dimmed(p.id) ? 0.75 : 1}>
            {isSelected && <circle cx={q.x} cy={-q.y} r={r * (p.starred ? 1.8 : 1.5)} fill="none" stroke={c.line} strokeWidth={0.13 * k} />}
            {/* A soft drop shadow under the token lifts it off the turf (not on paper). */}
            {!print && <Shape p={{ ...q, y: q.y - 0.16 * k }} r={r} fill="#000" opacity={0.32} />}
            <Shape p={q} r={r} fill={colors.fill} stroke={outline} strokeWidth={(print ? 0.11 : 0.09) * k} />
            {text >= minLabel && (
              <text
                x={q.x}
                y={-q.y + text * 0.36 + (p.shape === "triangle" && !p.starred ? r * 0.25 : 0)}
                textAnchor="middle"
                fontSize={text}
                className="pf-label"
                fill={colors.text}
              >
                {q.label}
              </text>
            )}
          </g>
        );
      })}

      {showHandles &&
        selected?.route?.points.map((pt, i) => (
          <circle
            key={`h${i}`}
            data-handle
            cx={pt.x}
            cy={-pt.y}
            r={0.32 * k}
            fill={c.line}
            stroke={PLAYER_FILL[selected.color].fill}
            strokeWidth={0.1 * k}
          />
        ))}
    </svg>
  );
}

/**
 * A fixed frame for thumbnails and previews: the whole width, backfield to downfield. The frame is
 * at least as tall as `aspect` needs, with the extra depth up-field, so a sliced SVG never crops
 * the sidelines.
 */
export function staticView(
  sport: SportId,
  fieldWidth: number,
  settings: FieldSettings,
  players: PlayerSpot[],
  side: PlaySide,
  /** Special teams: the other unit, which the frame reaches up to. */
  facing?: PlayerSpot[],
  upfield = 14,
  aspect = 4 / 2.8,
  /** Token size the frame must hold whole (thumbnails draw special teams bigger). */
  tokenScale = 1,
  /** Special teams: frame the units themselves rather than the whole width (a field goal uses a third of it). */
  tight = false,
): ViewBox {
  const r = playerRadius(sport) * tokenScale;
  if (tight && facing?.length) {
    const all = [...players, ...facing];
    const pad = r * 1.6 + 1.2;
    const minX = Math.min(...all.map((p) => p.x)) - pad;
    const maxX = Math.max(...all.map((p) => p.x)) + pad;
    const top = Math.max(...all.map((p) => p.y)) + pad;
    const low = Math.min(...all.map((p) => p.y)) - pad;
    const w = Math.max(maxX - minX, (top - low) * aspect);
    const h = w / aspect;
    const cx = (minX + maxX) / 2;
    const cy = (top + low) / 2;
    return { x: cx - w / 2, y: -(cy + h / 2), w, h };
  }
  const back = backfieldDepth(players, r, settings.backfield);
  const far = facing?.length ? Math.max(...facing.map((p) => p.y)) + 2.5 : 0;
  const up = far || (settings.ballOn !== null ? Math.max(upfield, settings.ballOn + 6) : side === "defense" ? upfield - 4 : upfield);
  // Exactly the card's shape: a shallow play gets extra depth up-field, a deep one (a kickoff)
  // gets turf beside the sidelines, so the sliced SVG never crops either.
  const w = Math.max(fieldWidth + 2.4, (up + back) * aspect);
  const h = w / aspect;
  return { x: fieldWidth / 2 - w / 2, y: -(h - back), w, h };
}
