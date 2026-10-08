"use client";
import { useState } from "react";
import { useLeague } from "@/lib/store";
import { Card, Empty, PageHeader, PlayerLink, Tabs, TeamBadge } from "@/components/ui";
import { fmtDate } from "@/engine/util/dates";

export default function HistoryPage() {
  const l = useLeague();
  const [tab, setTab] = useState<"champs" | "records" | "hof" | "jerseys">("champs");
  const seasons = [...l.history].reverse().filter((h) => h.champion || h.awards.length);
  const hof = Object.values(l.players).filter((p) => p.hallOfFame);
  return (
    <div className="space-y-4">
      <PageHeader title="League History" sub="Everything that has happened in this save" />
      <Tabs tabs={[{ id: "champs", label: "Champions & MVPs" }, { id: "records", label: "Records" }, { id: "hof", label: `Hall of Fame (${hof.length})` }, { id: "jerseys", label: "Retired numbers" }]} value={tab} onChange={setTab} />
      {tab === "champs" && (
        seasons.length === 0 ? <Empty>Finish a season to start writing history.</Empty> : (
          <Card pad={false}>
            <div className="overflow-x-auto scroll-thin">
              <table className="k-table min-w-[760px]">
                <thead><tr>{["Season", "Champion", "Runner-up", "Finals MVP", "MVP", "DPOY", "ROY", "NBA Cup", "#1 pick"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {seasons.map((h) => {
                    const a = (k: string) => h.awards.find((x) => x.award === k);
                    const pl = (k: string) => { const x = a(k); return x?.playerId && l.players[x.playerId] ? <PlayerLink player={l.players[x.playerId]} /> : x?.name ?? "-"; };
                    return (
                      <tr key={h.season}>
                        <td>{h.season}</td>
                        <td>{h.champion ? <TeamBadge league={l} teamId={h.champion} size="sm" withName /> : "-"}</td>
                        <td>{h.runnerUp ? <TeamBadge league={l} teamId={h.runnerUp} size="sm" /> : "-"}</td>
                        <td>{h.finalsMvp && l.players[h.finalsMvp] ? <PlayerLink player={l.players[h.finalsMvp]} /> : "-"}</td>
                        <td>{pl("MVP")}</td>
                        <td>{pl("DPOY")}</td>
                        <td>{pl("ROY")}</td>
                        <td>{h.cupChampion ? <TeamBadge league={l} teamId={h.cupChampion} size="sm" /> : "-"}</td>
                        <td>{h.draftTop?.[0] ? <span>{h.draftTop[0].name} <span className="text-dim">({h.draftTop[0].teamId})</span></span> : "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}
      {tab === "records" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Single game (this save)">
            {l.records.singleGame.length === 0 ? <Empty>No games played yet.</Empty> : (
              <ul className="space-y-2 text-sm">{l.records.singleGame.map((r) => <li key={r.stat} className="flex justify-between gap-2"><span className="text-dim">{r.stat}</span><span><b className="font-num text-[15px]">{r.value}</b> · {l.players[r.playerId] ? <PlayerLink player={l.players[r.playerId]} /> : r.name} <span className="text-xs text-mute">vs {r.opp}, {fmtDate(r.date)}</span></span></li>)}</ul>
            )}
          </Card>
          <Card title="Single season (this save)">
            {l.records.singleSeason.length === 0 ? <Empty>Finish a season to set records.</Empty> : (
              <ul className="space-y-2 text-sm">{l.records.singleSeason.map((r) => <li key={r.stat} className="flex justify-between gap-2"><span className="text-dim">{r.stat}</span><span><b className="font-num text-[15px]">{r.value}</b> · {l.players[r.playerId] ? <PlayerLink player={l.players[r.playerId]} /> : r.name} <span className="text-xs text-mute">{r.season}</span></span></li>)}</ul>
            )}
          </Card>
        </div>
      )}
      {tab === "hof" && (
        <Card title="Hall of Fame">
          {hof.length === 0 ? <Empty>Legends are inducted when they retire with a Hall of Fame résumé.</Empty> : (
            <ul className="space-y-2 text-sm">{hof.map((p) => <li key={p.id}><PlayerLink player={p} /> <span className="text-xs text-dim">, retired {p.retiredSeason}. {p.legacy}</span></li>)}</ul>
          )}
        </Card>
      )}
      {tab === "jerseys" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.values(l.teams).filter((t) => t.retiredNumbers.length).map((t) => (
            <Card key={t.id} title={<TeamBadge league={l} teamId={t.id} size="sm" withName />}>
              <ul className="text-sm">{t.retiredNumbers.map((r) => <li key={r.number + r.playerName}><b className="font-num text-[17px]">#{r.number}</b> {r.playerName} <span className="text-xs text-mute">({r.season})</span></li>)}</ul>
            </Card>
          ))}
          {!Object.values(l.teams).some((t) => t.retiredNumbers.length) && <Empty>No numbers retired in this save yet.</Empty>}
        </div>
      )}
    </div>
  );
}
