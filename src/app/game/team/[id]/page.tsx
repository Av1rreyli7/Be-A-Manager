"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useLeague } from "@/lib/store";
import { Card, Empty, OvrPot, PageHeader, PlayerLink, Stat, TeamBadge } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { contractOf, salaryIn, seasonAge, teamPlayers, teamStrength } from "@/engine/league/helpers";
import { capStatus } from "@/engine/cap/payroll";
import { emptyRecord } from "@/engine/season/standings";
import { money, STATUS_COLOR, STATUS_LABEL, f1 } from "@/lib/format";
import { perGame, seasonTotal } from "@/engine/season/stats";
import { PickList } from "@/components/PickList";

export default function TeamPage() {
  const { id } = useParams<{ id: string }>();
  const l = useLeague();
  const t = l.teams[id];
  if (!t) return <Empty>No such team.</Empty>;
  const r = l.standings[id] ?? emptyRecord(id);
  const cap = capStatus(l, id);
  const hc = Object.values(l.coaches).find((c) => c.teamId === id && c.role === "HC");
  const ps = teamPlayers(l, id);
  return (
    <div className="space-y-4">
      <PageHeader
        title={<span className="flex items-center gap-3"><TeamBadge league={l} teamId={id} size="lg" />{t.fullName}</span>}
        sub={`${t.conference} · ${t.division} · ${t.venue ?? ""} · HC ${hc?.name ?? "-"} · ${t.strategy.mode}`}
        right={<Link href={`/game/cap?team=${id}`} className="text-sm text-accent">Cap sheet →</Link>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card><Stat label="Record" value={`${r.w}-${r.l}`} /></Card>
        <Card><Stat label="Strength" value={f1(teamStrength(l, id))} sub="weighted top-10 OVR" /></Card>
        <Card><Stat label="Payroll" value={money(cap.salary)} sub={<span className={STATUS_COLOR[cap.status]}>{STATUS_LABEL[cap.status]}</span>} /></Card>
        <Card><Stat label="Hard cap" value={cap.hardCap ? `${cap.hardCap} apron` : "None"} /></Card>
        <Card><Stat label="Hype" value={Math.round(t.hype)} sub={`${t.retiredNumbers.length} retired numbers`} /></Card>
      </div>
      <Card title="Roster" pad={false}>
        <div className="p-3">
          <DataTable
            rows={ps}
            rowKey={(p) => p.id}
            defaultSort="ovr"
            dense
            columns={[
              { key: "name", label: "Player", value: (p) => p.lastName, render: (p) => <PlayerLink player={p} /> },
              { key: "pos", label: "Pos", value: (p) => p.pos },
              { key: "age", label: "Age", value: (p) => seasonAge(p, l.season), align: "right" },
              { key: "ovr", label: "OVR/POT", value: (p) => p.ovr, render: (p) => <OvrPot p={p} /> },
              { key: "pts", label: "PTS", value: (p) => perGame(seasonTotal(l, p.id)).pts, render: (p) => f1(perGame(seasonTotal(l, p.id)).pts), align: "right" },
              { key: "sal", label: "Salary", value: (p) => salaryIn(contractOf(l, p), l.season), render: (p) => money(salaryIn(contractOf(l, p), l.season)), align: "right" },
              { key: "type", label: "Contract", render: (p) => <span className="chip">{contractOf(l, p)?.type}</span> },
            ]}
          />
        </div>
      </Card>
      <Card title="Draft picks (owned)">
        <PickList teamId={id} />
      </Card>
    </div>
  );
}
