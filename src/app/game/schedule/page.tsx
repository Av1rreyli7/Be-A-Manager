"use client";
import Link from "next/link";
import { useState } from "react";
import clsx from "clsx";
import { useLeague, useTeamId } from "@/lib/store";
import { Card, PageHeader, TeamBadge, inputCls } from "@/components/ui";
import { fmtDate } from "@/engine/util/dates";

export default function SchedulePage() {
  const l = useLeague();
  const myTeam = useTeamId();
  const [team, setTeam] = useState(myTeam);
  const [all, setAll] = useState(false);
  const games = l.schedule.filter((g) => all || g.home === team || g.away === team).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const days = new Map<string, typeof games>();
  for (const g of games) days.set(g.date, [...(days.get(g.date) ?? []), g]);
  const months = new Map<string, string[]>();
  for (const d of days.keys()) {
    const m = d.slice(0, 7);
    months.set(m, [...(months.get(m) ?? []), d]);
  }
  return (
    <div className="space-y-4">
      <PageHeader
        title="Schedule"
        sub={all ? "League-wide" : l.teams[team].fullName}
        right={
          <>
            <select aria-label="Team" className={inputCls} style={{ width: "auto" }} value={team} onChange={(e) => (setTeam(e.target.value), setAll(false))}>
              {Object.values(l.teams).sort((a, b) => a.fullName.localeCompare(b.fullName)).map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
            </select>
            <label className="flex items-center gap-1 text-sm"><input type="checkbox" className="k-check" checked={all} onChange={(e) => setAll(e.target.checked)} /> All games</label>
          </>
        }
      />
      {[...months.entries()].map(([m, ds]) => (
        <Card key={m} title={fmtDate(`${m}-15`, { month: "long", year: "numeric" })} pad={false}>
          <div className="divide-y divide-line/60">
            {ds.flatMap((d) => days.get(d)!).map((g) => {
              const mine = !all && (g.home === team || g.away === team);
              const home = g.home === team;
              const won = g.result && (home ? g.result.homeScore > g.result.awayScore : g.result.awayScore > g.result.homeScore);
              return (
                <div key={g.id} className={clsx("grid grid-cols-[64px_1fr_auto] items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-ink/[0.03] sm:grid-cols-[96px_1fr_150px_130px]", !g.result && "text-dim")}>
                  <span className="font-num text-[12px] font-bold uppercase text-mute">{fmtDate(g.date, { weekday: "short", month: "short", day: "numeric" })}</span>
                  <span className="flex min-w-0 items-center gap-2">
                    {mine ? (
                      <>
                        <span className="text-mute">{home ? "vs" : "@"}</span>
                        <TeamBadge league={l} teamId={home ? g.away : g.home} withName />
                      </>
                    ) : (
                      <>
                        <TeamBadge league={l} teamId={g.away} size="sm" /> <span className="text-mute">@</span> <TeamBadge league={l} teamId={g.home} size="sm" />
                      </>
                    )}
                    {g.type !== "regular" && <span className="hidden sm:inline"><span className="k-tag">{g.round ?? (g.type === "cup-group" ? `Cup · ${g.cupGroup}` : g.type)}</span></span>}
                  </span>
                  <span className="hidden text-xs text-dim sm:block">{g.result ? `${g.result.topHome.name.split(" ").pop()} ${g.result.topHome.pts} / ${g.result.topAway.name.split(" ").pop()} ${g.result.topAway.pts}` : ""}</span>
                  {g.result ? (
                    <Link href={`/game/box/${encodeURIComponent(g.id)}`} className="flex items-center justify-end gap-2 hover:text-accent">
                      {mine && <span className={clsx("grid h-5 w-5 place-items-center rounded-[2px] font-num text-xs font-black", won ? "bg-good text-bg" : "bg-bad text-bg")}>{won ? "W" : "L"}</span>}
                      <span className="font-num text-[14px] font-bold num">{g.result.awayScore}-{g.result.homeScore}{g.result.ot ? ` (${g.result.ot}OT)` : ""}</span>
                    </Link>
                  ) : (
                    <span className="text-right text-xs text-mute">-</span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}
