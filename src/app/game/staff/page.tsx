"use client";
import { useGame, useLeague, useTeamId } from "@/lib/store";
import { Bar, Button, Card, PageHeader, PlayerLink } from "@/components/ui";
import { money } from "@/lib/format";
import type { Coach } from "@/engine/types/game";
import { contractOf, teamPlayers, newId } from "@/engine/league/helpers";
import { setGLeague } from "@/engine/league/transactions";

function CoachRow({ c, action }: { c: Coach; action: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-line/50 py-2 text-sm sm:grid-cols-[1.2fr_repeat(4,1fr)_auto]">
      <div><b>{c.name}</b> <span className="text-xs text-dim">{c.role} · age {c.age} · {money(c.salary)}/yr</span></div>
      {(["offense", "defense", "development", "motivation"] as const).map((k) => (
        <div key={k} className="hidden sm:block"><div className="flex justify-between text-[10px] uppercase text-mute"><span>{k}</span><span>{c[k]}</span></div><Bar value={c[k]} color="bg-info" /></div>
      ))}
      <div>{action}</div>
    </div>
  );
}

export default function StaffPage() {
  const l = useLeague();
  const me = useTeamId();
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const staff = Object.values(l.coaches).filter((c) => c.teamId === me);
  const pool = Object.values(l.coaches).filter((c) => !c.teamId).sort((a, b) => b.development + b.offense + b.defense - (a.development + a.offense + a.defense));
  const young = teamPlayers(l, me).filter((p) => p.experience <= 3 || contractOf(l, p)?.type === "two-way");
  const hire = (c: Coach) =>
    mutate((lg) => {
      const current = Object.values(lg.coaches).filter((x) => x.teamId === me && x.role === c.role);
      if (c.role === "HC" || current.length >= (c.role === "Assistant" ? 2 : 1)) {
        const out = current.sort((a, b) => a.development + a.offense + a.defense - (b.development + b.offense + b.defense))[0];
        if (out) out.teamId = null;
      }
      lg.coaches[c.id].teamId = me;
      lg.news.unshift({ id: newId(lg, "n"), date: lg.date, type: "firing", text: `${lg.teams[me].fullName} hire ${c.name} (${c.role}).`, teams: [me], players: [] });
      toast(`${c.name} hired`, "success");
    });
  return (
    <div className="space-y-4">
      <PageHeader title="Staff & G League" sub={`Coaches change how you play, how players grow and how happy they are. G League team: ${l.teams[me].gLeagueName}.`} />
      <Card title="Your staff">
        {staff.map((c) => <CoachRow key={c.id} c={c} action={<Button size="sm" variant="danger" onClick={() => mutate((lg) => { lg.coaches[c.id].teamId = null; toast(`${c.name} let go`); })}>Fire</Button>} />)}
      </Card>
      <Card title="Available coaches">
        {pool.slice(0, 20).map((c) => <CoachRow key={c.id} c={c} action={<Button size="sm" onClick={() => hire(c)}>Hire</Button>} />)}
      </Card>
      <Card title="G League assignments">
        <p className="mb-2 text-xs text-dim">Assigned players don&apos;t play NBA games but get development reps (+ progression). Two-way players can be assigned freely.</p>
        <ul className="divide-y divide-line/50">
          {young.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-1.5 text-sm">
              <span><PlayerLink player={p} /> <span className="text-xs text-dim">{p.pos} · {p.ovr}/{p.pot}</span></span>
              <Button size="sm" onClick={() => mutate((lg) => { const r = setGLeague(lg, p.id, !p.gLeague); if (r !== "ok") toast(r, "error"); })}>{p.gLeague ? "Recall" : "Assign"}</Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
