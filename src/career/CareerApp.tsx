"use client";
/**
 * Player Career: the whole page. A title screen, the creator, then the career hub. The save lives on the
 * Floodlights server (the same world Manager Career uses); this browser remembers the save code and keeps a
 * packed copy of the save, so a career cleared by a server restart can be put back.
 */
import { useCallback, useEffect, useState } from "react";
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
        setState(r.state);
        setPhase("ready");
        careerCopy.take(s, true);
        // back from a live match on the Floodlights page: straight to the hub
        if (/[?&](played|left)=1/.test(window.location.search)) {
          setScreen("hub");
          window.history.replaceState(null, "", window.location.pathname);
        }
      })
      .catch((e) => {
        setPhase("ready");
        setError(e instanceof ApiError ? e.message : "Could not open the career.");
        // a server that did not answer keeps the code for next time; a code that can never open here is forgotten
        if (e instanceof ApiError && e.answered) {
          writeSaved(null);
          setSaved(null);
        }
      });
  }, []);
  useEffect(() => {
    const s = readSaved();
    fetch("/api/pc/meta")
      .then((r) => r.json())
      .then(setMeta)
      .catch(() => setError("The Floodlights server is not answering."));
    // after this render, so the first paint is the same on the server and here
    Promise.resolve().then(() => (s ? load(s) : setPhase("ready")));
  }, [load]);
  // the save is gone from the server: one end screen, with this device's copy if it has one
  useEffect(() => {
    const ended = () => {
      setScreen("title");
      setPhase("ended");
      const s = readSaved();
      if (s) careerCopy.get(s.code).then(setCopy);
    };
    window.addEventListener(ENDED_EVENT, ended);
    return () => window.removeEventListener(ENDED_EVENT, ended);
  }, []);
  // a fresh copy of the save on this device whenever something changed (at most every half minute)
  useEffect(() => {
    if (!saved || phase !== "ready") return;
    const t = setInterval(() => careerCopy.take(saved), 10000);
    return () => clearInterval(t);
  }, [saved, phase]);
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
      setState(r.state);
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
          </div>
        </section>
      )}
      {screen === "create" && meta && <Creator meta={meta} quality={quality} setQuality={setQuality} onCreate={create} busy={busy} error={error} onBack={() => setScreen("title")} />}
      {screen === "hub" && state && saved && meta && (
        <Hub
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
