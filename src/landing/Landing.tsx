"use client";
/**
 * Be-A-Manager landing page.
 * Frame, decode labels, masked headline and dock follow the Stratum reference.
 * Nav pills, glass buttons, badge and the appear / is-in entrance follow Vesper.
 * The glow buttons, the box-shadow starfield and the translate / scale
 * entrance technique follow Vertex. The featured game switcher follows SpaceEdu:
 * both games are always in the DOM and switching only toggles classes.
 */
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { Basketball, Cube, GlobeHemisphereWest, SoccerBall, Sparkle, Trophy, UsersThree } from "@phosphor-icons/react";
import { GAMES, ORDER, other, type GameId } from "./games";
import { STARS_A, STARS_B } from "./starfield";
import { createDecoder, type Decoder } from "./decode";
import "./landing.css";

// three.js and the scene live in their own chunk and only load after first paint
const Backdrop3D = lazy(() => import("./Backdrop3D"));

type ThreeState = "off" | "loading" | "on";
interface SiteStats {
  clubs: number;
  leagues: number;
  rooms: number;
  seasons: number;
}

const PREF_KEY = "bam:3d";

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

const GameIcon = ({ id }: { id: GameId }) => (id === "floodlights" ? <SoccerBall className="ico" weight="fill" aria-hidden /> : <Basketball className="ico" weight="fill" aria-hidden />);

