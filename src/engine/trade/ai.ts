/**
 * Trade AI: acceptance, counter-offers, the Trade Finder, AI-to-AI trades and AI offers to the user.
 * Every package the AI proposes is run through validateTrade(), so suggestions are CBA-legal.
 */
import type { League, PickAsset, Player, TeamId, TradeAssets, TradeOffer } from "../types/game";
import { contractOf, newId, salaryIn, seasonAge, teamPlayers } from "../league/helpers";
import { validateTrade, tradeWindowOpen, nextDraftYear } from "../cap/trade";
import { capStatus, cbaFor } from "../cap/payroll";
import { executeTrade } from "./execute";
import { pickValue, playerValue, positionalNeed, strategyOf } from "./value";
import { addDays, seasonStartYear } from "../util/dates";
import { Rng } from "../util/rng";

export interface TradeEvaluation {
  teamId: TeamId;
  valueIn: number;
  valueOut: number;
  net: number;
  required: number;
  meter: number; // 0..100, ≥100 = accept
  accept: boolean;
  reasons: string[];
}

function sideOf(a: TradeAssets, t: TeamId) {
  return a.sides.find((s) => s.teamId === t)!;
}

function receivedBy(l: League, a: TradeAssets, t: TeamId): { players: Player[]; picks: PickAsset[]; cash: number } {
  const out = { players: [] as Player[], picks: [] as PickAsset[], cash: 0 };
  for (const s of a.sides) {
    if (s.teamId === t) continue;
    const others = a.sides.map((x) => x.teamId).filter((x) => x !== s.teamId);
    const dest = (key: string) => a.destinations[key] ?? others[0];
    for (const pid of s.players) if (dest(`p:${pid}`) === t) out.players.push(l.players[pid]);
    for (const kid of s.picks) if (dest(`k:${kid}`) === t) out.picks.push(l.picks[kid]);
    if (s.cash && dest(`c:${s.teamId}`) === t) out.cash += s.cash;
  }
  return out;
}

export function evaluateFor(l: League, a: TradeAssets, t: TeamId): TradeEvaluation {
  const mine = sideOf(a, t);
  const got = receivedBy(l, a, t);
  const strat = strategyOf(l, t);
  const reasons: string[] = [];
  let valueIn = 0;
  for (const p of got.players) valueIn += playerValue(l, p, t, { incoming: true }) * positionalNeed(l, t, p);
  for (const k of got.picks) valueIn += pickValue(l, k, t);
  valueIn += got.cash / 1_500_000;
  let valueOut = 0;
  for (const pid of mine.players) valueOut += playerValue(l, l.players[pid], t);
  for (const kid of mine.picks) valueOut += pickValue(l, l.picks[kid], t);
  valueOut += mine.cash / 1_500_000;

  // salary relief matters to taxpayers & rebuilders
  const season = l.season;
  const outSal = mine.players.reduce((s, pid) => s + salaryIn(contractOf(l, l.players[pid]), season), 0);
  const inSal = got.players.reduce((s, p) => s + salaryIn(contractOf(l, p), season), 0);
  const st = capStatus(l, t);
  const taxpayer = st.status === "over-tax" || st.status === "over-first" || st.status === "over-second";
  if (outSal > inSal && taxpayer) {
    const relief = (outSal - inSal) / 1_000_000;
    valueIn += relief * (st.repeater ? 1.2 : 0.7);
    reasons.push(`Saves $${relief.toFixed(1)}M against a ${st.repeater ? "repeater " : ""}tax bill`);
  } else if (inSal > outSal && taxpayer) {
    // only the net salary added costs tax
    valueIn -= ((inSal - outSal) / 1_000_000) * (st.repeater ? 1.0 : 0.6);
  }
  if (strat === "rebuilding" && got.picks.some((k) => k.round === 1)) reasons.push("Rebuilding - values first-round picks");
  if (strat === "rebuilding" && got.players.some((p) => p.ovr >= 78 && seasonStartYear(l.season) - Number(p.dob.slice(0, 4)) >= 30)) reasons.push("Rebuilding - not interested in older veterans");
  if (strat === "contending" && got.players.some((p) => p.ovr >= 78)) reasons.push("Contending - wants win-now help");
  for (const p of got.players) if (positionalNeed(l, t, p) > 1.05) reasons.push(`Needs depth at ${p.pos}`);

  const difficulty = l.settings.tradeDifficulty * (l.settings.difficulty === "easy" ? 0.85 : l.settings.difficulty === "hard" ? 1.1 : l.settings.difficulty === "insane" ? 1.25 : 1);
  const required = valueOut * (0.02 + 0.06 * (difficulty - 0.8)) + 0.8 * difficulty;
  const net = valueIn - valueOut;
  const meter = Math.max(0, Math.min(130, valueOut + required > 0 ? (valueIn / (valueOut + required)) * 100 : 100));
  const accept = meter >= 100;
  if (!accept) reasons.push(net < 0 ? "Gives up more value than it gets back" : "Close, but not enough of a win for them");
  return { teamId: t, valueIn: round(valueIn), valueOut: round(valueOut), net: round(net), required: round(required), meter: Math.round(meter), accept, reasons: [...new Set(reasons)] };
}

