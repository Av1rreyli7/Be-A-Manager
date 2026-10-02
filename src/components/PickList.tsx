"use client";
import clsx from "clsx";
import { useLeague, useTeamId } from "@/lib/store";
import { TeamBadge } from "./ui";
import { conveyProbability, pickValue, projectedSlot } from "@/engine/trade/value";
import type { PickAsset } from "@/engine/types/game";

/** Picks a team owns (incoming included) and owes, with protections and estimated value. */
export function PickList({ teamId, showOwed = true }: { teamId: string; showOwed?: boolean }) {
  const l = useLeague();
  const me = useTeamId();
  const owned = Object.values(l.picks).filter((k) => k.owner === teamId).sort((a, b) => a.year - b.year || a.round - b.round);
  const owed = Object.values(l.picks).filter((k) => k.originalTeam === teamId && k.owner !== teamId).sort((a, b) => a.year - b.year || a.round - b.round);
  const row = (k: PickAsset, dir: "own" | "owed") => (
    <tr key={k.id} className={clsx("border-t border-line/50", k.forfeited && "opacity-40 line-through")}>
      <td className="py-1.5 pr-2 font-semibold">{k.year}</td>
      <td className="pr-2">{k.round === 1 ? "1st" : "2nd"}</td>
      <td className="pr-2"><TeamBadge league={l} teamId={dir === "own" ? k.originalTeam : k.owner} size="sm" /></td>
      <td className="pr-2 text-xs text-dim">
        {k.protection.kind === "none" ? "Unprotected" : k.protection.kind === "top" ? `Top-${k.protection.keepTop} protected` : <span title={k.protection.text}>{k.protection.text.slice(0, 70)}{k.protection.text.length > 70 ? "…" : ""}</span>}
        {k.swap && <span className="chip ml-1">swap</span>}
        {k.conditional && <span className="chip ml-1">conditional</span>}
        {k.frozen && <span className="chip ml-1 text-bad">frozen</span>}
        {k.forfeited && <span className="chip ml-1">forfeited</span>}
      </td>
      <td className="pr-2 text-right text-xs num">#{Math.round(projectedSlot(l, k))}{k.protection.kind !== "none" ? ` · ${Math.round(conveyProbability(l, k) * 100)}% conveys` : ""}</td>
      <td className="text-right font-semibold num">{pickValue(l, k, me).toFixed(1)}</td>
    </tr>
  );
  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="label">
          <tr><th className="text-left">Year</th><th className="text-left">Rd</th><th className="text-left">Via / to</th><th className="text-left">Terms</th><th className="text-right">Proj.</th><th className="text-right">Value</th></tr>
        </thead>
        <tbody>
          {owned.map((k) => row(k, "own"))}
          {showOwed && owed.length > 0 && (
            <>
              <tr><td colSpan={6} className="pt-3 text-[11px] font-bold uppercase tracking-wider text-bad">Owed to other teams</td></tr>
              {owed.map((k) => row(k, "owed"))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
