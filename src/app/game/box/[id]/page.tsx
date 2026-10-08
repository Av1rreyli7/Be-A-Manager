"use client";
import { useParams } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { useLeague } from "@/lib/store";
import { Card, Empty, PlayerLink, Tabs, TeamMark } from "@/components/ui";
import type { BoxLine } from "@/engine/types/game";
import { fmtDate } from "@/engine/util/dates";

export default function BoxPage() {
  const { id } = useParams<{ id: string }>();
  const l = useLeague();
  const [tab, setTab] = useState<"box" | "pbp">("box");
  const b = l.boxScores[decodeURIComponent(id)];
  if (!b) return <Empty>No box score. Only this season&apos;s games are kept.</Empty>;
  const s = b.summary;
  const teamName = (t: string) => l.teams[t]?.fullName ?? (t === "EAST" ? "Team East" : t === "WEST" ? "Team West" : t);
  const quarters = s.quarters.home.length;
  return (
    <div className="space-y-4">
      <h1 className="sr-only">{teamName(b.away)} at {teamName(b.home)}</h1>
      <section className="k-panel k-flush">
        <header className="k-controls">
          <h2 className="k-panel-title" style={{ marginRight: "auto" }}>Final{quarters > 4 ? `/${quarters - 4 > 1 ? quarters - 4 : ""}OT` : ""}</h2>
          <span className="k-msub">{fmtDate(b.date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · <span className="capitalize">{b.type}</span></span>
        </header>
        <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
          {([["away", b.away, s.awayScore, s.homeScore], ["home", b.home, s.homeScore, s.awayScore]] as const).map(([side, t, sc, other], i) => {
            const team = l.teams[t];
            const won = sc > other;
            return (
              <div key={side} className={clsx("relative flex items-center gap-3 overflow-hidden px-4 py-5 sm:px-6", i === 1 && "order-3 flex-row-reverse text-right")}>
                <div className="relative">{team ? <TeamMark id={team.id} colors={team.colors} size="lg" /> : <span className="font-num text-[19px]">{t}</span>}</div>
                <div className="relative min-w-0 flex-1">
                  <div className="truncate font-display text-[15px] font-extrabold uppercase leading-none sm:text-[19px]">{team?.name ?? teamName(t)}</div>
                  <div className="text-xs text-dim">{side === "away" ? "Away" : "Home"}</div>
                </div>
                <b className={clsx("k-cmv relative", !won && "!text-mute")}>{sc}</b>
              </div>
            );
          })}
          <div className="order-2 grid place-items-center border-x border-line px-2 font-num text-[12px] font-black text-mute">@</div>
        </div>
        <div className="scroll-thin overflow-x-auto border-t border-line">
          <table className="k-table">
            <thead><tr><th>Team</th>{Array.from({ length: quarters }, (_, i) => <th key={i} className="k-num">{i < 4 ? `Q${i + 1}` : `OT${i - 3}`}</th>)}<th className="k-num">T</th></tr></thead>
            <tbody>
              <tr><td>{b.away}</td>{s.quarters.away.map((q, i) => <td key={i} className="k-num">{q}</td>)}<td className="k-num font-bold">{s.awayScore}</td></tr>
              <tr><td>{b.home}</td>{s.quarters.home.map((q, i) => <td key={i} className="k-num">{q}</td>)}<td className="k-num font-bold">{s.homeScore}</td></tr>
            </tbody>
          </table>
        </div>
        {b.injuries.length > 0 && <p className="border-t border-line px-4 py-2 text-center text-xs text-bad">Injuries: {b.injuries.map((i) => `${l.players[i.playerId]?.name} (${i.type}, ~${i.daysOut}d)`).join(", ")}</p>}
      </section>
      <Tabs tabs={[{ id: "box", label: "Box score" }, ...(b.pbp ? [{ id: "pbp" as const, label: "Play-by-play" }] : [])]} value={tab} onChange={setTab} />
      {tab === "box" ? (
        (["away", "home"] as const).map((side) => (
          <Card key={side} title={teamName(b[side])} pad={false}>
            <BoxTable lines={b.lines[side]} />
            <div className="flex flex-wrap gap-3 border-t border-line px-3 py-2 text-xs text-dim">
              {Object.entries({ "Fast break": b.teamStats[side].fastBreak, Paint: b.teamStats[side].paint, "2nd chance": b.teamStats[side].secondChance, Bench: b.teamStats[side].bench, "Largest lead": b.teamStats[side].largestLead }).map(([k, v]) => (
                <span key={k}>{k}: <b className="text-ink">{v}</b></span>
              ))}
            </div>
          </Card>
        ))
      ) : (
        <Card pad={false}>
          <ul className="max-h-[70vh] overflow-y-auto scroll-thin text-sm">
            {b.pbp!.map((e, i) => (
              <li key={i} className={clsx("grid grid-cols-[48px_56px_60px_1fr] gap-2 border-b border-line/40 px-3 py-1", /makes|free throws/.test(e.text) && "text-ink", !/makes/.test(e.text) && "text-dim")}>
                <span className="text-mute">{e.q <= 4 ? `Q${e.q}` : `OT${e.q - 4}`}</span>
                <span className="num text-mute">{e.clock}</span>
                <span className="font-semibold">{e.team ?? ""}</span>
                <span>{e.text} <span className="text-mute num">({e.score[1]}-{e.score[0]})</span></span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function BoxTable({ lines }: { lines: BoxLine[] }) {
  const l = useLeague();
  const played = [...lines].sort((a, b) => Number(b.starter) - Number(a.starter) || b.min - a.min);
  const tot = played.reduce((t, x) => ({ fgm: t.fgm + x.fgm, fga: t.fga + x.fga, fg3m: t.fg3m + x.fg3m, fg3a: t.fg3a + x.fg3a, ftm: t.ftm + x.ftm, fta: t.fta + x.fta, reb: t.reb + x.oreb + x.dreb, ast: t.ast + x.ast, stl: t.stl + x.stl, blk: t.blk + x.blk, tov: t.tov + x.tov, pts: t.pts + x.pts }), { fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pts: 0 });
  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="k-table min-w-[720px]">
        <thead>
          <tr>{["Player", "MIN", "PTS", "REB", "AST", "STL", "BLK", "TO", "FG", "3P", "FT", "PF", "+/-"].map((h) => <th key={h} className={clsx(h !== "Player" && "k-num")}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {played.map((x) => (
            <tr key={x.playerId} className={clsx(x.min === 0 && "text-mute")}>
              <td>{l.players[x.playerId] ? <PlayerLink player={l.players[x.playerId]} /> : x.name}{x.starter && <span className="ml-1 text-[10px] text-accent">S</span>}</td>
              {x.min === 0 ? <td colSpan={12} className="k-num">DNP</td> : (
                <>
                  <td className="k-num">{x.min.toFixed(0)}</td>
                  <td className="k-num font-bold">{x.pts}</td>
                  <td className="k-num">{x.oreb + x.dreb}</td>
                  <td className="k-num">{x.ast}</td>
                  <td className="k-num">{x.stl}</td>
                  <td className="k-num">{x.blk}</td>
                  <td className="k-num">{x.tov}</td>
                  <td className="k-num">{x.fgm}-{x.fga}</td>
                  <td className="k-num">{x.fg3m}-{x.fg3a}</td>
                  <td className="k-num">{x.ftm}-{x.fta}</td>
                  <td className="k-num">{x.pf}</td>
                  <td className={clsx("k-num", x.pm > 0 ? "text-good" : x.pm < 0 ? "text-bad" : "")}>{x.pm > 0 ? `+${x.pm}` : x.pm}</td>
                </>
              )}
            </tr>
          ))}
          <tr className="font-semibold">
            <td>Totals</td><td />
            <td className="k-num">{tot.pts}</td><td className="k-num">{tot.reb}</td><td className="k-num">{tot.ast}</td><td className="k-num">{tot.stl}</td><td className="k-num">{tot.blk}</td><td className="k-num">{tot.tov}</td>
            <td className="k-num">{tot.fgm}-{tot.fga}</td><td className="k-num">{tot.fg3m}-{tot.fg3a}</td><td className="k-num">{tot.ftm}-{tot.fta}</td><td /><td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
