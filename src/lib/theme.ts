/**
 * Team-driven theme. Every surface, line and accent token is derived from the
 * managed team's two brand colours, so the whole app re-skins per franchise.
 */
import { useEffect } from "react";
import { THEME_CACHE_KEY, useResolvedAppearance } from "./appearance";

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

/** Relative luminance of an HSL colour, used to pick ink on a filled accent. */
function luminance({ h, s, l }: HSL): number {
  const a = s * Math.min(l, 1 - l);
  const f = (k: number) => {
    const n = (k + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(n - 3, 9 - n, 1));
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(0) + 0.7152 * f(8) + 0.0722 * f(4);
}

const isChromatic = (c: HSL) => c.s > 0.18 && c.l > 0.08 && c.l < 0.95;

/** Pick the brand colour that reads best as a single accent on a dark ground. */
function pickAccent(p: HSL, s: HSL): HSL {
  let base = p;
  // near-black / navy primaries: the secondary is usually the recognisable pop (DEN, IND, NO gold)
  if ((!isChromatic(p) || p.l < 0.26) && isChromatic(s) && s.l > 0.4) base = s;
  // purple primaries with a strong secondary read better as that secondary (LAL gold, PHX orange)
  else if (p.h > 245 && p.h < 300 && isChromatic(s) && s.l > 0.4) base = s;
  if (!isChromatic(base)) return { h: base.h, s: 0.08, l: 0.84 }; // monochrome brands (BKN, SA) get silver
  return { h: base.h, s: clamp(base.s, 0.42, 0.72), l: clamp(base.l, 0.55, 0.66) };
}

export const DEFAULT_COLORS: TeamColors = { primary: "#d6363b", secondary: "#14213d" };

/** light/dark ground, and colourful (team-tinted) vs plain (neutral greys, muted accent). */
export interface ThemeOptions {
  light?: boolean;
  plain?: boolean;
}

const SEMANTIC = {
  dark: { good: "#4cc38a", warn: "#e9b949", bad: "#f0646a", info: "#8fb0d6", gold: "#e9b949" },
  light: { good: "#1f8a5b", warn: "#a5720f", bad: "#cf3a41", info: "#3a69a1", gold: "#a5760f" },
};
// rating-tier ink (for numbers on the page) and fills (for attribute bars)
const TIERS = {
  dark: { elite: "#d6f1ff", gold: "#e9b949", green: "#4cc38a", steel: "#a9b7c9", bronze: "#c99474", eliteFill: "#c7ecff", steelFill: "#8f9db1" },
  light: { elite: "#2f78a3", gold: "#a5760f", green: "#1f8a5b", steel: "#5b6b80", bronze: "#94593a", eliteFill: "#6fb6dd", steelFill: "#8f9db1" },
};

export function teamTheme(colors: TeamColors = DEFAULT_COLORS, opts: ThemeOptions = {}) {
  const { light = false, plain = false } = opts;
  const p = hexToHsl(colors.primary);
  const s = hexToHsl(colors.secondary);
  const accent = pickAccent(p, s);
  const chroma = accent.s > 0.1;
  if (plain && chroma) accent.s = Math.min(accent.s, 0.3);
  if (light) accent.l = !chroma ? 0.28 : accent.h > 38 && accent.h < 75 ? 0.37 : 0.43; // darker so it reads on a pale ground
  // background hue follows the primary; monochrome teams (and plain style) fall back to a cool slate
  const tinted = !plain && (isChromatic(p) || isChromatic(s));
  const hue = !tinted ? 222 : isChromatic(p) ? p.h : s.h;
  const sat = tinted ? (light ? 0.22 : 0.26) : light ? 0.07 : 0.06;
  const surface = (l: number, satMul = 1) => hsl({ h: hue, s: sat * satMul, l });
  // whichever ink gives the higher WCAG contrast on the filled accent
  const L = luminance(accent);
  const accentInk = (L + 0.05) / 0.06 > 1.05 / (L + 0.05) ? "hsl(0 0% 7%)" : "hsl(0 0% 98%)";
  const sem = light ? SEMANTIC.light : SEMANTIC.dark;
  const tier = light ? TIERS.light : TIERS.dark;
  const neutralTeam = light ? "hsl(222 10% 26%)" : "hsl(222 8% 22%)";
  const ground = light
    ? {
        "--bg": surface(0.955, 0.5),
        "--panel": surface(0.99, 0.4),
        "--panel-2": surface(0.94, 0.5),
        "--line": surface(0.87, 0.45),
        "--line-2": surface(0.78, 0.4),
        "--ink": surface(0.11, 0.45),
        "--dim": surface(0.34, 0.3),
        "--mute": surface(0.48, 0.25),
        // broadcast graphics (header band, heroes) stay dark on a light page
        "--hero-base": surface(0.12, 1.1),
        "--band-end": surface(0.1, 1.1),
        "--glow": plain ? "0%" : "12%",
        "--wash": "30%",
      }
    : {
        "--bg": surface(0.055),
        "--panel": surface(0.085),
        "--panel-2": surface(0.115),
        "--line": surface(0.16, 0.8),
        "--line-2": surface(0.23, 0.7),
        "--ink": surface(0.95, 0.4),
        "--dim": surface(0.7, 0.45),
        "--mute": surface(0.52, 0.4),
        "--hero-base": surface(0.085),
        "--band-end": surface(0.055),
        "--glow": plain ? "8%" : "20%",
        "--wash": "55%",
      };
  return {
    ...ground,
    "--accent": hsl(accent),
    "--accent-ink": accentInk,
    "--team": plain ? neutralTeam : colors.primary,
    "--team-2": plain ? "hsl(222 8% 40%)" : colors.secondary,
    "--team-deep": plain ? "hsl(222 10% 12%)" : hsl({ h: p.h, s: p.s * 0.85, l: clamp(p.l * 0.55, 0.06, 0.22) }),
    "--good": sem.good,
    "--warn": sem.warn,
    "--bad": sem.bad,
    "--info": sem.info,
    "--gold": sem.gold,
    "--tier-elite": tier.elite,
    "--tier-gold": tier.gold,
    "--tier-green": tier.green,
    "--tier-steel": tier.steel,
    "--tier-bronze": tier.bronze,
    "--tier-elite-fill": tier.eliteFill,
    "--tier-steel-fill": tier.steelFill,
  } as Record<string, string>;
}

/** Concrete colours for SVG charts (recharts props can't resolve CSS variables reliably). */
export function chartColors(colors?: TeamColors, opts: ThemeOptions = {}) {
  const t = teamTheme(colors, opts);
  return {
    accent: t["--accent"],
    grid: t["--line"],
    axis: t["--mute"],
    panel: t["--panel"],
    border: t["--line-2"],
    ink: t["--ink"],
    dim: t["--dim"],
    good: t["--good"],
    warn: t["--warn"],
    bad: t["--bad"],
    series: [t["--accent"], t["--ink"], t["--good"]],
  };
}

/** Writes the team palette onto :root so body, portals and modals all pick it up. */
export function useTeamTheme(colors: TeamColors | null | undefined) {
  const { light, plain } = useResolvedAppearance();
  const key = `${colors ? colors.primary + colors.secondary : "default"}|${light}|${plain}`;
  useEffect(() => {
    const vars = teamTheme(colors ?? DEFAULT_COLORS, { light, plain });
    const root = document.documentElement;
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    root.dataset.mode = light ? "light" : "dark";
    root.dataset.style = plain ? "plain" : "colorful";
    root.style.colorScheme = light ? "light" : "dark";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", vars["--bg"]);
    // remembered so the boot script can paint the right palette before React loads
    try {
      localStorage.setItem(THEME_CACHE_KEY, JSON.stringify({ l: light, p: plain, v: vars }));
    } catch {
      /* storage unavailable: the CSS defaults still render */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
