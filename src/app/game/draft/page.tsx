"use client";
import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { isMine, useGame, useIsOnlineGuest, useLeague, useTeamId } from "@/lib/store";
import { Appear, Button, Card, Empty, OvrPot, PageHeader, PlayerLink, PosBadge, Stat, Tabs, TeamBadge } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { aiDraftPick, consensusBoard, currentPick, draftPlayer, scoutProspect, scoutedRatings, workout } from "@/engine/offseason/draft";
import { height } from "@/lib/format";
import { seasonAge } from "@/engine/league/helpers";

export default function DraftPage() {
  const l = useLeague();
  // remount per phase so the draft room tab opens automatically when the draft starts
  return <DraftView key={l.phase} />;
}

function DraftView() {
  const l = useLeague();
  const me = useTeamId();
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const guest = useIsOnlineGuest();
  const [tab, setTab] = useState<"board" | "mock" | "live">(l.phase === "draft" ? "live" : "board");
  const d = l.draft;
  // recomputed every render: picks mutate the league in place, so a memo would keep drafted players listed
  const board = d ? consensusBoard(l) : [];
  if (!d) return <Empty>The next draft class shows up when the season starts.</Empty>;
  const prospects = d.prospects.map((id) => l.players[id]).filter((p) => p && p.status === "prospect");
  const cur = currentPick(l);
  const myPicks = d.order.filter((o) => o.owner === me);

  const simToMine = () =>
    mutate((lg) => {
      let guard = 0;
      while (currentPick(lg) && !lg.userTeams.includes(currentPick(lg)!.owner) && guard++ < 70) aiDraftPick(lg);
    });

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${d.year} NBA Draft`}
        sub={`Class strength ${d.classStrength >= 1.08 ? "deep" : d.classStrength <= 0.92 ? "thin" : "average"} (${d.classStrength.toFixed(2)}) · ${prospects.length} prospects available`}
        right={<span className="chip">Scouting points: {d.scoutingPoints}</span>}
      />
      <Tabs tabs={[{ id: "board", label: "Big board & scouting" }, { id: "mock", label: "Mock draft" }, { id: "live", label: "Draft room" }]} value={tab} onChange={setTab} />

      {tab === "board" && (
        <Card pad={false}>
          <div className="p-3">
            <DataTable
              rows={prospects}
              rowKey={(p) => p.id}
              defaultSort="rank"
              defaultDir="asc"
              search={(p) => `${p.name} ${p.college}`}
              columns={[
                { key: "rank", label: "Rk", value: (p) => board.indexOf(p.id) + 1, align: "right" },
                { key: "n", label: "Prospect", value: (p) => p.lastName, render: (p) => <PlayerLink player={p} /> },
                { key: "pos", label: "Pos", value: (p) => p.pos },
                { key: "age", label: "Age", value: (p) => seasonAge(p, l.season), align: "right" },
                { key: "ht", label: "Ht", value: (p) => p.heightIn, render: (p) => height(p.heightIn), align: "right" },
                { key: "from", label: "From", value: (p) => p.college ?? "", render: (p) => <span className="text-xs text-dim">{p.college}</span> },
                { key: "ovr", label: "OVR/POT (est.)", value: (p) => scoutedRatings(p).pot, render: (p) => <OvrPot p={p} /> },
                { key: "range", label: "Range", render: (p) => { const s = scoutedRatings(p); return <span className="text-xs text-dim">{s.potRange[0]}-{s.potRange[1]}</span>; } },
                { key: "sc", label: "Scouted", value: (p) => p.scouting?.revealed ?? 0, render: (p) => `${p.scouting?.revealed ?? 0}%`, align: "right" },
                { key: "comb", label: "Combine", render: (p) => (p.scouting?.combine ? <span className="text-xs text-dim">{p.scouting.combine.vertical}&quot; · {(p.scouting.combine.wingspan / 12).toFixed(1)}ft ws · {p.scouting.combine.laneAgility}s</span> : <span className="text-xs text-mute">after season</span>) },
                { key: "act", label: "", render: (p) => (
                  <span className="flex gap-1">
                    <Button size="sm" disabled={d.scoutingPoints < 5} onClick={() => mutate((lg) => { const r = scoutProspect(lg, p.id); if (r !== "ok") toast(r, "error"); })}>Scout (5)</Button>
                    {l.phase === "pre-draft" && <Button size="sm" disabled={p.scouting?.workedOut} onClick={() => mutate((lg) => { const r = workout(lg, p.id); if (r !== "ok") toast(r, "error"); })}>Workout</Button>}
                  </span>
                ) },
              ]}
            />
          </div>
        </Card>
      )}

      {tab === "mock" && (
        <Card title="Consensus mock draft">
          {d.order.length === 0 ? <p className="mb-3 text-sm text-dim">Draft order is set by the lottery; this mock uses the consensus board only.</p> : null}
          <ol className="grid gap-1.5 sm:grid-cols-2">
            {(d.order.length ? d.order.filter((o) => !o.playerId) : board.slice(0, 30).map((_, i) => ({ pick: i + 1, owner: "", pickId: String(i), round: 1 as const, originalTeam: "" }))).slice(0, 30).map((o, i) => {
              const p = l.players[board[i]];
              return p ? (
                <li key={o.pickId} className="flex items-center gap-2 rounded-[4px] border border-line px-3 py-1.5 text-sm">
                  <span className="w-7 font-num text-[15px] font-bold text-mute">{o.pick}</span>
                  {o.owner && <TeamBadge league={l} teamId={o.owner} size="sm" />}
                  <PlayerLink player={p} />
                  <span className="ml-auto"><OvrPot p={p} /></span>
                </li>
              ) : null;
            })}
          </ol>
        </Card>
      )}

      {tab === "live" && (
        l.phase !== "draft" ? <Empty>The draft room opens after the lottery and combine. Now: {l.phase}.</Empty> : (
          <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <Card title="On the clock">
              {cur ? (
                <Appear key={cur.pick}>
                  <div className="flex items-center gap-3">
                    <span className="grad-title font-num text-[36px] font-black">#{cur.pick}</span>
                    <TeamBadge league={l} teamId={cur.owner} size="lg" />
                    {cur.originalTeam !== cur.owner && <span className="text-xs text-dim">via {cur.originalTeam}</span>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {isMine(l, cur.owner) ? <span className="chip anim-glow !bg-accent !text-accent-ink">Your pick. Choose from the list</span> : l.online && l.userTeams.includes(cur.owner) ? <span className="chip">{l.online.members[cur.owner] ?? cur.owner} is on the clock</span> : guest ? <span className="chip">Waiting for the host to make the AI picks</span> : (
                      <>
                        <Button variant="primary" onClick={() => mutate((lg) => void aiDraftPick(lg))}>Next pick</Button>
                        <Button onClick={simToMine} disabled={!myPicks.some((o) => !o.playerId)}>Sim to my pick</Button>
                      </>
                    )}
                    <Link href="/game/trade" className="text-sm text-accent">Trade picks →</Link>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <Stat label="Your picks left" value={myPicks.filter((o) => !o.playerId).map((o) => `#${o.pick}`).join(", ") || "None"} />
                    <Stat label="Round" value={cur.round} />
                  </div>
                </Appear>
              ) : <Empty>The draft is done. Next up: options and free agency.</Empty>}
              <div className="mt-4 max-h-80 overflow-y-auto scroll-thin">
                {d.order.filter((o) => o.playerId).reverse().map((o) => (
                  <div key={o.pickId} className={clsx("flex items-center gap-2 border-b border-line/50 py-1 text-sm", isMine(l, o.owner) && "bg-accent/10")}>
                    <span className="w-8 text-mute">{o.pick}</span>
                    <TeamBadge league={l} teamId={o.owner} size="sm" />
                    <PlayerLink player={l.players[o.playerId!]} />
                    {l.players[o.playerId!] && <PosBadge pos={l.players[o.playerId!].pos} className="ml-auto" />}
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Available" pad={false}>
              <div className="max-h-[70vh] overflow-y-auto scroll-thin">
                {board.map((id, i) => {
                  const p = l.players[id];
                  const mineNow = cur && isMine(l, cur.owner);
                  return (
                    <div key={id} className="flex items-center gap-2 border-b border-line/50 px-3 py-1.5 text-sm">
                      <span className="w-6 text-mute">{i + 1}</span>
                      <PlayerLink player={p} />
                      <span className="text-xs text-dim">{p.pos} · {p.college}</span>
                      <span className="ml-auto"><OvrPot p={p} /></span>
                      {mineNow && <Button size="sm" variant="primary" onClick={() => mutate((lg) => { const r = draftPlayer(lg, id); toast(r === "ok" ? `You selected ${p.name}` : r, r === "ok" ? "success" : "error"); })}>Draft</Button>}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )
      )}
    </div>
  );
}
