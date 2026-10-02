"use client";
import { Trophy } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { useGame, useLeague, useTeamId } from "@/lib/store";
import { Button, Card, Empty, OvrPot, PageHeader, PlayerLink, Rating, TeamBadge } from "@/components/ui";
import { PHASE_LABEL, money } from "@/lib/format";
import { decideTeamOption, extendQualifyingOffer, pendingDecisions } from "@/engine/offseason/freeAgency";
import { teamPlayers } from "@/engine/league/helpers";
import type { Phase } from "@/engine/types/game";

const ORDER: Phase[] = ["season-end", "draft-lottery", "pre-draft", "draft", "options", "free-agency", "summer-league", "training-camp", "preseason"];

function LotteryReveal() {
  const l = useLeague();
  const me = useTeamId();
  const res = l.draft?.lottery?.results ?? [];
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setShown((s) => (s >= res.length ? s : s + 1)), 650);
    return () => clearInterval(id);
  }, [res.length]);
  const ordered = [...res].sort((a, b) => b.pick - a.pick); // reveal 14 → 1
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ordered.map((r, i) => (
        <div key={r.teamId} className={clsx("flex items-center justify-between rounded-[4px] border border-line px-3 py-2", i < shown ? "anim-flip" : "opacity-0", r.teamId === me && "border-accent bg-accent/10", r.pick <= 4 && "shadow-[0_0_24px_-10px_rgba(255,90,31,.8)]")}>
          <span className="font-display text-3xl font-black num">#{r.pick}</span>
          <TeamBadge league={l} teamId={r.teamId} withName />
          <span className={clsx("text-xs font-semibold", r.pick < r.preLottery ? "text-good" : r.pick > r.preLottery ? "text-bad" : "text-dim")}>
            {r.pick < r.preLottery ? `▲ ${r.preLottery - r.pick}` : r.pick > r.preLottery ? `▼ ${r.pick - r.preLottery}` : "-"} (was {r.preLottery})
          </span>
        </div>
      ))}
    </div>
  );
}

