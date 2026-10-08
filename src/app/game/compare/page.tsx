"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Legend } from "recharts";
import { useChartColors } from "@/lib/useChartColors";
import { useLeague } from "@/lib/store";
import { Card, OvrPot, PageHeader, PlayerLink, inputCls, Empty } from "@/components/ui";
import { perGame, seasonTotal } from "@/engine/season/stats";
import { contractOf, salaryIn, seasonAge } from "@/engine/league/helpers";
import { f1, money, pct } from "@/lib/format";
import type { Player } from "@/engine/types/game";


function Picker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const l = useLeague();
  const [q, setQ] = useState("");
  const hits = q.length >= 2 ? Object.values(l.players).filter((p) => p.status !== "prospect" && p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];
  return (
    <div className="relative">
      <input className={inputCls} placeholder={value ? l.players[value]?.name : "Search player…"} value={q} onChange={(e) => setQ(e.target.value)} />
      {hits.length > 0 && (
        <div className="absolute z-10 mt-1 w-full">
          <ul className="k-panel k-flush k-nocut">
            {hits.map((p) => <li key={p.id}><button className="w-full px-3 py-1.5 text-left text-sm hover:bg-ink/5" onClick={() => (onChange(p.id), setQ(""))}>{p.name} <span className="text-dim">{p.teamId ?? "FA"}</span></button></li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function Compare() {
  const l = useLeague();
  const C = useChartColors();
  const params = useSearchParams();
  const [ids, setIds] = useState<string[]>([params.get("a") ?? "", params.get("b") ?? "", ""]);
  const ps = ids.map((id) => l.players[id]).filter(Boolean) as Player[];
  const axes = [["Shooting", (p: Player) => (p.ratings.threePoint + p.ratings.midRange + p.ratings.freeThrow) / 3], ["Finishing", (p: Player) => (p.ratings.layup + p.ratings.closeShot + p.ratings.drivingDunk) / 3], ["Playmaking", (p: Player) => (p.ratings.passVision + p.ratings.ballHandle + p.ratings.passIQ) / 3], ["Perimeter D", (p: Player) => (p.ratings.perimeterD + p.ratings.steal) / 2], ["Interior D", (p: Player) => (p.ratings.interiorD + p.ratings.block) / 2], ["Rebounding", (p: Player) => (p.ratings.offRebound + p.ratings.defRebound) / 2], ["Athleticism", (p: Player) => (p.ratings.speed + p.ratings.vertical + p.ratings.strength) / 3]] as const;
  const data = axes.map(([name, f]) => Object.fromEntries([["axis", name], ...ps.map((p) => [p.name, Math.round(f(p))])]));
  const row = (label: string, f: (p: Player) => React.ReactNode) => (
    <tr><td className="text-dim">{label}</td>{ps.map((p) => <td key={p.id} className="k-num">{f(p)}</td>)}</tr>
  );
  return (
    <div className="space-y-4">
      <PageHeader title="Compare Players" />
      <div className="grid gap-3 sm:grid-cols-3">{ids.map((id, i) => <Picker key={i} value={id} onChange={(v) => setIds((x) => x.map((y, j) => (j === i ? v : y)))} />)}</div>
      {ps.length < 2 && <Empty>Search for {ps.length ? "one more player" : "two or three players"} above to see them side by side.</Empty>}
      {ps.length >= 2 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Skill profile">
            <div className="h-80">
              <ResponsiveContainer>
                <RadarChart data={data}>
                  <PolarGrid stroke={C.border} />
                  <PolarAngleAxis dataKey="axis" tick={{ fill: C.dim, fontSize: 11 }} />
                  {ps.map((p, i) => <Radar key={p.id} name={p.name} dataKey={p.name} stroke={C.series[i]} fill={C.series[i]} fillOpacity={0.15} />)}
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Side by side">
            <table className="k-table">
              <thead><tr><th />{ps.map((p, i) => <th key={p.id} className="k-num" style={{ color: C.series[i] }}><PlayerLink player={p} /></th>)}</tr></thead>
              <tbody>
                {row("OVR / POT", (p) => <OvrPot p={p} />)}
                {row("Age", (p) => seasonAge(p, l.season))}
                {row("Position", (p) => p.pos)}
                {row("Salary", (p) => money(salaryIn(contractOf(l, p), l.season)))}
                {row("PTS", (p) => f1(perGame(seasonTotal(l, p.id)).pts))}
                {row("REB", (p) => f1(perGame(seasonTotal(l, p.id)).reb))}
                {row("AST", (p) => f1(perGame(seasonTotal(l, p.id)).ast))}
                {row("TS%", (p) => pct(perGame(seasonTotal(l, p.id)).ts))}
                {row("Last real season PTS", (p) => (p.realStats[0] ? f1(p.realStats[0].pts / Math.max(1, p.realStats[0].gp)) : "-"))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense>
      <Compare />
    </Suspense>
  );
}
