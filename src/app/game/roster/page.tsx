"use client";
import { useState } from "react";
import { useGame, useLeague, useTeamId } from "@/lib/store";
import { autoTrimRoster } from "@/engine/league/transactions";
import { Button, Card, PageHeader, PlayerCard, PlayerLink, Rating, Tabs, TeamBadge } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { contractOf, salaryIn, seasonAge, teamPlayers } from "@/engine/league/helpers";
import { perGame, seasonTotal } from "@/engine/season/stats";
import { f1, height, money } from "@/lib/format";
import { PlayerActions } from "@/components/PlayerActions";
import { traitLabel } from "@/engine/ratings/ratings";
import type { Player } from "@/engine/types/game";

export default function RosterPage() {
  const l = useLeague();
  const t = useTeamId();
  const [view, setView] = useState<"cards" | "roster" | "ratings" | "contracts">("cards");
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const ps = teamPlayers(l, t);
  const std = ps.filter((p) => contractOf(l, p)?.type !== "two-way");
  const tw = ps.filter((p) => contractOf(l, p)?.type === "two-way");

  const base = [
    { key: "name", label: "Player", value: (p: Player) => p.lastName, render: (p: Player) => <div className="flex items-center gap-2"><PlayerLink player={p} />{p.gLeague && <span className="k-tag">G</span>}{p.tradeRequest && <span className="k-tag k-warn">TR</span>}{l.tradeBlock.includes(p.id) && <span className="k-tag">Block</span>}</div> },
    { key: "pos", label: "Pos", value: (p: Player) => p.pos },
    { key: "ovr", label: "OVR", value: (p: Player) => p.ovr, render: (p: Player) => <Rating value={p.ovr} />, align: "center" as const },
    { key: "pot", label: "POT", value: (p: Player) => p.pot, render: (p: Player) => <Rating value={p.pot} className="opacity-70" />, align: "center" as const },
    { key: "age", label: "Age", value: (p: Player) => seasonAge(p, l.season), align: "right" as const },
  ];
  const cols =
    view === "roster"
      ? [
          ...base,
          { key: "ht", label: "Ht", value: (p: Player) => p.heightIn, render: (p: Player) => height(p.heightIn), align: "right" as const, hideOnMobile: true },
          { key: "exp", label: "Exp", value: (p: Player) => p.experience, align: "right" as const, hideOnMobile: true },
          { key: "gp", label: "GP", value: (p: Player) => seasonTotal(l, p.id).gp, align: "right" as const },
          { key: "min", label: "MIN", value: (p: Player) => perGame(seasonTotal(l, p.id)).min, render: (p: Player) => f1(perGame(seasonTotal(l, p.id)).min), align: "right" as const },
          { key: "pts", label: "PTS", value: (p: Player) => perGame(seasonTotal(l, p.id)).pts, render: (p: Player) => f1(perGame(seasonTotal(l, p.id)).pts), align: "right" as const },
          { key: "reb", label: "REB", value: (p: Player) => perGame(seasonTotal(l, p.id)).reb, render: (p: Player) => f1(perGame(seasonTotal(l, p.id)).reb), align: "right" as const },
          { key: "ast", label: "AST", value: (p: Player) => perGame(seasonTotal(l, p.id)).ast, render: (p: Player) => f1(perGame(seasonTotal(l, p.id)).ast), align: "right" as const },
          { key: "morale", label: "Morale", value: (p: Player) => p.morale, align: "right" as const, hideOnMobile: true },
          { key: "status", label: "Status", render: (p: Player) => (p.injury ? <span className="text-xs font-semibold text-bad">{p.injury.type} ({p.injury.daysOut}d)</span> : <span className="text-xs text-mute">Healthy</span>) },
          { key: "act", label: "", render: (p: Player) => <PlayerActions p={p} compact /> },
        ]
      : view === "ratings"
        ? [
            ...base,
            ...(["threePoint", "midRange", "layup", "passVision", "ballHandle", "perimeterD", "interiorD", "block", "steal", "defRebound", "speed", "strength", "stamina"] as const).map((k) => ({ key: k, label: k.replace(/([A-Z])/g, " $1").slice(0, 7), value: (p: Player) => p.ratings[k], align: "right" as const })),
            { key: "traits", label: "Traits", render: (p: Player) => <span className="text-xs text-dim">{p.traits.map(traitLabel).join(", ")}</span> },
          ]
        : [
            ...base,
            { key: "type", label: "Type", value: (p: Player) => contractOf(l, p)?.type ?? "", render: (p: Player) => <span className="k-tag">{contractOf(l, p)?.type ?? "-"}</span> },
            { key: "sal", label: l.season, value: (p: Player) => salaryIn(contractOf(l, p), l.season), render: (p: Player) => money(salaryIn(contractOf(l, p), l.season)), align: "right" as const },
            { key: "yrs", label: "Years", value: (p: Player) => contractOf(l, p)?.years.filter((y) => y.season >= l.season).length ?? 0, align: "right" as const },
            { key: "opt", label: "Options", render: (p: Player) => <span className="text-xs text-dim">{(contractOf(l, p)?.years ?? []).filter((y) => y.option).map((y) => `${y.option === "player" ? "PO" : y.option === "team" ? "TO" : "ETO"} ${y.season}`).join(", ") || "-"}</span> },
            { key: "bird", label: "Seasons w/ team", value: (p: Player) => p.seasonsWithTeam, align: "right" as const },
            { key: "ntc", label: "NTC", render: (p: Player) => (contractOf(l, p)?.noTradeClause ? "Yes" : "") },
          ];

  return (
    <div className="space-y-4">
      <PageHeader
        right={
          std.length > l.cba.roster.maxStandard || tw.length > l.cba.roster.maxTwoWay || std.length < l.cba.roster.minStandard ? (
            <Button
              variant="primary"
              onClick={() =>
                mutate((lg) => {
                  const r = autoTrimRoster(lg, t);
                  const parts = [r.waived.length ? `Waived: ${r.waived.join(", ")}` : "", r.signed.length ? `Signed: ${r.signed.join(", ")}` : ""].filter(Boolean);
                  toast(parts.join(" · ") || "Roster already within limits", "success");
                })
              }
            >
              Auto-fix roster ({std.length > l.cba.roster.maxStandard ? `cut to ${l.cba.roster.maxStandard}` : std.length < l.cba.roster.minStandard ? `fill to ${l.cba.roster.minStandard}` : `fix two-ways`})
            </Button>
          ) : null
        }
        title="Roster" sub={<span className="flex items-center gap-2"><TeamBadge league={l} teamId={t} size="sm" /> {std.length} standard · {tw.length} two-way (max {l.cba.roster.maxStandard} + {l.cba.roster.maxTwoWay} in season)</span>} />
      <Tabs tabs={[{ id: "cards", label: "Cards" }, { id: "roster", label: "Roster" }, { id: "ratings", label: "Ratings" }, { id: "contracts", label: "Contracts" }]} value={view} onChange={setView} />
      {view === "cards" ? (
        <>
          <CardGrid title="Standard contracts" players={std} />
          {tw.length > 0 && <CardGrid title="Two-way contracts" players={tw} />}
        </>
      ) : (
      <>
      <Card title="Standard contracts" pad={false}>
        <div className="p-3">
          <DataTable rows={std} columns={cols} rowKey={(p) => p.id} defaultSort="ovr" />
        </div>
      </Card>
      <Card title="Two-way contracts" pad={false}>
        <div className="p-3">
          <DataTable rows={tw} columns={[...cols, { key: "tw", label: "2W games", value: (p: Player) => contractOf(l, p)?.twoWayGames ?? 0, render: (p: Player) => `${contractOf(l, p)?.twoWayGames ?? 0}/${l.cba.roster.twoWayGameLimit}`, align: "right" as const }]} rowKey={(p) => p.id} defaultSort="ovr" empty="No two-way players" />
        </div>
      </Card>
      </>
      )}
    </div>
  );
}

function CardGrid({ title, players }: { title: string; players: Player[] }) {
    const l = useLeague();
    const sorted = [...players].sort((a, b) => b.ovr - a.ovr);
    return (
      <section>
        <h2 className="k-mlab mb-2.5">
          {title} <span className="text-ink num">{players.length}</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5" data-km="rows">
          {sorted.map((p, i) => {
            const pg = perGame(seasonTotal(l, p.id));
            return (
              <PlayerCard
                key={p.id}
                league={l}
                player={p}
                style={{ ["--i" as string]: Math.min(i, 14) }}
                stats={[
                  { label: pg.gp ? "PTS" : "Age", value: pg.gp ? f1(pg.pts) : seasonAge(p, l.season) },
                  { label: pg.gp ? "REB" : "Ht", value: pg.gp ? f1(pg.reb) : height(p.heightIn) },
                  { label: pg.gp ? "AST" : "Salary", value: pg.gp ? f1(pg.ast) : money(salaryIn(contractOf(l, p), l.season), 0) },
                ]}
              />
            );
          })}
        </div>
      </section>
    );
}
