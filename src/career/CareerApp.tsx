"use client";
/**
 * Player Career: the whole page. A title screen, the creator, then the career hub. The save lives on the
 * Floodlights server (the same world Manager Career uses); this browser only remembers the save code.
 */
import { useCallback, useEffect, useState } from "react";
import { careerApi, readSaved, writeSaved, ApiError, type Saved } from "./api";
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

  const setQuality = useCallback((q: number) => {
    setQualityState(q);
    try {
      localStorage.setItem(GFX_KEY, String(q));
    } catch {
      /* not remembered, fine */
    }
  }, []);
  const onSlow = useCallback((q: number) => setQuality(q), [setQuality]);

  useEffect(() => {
    const s = readSaved();
    fetch("/api/pc/meta")
      .then((r) => r.json())
      .then(setMeta)
      .catch(() => setError("The Floodlights server is not answering."));
    if (s)
      careerApi
        .state(s)
        .then((r) => {
          setState(r.state);
          // back from a live match on the Floodlights page: straight to the hub
          if (/[?&](played|left)=1/.test(window.location.search)) {
            setScreen("hub");
            window.history.replaceState(null, "", window.location.pathname);
          }
        })
        .catch(() => {
          writeSaved(null);
          setSaved(null);
        });
  }, []);

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
            <p className="pc-title-line">One footballer. One life. From a school pitch to the biggest stadiums in the world, in the same world Manager Career runs.</p>
            <div className="pc-title-btns">
              {state && saved ? (
                <>
                  <button type="button" className="k-btn k-btn-primary" onClick={() => setScreen("hub")}>
                    Continue as {state.player.name}
                  </button>
                  <button
                    type="button"
                    className="k-btn k-btn-glass"
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
              <a className="k-btn k-btn-glass" href="/floodlights/">
                Manager Career
              </a>
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
