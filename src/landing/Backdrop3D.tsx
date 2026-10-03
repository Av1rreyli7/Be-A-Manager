"use client";
/* eslint-disable react-hooks/immutability -- three.js objects (uniforms, positions, refs handed to the frame loop) are changed every frame by design */
/**
 * The one real 3D background of the landing page, built with three.js and React Three Fiber.
 * Two low poly sets stand in the dark: a football stadium under floodlights (Floodlights)
 * and a basketball arena (Game Night). The camera orbits the featured one slowly, drifts
 * with the pointer, and glides through the fog to the other when the featured game switches.
 * Everything is procedural: no model files, no shadow maps, a few thousand triangles.
 */
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { GameId } from "./games";

/** distance between the two sets, far enough for the fog to hide one from the other */
const GAP = 760;

/** a value read every frame (pointer drift), kept outside React state so moving the mouse renders nothing */
export interface Drift {
  get(): number;
}

interface Props {
  featured: GameId;
  sx: Drift;
  sy: Drift;
  warmed: GameId[];
  /** reduced motion: hold the camera still */
  still: boolean;
  onReady: () => void;
  onSlow: () => void;
  /** stop drawing (tab hidden, or the intro is busy in front): no frames, no GPU work */
  paused?: boolean;
}

/* ---------- small helpers ---------- */

