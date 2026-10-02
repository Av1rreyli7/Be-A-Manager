/**
 * Trade validation against the CBA. Every failure names the team, the rule and the numbers so the
 * Trade Machine can show exactly why a deal is illegal.
 */
import type { League, PickAsset, Player, TeamId, TradeAssets } from "../types/game";
import { contractOf, salaryIn, standardPlayers, teamPlayers } from "../league/helpers";
import { addDays, daysBetween, seasonCalendar, seasonStartYear } from "../util/dates";
import { cbaFor, teamSalary, taxSalary } from "./payroll";

export type TradeRule =
  | "structure"
  | "ownership"
  | "window"
  | "salary-matching"
  | "first-apron"
  | "second-apron-aggregate"
  | "second-apron-cash"
  | "hard-cap"
  | "roster-max"
  | "roster-min"
  | "newly-signed"
  | "aggregation-60"
  | "no-trade-clause"
  | "stepien"
  | "pick-window"
  | "frozen-pick"
  | "cash-limit"
  | "tpe"
  | "sign-and-trade"
  | "injured";

export interface TradeIssue {
  teamId: TeamId | null;
  rule: TradeRule;
  message: string;
  severity: "error" | "warning";
}

export interface TeamTradeSummary {
  teamId: TeamId;
  outgoingSalary: number;
  incomingSalary: number;
  preSalary: number;
  postSalary: number;
  maxIncoming: number;
  outgoingPlayers: number;
  incomingPlayers: number;
  aggregated: boolean;
  usesExpandedBand: boolean;
  triggersHardCap: "first" | "second" | null;
  rosterAfter: number;
  postApron: "under-cap" | "over-cap" | "over-tax" | "over-first" | "over-second";
}

export interface TradeValidation {
  valid: boolean;
  issues: TradeIssue[];
  teams: TeamTradeSummary[];
}

export function assetKeyPlayer(id: string) {
  return `p:${id}`;
}
export function assetKeyPick(id: string) {
  return `k:${id}`;
}
export function assetKeyCash(team: string) {
  return `c:${team}`;
}

/** Where an asset goes. In two-team trades it's simply "the other team". */
export function destinationOf(a: TradeAssets, key: string, from: TeamId): TeamId {
  if (a.destinations[key]) return a.destinations[key];
  const others = a.sides.map((s) => s.teamId).filter((t) => t !== from);
  return others[0];
}

export function tradeWindowOpen(l: League): { open: boolean; reason?: string } {
  const cal = seasonCalendar(seasonStartYear(l.season));
  if (l.phase === "regular" && l.date > cal.tradeDeadline) return { open: false, reason: "The trade deadline has passed" };
  if (l.phase === "play-in" || l.phase === "playoffs") return { open: false, reason: "Trades are frozen until after the Finals" };
  return { open: true };
}

/** Draft year of the next draft (picks for this year and 6 after are tradable). */
export function nextDraftYear(l: League): number {
  // the league year rolls over at free agency, so only the post-draft "options" window looks a year ahead
  const y = seasonStartYear(l.season) + 1;
  return l.phase === "options" ? y + 1 : y;
}

function newlySignedBlock(l: League, p: Player): string | null {
  const c = contractOf(l, p);
  if (!c) return null;
  if (!c.signedWith || c.signedWith === "rookie" || c.signedWith === "second-round" || c.signedWith === "two-way" || c.signedWith === "extension") {
    if (c.signedWith === "rookie" || c.signedWith === "second-round") {
      const ok = addDays(c.signedDate, 30);
      if (l.date < ok) return `${p.name} (draft pick) can't be traded until ${ok} (30 days after signing)`;
    }
    return null;
  }
  // free agents: 3 months after signing or Dec 15, whichever is later
  const y = seasonStartYear(c.years[0].season);
  const dec15 = `${y}-12-15`;
  const threeMonths = addDays(c.signedDate, 91);
  const ok = threeMonths > dec15 ? threeMonths : dec15;
  if (c.signedDate >= `${y}-07-01` && l.date < ok) return `${p.name} was signed ${c.signedDate} and can't be traded until ${ok}`;
  return null;
}

export function noTradeConsent(l: League, p: Player, dest: TeamId): boolean {
  // players with a no-trade clause approve moves to teams they rate highly (contender / big market)
  const t = l.teams[dest];
  const rec = l.standings[dest];
  const winPct = rec && rec.w + rec.l > 0 ? rec.w / (rec.w + rec.l) : 0.5;
  return winPct >= 0.6 || t.market >= 5 || p.morale < 30;
}