export default function OffseasonHub() {
  const l = useLeague();
  const me = useTeamId();
  const mutate = useGame((s) => s.mutate);
  const advance = useGame((s) => s.advancePhase);
  const busy = useGame((s) => s.busy);
  const idx = ORDER.indexOf(l.phase);
  const hist = [...l.history].reverse().find((h) => h.champion || h.awards.length);
  const decisions = l.phase === "options" ? pendingDecisions(l, me) : [];
  const progression = teamPlayers(l, me)
    .map((p) => ({ p, prev: p.ratingHistory[p.ratingHistory.length - 2], cur: p.ratingHistory[p.ratingHistory.length - 1] }))
    .filter((x) => x.prev && x.cur && x.cur.season === l.season)
    .sort((a, b) => b.cur.ovr - b.prev.ovr - (a.cur.ovr - a.prev.ovr));

  return (
    <div className="space-y-4">
      <PageHeader title="Offseason Hub" sub={idx >= 0 ? `Current step: ${PHASE_LABEL[l.phase]}` : "The offseason begins when the Finals end."} />
      <div className="scroll-thin flex gap-1 overflow-x-auto pb-1">
        {ORDER.map((p, i) => (
          <div key={p} className={clsx("flex min-w-32 flex-1 flex-col rounded-[4px] border px-3 py-2 text-xs", i === idx ? "border-accent bg-accent/10 text-ink" : i < idx ? "border-line text-mute line-through" : "border-line text-dim")}>
            <span className="font-display text-lg font-bold">{i + 1}</span>
            {PHASE_LABEL[p]}
          </div>
        ))}
      </div>

      {idx < 0 && <Empty>Keep simming: once the NBA Finals end you&apos;ll run the full offseason from here.</Empty>}

      {l.phase === "season-end" && hist && (
        <Card title={`${hist.season} in review`}>
          {hist.champion && <p className="mb-3 flex flex-wrap items-center gap-2 font-display text-2xl font-black uppercase"><Trophy size={24} weight="fill" className="text-gold" /> {l.teams[hist.champion].fullName}{hist.finalsMvp && <span className="ml-2 text-base font-semibold normal-case text-dim">Finals MVP {l.players[hist.finalsMvp]?.name}</span>}</p>}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {hist.awards.filter((a) => !a.award.startsWith("All-") && a.award !== "Finals MVP").map((a) => (
              <div key={a.award} className="rounded-[4px] border border-line px-3 py-2 text-sm"><div className="label">{a.award}</div>{a.playerId ? <PlayerLink player={l.players[a.playerId]} /> : a.name}</div>
            ))}
          </div>
          <div className="mt-4">
            <div className="mb-1 label">Retirements</div>
            <p className="text-sm text-dim">{Object.values(l.players).filter((p) => p.retiredSeason === l.season).sort((a, b) => b.ovr - a.ovr).slice(0, 12).map((p) => p.name).join(", ") || "None"}</p>
          </div>
        </Card>
      )}

      {l.phase === "draft-lottery" && <Card title="Draft lottery results"><LotteryReveal /></Card>}
      {(l.phase === "pre-draft" || l.phase === "draft") && (
        <Card title="Draft">
          <p className="text-sm">Scout prospects, check the combine and run workouts, then make your picks.</p>
          <Link href="/game/draft" className="mt-2 inline-block text-accent">Go to Draft & Scouting →</Link>
        </Card>
      )}

      {l.phase === "options" && (
        <Card title="Team options & qualifying offers">
          {decisions.length === 0 ? <Empty>No decisions pending. Player options were decided by the players.</Empty> : (
            <ul className="divide-y divide-line">
              {decisions.map((d) => {
                const p = l.players[d.playerId];
                return (
                  <li key={d.playerId + d.kind} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="flex items-center gap-2"><PlayerLink player={p} /><OvrPot p={p} /><span className="text-xs text-dim">{d.kind === "team-option" ? `Team option ${money(d.amount)}` : `Qualifying offer ${money(d.amount)} → restricted FA`}</span></span>
                    <span className="flex gap-2">
                      {d.kind === "team-option" ? (
                        <>
                          <Button size="sm" variant="success" onClick={() => mutate((lg) => decideTeamOption(lg, d.playerId, true))}>Exercise</Button>
                          <Button size="sm" variant="danger" onClick={() => mutate((lg) => decideTeamOption(lg, d.playerId, false))}>Decline</Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="success" onClick={() => mutate((lg) => extendQualifyingOffer(lg, d.playerId, true))}>Extend QO</Button>
                          <Button size="sm" variant="ghost" onClick={() => mutate((lg) => extendQualifyingOffer(lg, d.playerId, false))}>Decline QO (UFA)</Button>
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-mute">Undecided team options are resolved automatically when free agency opens. Extensions are negotiated on the Contracts page.</p>
        </Card>
      )}

      {l.phase === "free-agency" && (
        <Card title="Free agency">
          <p className="text-sm">Day {l.freeAgency.day}. Make offers, match offer sheets and renounce cap holds; sim days from the top bar.</p>
          <Link href="/game/free-agency" className="mt-2 inline-block text-accent">Go to Free Agency →</Link>
          <ul className="mt-3 max-h-60 overflow-y-auto text-xs text-dim scroll-thin">{l.freeAgency.log.slice(0, 40).map((x, i) => <li key={i}>{x}</li>)}</ul>
        </Card>
      )}

      {l.phase === "summer-league" && (
        <Card title="Summer League">
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {teamPlayers(l, me).filter((p) => p.summerLeague).map((p) => <li key={p.id} className="flex justify-between"><PlayerLink player={p} /><span className="num">{p.summerLeague!.ppg} ppg {p.summerLeague!.boost > 0.5 ? "🔥" : ""}</span></li>)}
          </ul>
        </Card>
      )}

      {l.phase === "training-camp" && (
        <Card title="Training camp: development report">
          {progression.length === 0 ? <Empty>No changes recorded.</Empty> : (
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {progression.map(({ p, prev, cur }) => {
                const d = cur.ovr - prev.ovr;
                return (
                  <li key={p.id} className="anim-rise flex items-center justify-between rounded-[4px] border border-line px-3 py-1.5 text-sm">
                    <PlayerLink player={p} />
                    <span className="flex items-center gap-2"><Rating value={prev.ovr} className="opacity-50" />→<Rating value={cur.ovr} /><b className={d > 0 ? "text-good" : d < 0 ? "text-bad" : "text-dim"}>{d > 0 ? `+${d}` : d}</b></span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {idx >= 0 && l.phase !== "preseason" && (
        <Button variant="primary" disabled={!!busy} onClick={() => advance()}>Continue to {PHASE_LABEL[ORDER[idx + 1]] ?? "next phase"}</Button>
      )}
    </div>
  );
}
