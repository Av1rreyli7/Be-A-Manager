"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useGame, useLeague, useTeamId } from "@/lib/store";
import { Button, Card, Empty, Field, Modal, OvrPot, PageHeader, PlayerLink, inputCls } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { contractOf, salaryIn, seasonAge, teamPlayers } from "@/engine/league/helpers";
import { minSalary } from "@/engine/cap/contracts";
import { extensionAsk, extensionInfoFor, offerExtension, requiredSalary } from "@/engine/offseason/extensions";
import { cbaFor } from "@/engine/cap/payroll";
import { money } from "@/lib/format";
import { seasonStartYear } from "@/engine/util/dates";

function ExtensionModal({ id, onClose }: { id: string; onClose: () => void }) {
  const l = useLeague();
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const p = l.players[id];
  const info = extensionInfoFor(l, id);
  const ask = extensionAsk(l, id);
  const [salary, setSalary] = useState(Math.min(ask.salary, info.maxFirstYear));
  const [years, setYears] = useState(Math.min(ask.years, info.maxYears));
  const need = requiredSalary(l, id, years);
  const floor = minSalary(cbaFor(l, l.season), p.experience);
  const c = contractOf(l, p);
  const left = (c?.years ?? []).filter((y) => seasonStartYear(y.season) >= seasonStartYear(l.season));
  const [reply, setReply] = useState<string | null>(null);
  return (
    <Modal open onClose={onClose} title={`Extend ${p.name}`}>
      <p className="text-sm text-dim">Current deal: {left.length ? `${money(left[0].salary)} · ${left.length} year${left.length === 1 ? "" : "s"} left (through ${left[left.length - 1].season})` : "expiring"} · new years start after it ends · max first year {money(info.maxFirstYear, 2)}</p>
      <p className="mt-1 text-sm">His camp prefers ~{money(ask.salary)} × {ask.years} years.</p>
      <p className={`mt-1 text-sm font-semibold ${salary >= need * 0.97 ? "text-good" : "text-warn"}`}>{salary >= need * 0.97 ? "He'd accept this offer" : `Needs about ${money(need)} per year for ${years} year${years === 1 ? "" : "s"}`}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label={`First-year salary ${money(salary, 2)}`}>
          <input type="range" className="w-full" min={floor} max={info.maxFirstYear} step={100000} value={salary} onChange={(e) => setSalary(Number(e.target.value))} />
        </Field>
        <Field label="Years">
          <select className={inputCls} value={years} onChange={(e) => setYears(Number(e.target.value))}>{Array.from({ length: info.maxYears }, (_, i) => i + 1).map((y) => <option key={y}>{y}</option>)}</select>
        </Field>
      </div>
      {reply && <p className="mt-3 rounded-[4px] border border-line px-3 py-2 text-sm">{reply}</p>}
      <div className="mt-4 flex gap-2">
        <Button variant="primary" onClick={() => mutate((lg) => { const r = offerExtension(lg, id, salary, years); setReply(r.message); if (r.accepted) { toast(r.message, "success"); onClose(); } })}>Offer extension</Button>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}

function Contracts() {
  const l = useLeague();
  const me = useTeamId();
  const params = useSearchParams();
  const [sel, setSel] = useState<string | null>(params.get("player"));
  const ps = teamPlayers(l, me);
  const eligible = ps.filter((p) => extensionInfoFor(l, p.id).eligible).sort((a, b) => b.ovr - a.ovr);
  const expiring = ps.filter((p) => {
    const c = contractOf(l, p);
    return c && !c.years.some((y) => seasonStartYear(y.season) > seasonStartYear(l.season));
  });
  return (
    <div className="space-y-4">
      <PageHeader title="Contracts & Extensions" sub="Re-sign or extend anyone on your roster at any time: if the offer is right for him, he signs." />
      <Card title="Your roster: extend or re-sign">
        {eligible.length === 0 ? <Empty>No one is eligible right now.</Empty> : (
          <ul className="divide-y divide-line">
            {eligible.map((p) => {
              const c = contractOf(l, p);
              const left = (c?.years ?? []).filter((y) => seasonStartYear(y.season) >= seasonStartYear(l.season));
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="flex items-center gap-2"><PlayerLink player={p} /><OvrPot p={p} /><span className="text-xs text-dim">{money(left[0]?.salary ?? 0)} · {left.length <= 1 ? <span className="text-warn">expiring</span> : `${left.length} yrs left`} · {c?.type}</span></span>
                  <Button size="sm" onClick={() => setSel(p.id)}>Negotiate</Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card title="Expiring after this season" pad={false}>
        <div className="p-3">
          <DataTable
            rows={expiring}
            rowKey={(p) => p.id}
            defaultSort="ovr"
            empty="No expiring contracts"
            columns={[
              { key: "n", label: "Player", value: (p) => p.lastName, render: (p) => <PlayerLink player={p} /> },
              { key: "age", label: "Age", value: (p) => seasonAge(p, l.season), align: "right" },
              { key: "ovr", label: "OVR/POT", value: (p) => p.ovr, render: (p) => <OvrPot p={p} /> },
              { key: "sal", label: "Salary", value: (p) => salaryIn(contractOf(l, p), l.season), render: (p) => money(salaryIn(contractOf(l, p), l.season)), align: "right" },
              { key: "type", label: "Type", render: (p) => <span className="chip">{contractOf(l, p)?.type}</span> },
              { key: "bird", label: "Bird rights", render: (p) => (p.seasonsWithTeam + 1 >= 3 ? "Full Bird" : p.seasonsWithTeam + 1 === 2 ? "Early Bird" : "Non-Bird") },
              { key: "rfa", label: "Status next summer", render: (p) => { const c = contractOf(l, p); return c && (c.type === "rookie-scale" || c.type === "second-round" || p.experience <= 3) ? "RFA if QO extended" : "UFA"; } },
            ]}
          />
        </div>
      </Card>
      {sel && l.players[sel] && extensionInfoFor(l, sel).eligible && <ExtensionModal id={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

export default function ContractsPage() {
  return (
    <Suspense>
      <Contracts />
    </Suspense>
  );
}
