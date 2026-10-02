"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, Basketball, Briefcase, Keyboard } from "@phosphor-icons/react";
import { useTeamTheme } from "@/lib/theme";
import { AppearancePicker } from "@/components/AppearancePicker";
import { SiteBackdrop } from "@/components/SiteBackdrop";

interface Progress {
  foLeague: boolean;
  hlSeason: { gi: number; len: number; playoffs: boolean } | null;
  touchOnly: boolean;
}

/** Reads each game's own saved progress (same origin, so localStorage is shared). */
function readProgress(): Progress {
  const out: Progress = { foLeague: false, hlSeason: null, touchOnly: false };
  try {
    out.foLeague = !!localStorage.getItem("fo:lastSave");
    const s = JSON.parse(localStorage.getItem("hl_season_v1") || "null") as { gi?: number; len?: number; playoffs?: unknown } | null;
    if (s && typeof s.gi === "number" && typeof s.len === "number") out.hlSeason = { gi: s.gi, len: s.len, playoffs: !!s.playoffs };
  } catch {
    /* storage blocked: tiles still work, just without the continue line */
  }
  out.touchOnly = window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(any-pointer: fine)").matches;
  return out;
}

export default function GameHub() {
  useTeamTheme(null);
  const [p, setP] = useState<Progress | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setP(readProgress()), 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <main id="main" className="relative mx-auto flex min-h-[100dvh] max-w-[1280px] flex-col px-5 pb-12 pt-10 sm:px-10 sm:pt-14">
      <SiteBackdrop />
      <header className="anim-rise relative mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          {/* the way back to the Be-A-Manager landing page, a full page load on purpose so its own look applies cleanly */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="mb-5 inline-flex items-center gap-2 font-num text-[10.5px] font-bold uppercase tracking-[0.16em] text-dim transition-colors hover:text-ink">
            <ArrowLeft size={12} weight="bold" /> <span className="bam-dots" aria-hidden /> Be-A-Manager
          </a>
          <div className="label mb-3 !text-accent">Pick your game</div>
          <h1 className="font-display text-[44px] font-black uppercase leading-none tracking-[0.02em] sm:text-[72px]">
            Game <span className="text-accent">night</span>
          </h1>
          <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-dim">Run a franchise from the front office, or grab the controller and play the game yourself.</p>
        </div>
        <div className="w-full max-w-sm">
          <AppearancePicker compact />
        </div>
      </header>

      <div className="relative grid flex-1 gap-4 md:grid-cols-2">
        <GameTile
          href="/gm"
          internal
          title="Front Office"
          kind="Manage"
          mark="GM"
          icon={<Briefcase size={30} weight="duotone" />}
          color="#d6363b"
          blurb="Be the GM. Real 2026-27 rosters and contracts, the full CBA, trades, the draft and free agency."
          facts={["605 players", "Full CBA", "Play with friends"]}
          cta="Open Front Office"
          status={p?.foLeague ? "Your league is saved. Pick up where you left off." : null}
          delay={60}
        />
        <GameTile
          href="/games/hardwood-legends.html"
          title="Hardwood Legends"
          kind="Play"
          mark="5v5"
          icon={<Basketball size={30} weight="duotone" />}
          color="#ff8a00"
          blurb="Take the court. 3D 5-on-5 with all 30 teams, a shot meter, dribble moves, and a season with playoffs."
          facts={["3D 5-on-5", "Season + playoffs", "Keyboard controls"]}
          cta="Play Hardwood Legends"
          status={p?.hlSeason ? (p.hlSeason.playoffs ? "Your season is in the playoffs." : `Season in progress: game ${Math.min(p.hlSeason.gi + 1, p.hlSeason.len)} of ${p.hlSeason.len}.`) : null}
          warning={p?.touchOnly ? "Needs a keyboard. Play it on a computer." : null}
          delay={120}
        />
      </div>
    </main>
  );
}

function GameTile({ href, internal, title, kind, mark, icon, color, blurb, facts, cta, status, warning, delay }: { href: string; internal?: boolean; title: string; kind: string; mark: string; icon: React.ReactNode; color: string; blurb: string; facts: string[]; cta: string; status: string | null; warning?: string | null; delay: number }) {
  const body = (
    <>
      <div aria-hidden className="hero-wash absolute inset-0" style={{ ["--tc-team" as string]: color }} />
      <div aria-hidden className="stripes absolute inset-0 [mask-image:linear-gradient(120deg,black,transparent_70%)]" />
      <span aria-hidden className="pointer-events-none absolute -bottom-6 right-1 select-none font-num text-[130px] font-bold uppercase leading-none text-white/[0.05] sm:text-[170px]">{mark}</span>
      <div className="relative flex h-full flex-col p-6 sm:p-8">
        <div className="flex items-center gap-2 text-white/90">
          {icon}
          <span className="label !text-white/75">{kind}</span>
        </div>
        <h2 className="mt-4 font-display text-[30px] font-black uppercase leading-none tracking-[0.03em] text-white sm:text-[40px]">{title}</h2>
        <p className="mt-3 max-w-[44ch] text-[15px] leading-relaxed text-white/80">{blurb}</p>
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {facts.map((f) => (
            <li key={f} className="chip !bg-black/40 !text-white/85">
              {f === "Keyboard controls" && <Keyboard size={12} weight="bold" />}
              {f}
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-8">
          {status && <p className="mb-3 text-sm font-semibold text-white">{status}</p>}
          {warning && <p className="mb-3 text-sm font-semibold text-warn">{warning}</p>}
          <span className="btn btn-glow !h-11 !px-5 transition-transform duration-200 group-hover:translate-x-1">
            {cta} <ArrowRight size={14} weight="bold" />
          </span>
        </div>
      </div>
    </>
  );
  const cls = clsx("group panel on-dark lift anim-rise relative block min-h-[380px] overflow-hidden");
  const style = { animationDelay: `${delay}ms` };
  return internal ? (
    <Link href={href} className={cls} style={style}>
      {body}
    </Link>
  ) : (
    <a href={href} className={cls} style={style}>
      {body}
    </a>
  );
}
