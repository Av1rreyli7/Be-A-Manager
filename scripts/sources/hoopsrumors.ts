/**
 * Hoops Rumors two-way contract tracker (robots.txt: "*" allowed, Crawl-delay 1 - honoured by lib/http.ts).
 */
import { getText } from "../lib/http";

export const TWO_WAY_TRACKER_URL = "https://www.hoopsrumors.com/2026/07/2026-27-nba-two-way-contract-tracker.html";

export interface TwoWayEntry {
  teamFullName: string;
  name: string;
  pos: string;
  twoYear: boolean;
  official: boolean; // false = reported, shown in italics on the tracker
}

const decode = (s: string) =>
  s
    .replace(/&#8217;|&#039;|&rsquo;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

export async function fetchTwoWays(): Promise<{ entries: TwoWayEntry[]; updated: string | null } | null> {
  const html = await getText(TWO_WAY_TRACKER_URL);
  if (!html) return null;
  const updated = html.match(/Updated\s+([\d-]+)/)?.[1] ?? null;
  const entries: TwoWayEntry[] = [];
  const sections = html.split(/<h3[^>]*>/).slice(1);
  for (const sec of sections) {
    const team = decode(sec.slice(0, sec.indexOf("</h3>")).replace(/<[^>]+>/g, "").trim());
    const list = sec.match(/<ol>([\s\S]*?)<\/ol>|<ul>([\s\S]*?)<\/ul>/);
    if (!list) continue;
    for (const li of (list[1] ?? list[2]).match(/<li>[\s\S]*?<\/li>/g) ?? []) {
      const official = !/<em>/.test(li);
      const text = decode(li.replace(/<[^>]+>/g, "")).trim();
      if (!text || /^empty$/i.test(text)) continue;
      const m = text.match(/^(.+?),\s*([A-Z/]+)\s*(\*)?/);
      if (!m) continue;
      entries.push({ teamFullName: team, name: m[1].trim(), pos: m[2], twoYear: !!m[3], official });
    }
  }
  return { entries, updated };
}

export const HARD_CAP_URL = "https://www.hoopsrumors.com/2026/07/nba-teams-with-hard-caps-for-2026-27.html";

export interface HardCapEntry {
  teamFullName: string;
  level: "first" | "second";
  reasons: string[];
}

/** "NBA Teams With Hard Caps For 2026/27": which teams are hard-capped at which apron, and why. */
export async function fetchHardCaps(): Promise<HardCapEntry[] | null> {
  const html = await getText(HARD_CAP_URL);
  if (!html) return null;
  const out: HardCapEntry[] = [];
  for (const sec of html.split(/<h3[^>]*>/).slice(1)) {
    const title = sec.slice(0, sec.indexOf("</h3>"));
    const level = /first/i.test(title) ? "first" : /second/i.test(title) ? "second" : null;
    if (!level) continue;
    const body = sec.slice(sec.indexOf("</h3>"));
    const re = /<p><strong>([\s\S]*?)<\/strong><\/p>\s*<ul>([\s\S]*?)<\/ul>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body))) {
      const team = decode(m[1].replace(/<[^>]+>/g, "")).trim();
      const reasons = (m[2].match(/<li>[\s\S]*?<\/li>/g) ?? []).map((li) => decode(li.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim());
      if (team) out.push({ teamFullName: team, level, reasons });
    }
  }
  return out;
}
