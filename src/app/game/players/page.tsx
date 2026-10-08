"use client";
import { useMemo, useState } from "react";
import { useLeague } from "@/lib/store";
import { Card, OvrPot, PageHeader, PlayerLink, TeamBadge, inputCls } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { contractOf, salaryIn, seasonAge } from "@/engine/league/helpers";
import { money } from "@/lib/format";
import { POSITIONS } from "@/engine/types/game";

export default function PlayersPage() {
  const l = useLeague();
  const [status, setStatus] = useState("active");
  const [pos, setPos] = useState("");
  const [team, setTeam] = useState("");
  const rows = useMemo(
    () =>
      Object.values(l.players)
        .filter((p) => (status === "all" ? true : p.status === status))
        .filter((p) => !pos || p.pos === pos)
        .filter((p) => !team || p.teamId === team),
    [l, status, pos, team],
  );
  return (
    <div className="space-y-4">
      <PageHeader title="All Players" sub={`${rows.length} players`} />
      <Card pad={false}>
        <div className="p-3">
          <DataTable
            rows={rows}
            rowKey={(p) => p.id}
            defaultSort="ovr"
            search={(p) => `${p.name} ${p.college ?? ""} ${p.born.country ?? ""}`}
            filters={
              <>
                <select className={inputCls} style={{ width: "auto" }} value={status} onChange={(e) => setStatus(e.target.value)}>
                  {["active", "fa", "prospect", "retired", "all"].map((s) => <option key={s} value={s}>{s === "fa" ? "free agents" : s}</option>)}
                </select>
                <select className={inputCls} style={{ width: "auto" }} value={pos} onChange={(e) => setPos(e.target.value)}>
                  <option value="">All positions</option>
                  {POSITIONS.map((p) => <option key={p}>{p}</option>)}
                </select>
                <select className={inputCls} style={{ width: "auto" }} value={team} onChange={(e) => setTeam(e.target.value)}>
                  <option value="">All teams</option>
                  {Object.values(l.teams).sort((a, b) => a.fullName.localeCompare(b.fullName)).map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                </select>
              </>
            }
            columns={[
              { key: "name", label: "Player", value: (p) => p.lastName, render: (p) => <PlayerLink player={p} /> },
              { key: "team", label: "Team", value: (p) => p.teamId ?? "", render: (p) => <TeamBadge league={l} teamId={p.teamId} size="sm" /> },
              { key: "pos", label: "Pos", value: (p) => p.pos },
              { key: "age", label: "Age", value: (p) => seasonAge(p, l.season), align: "right" },
              { key: "ovr", label: "OVR/POT", value: (p) => p.ovr, render: (p) => <OvrPot p={p} /> },
              { key: "pot", label: "POT", value: (p) => p.pot, align: "right", hideOnMobile: true },
              { key: "sal", label: "Salary", value: (p) => salaryIn(contractOf(l, p), l.season), render: (p) => (p.status === "fa" && p.demand ? <span className="text-dim">ask {money(p.demand.salary)}</span> : money(salaryIn(contractOf(l, p), l.season))), align: "right" },
              { key: "exp", label: "Exp", value: (p) => p.experience, align: "right", hideOnMobile: true },
              { key: "from", label: "From", value: (p) => p.college ?? p.born.country ?? "", hideOnMobile: true, render: (p) => <span className="text-xs text-dim">{p.college ?? p.born.country}</span> },
            ]}
          />
        </div>
      </Card>
    </div>
  );
}
