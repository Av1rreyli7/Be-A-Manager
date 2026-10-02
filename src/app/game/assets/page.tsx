"use client";
import { useLeague, useTeamId } from "@/lib/store";
import { Card, OvrPot, PageHeader, PlayerLink, Stat } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { contractOf, salaryIn, seasonAge, teamPlayers } from "@/engine/league/helpers";
import { marketSalary, pickValue, playerValue } from "@/engine/trade/value";
import { money } from "@/lib/format";
import { PickList } from "@/components/PickList";
import { cbaFor } from "@/engine/cap/payroll";

export default function AssetsPage() {
  const l = useLeague();
  const me = useTeamId();
  const ps = teamPlayers(l, me);
  const cba = cbaFor(l, l.season);
  const picks = Object.values(l.picks).filter((k) => k.owner === me);
  const pv = ps.reduce((s, p) => s + Math.max(0, playerValue(l, p, me)), 0);
  const kv = picks.reduce((s, k) => s + pickValue(l, k, me), 0);
  return (
    <div className="space-y-4">
      <PageHeader title="My Assets" sub="Everything you can trade, valued the way your front office sees it (strategy-adjusted)." />
      <div className="grid gap-4 sm:grid-cols-4">
        <Card><Stat label="Player value" value={pv.toFixed(0)} /></Card>
        <Card><Stat label="Pick value" value={kv.toFixed(0)} sub={`${picks.filter((k) => k.round === 1).length} firsts · ${picks.filter((k) => k.round === 2).length} seconds`} /></Card>
        <Card><Stat label="Trade exceptions" value={l.teams[me].exceptions.tpes.length} sub={l.teams[me].exceptions.tpes.map((t) => money(t.amount)).join(", ") || "None"} /></Card>
        <Card><Stat label="Strategy" value={<span className="capitalize">{l.teams[me].strategy.mode}</span>} /></Card>
      </div>
      <Card title="Players" pad={false}>
        <div className="p-3">
          <DataTable
            rows={ps}
            rowKey={(p) => p.id}
            defaultSort="val"
            columns={[
              { key: "n", label: "Player", value: (p) => p.lastName, render: (p) => <PlayerLink player={p} /> },
              { key: "age", label: "Age", value: (p) => seasonAge(p, l.season), align: "right" },
              { key: "ovr", label: "OVR/POT", value: (p) => p.ovr, render: (p) => <OvrPot p={p} /> },
              { key: "sal", label: "Salary", value: (p) => salaryIn(contractOf(l, p), l.season), render: (p) => money(salaryIn(contractOf(l, p), l.season)), align: "right" },
              { key: "yrs", label: "Yrs", value: (p) => contractOf(l, p)?.years.filter((y) => y.season >= l.season).length ?? 0, align: "right" },
              { key: "mkt", label: "Market value", value: (p) => marketSalary(p.ovr, seasonAge(p, l.season), p.pot, cba, p.experience), render: (p) => money(marketSalary(p.ovr, seasonAge(p, l.season), p.pot, cba, p.experience)), align: "right" },
              { key: "surplus", label: "Surplus/yr", value: (p) => marketSalary(p.ovr, seasonAge(p, l.season), p.pot, cba, p.experience) - salaryIn(contractOf(l, p), l.season), render: (p) => { const v = marketSalary(p.ovr, seasonAge(p, l.season), p.pot, cba, p.experience) - salaryIn(contractOf(l, p), l.season); return <span className={v >= 0 ? "text-good" : "text-bad"}>{money(v)}</span>; }, align: "right" },
              { key: "val", label: "Trade value", value: (p) => playerValue(l, p, me), render: (p) => <b>{playerValue(l, p, me).toFixed(1)}</b>, align: "right" },
            ]}
          />
        </div>
      </Card>
      <Card title="Draft picks: owned & owed">
        <PickList teamId={me} />
      </Card>
    </div>
  );
}
