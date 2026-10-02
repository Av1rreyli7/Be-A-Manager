"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import clsx from "clsx";
import { BarChart, Bar as RBar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, CartesianGrid } from "recharts";
import { useChartColors } from "@/lib/useChartColors";
import { useGame, useLeague, useTeamId, isMine } from "@/lib/store";
import { Button, Card, PageHeader, PlayerLink, Stat, TeamBadge } from "@/components/ui";
import { capItems, capStatus, cbaFor, projection } from "@/engine/cap/payroll";
import { signingMethods } from "@/engine/cap/contracts";
import { money, STATUS_COLOR, STATUS_LABEL } from "@/lib/format";
import { nextSeason } from "@/engine/util/dates";
import { renounceRights } from "@/engine/offseason/freeAgency";

function CapSheet() {
  const l = useLeague();
  const C = useChartColors();
  const me = useTeamId();
  const params = useSearchParams();
  const [team, setTeam] = useState(params.get("team") ?? me);
  const mutate = useGame((s) => s.mutate);
  const t = l.teams[team];
  const st = capStatus(l, team);
  const seasons: string[] = [];
  let s = l.season;
  for (let i = 0; i < 5; i++) {
    seasons.push(s);
    s = nextSeason(s);
  }
  const proj = projection(l, team, 5);
  // one row per contract
  const rows = Object.values(l.contracts)
    .filter((c) => c.teamId === team && c.years.some((y) => seasons.includes(y.season)))
    .filter((c) => c.deadMoney || !c.playerId || (l.players[c.playerId]?.teamId === team && l.players[c.playerId]?.status === "active"))
    .sort((a, b) => (b.years.find((y) => y.season === l.season)?.salary ?? 0) - (a.years.find((y) => y.season === l.season)?.salary ?? 0));
  const holds = capItems(l, team).filter((i) => i.kind === "hold" || i.kind === "rookie-hold" || i.kind === "roster-charge");
  const fakeFA = Object.values(l.players).find((p) => p.status === "fa") ?? Object.values(l.players)[0];
  const methods = fakeFA ? signingMethods(l, team, { ...fakeFA, experience: 5, lastSeasonSalary: 0 }).filter((m) => !["bird", "early-bird", "non-bird"].includes(m.id)) : [];
  const cba = cbaFor(l, l.season);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cap Sheet"
        sub={<span className="flex items-center gap-2"><TeamBadge league={l} teamId={team} size="sm" withName /> · {l.season} {cba.status === "projected" ? "(projected figures)" : "(official figures)"}</span>}
        right={<select className="rounded-[4px] border border-line-2 bg-panel px-2 py-1 text-sm" value={team} onChange={(e) => setTeam(e.target.value)}>{Object.values(l.teams).sort((a, b) => a.fullName.localeCompare(b.fullName)).map((x) => <option key={x.id} value={x.id}>{x.fullName}</option>)}</select>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><Stat label="Team salary" value={money(st.salary, 2)} sub={<span className={STATUS_COLOR[st.status]}>{STATUS_LABEL[st.status]}</span>} /></Card>
        <Card><Stat label={st.room > 0 ? "Cap room" : "Over the cap by"} value={money(st.room > 0 ? st.room : st.salary - st.cap, 2)} sub={`Cap ${money(st.cap, 3)}`} /></Card>
        <Card><Stat label="Luxury tax" value={money(st.taxBill, 2)} tone={st.taxBill ? "warn" : undefined} sub={`${st.repeater ? "Repeater" : "Standard"} rates · line ${money(st.tax, 3)}`} /></Card>
        <Card><Stat label="Aprons" value={<span className="text-base">1st {money(st.firstApron - st.taxSalary)} · 2nd {money(st.secondApron - st.taxSalary)}</span>} sub={t.hardCap ? `Hard-capped at the ${t.hardCap} apron` : "No hard cap"} tone={st.taxSalary > st.firstApron ? "bad" : undefined} /></Card>
      </div>

      <Card title="Five-year projection">
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={proj.map((p) => ({ season: p.season, salary: Math.round(p.committed / 1e5) / 10, cap: p.cap / 1e6, tax: p.tax / 1e6, apron1: p.firstApron / 1e6, apron2: p.secondApron / 1e6 }))}>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="season" stroke={C.axis} tick={{ fill: C.axis }} fontSize={11} />
              <YAxis stroke={C.axis} tick={{ fill: C.axis }} fontSize={11} unit="M" width={48} />
              <Tooltip contentStyle={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, color: C.ink }} cursor={{ fill: C.grid, opacity: 0.4 }} formatter={(v) => `$${v}M`} />
              <RBar dataKey="salary" fill={C.accent} fillOpacity={0.82} />
              <ReferenceLine y={proj[0].cap / 1e6} stroke={C.good} strokeDasharray="4 3" label={{ value: "Cap", fill: C.good, fontSize: 10, position: "insideTopLeft" }} />
              <ReferenceLine y={proj[0].tax / 1e6} stroke={C.warn} strokeDasharray="4 3" label={{ value: "Tax", fill: C.warn, fontSize: 10, position: "insideTopLeft" }} />
              <ReferenceLine y={proj[0].firstApron / 1e6} stroke={C.warn} strokeDasharray="4 3" label={{ value: "1st apron", fill: C.warn, fontSize: 10, position: "insideTopLeft" }} />
              <ReferenceLine y={proj[0].secondApron / 1e6} stroke={C.bad} strokeDasharray="4 3" label={{ value: "2nd apron", fill: C.bad, fontSize: 10, position: "insideTopLeft" }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-mute">Committed salary only (no future signings); future thresholds projected at {(l.cba.capGrowthProjection.value * 100).toFixed(0)}% cap growth.</p>
      </Card>

      <Card title="Contracts" pad={false}>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[840px] text-sm">
            <thead className="label">
              <tr>
                <th className="px-3 py-2 text-left">Player</th>
                <th className="px-2 text-left">Type</th>
                {seasons.map((x) => <th key={x} className="px-2 text-right">{x}</th>)}
                <th className="px-3 text-right">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className={clsx("border-t border-line/50", c.deadMoney && "text-dim")}>
                  <td className="px-3 py-1.5">{c.playerId && l.players[c.playerId] && !c.deadMoney ? <PlayerLink player={l.players[c.playerId]} /> : <span>{c.playerName}</span>}{c.deadMoney && <span className="chip ml-2">dead</span>}{c.noTradeClause && <span className="chip ml-1">NTC</span>}{c.tradeKicker && <span className="chip ml-1">TK {c.tradeKicker.pct}%</span>}</td>
                  <td className="px-2 text-xs text-dim">{c.type}</td>
                  {seasons.map((x) => {
                    const y = c.years.find((z) => z.season === x);
                    return (
                      <td key={x} className={clsx("px-2 text-right num", y?.option === "player" && "bg-info/10 text-info", y?.option === "team" && "bg-good/10 text-good", y?.option === "eto" && "bg-gold/10", y && y.guaranteed < y.salary && !y.option && "text-warn")}>
                        {y ? money(y.salary, 2) : ""}
                        {y?.option && <sup className="ml-0.5 text-[9px]">{y.option === "player" ? "PO" : y.option === "team" ? "TO" : "ETO"}</sup>}
                      </td>
                    );
                  })}
                  <td className="px-3 text-right num">{money(c.years.filter((y) => seasons.includes(y.season)).reduce((a, y) => a + y.salary, 0))}</td>
                </tr>
              ))}
              {holds.map((h, i) => (
                <tr key={`h${i}`} className="border-t border-line/50 text-dim">
                  <td className="px-3 py-1.5 italic">{h.label}</td>
                  <td className="px-2 text-xs">{h.kind}</td>
                  <td className="px-2 text-right num">{money(h.amount, 2)}</td>
                  <td colSpan={5} />
                </tr>
              ))}
              <tr className="border-t-2 border-line-2 font-semibold">
                <td className="px-3 py-2" colSpan={2}>Total (cap)</td>
                {proj.map((p) => <td key={p.season} className={clsx("px-2 text-right num", STATUS_COLOR[p.status])}>{money(p.committed, 1)}</td>)}
                <td />
              </tr>
              <tr className="text-xs text-dim">
                <td className="px-3 py-1" colSpan={2}>Projected tax</td>
                {proj.map((p) => <td key={p.season} className="px-2 text-right num">{p.taxBill ? money(p.taxBill) : "-"}</td>)}
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-3 border-t border-line px-3 py-2 text-xs text-dim">
          <span><span className="inline-block h-2 w-2 rounded-sm bg-info/40" /> Player option</span>
          <span><span className="inline-block h-2 w-2 rounded-sm bg-good/40" /> Team option</span>
          <span className="text-warn">Non/partially guaranteed</span>
          <span>≈ future salaries published to $0.1M</span>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Exceptions available">
          <ul className="space-y-1.5 text-sm">
            {methods.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <span className={m.available ? "" : "text-mute line-through"}>{m.label}</span>
                <span className="text-right text-xs text-dim">{m.available ? `${money(m.maxFirstYear, 2)} · ${m.maxYears} yrs${m.hardCap ? ` · hard-caps at ${m.hardCap} apron` : ""}` : m.reason}</span>
              </li>
            ))}
          </ul>
          {t.exceptions.tpes.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-[11px] font-bold uppercase text-mute">Traded player exceptions</div>
              {t.exceptions.tpes.map((x) => <div key={x.id} className="flex justify-between text-sm"><span>{money(x.amount, 2)} <span className="text-xs text-dim">({x.fromPlayer})</span></span><span className="text-xs text-dim">expires {x.expires}</span></div>)}
            </div>
          )}
          <p className="mt-3 text-xs text-mute">Cash sent this season: {money(t.cashSent)} / {money(cba.exceptions.tradeCashLimit.value)} · received {money(t.cashReceived)}</p>
        </Card>
        <Card title="Rights & cap holds">
          {t.rights.length === 0 ? (
            <p className="text-sm text-dim">Cap holds appear when free agency opens for your own free agents.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {t.rights.map((r) => {
                const p = l.players[r.playerId];
                return (
                  <li key={r.playerId} className="flex items-center justify-between gap-2">
                    <span>{p ? <PlayerLink player={p} /> : r.playerId} <span className="chip">{r.type}</span>{p?.rfaTeam === team && <span className="chip ml-1">RFA · QO {money(p.qualifyingOffer ?? 0)}</span>}</span>
                    <span className="flex items-center gap-2">
                      <span className={clsx("num", r.renounced && "line-through text-mute")}>{money(r.capHold, 2)}</span>
                      {!r.renounced && isMine(l, team) && p?.status === "fa" && <Button size="sm" variant="ghost" onClick={() => mutate((lg) => renounceRights(lg, team, r.playerId))}>Renounce</Button>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-mute">Renouncing removes the cap hold (creating room) but gives up Bird rights.</p>
        </Card>
      </div>
    </div>
  );
}

export default function CapPage() {
  return (
    <Suspense>
      <CapSheet />
    </Suspense>
  );
}
