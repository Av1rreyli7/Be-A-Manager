"use client";
/**
 * Be-A-Manager landing page: a short cinematic intro, then the two games side by side.
 *
 * One GSAP timeline runs the whole show (about 3.2 seconds):
 *   1. lights: the frame draws, the floodlight lamps flicker on, the beams come up
 *   2. WELCOME TO BE-A-MANAGER: the letters rise and flip in from the middle out, a colour wave runs
 *      across them, then the word flies up and lands as the brand in the header
 *   3. Floodlights: a football is kicked across the card and the title letters chase it in
 *   4. Game Night: a basketball drops in and bounces, the title slams down behind it on the first bounce
 *
 * Rules: transform and opacity only (the GPU does the work). Every link works from the first frame:
 * the intro layer never takes pointer events. Skip, Esc or a scroll jump to the end. A second visit in the
 * same tab plays only the quick card moments. Reduced motion gets the calm page with nothing moving.
 * The first paint is kept dark by a tiny script in src/app/page.tsx, so the page never flashes the
 * end state before the intro starts.
 */
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { GAMES, ORDER, type GameId } from "./games";
import { STARS_A, STARS_B } from "./starfield";
import { Basketball, Football } from "./Balls";
import { km } from "@/lib/motion";
import type { Drift } from "./Backdrop3D";
import "./landing.css";

gsap.registerPlugin(useGSAP);

// three.js and the scene live in their own chunk and only load after the intro, when the browser is idle
const Backdrop3D = lazy(() => import("./Backdrop3D"));

type ThreeState = "off" | "loading" | "on";
type Phase = "intro" | "done";
interface SiteStats {
  clubs: number;
  leagues: number;
  rooms: number;
  seasons: number;
}

const PREF_KEY = "bam:3d";
export const SEEN_KEY = "bam:intro";
const BRAND = "BE-A-MANAGER";

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function weakDevice(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return true;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 2) return true;
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 2) return true;
  return false;
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function readSeen(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "seen";
  } catch {
    return false;
  }
}
function markSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, "seen");
  } catch {
    /* fine without storage: the full intro plays again next time */
  }
}

/** a pointer drift value for the 3D camera, eased every time the scene reads it */
function makeDrift(): Drift & { target: number } {
  let cur = 0;
  return {
    target: 0,
    get() {
      cur += (this.target - cur) * 0.05;
      return cur;
    },
  };
}

/** splits a word into letter spans for the choreography; the readable text sits next to it for screen readers */
function Letters({ text, layered = false }: { text: string; layered?: boolean }) {
  const chars = Array.from(text);
  return (
    <>
      {chars.map((c, i) => {
        const style = { "--i": i, "--n": chars.length } as React.CSSProperties;
        if (c === " ")
          return (
            <span key={i} className="sp" style={style}>
              {" "}
            </span>
          );
        return layered ? (
          <span key={i} className="L" style={style}>
            <b className="w">{c}</b>
            <b className="c">{c}</b>
          </span>
        ) : (
          <span key={i} className="ch" style={style}>
            {c}
          </span>
        );
      })}
    </>
  );
}

/** where the big welcome word has to travel to land exactly on the brand in the header */
function flight(big: Element | null, brand: Element | null) {
  const a = big?.getBoundingClientRect();
  const b = brand?.getBoundingClientRect();
  if (!a || !b || !a.width || !b.width) return { x: 0, y: -120, scale: 0.4 };
  return {
    x: b.left + b.width / 2 - (a.left + a.width / 2),
    y: b.top + b.height / 2 - (a.top + a.height / 2),
    scale: b.width / a.width,
  };
}

