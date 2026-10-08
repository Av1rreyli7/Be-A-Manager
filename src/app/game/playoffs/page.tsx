"use client";
import clsx from "clsx";
import { Trophy } from "@phosphor-icons/react";
import { useLeague } from "@/lib/store";
import { Appear, Card, Empty, PageHeader, TeamBadge } from "@/components/ui";
import type { League, PlayoffSeries } from "@/engine/types/game";
import { groupTable } from "@/engine/season/cup";
import { roundName } from "@/engine/season/playoffs";
import { conferenceStandings } from "@/engine/season/standings";

function Series({ l, s }: { l: League; s?: PlayoffSeries }) {
  if (!s) return <div className="h-[70px] rounded-[4px] border border-dashed border-line" />;
  return (
    <div className={clsx("overflow-hidden rounded-[4px] border bg-bg/60 text-sm", s.winner ? "border-line" : "border-line-2 shadow-[inset_0_2px_0_var(--accent)]")}>
      {[{ t: s.high, seed: s.highSeed, w: s.winsHigh }, { t: s.low, seed: s.lowSeed, w: s.winsLow }].map((x) => (
        <div key={x.t} className={clsx("flex items-center justify-between gap-2 border-b border-line/60 px-2 py-1 last:border-0", s.winner && s.winner !== x.t && "opacity-40", s.winner === x.t && "bg-accent/10")}>
          <span className="flex items-center gap-2">
            {s.conference !== "Finals" && <span className="w-4 text-xs text-mute">{x.seed}</span>}
            <TeamBadge league={l} teamId={x.t} size="sm" withName />
          </span>
          <span className={clsx("grid h-7 w-7 place-items-center font-num text-[17px] font-black num", s.winner === x.t ? "bg-accent text-accent-ink" : "text-ink")}>{x.w}</span>
        </div>
      ))}
    </div>
  );
}

