"use client";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useChartColors } from "@/lib/useChartColors";
import { useGame, useLeague, useTeamId, isMine } from "@/lib/store";
import { Bar, Button, Card, Empty, Field, inputCls, Rating, Tabs, TeamBadge } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { contractOf, seasonAge } from "@/engine/league/helpers";
import { perGame } from "@/engine/season/stats";
import { advancedFor, leagueBaselines } from "@/engine/stats/advanced";
import { f1, height, money, pct, ratingColor, ratingFill } from "@/lib/format";
import { TRAITS } from "@/engine/ratings/ratings";
import { PlayerActions } from "@/components/PlayerActions";
import { extensionInfoFor } from "@/engine/offseason/extensions";
import { playerValue } from "@/engine/trade/value";
import { ovrFromAttributes } from "@/engine/ratings/ratings";
import { ATTRIBUTE_KEYS, type AttributeKey, type StatLine } from "@/engine/types/game";
import { scoutedRatings } from "@/engine/offseason/draft";
import { fmtDate } from "@/engine/util/dates";

const GROUPS: { name: string; keys: AttributeKey[] }[] = [
  { name: "Scoring", keys: ["closeShot", "midRange", "threePoint", "freeThrow", "layup", "standingDunk", "drivingDunk", "postHook", "postFade", "postControl", "drawFoul", "shotIQ"] },
  { name: "Playmaking", keys: ["passAccuracy", "passVision", "passIQ", "ballHandle", "speedWithBall"] },
  { name: "Defense & Boards", keys: ["interiorD", "perimeterD", "steal", "block", "helpDefIQ", "passPerception", "offRebound", "defRebound"] },
  { name: "Physical & Mental", keys: ["speed", "acceleration", "strength", "vertical", "stamina", "durability", "hustle", "offConsistency", "defConsistency", "clutch"] },
];
const label = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

