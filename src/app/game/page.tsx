"use client";
import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, Basketball, FastForward, FirstAidKit, Warning, WarningOctagon, Info } from "@phosphor-icons/react";
import { useGame, useIsOnlineGuest, useLeague, useTeamId } from "@/lib/store";
import { Button, Card, PlayerLink, Stat, TeamBadge, TeamMark } from "@/components/ui";
import { playableGame } from "@/lib/hardwood";
import { conferenceStandings, emptyRecord, gamesBack } from "@/engine/season/standings";
import { capStatus } from "@/engine/cap/payroll";
import { money, PHASE_LABEL, STATUS_COLOR, STATUS_LABEL, f1 } from "@/lib/format";
import { fmtDate } from "@/engine/util/dates";
import { teamPlayers } from "@/engine/league/helpers";
import { perGame, seasonTotal } from "@/engine/season/stats";
import { NewsList } from "@/components/NewsList";

export default function Dashboard() {
  const l = useLeague();
  const t = useTeamId();
  const team = l.teams[t];
  const rec = l.standings[t] ?? emptyRecord(t);
  const conf = conferenceStandings(l, team.conference);
  const seed = conf.indexOf(t) + 1;
  const next = l.schedule.find((g) => !g.played && (g.home === t || g.away === t));
  const recent = l.schedule.filter((g) => g.played && (g.home === t || g.away === t)).slice(-5).reverse();
  const cap = capStatus(l, t);
  const roster = teamPlayers(l, t);
  const leaders = (["pts", "reb", "ast"] as const).map((k) => {
    const rows = roster.map((p) => ({ p, pg: perGame(seasonTotal(l, p.id)) })).filter((x) => x.pg.gp > 0);
    const best = rows.sort((a, b) => b.pg[k] - a.pg[k])[0];
    return { k, best };
  });
  const injured = roster.filter((p) => p.injury);
  const gp = rec.w + rec.l;
  const opp = next ? l.teams[next.home === t ? next.away : next.home] : null;
  const gameDay = playableGame(l, t);
  const guest = useIsOnlineGuest();
  const busy = useGame((s) => s.busy);
  const sim = useGame((s) => s.sim);
  const inSeason = ["preseason", "regular", "play-in", "playoffs"].includes(l.phase);

  return (
    <div className="space-y-5">
      <h1 className="sr-only">{team.fullName} dashboard</h1>

      {/* scoreboard hero */}
      <section className="panel on-dark relative overflow-hidden">
        <div aria-hidden className="hero-wash absolute inset-0" />
        <div aria-hidden className="stripes absolute inset-0 [mask-image:linear-gradient(90deg,black,transparent_60%)]" />
        <div className="relative grid gap-6 p-4 sm:p-6 lg:grid-cols-[1.5fr_1fr] lg:items-end">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <TeamMark id={team.id} colors={team.colors} size="xl" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white/75">{team.city}</div>
                <div className="truncate font-display text-[44px] font-black uppercase leading-[0.85] tracking-[0.005em] text-white sm:text-[64px]">{team.name}</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="chip !bg-black/30 !text-white/85">{l.season}</span>
              <span className="chip !bg-black/30 !text-white/85">{PHASE_LABEL[l.phase]}</span>
              <span className="chip !bg-black/30 !text-white/85">{team.strategy.mode}</span>
              <span className="chip !bg-black/30 !text-white/85">Hype {Math.round(team.hype)}</span>
            </div>
            <dl className="mt-5 grid max-w-xl grid-cols-[1.3fr_1fr_1fr_1fr] divide-x divide-white/15 rounded-[4px] bg-black/30 py-3 backdrop-blur-sm">
              <div className="min-w-0 px-2.5 sm:px-4">
                <dt className="label !text-white/60">Record</dt>
                <dd className="whitespace-nowrap font-display text-[30px] font-black leading-none text-white num sm:text-5xl">{rec.w}-{rec.l}</dd>
              </div>
              <div className="min-w-0 px-2.5 sm:px-4">
                <dt className="label !text-white/60">Seed</dt>
                <dd className="whitespace-nowrap font-display text-[30px] font-black leading-none text-white num sm:text-5xl">{seed || "-"}</dd>
              </div>
              <div className="min-w-0 px-2.5 sm:px-4">
                <dt className="label !text-white/60">Streak</dt>
                <dd className={clsx("whitespace-nowrap font-display text-[30px] font-black leading-none num sm:text-5xl", rec.streak > 0 ? "text-good" : rec.streak < 0 ? "text-bad" : "text-white")}>{rec.streak > 0 ? `W${rec.streak}` : rec.streak < 0 ? `L${-rec.streak}` : "-"}</dd>
              </div>
              <div className="min-w-0 px-2.5 sm:px-4">
                <dt className="label !text-white/60">Net</dt>
                <dd className="whitespace-nowrap font-display text-[30px] font-black leading-none text-white num sm:text-5xl">{gp ? f1((rec.pf - rec.pa) / gp) : "-"}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-[6px] border border-white/10 bg-bg/70 p-4 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-black uppercase tracking-[0.12em] text-accent">Up next</span>
              {next && <span className="text-xs font-semibold text-dim">{fmtDate(next.date, { weekday: "short", month: "short", day: "numeric" })}</span>}
            </div>
            {next && opp ? (
              <>
                <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <MatchSide league={l} id={next.away} />
                  <span className="font-display text-lg font-black text-mute">@</span>
                  <MatchSide league={l} id={next.home} right />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-dim">
                  <span>{next.home === t ? "Home" : "Road"} game vs {opp.name}</span>
                  {next.type !== "regular" && <span className="chip !text-accent">{next.round ?? next.type}</span>}
                </div>
                {inSeason && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                    {gameDay?.id === next.id ? (
                      <>
                        <Link href={`/game/play?g=${encodeURIComponent(next.id)}`} className="relative isolate inline-flex h-9 items-center gap-1.5 px-4 text-sm font-bold text-accent-ink transition-transform active:translate-y-px before:absolute before:inset-0 before:-z-10 before:-skew-x-[10deg] before:rounded-[3px] before:bg-accent hover:before:brightness-110">
                          <Basketball size={15} weight="fill" /> Play it
                        </Link>
                        {!guest && (
                          <Button disabled={!!busy} onClick={() => void sim("day")} title="Sim today, including your game">
                            Sim it
                          </Button>
                        )}
                        <span className="w-full text-xs text-dim">Game day. Play it yourself in Hardwood Legends, or let the sim decide.</span>
                      </>
                    ) : guest ? (
                      <span className="text-xs text-dim">On game day you can play this one yourself in Hardwood Legends.</span>
                    ) : (
                      <>
                        <Button disabled={!!busy} onClick={() => void sim("game-day")}>
                          <FastForward size={14} weight="fill" /> Sim to game day
                        </Button>
                        <span className="w-full text-xs text-dim">Stops on the morning of the game so you can play it yourself.</span>
                      </>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="mt-3 text-sm text-dim">No games on the calendar. Use the phase button up top to move the season along.</p>
            )}
          </div>
        </div>
      </section>

      {l.alerts.length > 0 && (
        <ul className="stagger grid gap-2 md:grid-cols-2">
          {l.alerts.map((a, i) => {
            const I = a.level === "danger" ? WarningOctagon : a.level === "warn" ? Warning : Info;
            return (
              <li key={a.id} style={{ ["--i" as string]: i }}>
                <Link
                  href={a.href ?? "/game"}
                  className={clsx(
                    "panel group flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:border-line-2",
                    a.level === "danger" ? "shadow-[inset_3px_0_0_var(--color-bad)]" : a.level === "warn" ? "shadow-[inset_3px_0_0_var(--color-warn)]" : "shadow-[inset_3px_0_0_var(--color-info)]",
                  )}
                >
                  <I size={18} weight="fill" className={clsx("shrink-0", a.level === "danger" ? "text-bad" : a.level === "warn" ? "text-warn" : "text-info")} />
                  <span className="min-w-0 flex-1">{a.text}</span>
                  <ArrowRight size={14} className="shrink-0 text-mute transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {recent.length > 0 && (
        <section aria-label="Last five games" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {recent.map((g, i) => {
            const home = g.home === t;
            const my = home ? g.result!.homeScore : g.result!.awayScore;
            const op = home ? g.result!.awayScore : g.result!.homeScore;
            const win = my > op;
            return (
              <Link key={g.id} href={`/game/box/${encodeURIComponent(g.id)}`} className={clsx("panel lift anim-flip overflow-hidden", i > 2 && "hidden sm:block")} style={{ animationDelay: `${i * 60}ms` }}>
                <div className={clsx("flex items-center justify-between px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em]", win ? "bg-good/90 text-bg" : "bg-bad/90 text-bg")}>
                  <span>{win ? "Win" : "Loss"}</span>
                  <span className="opacity-75">{fmtDate(g.date)}</span>
                </div>
                <div className="flex items-center justify-between px-2.5 py-2">
                  <span className="text-xs text-dim">{home ? "vs" : "@"} <span className="font-semibold text-ink">{home ? g.away : g.home}</span></span>
                  <span className="font-display text-xl font-black leading-none num">{my}<span className="text-mute">-</span>{op}</span>
                </div>
              </Link>
            );
          })}
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <Card title={`${team.conference} standings`} right={<Link href="/game/standings">Full table</Link>} pad={false}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="label w-8 py-2 pl-4 text-left">#</th>
                <th className="label py-2 text-left">Team</th>
                <th className="label py-2 text-right">W-L</th>
                <th className="label py-2 pr-4 text-right">GB</th>
              </tr>
            </thead>
            <tbody>
              {conf.slice(0, 10).map((id, i) => {
                const r = l.standings[id] ?? emptyRecord(id);
                return (
                  <tr key={id} className={clsx("border-b border-line/50 last:border-0", id === t && "bg-accent/12", i === 5 && "border-b-2 !border-b-line-2")}>
                    <td className={clsx("py-1.5 pl-4 font-display text-[15px] font-bold num", i < 6 ? "text-ink" : "text-warn")} style={{ boxShadow: `inset 3px 0 0 ${i < 6 ? "var(--color-good)" : "var(--color-warn)"}` }}>
                      {i + 1}
                    </td>
                    <td className="max-w-0 py-1.5">
                      <div className="truncate">
                        <TeamBadge league={l} teamId={id} size="sm" withName />
                      </div>
                    </td>
                    <td className="py-1.5 text-right font-semibold num">
                      {r.w}-{r.l}
                    </td>
                    <td className="w-14 py-1.5 pr-4 text-right text-dim num">{i === 0 ? "-" : gamesBack(l.standings[conf[0]] ?? emptyRecord(conf[0]), r).toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex gap-4 border-t border-line px-4 py-2 text-[11px] text-mute">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-[3px] bg-good" />Playoffs</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-[3px] bg-warn" />Play-In</span>
          </div>
        </Card>

        <div className="grid content-start gap-5">
          <Card title="Team leaders" right={<Link href="/game/stats">Stats</Link>} pad={false}>
            <div className="grid grid-cols-3 divide-x divide-line">
              {leaders.map(({ k, best }) => (
                <div key={k} className="min-w-0 px-3 py-3">
                  <div className="label">{k}</div>
                  {best ? (
                    <>
                      <div className="font-display text-4xl font-black leading-none num">{f1(best.pg[k])}</div>
                      <PlayerLink player={best.p} className="mt-1 block truncate text-xs" />
                    </>
                  ) : (
                    <>
                      <div className="font-display text-4xl font-black leading-none text-line-2">-</div>
                      <div className="mt-1 text-xs text-mute">No games yet</div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card title="Cap status" right={<Link href="/game/cap">Cap sheet</Link>}>
            <div className="grid grid-cols-2 gap-x-3 gap-y-4">
              <Stat label="Team salary" value={money(cap.salary)} sub={<span className={STATUS_COLOR[cap.status]}>{STATUS_LABEL[cap.status]}</span>} />
              <Stat label={cap.room > 0 ? "Cap room" : "Tax bill"} value={cap.room > 0 ? money(cap.room) : money(cap.taxBill)} tone={cap.taxBill > 0 ? "warn" : undefined} sub={cap.repeater ? "Repeater rates" : undefined} />
              <Stat label="To 1st apron" value={money(cap.firstApron - cap.taxSalary)} tone={cap.taxSalary > cap.firstApron ? "bad" : undefined} />
              <Stat label="Hard cap" value={cap.hardCap ? `${cap.hardCap === "first" ? "1st" : "2nd"} apron` : "None"} sub={cap.hardCapRoom != null ? `${money(cap.hardCapRoom)} room` : undefined} />
            </div>
            {injured.length > 0 && (
              <div className="mt-4 flex gap-2 rounded-[4px] bg-bad/8 px-3 py-2 text-xs text-dim">
                <FirstAidKit size={15} weight="fill" className="mt-px shrink-0 text-bad" />
                <span>{injured.map((p) => `${p.lastName} (${p.injury!.type}, ${p.injury!.daysOut}d)`).join(", ")}</span>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Card title="League wire" right={<Link href="/game/news">All news</Link>}>
        <NewsList items={l.news.slice(0, 14)} />
      </Card>
    </div>
  );
}

function MatchSide({ league, id, right }: { league: ReturnType<typeof useLeague>; id: string; right?: boolean }) {
  const t = league.teams[id];
  const r = league.standings[id] ?? emptyRecord(id);
  if (!t) return <span className="font-display text-xl">{id}</span>;
  return (
    <Link href={`/game/team/${id}`} className={clsx("group flex min-w-0 items-center gap-2.5", right && "flex-row-reverse text-right")}>
      <TeamMark id={t.id} colors={t.colors} size="lg" />
      <div className="min-w-0">
        <div className="truncate font-display text-lg font-extrabold uppercase leading-none group-hover:text-accent">{t.name}</div>
        <div className="mt-0.5 text-xs text-dim num">{r.w}-{r.l}</div>
      </div>
    </Link>
  );
}
