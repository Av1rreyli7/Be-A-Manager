"use client";
import { Trophy } from "@phosphor-icons/react";
import clsx from "clsx";
import { useGame, useLeague, useTeamId } from "@/lib/store";
import { Button, Card, Empty, PageHeader, TeamBadge } from "@/components/ui";
import { conferenceStandings } from "@/engine/season/standings";
import { leaveOnline } from "@/lib/online/session";
import type { League, TeamId } from "@/engine/types/game";

/** Challenge points: 1 per win, 4 per playoff series won, 10 for the title. */
function seasonPoints(l: League, t: TeamId) {
  const rec = l.standings[t] ?? { w: 0, l: 0 };
  const seriesWon = l.playoffs.filter((s) => s.winner === t).length;
  const champ = l.playoffs.find((s) => s.conference === "Finals")?.winner === t;
  const conf = l.teams[t].conference;
  const seed = conferenceStandings(l, conf).indexOf(t) + 1;
  const alive = l.playoffs.some((s) => (s.high === t || s.low === t) && !s.winner);
  const out = l.playoffs.some((s) => (s.high === t || s.low === t) && s.winner && s.winner !== t);
  const deepest = Math.max(0, ...l.playoffs.filter((s) => s.high === t || s.low === t).map((s) => s.round));
  const status = champ ? "Champions" : alive ? `Playoffs · round ${deepest}` : out ? `Out in round ${deepest}` : l.playoffs.length ? "Missed playoffs" : "";
  return { w: rec.w, l: rec.l, seriesWon, champ, seed, conf, status, points: rec.w + seriesWon * 4 + (champ ? 10 : 0) };
}

export default function FriendsChallenge() {
  const l = useLeague();
  const me = useTeamId();
  const online = useGame((s) => s.online);
  if (!l.online) return <Empty>This is not an online league. Start one from the main menu under Play with friends.</Empty>;
  const humans = Object.keys(l.online.members).filter((t) => l.teams[t]);
  const rows = humans.map((t) => ({ t, name: l.online!.members[t], ...seasonPoints(l, t) })).sort((a, b) => b.points - a.points || b.w - a.w);
  const allTime = humans
    .map((t) => {
      // only seasons played in this league (history also holds last season's real standings)
      const start = l.online!.startSeason ?? l.season;
      const past = l.history.filter((h) => h.season !== l.season && h.season >= start);
      const w = past.reduce((a, h) => a + (h.standings?.find((s) => s.teamId === t)?.w ?? 0), 0) + (l.standings[t]?.w ?? 0);
      const titles = l.history.filter((h) => h.champion === t && h.season >= start).length;
      return { t, name: l.online!.members[t], w, titles };
    })
    .sort((a, b) => b.titles - a.titles || b.w - a.w);
  const memberOnline = new Map((online?.lobby?.members ?? []).map((m) => [m.team, m.online]));
  return (
    <div className="space-y-4">
      <PageHeader
        title="Friends Challenge"
        sub={`${l.season} · room ${l.online.code} · ${online?.role === "host" ? "you're the host: you control the sim" : "the host controls the sim"}`}
        // a guest leaving needs a full reload to drop the host's league and the peer connection
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        right={online ? <Button variant="ghost" onClick={() => { leaveOnline(); if (online.role === "guest") window.location.assign("/gm"); }}>{online.role === "host" ? "Close room" : "Leave league"}</Button> : null}
      />
      <Card title="This season" pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-mute">
              <tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Manager</th><th className="px-3 py-2">Team</th><th className="px-3 py-2 text-right">W-L</th><th className="px-3 py-2 text-right">Seed</th><th className="px-3 py-2">Playoffs</th><th className="px-3 py-2 text-right">Points</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.t} className={clsx("border-t border-line", r.t === me && "bg-accent/10")}>
                  <td className="px-3 py-2 font-num text-[15px] font-bold text-mute">{i + 1}</td>
                  <td className="px-3 py-2 font-semibold">
                    <span className={clsx("mr-2 inline-block h-2 w-2 rounded-full", memberOnline.get(r.t) ? "bg-good" : "bg-mute")} />
                    {r.name}{r.t === l.online!.hostTeam && <span className="chip ml-2 text-[10px]">host</span>}
                  </td>
                  <td className="px-3 py-2"><TeamBadge league={l} teamId={r.t} size="sm" /></td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.w}-{r.l}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.seed ? `${r.seed} ${r.conf}` : "-"}</td>
                  <td className="px-3 py-2 text-xs text-dim">{r.status}</td>
                  <td className="px-3 py-2 text-right font-num text-[15px] font-bold text-accent">{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-3 pb-3 pt-1 text-xs text-mute">Points: 1 per win · 4 per playoff series won · 10 for the championship.</p>
      </Card>
      <Card title="All-time">
        <ul className="divide-y divide-line">
          {allTime.map((r) => (
            <li key={r.t} className="flex items-center gap-3 py-2 text-sm">
              <TeamBadge league={l} teamId={r.t} size="sm" />
              <span className="font-semibold">{r.name}</span>
              <span className="ml-auto text-dim">{r.w} wins</span>
              <span className="w-24 text-right">{r.titles ? <span className="inline-flex items-center justify-end gap-0.5 text-gold">{Array.from({ length: Math.min(5, r.titles) }, (_, i) => <Trophy key={i} size={15} weight="fill" />)}{r.titles > 5 ? <span className="ml-1 font-num font-bold">×{r.titles}</span> : null}</span> : "-"}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="How online play works">
        <ul className="list-disc space-y-1 pl-5 text-sm text-dim">
          <li>Everyone manages their own team: trades, free agency, extensions, rotation, draft picks.</li>
          <li>Trades with a friend&apos;s team go to them as an offer: they accept or decline under Trade Machine, Offers received.</li>
          <li>Only the host sims. The league is saved in the host&apos;s browser; if the host closes the tab, the room reopens with the same code from their save.</li>
          <li>Friends can join mid-season with the code and take any team nobody has.</li>
        </ul>
      </Card>
    </div>
  );
}
