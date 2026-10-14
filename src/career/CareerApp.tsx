"use client";
/**
 * Player Career: the whole page. A title screen, the creator, then the career hub. The save lives on the
 * Floodlights server (the same world Manager Career uses) and, because this is a game for one, on this device
 * too: every career is kept here a moment after each change, the title lists them all to pick up again, a career
 * the server lost is put back from here without a word, and a career can be saved to a file and loaded from one.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { careerApi, careerCopy, readSaved, writeSaved, ApiError, ENDED_EVENT, type Saved, type SaveCopy } from "./api";
import Creator, { type Meta } from "./Creator";
import Hub from "./Hub";
import type { CareerState, Look, PersonForm } from "./types";
import "./career.css";

const GFX_KEY = "fl_pc_gfx";
const AUTO_KEY = "fl_pc_gfx_auto";
function readAuto(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) !== "0";
  } catch {
    return true;
  }
}
function readGfx(): number {
  try {
    const v = Number(localStorage.getItem(GFX_KEY));
    if (Number.isFinite(v) && v >= 0 && v <= 3 && localStorage.getItem(GFX_KEY) !== null) return v;
  } catch {
    /* default below */
  }
  // a first guess from the machine: small screens and few cores start lower
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4;
  return cores >= 8 ? 2 : 1;
}

const agoText = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "a moment ago";
  if (m < 60) return m + (m === 1 ? " minute" : " minutes") + " ago";
  const h = Math.round(m / 60);
  return h < 24 ? h + (h === 1 ? " hour" : " hours") + " ago" : new Date(t).toLocaleDateString("en-GB");
};

// how the list of careers shows one: the player's name, then age, position, team, season and week
const aboutOf = (st: CareerState) => ({ label: st.player.name, sub: [String(st.player.age), st.player.pos, st.team || st.player.club, st.week].filter(Boolean).join(" · ") });