const round = (v: number) => Math.round(v * 10) / 10;

/** AI decision for every AI team in the deal. */
export function aiDecision(l: League, a: TradeAssets): { accept: boolean; evaluations: TradeEvaluation[] } {
  const evaluations = a.sides.filter((s) => !l.userTeams.includes(s.teamId)).map((s) => evaluateFor(l, a, s.teamId));
  return { accept: evaluations.every((e) => e.accept), evaluations };
}

// ---------- asset pools ----------
function tradablePicks(l: League, t: TeamId): PickAsset[] {
  const ndy = nextDraftYear(l);
  const maxY = ndy + l.cba.trade.pickTradeWindowYears - 1;
  return Object.values(l.picks).filter((k) => k.owner === t && !k.frozen && !k.forfeited && k.year >= ndy && k.year <= maxY);
}

function tradablePlayers(l: League, t: TeamId, exclude: Set<string>): Player[] {
  return teamPlayers(l, t).filter((p) => !exclude.has(p.id) && contractOf(l, p) && contractOf(l, p)!.type !== "exhibit-10");
}

function twoTeam(a: TeamId, b: TeamId): TradeAssets {
  return { sides: [{ teamId: a, players: [], picks: [], cash: 0 }, { teamId: b, players: [], picks: [], cash: 0 }], destinations: {} };
}

function clone(a: TradeAssets): TradeAssets {
  return JSON.parse(JSON.stringify(a));
}

/**
 * Add `giver` assets until `receiver` values the incoming package at ≥ need, preferring assets the giver
 * values least relative to the receiver. Then fix salary matching by adding fillers.
 */
