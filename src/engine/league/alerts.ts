/** Dashboard to-do alerts for user teams. */
import type { League } from "../types/game";
import { extensionEligibility } from "../cap/contracts";
import { capStatus } from "../cap/payroll";
import { tradeWindowOpen } from "../cap/trade";
import { daysBetween, seasonCalendar, seasonStartYear } from "../util/dates";
import { standardPlayers, teamPlayers, isTwoWay, contractOf } from "./helpers";
import { pendingDecisions } from "../offseason/freeAgency";

export function computeAlerts(l: League) {
  const out: League["alerts"] = [];
  const cal = seasonCalendar(seasonStartYear(l.season));
  for (const t of l.userTeams) {
    const team = l.teams[t];
    const ps = teamPlayers(l, t);
    const std = standardPlayers(l, t).length;
    const tw = ps.filter((p) => isTwoWay(l, p)).length;
    const ext = ps.filter((p) => extensionEligibility(l, p).eligible);
    if (ext.length) out.push({ id: `ext-${t}`, text: `${ext.length} player${ext.length > 1 ? "s" : ""} eligible for an extension`, href: "/game/contracts", level: "info" });
    if ((l.phase === "regular" || l.phase === "preseason") && l.date <= cal.tradeDeadline) {
      const d = daysBetween(l.date, cal.tradeDeadline);
      if (d <= 14) out.push({ id: `dl-${t}`, text: d === 0 ? "Trade deadline is today" : `Trade deadline in ${d} day${d > 1 ? "s" : ""}`, href: "/game/trade", level: d <= 3 ? "warn" : "info" });
    }
    const maxStd = l.phase === "preseason" || l.phase === "regular" || l.phase === "playoffs" ? l.cba.roster.maxStandard : l.cba.roster.offseasonMax;
    if (l.phase === "preseason" && std > l.cba.roster.maxStandard) out.push({ id: `cut-${t}`, text: `Cut down to ${l.cba.roster.maxStandard} standard players before opening night (${std} now)`, href: "/game/roster", level: "danger" });
    else if (std > maxStd) out.push({ id: `max-${t}`, text: `Roster over the limit (${std}/${maxStd})`, href: "/game/roster", level: "danger" });
    if (l.phase === "regular" && std < l.cba.roster.minStandard) out.push({ id: `min-${t}`, text: `Only ${std} standard players - sign someone within ${l.cba.roster.minStandardGraceDays} days`, href: "/game/free-agency", level: "warn" });
    if (tw > l.cba.roster.maxTwoWay) out.push({ id: `tw-${t}`, text: `Too many two-way players (${tw})`, href: "/game/roster", level: "danger" });
    for (const p of ps) {
      const c = contractOf(l, p);
      if (c?.type === "two-way" && (c.twoWayGames ?? 0) >= l.cba.roster.twoWayGameLimit - 5) out.push({ id: `twg-${p.id}`, text: `${p.name} has used ${c.twoWayGames}/${l.cba.roster.twoWayGameLimit} two-way games`, href: `/game/player/${p.id}`, level: "warn" });
      if (p.tradeRequest) out.push({ id: `tr-${p.id}`, text: `${p.name} has requested a trade`, href: `/game/player/${p.id}`, level: "warn" });
    }
    const st = capStatus(l, t);
    if (st.hardCapRoom != null && st.hardCapRoom < 2_000_000) out.push({ id: `hc-${t}`, text: `Only $${(st.hardCapRoom / 1e6).toFixed(1)}M below your hard cap`, href: "/game/cap", level: "warn" });
    for (const x of team.exceptions.tpes) if (daysBetween(l.date, x.expires) <= 21 && x.expires >= l.date) out.push({ id: `tpe-${x.id}`, text: `$${(x.amount / 1e6).toFixed(1)}M trade exception expires ${x.expires}`, href: "/game/cap", level: "info" });
    if (l.phase === "options") {
      const pend = pendingDecisions(l, t);
      if (pend.length) out.push({ id: `opt-${t}`, text: `${pend.length} option / qualifying-offer decision${pend.length > 1 ? "s" : ""} pending`, href: "/game/offseason", level: "warn" });
    }
    const offers = l.tradeOffers.filter((o) => o.to === t);
    if (offers.length && tradeWindowOpen(l).open) out.push({ id: `to-${t}`, text: `${offers.length} trade offer${offers.length > 1 ? "s" : ""} waiting`, href: "/game/trade?tab=offers", level: "info" });
    const rfa = l.freeAgency.offers.filter((o) => o.status === "accepted" && o.offerSheet && o.matchDeadline && l.players[o.playerId]?.rfaTeam === t);
    for (const o of rfa) out.push({ id: `rfa-${o.id}`, text: `Offer sheet for ${l.players[o.playerId].name} - match by ${o.matchDeadline}`, href: "/game/free-agency", level: "danger" });
  }
  l.alerts = out;
}