function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const c = cv.getContext("2d");
  if (c) draw(c, w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** points on the stands that twinkle like phone lights, one small shader instead of many lights */
function useTwinkle(count: number, place: (i: number, rnd: () => number) => [number, number, number], color: string) {
  return useMemo(() => {
    let s = 9973 + count;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    const pos = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const p = place(i, rnd);
      pos[i * 3] = p[0];
      pos[i * 3 + 1] = p[1];
      pos[i * 3 + 2] = p[2];
      phase[i] = rnd() * 6.283;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uSize: { value: 620 } },
      vertexShader: `
        attribute float aPhase;
        uniform float uTime;
        uniform float uSize;
        varying float vA;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float w = sin(uTime * (0.6 + fract(aPhase * 3.1) * 1.4) + aPhase) * 0.5 + 0.5;
          vA = 0.12 + 0.88 * pow(w, 5.0);
          gl_PointSize = uSize / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d) * vA;
          gl_FragColor = vec4(uColor, a);
        }`,
    });
    return { geo, mat };
    // the layout never changes after the first build
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** four sloped stand blocks around a rectangle, shared by both sets */
function Stands({ halfL, halfW, depth, rise, color, rim }: { halfL: number; halfW: number; depth: number; rise: number; color: string; rim: string }) {
  const tilt = Math.atan2(rise, depth);
  const len = Math.hypot(depth, rise);
  // seat rows, drawn once and shared by all four blocks
  const rows = useMemo(() => {
    const tex = canvasTexture(64, 64, (c, w, h) => {
      c.fillStyle = color;
      c.fillRect(0, 0, w, h);
      c.fillStyle = "rgba(255,255,255,.07)";
      for (let y = 0; y < h; y += 8) c.fillRect(0, y, w, 2);
      c.fillStyle = "rgba(0,0,0,.25)";
      for (let x = 0; x < w; x += 32) c.fillRect(x, 0, 2, h);
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 3);
    return tex;
  }, [color]);
  return (
    <group>
      {/* a thin lit rim along the top edge of the bowl */}
      {[-1, 1].map((s) => (
        <mesh key={"rz" + s} position={[0, rise + 0.9, s * (halfW + depth)]}>
          <boxGeometry args={[halfL * 2 + depth * 2, 0.5, 0.5]} />
          <meshBasicMaterial color={rim} toneMapped={false} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={"rx" + s} position={[s * (halfL + depth), rise + 0.9, 0]}>
          <boxGeometry args={[0.5, 0.5, halfW * 2 + depth * 2]} />
          <meshBasicMaterial color={rim} toneMapped={false} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={"z" + s} position={[0, rise / 2, s * (halfW + depth / 2)]} rotation={[-s * tilt, 0, 0]}>
          <boxGeometry args={[halfL * 2 + depth * 2, 1.2, len]} />
          <meshLambertMaterial map={rows} flatShading />
        </mesh>
      ))}
      {/* the two end stands are the same block turned a quarter turn */}
      <group rotation={[0, Math.PI / 2, 0]}>
        {[-1, 1].map((s) => (
          <mesh key={"x" + s} position={[0, rise / 2, s * (halfL + depth / 2)]} rotation={[-s * tilt, 0, 0]}>
            <boxGeometry args={[halfW * 2, 1.2, len]} />
            <meshLambertMaterial map={rows} flatShading />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/* ---------- set one: the stadium ---------- */

function Stadium({ time, mix }: { time: React.RefObject<number>; mix: React.RefObject<number> }) {
  const root = useRef<THREE.Group>(null);
  const pitch = useMemo(
    () =>
      canvasTexture(1024, 664, (c, w, h) => {
        const bands = 14;
        for (let i = 0; i < bands; i++) {
          c.fillStyle = i % 2 ? "#2f8f49" : "#297f41";
          c.fillRect((i * w) / bands, 0, w / bands + 1, h);
        }
        const X = (m: number) => ((m + 52.5) / 105) * w;
        const Y = (m: number) => ((m + 34) / 68) * h;
        const k = w / 105;
        c.strokeStyle = "rgba(255,255,255,.9)";
        c.lineWidth = 2.4;
        c.strokeRect(X(-52.5) + 2, Y(-34) + 2, w - 4, h - 4);
        c.beginPath();
        c.moveTo(X(0), Y(-34));
        c.lineTo(X(0), Y(34));
        c.moveTo(X(0) + 9.15 * k, Y(0));
        c.arc(X(0), Y(0), 9.15 * k, 0, Math.PI * 2);
        c.stroke();
        for (const s of [-1, 1]) {
          const gx = s * 52.5;
          c.strokeRect(s > 0 ? X(gx - 16.5) : X(gx), Y(-20.16), 16.5 * k, 40.32 * k);
          c.strokeRect(s > 0 ? X(gx - 5.5) : X(gx), Y(-9.16), 5.5 * k, 18.32 * k);
        }
      }),
    [],
  );
  const blob = useMemo(
    () =>
      canvasTexture(128, 128, (c) => {
        const g = c.createRadialGradient(64, 64, 4, 64, 64, 62);
        g.addColorStop(0, "rgba(0,0,0,.55)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = g;
        c.fillRect(0, 0, 128, 128);
      }),
    [],
  );
  // a low poly football: white, with dark patches around the twelve corners of the icosahedron
  const ballGeo = useMemo(() => {
    const g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, 2);
    const base = new THREE.IcosahedronGeometry(1, 0).getAttribute("position");
    const corners: THREE.Vector3[] = [];
    for (let i = 0; i < base.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(base, i).normalize();
      if (!corners.some((c) => c.distanceTo(v) < 0.01)) corners.push(v);
    }
    const pos = g.getAttribute("position");
    const col = new Float32Array(pos.count * 3);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), mid = new THREE.Vector3();
    for (let f = 0; f < pos.count; f += 3) {
      a.fromBufferAttribute(pos, f);
      b.fromBufferAttribute(pos, f + 1);
      c.fromBufferAttribute(pos, f + 2);
      mid.copy(a).add(b).add(c).normalize();
      const dark = corners.some((k) => k.dot(mid) > 0.93);
      const v = dark ? 0.06 : 0.94;
      for (let j = 0; j < 3; j++) col.set([v, v, v * (dark ? 1 : 0.98)], (f + j) * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  const crowd = useTwinkle(
    520,
    (i, rnd) => {
      const side = i % 4;
      const up = rnd();
      const along = rnd() * 2 - 1;
      if (side < 2) return [along * 68, 2 + up * 17, (side ? 1 : -1) * (42 + up * 24)];
      return [(side === 2 ? 1 : -1) * (61 + up * 24), 2 + up * 17, along * 36];
    },
    "#eaf2ff",
  );
  const ball = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const t = time.current;
    // out of sight once the camera has settled on the arena
    if (root.current) root.current.visible = mix.current < 0.985;
    crowd.mat.uniforms.uTime.value = t;
    if (ball.current) {
      ball.current.position.y = 24 + Math.sin(t * 0.8) * 2.2;
      ball.current.rotation.y = t * 0.35;
      ball.current.rotation.x = t * 0.21;
    }
    if (shadow.current) {
      const k = 1 - Math.sin(t * 0.8) * 0.08;
      shadow.current.scale.set(k, k, 1);
    }
  });

  const towers: Array<[number, number]> = [
    [-74, -52],
    [74, -52],
    [-74, 52],
    [74, 52],
  ];
  return (
    <group ref={root}>
      {/* ground, apron and pitch */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
        <planeGeometry args={[520, 520]} />
        <meshLambertMaterial color="#060807" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[122, 84]} />
        <meshLambertMaterial color="#17512b" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[105, 68]} />
        <meshLambertMaterial map={pitch} />
      </mesh>

      <Stands halfL={61} halfW={42} depth={24} rise={18} color="#232d3b" rim="#8f9f3f" />
      <points geometry={crowd.geo} material={crowd.mat} />

      {/* goals: white frames with a light wire net */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 52.5, 0, 0]}>
          {[-3.66, 3.66].map((z) => (
            <mesh key={z} position={[0, 1.22, z]}>
              <boxGeometry args={[0.24, 2.44, 0.24]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          ))}
          <mesh position={[0, 2.44, 0]}>
            <boxGeometry args={[0.24, 0.24, 7.56]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[s * 1.2, 1.22, 0]} rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[7.32, 2.44, 2.4, 8, 3, 3]} />
            <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.22} />
          </mesh>
        </group>
      ))}

      {/* four floodlight towers, each with a lamp bank and a soft beam */}
      {towers.map(([x, z], i) => {
        const yaw = Math.atan2(-x, -z);
        return (
          <group key={i} position={[x, 0, z]} rotation={[0, yaw, 0]}>
            <mesh position={[0, 19, 0]}>
              <cylinderGeometry args={[0.3, 0.6, 38, 6]} />
              <meshLambertMaterial color="#3a4450" flatShading />
            </mesh>
            <group position={[0, 39.5, 0]} rotation={[0.5, 0, 0]}>
              <mesh>
                <boxGeometry args={[8.6, 5, 0.5]} />
                <meshLambertMaterial color="#3a4450" flatShading />
              </mesh>
              {[-1, 0, 1].map((c) =>
                [-1, 1].map((r) => (
                  <mesh key={c + ":" + r} position={[c * 2.6, r * 1.15, 0.32]}>
                    <circleGeometry args={[0.85, 10]} />
                    <meshBasicMaterial color="#fffbe6" toneMapped={false} />
                  </mesh>
                )),
              )}
              {/* the beam: an open cone of additive light, no real light needed */}
              <mesh position={[0, 0, 36]} rotation={[-Math.PI / 2, 0, 0]}>
                <coneGeometry args={[17, 72, 20, 1, true]} />
                <meshBasicMaterial color="#dfe9ff" transparent opacity={0.016} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
              </mesh>
            </group>
          </group>
        );
      })}

      {/* the floating ball over the centre spot, with a soft blob shadow */}
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <planeGeometry args={[26, 26]} />
        <meshBasicMaterial map={blob} transparent depthWrite={false} />
      </mesh>
      <group ref={ball} position={[0, 24, 0]} scale={8}>
        <mesh geometry={ballGeo}>
          <meshStandardMaterial vertexColors flatShading roughness={0.55} metalness={0.05} />
        </mesh>
      </group>

      <pointLight position={[0, 80, 20]} color="#e6efff" intensity={2.4} distance={260} decay={0} />
      <pointLight position={[30, 22, 60]} color="#d0e85c" intensity={0.5} distance={160} decay={0} />
    </group>
  );
}

/* ---------- set two: the arena ---------- */

function Arena({ time, mix }: { time: React.RefObject<number>; mix: React.RefObject<number> }) {
  const root = useRef<THREE.Group>(null);
  const court = useMemo(
    () =>
      canvasTexture(1024, 545, (c, w, h) => {
        // wood planks
        for (let y = 0; y < h; y += 9) {
          let x = -((y * 37) % 160);
          while (x < w) {
            // Math.abs matters: x starts negative, and a negative length would loop forever
            const len = 110 + (Math.abs(x * 13 + y * 7) % 150);
            const l = 50 + (Math.abs(x + y * 3) % 11);
            c.fillStyle = `hsl(${29 + (Math.abs(x + y) % 6)},48%,${l}%)`;
            c.fillRect(x, y, len, 9);
            c.fillStyle = "rgba(40,20,5,.3)";
            c.fillRect(x + len - 1, y, 1.5, 9);
            x += len;
          }
        }
        const X = (ft: number) => ((ft + 47) / 94) * w;
        const Y = (ft: number) => ((ft + 25) / 50) * h;
        const k = w / 94;
        c.fillStyle = "rgba(214,54,59,.9)";
        for (const s of [-1, 1]) c.fillRect(s > 0 ? X(28) : X(-47), Y(-8), 19 * k, 16 * k);
        c.beginPath();
        c.arc(X(0), Y(0), 6 * k, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = "rgba(255,255,255,.92)";
        c.lineWidth = 3;
        c.strokeRect(2, 2, w - 4, h - 4);
        c.beginPath();
        c.moveTo(X(0), 0);
        c.lineTo(X(0), h);
        c.moveTo(X(0) + 6 * k, Y(0));
        c.arc(X(0), Y(0), 6 * k, 0, Math.PI * 2);
        c.stroke();
        for (const s of [-1, 1]) {
          c.strokeRect(s > 0 ? X(28) : X(-47), Y(-8), 19 * k, 16 * k);
          c.beginPath();
          c.arc(X(s * 41.75), Y(0), 23.75 * k, s > 0 ? Math.PI * 0.63 : -Math.PI * 0.37, s > 0 ? Math.PI * 1.37 : Math.PI * 0.37);
          c.stroke();
        }
      }),
    [],
  );
  const ballTex = useMemo(
    () =>
      canvasTexture(512, 256, (c, w, h) => {
        c.fillStyle = "#d9661c";
        c.fillRect(0, 0, w, h);
        c.strokeStyle = "#1c0f08";
        c.lineWidth = 5;
        c.beginPath();
        c.moveTo(0, h / 2);
        c.lineTo(w, h / 2);
        for (const x of [0, w / 2, w]) {
          c.moveTo(x, 0);
          c.lineTo(x, h);
        }
        for (const x of [w / 4, (3 * w) / 4]) {
          c.moveTo(x - 46, 0);
          c.bezierCurveTo(x + 30, h * 0.3, x + 30, h * 0.7, x - 46, h);
          c.moveTo(x + 46, 0);
          c.bezierCurveTo(x - 30, h * 0.3, x - 30, h * 0.7, x + 46, h);
        }
        c.stroke();
      }),
    [],
  );
  const board = useMemo(
    () =>
      canvasTexture(256, 128, (c, w, h) => {
        c.fillStyle = "#0b0e14";
        c.fillRect(0, 0, w, h);
        c.fillStyle = "#d6363b";
        c.fillRect(14, 16, 64, 96);
        c.fillStyle = "#e9b949";
        c.fillRect(178, 16, 64, 96);
        c.fillStyle = "#f4f6fa";
        c.fillRect(96, 34, 64, 12);
        c.fillRect(96, 58, 64, 36);
      }),
    [],
  );
  const blob = useMemo(
    () =>
      canvasTexture(128, 128, (c) => {
        const g = c.createRadialGradient(64, 64, 4, 64, 64, 62);
        g.addColorStop(0, "rgba(20,8,0,.6)");
        g.addColorStop(1, "rgba(20,8,0,0)");
        c.fillStyle = g;
        c.fillRect(0, 0, 128, 128);
      }),
    [],
  );
  const crowd = useTwinkle(
    440,
    (i, rnd) => {
      const side = i % 4;
      const up = rnd();
      const along = rnd() * 2 - 1;
      if (side < 2) return [along * 62, 2 + up * 21, (side ? 1 : -1) * (34 + up * 24)];
      return [(side === 2 ? 1 : -1) * (57 + up * 24), 2 + up * 21, along * 30];
    },
    "#ffe2be",
  );
  const ball = useRef<THREE.Mesh>(null);
  const shadow = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const t = time.current;
    if (root.current) root.current.visible = mix.current > 0.015;
    crowd.mat.uniforms.uTime.value = t;
    if (ball.current) {
      ball.current.position.y = 22 + Math.sin(t * 0.8 + 1) * 2;
      ball.current.rotation.y = t * 0.4;
      ball.current.rotation.z = t * 0.17;
    }
    if (shadow.current) {
      const k = 1 - Math.sin(t * 0.8 + 1) * 0.08;
      shadow.current.scale.set(k, k, 1);
    }
  });

  return (
    <group ref={root} position={[GAP, 0, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
        <planeGeometry args={[460, 460]} />
        <meshLambertMaterial color="#080706" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[112, 66]} />
        <meshLambertMaterial color="#1a1310" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[94, 50]} />
        <meshStandardMaterial map={court} roughness={0.42} metalness={0.05} />
      </mesh>

      <Stands halfL={56} halfW={33} depth={24} rise={22} color="#2c2625" rim="#a8743a" />
      <points geometry={crowd.geo} material={crowd.mat} />

      {/* two hoops */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 47, 0, 0]}>
          <mesh position={[s * 4, 5, 0]} rotation={[0, 0, s * 0.22]}>
            <boxGeometry args={[1, 11, 1.4]} />
            <meshLambertMaterial color="#20232b" flatShading />
          </mesh>
          <mesh position={[-s * 3.4, 12.4, 0]} rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[7.2, 4.4, 0.25]} />
            <meshStandardMaterial color="#e8f0f8" transparent opacity={0.55} roughness={0.2} />
          </mesh>
          <mesh position={[-s * 4.6, 11, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.05, 0.11, 6, 18]} />
            <meshBasicMaterial color="#ff6a1f" />
          </mesh>
          <mesh position={[-s * 4.6, 9.9, 0]}>
            <cylinderGeometry args={[1.05, 0.7, 2.2, 10, 3, true]} />
            <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.28} />
          </mesh>
        </group>
      ))}

      {/* the scoreboard hanging over centre court */}
      <group position={[0, 42, 0]}>
        <mesh>
          <boxGeometry args={[16, 7.6, 16]} />
          <meshBasicMaterial map={board} />
        </mesh>
        <mesh position={[0, -4.4, 0]}>
          <boxGeometry args={[17.4, 0.7, 17.4]} />
          <meshBasicMaterial color="#f2a94a" />
        </mesh>
        {[-6, 6].map((x) => (
          <mesh key={x} position={[x, 13, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 19, 4]} />
            <meshBasicMaterial color="#39404c" />
          </mesh>
        ))}
        <mesh position={[0, -23, 0]}>
          <coneGeometry args={[30, 38, 20, 1, true]} />
          <meshBasicMaterial color="#ffd9a8" transparent opacity={0.03} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>

      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <planeGeometry args={[24, 24]} />
        <meshBasicMaterial map={blob} transparent depthWrite={false} />
      </mesh>
      <mesh ref={ball} position={[0, 22, 0]}>
        <sphereGeometry args={[7.4, 20, 14]} />
        <meshStandardMaterial map={ballTex} roughness={0.7} flatShading />
      </mesh>

      <pointLight position={[0, 80, 16]} color="#ffdcb0" intensity={2.6} distance={250} decay={0} />
      <pointLight position={[-30, 20, 50]} color="#d6363b" intensity={0.45} distance={150} decay={0} />
    </group>
  );
}