function fillPackage(l: League, base: TradeAssets, giver: TeamId, receiver: TeamId, exclude: Set<string>, need: (a: TradeAssets) => boolean, opts: { maxPieces?: number; preferPicks?: boolean; fairTarget?: number; maxOvr?: number; picksFirst?: boolean } = {}): TradeAssets | null {
  let a = clone(base);
  const side = () => a.sides.find((s) => s.teamId === giver)!;
  const pool: { kind: "p" | "k"; id: string; ratio: number; recv: number; sal: number }[] = [];
  for (const p of tradablePlayers(l, giver, exclude)) {
    const recv = playerValue(l, p, receiver, { incoming: true }) * positionalNeed(l, receiver, p);
    const cost = Math.max(0.5, playerValue(l, p, giver));
    pool.push({ kind: "p", id: p.id, ratio: recv / cost, recv, sal: salaryIn(contractOf(l, p), l.season) });
  }
  for (const k of tradablePicks(l, giver)) {
    const recv = pickValue(l, k, receiver);
    const cost = Math.max(0.3, pickValue(l, k, giver));
    pool.push({ kind: "k", id: k.id, ratio: (recv / cost) * (opts.preferPicks ? 1.3 : 1), recv, sal: 0 });
  }
  if (opts.fairTarget != null) {
    // fair-value mode: real players first (neutral value), biggest pieces that don't overshoot the target
    for (const it of pool) it.recv = it.kind === "p" ? Math.max(0, playerValue(l, l.players[it.id], null)) : pickValue(l, l.picks[it.id], null);
    const first = opts.picksFirst ? "k" : "p";
    pool.sort((x, y) => (y.kind === first ? 1 : 0) - (x.kind === first ? 1 : 0) || y.recv - x.recv);
  } else pool.sort((x, y) => y.ratio - x.ratio || y.recv - x.recv);
  let gathered = 0;
  const maxPieces = opts.maxPieces ?? 5;
  let pieces = side().players.length + side().picks.length;
  // receivers above the 1st apron can only take back what they send out (100% matching)
  const recvSide = a.sides.find((s) => s.teamId === receiver)!;
  const st = capStatus(l, receiver);
  const tight = l.settings.salaryCap && !!l.settings.strictAprons && (st.status === "over-first" || st.status === "over-second");
  const recvOut = recvSide.players.reduce((sum, id) => sum + salaryIn(contractOf(l, l.players[id]), l.season), 0);
  let budget = tight ? recvOut : Infinity;
  for (const item of pool) {
    if (need(a)) break;
    if (pieces >= maxPieces) break;
    if (item.recv < 0.4) continue;
    if (item.kind === "p" && item.sal > budget) continue;
    if (opts.fairTarget != null && gathered + item.recv > opts.fairTarget * 1.2) continue;
    // realism: no incoming player far better than the best player being sent
    if (opts.maxOvr != null && item.kind === "p" && l.players[item.id].ovr > opts.maxOvr) continue;
    gathered += item.recv;
    if (item.kind === "p") budget -= item.sal;
    if (item.kind === "p") side().players.push(item.id);
    else side().picks.push(item.id);
    pieces++;
  }
  if (!need(a)) return null;
  // trim: remove pieces that aren't needed (largest-cost-first)
  for (const pid of [...side().players]) {
    const b = clone(a);
    const s = b.sides.find((x) => x.teamId === giver)!;
    s.players = s.players.filter((x) => x !== pid);
    if (need(b) && validateTrade(l, b).valid) a = b;
  }
  for (const kid of [...side().picks].reverse()) {
    const b = clone(a);
    const s = b.sides.find((x) => x.teamId === giver)!;
    s.picks = s.picks.filter((x) => x !== kid);
    if (need(b)) a = b;
  }
  return fixSalaries(l, a, exclude);
}