export default function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  const l = useLeague();
  const C = useChartColors();
  const myTeam = useTeamId();
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "stats" | "log" | "edit">("overview");
  const p = l.players[decodeURIComponent(id)];
  if (!p) return <Empty>No such player.</Empty>;
  const c = contractOf(l, p);
  const prospect = p.status === "prospect";
  const scout = prospect ? scoutedRatings(p) : null;
  const age = seasonAge(p, l.season);
  const tc = p.teamId ? l.teams[p.teamId]?.colors ?? { primary: "#3a4150", secondary: "#1b1f27" } : { primary: "#3a4150", secondary: "#1b1f27" };
  const base = leagueBaselines(l);
  const ext = extensionInfoFor(l, p.id);
  const mine = p.teamId && isMine(l, p.teamId);
  const statRows = [...p.stats].sort((a, b) => (a.season < b.season ? 1 : -1));
  const log = [...(l.gameLog[p.id] ?? [])].reverse();

  return (
    <div className="space-y-4">
      <section className="panel relative overflow-hidden">
        <div aria-hidden className="hero-wash absolute inset-0" style={{ ["--tc-team" as string]: tc.primary }} />
        <div aria-hidden className="stripes absolute inset-0 [mask-image:linear-gradient(90deg,black,transparent_65%)]" />
        <span aria-hidden className="pointer-events-none absolute -bottom-10 right-2 select-none font-num text-[150px] font-black leading-none text-white/[0.07] sm:text-[210px]">{p.jersey ?? p.pos}</span>
        <div className="relative grid gap-5 p-4 sm:p-6 md:grid-cols-[auto_1fr] md:items-end">
          <div className="flex items-end gap-3">
            <div className="flex flex-col items-center gap-1">
              <Rating value={scout ? scout.ovr : p.ovr} size="xl" title="Overall" />
              <span className="label !text-white/70">Overall</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Rating value={scout ? scout.pot : p.pot} size="md" className="opacity-80" title="Potential" />
              <span className="label !text-white/70">Pot</span>
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white/75">{p.firstName}</div>
            <h1 className="font-display text-[34px] font-black uppercase leading-[0.85] tracking-[0.005em] text-white sm:text-[54px]">{p.lastName}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-white/80">
              {p.teamId ? <TeamBadge league={l} teamId={p.teamId} size="sm" withName /> : <span className="chip !bg-black/30 !text-white/85">{p.status === "prospect" ? "Draft prospect" : p.status === "retired" ? `Retired ${p.retiredSeason ?? ""}` : "Free agent"}</span>}
              <span className="font-num text-[15px] font-extrabold">{p.pos}{p.jersey ? ` #${p.jersey}` : ""}</span>
              <span>{height(p.heightIn)}</span>
              <span>{p.weightLb} lb</span>
              <span>Age {age}</span>
              {p.injury && <span className="rounded-[2px] bg-bad px-1.5 py-0.5 text-[11px] font-bold text-bg">{p.injury.type}: {p.injury.daysOut}d</span>}
            </div>
          </div>
        </div>
        <div className="relative flex flex-wrap gap-2 border-t border-white/10 bg-bg/75 px-4 py-3 sm:px-6">
  
              {mine && <PlayerActions p={p} />}
              {mine && <Button size="sm" onClick={() => router.push(`/game/finder?player=${p.id}`)}>Find offers</Button>}
              {p.teamId && !mine && <Button size="sm" variant="primary" onClick={() => router.push(`/game/finder?target=${p.id}`)}>What would it take?</Button>}
              {p.teamId && <Button size="sm" onClick={() => router.push(`/game/trade?${mine ? "mine" : "theirs"}=${p.id}`)}>Open in Trade Machine</Button>}
              {p.status === "fa" && <Button size="sm" variant="primary" onClick={() => router.push(`/game/free-agency?player=${p.id}`)}>Make offer</Button>}
              <Button size="sm" variant="ghost" onClick={() => router.push(`/game/compare?a=${p.id}`)}>Compare</Button>
          </div>
      </section>
      <Tabs tabs={[{ id: "overview", label: "Overview" }, { id: "stats", label: "Stats" }, { id: "log", label: "Game log" }, ...(l.settings.commissioner ? [{ id: "edit" as const, label: "Commissioner edit" }] : [])]} value={tab} onChange={setTab} />

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Profile">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <dt className="text-dim">Born</dt><dd>{fmtDate(p.dob, { year: "numeric", month: "short", day: "numeric" })}</dd>
              <dt className="text-dim">From</dt><dd>{p.college ?? "-"}</dd>
              <dt className="text-dim">Country</dt><dd>{p.born.country ?? "-"}</dd>
              <dt className="text-dim">Draft</dt><dd>{p.draft ? `${p.draft.year} R${p.draft.round} #${p.draft.pick}${p.draft.teamId ? ` (${p.draft.teamId})` : ""}` : prospect ? `${l.draft?.year} prospect` : "Undrafted"}</dd>
              <dt className="text-dim">Experience</dt><dd>{p.experience} yrs</dd>
              <dt className="text-dim">Morale</dt><dd><Bar value={p.morale} color={p.morale > 60 ? "bg-good" : p.morale > 35 ? "bg-warn" : "bg-bad"} /></dd>
              <dt className="text-dim">Trade value</dt><dd className="num">{playerValue(l, p, myTeam).toFixed(1)}</dd>
              {p.injury && (<><dt className="text-bad">Injury</dt><dd className="text-bad">{p.injury.type} · {p.injury.daysOut} days</dd></>)}
            </dl>
            {scout && (
              <div className="mt-3 rounded-[4px] border border-line p-3 text-xs text-dim">
                Scouting {p.scouting?.revealed}% · OVR {scout.ovrRange[0]}-{scout.ovrRange[1]} · POT {scout.potRange[0]}-{scout.potRange[1]}
                {p.scouting?.combine && <div className="mt-1">Combine: {f1(p.scouting.combine.wingspan / 12)}ft wingspan · {p.scouting.combine.vertical}&quot; vert · {p.scouting.combine.laneAgility}s lane</div>}
              </div>
            )}
            <div className="mt-4">
              <div className="label mb-1.5">Traits</div>
              <div className="flex flex-wrap gap-1">
                {p.traits.length ? p.traits.map((t) => <span key={t} className="chip text-gold" title={TRAITS.find((x) => x.id === t)?.description}>{TRAITS.find((x) => x.id === t)?.label ?? t}</span>) : <span className="text-xs text-dim">None</span>}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              {Object.entries(p.personality).map(([k, v]) => (
                <div key={k}>
                  <div className="capitalize text-mute">{k.replace(/([A-Z])/g, " $1")}</div>
                  <Bar value={v} color="bg-accent/70" />
                </div>
              ))}
            </div>
            {p.legacy && <p className="mt-3 text-xs text-dim">Legacy: {p.legacy}</p>}
            {p.awards.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {Object.entries(p.awards.reduce((m, a) => ((m[a.award] = (m[a.award] ?? 0) + 1), m), {} as Record<string, number>)).map(([a, n]) => (
                  <span key={a} className="chip text-gold">{n > 1 ? `${n}× ` : ""}{a}</span>
                ))}
              </div>
            )}
          </Card>

          <Card title="Ratings" className="lg:col-span-2">
            {prospect ? (
              <Empty>Real ratings stay hidden until the draft. Spend scouting points and workouts on the Draft page to narrow them down.</Empty>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {GROUPS.map((g) => (
                  <div key={g.name}>
                    <div className="label mb-2 border-b border-line pb-1.5 !text-dim">{g.name}</div>
                    <div className="space-y-1">
                      {g.keys.map((k) => (
                        <div key={k} className="grid grid-cols-[1fr_auto] items-center gap-2 text-xs">
                          <div>
                            <div className="flex justify-between"><span className="text-dim">{label(k)}</span></div>
                            <Bar value={p.ratings[k]} color={ratingFill(p.ratings[k])} />
                          </div>
                          <span className={clsx("w-7 text-right font-num text-[14px] font-extrabold num", ratingColor(p.ratings[k]))}>{p.ratings[k]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Contract" className="lg:col-span-2">
            {c ? (
              <>
                <table className="w-full text-sm">
                  <thead><tr className="text-left label"><th className="py-1">Season</th><th className="text-right">Salary</th><th className="text-right">Guaranteed</th><th className="text-right">Option</th></tr></thead>
                  <tbody>
                    {c.years.map((y) => (
                      <tr key={y.season} className={y.season === l.season ? "bg-accent/10" : ""}>
                        <td className="py-1">{y.season}</td>
                        <td className="text-right num">{money(y.salary, 2)}{y.approximate ? <span className="text-mute" title="Future years published rounded-[3px] to $0.1M"> ≈</span> : null}</td>
                        <td className="text-right num">{money(y.guaranteed, 2)}</td>
                        <td className="text-right">{y.option ? <span className="chip">{y.option === "player" ? "Player" : y.option === "team" ? "Team" : "ETO"}</span> : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-2 flex flex-wrap gap-1 text-xs">
                  <span className="chip">{c.type}</span>
                  {c.signedWith && <span className="chip">via {c.signedWith}</span>}
                  {c.tradeKicker && <span className="chip">Trade kicker {c.tradeKicker.pct}%</span>}
                  {c.noTradeClause && <span className="chip text-warn">No-trade clause</span>}
                  {c.type === "two-way" && <span className="chip">{c.twoWayGames ?? 0}/{l.cba.roster.twoWayGameLimit} games</span>}
                </div>
                {c.notes.length > 0 && <p className="mt-2 text-xs text-mute">{c.notes.join(" · ")}</p>}
                {mine && ext.eligible && <Link href={`/game/contracts?player=${p.id}`} className="mt-3 inline-block text-sm text-accent">Extend / re-sign (up to {money(ext.maxFirstYear)}) →</Link>}
              </>
            ) : p.demand ? (
              <p className="text-sm">Asking about <b>{money(p.demand.salary)}</b> per year for {p.demand.years} years.</p>
            ) : (
              <Empty>No contract</Empty>
            )}
          </Card>

          <Card title="Rating history">
            {p.ratingHistory.length > 1 ? (
              <div className="h-44">
                <ResponsiveContainer>
                  <LineChart data={p.ratingHistory}>
                    <CartesianGrid stroke={C.grid} />
                    <XAxis dataKey="season" stroke={C.axis} tick={{ fill: C.axis }} fontSize={11} />
                    <YAxis domain={["dataMin - 3", "dataMax + 3"]} stroke={C.axis} tick={{ fill: C.axis }} fontSize={11} width={30} />
                    <Tooltip contentStyle={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, color: C.ink }} cursor={{ fill: C.grid, opacity: 0.4 }} />
                    <Line dataKey="ovr" stroke={C.accent} strokeWidth={2.5} dot={{ r: 3, fill: C.accent }} />
                    <Line dataKey="pot" stroke={C.dim} strokeDasharray="4 3" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-dim">Ratings history builds up each season.</p>
            )}
          </Card>
        </div>
      )}

      {tab === "stats" && (
        <div className="space-y-4">
          <Card title="Simulated seasons" pad={false}>
            <div className="p-3">
              <StatTable rows={statRows.flatMap((s) => [{ label: `${s.season} ${s.teamId}`, line: s.regular }, ...(s.playoffs.gp ? [{ label: `${s.season} ${s.teamId} (playoffs)`, line: s.playoffs }] : [])])} base={base} />
            </div>
          </Card>
          <Card title="Real NBA stats (last 3 seasons)" pad={false}>
            <div className="p-3">
              <StatTable rows={p.realStats.map((s) => ({ label: `${s.season} ${s.team}`, line: { ...s, pm: 0, dd: 0, td: 0, clutchPts: 0, clutchMin: 0, clutchPm: 0 } as StatLine }))} base={base} />
            </div>
          </Card>
        </div>
      )}

      {tab === "log" && (
        <Card title={`${l.season} game log`} pad={false}>
          <div className="p-3">
            <DataTable
              rows={log}
              rowKey={(g) => g.gameId}
              dense
              columns={[
                { key: "date", label: "Date", value: (g) => g.date, render: (g) => <Link className="hover:text-accent" href={`/game/box/${encodeURIComponent(g.gameId)}`}>{fmtDate(g.date)}</Link> },
                { key: "opp", label: "Opp", value: (g) => g.opp, render: (g) => `${g.home ? "vs" : "@"} ${g.opp}` },
                { key: "min", label: "MIN", value: (g) => g.min, align: "right" },
                { key: "pts", label: "PTS", value: (g) => g.pts, align: "right" },
                { key: "reb", label: "REB", value: (g) => g.reb, align: "right" },
                { key: "ast", label: "AST", value: (g) => g.ast, align: "right" },
                { key: "stl", label: "STL", value: (g) => g.stl, align: "right" },
                { key: "blk", label: "BLK", value: (g) => g.blk, align: "right" },
                { key: "fg", label: "FG", render: (g) => `${g.fgm}-${g.fga}`, align: "right" },
                { key: "3p", label: "3P", render: (g) => `${g.fg3m}-${g.fg3a}`, align: "right" },
                { key: "ft", label: "FT", render: (g) => `${g.ftm}-${g.fta}`, align: "right" },
                { key: "pm", label: "+/-", value: (g) => g.pm, align: "right" },
              ]}
            />
          </div>
        </Card>
      )}

      {tab === "edit" && l.settings.commissioner && <CommissionerEdit id={p.id} />}
    </div>
  );
}

function StatTable({ rows, base }: { rows: { label: string; line: StatLine }[]; base: ReturnType<typeof leagueBaselines> }) {
  return (
    <DataTable
      rows={rows}
      rowKey={(r) => r.label}
      dense
      columns={[
        { key: "s", label: "Season", render: (r) => r.label },
        { key: "gp", label: "GP", render: (r) => r.line.gp, align: "right" },
        { key: "min", label: "MIN", render: (r) => f1(perGame(r.line).min), align: "right" },
        { key: "pts", label: "PTS", render: (r) => f1(perGame(r.line).pts), align: "right" },
        { key: "reb", label: "REB", render: (r) => f1(perGame(r.line).reb), align: "right" },
        { key: "ast", label: "AST", render: (r) => f1(perGame(r.line).ast), align: "right" },
        { key: "stl", label: "STL", render: (r) => f1(perGame(r.line).stl), align: "right" },
        { key: "blk", label: "BLK", render: (r) => f1(perGame(r.line).blk), align: "right" },
        { key: "fg", label: "FG%", render: (r) => pct(perGame(r.line).fgPct), align: "right" },
        { key: "3p", label: "3P%", render: (r) => pct(perGame(r.line).fg3Pct), align: "right" },
        { key: "ft", label: "FT%", render: (r) => pct(perGame(r.line).ftPct), align: "right" },
        { key: "ts", label: "TS%", render: (r) => pct(advancedFor(r.line, base).ts), align: "right" },
        { key: "per", label: "PER*", render: (r) => f1(advancedFor(r.line, base).per), align: "right", title: "PER-style estimate" },
        { key: "bpm", label: "BPM*", render: (r) => f1(advancedFor(r.line, base).bpm), align: "right", title: "BPM-style estimate" },
        { key: "ws", label: "WS*", render: (r) => f1(advancedFor(r.line, base).ws), align: "right", title: "Win Shares-style estimate" },
      ]}
    />
  );
}

function CommissionerEdit({ id }: { id: string }) {
  const l = useLeague();
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const p = l.players[id];
  const c = contractOf(l, p);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Ratings">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ATTRIBUTE_KEYS.map((k) => (
            <Field key={k} label={label(k)}>
              <input type="number" min={25} max={99} className={inputCls} value={p.ratings[k]} onChange={(e) => mutate(() => { p.ratings[k] = Math.max(25, Math.min(99, Number(e.target.value))); p.ovr = ovrFromAttributes(p.ratings, p.pos); p.pot = Math.max(p.pot, p.ovr); })} />
            </Field>
          ))}
          <Field label="Potential">
            <input type="number" min={25} max={99} className={inputCls} value={p.pot} onChange={(e) => mutate(() => void (p.pot = Math.max(p.ovr, Math.min(99, Number(e.target.value)))))} />
          </Field>
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm">OVR (derived): <Rating value={p.ovr} /></div>
      </Card>
      <Card title="Team & contract">
        <Field label="Team">
          <select className={inputCls} value={p.teamId ?? ""} onChange={(e) => mutate((lg) => { const t = e.target.value || null; p.teamId = t; p.status = t ? "active" : "fa"; if (c) { if (t) c.teamId = t; else { delete lg.contracts[c.id]; p.contractId = null; } } toast("Team updated"); })}>
            <option value="">Free agent</option>
            {Object.values(l.teams).map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
          </select>
        </Field>
        {c && (
          <div className="mt-3 space-y-2">
            {c.years.map((y, i) => (
              <div key={y.season} className="grid grid-cols-[80px_1fr_110px] items-center gap-2 text-sm">
                <span>{y.season}</span>
                <input type="number" className={inputCls} value={y.salary} onChange={(e) => mutate(() => { c.years[i].salary = Number(e.target.value); c.years[i].guaranteed = Math.min(c.years[i].guaranteed, c.years[i].salary); })} />
                <select className={inputCls} value={y.option ?? ""} onChange={(e) => mutate(() => void (c.years[i].option = (e.target.value || null) as never))}>
                  <option value="">No option</option><option value="player">Player</option><option value="team">Team</option><option value="eto">ETO</option>
                </select>
              </div>
            ))}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={c.noTradeClause} onChange={(e) => mutate(() => void (c.noTradeClause = e.target.checked))} /> No-trade clause</label>
          </div>
        )}
        <Button className="mt-3" variant="danger" onClick={() => mutate(() => void (p.injury = null))}>Heal injury</Button>
      </Card>
    </div>
  );
}