export default function CareerApp() {
  const [saved, setSaved] = useState<Saved | null>(() => (typeof window === "undefined" ? null : readSaved()));
  const [state, setState] = useState<CareerState | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [screen, setScreen] = useState<"title" | "create" | "hub">("title");
  // the title screen never shows the graphics level, so reading it on the first client render is safe
  const [quality, setQualityState] = useState(() => (typeof window === "undefined" ? 2 : readGfx()));
  const [busy, setBusy] = useState(false);
  // keep it smooth: the frame guard steps the graphics down when frames run long (on unless switched off)
  const [auto, setAutoState] = useState(() => (typeof window === "undefined" ? true : readAuto()));
  const setAuto = useCallback((on: boolean) => {
    setAutoState(on);
    try {
      localStorage.setItem(AUTO_KEY, on ? "1" : "0");
    } catch {
      /* not remembered, fine */
    }
  }, []);
  const [error, setError] = useState("");
  // the title's buttons wait (a still, empty row) until a saved career has answered, so they never swap under the pointer
  const [phase, setPhase] = useState<"boot" | "loading" | "ready" | "ended">("boot");
  const [copy, setCopy] = useState<SaveCopy | null>(null);
  // every career saved on this device, and the one asking to be deleted (a second click deletes it)
  const [saves, setSaves] = useState<SaveCopy[]>([]);
  const [armed, setArmed] = useState("");
  const [note, setNote] = useState("");
  // a career put back after a server restart starts the hub afresh (a button that asked the lost save never answers)
  const [hubKey, setHubKey] = useState(0);
  const fileIn = useRef<HTMLInputElement>(null);
  // a career picked from the list (or a file) opens in the hub once it has loaded, even when it had to be put back
  const goHub = useRef(false);
  const refreshSaves = useCallback(() => careerCopy.list().then(setSaves), []);

  const setQuality = useCallback((q: number) => {
    setQualityState(q);
    try {
      localStorage.setItem(GFX_KEY, String(q));
    } catch {
      /* not remembered, fine */
    }
  }, []);
  const onSlow = useCallback((q: number) => setQuality(q), [setQuality]);

  const load = useCallback((s: Saved) => {
    setPhase("loading");
    setError("");
    return careerApi
      .state(s)
      .then((r) => {
        careerCopy.about = aboutOf(r.state);
        setState(r.state);
        setPhase("ready");
        careerCopy.take(s, true).then(refreshSaves);
        if (goHub.current) {
          goHub.current = false;
          setScreen("hub");
        }
        // back from a live match on the Floodlights page: straight to the hub
        if (/[?&](played|left)=1/.test(window.location.search)) {
          setScreen("hub");
          window.history.replaceState(null, "", window.location.pathname);
        }
      })
      .catch((e) => {
        goHub.current = false;
        setPhase("ready");
        setError(e instanceof ApiError ? e.message : "Could not open the career.");
        // a server that did not answer keeps the code for next time; a code that can never open here is forgotten
        if (e instanceof ApiError && e.answered) {
          writeSaved(null);
          setSaved(null);
        }
      });
  }, [refreshSaves]);
  useEffect(() => {
    const s = readSaved();
    fetch("/api/pc/meta")
      .then((r) => r.json())
      .then(setMeta)
      .catch(() => setError("The Floodlights server is not answering."));
    // after this render, so the first paint is the same on the server and here
    Promise.resolve().then(() => {
      refreshSaves();
      return s ? load(s) : setPhase("ready");
    });
  }, [load, refreshSaves]);
  // the save is gone from the server (it restarted): this device's copy goes back without a word and the game
  // carries on; only a career this device never kept ends on the end screen
  useEffect(() => {
    const ended = async () => {
      const s = readSaved();
      const c = s ? await careerCopy.get(s.code) : null;
      if (c) {
        try {
          const back = await careerCopy.restore(c);
          if (back.code !== c.code) await careerCopy.remove(c.code);
          writeSaved(back);
          setSaved(back);
          const r = await careerApi.state(back);
          careerCopy.about = aboutOf(r.state);
          setState(r.state);
          setPhase("ready");
          setHubKey((k) => k + 1);
          setNote("The server restarted, so your career was put back from this device. Carry on.");
          if (goHub.current) {
            goHub.current = false;
            setScreen("hub");
          }
          careerCopy.take(back, true).then(refreshSaves);
          return;
        } catch {
          /* the end screen below */
        }
      }
      setScreen("title");
      setPhase("ended");
      setCopy(c);
    };
    window.addEventListener(ENDED_EVENT, ended);
    return () => window.removeEventListener(ENDED_EVENT, ended);
  }, [refreshSaves]);
  // the career on this device a moment after every change
  useEffect(() => {
    if (!saved || !state || phase !== "ready") return;
    careerCopy.about = aboutOf(state);
    const t = setTimeout(() => void careerCopy.take(saved), 1500);
    return () => clearTimeout(t);
  }, [saved, state, phase]);
  // the list is fresh whenever the title is on screen
  useEffect(() => {
    if (screen === "title") void refreshSaves();
  }, [screen, refreshSaves]);
  const play = async (c: SaveCopy) => {
    // another career from the list: the server's save, or this device's copy put back if the server lost it
    const s = { code: c.code, name: c.name };
    writeSaved(s);
    setSaved(s);
    setState(null);
    setArmed("");
    setNote("");
    goHub.current = true;
    await load(s);
  };
  const remove = async (c: SaveCopy) => {
    if (armed !== c.code) {
      setArmed(c.code);
      return;
    }
    setArmed("");
    await careerCopy.remove(c.code);
    if (saved?.code === c.code) {
      writeSaved(null);
      setSaved(null);
      setState(null);
    }
    refreshSaves();
  };
  const toFile = (c: SaveCopy) => {
    const f = careerCopy.file(c);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(f.blob);
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const fromFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setError("");
    try {
      const c = await careerCopy.read(f);
      const s = await careerCopy.restore(c);
      writeSaved(s);
      setSaved(s);
      goHub.current = true;
      await load(s);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load that file.");
    } finally {
      setBusy(false);
      if (fileIn.current) fileIn.current.value = "";
    }
  };
  const restore = async () => {
    if (!copy) return;
    setBusy(true);
    setError("");
    try {
      const s = await careerCopy.restore(copy);
      writeSaved(s);
      setSaved(s);
      setCopy(null);
      await load(s);
      setScreen("hub");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not put the career back.");
    } finally {
      setBusy(false);
    }
  };
  const fresh = () => {
    writeSaved(null);
    setSaved(null);
    setState(null);
    setCopy(null);
    setError("");
    setPhase("ready");
    setScreen("create");
  };

  const create = async (form: PersonForm, look: Look) => {
    setBusy(true);
    setError("");
    try {
      const name = form.first.trim().slice(0, 20) || "Player";
      const r = await careerApi.create(name, { ...form, look });
      const s = { code: r.code, name };
      writeSaved(s);
      setSaved(s);
      careerCopy.about = aboutOf(r.state);
      setState(r.state);
      setPhase("ready");
      careerCopy.take(s, true);
      setScreen("hub");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not start the career.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main id="main" className="pc" data-kmode="pitch">
      {screen === "title" && (
        <section className="pc-title">
          <div className="pc-title-glow" aria-hidden="true" />
          <div className="pc-title-in">
            <p className="pc-kicker">Floodlights</p>
            <h1 className="pc-title-h">
              <span>Player</span>
              <span>Career</span>
            </h1>
            {phase === "ended" ? (
              <div className="pc-ended" role="alert">
                <h2>This game session ended</h2>
                <p>
                  {copy
                    ? "The server restarted and your career was cleared from it. This device kept a copy from " + agoText(copy.at) + ". Restore it to carry on from there."
                    : "The server restarted and your career was cleared from it, and this device has no copy of it."}
                </p>
              </div>
            ) : (
              <p className="pc-title-line">One footballer. One life. From a school pitch to the biggest stadiums in the world, in the same world Manager Career runs.</p>
            )}
            <div className="pc-title-btns">
              {phase === "boot" || phase === "loading" ? (
                <span className="pc-title-wait" role="status">
                  {phase === "loading" ? "Loading your career" : ""}
                </span>
              ) : phase === "ended" ? (
                <>
                  {copy && (
                    <button type="button" className="k-btn k-btn-primary" onClick={restore} disabled={busy}>
                      Restore the career
                    </button>
                  )}
                  <button type="button" className={copy ? "k-btn" : "k-btn k-btn-primary"} onClick={fresh} disabled={!meta || busy}>
                    New career
                  </button>
                  <Link className="k-btn" href="/">
                    Go home
                  </Link>
                </>
              ) : state && saved ? (
                <>
                  <button type="button" className="k-btn k-btn-primary" onClick={() => setScreen("hub")}>
                    Continue as {state.player.name}
                  </button>
                  <button
                    type="button"
                    className="k-btn"
                    onClick={() => {
                      setScreen("create");
                    }}
                  >
                    New career
                  </button>
                </>
              ) : (
                <button type="button" className="k-btn k-btn-primary" onClick={() => setScreen("create")} disabled={!meta}>
                  Start a new career
                </button>
              )}
              {phase !== "ended" && phase !== "boot" && phase !== "loading" && (
                <a className="k-btn" href="/floodlights/">
                  Manager Career
                </a>
              )}
            </div>
            {error && <p className="pc-bad">{error}</p>}
            {phase !== "boot" && phase !== "loading" && (
              <div className="pc-saves">
                <div className="pc-saves-head">
                  <p className="pc-kicker">Your careers on this device</p>
                  <button type="button" className="k-btn k-btn-sm" onClick={() => fileIn.current?.click()} disabled={busy}>
                    Load from a file
                  </button>
                  <input ref={fileIn} type="file" accept="application/json,.json" hidden onChange={(e) => void fromFile(e.target.files?.[0])} />
                </div>
                {saves.length === 0 ? (
                  <p className="pc-saves-none">Each career you start is kept here as you play, ready to pick up again.</p>
                ) : (
                  <ul>
                    {saves.map((c) => (
                      <li key={c.code} className={saved?.code === c.code ? "is-on" : undefined}>
                        <div className="pc-saves-who">
                          <b>{c.label || c.name}</b>
                          <span>{[c.sub, "saved " + agoText(c.at)].filter(Boolean).join(" · ")}</span>
                        </div>
                        <div className="pc-saves-btns">
                          <button type="button" className={"k-btn k-btn-sm" + (saved?.code === c.code ? " k-btn-primary" : "")} onClick={() => void play(c)} disabled={busy || !meta}>
                            {saved?.code === c.code ? "Continue" : "Play"}
                          </button>
                          <button type="button" className="k-btn k-btn-sm k-btn-ghost" onClick={() => toFile(c)}>
                            Save to a file
                          </button>
                          <button type="button" className="k-btn k-btn-sm k-btn-ghost" onClick={() => void remove(c)}>
                            {armed === c.code ? "Click again to delete" : "Delete"}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </section>
      )}
      {screen === "create" && meta && <Creator meta={meta} quality={quality} setQuality={setQuality} onCreate={create} busy={busy} error={error} onBack={() => setScreen("title")} />}
      {screen === "hub" && note && (
        <p className="pc-back-note" role="status" onClick={() => setNote("")}>
          {note}
        </p>
      )}
      {screen === "hub" && state && saved && meta && (
        <Hub
          key={hubKey}
          saved={saved}
          state={state}
          setState={setState}
          meta={meta}
          quality={quality}
          setQuality={setQuality}
          auto={auto}
          setAuto={setAuto}
          onSlow={auto ? onSlow : undefined}
          onExit={() => setScreen("title")}
        />
      )}
    </main>
  );
}