/** Resolve salary-matching errors by adding low-value salary from the team that needs to send more. */
export function fixSalaries(l: League, a: TradeAssets, exclude: Set<string>): TradeAssets | null {
  const cur = clone(a);
  for (let iter = 0; iter < 10; iter++) {
    const v = validateTrade(l, cur);
    if (v.valid) return cur;
    // roster over the limit: that team adds its least valuable player as a throw-in
    const rosterIssue = v.issues.find((i) => i.severity === "error" && i.rule === "roster-max" && i.teamId);
    if (rosterIssue?.teamId) {
      const t = rosterIssue.teamId;
      const side = cur.sides.find((x) => x.teamId === t)!;
      const throwIn = teamPlayers(l, t)
        .filter((p) => !exclude.has(p.id) && !side.players.includes(p.id) && !cur.sides.some((x) => x.teamId !== t && x.players.includes(p.id)))
        .sort((x, y) => playerValue(l, x, t) - playerValue(l, y, t) || salaryIn(contractOf(l, x), l.season) - salaryIn(contractOf(l, y), l.season))[0];
      if (!throwIn) return null;
      side.players.push(throwIn.id);
      continue;
    }
    const salaryIssue = v.issues.find((i) => i.severity === "error" && (i.rule === "salary-matching" || i.rule === "first-apron" || i.rule === "hard-cap"));
    const other = v.issues.find((i) => i.severity === "error" && !(i.rule === "salary-matching" || i.rule === "first-apron" || i.rule === "hard-cap"));
    if (other || !salaryIssue?.teamId) return null;
    // the team receiving too much salary needs the partner to take salary back: it adds outgoing salary itself
    const t = salaryIssue.teamId;
    const side = cur.sides.find((s) => s.teamId === t)!;
    const sum = v.teams.find((s) => s.teamId === t)!;
    const gap = sum.incomingSalary - sum.maxIncoming;
    const fillers = tradablePlayers(l, t, new Set([...exclude, ...side.players]))
      .map((p) => ({ p, sal: salaryIn(contractOf(l, p), l.season), val: playerValue(l, p, t) }))
      .filter((x) => x.sal > 0)
      .sort((x, y) => x.val / Math.max(1, x.sal / 1e6) - y.val / Math.max(1, y.sal / 1e6));
    // salary filler should be a role player, never a core piece
    const cheap = fillers.filter((f) => f.val <= 20);
    const pick = cheap.find((f) => f.sal >= gap / 2) ?? cheap[cheap.length - 1];
    if (!pick) return null;
    side.players.push(pick.p.id);
  }
  return validateTrade(l, cur).valid ? cur : null;
}

export interface FinderOffer {
  teamId: TeamId;
  assets: TradeAssets;
  valueToMe: number;
  valueToThem: number;
  meter: number;
  reasoning: string[];
}

function teamContext(l: League, t: TeamId): string[] {
  const st = capStatus(l, t);
  const strat = strategyOf(l, t);
  const out = [`${l.teams[t].fullName} are ${strat}`];
  if (st.status === "under-cap") out.push(`$${(st.room / 1e6).toFixed(1)}M in cap space`);
  else if (st.status === "over-second") out.push("Over the 2nd apron - can't aggregate or add salary");
  else if (st.status === "over-first") out.push("Over the 1st apron - must match salary 100%");
  else if (st.status === "over-tax") out.push(`Taxpayer ($${(st.taxBill / 1e6).toFixed(1)}M bill)`);
  return out;
}

