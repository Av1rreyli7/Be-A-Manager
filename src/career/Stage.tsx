"use client";
/**
 * The footballer on a lit stage: the creator, the hub portrait and the signing moment all use it.
 * Image based light from a generated studio room (real reflections without any image files), a soft
 * shadowed key light, two coloured rim lights, additive light cones that read as volumetric beams, dust in the
 * light and a dark reflective platform. Quality steps: pixel ratio, shadow size, dust and sheen. A frame
 * guard steps down by itself if the laptop cannot hold the frame rate.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { makeBody, type Outfit } from "./body";
import type { Look, Person } from "./types";

export type View = "full" | "face" | "body" | "boots" | "hero";
const CAMS: Record<View, { pos: [number, number, number]; look: [number, number, number]; fov: number }> = {
  full: { pos: [0, 1.15, 4.2], look: [0, 0.98, 0], fov: 32 },
  body: { pos: [0.4, 1.25, 3.0], look: [0, 1.05, 0], fov: 30 },
  face: { pos: [0.08, 1.7, 0.95], look: [0, 1.66, 0], fov: 26 },
  boots: { pos: [0.6, 0.45, 1.6], look: [0, 0.18, 0], fov: 30 },
  hero: { pos: [-1.1, 0.75, 3.2], look: [0, 1.1, 0], fov: 34 },
};
export const DPR_CAP = [1, 1.25, 1.6, 2];

export function Environment({ intensity }: { intensity: number }) {
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);
  useEffect(() => {
    const scene = get().scene;
    const pm = new THREE.PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = intensity;
    return () => {
      scene.environment = null;
      env.dispose();
      pm.dispose();
    };
  }, [gl, get, intensity]);
  return null;
}

/** a cone of light: additive, brightest at the lamp, fading to nothing at the floor and at its edges */
function Beam({
  position,
  rotation,
  color,
  length = 5,
  radius = 1.6,
  strength = 0.22,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  color: string;
  length?: number;
  radius?: number;
  strength?: number;
}) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: {
          uColor: { value: new THREE.Color(color) },
          uStrength: { value: strength },
        },
        vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV;
          void main(){ vY = uv.y; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform vec3 uColor; uniform float uStrength; varying float vY; varying vec3 vN; varying vec3 vV;
          void main(){ float edge = pow(abs(dot(vN, vV)), 1.6); float a = edge * pow(vY, 1.4) * uStrength; gl_FragColor = vec4(uColor * a, a); }`,
      }),
    [color, strength],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh position={position} rotation={rotation} material={mat} renderOrder={5}>
      <coneGeometry args={[radius, length, 40, 1, true]} />
    </mesh>
  );
}

function Dust({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    // a fixed seed: the same dust every time, and no randomness during render
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < count; i++) {
      p[i * 3] = (rnd() - 0.5) * 4;
      p[i * 3 + 1] = rnd() * 3.2;
      p[i * 3 + 2] = (rnd() - 0.5) * 3;
    }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, [count]);
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 0.02;
    ref.current.position.y = Math.sin(performance.now() / 4000) * 0.05;
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial size={0.012} color="#fff6d8" transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
    </points>
  );
}

/** a soft pool of light on the floor that fades into the dark, so there is never a hard horizon */
function FloorGlow() {
  const tex = useMemo(() => {
    if (typeof document === "undefined") return null;
    const cv = document.createElement("canvas");
    cv.width = cv.height = 256;
    const g = cv.getContext("2d");
    if (!g) return null;
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, "rgba(120,130,110,0.55)");
    gr.addColorStop(0.35, "rgba(60,66,56,0.32)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => tex?.dispose(), [tex]);
  if (!tex) return null;
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.003}>
      <planeGeometry args={[9, 9]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  );
}

function Platform({ accent }: { accent: string }) {
  return (
    <group>
      <FloorGlow />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[1.25, 96]} />
        <meshPhysicalMaterial color="#030403" roughness={0.42} metalness={0.25} clearcoat={0.45} clearcoatRoughness={0.3} envMapIntensity={0.28} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.002}>
        <ringGeometry args={[1.2, 1.235, 128]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Player({
  look,
  person,
  outfit,
  quality,
  spin,
}: {
  look: Partial<Look>;
  person: Pick<Person, "height" | "weight" | "pos">;
  outfit: Outfit;
  quality: number;
  spin: React.MutableRefObject<number>;
}) {
  const key = JSON.stringify([look, person.height, person.weight, person.pos, outfit, quality >= 2]);
  const rig = useMemo(
    () => makeBody(look, person, outfit, quality),
    // the body is rebuilt only when what it looks like changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  useEffect(() => () => rig.dispose(), [rig]);
  useFrame((_, dt) => rig.tick(dt, spin.current));
  return <primitive object={rig.root} />;
}

function CameraRig({ view }: { view: View }) {
  const target = useRef(new THREE.Vector3(...CAMS[view].look));
  useFrame(({ camera }, dt) => {
    const c = CAMS[view];
    const k = Math.min(1, dt * 3.2);
    camera.position.lerp(new THREE.Vector3(...c.pos), k);
    target.current.lerp(new THREE.Vector3(...c.look), k);
    camera.lookAt(target.current);
    const cam = camera as THREE.PerspectiveCamera;
    if (Math.abs(cam.fov - c.fov) > 0.05) {
      cam.fov += (c.fov - cam.fov) * k;
      cam.updateProjectionMatrix();
    }
  });
  return null;
}

/** turns him slowly on the spot, unless the person is dragging */
function AutoSpin({ onTick }: { onTick: (dt: number) => void }) {
  useFrame((_, dt) => onTick(Math.min(dt, 0.05)));
  return null;
}

/** a gold cup, turned from a profile, floating beside him with a slow bob */
function Trophy() {
  const ref = useRef<THREE.Group>(null);
  const geo = useMemo(() => {
    const pts = [
      [0.0, 0],
      [0.09, 0],
      [0.09, 0.03],
      [0.05, 0.05],
      [0.03, 0.12],
      [0.028, 0.2],
      [0.07, 0.24],
      [0.12, 0.32],
      [0.14, 0.42],
      [0.13, 0.46],
      [0.12, 0.44],
      [0.0, 0.3],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 48);
  }, []);
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e8c46a", metalness: 1, roughness: 0.22 }), []);
  useEffect(
    () => () => {
      geo.dispose();
      gold.dispose();
    },
    [geo, gold],
  );
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    g.position.y = 1.05 + Math.sin(clock.elapsedTime * 1.4) * 0.03;
    g.rotation.y = clock.elapsedTime * 0.6;
  });
  return (
    <group ref={ref} position={[0.62, 1.05, 0.25]} scale={1.3}>
      <mesh geometry={geo} material={gold} castShadow />
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[sd * 0.15, 0.36, 0]} rotation={[0, 0, sd * 0.2]} material={gold}>
          <torusGeometry args={[0.05, 0.012, 10, 24, Math.PI]} />
        </mesh>
      ))}
    </group>
  );
}

/** watches real frame times and asks for a lower quality when the frame rate cannot be held */
export function FrameGuard({ quality, onSlow }: { quality: number; onSlow?: (q: number) => void }) {
  const acc = useRef({ t: 0, n: 0, slow: 0 });
  useFrame((_, dt) => {
    const a = acc.current;
    a.t += dt;
    a.n++;
    if (a.t > 2) {
      const ms = (a.t / a.n) * 1000;
      a.slow = ms > 21 ? a.slow + 1 : 0;
      if (a.slow >= 2 && quality > 0 && onSlow) {
        onSlow(quality - 1);
        a.slow = 0;
      }
      a.t = 0;
      a.n = 0;
    }
  });
  return null;
}

export default function Stage({
  look,
  person,
  outfit,
  view = "full",
  quality = 2,
  accent = "#d0e85c",
  onSlow,
  className,
  autoSpin = 0,
  prop = null,
}: {
  look: Partial<Look>;
  person: Pick<Person, "height" | "weight" | "pos">;
  outfit: Outfit;
  view?: View;
  quality?: number;
  accent?: string;
  onSlow?: (q: number) => void;
  className?: string;
  /** radians a second the body turns on its own (the big day scenes) */
  autoSpin?: number;
  /** something that shares the stage with him */
  prop?: "trophy" | null;
}) {
  const spin = useRef(0.35);
  const drag = useRef<{ x: number; a: number } | null>(null);
  const shadow = [0, 1024, 2048, 2048][quality];
  const autoTurn = useCallback(
    (dt: number) => {
      if (!drag.current) spin.current += autoSpin * dt;
    },
    [autoSpin],
  );
  return (
    <div
      className={className}
      style={{ touchAction: "none", cursor: "grab" }}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, a: spin.current };
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (drag.current) spin.current = drag.current.a + (e.clientX - drag.current.x) * 0.012;
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      <Canvas
        dpr={[1, DPR_CAP[quality]]}
        shadows={quality > 0 ? { type: THREE.PCFShadowMap } : false}
        gl={{ antialias: quality >= 1, powerPreference: "high-performance" }}
        camera={{
          position: CAMS[view].pos,
          fov: CAMS[view].fov,
          near: 0.05,
          far: 60,
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;
        }}
      >
        <color attach="background" args={["#030405"]} />
        <fog attach="fog" args={["#030405", 6, 16]} />
        <Environment intensity={0.42} />
        <hemisphereLight args={["#9fb4d8", "#0b0d0b", 0.18]} />
        {/* the warm light bouncing up off the floor: no face is ever black under the chin */}
        <directionalLight position={[0, -1, 1.2]} intensity={0.32} color="#ffd9b8" />
        <directionalLight
          position={[2.2, 4.5, 3]}
          intensity={1.9}
          color="#fff3e2"
          castShadow={quality > 0}
          shadow-mapSize={[shadow, shadow]}
          shadow-camera-left={-2}
          shadow-camera-right={2}
          shadow-camera-top={2.5}
          shadow-camera-bottom={-0.5}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
          shadow-radius={3}
        />
        <spotLight position={[-2.6, 3.2, -2.2]} angle={0.5} penumbra={0.8} intensity={9} color={accent} distance={9} decay={1.6} />
        <spotLight position={[2.8, 2.6, -2.4]} angle={0.5} penumbra={0.9} intensity={7} color="#7fb6ff" distance={9} decay={1.6} />
        <spotLight position={[0, 4.5, 1.6]} angle={0.42} penumbra={1} intensity={3.5} color="#ffffff" distance={8} decay={1.6} />
        <Beam position={[-1.6, 2.2, -1.6]} rotation={[0.28, 0, 0.42]} color={accent} strength={quality >= 2 ? 0.2 : 0.14} />
        <Beam position={[1.7, 2.2, -1.7]} rotation={[0.28, 0, -0.42]} color="#7fb6ff" strength={quality >= 2 ? 0.16 : 0.11} />
        {quality >= 1 && <Dust count={[0, 120, 260, 420][quality]} />}
        <Platform accent={accent} />
        <Player look={look} person={person} outfit={outfit} quality={quality} spin={spin} />
        <CameraRig view={view} />
        {autoSpin !== 0 && <AutoSpin onTick={autoTurn} />}
        {prop === "trophy" && <Trophy />}
        <FrameGuard quality={quality} onSlow={onSlow} />
      </Canvas>
    </div>
  );
}
