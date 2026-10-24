"use client";
/**
 * One fight on screen: the canvas with its World, the HUD over it, and the moments between: the ring walk and
 * the introductions, the round cards, the knockdown count, the corner between rounds, the result. Esc or P pauses
 * (so does leaving the tab). The fight is saved every few seconds and at every change of phase, so a refresh can
 * carry on from the entry page. The frame guard steps the graphics down if frames run long, and the world is
 * rebuilt around the same fight state.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import FightCanvas from "../view/FightCanvas";
import { World, type WorldMode } from "../view/world";
import { FrameGuard, GFX } from "../view/gfx";
import { createFight, testKnockDown } from "../engine/fight";
import type { FightConfig, FightEvent, FightState, FighterDef } from "../engine/types";
import { addResult, clearFight, saveFight, type Settings } from "../save";
import Hud, { type HudApi } from "./Hud";
import { Corner, Intro, Pause, Result, RoundCard } from "./Overlays";

export interface FightSetup {
  meRef: string;
  themRef: string;
  me: FighterDef;
  them: FighterDef;
  cfg: FightConfig;
  /** a fight put back from the device */
  resume?: FightState;
  seed: number;
}

type Overlay = "intro" | "round" | "corner" | "result" | "none";

export default function FightScreen(props: {
  setup: FightSetup;
  settings: Settings;
  onSettings: (s: Partial<Settings>) => void;
  onExit: () => void;
  onRematch: () => void;
  test?: { autopilot: boolean; speed: number; skipIntro: boolean };
}) {
  const { setup, settings } = props;
  const [st] = useState<FightState>(() => setup.resume ?? createFight([setup.me, setup.them], setup.cfg, setup.seed));
  const [quality, setQuality] = useState(settings.gfx);
  const [world, setWorld] = useState<World | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(() => (setup.resume ? (st.phase === "corner" ? "corner" : st.phase === "pre" ? "round" : "none") : props.test?.skipIntro ? "round" : "intro"));
  const [paused, setPaused] = useState(!!setup.resume && (st.phase === "fight" || st.phase === "kd" || st.phase === "bell"));
  const [, setTick] = useState(0);
  const hud = useRef<HudApi | null>(null);
  const guard = useRef(new FrameGuard());
  const recorded = useRef(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // ---- the world: built for this fight and graphics level (rebuilt around the same state when the level changes)
  useEffect(() => {
    const w = new World(st, quality, "#ff4630");
    w.autopilot = !!props.test?.autopilot;
    w.speed = props.test?.speed ?? 1;
    w.audio.setVolume(settingsRef.current.volume, settingsRef.current.sound);
    w.controls.setSensitivity(settingsRef.current.look);
    const ov = overlayRef.current;
    const mode: WorldMode = ov === "intro" ? "intro" : ov === "corner" ? "corner" : ov === "result" ? "result" : "fight";
    w.setMode(mode);
    w.paused = pausedRef.current;
    Promise.resolve().then(() => setWorld(w));
    return () => {
      w.dispose();
    };
    // the world follows the fight state and the level only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st, quality]);

  // ---- saving
  const persist = useCallback(() => {
    if (st.phase === "over") clearFight();
    else saveFight(setup.meRef, setup.themRef, st);
  }, [st, setup.meRef, setup.themRef]);
  useEffect(() => {
    const out = () => persist();
    window.addEventListener("pagehide", out);
    window.addEventListener("beforeunload", out);
    return () => {
      window.removeEventListener("pagehide", out);
      window.removeEventListener("beforeunload", out);
    };
  }, [persist]);

  // ---- the end of the fight: the record, and the result screen after the moment has landed
  const finish = useCallback(() => {
    if (recorded.current || !st.result) return;
    recorded.current = true;
    const r = st.result;
    addResult(setup.meRef, r.winner === null ? null : r.winner === 0, r.method === "KO" || r.method === "TKO");
    clearFight();
    setTimeout(() => {
      setOverlay("result");
      world?.setMode("result");
    }, props.test?.speed && props.test.speed > 1 ? 300 : 2600);
  }, [st, setup.meRef, world, props.test]);

  // ---- hooks from the world
  useEffect(() => {
    if (!world) return;
    world.hooks = {
      phase: s => {
        if (s.phase === "corner") {
          world.setMode("corner");
          setOverlay("corner");
          world.controls.setEnabled(false);
        } else if (s.phase === "pre") {
          setOverlay("round");
        } else if (s.phase === "over") {
          world.controls.setEnabled(false);
          finish();
        }
        setTick(t => t + 1);
      },
      event: (e: FightEvent, s) => hud.current?.event(e, s),
      frame: w => {
        hud.current?.frame(w);
        if (guard.current.tick(performance.now(), w.workMs) && settingsRef.current.auto && quality > 0) {
          props.onSettings({ gfx: quality - 1 });
          setQuality(q => Math.max(0, q - 1));
          hud.current?.say("Graphics lowered to " + GFX[quality - 1].name + " to keep it smooth");
        }
      },
      save: () => persist(),
    };
    world.controls.attach(document.body);
    world.controls.onPause = () => togglePause();
    world.controls.onAny = () => {
      world.audio.start();
      hud.current?.active();
    };
    const fighting = overlayRef.current === "none" && !pausedRef.current && st.phase !== "over";
    world.controls.setEnabled(fighting);
    if (st.phase === "over" && !recorded.current) finish();
    return () => world.controls.detach();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);

  // ---- pause
  const togglePause = useCallback(() => {
    if (!world || overlayRef.current === "result" || overlayRef.current === "intro") return;
    setPaused(p => {
      const np = !p;
      world.paused = np;
      world.controls.setEnabled(!np && overlayRef.current === "none");
      world.controls.reset();
      if (np) {
        world.audio.suspend();
        persist();
        guard.current.hold();
      } else world.audio.start();
      return np;
    });
  }, [world, persist]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden && world && !pausedRef.current && overlayRef.current === "none" && st.phase !== "over") togglePause();
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("blur", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("blur", hide);
    };
  }, [world, togglePause, st]);

  // ---- the moments between
  const introDone = useCallback(() => {
    if (!world) return;
    world.setMode("fight");
    setOverlay("round");
  }, [world]);
  const roundDone = useCallback(() => {
    if (!world) return;
    world.bell();
    world.setMode("fight");
    setOverlay("none");
    world.controls.reset();
    world.controls.setEnabled(!pausedRef.current);
    guard.current.hold();
  }, [world]);
  const cornerDone = useCallback(() => {
    if (!world) return;
    world.leaveCorner();
    setOverlay("round");
  }, [world]);

  // the computer playing your corner (tests and the soak) moves through every screen by itself
  useEffect(() => {
    if (!world || !props.test?.autopilot) return;
    const fast = (props.test.speed ?? 1) > 1;
    const t = setTimeout(() => {
      if (overlay === "intro") introDone();
      else if (overlay === "round") roundDone();
      else if (overlay === "corner") cornerDone();
    }, overlay === "intro" ? (fast ? 400 : 3000) : fast ? 250 : 1500);
    return () => clearTimeout(t);
  }, [overlay, world, props.test, introDone, roundDone, cornerDone]);

  // the test hook: a window handle for the browser pass
  useEffect(() => {
    const w = window as unknown as { __PF?: Record<string, unknown> };
    if (!w.__PF) return;
    Object.assign(w.__PF, {
      world, st, overlay, paused, quality, togglePause, introDone, roundDone, cornerDone,
      // levers for the browser battery and the screenshots
      kd: (who: 0 | 1) => testKnockDown(st, who),
      endRound: () => { if (st.phase === "fight") st.clock = 0.05; },
      hurt: (who: 0 | 1, hp: number) => { st.f[who].headHP = hp; },
    });
  }, [world, st, overlay, paused, quality, togglePause, introDone, roundDone, cornerDone]);

  return (
    <div className="pf-fight" data-overlay={overlay} data-paused={paused ? "1" : "0"}>
      {world && <FightCanvas key={quality} world={world} quality={quality} />}
      {world && <Hud ref={hud} st={st} me={setup.me} them={setup.them} quality={quality} strip={settings.strip} hidden={overlay !== "none"} />}
      {world && overlay === "intro" && <Intro st={st} world={world} onDone={introDone} />}
      {world && overlay === "round" && <RoundCard st={st} onDone={roundDone} paused={paused} />}
      {world && overlay === "corner" && <Corner st={st} world={world} onDone={cornerDone} paused={paused} />}
      {world && overlay === "result" && <Result st={st} me={setup.me} them={setup.them} meRef={setup.meRef} onRematch={props.onRematch} onExit={props.onExit} />}
      {paused && overlay !== "result" && (
        <Pause
          settings={settings}
          quality={quality}
          onResume={togglePause}
          onQuality={q => {
            props.onSettings({ gfx: q });
            setQuality(q);
          }}
          onSettings={s => {
            props.onSettings(s);
            if (world) {
              const ns = { ...settings, ...s };
              world.audio.setVolume(ns.volume, ns.sound);
              world.controls.setSensitivity(ns.look);
            }
          }}
          onQuit={() => {
            clearFight();
            props.onExit();
          }}
        />
      )}
    </div>
  );
}
