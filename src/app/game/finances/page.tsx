"use client";
import { BarChart, Bar as RBar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { useChartColors } from "@/lib/useChartColors";
import { useGame, useLeague, useTeamId } from "@/lib/store";
import { Bar, Card, Field, PageHeader, Stat } from "@/components/ui";
import { capStatus } from "@/engine/cap/payroll";
import { money } from "@/lib/format";

export default function FinancesPage() {
  const l = useLeague();
  const C = useChartColors();
  const me = useTeamId();
  const mutate = useGame((s) => s.mutate);
  const t = l.teams[me];
  const f = t.finances;
  const cap = capStatus(l, me);
  const avgAtt = f.attendance.length ? f.attendance.reduce((a, b) => a + b, 0) / f.attendance.length : 0;
  const base = 60 + t.market * 22;
  return (
    <div className="space-y-4">
      <PageHeader title="Finances & Owner" sub={`Market size ${t.market}/5 · arena capacity ${t.arenaCapacity.toLocaleString()}`} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card><Stat label="Revenue (season)" value={money(f.revenue)} /></Card>
        <Card><Stat label="Expenses (season)" value={money(f.expenses)} sub="payroll, ops & tax" /></Card>
        <Card><Stat label="Profit" value={money(f.revenue - f.expenses)} tone={f.revenue - f.expenses >= 0 ? "good" : "bad"} /></Card>
        <Card><Stat label="Cash" value={money(f.cash)} /></Card>
        <Card><Stat label="Attendance" value={avgAtt ? Math.round(avgAtt).toLocaleString() : "-"} sub={avgAtt ? `${((avgAtt / t.arenaCapacity) * 100).toFixed(0)}% capacity` : "no home games yet"} /></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Ticket pricing">
          <Field label={`Average ticket $${f.ticketPrice} (market baseline $${base})`}>
            <input type="range" min={Math.round(base * 0.5)} max={Math.round(base * 2)} value={f.ticketPrice} className="w-full" onChange={(e) => mutate(() => void (t.finances.ticketPrice = Number(e.target.value)))} />
          </Field>
          <p className="mt-2 text-xs text-dim">Higher prices raise gate revenue per fan but lower attendance; hype and winning offset price.</p>
          <div className="mt-4">
            <div className="mb-1 label">Fan hype</div>
            <Bar value={t.hype} color="bg-accent" />
          </div>
        </Card>
        <Card title="Owner">
          <div className="mb-2 label">Job security</div>
          <Bar value={t.owner.jobSecurity} color={t.owner.jobSecurity > 60 ? "bg-good" : t.owner.jobSecurity > 30 ? "bg-warn" : "bg-bad"} />
          <p className="mt-1 text-sm">{t.owner.jobSecurity}/100 · patience {t.owner.patience}/100</p>
          <div className="mt-3 label">Goals this season</div>
          <ul className="mt-1 list-disc pl-5 text-sm text-dim">
            {t.owner.goals.map((g, i) => <li key={i}>{g.type === "win" ? `Win ${g.target}+ games` : g.type === "playoffs" ? `Reach round ${g.target} of the playoffs` : g.type === "develop" ? `Develop ${g.target} young players into rotation pieces` : "Turn a profit"}</li>)}
            {!t.owner.goals.length && <li>Goals are set on opening night.</li>}
          </ul>
          <p className="mt-3 text-xs text-dim">Luxury tax projected: {money(cap.taxBill)}{cap.repeater ? " (repeater)" : ""}</p>
        </Card>
      </div>
      {f.history.length > 0 && (
        <Card title="Past seasons">
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={f.history.map((h) => ({ season: h.season, revenue: h.revenue / 1e6, expenses: h.expenses / 1e6, tax: h.tax / 1e6 }))}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="season" stroke={C.axis} tick={{ fill: C.axis }} fontSize={11} />
                <YAxis stroke={C.axis} tick={{ fill: C.axis }} fontSize={11} unit="M" width={48} />
                <Tooltip contentStyle={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, color: C.ink }} cursor={{ fill: C.grid, opacity: 0.4 }} formatter={(v) => `$${Number(v).toFixed(1)}M`} />
                <Legend />
                <RBar dataKey="revenue" fill={C.good} />
                <RBar dataKey="expenses" fill={C.accent} />
                <RBar dataKey="tax" fill={C.bad} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}