/** Builds the intro. Positions are in seconds. Labels: lights, fly, cards. */
function buildIntro(root: HTMLElement): gsap.core.Timeline {
  const q = gsap.utils.selector(root);
  const intro = q(".bam-intro");
  const big = root.querySelector(".bam-big");
  const brand = root.querySelector(".bam-brand");
  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

  /* 1. lights */
  tl.addLabel("lights", 0);
  tl.set(intro, { display: "flex", opacity: 1 }, 0);
  tl.fromTo(q(".bam-frame .ln-x"), { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: "power2.inOut" }, 0);
  tl.fromTo(q(".bam-frame .ln-y"), { scaleY: 0 }, { scaleY: 1, duration: 0.7, ease: "power2.inOut" }, 0);
  tl.fromTo(q(".bam-frame .cn"), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.45);
  tl.fromTo(q(".bam-lamps i"), { opacity: 0 }, { keyframes: { opacity: [0, 1, 0.2, 1] }, duration: 0.3, stagger: 0.035, ease: "none" }, 0.04);
  tl.fromTo(q(".bam-beam"), { opacity: 0, scaleY: 0.55 }, { keyframes: { opacity: [0, 0.95, 0.35, 1] }, scaleY: 1, duration: 0.5, stagger: 0.09, ease: "power2.out" }, 0.1);
  tl.fromTo(q(".bam-dim"), { opacity: 1 }, { opacity: 0.6, duration: 0.5, ease: "power1.out" }, 0.18);
  tl.fromTo(q(".bam-top [data-lp]"), { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.05 }, 0.1);

  /* 2. welcome */
  tl.fromTo(q(".bam-welcome .ch"), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.34, stagger: 0.022 }, 0.2);
  tl.fromTo(q(".bam-welcome .rule"), { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: "power2.inOut" }, 0.24);
  tl.fromTo(
    q(".bam-big .L"),
    { opacity: 0, yPercent: 105, rotateX: -80, scale: 0.82 },
    { opacity: 1, yPercent: 0, rotateX: 0, scale: 1, duration: 0.6, ease: "back.out(1.5)", stagger: { each: 0.034, from: "center" } },
    0.3,
  );
  tl.fromTo(q(".bam-bloom"), { opacity: 0, scale: 0.35 }, { opacity: 1, scale: 1, duration: 0.5, ease: "power2.out" }, 0.62);
  tl.fromTo(q(".bam-big .L .c"), { opacity: 0 }, { opacity: 1, duration: 0.28, stagger: 0.028, ease: "power1.out" }, 0.78);
  tl.to(q(".bam-bloom"), { opacity: 0, duration: 0.5, ease: "power1.in" }, 1.1);

  tl.addLabel("fly", 1.32);
  tl.to(q(".bam-welcome"), { opacity: 0, y: -18, duration: 0.28, ease: "power2.in" }, "fly");
  let path = { x: 0, y: 0, scale: 1 };
  tl.to(
    big,
    {
      x: () => (path = flight(big, brand)).x,
      y: () => path.y,
      scale: () => path.scale,
      duration: 0.58,
      ease: "power3.inOut",
    },
    "fly",
  );
  tl.to(q(".bam-dim"), { opacity: 0, duration: 0.6, ease: "power1.inOut" }, "fly");
  tl.fromTo(q(".bam-brand"), { opacity: 0 }, { opacity: 1, duration: 0.16, ease: "none" }, "fly+=0.5");
  tl.to(intro, { opacity: 0, duration: 0.16, ease: "none" }, "fly+=0.52");
  tl.set(intro, { display: "none" }, "fly+=0.7");
  tl.fromTo(q(".bam-lede"), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4 }, "fly+=0.5");

  /* 3 and 4. the two games */
  tl.addLabel("cards", 1.78);
  const [fl, gn] = ORDER.map((id) => root.querySelector<HTMLElement>(`.bam-card[data-game="${id}"]`));
  if (fl) {
    cardIn(tl, fl, "cards");
    kick(tl, fl, "cards+=0.08");
  }
  if (gn) {
    cardIn(tl, gn, "cards+=0.5");
    bounce(tl, gn, "cards+=0.56");
  }
  tl.fromTo(q(".bam-foot"), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4 }, "cards+=1.1");
  return tl;
}

function cardIn(tl: gsap.core.Timeline, card: HTMLElement, at: string) {
  const q = gsap.utils.selector(card);
  tl.fromTo(card, { opacity: 0, y: 30, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.5 }, at);
  tl.fromTo(q(".bam-card-glow"), { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.7, ease: "power2.out" }, `${at}+=0.1`);
  tl.fromTo(q(".bam-kind"), { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.32 }, `${at}+=0.12`);
  tl.fromTo(q(".bam-copy > *"), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.36, stagger: 0.05 }, `${at}+=0.55`);
  tl.fromTo(q(".bam-glowbtn"), { opacity: 0, scale: 0.9, y: 8 }, { opacity: 1, scale: 1, y: 0, duration: 0.42, ease: "back.out(1.8)" }, `${at}+=0.72`);
  tl.fromTo(q(".bam-btnflash"), { opacity: 0, xPercent: -120 }, { keyframes: { opacity: [0, 1, 0] }, xPercent: 120, duration: 0.6, ease: "power1.inOut" }, `${at}+=0.95`);
}

