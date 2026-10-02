/**
 * hoopsnightly.com team cap sheets and draft-pick ledgers.
 * robots.txt explicitly allows ClaudeBot / Claude-User / "*" on these paths (only /api/, /newsletter/
 * and query-string URLs are disallowed). Requests are spaced 1.5s apart (lib/http.ts).
 */
import { getText } from "../lib/http";
import { extractRscStream, findAll, hasClass, parseRscRows, textOf, type RscElement } from "../lib/rsc";

const BASE = "https://hoopsnightly.com";

export const HN_SLUGS: Record<string, string> = {
  ATL: "hawks", BOS: "celtics", BKN: "nets", CHA: "hornets", CHI: "bulls", CLE: "cavaliers",
  DAL: "mavericks", DEN: "nuggets", DET: "pistons", GS: "warriors", HOU: "rockets", IND: "pacers",
  LAC: "clippers", LAL: "lakers", MEM: "grizzlies", MIA: "heat", MIL: "bucks", MIN: "timberwolves",
  NO: "pelicans", NY: "knicks", OKC: "thunder", ORL: "magic", PHI: "76ers", PHX: "suns",
  POR: "trail-blazers", SAC: "kings", SA: "spurs", TOR: "raptors", UTAH: "jazz", WSH: "wizards",
};

