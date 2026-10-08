/**
 * Game Night theme. The ground, lines, accent and state colours come from the shared site kit
 * (public/kit.css) in court mode: night ground, warm orange accent, aurora washes. The site is dark only,
 * there is no stored choice. The managed team's colours are written here for the things that name a team:
 * the header band, the washes on heroes and cards, the corner glow.
 */
import { useEffect } from "react";

export interface TeamColors {
  primary: string;
  secondary: string;
}

type HSL = { h: number; s: number; l: number };

function hexToHsl(hex: string): HSL {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

const hsl = ({ h, s, l }: HSL) => `hsl(${h.toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%)`;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const DEFAULT_COLORS: TeamColors = { primary: "#d6363b", secondary: "#14213d" };

/** The kit palette in court mode as plain hex, for SVG charts (recharts props cannot read CSS variables). */
export const KIT = {
  bg: "#04060a",
  panel: "#0a0e14",
  line: "rgba(255,255,255,0.12)",
  line2: "rgba(255,255,255,0.22)",
  ink: "#ffffff",
  dim: "#9aa3b2",
  mute: "#8a93a3",
  accent: "#ff8a3d",
  amber: "#ffbe4a",
  teal: "#3ee6c4",
  sky: "#4fb3ff",
  violet: "#8b6cff",
  good: "#4ee08f",
  warn: "#ffb547",
  bad: "#ff5d5d",
};

/** Only the team colour tokens. Everything else is the kit's. */
export function teamTheme(colors: TeamColors = DEFAULT_COLORS) {
  const p = hexToHsl(colors.primary);
  return {
    "--team": colors.primary,
    "--team-2": colors.secondary,
    "--team-deep": hsl({ h: p.h, s: p.s * 0.85, l: clamp(p.l * 0.55, 0.06, 0.22) }),
  } as Record<string, string>;
}

/** Concrete colours for SVG charts. The team colour joins the series so each chart names the team. */
export function chartColors(colors?: TeamColors) {
  return {
    accent: KIT.accent,
    grid: KIT.line,
    axis: KIT.mute,
    panel: KIT.panel,
    border: KIT.line2,
    ink: KIT.ink,
    dim: KIT.dim,
    good: KIT.good,
    warn: KIT.warn,
    bad: KIT.bad,
    team: colors?.primary ?? KIT.sky,
    series: [KIT.accent, KIT.teal, KIT.violet],
  };
}

const rgbOf = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lumOf = (c: number[]) => (c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114) / 255;
function liftRgb(c: number[], minLum: number) {
  let out = c.slice();
  for (let i = 0; i < 12 && lumOf(out) < minLum; i++) out = out.map((v) => Math.round(v + (255 - v) * 0.18));
  return out;
}

/**
 * The kit buttons take the franchise's colours inside a save, the same way Floodlights tints with a club's
 * (kit.css reads --k-tint, --k-tint-2 and --k-tint-edge as "r, g, b"). A very dark first colour swaps with the
 * second, a colour that is still too dark is lifted toward white, and the edge is kept bright.
 */
export function kitTint(colors: TeamColors | null | undefined) {
  if (!colors) return null;
  let a = rgbOf(colors.primary);
  let b = rgbOf(colors.secondary);
  if (lumOf(a) < 0.14 && lumOf(b) > lumOf(a)) [a, b] = [b, a];
  a = liftRgb(a, 0.28);
  const edge = liftRgb(a, 0.5);
  return { "--k-tint": a.join(", "), "--k-tint-2": b.join(", "), "--k-tint-edge": edge.join(", ") } as Record<string, string>;
}

/** Writes the team palette onto :root so body, portals and modals all pick it up. No team: the plain accent. */
export function useTeamTheme(colors: TeamColors | null | undefined) {
  const key = colors ? colors.primary + colors.secondary : "default";
  useEffect(() => {
    const vars = teamTheme(colors ?? DEFAULT_COLORS);
    const root = document.documentElement;
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    const tint = kitTint(colors);
    if (tint) for (const [k, v] of Object.entries(tint)) root.style.setProperty(k, v);
    else for (const k of ["--k-tint", "--k-tint-2", "--k-tint-edge"]) root.style.removeProperty(k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/**
 * Puts the page in court mode (warm orange) while a Game Night screen is mounted. The screen root also
 * carries data-kmode="court" from the server, so the first paint is already right; this covers what lives
 * outside the root: modals and toasts portalled to <body>.
 */
export function useCourtMode() {
  useEffect(() => {
    const b = document.body;
    const prev = b.dataset.kmode;
    b.dataset.kmode = "court";
    return () => {
      if (prev) b.dataset.kmode = prev;
      else delete b.dataset.kmode;
    };
  }, []);
}
