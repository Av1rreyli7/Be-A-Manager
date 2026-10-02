"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Basketball, Keyboard, WarningCircle } from "@phosphor-icons/react";
import { useGame, useIsOnlineGuest, useLeague, useTeamId } from "@/lib/store";
import { Button, Card, Empty, PageHeader, TeamMark, seg } from "@/components/ui";
import { fmtDate } from "@/engine/util/dates";
import { emptyRecord } from "@/engine/season/standings";
import { buildStart, playableGame, toBoxScore, type HLResult } from "@/lib/hardwood";

const QLENS = [2, 5, 8, 12];
const DIFFS = ["Rookie", "Pro", "All-Star", "Hall of Fame"];
const PREF_KEY = "fo:hlPrefs";

function readPrefs(): { qLen: number; diff: number } {
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) || "null") as { qLen?: number; diff?: number } | null;
    if (p && QLENS.includes(p.qLen ?? 0) && (p.diff ?? -1) >= 0 && (p.diff ?? 9) < DIFFS.length) return { qLen: p.qLen!, diff: p.diff! };
  } catch {
    /* fall through to defaults */
  }
  return { qLen: 5, diff: 1 };
}

function PlayGame() {
  const l = useLeague();
  const me = useTeamId();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useGame((s) => s.toast);
  const recordGame = useGame((s) => s.recordGame);
  const guest = useIsOnlineGuest();
  const gameId = params.get("g");
  const g = gameId ? l.schedule.find((x) => x.id === gameId) : undefined;
  const ready = playableGame(l, me);
  const canPlay = !!g && !g.played && ready?.id === g.id;

  const [prefs, setPrefs] = useState({ qLen: 5, diff: 1 });
  useEffect(() => {
    const t = setTimeout(() => setPrefs(readPrefs()), 0);
    return () => clearTimeout(t);
  }, []);
  const choose = (p: Partial<typeof prefs>) => {
    const next = { ...prefs, ...p };
    setPrefs(next);
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(next));
    } catch {
      /* not saved, still used this time */
    }
  };

  // ---- the running game (iframe) ----
  const frame = useRef<HTMLIFrameElement>(null);
  const [playing, setPlaying] = useState(false);
  const sent = useRef(false); // result handed to the engine
  const aborted = useRef(false);
  const outcome = useRef<string | null | undefined>(undefined); // undefined = no result yet

  const post = (m: unknown) => frame.current?.contentWindow?.postMessage(m, window.location.origin);

  const close = useCallback(() => {
    setPlaying(false);
    document.body.style.overflow = "";
    if (!gameId) return;
    const played = useGame.getState().league?.schedule.find((x) => x.id === gameId)?.played;
    if (outcome.current === null) toast("Your game counted. Box score below.", "success");
    else if (outcome.current) toast(outcome.current, "error");
    if (played) router.push(`/game/box/${encodeURIComponent(gameId)}`);
  }, [gameId, router, toast]);

  useEffect(() => {
    if (!playing) return;
    const onMsg = async (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      const m = e.data as { type?: string; result?: HLResult };
      const lg = useGame.getState().league;
      const game = lg?.schedule.find((x) => x.id === gameId);
      if (m.type === "hl:ready" && lg && game) {
        post({ type: "fo:start", start: buildStart(lg, game, me, prefs) });
      } else if (m.type === "hl:result" && m.result && lg && game && !sent.current && !aborted.current) {
        sent.current = true;
        outcome.current = await recordGame(game.id, toBoxScore(lg, game, m.result));
      } else if (m.type === "hl:quit") {
        outcome.current = "You left the game, so it hasn't been played yet. Play it again or sim it.";
        close();
      } else if (m.type === "hl:close") close();
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
    // prefs/me are read at tip-off; the listener lives for one game
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, gameId, close, recordGame]);

  // the host simmed this game while it was being played: stop it, the sim counts
  useEffect(() => {
    if (!playing || !g?.played || sent.current || aborted.current || !g.result) return;
    aborted.current = true;
    outcome.current = "The host simmed this game while you were playing, so the simmed result counts.";
    post({ type: "fo:abort", text: `The host simmed this game while you were playing. Final: ${g.away} ${g.result.awayScore}, ${g.home} ${g.result.homeScore}. The simmed result counts.` });
  }, [playing, g?.played, g?.result, g?.away, g?.home]);

  const start = () => {
    sent.current = false;
    aborted.current = false;
    outcome.current = undefined;
    document.body.style.overflow = "hidden";
    setPlaying(true);
  };

  if (!g) return <Empty>That game isn&apos;t on the schedule.</Empty>;
  const opp = g.home === me ? g.away : g.home;
  const rec = (t: string) => l.standings[t] ?? emptyRecord(t);

  return (
    <div className="space-y-5">
      <PageHeader title="Play your game" sub={`${fmtDate(g.date, { weekday: "long", month: "long", day: "numeric" })} · ${g.round ?? (g.type === "regular" ? "Regular season" : g.type)}`} />

      <section className="panel on-dark relative overflow-hidden">
        <div aria-hidden className="hero-wash absolute inset-0" style={{ ["--tc-team" as string]: l.teams[opp]?.colors.primary }} />
        <div aria-hidden className="stripes absolute inset-0 [mask-image:linear-gradient(90deg,black,transparent_70%)]" />
        <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3 p-5 sm:p-8">
          {[g.away, g.home].map((t, i) => (
            <div key={t} className={i === 1 ? "order-3 flex flex-col items-end text-right" : "flex flex-col items-start"}>
              <TeamMark id={t} colors={l.teams[t].colors} size="xl" />
              <div className="mt-2 font-display text-[19px] font-black uppercase leading-none text-white sm:text-[28px]">{l.teams[t].name}</div>
              <div className="text-sm text-white/70 num">
                {rec(t).w}-{rec(t).l} · {i === 0 ? "Away" : "Home"}
                {t === me ? " · You" : ""}
              </div>
            </div>
          ))}
          <div className="order-2 font-num text-[19px] font-black text-white/50">@</div>
        </div>
      </section>

      {g.played ? (
        <Card>
          <p className="text-sm">This game is final.</p>
          <Link href={`/game/box/${encodeURIComponent(g.id)}`} className="mt-3 inline-block text-sm font-semibold text-accent hover:underline">
            See the box score
          </Link>
        </Card>
      ) : !canPlay ? (
        <Card>
          <p className="text-sm text-dim">You can play this game on game day. Sim to {fmtDate(g.date, { month: "short", day: "numeric" })} first.</p>
          {!guest && (
            <Button className="mt-3" variant="primary" onClick={() => void useGame.getState().sim("game-day")}>
              Sim to game day
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <Card title="Game settings">
            <div className="space-y-4">
              <div>
                <span className="label mb-1.5 block">Quarter length</span>
                <div className="flex gap-1">
                  {QLENS.map((q) => (
                    <button key={q} className={seg(prefs.qLen === q)} onClick={() => choose({ qLen: q })}>
                      {q} min
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-mute">Stats are scaled to a full 48-minute game when they go into your season.</p>
              </div>
              <div>
                <span className="label mb-1.5 block">Difficulty</span>
                <div className="flex gap-1">
                  {DIFFS.map((d, i) => (
                    <button key={d} className={seg(prefs.diff === i)} onClick={() => choose({ diff: i })}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <Button variant="primary" className="h-12 w-full text-[12px]" onClick={start}>
                <Basketball size={15} weight="fill" /> Tip off in Hardwood Legends
              </Button>
            </div>
          </Card>
          <Card title="How it counts">
            <ul className="space-y-2.5 text-sm text-dim">
              <li className="flex gap-2">
                <Keyboard size={18} className="mt-px shrink-0 text-accent" />
                Keyboard controls: arrows move, W shoots, A passes. Press H in the game for the full list.
              </li>
              <li>Both teams play with their real Front Office rosters, ratings and your starting five.</li>
              <li>The final score and every player&apos;s stats go into your season, standings and records.</li>
              <li>Leaving from the pause menu doesn&apos;t count. The game stays unplayed.</li>
              {l.online && (
                <li className="flex gap-2 text-warn">
                  <WarningCircle size={18} weight="fill" className="mt-px shrink-0" />
                  Friends league: if the host sims before you finish, your game stops and the simmed result counts.
                </li>
              )}
            </ul>
          </Card>
        </div>
      )}

      {playing && (
        <div className="fixed inset-0 z-[75] bg-bg">
          <iframe
            ref={frame}
            title="Hardwood Legends"
            src="/games/hardwood-legends.html?fo=1"
            className="h-full w-full border-0"
            allow="autoplay; fullscreen"
            onLoad={() => frame.current?.contentWindow?.focus()}
          />
        </div>
      )}
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense>
      <PlayGame />
    </Suspense>
  );
}
