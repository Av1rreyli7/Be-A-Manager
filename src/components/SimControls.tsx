"use client";
import { useEffect, useRef, useState } from "react";
import { useGame, useIsOnlineGuest, useLeague } from "@/lib/store";
import { CaretDown, FastForward, Keyboard, Pause, Play } from "@phosphor-icons/react";
import { Button, Modal } from "./ui";
import { PHASE_LABEL } from "@/lib/format";
import type { SimTarget } from "@/engine/league/advance";

const NEXT_PHASE: Record<string, string> = {
  "season-end": "Draft lottery",
  "draft-lottery": "Combine and workouts",
  "pre-draft": "Start the draft",
  draft: "Finish draft",
  options: "Open free agency",
  "free-agency": "Finish free agency",
  "summer-league": "Training camp",
  "training-camp": "Start preseason",
};

export function SimControls() {
  const l = useLeague();
  const sim = useGame((s) => s.sim);
  const advance = useGame((s) => s.advancePhase);
  const busy = useGame((s) => s.busy);
  const [help, setHelp] = useState(false);
  const guest = useIsOnlineGuest();
  const inSeason = ["preseason", "regular", "play-in", "playoffs"].includes(l.phase);
  const fa = l.phase === "free-agency";

  // close the "More" menu on an outside click or Escape (native <details> stays open otherwise)
  const more = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: Event) => {
      const d = more.current;
      if (!d?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !d.contains(e.target as Node)) d.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const map: Record<string, SimTarget> = { d: "day", w: "week", m: "month", n: "next-user-game", g: "game-day", r: "regular-end", p: "playoffs-end", t: "deadline", s: "allstar" };
      if (e.key === "?") return setHelp(true);
      if (e.key === "a" && !inSeason && NEXT_PHASE[l.phase]) {
        e.preventDefault();
        return void advance();
      }
      const target = map[e.key.toLowerCase()];
      if (target && (inSeason || (fa && (target === "day" || target === "week")))) {
        e.preventDefault();
        void sim(target);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sim, advance, inSeason, fa, l.phase]);

  if (guest) return <span className="k-tag" title="In an online league only the host can sim"><Pause size={11} weight="fill" className="mr-1 inline align-[-2px]" /> Host controls the sim</span>;

  return (
    <div className="flex items-center gap-1.5">
      {inSeason && (
        <>
          <Button size="sm" variant="primary" disabled={!!busy} onClick={() => sim("day")} title="Play one day (D)">
            <Play size={13} weight="fill" /> Day
          </Button>
          <Button size="sm" disabled={!!busy} onClick={() => sim("next-user-game")} title="Sim to next game (N)" className="max-sm:!hidden">
            <FastForward size={13} weight="fill" /> Next game
          </Button>
          <Button size="sm" disabled={!!busy} onClick={() => sim("week")} title="Sim a week (W)">
            Week
          </Button>
          <details ref={more} className="group relative">
            <summary className="list-none [&::-webkit-details-marker]:hidden">
              <span className="k-btn k-btn-ghost k-btn-sm" aria-label="More sim options">
                <span className="hidden sm:inline">More</span> <CaretDown size={12} weight="bold" className="transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <div className="menu-pop absolute right-0 z-50 mt-2 w-64">
              <div className="k-panel k-flush text-sm">
              {(
                [
                  ["game-day", "To my next game day (G)"],
                  ["month", "Sim a month (M)"],
                  ...(l.phase === "regular" || l.phase === "preseason" ? ([["deadline", "To the trade deadline (T)"], ["allstar", "To All-Star Sunday (S)"], ["regular-end", "To the end of the season (R)"]] as const) : []),
                  ["playoffs-end", "To the end of the playoffs (P)"],
                ] as [SimTarget, string][]
              ).map(([t, label]) => (
                <button key={t} disabled={!!busy} onClick={(e) => { (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open"); void sim(t); }} className="block w-full rounded-[3px] px-3 py-2 text-left text-dim transition-colors hover:bg-ink/[0.06] hover:text-ink disabled:opacity-40">
                  {label}
                </button>
              ))}
              </div>
            </div>
          </details>
        </>
      )}
      {fa && (
        <>
          <Button size="sm" disabled={!!busy} onClick={() => sim("day")} title="Next free agency day (D)">
            <Play size={13} weight="fill" /> FA day {l.freeAgency.day + 1}
          </Button>
          <Button size="sm" disabled={!!busy} onClick={() => sim("week")}>
            Week
          </Button>
        </>
      )}
      {NEXT_PHASE[l.phase] && (
        <Button size="sm" variant={inSeason || fa ? "default" : "primary"} disabled={!!busy} onClick={() => advance()} title="Next step (A)">
          {NEXT_PHASE[l.phase]}
        </Button>
      )}
      <button onClick={() => setHelp(true)} className="k-btn k-btn-ghost k-btn-sm max-sm:!hidden" title="Keyboard shortcuts" aria-label="Keyboard shortcuts">
        <Keyboard size={16} />
      </button>
      <Modal open={help} onClose={() => setHelp(false)} kicker="Sim controls" title="Keyboard shortcuts">
        <ul className="grid grid-cols-2 gap-2 text-sm">
          {[
            ["D", "Play or sim one day"],
            ["N", "Sim to your next game"],
            ["G", "Sim to your next game day, stop before tip off"],
            ["W", "Sim one week"],
            ["M", "Sim one month"],
            ["T", "Sim to the trade deadline"],
            ["S", "Sim to All-Star Sunday"],
            ["R", "Sim to the end of the season"],
            ["P", "Sim to the end of the playoffs"],
            ["A", "Next offseason step"],
            ["?", "This help"],
          ].map(([k, d]) => (
            <li key={k} className="flex items-center gap-2">
              <kbd className="grid h-7 min-w-7 place-items-center rounded-[4px] border border-line-2 bg-panel-2 font-num text-xs font-bold">{k}</kbd>
              <span className="text-dim">{d}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-mute">Now: {PHASE_LABEL[l.phase]}</p>
      </Modal>
    </div>
  );
}
