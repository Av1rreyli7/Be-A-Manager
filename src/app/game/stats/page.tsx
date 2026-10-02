"use client";
import { useMemo, useState } from "react";
import { useLeague } from "@/lib/store";
import clsx from "clsx";
import { Card, PageHeader, PlayerLink, Tabs, TeamBadge, inputCls } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { perGame, seasonTotal } from "@/engine/season/stats";
import { advancedFor, leagueBaselines } from "@/engine/stats/advanced";
import { f1, pct } from "@/lib/format";
import { minGames } from "@/engine/season/awards";
import { emptyRecord } from "@/engine/season/standings";

export default function StatsPage() {
  const l = useLeague();
  const [tab, setTab] = useState<"leaders" | "players" | "teams">("leaders");
  const [kind, setKind] = useState<"regular" | "playoffs">("regular");
  const base = useMemo(() => leagueBaselines(l, l.season, kind), [l, kind]);
  const rows = useMemo(
    () =>
      Object.values(l.players)
        .map((p) => {
          const s = seasonTotal(l, p.id, l.season, kind);
          return { p, s, pg: perGame(s), adv: advancedFor(s, base) };
        })
        .filter((r) => r.s.gp > 0),
    [l, kind, base],
  );
  const qual = Math.max(1, Math.round(minGames(l) * 0.7 * Math.min(1, (Object.values(l.standings).reduce((a, r) => a + r.w + r.l, 0) / 30) / l.settings.seasonLength)));
  const qualified = rows.filter((r) => r.s.gp >= (kind === "playoffs" ? 1 : qual));

  const leaders: { label: string; get: (r: (typeof rows)[number]) => number; fmt?: (v: number) => string; filter?: (r: (typeof rows)[number]) => boolean }[] = [
    { label: "Points", get: (r) => r.pg.pts },
    { label: "Rebounds", get: (r) => r.pg.reb },
    { label: "Assists", get: (r) => r.pg.ast },
    { label: "Steals", get: (r) => r.pg.stl },
    { label: "Blocks", get: (r) => r.pg.blk },
    { label: "FG%", get: (r) => r.pg.fgPct, fmt: (v) => pct(v), filter: (r) => r.s.fgm >= r.s.gp * 3 },
    { label: "3P%", get: (r) => r.pg.fg3Pct, fmt: (v) => pct(v), filter: (r) => r.s.fg3m >= r.s.gp * 1 },
    { label: "FT%", get: (r) => r.pg.ftPct, fmt: (v) => pct(v), filter: (r) => r.s.ftm >= r.s.gp * 1.5 },
    { label: "3PM", get: (r) => r.s.fg3m, fmt: (v) => String(v) },
    { label: "PER*", get: (r) => r.adv.per, filter: (r) => r.pg.min >= 20 },
    { label: "BPM*", get: (r) => r.adv.bpm, filter: (r) => r.pg.min >= 20 },
    { label: "Win Shares*", get: (r) => r.adv.ws },
  ];

  const teamRows = Object.keys(l.teams).map((t) => {
    const r = l.standings[t] ?? emptyRecord(t);
    const g = Math.max(1, r.w + r.l);
    const ps = rows.filter((x) => x.p.stats.some((s) => s.season === l.season && s.teamId === t));
    const sum = (k: "fgm" | "fga" | "fg3m" | "fg3a" | "ftm" | "fta" | "oreb" | "dreb" | "ast" | "stl" | "blk" | "tov") =>
      ps.reduce((a, x) => a + (x.p.stats.find((s) => s.season === l.season && s.teamId === t)?.[kind][k] ?? 0), 0);
    return { t, g, ppg: r.pf / g, opp: r.pa / g, fg: sum("fgm") / Math.max(1, sum("fga")), fg3: sum("fg3m") / Math.max(1, sum("fg3a")), ft: sum("ftm") / Math.max(1, sum("fta")), reb: (sum("oreb") + sum("dreb")) / g, ast: sum("ast") / g, stl: sum("stl") / g, blk: sum("blk") / g, tov: sum("tov") / g, fg3a: sum("fg3a") / g };
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stats & Leaders"
        sub={`${l.season} · leaders require ${qual}+ games played (scales through the season) · * = original estimates`}
        right={<select aria-label="Season type" className={clsx(inputCls, "w-auto py-1.5")} value={kind} onChange={(e) => setKind(e.target.value as "regular" | "playoffs")}><option value="regular">Regular season</option><option value="playoffs">Playoffs</option></select>}
      />
      <Tabs tabs={[{ id: "leaders", label: "League leaders" }, { id: "players", label: "Player stats" }, { id: "teams", label: "Team stats" }]} value={tab} onChange={setTab} />
      {tab === "leaders" && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {leaders.map((c) => {
            const top = (c.filter ? qualified.filter(c.filter) : qualified).sort((a, b) => c.get(b) - c.get(a)).slice(0, 5);
            return (
              <Card key={c.label} title={c.label} pad={false}>
                <ol className="text-sm">
                  {top.map((r, i) => {
                    const tc = r.p.teamId ? l.teams[r.p.teamId]?.colors.primary : undefined;
                    return i === 0 ? (
                      <li key={r.p.id} className="side-wash relative flex items-center justify-between gap-2 overflow-hidden px-4 py-3" style={tc ? { ["--tc-team" as string]: tc } : undefined}>
                        <span className="flex min-w-0 flex-col gap-1">
                          <TeamBadge league={l} teamId={r.p.teamId} size="sm" />
                          <PlayerLink player={r.p} className="truncate font-display text-lg font-extrabold uppercase leading-none" />
                        </span>
                        <span className="font-display text-4xl font-black leading-none num">{(c.fmt ?? f1)(c.get(r))}</span>
                      </li>
                    ) : (
                      <li key={r.p.id} className="flex items-center justify-between gap-2 border-t border-line/60 px-4 py-1.5">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="w-3 font-display font-bold text-mute num">{i + 1}</span>
                          <TeamBadge league={l} teamId={r.p.teamId} size="sm" />
                          <PlayerLink player={r.p} className="truncate" />
                        </span>
                        <span className="font-display text-lg font-bold num">{(c.fmt ?? f1)(c.get(r))}</span>
                      </li>
                    );
                  })}
                  {!top.length && <li className="px-4 py-3 text-dim">No games yet</li>}
                </ol>
              </Card>
            );
          })}
        </div>
      )}
      {tab === "players" && (
        <Card pad={false}>
          <div className="p-3">
            <DataTable
              rows={rows}
              rowKey={(r) => r.p.id}
              defaultSort="pts"
              search={(r) => `${r.p.name} ${r.p.teamId}`}
              dense
              columns={[
                { key: "name", label: "Player", value: (r) => r.p.lastName, render: (r) => <PlayerLink player={r.p} /> },
                { key: "team", label: "Team", value: (r) => r.p.teamId ?? "", render: (r) => <TeamBadge league={l} teamId={r.p.teamId} size="sm" /> },
                { key: "gp", label: "GP", value: (r) => r.s.gp, align: "right" },
                { key: "min", label: "MIN", value: (r) => r.pg.min, render: (r) => f1(r.pg.min), align: "right" },
                { key: "pts", label: "PTS", value: (r) => r.pg.pts, render: (r) => f1(r.pg.pts), align: "right" },
                { key: "reb", label: "REB", value: (r) => r.pg.reb, render: (r) => f1(r.pg.reb), align: "right" },
                { key: "ast", label: "AST", value: (r) => r.pg.ast, render: (r) => f1(r.pg.ast), align: "right" },
                { key: "stl", label: "STL", value: (r) => r.pg.stl, render: (r) => f1(r.pg.stl), align: "right" },
                { key: "blk", label: "BLK", value: (r) => r.pg.blk, render: (r) => f1(r.pg.blk), align: "right" },
                { key: "tov", label: "TOV", value: (r) => r.pg.tov, render: (r) => f1(r.pg.tov), align: "right" },
                { key: "fg", label: "FG%", value: (r) => r.pg.fgPct, render: (r) => pct(r.pg.fgPct), align: "right" },
                { key: "3p", label: "3P%", value: (r) => r.pg.fg3Pct, render: (r) => pct(r.pg.fg3Pct), align: "right" },
                { key: "ts", label: "TS%", value: (r) => r.adv.ts, render: (r) => pct(r.adv.ts), align: "right" },
                { key: "usg", label: "USG*", value: (r) => r.adv.usg, render: (r) => pct(r.adv.usg), align: "right" },
                { key: "per", label: "PER*", value: (r) => r.adv.per, render: (r) => f1(r.adv.per), align: "right" },
                { key: "bpm", label: "BPM*", value: (r) => r.adv.bpm, render: (r) => f1(r.adv.bpm), align: "right" },
                { key: "ws", label: "WS*", value: (r) => r.adv.ws, render: (r) => f1(r.adv.ws), align: "right" },
                { key: "pm", label: "+/-", value: (r) => r.pg.pm, render: (r) => f1(r.pg.pm), align: "right" },
              ]}
            />
          </div>
        </Card>
      )}
      {tab === "teams" && (
        <Card pad={false}>
          <div className="p-3">
            <DataTable
              rows={teamRows}
              rowKey={(r) => r.t}
              defaultSort="net"
              columns={[
                { key: "t", label: "Team", value: (r) => r.t, render: (r) => <TeamBadge league={l} teamId={r.t} size="sm" withName /> },
                { key: "ppg", label: "PPG", value: (r) => r.ppg, render: (r) => f1(r.ppg), align: "right" },
                { key: "opp", label: "OPP", value: (r) => r.opp, render: (r) => f1(r.opp), align: "right" },
                { key: "net", label: "NET", value: (r) => r.ppg - r.opp, render: (r) => f1(r.ppg - r.opp), align: "right" },
                { key: "fg", label: "FG%", value: (r) => r.fg, render: (r) => pct(r.fg), align: "right" },
                { key: "3pa", label: "3PA", value: (r) => r.fg3a, render: (r) => f1(r.fg3a), align: "right" },
                { key: "3p", label: "3P%", value: (r) => r.fg3, render: (r) => pct(r.fg3), align: "right" },
                { key: "ft", label: "FT%", value: (r) => r.ft, render: (r) => pct(r.ft), align: "right" },
                { key: "reb", label: "REB", value: (r) => r.reb, render: (r) => f1(r.reb), align: "right" },
                { key: "ast", label: "AST", value: (r) => r.ast, render: (r) => f1(r.ast), align: "right" },
                { key: "stl", label: "STL", value: (r) => r.stl, render: (r) => f1(r.stl), align: "right" },
                { key: "blk", label: "BLK", value: (r) => r.blk, render: (r) => f1(r.blk), align: "right" },
                { key: "tov", label: "TOV", value: (r) => r.tov, render: (r) => f1(r.tov), align: "right" },
              ]}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