/** "Find offers" / "Shop this player": ranked CBA-legal offers from every other team. */
export function findOffers(l: League, playerIds: string[], myTeam: TeamId, maxResults = 12, pickIds: string[] = []): FinderOffer[] {
  if (!tradeWindowOpen(l).open) return [];
  const offers: FinderOffer[] = [];
  for (const t of Object.keys(l.teams)) {
    if (t === myTeam || l.userTeams.includes(t)) continue;
    const base = twoTeam(myTeam, t);
    base.sides[0].players = [...playerIds];
    base.sides[0].picks = [...pickIds];
    const theirValueOfMine =
      playerIds.reduce((s, id) => s + playerValue(l, l.players[id], t, { incoming: true }) * positionalNeed(l, t, l.players[id]), 0) +
      pickIds.reduce((s, id) => s + (l.picks[id] ? pickValue(l, l.picks[id], t) : 0), 0);
    if (theirValueOfMine < 1) continue;
    // FAIR OFFERS: they build a package worth about what I give up (by my own valuation) - one
    // comparable player, or 2-3 good ones whose value adds up. Lopsided offers are dropped.
    // neutral (strategy-free) value, so "fair" means fair league-wide
    const neutral = (a: TradeAssets, side: TeamId) => {
      const s = a.sides.find((x) => x.teamId === side)!;
      return s.players.reduce((v, id) => v + Math.max(0, playerValue(l, l.players[id], null)), 0) + s.picks.reduce((v, id) => v + (l.picks[id] ? pickValue(l, l.picks[id], null) : 0), 0);
    };
    const myValueOut = neutral(base, myTeam);
    const bestOut = Math.max(70, ...playerIds.map((id) => l.players[id]?.ovr ?? 0));
    // two shapes per team: a players-first package, and a picks-first one (picks + at most light salary),
    // which is only legal when they can absorb the salary (cap room, a light contract, or no cap)
    const seen = new Set<string>();
    // third shape: one real player worth part of the value, with draft picks making up the rest
    const anchors = tradablePlayers(l, t, new Set())
      .map((p) => ({ p, v: Math.max(0, playerValue(l, p, null)) }))
      .filter((x) => x.p.ovr <= bestOut + 3 && x.v >= myValueOut * 0.4 && x.v <= myValueOut * 0.85)
      .sort((a, b) => b.v - a.v)
      .slice(0, 2);
    const shapes: { kind: "players" | "picks" | "mixed"; base: TradeAssets; exclude: Set<string>; target: number }[] = [
      { kind: "players", base, exclude: new Set(), target: myValueOut },
      { kind: "picks", base, exclude: new Set(), target: myValueOut },
      ...anchors.map((x) => {
        const b = clone(base);
        b.sides.find((sd) => sd.teamId === t)!.players.push(x.p.id);
        return { kind: "mixed" as const, base: b, exclude: new Set([x.p.id]), target: myValueOut - x.v };
      }),
    ];
    for (const shape of shapes) {
      const picksFirst = shape.kind !== "players";
      const final = fillPackage(l, shape.base, t, myTeam, shape.exclude, (a) => neutral(a, t) >= myValueOut * 0.9, { maxPieces: picksFirst ? 5 : 4, fairTarget: shape.target, maxOvr: bestOut + 3, picksFirst });
      if (!final) continue;
      const theirSide = final.sides.find((x) => x.teamId === t)!;
      if (shape.kind === "picks" && (!theirSide.picks.length || theirSide.players.length > 1)) continue;
      if (shape.kind === "mixed" && !theirSide.picks.length) continue;
      const key = [...theirSide.players].sort().join(",") + "|" + [...theirSide.picks].sort().join(",");
      if (seen.has(key)) continue;
      seen.add(key);
      const evThem = evaluateFor(l, final, t);
      // AI-proposed fair deals: a team will offer anything within 25% of how it values the swap
      if (evThem.meter < 75) continue;
      const evMe = evaluateFor(l, final, myTeam);
      const got = neutral(final, t);
      if (got < myValueOut * 0.85 || got > myValueOut * 1.35) continue; // fair both ways
      if (theirSide.players.length + theirSide.picks.length > (theirSide.picks.length ? 5 : 4)) continue;
      const tags = theirSide.picks.length && !theirSide.players.length ? ["Picks-only offer - they absorb the salary"] : theirSide.picks.length ? ["Players + picks"] : [];
      offers.push({ teamId: t, assets: final, valueToMe: evMe.valueIn, valueToThem: evThem.valueIn, meter: evThem.meter, reasoning: [...tags, ...teamContext(l, t), ...evThem.reasons.filter((r) => !r.startsWith("Close"))] });
    }
  }
  // keep a mix: the best offers overall, but make sure deals with picks aren't all crowded out
  const sorted = offers.sort((a, b) => b.valueToMe - a.valueToMe);
  const hasPicks = (o: FinderOffer) => o.assets.sides.find((x) => x.teamId === o.teamId)!.picks.length > 0;
  const withPicks = sorted.filter(hasPicks).slice(0, Math.ceil(maxResults / 2));
  const rest = sorted.filter((o) => !withPicks.includes(o)).slice(0, maxResults - withPicks.length);
  return [...rest, ...withPicks].sort((a, b) => b.valueToMe - a.valueToMe);
}

