"use client";
import { Check } from "@phosphor-icons/react";
import clsx from "clsx";
import { useGame, useLeague, useTeamId } from "@/lib/store";
import { Button, Card, PageHeader, PlayerLink, Rating } from "@/components/ui";
import { autoDepth, eligibleForGame, validateDepth } from "@/engine/league/depth";
import { teamPlayers } from "@/engine/league/helpers";
import { outOfPosition, SLOTS } from "@/engine/league/positions";
import type { Player, Position } from "@/engine/types/game";

export default function DepthPage() {
  const l = useLeague();
  const t = useTeamId();
  const mutate = useGame((s) => s.mutate);
  const team = l.teams[t];
  const d = team.depth;
  const playoffs = l.phase === "playoffs";
  const players = teamPlayers(l, t);
  const byId = new Map(players.map((p) => [p.id, p]));
  const starters = d.starters.filter((id) => byId.has(id));
  const bench = [...d.rotation.filter((id) => byId.has(id) && !starters.includes(id)), ...players.map((p) => p.id).filter((id) => !starters.includes(id) && !d.rotation.includes(id))];
  const total = [...starters, ...bench].reduce((s, id) => s + (d.minutes[id] ?? 0), 0);
  const err = validateDepth(d);
  const misplaced = starters.filter((id, i) => outOfPosition(byId.get(id)!, i));

  const edit = (fn: () => void) =>
    mutate(() => {
      team.depth = { ...team.depth, auto: false };
      fn();
    });

  const setStarter = (slot: number, id: string) =>
    edit(() => {
      const st = [...starters];
      const prev = st[slot];
      const at = st.indexOf(id);
      if (at >= 0) st[at] = prev; // swap two starters
      st[slot] = id;
      const rot = bench.filter((x) => x !== id);
      if (at < 0 && prev) rot.unshift(prev);
      team.depth.starters = st;
      team.depth.rotation = rot;
    });

  const moveBench = (id: string, dir: -1 | 1) =>
    edit(() => {
      const rot = [...bench];
      const i = rot.indexOf(id);
      const j = i + dir;
      if (j < 0 || j >= rot.length) return;
      [rot[i], rot[j]] = [rot[j], rot[i]];
      team.depth.rotation = rot;
    });

  const setPos = (p: Player, pos: Position) =>
    mutate(() => {
      p.pos = pos;
      if (team.depth.auto) team.depth = autoDepth(l, t, playoffs);
    });

  const minutesSlider = (id: string) => (
    <div className="flex items-center gap-2">
      <input type="range" min={0} max={48} value={d.minutes[id] ?? 0} className="k-check w-full" onChange={(e) => edit(() => (team.depth.minutes = { ...team.depth.minutes, [id]: Number(e.target.value) }))} />
      <span className="w-8 text-right font-semibold num">{d.minutes[id] ?? 0}</span>
    </div>
  );

  const posSelect = (p: Player) => (
    <select className="k-input" style={{ width: "auto" }} value={p.pos} title="Change the player's position" onChange={(e) => setPos(p, e.target.value as Position)}>
      {SLOTS.map((s) => <option key={s}>{s}</option>)}
    </select>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Rotation"
        sub="Pick anyone for any spot: natural fits are listed first. The auto coach keeps players in position; your picks play wherever you put them."
        right={
          <>
            <span className={clsx("k-tag", total === 240 ? "k-good" : "k-bad")}>{total} / 240 min</span>
            <Button size="sm" variant={d.auto ? "primary" : "default"} onClick={() => mutate(() => (team.depth = autoDepth(l, t, playoffs)))}>
              {d.auto ? <><Check size={13} weight="bold" /> Auto (coach decides)</> : "Reset to auto"}
            </Button>
          </>
        }
      />
      {err && !d.auto && <div className="k-panel text-sm text-warn">{err}: the coach will fill gaps automatically in games.</div>}
      {misplaced.length > 0 && <div className="k-panel text-xs text-dim">Playing out of position: {misplaced.map((id) => byId.get(id)!.name).join(", ")}.</div>}

      <Card title="Starting five" pad={false}>
        <ul>
          {SLOTS.map((slot, i) => {
            const id = starters[i];
            const p = id ? byId.get(id) : undefined;
            const natural = players.filter((x) => x.pos === slot && eligibleForGame(l, x, playoffs)).sort((a, b) => b.ovr - a.ovr);
            const others = players.filter((x) => x.pos !== slot && eligibleForGame(l, x, playoffs)).sort((a, b) => b.ovr - a.ovr);
            return (
              <li key={slot} className="grid grid-cols-[44px_1fr] items-center gap-3 border-b border-line/60 px-3 py-2.5 sm:grid-cols-[44px_minmax(220px,1.2fr)_minmax(160px,2fr)]">
                <span className={clsx("text-center font-num text-[19px] font-black", p && outOfPosition(p, i) ? "text-warn" : "text-accent")}>{slot}</span>
                <div className="flex min-w-0 items-center gap-2">
                  {p && <Rating value={p.ovr} />}
                  <select className="k-input min-w-0 flex-1" value={id ?? ""} onChange={(e) => setStarter(i, e.target.value)}>
                    {!id && <option value="">Pick a {slot}</option>}
                    <optgroup label={`${slot}s`}>
                      {natural.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.ovr}</option>)}
                    </optgroup>
                    <optgroup label="Other players (play anywhere)">
                      {others.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.pos}) · {x.ovr}</option>)}
                    </optgroup>
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1">{id && minutesSlider(id)}</div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="Bench (substitution order)" pad={false}>
        <ul>
          {bench.map((id, i) => {
            const p = byId.get(id)!;
            const ok = eligibleForGame(l, p, playoffs);
            return (
              <li key={id} className={clsx("grid grid-cols-[28px_1fr_auto] items-center gap-3 border-b border-line/60 px-3 py-2 sm:grid-cols-[28px_minmax(220px,1.2fr)_minmax(160px,2fr)_auto]", !ok && "opacity-50")}>
                <span className="text-center font-num text-[15px] font-bold text-mute">{i + 6}</span>
                <div className="flex min-w-0 items-center gap-2">
                  <Rating value={p.ovr} />
                  <div className="min-w-0">
                    <PlayerLink player={p} className="block truncate" />
                    <span className="text-xs text-dim">
                      {p.injury ? `Injured (${p.injury.daysOut}d)` : p.gLeague ? "G League" : !ok ? "Ineligible" : "Backs up"} {ok && posSelect(p)}
                    </span>
                  </div>
                </div>
                <div className="col-span-3 sm:col-span-1">{minutesSlider(id)}</div>
                <div className="row-start-1 flex gap-1 sm:row-start-auto">
                  <Button size="sm" variant="ghost" onClick={() => moveBench(id, -1)} disabled={i === 0}>↑</Button>
                  <Button size="sm" variant="ghost" onClick={() => moveBench(id, 1)} disabled={i === bench.length - 1}>↓</Button>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="Positions">
        <p className="mb-3 text-xs text-dim">Move a starter to a new position here (the lineup updates when on auto).</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {starters.map((id) => {
            const p = byId.get(id)!;
            return (
              <div key={id} className="flex items-center justify-between rounded-[4px] border border-line px-3 py-1.5 text-sm">
                <PlayerLink player={p} /> {posSelect(p)}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
