/**
 * Game Night theme. The ground, lines and accent are the Be-A-Manager site look
 * (black, hairlines, volt). The managed team's colours are kept for the things
 * that name a team: the header band, the washes on heroes and cards, the corner glow.
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

/** The one accent on the whole site: floodlight volt. On a light page it darkens so it still reads. */
const VOLT = "#d0e85c";
const VOLT_INK = "#12160a";
const VOLT_ON_LIGHT = "#55650f";

export const DEFAULT_COLORS: TeamColors = { primary: "#d6363b", secondary: "#14213d" };

/** light or dark ground, and colourful (team colours on bands and washes) or plain (none). */
export interface ThemeOptions {
  light?: boolean;
  plain?: boolean;
}

const SEMANTIC = {
  dark: { good: "#5fd38d", warn: "#f2a94a", bad: "#f25c5c", info: "#8fbcf2", gold: "#e9b949" },
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
  const sem = light ? SEMANTIC.light : SEMANTIC.dark;
  const tier = light ? TIERS.light : TIERS.dark;
  const neutralTeam = light ? "#3d4039" : "#30332f";
  // The ground and the accent are the site's own, the same for every team.
  // Team colours only reach the header band, the washes and the corner glow.
  const ground = light
    ? {
        "--bg": "#f3f4f0",
        "--panel": "#ffffff",
        "--panel-2": "#eceee8",
        "--line": "#d9dcd4",
        "--line-2": "#b9bdb3",
        "--ink": "#0e120b",
        "--dim": "#454940",
        "--mute": "#6c7167",
        // header band and heroes stay dark on a light page
        "--hero-base": "#10130f",
        "--band-end": "#000000",
        "--glow": plain ? "0%" : "9%",
        "--wash": "30%",
      }
    : {
        "--bg": "#000000",
        "--panel": "#070807",
        "--panel-2": "#101210",
        "--line": "#222422",
        "--line-2": "#3b3e3a",
        "--ink": "#ffffff",
        "--dim": "#b9bdb6",
        "--mute": "#8a8d88",
        "--hero-base": "#070807",
        "--band-end": "#000000",
        "--glow": plain ? "0%" : "13%",
        "--wash": "46%",
      };
  return {
    ...ground,
    "--accent": light ? VOLT_ON_LIGHT : VOLT,
    "--accent-ink": light ? "#ffffff" : VOLT_INK,
    "--team": plain ? neutralTeam : colors.primary,
    "--team-2": plain ? "#6a6e66" : colors.secondary,
    "--team-deep": plain ? "#1b1d1a" : hsl({ h: p.h, s: p.s * 0.85, l: clamp(p.l * 0.55, 0.06, 0.22) }),
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