export default function PlayoffsPage() {
  const l = useLeague();
  const find = (conf: string, round: number, i: number) => l.playoffs.filter((s) => s.conference === conf && s.round === round)[i];
  const finals = l.playoffs.find((s) => s.conference === "Finals");
  const projected = l.playoffs.length === 0;
  return (
    <div className="space-y-4">
      <PageHeader title="Playoffs & NBA Cup" sub={projected ? "Bracket shows projected seeds until the regular season ends" : finals?.winner ? `${l.teams[finals.winner].fullName} are champions` : "Postseason in progress"} />
      {l.playIn.length > 0 && (
        <Card title="Play-In Tournament">
          <div className="grid gap-3 md:grid-cols-2">
            {(["East", "West"] as const).map((c) => (
              <div key={c} className="space-y-2">
                <div className="k-mlab">{c}</div>
                {l.playIn.filter((g) => g.conference === c).map((g) => (
                  <div key={g.id} className="k-inset flex items-center justify-between p-2 text-sm">
                    <span className="k-tag">{g.kind === "final" ? "For the 8 seed" : g.kind === "7v8" ? "7 vs 8" : "9 vs 10"}</span>
                    <span className="flex items-center gap-2"><TeamBadge league={l} teamId={g.away} size="sm" /> @ <TeamBadge league={l} teamId={g.home} size="sm" /></span>
                    <span className="text-xs">{g.winner ? <b className="text-accent">{g.winner} advance</b> : "-"}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Card>
      )}
      <Card title="Bracket">
        {projected ? (
          <div className="grid gap-4 md:grid-cols-2">
            {(["East", "West"] as const).map((c) => {
              const s = conferenceStandings(l, c);
              return (
                <div key={c} className="space-y-2">
                  <div className="k-mlab">{c} (projected)</div>
                  {[[0, 7], [3, 4], [2, 5], [1, 6]].map(([a, b]) => (
                    <div key={a} className="flex items-center justify-between rounded-[4px] border border-dashed border-line-2 p-2 text-sm">
                      <span className="flex items-center gap-2"><span className="text-xs text-mute">{a + 1}</span><TeamBadge league={l} teamId={s[a]} size="sm" withName /></span>
                      <span className="flex items-center gap-2"><TeamBadge league={l} teamId={s[b]} size="sm" /><span className="text-xs text-mute">{b + 1}{b >= 6 ? "*" : ""}</span></span>
                    </div>
                  ))}
                </div>
              );
            })}
            <p className="text-xs text-mute md:col-span-2">* decided in the Play-In Tournament</p>
          </div>
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <div className="grid min-w-[980px] grid-cols-7 items-center gap-3">
              <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Series key={i} l={l} s={find("West", 1, i)} />)}</div>
              <div className="space-y-12">{[0, 1].map((i) => <Series key={i} l={l} s={find("West", 2, i)} />)}</div>
              <div><Series l={l} s={find("West", 3, 0)} /></div>
              <div>
                <div className="mb-2 flex items-center justify-center gap-1.5 font-display text-[14px] font-black uppercase tracking-[0.14em] text-accent"><Trophy size={16} weight="fill" /> NBA Finals</div>
                <Series l={l} s={finals} />
                {finals?.winner && <Appear kind="celebrate" sparks className="mt-3 flex items-center justify-center gap-2 bg-[image:var(--k-grad-gold)] px-2 py-1.5 font-display text-[17px] font-black uppercase text-bg chamfer"><Trophy size={18} weight="fill" /> {l.teams[finals.winner].name}</Appear>}
              </div>
              <div><Series l={l} s={find("East", 3, 0)} /></div>
              <div className="space-y-12">{[0, 1].map((i) => <Series key={i} l={l} s={find("East", 2, i)} />)}</div>
              <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Series key={i} l={l} s={find("East", 1, i)} />)}</div>
            </div>
            <div className="k-label mt-2 grid min-w-[980px] grid-cols-7 text-center">
              {["West R1", "West Semis", "West Finals", "", "East Finals", "East Semis", "East R1"].map((x, i) => <span key={i}>{x}</span>)}
            </div>
          </div>
        )}
        {!projected && <p className="mt-2 text-xs text-mute">{l.playoffs.filter((s) => !s.winner).map((s) => `${roundName(s)}: ${s.high} ${s.winsHigh}-${s.winsLow} ${s.low}`).join(" · ")}</p>}
      </Card>

      <Card title={`NBA Cup ${l.cup?.season ?? ""}`}>
        {!l.cup ? (
          <Empty>The NBA Cup runs in full-length seasons.</Empty>
        ) : (
          <>
            {l.cup.champion && (
              <Appear className="mb-4 flex flex-wrap items-center gap-3 rounded-[4px] bg-gold/12 px-4 py-3 shadow-[inset_3px_0_0_var(--color-gold)]">
                <Trophy size={28} weight="fill" className="text-gold" />
                <div>
                  <div className="font-display text-[19px] font-black uppercase leading-none">{l.teams[l.cup.champion].fullName}</div>
                  <div className="text-sm text-dim">NBA Cup champions{l.cup.mvp ? `. MVP: ${l.players[l.cup.mvp]?.name ?? ""}` : ""}</div>
                </div>
              </Appear>
            )}
            {l.cup.knockout.qf.length > 0 && (
              <div className="mb-4 grid gap-2 sm:grid-cols-3">
                {[...l.cup.knockout.qf, ...l.cup.knockout.sf, ...(l.cup.knockout.final ? [l.cup.knockout.final] : [])].map((m) => (
                  <div key={m.id} className="k-inset flex items-center justify-between p-2 text-sm">
                    <span className="k-tag">{m.id.includes("qf") ? "QF" : m.id.includes("sf") ? "SF" : "Final"}</span>
                    <span className="flex items-center gap-1"><TeamBadge league={l} teamId={m.away} size="sm" /> @ <TeamBadge league={l} teamId={m.home} size="sm" /></span>
                    <span className="text-xs font-bold text-accent">{m.winner ?? "-"}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-3">
              {Object.keys(l.cup.groups).map((g) => (
                <div key={g} className="k-inset p-2">
                  <div className="k-mlab mb-1">{g}</div>
                  <table className="k-table">
                    <tbody>
                      {groupTable(l, g).map((r, i) => (
                        <tr key={r.teamId} className={i === 0 ? "text-ink" : "text-dim"}>
                          <td><TeamBadge league={l} teamId={r.teamId} size="sm" withName /></td>
                          <td className="k-num">{r.w}-{r.l}</td>
                          <td className="k-num w-12">{r.pd > 0 ? `+${r.pd}` : r.pd}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
