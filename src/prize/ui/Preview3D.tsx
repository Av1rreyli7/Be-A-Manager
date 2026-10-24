"use client";
/**
 * A small 3D stage under one spotlight: the face off on the quick fight screen (both boxers in their stance,
 * facing each other) or one boxer in the creator, turned round by dragging. The same bodies and animator the
 * fight uses, so what you pick is what you fight with. Bodies are rebuilt only when a fighter's look changes.
 */
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { FState, FighterDef } from "../engine/types";
import { makeBoxer, type BoxerBody } from "../view/boxer";
import { BoxerAnimator } from "../view/animator";
import { emptyStats } from "../engine/scoring";

function stubFighter(def: FighterDef): FState {
  return {
    x: 0, z: 0, vx: 0, vz: 0, stance: def.stance, wantStance: false, guard: def.guard, headHP: 100, bodyHP: 100, stamina: 100, maxStam: 100, stun: 0, rocked: 0,
    action: null, buf: null, evBuf: null, last: null, combo: 0, spam: 0, evGap: 99, sprint: 0, sprintCd: 0, open: 0, overext: 0, cut: [0, 0], swell: [0, 0],
    kdRound: 0, kdFight: 0, clinchRound: 0, warnings: 0, lastLanded: 0, hurtAt: 0, unanswered: 0, idle: 0, hx: 0, hy: 0, hz: 0, tell: null, react: null, getup: null,
    rs: emptyStats(), fs: emptyStats(),
  };
}

/** a key for a look: rebuild the body only when something that shows has changed */
function lookKey(d: FighterDef) {
  return JSON.stringify([d.look, d.heightCm, d.weightKg, d.reachIn]);
}

interface Slot {
  key: string;
  body: BoxerBody;
  anim: BoxerAnimator;
  f: FState;
}

function Stage({ fighters, mode, quality }: { fighters: (FighterDef | null)[]; mode: "faceoff" | "solo"; quality: number }) {
  const { scene, camera, gl } = useThree();
  const slots = useRef<(Slot | null)[]>([null, null]);
  const group = useMemo(() => new THREE.Group(), []);
  const drag = useRef({ yaw: 0, down: false, x: 0, vel: 0 });
  useEffect(() => {
    scene.add(group);
    scene.background = new THREE.Color(0x05060a);
    scene.fog = new THREE.Fog(0x05060a, 6, 14);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(3.2, 48), new THREE.MeshStandardMaterial({ color: 0x1a1b20, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    group.add(floor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.55, 1.6, 64), new THREE.MeshBasicMaterial({ color: 0xff4630, transparent: true, opacity: 0.55 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.002;
    group.add(ring);
    const key = new THREE.SpotLight(0xfff1de, 60, 14, Math.PI / 5, 0.5, 1.5);
    key.position.set(0.6, 6, 1.6);
    key.target.position.set(0, 1, 0);
    key.castShadow = quality >= 1;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0004;
    const rimA = new THREE.SpotLight(0xff6a4a, 40, 12, Math.PI / 6, 0.6, 1.5);
    rimA.position.set(-3.5, 3.2, -3);
    rimA.target.position.set(0, 1.3, 0);
    const rimB = new THREE.SpotLight(0x6aa6ff, 26, 12, Math.PI / 6, 0.6, 1.5);
    rimB.position.set(3.5, 3, -3.2);
    rimB.target.position.set(0, 1.3, 0);
    const hemi = new THREE.HemisphereLight(0x33405e, 0x060607, 0.6);
    group.add(key, key.target, rimA, rimA.target, rimB, rimB.target, hemi);
    const el = gl.domElement;
    const down = (e: PointerEvent) => {
      drag.current.down = true;
      drag.current.x = e.clientX;
      el.setPointerCapture?.(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drag.current.down) return;
      const dx = e.clientX - drag.current.x;
      drag.current.x = e.clientX;
      drag.current.yaw += dx * 0.01;
      drag.current.vel = dx * 0.01;
    };
    const up = () => (drag.current.down = false);
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      scene.remove(group);
      for (const s of slots.current) s?.body.dispose();
      slots.current = [null, null];
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
    };
  }, [scene, group, gl, quality]);
  // build or swap the bodies when a fighter changes
  useEffect(() => {
    const t = setTimeout(() => {
      fighters.forEach((d, i) => {
        const cur = slots.current[i];
        if (!d) {
          if (cur) {
            group.remove(cur.body.root);
            cur.body.dispose();
            slots.current[i] = null;
          }
          return;
        }
        const key = lookKey(d) + d.stance + d.guard;
        if (cur && cur.key === key) return;
        if (cur) {
          group.remove(cur.body.root);
          cur.body.dispose();
        }
        const body = makeBoxer(d, Math.min(quality, 2));
        const anim = new BoxerAnimator(body, d);
        group.add(body.root);
        slots.current[i] = { key, body, anim, f: stubFighter(d) };
      });
    }, 60);
    return () => clearTimeout(t);
  }, [fighters, group, quality]);
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const cam = camera as THREE.PerspectiveCamera;
    if (!drag.current.down) {
      drag.current.vel *= 0.92;
      drag.current.yaw += drag.current.vel;
    }
    const s = slots.current;
    if (mode === "faceoff") {
      const pos: [number, number][] = [[-0.62, 0], [0.62, 0]];
      s.forEach((sl, i) => {
        if (!sl) return;
        const o = s[1 - i];
        const [x, z] = pos[i];
        const ox = pos[1 - i][0];
        const head = new THREE.Vector3(ox, (o ? o.body.h : 1.8) * 0.93, 0);
        const body = head.clone();
        body.y -= 0.5;
        sl.anim.update(sl.f, { x, z, yaw: Math.atan2(ox - x, 0), head, body, time: t + i * 2.1, mode: "fight", downT: 0, riseT: 0, speed: 0, alpha: 0 }, dt);
      });
      const sway = Math.sin(t * 0.25) * 0.35 + drag.current.yaw;
      cam.position.set(Math.sin(sway) * 4.9, 1.5, Math.cos(sway) * 4.9);
      cam.lookAt(0, 1.18, 0);
    } else {
      const sl = s[0];
      if (sl) {
        const yaw = drag.current.yaw;
        const head = new THREE.Vector3(Math.sin(yaw) * 2, sl.body.h * 0.93, Math.cos(yaw) * 2);
        const body = head.clone();
        body.y -= 0.5;
        sl.anim.update(sl.f, { x: 0, z: 0, yaw, head, body, time: t, mode: "idle", downT: 0, riseT: 0, speed: 0, alpha: 0 }, dt);
      }
      cam.position.set(0.55, 1.25, 4.1);
      cam.lookAt(0, 0.98, 0);
    }
  });
  return null;
}

export default function Preview3D({ fighters, mode, quality, label }: { fighters: (FighterDef | null)[]; mode: "faceoff" | "solo"; quality: number; label: string }) {
  return (
    <div className="pf-stage" role="img" aria-label={label}>
      <Canvas
        dpr={[1, quality >= 2 ? 1.5 : 1]}
        shadows={quality >= 1 ? { type: THREE.PCFShadowMap } : false}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ fov: 34, near: 0.1, far: 40, position: [0, 1.5, 3.2] }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.1;
        }}
      >
        <Stage fighters={fighters} mode={mode} quality={quality} />
      </Canvas>
    </div>
  );
}
