"use client";
/* TEMPORARY lab for the interiors owner: renders one place with a fixture career. Deleted before hand over. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Canvas, useFrame, useThree, addAfterEffect } from "@react-three/fiber";
import * as THREE from "three";
import Interior, { type Hotspot, type WalkCtl, resolvePlace } from "@/career/city/Interior";
import ShopHud from "@/career/city/ShopHud";
import { Environment, DPR_CAP } from "@/career/Stage";
import { OUTFITS } from "@/career/body";
import type { CareerState, Life } from "@/career/types";
import type { PlaceId } from "@/career/city/CityScene";
import fixture from "./fixture.json";
import "@/career/career.css";

function CamSetup({ panel }: { panel: number }) {
  const get = useThree((s) => s.get);
  useFrame(() => {
    const cam = get().camera as THREE.PerspectiveCamera;
    const { width: W, height: H } = get().size;
    const want = (W + panel) / H;
    if (Math.abs(cam.aspect - want) > 1e-3 || cam.fov !== 48) {
      cam.fov = 48;
      cam.far = 200;
      cam.aspect = want;
      cam.setViewOffset(W + panel, H, panel, 0, W, H);
      cam.updateProjectionMatrix();
    }
  });
  return null;
}
function Probe() {
  const gl = useThree((s) => s.gl);
  const t0 = useRef(0);
  useFrame(() => {
    t0.current = performance.now();
  }, -1000);
  useFrame(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__calls = gl.info.render.calls;
    w.__tris = gl.info.render.triangles;
  });
  useEffect(
    () =>
      addAfterEffect(() => {
        const w = window as unknown as { __cpu?: number[] };
        (w.__cpu ||= []).push(performance.now() - t0.current);
        if (w.__cpu.length > 400) w.__cpu.shift();
      }),
    [],
  );
  return null;
}

function Lab() {
  const [q] = useState(() => (typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search)));
  const who = (q.get("who") || "rich") as "rich" | "young";
  const quality = Number(q.get("q") ?? 1);
  const [state, setState] = useState<CareerState>(() => {
    const s = JSON.parse(JSON.stringify({ ...fixture.base, life: fixture[who] })) as CareerState;
    s.player.age = who === "rich" ? 24 : 15;
    s.money.cash = who === "rich" ? 25000000 : 900;
    if (q.get("inj")) s.cond.inj = { name: "Hamstring strain", weeks: 3, total: 4 };
    return s;
  });
  const pid = q.get("place") || "store:gucci";
  const legacy = ["home", "gym", "restaurant", "mall", "shops", "training", "stadium"].includes(pid) && q.get("legacy") === "1";
  const place = useMemo(() => (legacy ? null : resolvePlace(state, pid)), [legacy, state, pid]);
  const ctl = useRef<WalkCtl>({ yaw: Number(q.get("yaw") || 0), zoom: Number(q.get("zoom") || 1), use: -1 });
  const labelEls = useRef(new Map<string, HTMLElement>());
  const [near, setNear] = useState<string | null>(null);
  const [hs, setHs] = useState<Hotspot[]>([]);
  const [busy, setBusy] = useState(false);
  const onNear = useCallback((id: string | null) => setNear(id), []);
  const onUse = useCallback(() => {}, []);
  const onHotspots = useCallback((h: Hotspot[]) => setHs(h), []);
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__hs = hs.map((h) => h.id);
    w.__walk = (id: string) => {
      const k = hs.findIndex((h) => h.id === id || h.id.startsWith(id));
      ctl.current.use = k;
      return k;
    };
    w.__ctl = ctl.current;
    w.__near = near;
  }, [hs, near]);
  const money = useCallback((n: number, o?: { week?: boolean }) => "£" + (Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(2) + "m" : Math.round(n).toLocaleString("en-GB")) + (o?.week ? " a week" : ""), []);
  const stRef = useRef(state);
  useEffect(() => {
    stRef.current = state;
  }, [state]);
  const act = useCallback(async (p: string, a: string, arg?: string) => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 200));
    let text = "Lab: " + p + " " + a + " " + (arg || "");
    const s = JSON.parse(JSON.stringify(stRef.current)) as CareerState;
    const L = s.life as Life;
    const it = L.catalog?.items.find((i) => i.id === arg);
    if (a === "buy" && it) {
      it.owned = true;
      it.canBuy = false;
      s.money.cash -= it.price;
      text = "Bought the " + it.label + ".";
      if (it.brand === "Rolex" && !(L.moments || []).some((m) => m.id === "rolex"))
        L.moments = [{ id: "rolex", kind: "watch", s: 1, w: 1, title: "Your first Rolex", text: "The " + it.label + ". The man behind the counter puts it on your wrist himself. You remember the Casio you wore to school.", price: it.price, item: it.id, seen: false } as never, ...(L.moments || [])];
    }
    L.done = [{ place: p, action: a, text }, ...L.done];
    setState(s);
    setBusy(false);
    return { text, state: s };
  }, []);
  const outfit = pid === "gym" || pid === "training" || pid === "stadium" ? OUTFITS.training : OUTFITS.home;
  if (!legacy && !place) return <p style={{ color: "#fff", padding: 20 }}>No place {pid}</p>;
  return (
    <div className="pc" style={{ minHeight: "100dvh" }}>
      <div className="pc-city" style={{ height: "100dvh", marginTop: 0, borderRadius: 0 }}>
        <div className="pc-city-canvas is-inside">
          <Canvas
            dpr={[1, DPR_CAP[quality]]}
            shadows={quality >= 2 ? { type: THREE.PCFShadowMap } : false}
            gl={{ antialias: quality >= 1, powerPreference: "high-performance", preserveDrawingBuffer: true }}
            camera={{ position: [0, 5, 6], fov: 48, near: 0.1, far: 200 }}
            onCreated={({ gl }) => {
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.05;
            }}
          >
            <CamSetup panel={354} />
            <Environment intensity={0.55} />
            <Interior place={legacy ? (pid as PlaceId) : place!} state={state} quality={quality} night={Number(q.get("night") || 0)} outfit={outfit} ctl={ctl} labelEls={labelEls} onNear={onNear} onUse={onUse} onHotspots={onHotspots} />
            <Probe />
          </Canvas>
        </div>
        <div className="pc-city-hud">
          <p className="pc-kicker">{place?.kind}</p>
          <h2 className="pc-city-title">{place?.name || pid}</h2>
        </div>
        <div className="pc-city-side">
          <p className="pc-dim pc-city-hint">Lab. {hs.length} things here.</p>
          <ul className="pc-place-list">
            {hs
              .filter((h) => h.tag)
              .map((h) => (
                <li key={h.id}>
                  <button type="button" className="pc-place-row" onClick={() => (ctl.current.use = hs.indexOf(h))}>
                    <b>{h.label}</b>
                  </button>
                </li>
              ))}
          </ul>
        </div>
        <ShopHud place={place} state={state} near={near} busy={busy} money={money} act={act} onLeave={(o) => console.log("leave", JSON.stringify(o))} />
      </div>
    </div>
  );
}

export default dynamic(() => Promise.resolve(Lab), { ssr: false });
