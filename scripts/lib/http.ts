/**
 * Polite HTTP client for the data pipeline:
 *  - obeys robots.txt (our UA, "*", and Anthropic/Claude agent groups - the strictest applicable rule wins)
 *  - per-host minimum interval between requests
 *  - on-disk cache so re-runs don't re-hit sources (pass --refresh to bypass)
 *
 * Requests go through the system `curl` binary with its own default User-Agent: ESPN's CDN only
 * serves known HTTP clients, and we don't impersonate one from Node.
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// robots.txt groups we honour in addition to "*" (curl, plus every Anthropic/Claude agent token)
const AGENT_TOKENS = ["curl", "claude-user", "claudebot", "claude", "claude-web", "anthropic-ai"];

interface CurlResponse {
  status: number;
  body: string;
}
function curl(url: string): Promise<CurlResponse> {
  return new Promise((resolve, reject) => {
    execFile(
      "curl",
      ["-s", "-L", "--max-time", "30", "-H", "Accept: */*", "-w", "\n%{http_code}", url],
      { maxBuffer: 64 * 1024 * 1024, encoding: "utf8" },
      (err, stdout) => {
        if (err) return reject(err);
        const i = stdout.lastIndexOf("\n");
        resolve({ status: Number(stdout.slice(i + 1)) || 0, body: stdout.slice(0, i) });
      },
    );
  });
}

const CACHE_DIR = path.join(process.cwd(), ".cache", "http");
const hostInterval: Record<string, number> = {
  "site.api.espn.com": 120,
  "site.web.api.espn.com": 120,
  "sports.core.api.espn.com": 120,
  "hoopsnightly.com": 1500,
  "www.hoopsrumors.com": 1500, // robots.txt Crawl-delay: 1
};
const DEFAULT_INTERVAL = 1000;

let refresh = false;
export function setRefresh(v: boolean) {
  refresh = v;
}

export const stats = { network: 0, cached: 0, blocked: [] as string[], failed: [] as string[] };

// ---------- robots.txt ----------
interface RobotsRule {
  allow: boolean;
  pattern: RegExp;
  length: number;
}
const robotsCache = new Map<string, Promise<RobotsRule[][]>>();

function patternToRegex(p: string): RegExp {
  const anchored = p.endsWith("$");
  const body = (anchored ? p.slice(0, -1) : p)
    .split("*")
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp("^" + body + (anchored ? "$" : ""));
}

/** Returns the rule groups that apply to us (each group evaluated independently; all must allow). */
export function parseRobots(txt: string): RobotsRule[][] {
  const groups: { agents: string[]; rules: RobotsRule[] }[] = [];
  let cur: { agents: string[]; rules: RobotsRule[] } | null = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (!cur) continue;
      if ((key === "allow" || key === "disallow") && val) {
        cur.rules.push({ allow: key === "allow", pattern: patternToRegex(val), length: val.length });
      }
    }
  }
  const specific = groups.filter((g) => g.agents.some((a) => AGENT_TOKENS.includes(a)));
  const star = groups.filter((g) => g.agents.includes("*"));
  return [...specific, ...star].map((g) => g.rules);
}

export function robotsAllows(groups: RobotsRule[][], pathAndQuery: string): boolean {
  for (const rules of groups) {
    let best: RobotsRule | null = null;
    for (const r of rules) {
      if (r.pattern.test(pathAndQuery) && (!best || r.length > best.length || (r.length === best.length && r.allow))) best = r;
    }
    if (best && !best.allow) return false;
  }
  return true;
}

async function robotsFor(origin: string): Promise<RobotsRule[][]> {
  let p = robotsCache.get(origin);
  if (!p) {
    p = (async () => {
      try {
        const res = await curl(origin + "/robots.txt");
        if (res.status >= 400 && res.status < 500) return []; // no robots.txt => no restrictions (RFC 9309)
        if (res.status < 200 || res.status >= 300) return [[{ allow: false, pattern: /^\//, length: 1 }]]; // 5xx => assume full disallow
        return parseRobots(res.body);
      } catch {
        return [[{ allow: false, pattern: /^\//, length: 1 }]];
      }
    })();
    robotsCache.set(origin, p);
  }
  return p;
}

// ---------- rate limit ----------
const nextSlot = new Map<string, number>();
async function waitTurn(host: string) {
  const gap = hostInterval[host] ?? DEFAULT_INTERVAL;
  const now = Date.now();
  const at = Math.max(now, nextSlot.get(host) ?? 0);
  nextSlot.set(host, at + gap);
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}

// ---------- fetch ----------
function cacheFile(url: string) {
  return path.join(CACHE_DIR, createHash("sha1").update(url).digest("hex") + ".txt");
}

/** Fetch text. Returns null on 404 / robots-block / persistent failure (recorded in `stats`). */
export async function getText(url: string): Promise<string | null> {
  const file = cacheFile(url);
  if (!refresh) {
    try {
      const cached = await readFile(file, "utf8");
      stats.cached++;
      return cached === "\u0000404" ? null : cached;
    } catch {
      /* miss */
    }
  }
  const u = new URL(url);
  const groups = await robotsFor(u.origin);
  if (!robotsAllows(groups, u.pathname + u.search)) {
    stats.blocked.push(url);
    return null;
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    await waitTurn(u.host);
    try {
      const res = await curl(url);
      stats.network++;
      if (res.status === 404) {
        await mkdir(CACHE_DIR, { recursive: true });
        await writeFile(file, "\u0000404");
        return null;
      }
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      if (res.status < 200 || res.status >= 300) {
        stats.failed.push(`${res.status} ${url}`);
        return null;
      }
      const body = res.body;
      await mkdir(CACHE_DIR, { recursive: true });
      await writeFile(file, body);
      return body;
    } catch (e) {
      if (attempt === 3) stats.failed.push(`${(e as Error).message} ${url}`);
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return null;
}

export async function getJson<T = unknown>(url: string): Promise<T | null> {
  const t = await getText(url);
  if (t == null) return null;
  try {
    return JSON.parse(t) as T;
  } catch {
    stats.failed.push(`bad JSON ${url}`);
    return null;
  }
}

/** Run tasks with bounded concurrency. */
export async function pool<T, R>(items: T[], n: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    }),
  );
  return out;
}