/* ---------- the camera rig: orbit, pointer drift, the glide between sets, and the frame rate watch ---------- */

function Rig({ featured, sx, sy, still, time, mix, onReady, onSlow }: Omit<Props, "warmed" | "paused"> & { time: React.RefObject<number>; mix: React.RefObject<number> }) {
  const { camera, setDpr } = useThree();
  const angle = useRef(0.62);
  const perf = useRef({ ready: false, t: 0, frames: 0, lowered: false, warm: 0 });
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    time.current += dt;
    if (!still) angle.current += dt * 0.045;
    const want = featured === "frontoffice" ? 1 : 0;
    // ease toward the featured set; with reduced motion the camera simply cuts
    mix.current = still ? want : THREE.MathUtils.damp(mix.current, want, 1.9, dt);
    const m = mix.current;
    const e = m * m * (3 - 2 * m);
    const a = angle.current;
    const radius = THREE.MathUtils.lerp(255, 232, e);
    const height = THREE.MathUtils.lerp(112, 104, e) + Math.sin(Math.PI * m) * 40;
    const cx = e * GAP;
    const px = sx.get();
    const py = sy.get();
    // right vector of the orbit, used for the pointer drift and to sit the subject right of centre
    const rx = Math.cos(a), rz = -Math.sin(a);
    camera.position.set(cx + Math.sin(a) * radius + rx * px * 12, height - py * 7, Math.cos(a) * radius + rz * px * 12);
    // looking a little left of and above the set drops it into the lower right of the frame
    target.set(cx - rx * 34, 50, -rz * 34);
    camera.lookAt(target);

    // frame rate watch: lower the resolution once, and if that is not enough hand back to the still backdrop
    const p = perf.current;
    if (!p.ready) {
      p.ready = true;
      onReady();
    }
    // a long gap is a pause (hidden tab, paused loop), not a slow frame: start the count again
    if (rawDt > 0.25) {
      p.warm = 0;
      p.t = 0;
      p.frames = 0;
      return;
    }
    p.warm += rawDt;
    if (p.warm > 1.2) {
      p.t += rawDt;
      p.frames++;
      if (p.t >= 2.5) {
        const fps = p.frames / p.t;
        p.t = 0;
        p.frames = 0;
        if (fps < 28) {
          if (!p.lowered) {
            p.lowered = true;
            setDpr(1);
          } else if (fps < 20) onSlow();
        }
      }
    }
  });
  return null;
}