/**
 * "What would it take to get X?" - a realistic package the owner accepts, or a plain reason why not.
 * Franchise players aren't for sale, and a price more than ~25% above the player's value counts as
 * "not possible" rather than an absurd overpay.
 */
export function whatWouldItTakeWithReason(l: League, targetId: string, myTeam: TeamId): { offer: FinderOffer | null; reason: string | null } {
  const target = l.players[targetId];
  if (!target?.teamId || target.teamId === myTeam) return { offer: null, reason: "Pick a player on another team." };
  const them = target.teamId;
  const team = l.teams[them];
  const roster = teamPlayers(l, them).sort((a, b) => b.ovr - a.ovr);
  // only a true cornerstone is off the table: the team's best player, 92+, 31 or younger, on a team that isn't rebuilding
  const franchise = roster[0]?.id === targetId && target.ovr >= 92 && seasonAgeOf(l, target) <= 31 && strategyOf(l, them) !== "rebuilding";
  if (franchise && !target.tradeRequest) {
    return { offer: null, reason: `Not possible - ${target.name} is the ${team.name}' franchise player and isn't available.` };
  }
  const value = Math.max(1, playerValue(l, target, null));
  // cheapest fair package: 1-4 of my players/picks, value 0.7-1.5× the target, cheapest that works first
  type Piece = { kind: "p" | "k"; id: string; v: number };
  const mine: Piece[] = [
    ...tradablePlayers(l, myTeam, new Set()).map((p) => ({ kind: "p" as const, id: p.id, v: Math.max(0, playerValue(l, p, null)) })),
    ...tradablePicks(l, myTeam).map((k) => ({ kind: "k" as const, id: k.id, v: pickValue(l, k, null) })),
  ].filter((x) => x.v >= 1 && x.v <= value * 1.5).sort((x, y) => y.v - x.v).slice(0, 16);
  const combos: Piece[][] = [];
  for (let i = 0; i < mine.length; i++) {
    combos.push([mine[i]]);
    for (let j = i + 1; j < mine.length; j++) {
      combos.push([mine[i], mine[j]]);
      for (let k = j + 1; k < mine.length; k++) {
        combos.push([mine[i], mine[j], mine[k]]);
        for (let m = k + 1; m < mine.length && m < k + 6; m++) combos.push([mine[i], mine[j], mine[k], mine[m]]);
      }
    }
  }
  const scored = combos.map((c) => ({ c, v: c.reduce((t, x) => t + x.v, 0) })).filter((x) => x.v >= value * 0.7 && x.v <= value * 1.5).sort((x, y) => x.v - y.v);
  let pkg: TradeAssets | null = null;
  let tries = 0;
  for (const { c } of scored) {
    if (++tries > 400) break;
    const cand = twoTeam(myTeam, them);
    cand.sides[1].players = [targetId];
    cand.sides[0].players = c.filter((x) => x.kind === "p").map((x) => x.id);
    cand.sides[0].picks = c.filter((x) => x.kind === "k").map((x) => x.id);
    const fixed = fixSalaries(l, cand, new Set([targetId]));
    // close enough counts: they'll say yes within ~8% of their asking price
    if (!fixed || evaluateFor(l, fixed, them).meter < 92) continue;
    // the whole package (salary filler included) must stay within 60% of the target's value
    const outSide = fixed.sides.find((x) => x.teamId === myTeam)!;
    const total = outSide.players.reduce((v, id) => v + Math.max(0, playerValue(l, l.players[id], null)), 0) + outSide.picks.reduce((v, id) => v + (l.picks[id] ? pickValue(l, l.picks[id], null) : 0), 0);
    if (total > value * 1.6) continue;
    pkg = fixed;
    break;
  }
  if (!pkg) return { offer: null, reason: `Not possible - the ${team.name} won't trade ${target.name} for any fair package you can offer.` };
  const ev = evaluateFor(l, pkg, them);
  return { offer: { teamId: them, assets: pkg, valueToMe: evaluateFor(l, pkg, myTeam).valueIn, valueToThem: ev.valueIn, meter: ev.meter, reasoning: [...teamContext(l, them), ...ev.reasons] }, reason: null };
}

