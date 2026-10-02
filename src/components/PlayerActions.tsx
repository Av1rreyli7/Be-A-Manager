"use client";
/** Roster actions for a user-team player: waive/stretch, G League, two-way conversion, trade block. */
import { useState } from "react";
import type { Player, Position } from "@/engine/types/game";
import { useGame, useLeague, isMine } from "@/lib/store";
import { Button, Field, Modal, inputCls } from "./ui";
import { SLOTS } from "@/engine/league/positions";
import { autoDepth } from "@/engine/league/depth";
import { contractOf, salaryIn } from "@/engine/league/helpers";
import { convertTwoWay, setGLeague, waivePlayer } from "@/engine/league/transactions";
import { money } from "@/lib/format";
import { seasonStartYear } from "@/engine/util/dates";

export function PlayerActions({ p, compact }: { p: Player; compact?: boolean }) {
  const l = useLeague();
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const [waive, setWaive] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pos, setPos] = useState<Position>(p.pos);
  const [jersey, setJersey] = useState(p.jersey ?? "");
  if (!p.teamId || !isMine(l, p.teamId)) return null;
  const c = contractOf(l, p);
  const onBlock = l.tradeBlock.includes(p.id);
  const guaranteed = (c?.years ?? []).filter((y) => seasonStartYear(y.season) >= seasonStartYear(l.season)).reduce((s, y) => s + y.guaranteed, 0);
  return (
    <div className="flex flex-wrap gap-1.5">
      <Button size="sm" onClick={() => (setPos(p.pos), setJersey(p.jersey ?? ""), setEditing(true))}>
        Edit
      </Button>
      <Modal open={editing} onClose={() => setEditing(false)} title={`Edit ${p.name}`}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Position">
            <div className="flex gap-1">
              {SLOTS.map((s2) => (
                <button key={s2} onClick={() => setPos(s2)} className={`flex-1 rounded-[6px] border px-2 py-2 text-sm font-bold ${pos === s2 ? "border-accent bg-accent/10 text-accent" : "border-line text-dim hover:border-line-2 hover:text-ink"}`}>
                  {s2}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Jersey number">
            <input className={inputCls} value={jersey} maxLength={2} onChange={(e) => setJersey(e.target.value.replace(/\D/g, ""))} />
          </Field>
        </div>
        <p className="mt-2 text-xs text-dim">The auto lineup uses a player&apos;s position. On a manual lineup you can also start anyone at any spot from the Rotation page.</p>
        <div className="mt-4 flex gap-2">
          <Button
            variant="primary"
            onClick={() => {
              mutate((lg) => {
                const pl = lg.players[p.id];
                pl.pos = pos;
                pl.jersey = jersey || null;
                const team = lg.teams[pl.teamId!];
                if (team.depth.auto) team.depth = autoDepth(lg, team.id, lg.phase === "playoffs");
              });
              toast(`${p.name} updated: now a ${pos}`, "success");
              setEditing(false);
            }}
          >
            Save
          </Button>
          <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </Modal>
      <Button size="sm" onClick={() => mutate((lg) => (lg.tradeBlock = onBlock ? lg.tradeBlock.filter((x) => x !== p.id) : [...lg.tradeBlock, p.id]))}>
        {onBlock ? "Remove from block" : "Trade block"}
      </Button>
      {c?.type === "two-way" && (
        <Button
          size="sm"
          onClick={() =>
            mutate((lg) => {
              const r = convertTwoWay(lg, p.id);
              toast(r.ok ? `${p.name} converted to a standard contract` : r.errors.join("; "), r.ok ? "success" : "error");
            })
          }
        >
          Convert to standard
        </Button>
      )}
      {!compact && (p.experience <= 3 || c?.type === "two-way") && (
        <Button size="sm" onClick={() => mutate((lg) => { const r = setGLeague(lg, p.id, !p.gLeague); if (r !== "ok") toast(r, "error"); })}>
          {p.gLeague ? "Recall from G League" : "Assign to G League"}
        </Button>
      )}
      <Button size="sm" variant="danger" onClick={() => setWaive(true)}>
        Waive
      </Button>
      <Modal open={waive} onClose={() => setWaive(false)} title={`Waive ${p.name}?`}>
        <p className="text-sm text-dim">
          Current salary {money(salaryIn(c, l.season))}. <b className="text-ink">{money(guaranteed)}</b> of guaranteed money remains and stays on your cap as dead money.
        </p>
        <p className="mt-2 text-sm text-dim">Stretching spreads the remaining guaranteed money over twice the remaining years plus one.</p>
        <div className="mt-4 flex gap-2">
          <Button variant="danger" onClick={() => (mutate((lg) => void waivePlayer(lg, p.id)), setWaive(false), toast(`${p.name} waived`))}>
            Waive
          </Button>
          {guaranteed > 0 && (
            <Button onClick={() => (mutate((lg) => void waivePlayer(lg, p.id, { stretch: true })), setWaive(false), toast(`${p.name} waived and stretched`))}>Waive & stretch</Button>
          )}
          <Button variant="ghost" onClick={() => setWaive(false)}>
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}