/** Floodlights: the ball is kicked in from off screen left, the title letters chase it */
function kick(tl: gsap.core.Timeline, card: HTMLElement, at: string) {
  const q = gsap.utils.selector(card);
  const ball = card.querySelector<HTMLElement>(".bam-ball");
  const offLeft = () => -((ball?.getBoundingClientRect().left ?? 0) + (ball?.offsetWidth ?? 80) + 60);
  tl.fromTo(ball, { x: offLeft, opacity: 1 }, { x: 0, duration: 0.62, ease: "power3.out" }, at);
  tl.fromTo(q(".bam-ball-lift"), { y: 34 }, { keyframes: { y: [34, -22, 0], easeEach: "sine.out" }, duration: 0.62, ease: "none" }, at);
  tl.fromTo(q(".bam-ball-spin"), { rotation: -900 }, { rotation: 0, duration: 0.8, ease: "power3.out" }, at);
  tl.fromTo(q(".bam-streak"), { scaleX: 0, opacity: 0.95 }, { scaleX: 1, duration: 0.5, ease: "power3.out" }, at);
  tl.to(q(".bam-streak"), { opacity: 0, duration: 0.35, ease: "power1.in" }, `${at}+=0.36`);
  tl.fromTo(q(".bam-title .ch"), { opacity: 0, x: -80, skewX: -20 }, { opacity: 1, x: 0, skewX: 0, duration: 0.46, stagger: 0.028 }, `${at}+=0.1`);
  tl.fromTo(q(".bam-ball-squash"), { scaleX: 1, scaleY: 1 }, { keyframes: [{ scaleX: 0.84, scaleY: 1.12, duration: 0.07 }, { scaleX: 1, scaleY: 1, duration: 0.32, ease: "elastic.out(1, 0.45)" }] }, `${at}+=0.55`);
}

/** Game Night: the ball drops in and bounces; the title slams down behind it on the first bounce */
function bounce(tl: gsap.core.Timeline, card: HTMLElement, at: string) {
  const q = gsap.utils.selector(card);
  const ball = card.querySelector<HTMLElement>(".bam-ball");
  const D = 0.95;
  // bounce.out lands at about 36, 73 and 91 percent of its run
  const hit = [0.364, 0.727, 0.909].map((f) => `${at}+=${(D * f - 0.02).toFixed(3)}`);
  const offTop = () => -((ball?.getBoundingClientRect().top ?? 0) + (ball?.offsetHeight ?? 80) + 80);
  tl.fromTo(ball, { y: offTop, x: 36, opacity: 1 }, { y: 0, x: 0, duration: D, ease: "bounce.out" }, at);
  tl.fromTo(q(".bam-ball-spin"), { rotation: -240 }, { rotation: 0, duration: D + 0.15, ease: "power2.out" }, at);
  tl.fromTo(q(".bam-ball-squash"), { scaleX: 1, scaleY: 1 }, { keyframes: [{ scaleX: 1.16, scaleY: 0.78, duration: 0.06 }, { scaleX: 1, scaleY: 1, duration: 0.2, ease: "power2.out" }] }, hit[0]);
  tl.to(q(".bam-ball-squash"), { keyframes: [{ scaleX: 1.07, scaleY: 0.9, duration: 0.05 }, { scaleX: 1, scaleY: 1, duration: 0.14 }] }, hit[1]);
  tl.fromTo(
    q(".bam-title .ch"),
    { opacity: 0, scale: 1.9, y: -14 },
    { opacity: 1, scale: 1, y: 0, duration: 0.32, ease: "power4.out", stagger: { each: 0.022, from: "center" } },
    `${at}+=0.27`,
  );
  tl.fromTo(q(".bam-shock"), { opacity: 0.95, scale: 0.2 }, { opacity: 0, scale: 2.8, duration: 0.6, ease: "power2.out" }, hit[0]);
  tl.fromTo(q(".bam-title"), { y: 0 }, { keyframes: { y: [0, 6, -2, 0] }, duration: 0.34, ease: "none" }, hit[0]);
}

