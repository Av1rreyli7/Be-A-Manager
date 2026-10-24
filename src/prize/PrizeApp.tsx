"use client";
/**
 * PRIZE FIGHTER: the whole page. Screens: the entry, quick fight (pick two boxers and the fight), the creator, and
 * the fight. Everything is kept on this device (src/prize/save.ts): created fighters, records, settings, and the
 * fight in progress, which the entry offers to carry on after a refresh. The page reads the device only after it
 * mounts, behind a still dark screen, so nothing flashes.
 *
 * Test hooks (?pftest=1): window.__PF exposes the screen, the world and the fight state and a few levers for the
 * browser battery: &auto (the computer plays your corner), &speed=N, &skipintro, &screen= with &me= and &them=,
 * &gfx= &rounds= &sec= &tier= for this visit only, and &fixed (the graphics level never steps down by itself).
 */
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import "./prize.css";
import { listFighters, saveFighter, deleteFighter, getFighter, readSettings, writeSettings, loadFight, clearFight, type Settings } from "./save";
import type { Created } from "./engine/create";
import type { FightConfig } from "./engine/types";
import { ROSTER } from "./engine/roster";
import { allFighters, resolve } from "./ui/fighters";
import Entry, { type ResumeInfo } from "./ui/Entry";
import type { FightSetup } from "./ui/FightScreen";
import { SettingsPanel } from "./ui/Overlays";

const Select = dynamic(() => import("./ui/Select"), { ssr: false, loading: () => <Still /> });
const Creator = dynamic(() => import("./ui/Creator"), { ssr: false, loading: () => <Still /> });
const FightScreen = dynamic(() => import("./ui/FightScreen"), { ssr: false, loading: () => <Still text="Into the arena" /> });

type Screen = { s: "boot" } | { s: "entry" } | { s: "select" } | { s: "create"; edit: string | null } | { s: "fight"; setup: FightSetup; key: number };

function Still({ text }: { text?: string }) {
  return (
    <div className="pf-still" role="status" aria-live="polite">
      {text ? <span>{text}</span> : null}
    </div>
  );
}

/** a canvas that cannot start (no WebGL) shows a message instead of a broken page */
class Guard3D extends Component<{ children: ReactNode; onBack: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    /* shown below */
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="pf-still pf-fail" role="alert">
        <b>This browser could not start the 3D ring.</b>
        <span>PRIZE FIGHTER needs WebGL. Try another browser, or switch on hardware acceleration.</span>
        <button className="k-btn" onClick={this.props.onBack}>
          Back
        </button>
      </div>
    );
  }
}

function useRingMode() {
  useEffect(() => {
    const b = document.body;
    const prev = b.dataset.kmode;
    b.dataset.kmode = "ring";
    return () => {
      if (prev) b.dataset.kmode = prev;
      else delete b.dataset.kmode;
    };
  }, []);
}

