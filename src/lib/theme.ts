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

/** Writes the team palette onto :root so body, portals and modals all pick it up. */
export function useTeamTheme(colors: TeamColors | null | undefined) {
  const key = colors ? colors.primary + colors.secondary : "default";
  useEffect(() => {
    const vars = teamTheme(colors ?? DEFAULT_COLORS);
    const root = document.documentElement;
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
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
