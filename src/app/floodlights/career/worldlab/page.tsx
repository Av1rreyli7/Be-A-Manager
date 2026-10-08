"use client";
// TEMPORARY lab page for checking the open world on its own (deleted before release)
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
function Expose() { const gl = useThree((s) => s.gl); const scene = useThree((s) => s.scene); useEffect(() => { (window as unknown as { __gl: unknown; __scene: unknown }).__gl = gl; (window as unknown as { __scene: unknown }).__scene = scene; }, [gl, scene]); return null; }
import * as THREE from "three";
import { careerApi, readSaved } from "@/career/api";
import type { CareerState } from "@/career/types";
import World, { worldStart, type WorldCtl, type Prompt } from "@/career/world/World";
import CityMap from "@/career/world/CityMap";
import { makePlan } from "@/career/world/gen";
import { makeStreetSound } from "@/career/world/audio";
import { OUTFITS } from "@/career/body";
import "@/career/world/world.css";
import "@/career/career.css";

export default function Lab() {
  const [st, setSt] = useState<CareerState | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [bubble, setBubble] = useState<string | null>(null);
  const [map, setMap] = useState(false);
  const [q, setQ] = useState(1);
  useEffect(() => {
    const s = readSaved();
    if (s) careerApi.state(s).then((r) => setSt(r.state));
    const qq = new URLSearchParams(location.search).get("q");
    if (qq) setQ(Number(qq));
  }, []);
  const world = st ? st.life.world || (window as unknown as { __pcMockWorld?: CareerState["life"]["world"] }).__pcMockWorld : undefined;
  const plan = useMemo(() => (st && world ? makePlan(st.life.city, st.life.style, world.places, world.seed, world.tier) : null), [st, world]);
  const ctl = useRef<WorldCtl | null>(null);
  if (plan && !ctl.current) ctl.current = worldStart(plan, 10.5);
  const sound = useMemo(() => makeStreetSound(), []);
  useEffect(() => {
    (window as unknown as { __lab: unknown }).__lab = { ctl, plan, bubble };
  });
  if (!st || !plan || !ctl.current) return <p style={{ color: "#fff", padding: 40 }}>Loading</p>;
  return (
    <div data-kmode="pitch" className="pc-world" style={{ height: "100dvh" }}>
      <div className="pc-world-canvas">
        <Canvas dpr={[1, 1.25]} shadows gl={{ antialias: true }} camera={{ position: [0, 6, 8], fov: 55, near: 0.1, far: 1300 }} onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; }}>
          <Expose />
          <World state={st} plan={plan} quality={q} ctl={ctl as React.MutableRefObject<WorldCtl>} outfit={st.life.cityOutfit ? { ...st.life.cityOutfit } : OUTFITS.home} active sound={sound} onEnter={(s) => setBubble("Enter " + s.place.name)} onPrompt={setPrompt} onBubble={setBubble} onPhoto={() => setBubble("photo")} />
        </Canvas>
      </div>
      {prompt && <p className="pc-world-prompt">{prompt.key && <kbd>{prompt.key}</kbd>}{prompt.text}</p>}
      {bubble && <p className="pc-world-bubble">{bubble}</p>}
      <div className="pc-world-tools"><button className="k-btn k-btn-sm" onClick={() => setMap(true)}>Map</button></div>
      {map && <CityMap plan={plan} ctl={ctl as React.MutableRefObject<WorldCtl>} visited={[]} homeId={st.life.home.id} ownedHomes={[]} onClose={() => setMap(false)} onTravel={(s) => { ctl.current!.teleport = { x: s.door.x + s.face[0] * 1.6, z: s.door.z + s.face[1] * 1.6, ry: Math.atan2(s.face[0], s.face[1]) }; setMap(false); }} />}
    </div>
  );
}
