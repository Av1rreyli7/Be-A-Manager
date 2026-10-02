/** Apply a validated trade to league state. */
import type { League, TeamId, TradeAssets } from "../types/game";
import { contractOf, newId, salaryIn } from "../league/helpers";
import { autoDepth } from "../league/depth";
import { assetKeyCash, assetKeyPick, assetKeyPlayer, destinationOf, validateTrade, type TradeValidation } from "../cap/trade";
import { cbaFor } from "../cap/payroll";
import { addDays } from "../util/dates";

export function describeTrade(l: League, a: TradeAssets): string {
  const parts: string[] = [];
  for (const s of a.sides) {
    const items: string[] = [];
    for (const pid of s.players) items.push(l.players[pid]?.name ?? pid);
    for (const kid of s.picks) {
      const k = l.picks[kid];
      if (k) items.push(`${k.year} ${k.originalTeam} ${k.round === 1 ? "1st" : "2nd"}${k.protection.kind !== "none" ? ` (${k.protection.text})` : ""}`);
    }
    if (s.cash) items.push(`${(s.cash / 1e6).toFixed(1)}M cash`);
    for (const sw of (a.swaps ?? []).filter((x) => x.from === s.teamId)) items.push(`right to swap ${sw.year} ${sw.round === 1 ? "1sts" : "2nds"} (to ${sw.to})`);
    if (items.length) parts.push(`${s.teamId} sends ${items.join(", ")}`);
  }
  return parts.join("; ");
}

export function executeTrade(l: League, a: TradeAssets, opts: { force?: boolean } = {}): TradeValidation {
  const v = validateTrade(l, a);
  if (!v.valid && !opts.force) return v;
  const season = l.season;
  const cba = cbaFor(l, season);
  const moved: { pid: string; from: TeamId; to: TeamId }[] = [];

  for (const side of a.sides) {
    const from = side.teamId;
    for (const pid of side.players) {
      const p = l.players[pid];
      if (!p) continue;
      const to = destinationOf(a, assetKeyPlayer(pid), from);
      const c = contractOf(l, p);
      if (c) {
        c.teamId = to;
        // trade kicker: bumps the current-season salary (capped at 15% of remaining value)
        if (c.tradeKicker) {
          const cur = c.years.find((y) => y.season === season);
          if (cur) {
            const bump = Math.round(Math.min(c.tradeKicker.value || cur.salary * (c.tradeKicker.pct / 100), cur.salary * 0.15));
            cur.salary += bump;
            cur.guaranteed = Math.min(cur.salary, cur.guaranteed + bump);
            c.notes.push(`Trade kicker paid on ${l.date}: +$${(bump / 1e6).toFixed(2)}M`);
            c.tradeKicker = null;
          }
        }
      }
      p.teamId = to;
      p.acquiredDate = l.date;
      p.gLeague = false;
      p.morale = Math.max(20, p.morale - 8);
      moved.push({ pid, from, to });
    }
    for (const kid of side.picks) {
      const k = l.picks[kid];
      if (k) k.owner = destinationOf(a, assetKeyPick(kid), from);
    }
    if (side.cash) {
      const to = destinationOf(a, assetKeyCash(from), from);
      l.teams[from].cashSent += side.cash;
      l.teams[to].cashReceived += side.cash;
      l.teams[from].finances.cash -= side.cash;
      l.teams[to].finances.cash += side.cash;
    }
    if (side.tpe) {
      const t = l.teams[from];
      t.exceptions.tpes = t.exceptions.tpes.filter((x) => x.id !== side.tpe);
    }
  }

  for (const [pid, top] of Object.entries(a.protections ?? {})) {
    const k = l.picks[pid];
    if (k) {
      k.protection = { kind: "top", keepTop: top, text: `top-${top} protected (added ${l.date})` };
      k.custom = true;
    }
  }
  for (const sw of a.swaps ?? []) {
    const id = `swap-${sw.year}-${sw.round}-${sw.from}-${sw.to}`;
    l.picks[id] = { id, year: sw.year, round: sw.round, originalTeam: sw.from, owner: sw.to, protection: { kind: "none", text: "swap right" }, swap: true, conditional: false, frozen: false, forfeited: false, terms: [`${sw.to} may swap its ${sw.year} ${sw.round === 1 ? "1st" : "2nd"} with ${sw.from}'s`], custom: true };
  }

  // hard caps triggered & trade exceptions created
  for (const s of v.teams) {
    const team = l.teams[s.teamId];
    if (s.triggersHardCap && l.settings.salaryCap) {
      if (!team.hardCap || (team.hardCap === "second" && s.triggersHardCap === "first")) team.hardCap = s.triggersHardCap;
    }
    const net = s.outgoingSalary - s.incomingSalary;
    const overCapAfter = s.postApron !== "under-cap";
    if (net > 0 && overCapAfter && s.outgoingPlayers > 0) {
      // TPE = largest outgoing salary not matched (simplified: net outgoing, capped by the largest single salary)
      const side = a.sides.find((x) => x.teamId === s.teamId)!;
      const biggest = Math.max(...side.players.map((pid) => salaryIn(l.contracts[l.players[pid].contractId ?? ""], season)), 0);
      const amt = Math.min(net, biggest);
      if (amt >= cba.minimumSalary.byService[0]) {
        team.exceptions.tpes.push({
          id: newId(l, "tpe"),
          amount: amt,
          created: l.date,
          expires: addDays(l.date, cba.exceptions.tpeDurationDays.value),
          fromPlayer: side.players.map((pid) => l.players[pid].name).join(", "),
          fromSignAndTrade: !!a.signAndTrade?.length,
        });
      }
    }
    // mark aggregated arrivals
    if (s.aggregated) for (const m of moved.filter((x) => x.from === s.teamId)) l.players[m.pid].acquiredAggregated = true;
  }

  for (const t of a.sides.map((s) => s.teamId)) {
    const team = l.teams[t];
    if (!l.userTeams.includes(t) || team.depth.auto) team.depth = autoDepth(l, t);
    else {
      // drop departed players from a manual depth chart
      const here = new Set(Object.values(l.players).filter((p) => p.teamId === t).map((p) => p.id));
      team.depth.starters = team.depth.starters.filter((id) => here.has(id));
      team.depth.rotation = team.depth.rotation.filter((id) => here.has(id));
      for (const m of moved.filter((x) => x.to === t)) team.depth.rotation.push(m.pid);
      if (team.depth.starters.length < 5) team.depth = autoDepth(l, t);
    }
  }
  l.tradeBlock = l.tradeBlock.filter((pid) => !moved.some((m) => m.pid === pid));
  const text = describeTrade(l, a) || "Trade completed";
  l.news.unshift({ id: newId(l, "n"), date: l.date, type: "trade", text: `TRADE: ${text}`, teams: a.sides.map((s) => s.teamId), players: moved.map((m) => m.pid), important: true });
  l.transactions.unshift({ date: l.date, text: `Trade - ${text}`, teams: a.sides.map((s) => s.teamId) });
  return v;
}
