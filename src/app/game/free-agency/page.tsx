"use client";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { useGame, useLeague, useTeamId } from "@/lib/store";
import { Bar, Button, Card, Empty, Field, Modal, OvrPot, PageHeader, PlayerLink, Stat, TeamBadge, inputCls } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { freeAgents, signPlayer, signTenDay, signTwoWay } from "@/engine/league/transactions";
import { interestScore, makeOffer, matchOfferSheet } from "@/engine/offseason/freeAgency";
import { signingMethods, validateOffer, minSalary } from "@/engine/cap/contracts";
import { capStatus } from "@/engine/cap/payroll";
import { seasonAge, standardPlayers, twoWayPlayers } from "@/engine/league/helpers";
import { money, STATUS_COLOR, STATUS_LABEL } from "@/lib/format";
import type { Player } from "@/engine/types/game";
import { askingPrice } from "@/engine/offseason/freeAgency";
import { Rng } from "@/engine/util/rng";

function OfferModal({ p, onClose }: { p: Player; onClose: () => void }) {
  const l = useLeague();
  const me = useTeamId();
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const methods = signingMethods(l, me, p).filter((m) => m.available || m.id === "bird" || m.id === "room");
  const best = methods.find((m) => m.available) ?? methods[0];
  const ask = p.demand ?? askingPrice(l, p, new Rng(1));
  const [method, setMethod] = useState(best?.id ?? "minimum");
  const m = methods.find((x) => x.id === method);
  const [salary, setSalary] = useState(Math.min(ask.salary, m?.maxFirstYear ?? ask.salary));
  const [years, setYears] = useState(Math.min(ask.years, m?.maxYears ?? 2));
  const [raise, setRaise] = useState(0.05);
  const [option, setOption] = useState<"" | "player" | "team">("");
  const terms = { salary, years, raisePct: Math.min(raise, m?.maxRaise ?? 0.05), option: (option || null) as "player" | "team" | null, method };
  const errors = validateOffer(l, me, p, terms);
  const interest = interestScore(l, p, { teamId: me, salary, years });
  const rivals = l.freeAgency.offers.filter((o) => o.playerId === p.id && o.status === "pending" && o.teamId !== me);
  const inSeason = l.phase === "regular";
  return (
    <Modal open onClose={onClose} kicker="Free agency" title={`Offer: ${p.name}`}>
      <div className="mb-3 flex items-center gap-3 text-sm">
        <OvrPot p={p} />
        <span className="text-dim">Age {seasonAge(p, l.season)} · {p.experience} YOS · asking <b className="text-ink">{money(ask.salary)}</b> × {ask.years}{p.rfaTeam ? ` · RFA (${p.rfaTeam} can match)` : ""}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Signing method">
          <select className={inputCls} value={method} onChange={(e) => { setMethod(e.target.value as typeof method); const mm = methods.find((x) => x.id === e.target.value); if (mm) { setSalary(Math.min(salary, mm.maxFirstYear || salary)); setYears(Math.min(years, mm.maxYears)); } }}>
            {methods.map((x) => <option key={x.id} value={x.id} disabled={!x.available}>{x.label} {x.available ? `(up to ${money(x.maxFirstYear)})` : `· ${x.reason ?? "n/a"}`}</option>)}
          </select>
        </Field>
        <Field label={`First-year salary ${money(salary, 2)}`}>
          <input type="range" className="k-check w-full" min={minSalary(l.cba, p.experience)} max={Math.max(minSalary(l.cba, p.experience), m?.maxFirstYear || 60e6)} step={50000} value={salary} onChange={(e) => setSalary(Number(e.target.value))} />
        </Field>
        <Field label="Years">
          <select className={inputCls} value={years} onChange={(e) => setYears(Number(e.target.value))}>{[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>{y}</option>)}</select>
        </Field>
        <Field label={`Annual raise ${(raise * 100).toFixed(0)}%`}>
          <input type="range" className="k-check w-full" min={0} max={m?.maxRaise ?? 0.08} step={0.01} value={raise} onChange={(e) => setRaise(Number(e.target.value))} />
        </Field>
        <Field label="Final-year option">
          <select className={inputCls} value={option} onChange={(e) => setOption(e.target.value as typeof option)}><option value="">None</option><option value="player">Player option</option><option value="team">Team option</option></select>
        </Field>
        <div>
          <div className="k-label mb-1">Interest</div>
          <Bar value={interest.score} max={100} color={interest.score > 60 ? "bg-good" : interest.score > 40 ? "bg-warn" : "bg-bad"} />
          <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-dim">{Object.entries(interest.parts).map(([k, v]) => <span key={k}>{k} {v.toFixed(0)}</span>)}</div>
        </div>
      </div>
      {rivals.length > 0 && <p className="mt-3 text-xs text-warn">Competing offers from: {rivals.map((o) => `${o.teamId} (${money(o.salary)}×${o.years})`).join(", ")}</p>}
      {errors.length > 0 && <ul className="mt-3 space-y-1 text-xs text-bad">{errors.map((e) => <li key={e}>• {e}</li>)}</ul>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" disabled={!!errors.length} onClick={() => mutate((lg) => { const r = makeOffer(lg, me, p.id, terms); toast(r.ok ? `Offer sent. ${r.response}` : r.errors.join("; "), r.ok ? "success" : "error"); if (r.ok) onClose(); })}>
          {l.phase === "free-agency" ? "Submit offer" : "Offer contract"}
        </Button>
        {l.phase !== "free-agency" && (
          <Button
            onClick={() => {
              // outside the FA period players answer immediately
              if (salary < ask.salary * 0.97 && interest.score < 55) return toast(`${p.name} says no. He wants about ${money(ask.salary)} a year`, "error");
              mutate((lg) => {
                const res = signPlayer(lg, me, lg.players[p.id], terms);
                toast(res.ok ? `${p.name} signed!` : res.errors.join("; "), res.ok ? "success" : "error");
                if (res.ok) onClose();
              });
            }}
          >
            Sign now
          </Button>
        )}
        {inSeason && <Button size="sm" onClick={() => mutate((lg) => { const r = signTenDay(lg, me, lg.players[p.id]); toast(r.ok ? "10-day contract signed" : r.errors.join("; "), r.ok ? "success" : "error"); if (r.ok) onClose(); })}>10-day</Button>}
        {p.experience <= 3 && <Button size="sm" onClick={() => mutate((lg) => { const r = signTwoWay(lg, me, lg.players[p.id]); toast(r.ok ? "Two-way contract signed" : r.errors.join("; "), r.ok ? "success" : "error"); if (r.ok) onClose(); })}>Two-way</Button>}
      </div>
    </Modal>
  );
}

function FreeAgency() {
  const l = useLeague();
  const me = useTeamId();
  const params = useSearchParams();
  const mutate = useGame((s) => s.mutate);
  const [sel, setSel] = useState<string | null>(params.get("player"));
  const fas = useMemo(() => freeAgents(l), [l]);
  const st = capStatus(l, me);
  const myOffers = l.freeAgency.offers.filter((o) => o.teamId === me);
  const sheets = l.freeAgency.offers.filter((o) => o.status === "accepted" && o.offerSheet && o.matchDeadline && l.players[o.playerId]?.rfaTeam === me && l.players[o.playerId]?.status === "fa");
  return (
    <div className="space-y-4">
      <PageHeader title="Free Agency" sub={l.phase === "free-agency" ? `Day ${l.freeAgency.day} · players decide over simulated days; asking prices fall as FA drags on` : "Free players you can sign now: minimum, 10 day, two way or with an exception"} />
      <div className="grid gap-4 sm:grid-cols-4">
        <Card><Stat label="Team salary" value={money(st.salary)} sub={<span className={STATUS_COLOR[st.status]}>{STATUS_LABEL[st.status]}</span>} /></Card>
        <Card><Stat label="Cap room" value={money(st.room)} /></Card>
        <Card><Stat label="Roster" value={`${standardPlayers(l, me).length} + ${twoWayPlayers(l, me).length}`} sub="standard + two-way" /></Card>
        <Card><Stat label="Free agents" value={fas.length} /></Card>
      </div>
      {sheets.map((o) => (
        <div key={o.id} className="k-panel flex flex-wrap items-center justify-between gap-2 text-sm">
          <span><b>{l.players[o.playerId].name}</b> signed an offer sheet with {o.teamId}: {money(o.salary)} × {o.years}. Match by {o.matchDeadline}?</span>
          <span className="flex gap-2">
            <Button onClick={() => mutate((lg) => matchOfferSheet(lg, o.id))}>Match</Button>
            <Button variant="ghost" onClick={() => mutate((lg) => void (lg.freeAgency.offers.find((x) => x.id === o.id)!.matchDeadline = lg.date))}>Decline to match</Button>
          </span>
        </div>
      ))}
      {myOffers.length > 0 && (
        <Card title="Your offers">
          <ul className="space-y-1 text-sm">
            {myOffers.map((o) => (
              <li key={o.id} className="flex items-center justify-between">
                <span><PlayerLink player={l.players[o.playerId]} />: {money(o.salary)} × {o.years} ({o.exception})</span>
                <span className={clsx("k-tag", o.status === "accepted" && "k-good", o.status === "rejected" && "k-bad")}>{o.status}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card pad={false}>
        <div className="p-3">
          <DataTable
            rows={fas}
            rowKey={(p) => p.id}
            defaultSort="ovr"
            search={(p) => p.name}
            onRowClick={(p) => setSel(p.id)}
            columns={[
              { key: "n", label: "Player", value: (p) => p.lastName, render: (p) => <span className="flex items-center gap-2"><PlayerLink player={p} />{p.rfaTeam && <span className="k-tag k-info">RFA {p.rfaTeam}</span>}</span> },
              { key: "pos", label: "Pos", value: (p) => p.pos },
              { key: "age", label: "Age", value: (p) => seasonAge(p, l.season), align: "right" },
              { key: "ovr", label: "OVR/POT", value: (p) => p.ovr, render: (p) => <OvrPot p={p} /> },
              { key: "ask", label: "Asking", value: (p) => p.demand?.salary ?? 0, render: (p) => (p.demand ? `${money(p.demand.salary)} × ${p.demand.years}` : "-"), align: "right" },
              { key: "offers", label: "Offers", value: (p) => l.freeAgency.offers.filter((o) => o.playerId === p.id && o.status === "pending").length, align: "right" },
              { key: "prev", label: "Last team", render: (p) => { const t = Object.values(l.teams).find((x) => x.rights.some((r) => r.playerId === p.id)); return t ? <TeamBadge league={l} teamId={t.id} size="sm" /> : ""; } },
              { key: "go", label: "", render: (p) => <Button size="sm" onClick={() => setSel(p.id)}>Offer</Button> },
            ]}
            empty={<Empty>No free agents.</Empty>}
          />
        </div>
      </Card>
      {sel && l.players[sel] && l.players[sel].status === "fa" && <OfferModal p={l.players[sel]} onClose={() => setSel(null)} />}
    </div>
  );
}

export default function FreeAgencyPage() {
  return (
    <Suspense>
      <FreeAgency />
    </Suspense>
  );
}