export function whatWouldItTake(l: League, targetId: string, myTeam: TeamId): FinderOffer | null {
  return whatWouldItTakeWithReason(l, targetId, myTeam).offer;
}

function seasonAgeOf(l: League, p: Player) {
  return seasonAge(p, l.season);
}

/** "Find me a player at position Y under $Z." */
export function findPlayers(l: League, myTeam: TeamId, filter: { pos?: string; maxSalary?: number; minOvr?: number }, maxResults = 10) {
  const cands = Object.values(l.players)
    .filter((p) => p.status === "active" && p.teamId && p.teamId !== myTeam && !l.userTeams.includes(p.teamId))
    .filter((p) => !filter.pos || p.pos === filter.pos || p.positions.some((x) => filter.pos!.startsWith(x)))
    .filter((p) => filter.maxSalary == null || salaryIn(contractOf(l, p), l.season) <= filter.maxSalary)
    .filter((p) => p.ovr >= (filter.minOvr ?? 60))
    .sort((a, b) => playerValue(l, b, myTeam) - playerValue(l, a, myTeam))
    .slice(0, maxResults * 2);
  const out: { player: Player; offer: FinderOffer | null }[] = [];
  for (const p of cands) {
    out.push({ player: p, offer: whatWouldItTake(l, p.id, myTeam) });
    if (out.filter((x) => x.offer).length >= maxResults) break;
  }
  return out;
}

/** Suggest a counter when the AI rejects: ask for more from the user side, or pull back their assets. */
export function counterOffer(l: League, a: TradeAssets, aiTeam: TeamId, userTeam: TeamId): TradeAssets | null {
  const pkg = fillPackage(l, a, userTeam, aiTeam, new Set(), (x) => evaluateFor(l, x, aiTeam).accept, { maxPieces: 7, preferPicks: true });
  if (pkg) return pkg;
  // try removing AI assets
  const b = clone(a);
  const s = b.sides.find((x) => x.teamId === aiTeam)!;
  while (s.picks.length || s.players.length > 1) {
    if (s.picks.length) s.picks.pop();
    else s.players.pop();
    const fixed = fixSalaries(l, b, new Set());
    if (fixed && evaluateFor(l, fixed, aiTeam).accept) return fixed;
  }
  return null;
}

// ---------- AI-initiated trades ----------
export function runAiTrades(l: League, rng: Rng, maxTrades = 1): string[] {
  if (!l.settings.aiTrades || !tradeWindowOpen(l).open) return [];
  const done: string[] = [];
  const ai = Object.keys(l.teams).filter((t) => !l.userTeams.includes(t));
  for (let attempt = 0; attempt < 16 && done.length < maxTrades; attempt++) {
    const buyer = rng.pick(ai);
    const bStrat = strategyOf(l, buyer);
    const sellers = ai.filter((t) => t !== buyer && strategyOf(l, t) !== bStrat);
    if (!sellers.length) continue;
    const seller = rng.pick(sellers);
    // buyer targets: contenders want good vets, rebuilders want young upside
    const targets = teamPlayers(l, seller)
      .filter((p) => (bStrat === "contending" ? p.ovr >= 74 : p.pot >= 76 && Number(l.date.slice(0, 4)) - Number(p.dob.slice(0, 4)) <= 24))
      .filter((p) => contractOf(l, p) && !["two-way", "exhibit-10"].includes(contractOf(l, p)!.type));
    if (!targets.length) continue;
    const target = rng.pick(targets);
    const base = twoTeam(buyer, seller);
    base.sides[1].players = [target.id];
    const pkg = fillPackage(l, base, buyer, seller, new Set(), (a) => evaluateFor(l, a, seller).accept, { maxPieces: 4 });
    if (!pkg) continue;
    const evB = evaluateFor(l, pkg, buyer);
    const evS = evaluateFor(l, pkg, seller);
    // buyers will overpay a little for fit (the seller's asking margin)
    if (!evS.accept || evB.net < -(3 + evB.valueOut * 0.08)) continue;
    executeTrade(l, pkg);
    done.push(pkg.sides.map((s) => s.teamId).join("-"));
  }
  return done;
}