export default function Landing({ fontVars = "" }: { fontVars?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const decoder = useRef<Decoder | null>(null);
  const [featured, setFeatured] = useState<GameId>("floodlights");
  const featuredRef = useRef<GameId>("floodlights");
  // games whose heavy assets were asked for (the featured one is always warm)
  const [warmed, setWarmed] = useState<GameId[]>(["floodlights"]);
  const [three, setThree] = useState<ThreeState>("off");
  const [still, setStill] = useState(false);
  const [stats, setStats] = useState<SiteStats | null>(null);

  // pointer parallax: motion values, never React state, so moving the mouse renders nothing
  const tx = useMotionValue(0);
  const ty = useMotionValue(0);
  const sx = useSpring(tx, { stiffness: 30, damping: 12, mass: 1 });
  const sy = useSpring(ty, { stiffness: 30, damping: 12, mass: 1 });
  const bgX = useTransform(sx, (v) => (typeof window === "undefined" ? 0 : -v * window.innerWidth * 0.0156));
  const bgY = useTransform(sy, (v) => (typeof window === "undefined" ? 0 : -v * window.innerHeight * 0.015));
  const bgScale = useTransform([sx, sy], ([a, b]: number[]) => 1 + 2 * Math.max(Math.abs(a) * 0.0156, Math.abs(b) * 0.015) + 0.014 * Math.max(0, b));

  /** Warm on intent: start loading the other game's heavy bits before the click lands. */
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

  const show = useCallback(
    (next: GameId) => {
      if (next === featuredRef.current) return;
      featuredRef.current = next;
      warm(next);
      setFeatured(next);
      const root = rootRef.current;
      const d = decoder.current;
      if (!root || !d) return;
      // the labels of the new game decode as its copy rises back in
      d.decodeIn(root.querySelector(`.bam-rail [data-game="${next}"]`), 0);
      d.decodeIn(root.querySelector(`.bam-variant[data-game="${next}"]`), 480);
    },
    [warm],
  );

  // entrance robustness (Vesper): each element settles itself on animationend, and if
  // animations are not running at all everything is force settled after two frames
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>(".appear"));
    const offs: Array<() => void> = [];
    for (const el of els) {
      const done = (e: Event) => {
        if (e.target !== el) return;
        el.classList.add("is-in");
        el.removeEventListener("animationend", done);
      };
      el.addEventListener("animationend", done);
      offs.push(() => el.removeEventListener("animationend", done));
    }
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        const alive = els.some((el) => {
          const list = typeof el.getAnimations === "function" ? el.getAnimations() : [];
          return list.some((a) => a.playState === "running" || a.playState === "finished");
        });
        if (!alive) els.forEach((el) => el.classList.add("is-in"));
      });
    });
    // last line of defence: nothing stays mid entrance for longer than the timeline
    const t = setTimeout(() => els.forEach((el) => el.classList.add("is-in")), 3200);
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
      clearTimeout(t);
      offs.forEach((f) => f());
    };
  }, []);

  // decode labels, booted once the fonts are in so the pinned widths are right
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const d = createDecoder(root, reduced);
    decoder.current = d;
    let booted = false;
    const boot = () => {
      if (booted) return;
      booted = true;
      d.boot();
    };
    const guard = setTimeout(boot, 500);
    if (document.fonts?.ready) document.fonts.ready.then(boot, boot);
    else boot();
    return () => {
      clearTimeout(guard);
      d.destroy();
      decoder.current = null;
    };
  }, []);

  // pointer parallax (mouse only, off for reduced motion)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      tx.set((e.clientX / window.innerWidth) * 2 - 1);
      ty.set((e.clientY / window.innerHeight) * 2 - 1);
    };
    const leave = () => {
      tx.set(0);
      ty.set(0);
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
    };
  }, [tx, ty]);

  // after first paint: decide on 3D, then warm the other game and fetch the live numbers when idle
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let pref: string | null = null;
    try {
      pref = localStorage.getItem(PREF_KEY);
    } catch {
      /* storage blocked: use the defaults */
    }
    const able = hasWebGL();
    const wants = pref === "on" || (pref !== "off" && !reduced && !weakDevice());
    type Idle = (cb: () => void, o?: { timeout: number }) => number;
    const ric = (window as unknown as { requestIdleCallback?: Idle }).requestIdleCallback;
    const idle = (fn: () => void, timeout: number, fallback: number) => {
      if (ric) ric(fn, { timeout });
      else setTimeout(fn, fallback);
    };
    let dead = false;
    if (able && wants) {
      idle(
        () => {
          if (dead) return;
          setStill(reduced);
          setThree("loading");
        },
        1200,
        300,
      );
    }
    idle(
      () => {
        if (dead) return;
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
      4000,
      2500,
    );
    return () => {
      dead = true;
    };
  }, [warm]);

  // the dock labels follow the 3D state and the live room count
  useEffect(() => {
    const root = rootRef.current;
    const d = decoder.current;
    if (!root || !d) return;
    d.setText(root.querySelector<HTMLElement>(".bam-3d .t"), three === "off" ? "3D OFF" : "3D ON");
  }, [three]);
  useEffect(() => {
    const root = rootRef.current;
    const d = decoder.current;
    if (!root || !d || !stats) return;
    d.setText(root.querySelector<HTMLElement>(".bam-live .t"), stats.rooms === 1 ? "1 ROOM OPEN" : `${stats.rooms} ROOMS OPEN`);
  }, [stats]);

  const toggle3D = () => {
    const turnOn = three === "off";
    try {
      localStorage.setItem(PREF_KEY, turnOn ? "on" : "off");
    } catch {
      /* fine without storage */
    }
    if (turnOn) {
      if (!hasWebGL()) return;
      setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      setThree("loading");
    } else {
      setThree("off");
    }
  };

  const onReady = useCallback(() => setThree((s) => (s === "loading" ? "on" : s)), []);
  // the scene could not hold a steady frame rate: fall back to the still backdrop
  const onSlow = useCallback(() => setThree("off"), []);

  const clubs = stats?.clubs ?? 320;
  const seasons = stats?.seasons ?? 0;

  return (
    <div ref={rootRef} className={clsx("bam", fontVars)} data-featured={featured} data-3d={three} style={{ background: "#000", color: "#fff" }}>
      {/* pure black from the very first byte, so the page can never flash white */}
      <style>{"html,body{background:#000000 !important;color:#ffffff}"}</style>

      <div className="bam-stars" aria-hidden="true">
        <i style={{ boxShadow: STARS_A }} />
        <i style={{ boxShadow: STARS_B }} />
      </div>

      <motion.div className="bam-bg" style={{ x: bgX, y: bgY, scale: bgScale }} aria-hidden="true">
        {/* the still backdrop: one soft light per game, crossfaded by class */}
        {ORDER.map((id) => (
          <div key={id} className={clsx("bam-glow", `is-${id}`, featured === id && "is-on")} />
        ))}
        {three !== "off" && (
          <div className="bam-canvas">
            <Suspense fallback={null}>
              <Backdrop3D featured={featured} sx={sx} sy={sy} warmed={warmed} still={still} onReady={onReady} onSlow={onSlow} />
            </Suspense>
          </div>
        )}
      </motion.div>
      <div className="bam-scrim" aria-hidden="true" />

      <div className="bam-frame">
        <span className="ln ln-t appear appear--drawx" style={{ "--d": ".04s", "--o": "left center" } as React.CSSProperties} />
        <span className="ln ln-l appear appear--drawy" style={{ "--d": ".04s", "--o": "center top" } as React.CSSProperties} />
        <span className="ln ln-b appear appear--drawx" style={{ "--d": ".2s", "--o": "right center" } as React.CSSProperties} />
        <span className="ln ln-r appear appear--drawy" style={{ "--d": ".2s", "--o": "center bottom" } as React.CSSProperties} />
        <span className="cn cn-tl appear appear--fade" style={{ "--d": ".55s" } as React.CSSProperties} />
        <span className="cn cn-tr appear appear--fade" style={{ "--d": ".55s" } as React.CSSProperties} />
        <span className="cn cn-bl appear appear--fade" style={{ "--d": ".55s" } as React.CSSProperties} />
        <span className="cn cn-br appear appear--fade" style={{ "--d": ".55s" } as React.CSSProperties} />

        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a plain link keeps the landing free of router state */}
        <a className="bam-logo lbl" href="/" aria-label="Be-A-Manager home">
          <span className="bam-logo-in appear appear--mask" style={{ "--d": ".16s" } as React.CSSProperties}>
            <span className="bam-mark" aria-hidden="true" />
            <span className="t" data-at="200">
              BAM
            </span>
          </span>
        </a>

        <nav className="bam-masthead" aria-label="Games">
          {ORDER.map((id, i) => (
            <a
              key={id}
              className={clsx("bam-pill lbl appear", i === 0 ? "appear--scale" : "appear--soft")}
              style={{ "--d": i === 0 ? ".3s" : ".36s" } as React.CSSProperties}
              href={GAMES[id].href}
              data-game={id}
              onPointerEnter={() => warm(id)}
              onFocus={() => warm(id)}
            >
              <span className="t" data-at={330 + i * 60}>
                {GAMES[id].name.toUpperCase()}
              </span>
            </a>
          ))}
        </nav>

        <ul className="bam-rail appear appear--fade" style={{ "--d": ".6s" } as React.CSSProperties} aria-label="Pick the featured game">
          {ORDER.map((id, i) => (
            <li key={id} className={clsx(featured === id && "on")}>
              <button type="button" data-game={id} aria-pressed={featured === id} onClick={() => show(id)} onPointerEnter={() => warm(id)} onFocus={() => warm(id)}>
                <span className="t" data-at={660 + i * 60}>
                  {GAMES[id].name.toUpperCase()}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <header className="bam-hero">
          <div className="bam-badge appear appear--pop" style={{ "--d": ".22s" } as React.CSSProperties}>
            <Sparkle className="bam-badge-star" weight="fill" aria-hidden />
            <span>Two games. One site.</span>
          </div>
          <h1 className="bam-h1">
            <span className="hrow">
              <span className="hrise appear appear--mask" style={{ "--d": ".42s", "--dur": ".9s" } as React.CSSProperties}>
                Be-A-Manager
              </span>
            </span>
          </h1>
          <p className="bam-lede appear appear--soft" style={{ "--d": ".7s", "--dur": "1.25s" } as React.CSSProperties}>
            Pick a game, grab your friends and run the <em>whole</em> show.
          </p>
        </header>

        <section className="bam-feature" aria-label="Featured game">
          {ORDER.map((id) => {
            const g = GAMES[id];
            const on = featured === id;
            // only the game that starts featured takes part in the entrance timeline
            const first = id === "floodlights";
            const ap = (cls: string) => (first ? `appear ${cls}` : "");
            const d = (v: string) => (first ? ({ "--d": v } as React.CSSProperties) : undefined);
            return (
              <article key={id} className={clsx("bam-variant", on && "is-on")} data-game={id} aria-hidden={!on} inert={!on}>
                <div className={clsx("bam-kind lbl", ap("appear--soft"))} style={d(".76s")}>
                  <GameIcon id={id} />
                  <span className="t" data-at={first ? 800 : undefined}>
                    {g.kind}
                  </span>
                </div>
                <h2 className="bam-title">
                  <span className="hrow">
                    <span className={clsx("hrise", ap("appear--mask"))} style={first ? ({ "--d": ".8s", "--dur": ".9s" } as React.CSSProperties) : undefined}>
                      {g.name}
                    </span>
                  </span>
                </h2>
                <p className={clsx("bam-blurb", ap("appear--soft"))} style={d(".88s")}>
                  {g.blurb}
                  {g.inside?.map((x) => (
                    <span key={x.name} className="bam-in">
                      <b>{x.name}:</b> {x.text}
                    </span>
                  ))}
                </p>
                <div className="bam-actions">
                  <a className={clsx("bam-glowbtn lbl", ap("appear--btn"))} style={d(".96s")} href={g.href} data-enter={id}>
                    <span className="t" data-at={first ? 1000 : undefined}>
                      {g.enter}
                    </span>
                  </a>
                  <button
                    type="button"
                    className={clsx("bam-btn bam-btn-ghost lbl", ap("appear--side"))}
                    style={d("1.04s")}
                    data-see={other(id)}
                    onClick={() => show(other(id))}
                    onPointerEnter={() => warm(other(id))}
                    onFocus={() => warm(other(id))}
                  >
                    <span className="t" data-at={first ? 1080 : undefined}>
                      {GAMES[other(id)].see}
                    </span>
                  </button>
                </div>
              </article>
            );
          })}
        </section>

        <footer className="bam-stats">
          <div className="bam-stat appear appear--stat" style={{ "--d": "1.12s" } as React.CSSProperties}>
            <GlobeHemisphereWest className="ico" weight="duotone" aria-hidden />
            <span>
              <b>{clubs}</b> clubs in the world
            </span>
          </div>
          <div className="bam-stat appear appear--stat" style={{ "--d": "1.28s" } as React.CSSProperties}>
            <Trophy className="ico" weight="duotone" aria-hidden />
            {seasons > 0 ? (
              <span>
                <b>{seasons}</b> {seasons === 1 ? "season played" : "seasons played"}
              </span>
            ) : (
              <span>
                <b>{stats?.leagues ?? 15}</b> leagues to win
              </span>
            )}
          </div>
          <div className="bam-stat appear appear--stat" style={{ "--d": "1.44s" } as React.CSSProperties}>
            <UsersThree className="ico" weight="duotone" aria-hidden />
            <span>Two managers, one site</span>
          </div>
        </footer>

        <div className="bam-dock">
          <span className="rule appear appear--drawx" style={{ "--d": ".92s", "--o": "left center" } as React.CSSProperties} />
          <span className="div div-l appear appear--drawy" style={{ "--d": "1.06s", "--o": "center top" } as React.CSSProperties} />
          <span className="div div-r appear appear--drawy" style={{ "--d": "1.06s", "--o": "center top" } as React.CSSProperties} />

          <button type="button" className="bam-3d lbl appear appear--soft" style={{ "--d": ".96s" } as React.CSSProperties} aria-pressed={three !== "off"} onClick={toggle3D}>
            <Cube className="ico" weight={three === "off" ? "regular" : "fill"} aria-hidden />
            <span className="t" data-at="1000">
              3D OFF
            </span>
          </button>

          <p className="bam-credit lbl appear appear--soft" style={{ "--d": "1.02s" } as React.CSSProperties}>
            <span className="t" data-at="1060">
              By Avir &amp; Ayanssh
            </span>
          </p>

          <p className="bam-live lbl appear appear--soft" style={{ "--d": "1.08s" } as React.CSSProperties}>
            <span className="bam-pulse" aria-hidden="true" />
            <span className="t" data-at="1120">
              ONLINE
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
