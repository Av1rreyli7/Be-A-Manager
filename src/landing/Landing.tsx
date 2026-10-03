"use client";
/**
 * Be-A-Manager landing page: a short cinematic intro, then the two games side by side.
 * Mostly motion and colour, barely any reading: each game is its animated title, one short line and a way in.
 *
 * One GSAP timeline runs the whole show (about 3.6 seconds), always in this order:
 *   1. WELCOME TO BE-A-MANAGER, on its own (about 2.1 s): the frame draws and the floodlights flicker on,
 *      WELCOME TO tracks in from the middle, the big letters flip up from below from the middle out, the
 *      colour runs across them, a band of light sweeps over the word with a lens streak and a small
 *      heartbeat, then the word flies up and lands as the headline
 *   2. only then the games: a football is kicked in and the FLOODLIGHTS letters chase it, a basketball
 *      drops in and bounces and GAME NIGHT slams down behind it on the first bounce
 *
 * Rules: transform and opacity only (the GPU does the work). Every link works from the first frame:
 * the intro layer never takes pointer events. Skip, Esc or a scroll jump to the end. A second visit in the
 * same tab plays only the quick card moments. Reduced motion gets the calm page with nothing moving.
 * The first paint is kept dark by a tiny script in src/app/page.tsx, so the page never flashes the
 * end state before the intro starts.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { GAMES, ORDER, type GameId } from "./games";
import { STARS_A, STARS_B } from "./starfield";
import { Basketball, Football } from "./Balls";
import { km } from "@/lib/motion";
import "./landing.css";

gsap.registerPlugin(useGSAP);

type Phase = "intro" | "done";

export const SEEN_KEY = "bam:intro";
const BRAND = "BE-A-MANAGER";

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
            <b className="s">{c}</b>
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

  /* 1. lights: the frame draws, the lamps flicker on, the beams come up */
  tl.addLabel("lights", 0);
  tl.set(intro, { display: "flex", opacity: 1 }, 0);
  tl.fromTo(q(".bam-frame .ln-x"), { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: "power2.inOut" }, 0);
  tl.fromTo(q(".bam-frame .ln-y"), { scaleY: 0 }, { scaleY: 1, duration: 0.6, ease: "power2.inOut" }, 0);
  tl.fromTo(q(".bam-frame .cn"), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.4);
  tl.fromTo(q(".bam-lamps i"), { opacity: 0 }, { keyframes: { opacity: [0, 1, 0.2, 1] }, duration: 0.3, stagger: 0.035, ease: "none" }, 0.02);
  tl.fromTo(q(".bam-beam"), { opacity: 0, scaleY: 0.55 }, { keyframes: { opacity: [0, 0.95, 0.35, 1] }, scaleY: 1, duration: 0.5, stagger: 0.09, ease: "power2.out" }, 0.08);
  tl.fromTo(q(".bam-dim"), { opacity: 1 }, { opacity: 0.6, duration: 0.5, ease: "power1.out" }, 0.16);

  /* 2. welcome: WELCOME TO tracks in from the middle, the rules draw outwards */
  const small = q(".bam-welcome .ch");
  const mid = (small.length - 1) / 2;
  tl.fromTo(
    small,
    { opacity: 0, x: (i: number) => (i - mid) * 16, y: 6 },
    { opacity: 1, x: 0, y: 0, duration: 0.5, ease: "expo.out", stagger: { each: 0.016, from: "center" } },
    0.1,
  );
  tl.fromTo(q(".bam-welcome .rule"), { scaleX: 0 }, { scaleX: 1, duration: 0.55, ease: "expo.out" }, 0.2);

  /* the big word: letters flip up from below, middle out, with a little overshoot */
  tl.fromTo(
    q(".bam-big .L"),
    { opacity: 0, yPercent: 115, rotateX: -95, scale: 0.7 },
    { opacity: 1, yPercent: 0, rotateX: 0, scale: 1, duration: 0.56, ease: "back.out(1.7)", stagger: { each: 0.03, from: "center" } },
    0.28,
  );
  tl.fromTo(q(".bam-bloom"), { opacity: 0, scale: 0.35 }, { opacity: 1, scale: 1, duration: 0.5, ease: "power2.out" }, 0.62);
  // the colour runs across the letters, left to right
  tl.fromTo(q(".bam-big .L .c"), { opacity: 0 }, { opacity: 1, duration: 0.26, stagger: 0.026, ease: "power1.out" }, 0.74);
  // the light sweep: a band of light runs across the word, clipped to the letters so only they light up.
  // --sw is the band's place in letters (from before the first to past the last); each letter reads it.
  const n = BRAND.length;
  tl.fromTo(big, { "--sw": -3 }, { "--sw": n + 2, duration: 0.62, ease: "power2.inOut" }, 0.86);
  // a lens streak flashes as the light passes the middle, and the word gives one small heartbeat
  tl.fromTo(q(".bam-flare"), { opacity: 0, scaleX: 0.05 }, { keyframes: { opacity: [0, 1, 0.9, 0] }, scaleX: 1, duration: 0.6, ease: "power2.out" }, 1.0);
  tl.fromTo(big, { scale: 1 }, { keyframes: { scale: [1, 1.035, 1] }, duration: 0.46, ease: "sine.inOut" }, 1.0);
  tl.to(q(".bam-bloom"), { opacity: 0, duration: 0.45, ease: "power1.in" }, 1.18);

  /* the word flies up and lands as the headline; the welcome is over before the games start */
  tl.addLabel("fly", 1.52);
  tl.to(q(".bam-welcome"), { opacity: 0, y: -18, duration: 0.28, ease: "power2.in" }, "fly");
  let path = { x: 0, y: 0, scale: 1 };
  tl.to(
    big,
    {
      x: () => (path = flight(big, brand)).x,
      y: () => path.y,
      scale: () => path.scale,
      duration: 0.56,
      ease: "power3.inOut",
    },
    "fly",
  );
  tl.to(q(".bam-dim"), { opacity: 0, duration: 0.6, ease: "power1.inOut" }, "fly");
  tl.fromTo(q(".bam-brand"), { opacity: 0 }, { opacity: 1, duration: 0.14, ease: "none" }, "fly+=0.5");
  tl.to(intro, { opacity: 0, duration: 0.14, ease: "none" }, "fly+=0.52");
  tl.set(intro, { display: "none" }, "fly+=0.66");

  /* 3 and 4. the two games */
  // the games come in only after the welcome has landed
  tl.addLabel("cards", "fly+=0.66");
  const [fl, gn] = ORDER.map((id) => root.querySelector<HTMLElement>(`.bam-card[data-game="${id}"]`));
  if (fl) {
    cardIn(tl, fl, "cards");
    kick(tl, fl, "cards+=0.08");
  }
  if (gn) {
    cardIn(tl, gn, "cards+=0.36");
    bounce(tl, gn, "cards+=0.4");
  }
  return tl;
}