export default function PrizeApp() {
  useRingMode();
  const [screen, setScreen] = useState<Screen>({ s: "boot" });
  const [settings, setSettingsState] = useState<Settings | null>(null);
  const [created, setCreated] = useState<Created[]>([]);
  const [picks, setPicks] = useState<{ me: string | null; them: string | null }>({ me: null, them: null });
  const [resume, setResume] = useState<ResumeInfo | null>(null);
  const [note, setNote] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pendingFight = useRef<[string, string] | null>(null);
  const test = useRef<{ on: boolean; autopilot: boolean; speed: number; skipIntro: boolean }>({ on: false, autopilot: false, speed: 1, skipIntro: false });

  const refreshResume = useCallback(() => {
    const f = loadFight();
    setResume(f ? { round: f.state.round, rounds: f.state.cfg.rounds, them: f.state.defs[1].name, at: f.at } : null);
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = test.current;
    t.on = q.has("pftest");
    t.autopilot = t.on && q.has("auto");
    t.speed = t.on ? Math.max(1, Math.min(40, Number(q.get("speed")) || 1)) : 1;
    t.skipIntro = t.on && q.has("skipintro");
    Promise.resolve().then(() => {
      const base = readSettings();
      const g = Number(q.get("gfx"));
      // a test link can pick the graphics level for this visit (it is not saved)
      const over: Partial<Settings> = {};
      if (t.on && q.has("gfx") && g >= 0 && g <= 3) over.gfx = g;
      // &fixed keeps that level for the whole visit (the soak compares the start of a night with its end)
      if (t.on && q.has("fixed")) over.auto = false;
      const r = Number(q.get("rounds")), sec = Number(q.get("sec")), tier = Number(q.get("tier"));
      if (t.on && (r === 3 || r === 6 || r === 12)) over.rounds = r;
      if (t.on && (sec === 60 || sec === 120 || sec === 180)) over.roundSec = sec;
      if (t.on && q.has("tier") && tier >= 0 && tier <= 4) over.tier = tier as Settings["tier"];
      // a test link can set these for this visit (they are not saved)
      setSettingsState({ ...base, ...over });
      setCreated(listFighters());
      refreshResume();
      const s = t.on ? q.get("screen") : null;
      const me = q.get("me"), them = q.get("them");
      if (me || them) setPicks({ me: me && resolve(me) ? me : null, them: them && resolve(them) ? them : null });
      if (s === "fight" && me && them && resolve(me) && resolve(them)) {
        pendingFight.current = [me, them];
        setScreen({ s: "entry" });
      } else if (s === "select") setScreen({ s: "select" });
      else if (s === "create") setScreen({ s: "create", edit: q.get("edit") });
      else setScreen({ s: "entry" });
    });
  }, [refreshResume]);

  const setSettings = useCallback((s: Partial<Settings>) => {
    setSettingsState(cur => {
      const next = { ...(cur ?? readSettings()), ...s };
      writeSettings(next);
      return next;
    });
  }, []);

  const fighters = useMemo(() => allFighters(created), [created]);

  const startFight = useCallback(
    (me: string, them: string, resumeState?: FightSetup["resume"]) => {
      const a = resolve(me, created), b = resolve(them, created);
      const s = settings ?? readSettings();
      if (!a || !b) {
        setNote("That fighter is no longer on this device.");
        setScreen({ s: "entry" });
        return;
      }
      const cfg: FightConfig = resumeState ? resumeState.cfg : { rounds: s.rounds, roundSec: s.roundSec, tier: s.tier, human: true };
      setScreen(cur => ({ s: "fight", key: (cur.s === "fight" ? cur.key : 0) + 1, setup: { meRef: me, themRef: them, me: { ...a, id: me }, them: { ...b, id: them }, cfg, resume: resumeState, seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0 } }));
    },
    [created, settings],
  );

  // a test link straight into a fight, once the device has been read
  useEffect(() => {
    if (!pendingFight.current || !settings) return;
    const [a, b] = pendingFight.current;
    pendingFight.current = null;
    Promise.resolve().then(() => startFight(a, b));
  }, [settings, startFight]);

  // the other screens load their code on first use; fetch it quietly once the entry is up so they open at once
  useEffect(() => {
    if (screen.s !== "entry") return;
    const warm = () => {
      import("./ui/Select");
      import("./ui/Creator");
      import("./ui/FightScreen");
    };
    const t = window.setTimeout(warm, 1200);
    return () => window.clearTimeout(t);
  }, [screen.s]);

  // the test hook
  useEffect(() => {
    if (!test.current.on) return;
    const w = window as unknown as { __PF?: Record<string, unknown> };
    w.__PF = Object.assign(w.__PF ?? {}, {
      screen: screen.s,
      settings,
      created,
      picks,
      go: (s: string, a?: string, b?: string) => {
        if (s === "fight" && a && b) startFight(a, b);
        else if (s === "select") setScreen({ s: "select" });
        else if (s === "create") setScreen({ s: "create", edit: a ?? null });
        else setScreen({ s: "entry" });
      },
      roster: ROSTER.map(f => f.id),
    });
  }, [screen, settings, created, picks, startFight]);

  if (screen.s === "boot" || !settings) return <div data-kmode="ring" className="pf-root"><Still /></div>;

  return (
    <div data-kmode="ring" className="pf-root" data-screen={screen.s}>
      {screen.s === "entry" && (
        <>
          <Entry
            created={created}
            resume={resume}
            onQuick={() => setScreen({ s: "select" })}
            onCreate={() => setScreen({ s: "create", edit: null })}
            onFightAs={ref => {
              setPicks(p => ({ me: ref, them: p.them === ref ? null : p.them }));
              setScreen({ s: "select" });
            }}
            onEdit={id => setScreen({ s: "create", edit: id })}
            onDelete={id => {
              deleteFighter(id);
              const list = listFighters();
              setCreated(list);
              setPicks(p => ({ me: p.me === "c:" + id ? null : p.me, them: p.them === "c:" + id ? null : p.them }));
            }}
            onResume={() => {
              const f = loadFight();
              if (!f) {
                refreshResume();
                setNote("That fight could not be carried on.");
                return;
              }
              startFight(f.me, f.them, f.state);
            }}
            onAbandon={() => {
              clearFight();
              refreshResume();
            }}
            onSettings={() => setSettingsOpen(true)}
          />
          {settingsOpen && (
            <div className="k-scrim" onMouseDown={e => e.target === e.currentTarget && setSettingsOpen(false)} onKeyDown={e => e.key === "Escape" && setSettingsOpen(false)}>
              <div className="k-modal" role="dialog" aria-modal="true" aria-label="Graphics and sound">
                <h2 className="k-modal-title">Graphics and sound</h2>
                <button className="k-btn k-btn-ghost k-btn-sm k-modal-x" data-pf="close" onClick={() => setSettingsOpen(false)} autoFocus>
                  Close
                </button>
                <SettingsPanel settings={settings} quality={settings.gfx} onQuality={q => setSettings({ gfx: q })} onSettings={setSettings} />
              </div>
            </div>
          )}
          {note && (
            <p className="pf-toast" role="status" onAnimationEnd={() => setNote("")}>
              {note}
            </p>
          )}
        </>
      )}
      {screen.s === "select" && (
        <Guard3D onBack={() => setScreen({ s: "entry" })}>
          <Select
            fighters={fighters}
            me={picks.me}
            them={picks.them}
            settings={settings}
            onPick={(side, id) => setPicks(p => (side === "me" ? { me: id, them: p.them === id ? null : p.them } : { them: id, me: p.me === id ? null : p.me }))}
            onSettings={setSettings}
            onFight={() => picks.me && picks.them && startFight(picks.me, picks.them)}
            onBack={() => {
              refreshResume();
              setScreen({ s: "entry" });
            }}
          />
        </Guard3D>
      )}
      {screen.s === "create" && (
        <Guard3D onBack={() => setScreen({ s: "entry" })}>
          <Creator
            initial={screen.edit ? getFighter(screen.edit) : null}
            quality={settings.gfx}
            onSave={c => {
              const saved = saveFighter(c);
              if (!saved) return "This browser is not keeping saves (a private window, or storage is blocked), so the fighter could not be saved.";
              setCreated(listFighters());
              setPicks(p => ({ me: "c:" + saved.id, them: p.them === "c:" + saved.id ? null : p.them }));
              setScreen({ s: "select" });
              return null;
            }}
            onCancel={() => setScreen({ s: "entry" })}
          />
        </Guard3D>
      )}
      {screen.s === "fight" && (
        <Guard3D onBack={() => setScreen({ s: "entry" })}>
          <FightScreen
            key={screen.key}
            setup={screen.setup}
            settings={settings}
            onSettings={setSettings}
            onExit={() => {
              refreshResume();
              setCreated(listFighters());
              setScreen({ s: "select" });
            }}
            onRematch={() => startFight(screen.setup.meRef, screen.setup.themRef)}
            test={test.current.on ? { autopilot: test.current.autopilot, speed: test.current.speed, skipIntro: test.current.skipIntro } : undefined}
          />
        </Guard3D>
      )}
    </div>
  );
}