export function validateTrade(l: League, a: TradeAssets): TradeValidation {
  const issues: TradeIssue[] = [];
  const err = (teamId: TeamId | null, rule: TradeRule, message: string) => issues.push({ teamId, rule, message, severity: "error" });
  const warn = (teamId: TeamId | null, rule: TradeRule, message: string) => issues.push({ teamId, rule, message, severity: "warning" });
  const season = l.season;
  const cba = cbaFor(l, season);
  const capRules = l.settings.salaryCap;
  const teamIds = a.sides.map((s) => s.teamId);

  if (teamIds.length < 2 || teamIds.length > 4) err(null, "structure", "Trades involve 2 to 4 teams");
  if (new Set(teamIds).size !== teamIds.length) err(null, "structure", "A team appears twice");
  const window = tradeWindowOpen(l);
  if (!window.open) err(null, "window", window.reason!);

  const incoming: Record<TeamId, { players: Player[]; picks: PickAsset[]; cash: number }> = {};
  for (const t of teamIds) incoming[t] = { players: [], picks: [], cash: 0 };

  for (const side of a.sides) {
    const t = side.teamId;
    if (!side.players.length && !side.picks.length && !side.cash && !(a.signAndTrade ?? []).some((s) => side.players.includes(s.playerId))) {
      // a team may only receive - fine for 3/4-team deals, but each team must be involved
    }
    for (const pid of side.players) {
      const p = l.players[pid];
      if (!p || p.teamId !== t) {
        err(t, "ownership", `${p?.name ?? pid} isn't on ${t}'s roster`);
        continue;
      }
      const dest = destinationOf(a, assetKeyPlayer(pid), t);
      incoming[dest]?.players.push(p);
      const block = newlySignedBlock(l, p);
      if (block && capRules) err(t, "newly-signed", block);
      const c = contractOf(l, p);
      if (c?.noTradeClause && !noTradeConsent(l, p, dest)) err(t, "no-trade-clause", `${p.name} has a no-trade clause and won't waive it for ${dest}`);
      if (p.injury && p.injury.daysOut > 60) warn(t, "injured", `${p.name} is out long-term (${p.injury.type})`);
    }
    for (const kid of side.picks) {
      const k = l.picks[kid];
      if (!k || k.owner !== t) {
        err(t, "ownership", `${t} doesn't own pick ${kid}`);
        continue;
      }
      if (k.frozen) err(t, "frozen-pick", `${k.year} ${k.originalTeam} 1st is frozen by the league (2nd-apron rule)`);
      if (k.forfeited) err(t, "ownership", `${k.year} ${k.originalTeam} pick was forfeited`);
      const ndy = nextDraftYear(l);
      if (k.year > ndy + cba.trade.pickTradeWindowYears - 1) err(t, "pick-window", `Picks can only be traded up to ${cba.trade.pickTradeWindowYears} drafts out (through ${ndy + cba.trade.pickTradeWindowYears - 1})`);
      const dest = destinationOf(a, assetKeyPick(kid), t);
      incoming[dest]?.picks.push(k);
    }
    if (side.cash) {
      const dest = destinationOf(a, assetKeyCash(t), t);
      incoming[dest].cash += side.cash;
      const team = l.teams[t];
      if (capRules && team.cashSent + side.cash > cba.exceptions.tradeCashLimit.value)
        err(t, "cash-limit", `Cash sent this season would exceed $${(cba.exceptions.tradeCashLimit.value / 1e6).toFixed(3)}M`);
    }
  }
  for (const t of teamIds) {
    if (capRules && incoming[t].cash && l.teams[t].cashReceived + incoming[t].cash > cba.exceptions.tradeCashLimit.value)
      err(t, "cash-limit", `Cash received this season would exceed $${(cba.exceptions.tradeCashLimit.value / 1e6).toFixed(3)}M`);
  }

  // ---- per-team salary checks ----
  const summaries: TeamTradeSummary[] = [];
  for (const side of a.sides) {
    const t = side.teamId;
    const team = l.teams[t];
    const outPlayers = side.players.map((id) => l.players[id]).filter(Boolean);
    const inPlayers = incoming[t].players;
    const outSal = outPlayers.reduce((s, p) => s + salaryIn(contractOf(l, p), season), 0);
    const inSal = inPlayers.reduce((s, p) => {
      const c = contractOf(l, p);
      const base = salaryIn(c, season);
      const kicker = c?.tradeKicker ? Math.min(c.tradeKicker.value || Math.round(base * (c.tradeKicker.pct / 100)), base * 0.15) : 0;
      return s + base + kicker;
    }, 0);
    const pre = taxSalary(l, t, season);
    const preCap = teamSalary(l, t, season);
    const post = pre - outSal + inSal;
    const postCap = preCap - outSal + inSal;
    const aggregated = outPlayers.filter((p) => salaryIn(contractOf(l, p), season) > 0).length >= 2 && inSal > 0;
    const postApron = post > cba.secondApron.value ? "over-second" : post > cba.firstApron.value ? "over-first" : post > cba.luxuryTax.value ? "over-tax" : postCap > cba.salaryCap.value ? "over-cap" : "under-cap";
    const tr = cba.trade;
    // allowed incoming salary
    let maxIncoming: number;
    let usesExpanded = false;
    const matchNonApron = (out: number) => {
      const a1 = Math.min(out * tr.nonApron.lowPct + tr.nonApron.cushion, out + tr.nonApron.allowance);
      const a2 = out * tr.nonApron.highPct + tr.nonApron.cushion;
      return Math.max(a1, a2);
    };
    if (postCap <= cba.salaryCap.value) maxIncoming = Infinity; // stays under the cap: absorb freely
    else if (l.settings.strictAprons && post > cba.firstApron.value) maxIncoming = outSal * tr.firstApronPct;
    else {
      const roomAbsorb = Math.max(0, cba.salaryCap.value - preCap) + tr.underCapCushion;
      const m = matchNonApron(outSal);
      usesExpanded = outSal > 0 && inSal > outSal * tr.nonApron.highPct + tr.nonApron.cushion && inSal > roomAbsorb;
      maxIncoming = Math.max(m, preCap < cba.salaryCap.value ? roomAbsorb + outSal : 0);
    }
    // TPE absorption
    let tpeCovers = 0;
    if (side.tpe) {
      const tpe = team.exceptions.tpes.find((x) => x.id === side.tpe);
      if (!tpe) err(t, "tpe", "Trade exception not found");
      else {
        if (l.date > tpe.expires) err(t, "tpe", `Trade exception expired ${tpe.expires}`);
        if (post > cba.secondApron.value && tpe.fromSignAndTrade) err(t, "tpe", "Teams over the 2nd apron can't use a TPE created by sign-and-trade");
        const biggest = Math.max(0, ...inPlayers.map((p) => salaryIn(contractOf(l, p), season)));
        if (biggest > tpe.amount) err(t, "tpe", `TPE of $${(tpe.amount / 1e6).toFixed(2)}M can't absorb a $${(biggest / 1e6).toFixed(2)}M salary`);
        tpeCovers = tpe.amount;
      }
    }
    // Hard caps and the 60-day re-aggregation ban are intentionally not enforced in trades:
    // any salary-matched deal is allowed, and players can be re-traded immediately.
    const triggersHardCap: "first" | "second" | null = null;
    if (capRules && l.settings.strictAprons && post > cba.secondApron.value && side.cash > 0) err(t, "second-apron-cash", "Teams over the 2nd apron can't send cash in trades");
    if (capRules && inSal > 0) {
      if (inSal > maxIncoming + tpeCovers && inSal > 0) {
        const rule = l.settings.strictAprons && post > cba.firstApron.value ? "first-apron" : "salary-matching";
        const why =
          rule === "first-apron"
            ? `Over the 1st apron after the trade ($${(post / 1e6).toFixed(1)}M) - can only take back 100% of outgoing salary ($${(outSal / 1e6).toFixed(2)}M) but receives $${(inSal / 1e6).toFixed(2)}M`
            : `Salary matching: sends $${(outSal / 1e6).toFixed(2)}M, may take back up to $${(maxIncoming / 1e6).toFixed(2)}M, receives $${(inSal / 1e6).toFixed(2)}M`;
        err(t, rule, why);
      }
      if (l.settings.strictAprons && post > cba.secondApron.value && aggregated) err(t, "second-apron-aggregate", `Over the 2nd apron after the trade - can't aggregate ${outPlayers.length} salaries to match`);
    }
    // roster
    const inRoster = inPlayers.filter((p) => contractOf(l, p)?.type !== "two-way").length;
    const outRoster = outPlayers.filter((p) => contractOf(l, p)?.type !== "two-way").length;
    const rosterAfter = standardPlayers(l, t).length - outRoster + inRoster;
    const inSeason = l.phase === "regular" || l.phase === "play-in" || l.phase === "playoffs";
    const maxRoster = inSeason ? cba.roster.maxStandard : cba.roster.offseasonMax;
    const totalAfter = teamPlayers(l, t).length - outPlayers.length + inPlayers.length;
    if ((inSeason ? rosterAfter : totalAfter) > maxRoster) err(t, "roster-max", `Roster would have ${inSeason ? rosterAfter : totalAfter} players (max ${maxRoster}) - waive someone first or include more players`);
    if (inSeason && rosterAfter < cba.roster.minStandard) warn(t, "roster-min", `Roster drops to ${rosterAfter}; must get back to ${cba.roster.minStandard} within ${cba.roster.minStandardGraceDays} days`);
    // Stepien
    const firsts = (tid: TeamId) => {
      const held = new Set<number>();
      for (const k of Object.values(l.picks)) {
        if (k.round !== 1 || k.forfeited || k.id.startsWith("swap-")) continue;
        let owner = k.owner;
        for (const s2 of a.sides) if (s2.picks.includes(k.id)) owner = destinationOf(a, assetKeyPick(k.id), s2.teamId);
        if (owner === tid) held.add(k.year);
      }
      return held;
    };
    if (side.picks.some((id) => l.picks[id]?.round === 1)) {
      const held = firsts(t);
      const ndy = nextDraftYear(l);
      for (let y = ndy; y < ndy + cba.trade.pickTradeWindowYears - 1; y++) {
        if (!held.has(y) && !held.has(y + 1)) {
          err(t, "stepien", `Stepien rule: ${t} would have no 1st-round pick in both ${y} and ${y + 1}`);
          break;
        }
      }
    }
    summaries.push({
      teamId: t,
      outgoingSalary: outSal,
      incomingSalary: inSal,
      preSalary: pre,
      postSalary: post,
      maxIncoming: maxIncoming === Infinity ? Number.MAX_SAFE_INTEGER : maxIncoming + tpeCovers,
      outgoingPlayers: outPlayers.length,
      incomingPlayers: inPlayers.length,
      aggregated,
      usesExpandedBand: usesExpanded,
      triggersHardCap: team.hardCap ? null : triggersHardCap,
      rosterAfter,
      postApron,
    });
  }
  // sign-and-trade constraints
  for (const st of a.signAndTrade ?? []) {
    const p = l.players[st.playerId];
    const from = a.sides.find((s) => s.players.includes(st.playerId))?.teamId;
    if (!p || !from) continue;
    const dest = destinationOf(a, assetKeyPlayer(p.id), from);
    if (st.years < 3) err(from, "sign-and-trade", "Sign-and-trade contracts must be at least 3 years");
    const sum = summaries.find((s) => s.teamId === dest);
    if (sum && sum.postSalary > cba.firstApron.value) err(dest, "sign-and-trade", "A team receiving a sign-and-trade player is hard-capped at the 1st apron");
  }
  for (const sw of a.swaps ?? []) {
    const own = l.picks[`${sw.year}-${sw.round}-${sw.from}`];
    const theirs = l.picks[`${sw.year}-${sw.round}-${sw.to}`];
    if (!own || own.owner !== sw.from) err(sw.from, "ownership", `${sw.from} must own its ${sw.year} ${sw.round === 1 ? "1st" : "2nd"} to grant a swap`);
    if (!theirs || theirs.owner !== sw.to) err(sw.to, "ownership", `${sw.to} must own its ${sw.year} pick to hold a swap right`);
    const ndy = nextDraftYear(l);
    if (sw.year > ndy + cba.trade.pickTradeWindowYears - 1) err(sw.from, "pick-window", "Swap is outside the 7-year window");
  }
  for (const [pid, top] of Object.entries(a.protections ?? {})) {
    const k = l.picks[pid];
    if (!k) continue;
    if (k.protection.kind !== "none") err(k.owner, "structure", `${k.year} ${k.originalTeam} pick already carries protections`);
    if (top < 1 || top > 29) err(k.owner, "structure", "Protections must be between top-1 and top-29");
  }
  if (a.sides.every((s) => !s.players.length && !s.picks.length && !s.cash) && !(a.swaps?.length)) err(null, "structure", "Add assets to the trade");
  return { valid: !issues.some((i) => i.severity === "error"), issues, teams: summaries };
}