function cardIn(tl: gsap.core.Timeline, card: HTMLElement, at: string) {
  const q = gsap.utils.selector(card);
  tl.fromTo(card, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "none" }, at);
  tl.fromTo(q(".bam-card-glow"), { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.7, ease: "power2.out" }, `${at}+=0.05`);
  tl.fromTo(q(".bam-line"), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.34 }, `${at}+=0.5`);
  tl.fromTo(q(".bam-enter"), { opacity: 0, scale: 0.92, y: 8 }, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "back.out(1.8)", clearProps: "transform" }, `${at}+=0.6`);
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

  /** Warm on intent: start loading a game before the click lands. */
  const warm = useCallback((id: GameId) => {
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

  // after the intro, when the browser is idle: warm both games so the click lands fast
  useEffect(() => {
    if (phase !== "done") return;
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
        ORDER.forEach(warm);
      },
      1500,
      400,
    );
    return () => {
      dead = true;
    };
  }, [phase, warm]);

  return (
    <div ref={rootRef} className={clsx("bam", fontVars)} data-phase={phase} style={{ background: "#000", color: "#fff" }}>
      {/* black from the very first byte, so the page can never flash white */}
      <style>{"html,body{background:#000000 !important;color:#ffffff}"}</style>

      <div className="bam-bg" aria-hidden="true">
        <div className="bam-aurora" />
        <div className="bam-stars">
          <i style={{ boxShadow: STARS_A }} />
          <i style={{ boxShadow: STARS_B }} />
        </div>
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
                onPointerEnter={() => warm(id)}
                onFocus={() => warm(id)}
              >
                <div className="bam-card-glow" aria-hidden="true" />
                <div className="bam-card-lift">
                  {/* the whole area is a way in; the real, focusable link is the enter button */}
                  <a className="bam-hit" href={g.href} tabIndex={-1} aria-hidden="true" />
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
                  <p className="bam-line">{g.line}</p>
                  <a className="bam-enter k-btn k-btn-primary" href={g.href} data-enter={id} onPointerDown={(e) => km.press(e.currentTarget)}>
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
          <span className="bam-flare" />
        </p>
      </div>
    </div>
  );
}
