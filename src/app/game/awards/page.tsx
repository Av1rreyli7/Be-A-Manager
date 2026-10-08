"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useLeague } from "@/lib/store";
import { Card, Empty, PageHeader, PlayerLink, Tabs, TeamBadge } from "@/components/ui";
import { awardScores, minGames } from "@/engine/season/awards";
import { perGame, seasonTotal } from "@/engine/season/stats";
import { f1 } from "@/lib/format";

export default function AwardsPage() {
  const l = useLeague();
  const [tab, setTab] = useState<"race" | "allstar" | "past">("race");
  const rows = useMemo(() => awardScores(l), [l]);
  const minG = minGames(l);
  const gp = Math.max(...Object.values(l.standings).map((r) => r.w + r.l), 0);
  const pace = (games: number) => (gp ? Math.round((games / gp) * l.settings.seasonLength) : 0);
  const race = [
    { award: "MVP", key: "score" as const, filter: () => true },
    { award: "Defensive Player", key: "def" as const, filter: () => true },
    { award: "Rookie of the Year", key: "score" as const, filter: (r: (typeof rows)[number]) => r.rookie },
    { award: "Sixth Man", key: "score" as const, filter: (r: (typeof rows)[number]) => r.bench },
    { award: "Most Improved", key: "mip" as const, filter: (r: (typeof rows)[number]) => l.players[r.id].experience >= 1 },
    { award: "Clutch Player", key: "clutch" as const, filter: () => true },
  ];
  const as = l.allStar;
  return (
    <div className="space-y-4">
      <PageHeader title="Awards & All-Star" sub={`65-game eligibility rule: ${minG} games this season (ROY/All-Rookie exempt)`} />
      <Tabs tabs={[{ id: "race", label: "Award race" }, { id: "allstar", label: "All-Star" }, { id: "past", label: "Past winners" }]} value={tab} onChange={setTab} />
      {tab === "race" && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {race.map((r) => {
            const top = rows.filter(r.filter).sort((a, b) => b[r.key] - a[r.key]).slice(0, 6);
            return (
              <Card key={r.award} title={r.award}>
                {top.length === 0 ? <p className="text-sm text-dim">No games yet</p> : (
                  <ol className="space-y-1.5 text-sm">
                    {top.map((x, i) => {
                      const s = perGame(seasonTotal(l, x.id));
                      const onPace = pace(x.gp) >= minG || r.award.startsWith("Rookie");
                      return (
                        <li key={x.id} className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="w-4 text-mute">{i + 1}</span>
                            <TeamBadge league={l} teamId={x.teamId} size="sm" />
                            <PlayerLink player={l.players[x.id]} className="truncate" />
                            {!onPace && <span className="k-tag k-bad" title="Not on pace for the games-played minimum">GP</span>}
                          </span>
                          <span className="text-xs text-dim num">{f1(s.pts)}/{f1(s.reb)}/{f1(s.ast)}</span>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </Card>
            );
          })}
        </div>
      )}
      {tab === "allstar" && (
        !as ? <Empty>All-Star voting opens in late December.</Empty> : (
          <div className="grid gap-4 lg:grid-cols-2">
            {as.rosters ? (["East", "West"] as const).map((c) => (
              <Card key={c} title={`Team ${c}`}>
                <ul className="space-y-1 text-sm">{as.rosters![c].map((id, i) => <li key={id} className="flex items-center gap-2">{i < 5 && <span className="k-tag k-acc">Starter</span>}<PlayerLink player={l.players[id]} /><span className="text-dim">{l.players[id]?.teamId}</span></li>)}</ul>
              </Card>
            )) : (
              <Card title="Fan vote leaders">
                <ol className="space-y-1 text-sm">{Object.entries(as.votes).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([id, v], i) => <li key={id} className="flex justify-between"><span><span className="mr-2 text-mute">{i + 1}</span><PlayerLink player={l.players[id]} /></span><span className="num text-dim">{v.toLocaleString()}</span></li>)}</ol>
              </Card>
            )}
            {as.gameId && (
              <Card title="All-Star Weekend">
                <p className="text-sm">Game MVP: <b>{as.mvp ? l.players[as.mvp].name : "-"}</b> · <Link className="text-accent" href={`/game/box/${encodeURIComponent(as.gameId)}`}>Box score</Link></p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="k-mlab mb-1">3-Point Contest</div>
                    {as.threePoint?.map((e) => <div key={e.playerId} className="flex justify-between text-sm"><span className={e.playerId === as.threeWinner ? "font-bold text-accent" : ""}>{l.players[e.playerId]?.name}</span><span className="num text-dim">{e.scores.join(" / ")}</span></div>)}
                  </div>
                  <div>
                    <div className="k-mlab mb-1">Slam Dunk Contest</div>
                    {as.dunk?.map((e) => <div key={e.playerId} className="flex justify-between text-sm"><span className={e.playerId === as.dunkWinner ? "font-bold text-accent" : ""}>{l.players[e.playerId]?.name}</span><span className="num text-dim">{e.scores.join(" / ")}</span></div>)}
                  </div>
                </div>
              </Card>
            )}
          </div>
        )
      )}
      {tab === "past" && (
        <div className="space-y-4">
          {[...l.history].reverse().filter((h) => h.awards.length).map((h) => (
            <Card key={h.season} title={h.season} right={h.champion ? <span>Champion: <b className="text-ink">{h.champion}</b></span> : null}>
              <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(h.awards.reduce((m, a) => ((m[a.award] ??= []).push(a.name), m), {} as Record<string, string[]>)).map(([k, v]) => (
                  <div key={k}><span className="k-label">{k}</span><div className="text-dim">{v.join(", ")}</div></div>
                ))}
              </div>
            </Card>
          ))}
          {!l.history.some((h) => h.awards.length) && <Empty>Awards are handed out at the end of each season.</Empty>}
        </div>
      )}
    </div>
  );
}