/** compiles every material up front (both sets), so the first glide to the arena never stalls on a shader build */
function Precompile({ arena }: { arena: boolean }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    const id = requestAnimationFrame(() => gl.compile(scene, camera));
    return () => cancelAnimationFrame(id);
  }, [gl, scene, camera, arena]);
  return null;
}

export default function Backdrop3D(props: Props) {
  const time = useRef(0);
  const mix = useRef(props.featured === "frontoffice" ? 1 : 0);
  const wrap = useRef<HTMLDivElement>(null);
  // the canvas is decoration only
  useEffect(() => {
    const c = wrap.current?.querySelector("canvas");
    if (c) c.setAttribute("aria-hidden", "true");
  });
  const showArena = props.warmed.includes("frontoffice") || props.featured === "frontoffice";
  return (
    <div ref={wrap} style={{ position: "absolute", inset: 0 }}>
      <Canvas
        dpr={[1, 1.5]}
        frameloop={props.paused ? "never" : "always"}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ fov: 36, near: 1, far: 2400, position: [150, 112, 200] }}
        style={{ pointerEvents: "none" }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
      >
        <fog attach="fog" args={["#000000", 300, 720]} />
        <hemisphereLight args={["#aebbd6", "#0a0c08", 0.5]} />
        <directionalLight position={[40, 90, 60]} intensity={0.55} color="#ffffff" />
        <Rig featured={props.featured} sx={props.sx} sy={props.sy} still={props.still} onReady={props.onReady} onSlow={props.onSlow} time={time} mix={mix} />
        <Stadium time={time} mix={mix} />
        {showArena && <Arena time={time} mix={mix} />}
        <Precompile arena={showArena} />
      </Canvas>
    </div>
  );
}