/** "$49.8M" -> 49_800_000, "$678K" -> 678_000, "" / "-" -> null */
export function parseMoney(s: string): number | null {
  const m = s.replace(/,/g, "").match(/\$?\s*(-?[\d.]+)\s*([MK])?/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const mult = m[2]?.toUpperCase() === "M" ? 1e6 : m[2]?.toUpperCase() === "K" ? 1e3 : 1;
  return Math.round(n * mult);
}

export interface HnCapCell {
  amount: number; // rounded to $0.1M on the source
  option: "P" | "T" | "ETO" | null;
}
export interface HnCapRow {
  name: string;
  playerSlug: string | null;
  age: number | null;
  cells: Record<string, HnCapCell>;
  guaranteed: number | null;
}
export interface HnCapSheet {
  seasons: string[];
  rows: HnCapRow[];
  /** exact current-season salary by player name (from the payroll "wall") */
  exact: Record<string, number>;
  committedText: string | null;
}

async function rows(url: string): Promise<unknown[] | null> {
  const html = await getText(url);
  if (!html) return null;
  return parseRscRows(extractRscStream(html));
}

export async function fetchCapSheet(slug: string): Promise<HnCapSheet | null> {
  const tree = await rows(`${BASE}/teams/${slug}/salary-cap`);
  if (!tree) return null;
  const seasons = findAll(tree, (e) => e.type === "th" && !!e.key && /^\d{4}-\d{2}$/.test(e.key)).map((e) => e.key!);
  const uniqSeasons = [...new Set(seasons)];
  const out: HnCapRow[] = [];
  for (const tr of findAll(tree, (e) => e.type === "tr" && !!e.key)) {
    const tds = findAll(tr.props.children, (e) => e.type === "td");
    if (tds.length < 3) continue;
    const link = findAll(tds[0].props.children, (e) => typeof e.props.href === "string")[0];
    const href = (link?.props.href as string | undefined) ?? "";
    const cells: Record<string, HnCapCell> = {};
    for (const td of tds) {
      if (!td.key || !/^\d{4}-\d{2}$/.test(td.key)) continue;
      const children = td.props.children;
      const badge = findAll(children, (e) => hasClass(e, "badge")).map((b) => textOf(b.props.children).trim())[0];
      const moneyText = Array.isArray(children) ? textOf(children[0]) : textOf(children);
      const amount = parseMoney(moneyText);
      if (amount == null) continue;
      const opt = badge === "P" || badge === "T" || badge === "ETO" ? badge : null;
      cells[td.key] = { amount, option: opt };
    }
    const last = tds[tds.length - 1];
    const ageTd = tds[1];
    out.push({
      name: tr.key!,
      playerSlug: href.startsWith("/players/") ? href.slice("/players/".length) : null,
      age: Number(textOf(ageTd.props.children)) || null,
      cells,
      guaranteed: last.key ? null : parseMoney(textOf(last.props.children)),
    });
  }
  const exact: Record<string, number> = {};
  for (const w of findAll(tree, (e) => hasClass(e, "cb") && !!e.key)) {
    const flex = (w.props.style as { flex?: number } | undefined)?.flex;
    if (typeof flex === "number") exact[w.key!] = flex;
  }
  const committed = findAll(tree, (e) => e.type === "h1" || e.type === "p").map((e) => textOf(e.props.children)).find((t) => /committed/.test(t)) ?? null;
  return { seasons: uniqSeasons, rows: out, exact, committedText: committed };
}

export interface HnPickSlot {
  round: 1 | 2;
  pill: string; // Own | Protected | Swap | Owed | Conditional ...
  held: number;
  headline: string;
  keepPct: number | null;
  projectedPick: number | null;
  terms: string[];
}
export interface HnPickYear {
  year: number;
  slots: HnPickSlot[];
}
export interface HnLedgerRow {
  year: number;
  round: 1 | 2;
  team: string; // counterpart team nickname
  summary: string;
  originalNbaId: string | null; // only for "owed to" rows
}
export interface HnPickLedger {
  years: HnPickYear[];
  owedTo: HnLedgerRow[]; // picks other teams owe this team
  owedBy: HnLedgerRow[]; // this team's picks held elsewhere
}

function parseSlot(el: RscElement): HnPickSlot | null {
  const eyebrow = findAll(el.props.children, (e) => hasClass(e, "eyebrow")).map((e) => textOf(e.props.children))[0] ?? "";
  const round = /first/i.test(eyebrow) ? 1 : /second/i.test(eyebrow) ? 2 : null;
  if (!round) return null;
  const pill = findAll(el.props.children, (e) => hasClass(e, "dp-pill")).map((e) => textOf(e.props.children))[0] ?? "";
  const count = findAll(el.props.children, (e) => hasClass(e, "mono") && hasClass(e, "stale")).map((e) => textOf(e.props.children))[0] ?? "0";
  const headlineEl = findAll(el.props.children, (e) => (e.props.style as { fontWeight?: number } | undefined)?.fontWeight === 600)[0];
  let headline = "";
  if (headlineEl) {
    const ch = headlineEl.props.children;
    headline = (Array.isArray(ch) ? textOf(ch[0]) : textOf(ch)).trim();
  }
  const oddsText = findAll(el.props.children, (e) => hasClass(e, "dp-odds")).map((e) => textOf(e.props.children))[0] ?? "";
  const keep = oddsText.match(/(\d+(?:\.\d+)?)%\s*chance/);
  const proj = oddsText.match(/projected pick\s*(\d+)/);
  const terms = findAll(el.props.children, (e) => e.type === "li").map((e) => textOf(e.props.children).replace(/\s+/g, " ").trim());
  return {
    round,
    pill: pill.trim(),
    held: parseInt(count, 10) || 0,
    headline,
    keepPct: keep ? parseFloat(keep[1]) : null,
    projectedPick: proj ? parseInt(proj[1], 10) : null,
    terms,
  };
}

export async function fetchPickLedger(slug: string): Promise<HnPickLedger | null> {
  const tree = await rows(`${BASE}/teams/${slug}/draft-picks`);
  if (!tree) return null;
  const years: HnPickYear[] = findAll(tree, (e) => hasClass(e, "dp-year") && !!e.key).map((y) => ({
    year: Number(y.key),
    slots: findAll(y.props.children, (e) => hasClass(e, "dp-year-r")).map(parseSlot).filter((s): s is HnPickSlot => !!s),
  }));
  const owedTo: HnLedgerRow[] = [];
  const owedBy: HnLedgerRow[] = [];
  for (const r of findAll(tree, (e) => hasClass(e, "tl-row") && !!e.key)) {
    const spans = findAll(r.props.children, (e) => e.type === "span").map((s) => textOf(s.props.children).trim());
    // spans: [year, team, "2nd · unprotected"]
    const [yearStr, team = "", desc = ""] = spans;
    const [roundStr, ...rest] = desc.split("·").map((s) => s.trim());
    const row: HnLedgerRow = {
      year: Number(yearStr),
      round: roundStr?.startsWith("1") ? 1 : 2,
      team,
      summary: rest.join(" · "),
      originalNbaId: null,
    };
    const k = r.key!.split("-");
    if (k.length === 3) {
      row.originalNbaId = k[0];
      owedTo.push(row);
    } else owedBy.push(row);
  }
  return { years, owedTo, owedBy };
}
