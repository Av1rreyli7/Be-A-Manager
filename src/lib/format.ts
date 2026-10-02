export const money = (v: number | null | undefined, digits = 1) => {
  if (v == null || !Number.isFinite(v)) return "-";
  const a = Math.abs(v);
  const s = a >= 1e6 ? `$${(a / 1e6).toFixed(digits)}M` : a >= 1e3 ? `$${(a / 1e3).toFixed(0)}K` : `$${a.toFixed(0)}`;
  return v < 0 ? `-${s}` : s;
};
export const moneyExact = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
export const pct = (v: number, d = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : "-");
export const f1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : "-");
export const signed = (v: number, d = 1) => `${v > 0 ? "+" : ""}${v.toFixed(d)}`;
export const height = (inches: number) => `${Math.floor(inches / 12)}'${inches % 12}"`;

/** Tier name drives the solid badge fill (see .rt-* in globals.css). */
export function ratingTier(v: number): "elite" | "gold" | "green" | "steel" | "bronze" {
  if (v >= 90) return "elite";
  if (v >= 80) return "gold";
  if (v >= 70) return "green";
  if (v >= 60) return "steel";
  return "bronze";
}

export function ratingColor(v: number): string {
  if (v >= 90) return "text-[var(--tier-elite)]";
  if (v >= 80) return "text-[var(--tier-gold)]";
  if (v >= 70) return "text-[var(--tier-green)]";
  if (v >= 60) return "text-[var(--tier-steel)]";
  return "text-[var(--tier-bronze)]";
}

export function ratingBg(v: number): string {
  return `rt rt-${ratingTier(v)}`;
}

/** Bar fill for 0-100 attribute ratings, matching the badge tiers. */
export function ratingFill(v: number): string {
  if (v >= 90) return "bg-[var(--tier-elite-fill)]";
  if (v >= 80) return "bg-gold";
  if (v >= 70) return "bg-good";
  if (v >= 60) return "bg-[var(--tier-steel-fill)]";
  return "bg-[#a8714a]";
}

export const PHASE_LABEL: Record<string, string> = {
  preseason: "Preseason",
  regular: "Regular Season",
  "play-in": "Play-In",
  playoffs: "Playoffs",
  "season-end": "Season Review",
  "draft-lottery": "Draft Lottery",
  "pre-draft": "Pre-Draft",
  draft: "NBA Draft",
  options: "Options & QOs",
  "free-agency": "Free Agency",
  "summer-league": "Summer League",
  "training-camp": "Training Camp",
};

export const STATUS_LABEL: Record<string, string> = {
  "under-cap": "Under cap",
  "over-cap": "Over cap",
  "over-tax": "Taxpayer",
  "over-first": "Above 1st apron",
  "over-second": "Above 2nd apron",
};

export const STATUS_COLOR: Record<string, string> = {
  "under-cap": "text-good",
  "over-cap": "text-info",
  "over-tax": "text-warn",
  "over-first": "text-warn",
  "over-second": "text-bad",
};