export default function Landing({ fontVars = "" }: { fontVars?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const [phase, setPhase] = useState<Phase>("done");
  // true once the intro timeline exists (never for reduced motion), so the replay button can show
  const [animated, setAnimated] = useState(false);
  const [featured, setFeatured] = useState<GameId>("floodlights");
  const [warmed, setWarmed] = useState<GameId[]>(["floodlights"]);
  const [three, setThree] = useState<ThreeState>("off");
  const [hidden, setHidden] = useState(false);
  const [stats, setStats] = useState<SiteStats | null>(null);
  const drift = useMemo(() => ({ x: makeDrift(), y: makeDrift() }), []);

  /** Warm on intent: start loading a game before the click lands. */
  const warm = useCallback((id: GameId) => {
    setWarmed((w) => (w.includes(id) ? w : [...w, id]));
    try {
      const href = GAMES[id].href;
      if (!document.head.querySelector(`link[data-bam-warm="${id}"]`)) {
        const l = document.createElement("link");
        l.rel = "prefetch";
        l.href = href;
        l.dataset.bamWarm = id;
        document.head.appendChild(l);
      }
    } catch {
      /* prefetch is only a nicety */
    }
  }, []);

  const finish = useCallback(() => {
    markSeen();
    setPhase("done");
  }, []);

  /** jump to the end of the intro (button, Esc, or the first scroll) */
  const skip = useCallback(() => {
    const tl = tlRef.current;
    if (tl && tl.progress() < 1) tl.progress(1);
    finish();
  }, [finish]);

  const replay = useCallback(() => {
    const tl = tlRef.current;
    if (!tl) return;
    setPhase("intro");
    tl.timeScale(1).restart();
  }, []);

  // the intro timeline, built once the page is laid out; reduced motion skips it entirely
  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;
      const mm = gsap.matchMedia();
      mm.add({ full: "(prefers-reduced-motion: no-preference)", calm: "(prefers-reduced-motion: reduce)" }, (ctx) => {
        const calm = !!ctx.conditions?.calm;
        if (calm) {
          tlRef.current = null;
          document.getElementById("bam-prehide")?.remove();
          setPhase("done");
          setAnimated(false);
          return;
        }
        const tl = buildIntro(root);
        tlRef.current = tl;
        // the from states are painted now, so the first paint guard can go
        // __bamIntro also tells the first paint guard the intro took over; the timeline handle is for checks
        Object.assign(window, { __bamIntro: 1, __bamIntroTL: tl });
        document.getElementById("bam-prehide")?.remove();
        tl.eventCallback("onComplete", finish);
        if (readSeen()) {
          // second visit in this tab: only the quick card moments, the welcome layer stays out of sight
          tl.seek("cards").timeScale(1.3);
          gsap.set(root.querySelector(".bam-intro"), { display: "none" });
        }
        setPhase("intro");
        setAnimated(true);
        return () => {
          tl.kill();
          tlRef.current = null;
        };
      });
      return () => mm.revert();
    },
    { scope: rootRef },
  );

  // Esc or the first wheel or swipe skips the intro; links never wait for it
  useEffect(() => {
    if (phase !== "intro") return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
    };
    const scroll = () => skip();
    window.addEventListener("keydown", key);
    window.addEventListener("wheel", scroll, { passive: true, once: true });
    window.addEventListener("touchmove", scroll, { passive: true, once: true });
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("wheel", scroll);
      window.removeEventListener("touchmove", scroll);
    };
  }, [phase, skip]);

  // pointer drift for the 3D camera (mouse only, off for reduced motion); refs only, no React renders
  useEffect(() => {
    if (reducedMotion()) return;
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      drift.x.target = (e.clientX / window.innerWidth) * 2 - 1;
      drift.y.target = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const leave = () => {
      drift.x.target = 0;
      drift.y.target = 0;
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
    };
  }, [drift]);

  // the 3D scene stops drawing when the tab is hidden
  useEffect(() => {
    const vis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, []);

  // after the intro, when the browser is idle: decide on 3D, warm both games, fetch the live numbers
  useEffect(() => {
    if (phase !== "done") return;
    const reduced = reducedMotion();
    let pref: string | null = null;
    try {
      pref = localStorage.getItem(PREF_KEY);
    } catch {
      /* storage blocked: use the defaults */
    }
    // phones get the still backdrop unless asked: the cards stack there and the scene would only peek out behind them
    const wants = pref === "on" || (pref !== "off" && !reduced && !weakDevice() && window.innerWidth > 760);
    type Idle = (cb: () => void, o?: { timeout: number }) => number;
    const ric = (window as unknown as { requestIdleCallback?: Idle }).requestIdleCallback;
    const idle = (fn: () => void, timeout: number, fallback: number) => {
      if (ric) ric(fn, { timeout });
      else setTimeout(fn, fallback);
    };
    let dead = false;
    idle(
      () => {
        if (dead) return;
        if (wants && hasWebGL()) setThree((s) => (s === "off" ? "loading" : s));
        ORDER.forEach(warm);
        fetch("/floodlights/stats.json")
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => {
            if (!dead && j && typeof j.clubs === "number") setStats(j as SiteStats);
          })
          .catch(() => {
            /* the static numbers stay */
          });
      },
      1500,
      400,
    );
    return () => {
      dead = true;
    };
  }, [phase, warm]);

  // live numbers count up from what the page showed
  const clubsRef = useRef<HTMLElement>(null);
  const leaguesRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!stats) return;
    km.count(clubsRef.current, stats.clubs, { from: Number(clubsRef.current?.textContent) || 0 });
    km.count(leaguesRef.current, stats.leagues, { from: Number(leaguesRef.current?.textContent) || 0 });
  }, [stats]);

  const toggle3D = () => {
    const turnOn = three === "off";
    try {
      localStorage.setItem(PREF_KEY, turnOn ? "on" : "off");
    } catch {
      /* fine without storage */
    }
    if (turnOn) {
      if (hasWebGL()) setThree("loading");
    } else setThree("off");
  };
  const onReady = useCallback(() => setThree((s) => (s === "loading" ? "on" : s)), []);
  // the scene could not hold a steady frame rate: fall back to the still backdrop
  const onSlow = useCallback(() => setThree("off"), []);

  const rooms = stats?.rooms ?? 0;

  return (
    <div ref={rootRef} className={clsx("bam", fontVars)} data-phase={phase} data-3d={three} data-featured={featured} style={{ background: "#000", color: "#fff" }}>
      {/* black from the very first byte, so the page can never flash white */}
      <style>{"html,body{background:#000000 !important;color:#ffffff}"}</style>

      <div className="bam-bg" aria-hidden="true">
        <div className="bam-aurora" />
        <div className="bam-stars">
          <i style={{ boxShadow: STARS_A }} />
          <i style={{ boxShadow: STARS_B }} />
        </div>
        {three !== "off" && (
          <div className="bam-canvas">
            <Suspense fallback={null}>
              <Backdrop3D featured={featured} sx={drift.x} sy={drift.y} warmed={warmed} still={false} paused={hidden || phase === "intro"} onReady={onReady} onSlow={onSlow} />
            </Suspense>
          </div>
        )}
        <div className="bam-scrim" />
        <div className="bam-dim" />
        <div className="bam-beam is-l" />
        <div className="bam-beam is-r" />
        <div className="bam-lamps is-l">
          {Array.from({ length: 6 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
        <div className="bam-lamps is-r">
          {Array.from({ length: 6 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
      </div>

      <div className="bam-frame" aria-hidden="true">
        <span className="ln ln-x ln-t" />
        <span className="ln ln-y ln-l" />
        <span className="ln ln-x ln-b" />
        <span className="ln ln-y ln-r" />
        <span className="cn cn-tl" />
        <span className="cn cn-tr" />
        <span className="cn cn-bl" />
        <span className="cn cn-br" />
      </div>

      <div className="bam-page">
        <header className="bam-top">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a plain link keeps the landing free of router state */}
          <a className="bam-logo" href="/" aria-label="Be-A-Manager home" data-lp="">
            <span className="bam-mark" aria-hidden="true" />
            <span>BAM</span>
          </a>
          <nav className="bam-nav" aria-label="Games">
            {ORDER.map((id) => (
              <a key={id} className="bam-pill" data-kmode={GAMES[id].mode} href={GAMES[id].href} data-game={id} data-lp="" onPointerEnter={() => warm(id)} onFocus={() => warm(id)}>
                <span className="dot" aria-hidden="true" />
                {GAMES[id].name.toUpperCase()}
              </a>
            ))}
          </nav>
          <button type="button" className="bam-skip" onClick={skip} hidden={phase !== "intro"}>
            Skip intro
          </button>
        </header>

        <section className="bam-hero">
          <h1 className="bam-h1">
            <span className="sr-only">Welcome to Be-A-Manager</span>
            <span className="bam-brand" aria-hidden="true">
              <Letters text={BRAND} />
            </span>
          </h1>
          <p className="bam-lede">
            Two games. Pick one and run the <em>whole</em> show.
          </p>
        </section>

        <section className="bam-games" aria-label="Pick a game">
          {ORDER.map((id) => {
            const g = GAMES[id];
            const Ball = id === "floodlights" ? Football : Basketball;
            return (
              <article
                key={id}
                className={clsx("bam-card bam-variant", `is-${id}`)}
                data-game={id}
                data-kmode={g.mode}
                onPointerEnter={() => {
                  warm(id);
                  setFeatured(id);
                }}
                onFocus={() => {
                  warm(id);
                  setFeatured(id);
                }}
              >
                <div className="bam-card-glow" aria-hidden="true" />
                <div className="bam-card-lift">
                  <div className="bam-card-bg" aria-hidden="true">
                    <div className="bam-card-art" />
                  </div>
                  {/* the whole card is a way in; the real, focusable link is the enter button */}
                  <a className="bam-hit" href={g.href} tabIndex={-1} aria-hidden="true" />
                  <div className="bam-kind">
                    <span className="dot" aria-hidden="true" />
                    {g.kind}
                  </div>
                  <h2 className="bam-title">
                    <span className="sr-only">{g.name}</span>
                    <span className="bam-title-word" aria-hidden="true">
                      <Letters text={g.name.toUpperCase()} />
                    </span>
                    <span className="bam-ball" aria-hidden="true">
                      {id === "floodlights" && <span className="bam-streak" />}
                      {id === "frontoffice" && <span className="bam-shock" />}
                      <span className="bam-ball-lift">
                        <span className="bam-ball-squash">
                          <span className="bam-ball-spin">
                            <Ball className="bam-ball-svg" />
                          </span>
                        </span>
                      </span>
                    </span>
                  </h2>
                  <div className="bam-copy">
                    <p className="bam-blurb">{g.blurb}</p>
                    {g.inside && (
                      <ul className="bam-inside">
                        {g.inside.map((x) => (
                          <li key={x.name}>
                            <b>{x.name}</b>
                            <span>{x.text}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <ul className="bam-chips" aria-label="At a glance">
                      {g.chips.map((c) => (
                        <li key={c} className="k-chip">
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <a className="bam-glowbtn k-btn k-btn-glow" href={g.href} data-enter={id} onPointerDown={(e) => km.press(e.currentTarget)}>
                    <span className="bam-btnflash" aria-hidden="true" />
                    {g.enter}
                    <svg className="arr" viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                </div>
              </article>
            );
          })}
        </section>

        <footer className="bam-foot">
          <ul className="bam-stats">
            <li className="bam-stat">
              <b ref={clubsRef}>320</b> clubs
            </li>
            <li className="bam-stat">
              <b ref={leaguesRef}>15</b> leagues
            </li>
            <li className="bam-stat">
              <b>2</b> basketball games
            </li>
            {rooms > 0 && (
              <li className="bam-stat bam-live">
                <span className="bam-pulse" aria-hidden="true" />
                <b>{rooms}</b> {rooms === 1 ? "room open" : "rooms open"}
              </li>
            )}
          </ul>
          <div className="bam-foot-r">
            <button type="button" className="bam-mini" aria-pressed={three !== "off"} onClick={toggle3D}>
              {three === "off" ? "3D OFF" : "3D ON"}
            </button>
            {animated && phase === "done" && (
              <button type="button" className="bam-mini" onClick={replay}>
                Replay intro
              </button>
            )}
            <p className="bam-credit">By Avir &amp; Ayanssh</p>
          </div>
        </footer>
      </div>

      {/* the intro layer: shown only while the intro plays, never takes a click */}
      <div className="bam-intro" aria-hidden="true">
        <div className="bam-bloom" />
        <p className="bam-welcome">
          <span className="rule" />
          <span className="word">
            <Letters text="WELCOME TO" />
          </span>
          <span className="rule" />
        </p>
        <p className="bam-big">
          <Letters text={BRAND} layered />
        </p>
      </div>
    </div>
  );
}