/**
 * Salary dumps: taxpaying AI teams send an unwanted contract (plus a sweetener pick) to a team with
 * cap room - or one below the salary floor - which absorbs it without sending salary back.
 */
export function runSalaryDumps(l: League, rng: Rng, max = 2): number {
  if (!tradeWindowOpen(l).open || !l.settings.salaryCap) return 0;
  let done = 0;
  const ai = Object.keys(l.teams).filter((t) => !l.userTeams.includes(t));
  const absorbers = ai
    .map((t) => ({ t, st: capStatus(l, t) }))
    .filter((x) => x.st.room > 6_000_000 || x.st.taxSalary < x.st.minimumTeamSalary)
    .sort((a, b) => b.st.room - a.st.room);
  const payers = ai.map((t) => ({ t, st: capStatus(l, t) })).filter((x) => x.st.status === "over-tax" || x.st.status === "over-first" || x.st.status === "over-second");
  for (const abs of absorbers) {
    if (done >= max || !payers.length) break;
    const payer = rng.pick(payers);
    const room = Math.max(abs.st.room, abs.st.minimumTeamSalary - abs.st.taxSalary) + 250_000;
    const dump = teamPlayers(l, payer.t)
      .map((p) => ({ p, sal: salaryIn(contractOf(l, p), l.season), v: playerValue(l, p, payer.t) }))
      .filter((x) => x.sal > 3_000_000 && x.sal <= room && x.v < 12)
      .sort((a, b) => b.sal - a.sal)[0];
    if (!dump) continue;
    const a = twoTeam(payer.t, abs.t);
    a.sides[0].players = [dump.p.id];
    const sweetener = tradablePicks(l, payer.t).filter((k) => k.round === 2).sort((x, y) => y.year - x.year)[0];
    if (sweetener) a.sides[0].picks = [sweetener.id];
    if (!validateTrade(l, a).valid) continue;
    if (!evaluateFor(l, a, abs.t).accept && abs.st.taxSalary >= abs.st.minimumTeamSalary) continue;
    executeTrade(l, a);
    done++;
  }
  return done;
}

/** Occasionally an AI team calls the user with an offer for someone on their roster / trade block. */
export function generateOffersToUser(l: League, rng: Rng) {
  if (!tradeWindowOpen(l).open) return;
  l.tradeOffers = l.tradeOffers.filter((o) => o.expires >= l.date);
  for (const user of l.userTeams) {
    if (l.tradeOffers.filter((o) => o.to === user).length >= 3) continue;
    const block = l.tradeBlock.filter((id) => l.players[id]?.teamId === user);
    const pool = block.length ? block : teamPlayers(l, user).filter((p) => p.ovr >= 70).map((p) => p.id);
    if (!pool.length) continue;
    const pid = rng.pick(pool);
    const offers = findOffers(l, [pid], user, 3);
    if (!offers.length) continue;
    const o = offers[rng.int(0, offers.length - 1)];
    const offer: TradeOffer = { id: newId(l, "to"), from: o.teamId, to: user, assets: o.assets, created: l.date, expires: addDays(l.date, 5), reasoning: o.reasoning };
    l.tradeOffers.unshift(offer);
    l.news.unshift({ id: newId(l, "n"), date: l.date, type: "rumor", text: `${l.teams[o.teamId].fullName} have called about ${l.players[pid].name}.`, teams: [o.teamId, user], players: [pid] });
  }
}

export { cbaFor };
