"use client";
import { useState } from "react";
import clsx from "clsx";
import { useLeague, useTeamId } from "@/lib/store";
import { Card, PageHeader, Tabs, TeamBadge } from "@/components/ui";
import { conferenceStandings, divisionStandings, emptyRecord, gamesBack, winPct } from "@/engine/season/standings";
import type { League, TeamId } from "@/engine/types/game";

function Table({ l, ids, me, seeds }: { l: League; ids: TeamId[]; me: TeamId; seeds?: boolean }) {
  const lead = l.standings[ids[0]] ?? emptyRecord(ids[0]);
  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="k-table min-w-[720px]">
        <thead>
          <tr>{["#", "Team", "W", "L", "PCT", "GB", "Home", "Away", "Conf", "Div", "PPG", "OPP", "Diff", "Strk", "L10"].map((h) => <th key={h} className={clsx(h !== "Team" && "k-num")}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {ids.map((id, i) => {
            const r = l.standings[id] ?? emptyRecord(id);
            const g = Math.max(1, r.w + r.l);
            return (
              <tr key={id} className={clsx(id === me && "me")}>
                <td className={clsx("k-num", seeds ? (i < 6 ? "text-ink" : i < 10 ? "text-warn" : "text-mute") : "text-mute")} style={seeds && i < 10 ? { boxShadow: `inset 3px 0 0 ${i < 6 ? "var(--color-good)" : "var(--color-warn)"}` } : undefined}>{i + 1}</td>
                <td><TeamBadge league={l} teamId={id} size="sm" withName /></td>
                <td className="k-num font-bold">{r.w}</td>
                <td className="k-num font-bold">{r.l}</td>
                <td className="k-num">{winPct(r).toFixed(3).replace(/^0/, "")}</td>
                <td className="k-num">{i === 0 ? "-" : gamesBack(lead, r).toFixed(1)}</td>
                <td className="k-num">{r.homeW}-{r.homeL}</td>
                <td className="k-num">{r.awayW}-{r.awayL}</td>
                <td className="k-num">{r.confW}-{r.confL}</td>
                <td className="k-num">{r.divW}-{r.divL}</td>
                <td className="k-num">{(r.pf / g).toFixed(1)}</td>
                <td className="k-num">{(r.pa / g).toFixed(1)}</td>
                <td className={clsx("k-num", r.pf - r.pa > 0 ? "text-good" : r.pf - r.pa < 0 ? "text-bad" : "")}>{((r.pf - r.pa) / g).toFixed(1)}</td>
                <td className="k-num">{r.streak > 0 ? `W${r.streak}` : r.streak < 0 ? `L${-r.streak}` : "-"}</td>
                <td className="k-num">{r.last10.filter((x) => x === "W").length}-{r.last10.filter((x) => x === "L").length}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function StandingsPage() {
  const l = useLeague();
  const me = useTeamId();
  const [view, setView] = useState<"conf" | "div" | "league">("conf");
  const divisions = [...new Set(Object.values(l.teams).map((t) => t.division))].sort();
  const leagueIds = [...conferenceStandings(l, "East"), ...conferenceStandings(l, "West")].sort((a, b) => winPct(l.standings[b] ?? emptyRecord(b)) - winPct(l.standings[a] ?? emptyRecord(a)));
  return (
    <div className="space-y-4">
      <PageHeader title="Standings" sub={<span className="flex flex-wrap items-center gap-x-4 gap-y-1">Official NBA tiebreakers applied<span className="flex items-center gap-1.5"><span className="h-3 w-[3px] bg-good" />Seeds 1-6 playoffs</span><span className="flex items-center gap-1.5"><span className="h-3 w-[3px] bg-warn" />7-10 Play-In</span></span>} />
      <Tabs tabs={[{ id: "conf", label: "Conference" }, { id: "div", label: "Division" }, { id: "league", label: "League" }]} value={view} onChange={setView} />
      {view === "conf" && (["East", "West"] as const).map((c) => <Card key={c} title={`${c}ern Conference`} pad={false}><Table l={l} ids={conferenceStandings(l, c)} me={me} seeds /></Card>)}
      {view === "div" && <div className="grid gap-4 xl:grid-cols-2">{divisions.map((d) => <Card key={d} title={d} pad={false}><Table l={l} ids={divisionStandings(l, d)} me={me} /></Card>)}</div>}
      {view === "league" && <Card title="League" pad={false}><Table l={l} ids={leagueIds} me={me} /></Card>}
    </div>
  );
}
