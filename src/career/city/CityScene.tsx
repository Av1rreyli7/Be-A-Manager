"use client";
/* eslint-disable react-hooks/immutability -- three.js objects built in useMemo are moved every frame in useFrame, which is how React Three Fiber works */
/**
 * The city hub: his city from above at dusk. Streets, lit windows, traffic, the weather of the week, and the
 * places he can go: his home (it changes with the home he has), the training ground, the stadium, the shops,
 * a restaurant, the gym and the mall. Built from shapes and shaders only; every repeated thing is instanced,
 * so the whole city is a handful of draw calls.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Life, WeatherKind } from "../types";
import { rbox, cyl, sphere, plane, mat, glass, glow, windowsMaterial, signTexture, cachedTexture, seeded, makeCar, lightCone, cone } from "./kit3d";

export type PlaceId = "home" | "training" | "stadium" | "shops" | "restaurant" | "gym" | "mall";
export const PLACE_IDS: PlaceId[] = ["home", "training", "stadium", "shops", "restaurant", "gym", "mall"];
export const SPOTS: Record<PlaceId, { x: number; z: number; r: number; top: number }> = {
  stadium: { x: 44, z: -38, r: 25, top: 19 },
  training: { x: -46, z: -36, r: 20, top: 9 },
  home: { x: -42, z: 34, r: 13, top: 16 },
  mall: { x: 44, z: 34, r: 16, top: 15 },
  gym: { x: 2, z: 52, r: 10, top: 11 },
  restaurant: { x: -16, z: 6, r: 8, top: 8 },
  shops: { x: 18, z: -8, r: 13, top: 10 },
};
export const homeTop = (tier: number) => [17, 17, 44, 66, 10, 14][tier] ?? 17;

/** the light of this week: the hour moves through dusk week by week, the weather greys the sky */
export function cityLight(life: Life, round: number) {
  const kind = life.weather.kind;
  const wet = kind === "rain" || kind === "storm";
  const grey = kind === "cloud" || wet || kind === "fog" ? (kind === "cloud" ? 0.4 : 0.62) : 0;
  const hour = [17.9, 19.1, 20.4][round % 3] + (kind === "storm" ? 0.7 : 0);
  const night = THREE.MathUtils.clamp((hour - 17.6) / 2.6, 0, 1);
  const top = new THREE.Color(life.style.sky[0]).lerp(new THREE.Color("#2a3140"), grey * 0.6).lerp(new THREE.Color("#03050a"), night * 0.75);
  const bottom = new THREE.Color(life.style.sky[1]).lerp(new THREE.Color("#6d737c"), grey).lerp(new THREE.Color("#1a1c2a"), night * 0.7);
  const fog = kind === "fog" ? 0.0056 : kind === "haze" ? 0.0032 : wet ? 0.0034 : kind === "snow" ? 0.003 : kind === "cloud" ? 0.0022 : 0.0016;
  // the haze colour: the low sky, cooled and darkened by rain and by night
  const haze = bottom.clone().lerp(new THREE.Color("#39404a"), grey * 0.55).lerp(new THREE.Color("#0b0d14"), night * 0.35);
  return { kind: kind as WeatherKind, wet, grey, night, hour, top, bottom, haze, fog, sun: new THREE.Color("#ffb070").lerp(new THREE.Color("#8090b0"), Math.max(grey, night)) };
}

type Light = ReturnType<typeof cityLight>;

export default function CityScene({
  life,
  round,
  quality,
  hover,
  onHover,
  onPick,
  labelEls,
  ctl,
}: {
  life: Life;
  round: number;
  quality: number;
  hover: PlaceId | null;
  onHover: (id: PlaceId | null) => void;
  onPick: (id: PlaceId) => void;
  labelEls: React.MutableRefObject<Map<string, HTMLElement>>;
  ctl: React.MutableRefObject<CamCtl>;
}) {
  const light = useMemo(() => cityLight(life, round), [life, round]);
  const night = useMemo(() => ({ value: light.night }), [light]);
  return (
    <>
      <Sky light={light} />
      <fogExp2 attach="fog" args={[light.haze.getStyle(), light.fog]} />
      <hemisphereLight args={[light.top, "#1a1712", 0.55 + (1 - light.night) * 0.5]} />
      <directionalLight
        position={[-60, 40 - light.night * 25, -50]}
        intensity={1.1 * (1 - light.night * 0.75) * (1 - light.grey * 0.5)}
        color={light.sun}
        castShadow={quality >= 3}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-110}
        shadow-camera-right={110}
        shadow-camera-top={110}
        shadow-camera-bottom={-110}
        shadow-camera-far={300}
        shadow-bias={-0.0006}
      />
      <Ground life={life} light={light} />
      <Buildings life={life} night={night} quality={quality} />
      <Traffic count={[8, 14, 22, 30][quality]} night={light.night} />
      <Landmarks life={life} night={night} light={light} hover={hover} onHover={onHover} onPick={onPick} quality={quality} />
      <Weather kind={light.kind} quality={quality} />
      <CityCamera ctl={ctl} />
      <Projector labelEls={labelEls} life={life} />
    </>
  );
}

// ---------- the sky: a gradient dome with the low sun and, at night, stars ----------
function Sky({ light }: { light: Light }) {
  const m = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { uTop: { value: light.top }, uBottom: { value: light.bottom }, uNight: { value: light.night }, uSun: { value: light.sun.clone().multiplyScalar(1 - light.grey) }, uFlash: { value: 0 } },
        vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 uTop; uniform vec3 uBottom; uniform float uNight; uniform vec3 uSun; uniform float uFlash; varying vec3 vP;
          float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
          void main(){
            vec3 d = normalize(vP);
            float t = smoothstep(-0.04, 0.55, d.y);
            vec3 c = mix(uBottom, uTop, t);
            vec3 sd = normalize(vec3(-0.75, 0.08 - uNight * 0.12, -0.62));
            float s = max(dot(d, sd), 0.0);
            c += uSun * (pow(s, 220.0) * 2.0 + pow(s, 9.0) * 0.35) * (1.0 - uNight * 0.8);
            vec3 q = floor(d * 380.0);
            float star = step(0.9975, h(q)) * smoothstep(0.08, 0.4, d.y) * uNight;
            c += vec3(star * 0.9);
            c += vec3(0.75, 0.8, 1.0) * uFlash;
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    [light],
  );
  useEffect(() => () => m.dispose(), [m]);
  // lightning in a storm: a flash every few seconds
  const next = useRef(3);
  useFrame(({ clock }) => {
    if (light.kind !== "storm") return;
    const t = clock.elapsedTime;
    if (t > next.current) {
      m.uniforms.uFlash.value = 0.55;
      next.current = t + 3 + Math.random() * 6;
    }
    m.uniforms.uFlash.value *= 0.86;
  });
  return (
    <mesh material={m} renderOrder={-1}>
      <sphereGeometry args={[420, 32, 16]} />
    </mesh>
  );
}

// ---------- the ground: roads, pavements, parks and the water, painted once ----------
const SPAN = 208;
const BLOCK = 26;
/** which blocks are parks in this city (the ground paints them green, the buildings keep off them) */
function parksOf(key: string) {
  const rnd = seeded(key + "parks");
  const out = new Set<string>();
  for (let i = -4; i < 4; i++) for (let j = -4; j < 4; j++) if (rnd() < 0.12) out.add(i + "," + j);
  return out;
}
function Ground({ life, light }: { life: Life; light: Light }) {
  const tex = useMemo(
    () =>
      cachedTexture(
        "city-ground|" + life.style.key + "|" + life.style.ground,
        (x, w) => {
          const px = w / SPAN;
          const to = (v: number) => (v + SPAN / 2) * px;
          x.fillStyle = life.style.ground;
          x.fillRect(0, 0, w, w);
          // parks
          for (const key of parksOf(life.style.key)) {
            const [i, j] = key.split(",").map(Number);
            x.fillStyle = "#1f3a22";
            x.fillRect(to(i * BLOCK + 3.5), to(j * BLOCK + 3.5), 19 * px, 19 * px);
          }
          // pavements then roads, every block
          for (let k = -4; k <= 4; k++) {
            const c = k * BLOCK;
            x.fillStyle = "#3a3d40";
            x.fillRect(to(c - 4.5), 0, 9 * px, w);
            x.fillRect(0, to(c - 4.5), w, 9 * px);
          }
          for (let k = -4; k <= 4; k++) {
            const c = k * BLOCK;
            x.fillStyle = "#18191b";
            x.fillRect(to(c - 3), 0, 6 * px, w);
            x.fillRect(0, to(c - 3), w, 6 * px);
          }
          x.strokeStyle = "rgba(240,236,220,0.55)";
          x.lineWidth = Math.max(1, px * 0.18);
          x.setLineDash([px * 2, px * 2.5]);
          for (let k = -4; k <= 4; k++) {
            const c = to(k * BLOCK);
            x.beginPath();
            x.moveTo(c, 0);
            x.lineTo(c, w);
            x.moveTo(0, c);
            x.lineTo(w, c);
            x.stroke();
          }
          // the central plaza
          x.setLineDash([]);
          x.fillStyle = "#4a4740";
          x.beginPath();
          x.arc(to(0), to(0), 9 * px, 0, Math.PI * 2);
          x.fill();
        },
        2048,
        2048,
      ),
    [life.style.key, life.style.ground],
  );
  const wetMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: tex, roughness: light.wet ? 0.28 : 0.92, metalness: light.wet ? 0.25 : 0, color: light.kind === "snow" ? "#c9ced6" : "#ffffff" }),
    [tex, light.wet, light.kind],
  );
  useEffect(() => () => wetMat.dispose(), [wetMat]);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} material={wetMat} receiveShadow>
        <planeGeometry args={[SPAN, SPAN]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.05}>
        <planeGeometry args={[900, 900]} />
        <meshStandardMaterial color={life.style.ground} roughness={1} />
      </mesh>
      {life.style.water && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, -SPAN / 2 - 60]}>
          <planeGeometry args={[900, 120]} />
          <meshStandardMaterial color="#0b1a2a" roughness={0.12} metalness={0.7} />
        </mesh>
      )}
    </group>
  );
}

// ---------- the buildings: one instanced mesh, taller in the middle, never on a place's plot ----------
function Buildings({ life, night, quality }: { life: Life; night: { value: number }; quality: number }) {
  const { mesh, m2, trees } = useMemo(() => {
    const rnd = seeded(life.style.key + "towers");
    const boxes: THREE.Matrix4[] = [];
    const treeAt: THREE.Vector3[] = [];
    const parks = parksOf(life.style.key);
    const blocked = (x: number, z: number, pad: number) => Object.values(SPOTS).some((s) => Math.hypot(s.x - x, s.z - z) < s.r + pad) || Math.hypot(x, z) < 12;
    for (let i = -4; i < 4; i++)
      for (let j = -4; j < 4; j++) {
        const cx = i * BLOCK + BLOCK / 2,
          cz = j * BLOCK + BLOCK / 2;
        const park = parks.has(i + "," + j);
        for (const [ox, oz] of [
          [-5, -5],
          [5, -5],
          [-5, 5],
          [5, 5],
        ]) {
          const x = cx + ox,
            z = cz + oz;
          if (blocked(x, z, 5) || park) {
            if (!blocked(x, z, 1) && rnd() < 0.5) treeAt.push(new THREE.Vector3(x + (rnd() - 0.5) * 6, 0, z + (rnd() - 0.5) * 6));
            continue;
          }
          const d = Math.hypot(x, z);
          // the skyline: tallest around the middle, but kept clear of the places so they can be seen
          const near = Math.min(...Object.values(SPOTS).map((s) => Math.hypot(s.x - x, s.z - z) - s.r));
          const h = life.style.height * (5 + rnd() * 8 + 40 * Math.exp(-d / 40) * Math.pow(rnd(), 1.4)) * THREE.MathUtils.clamp(near / 22, 0.35, 1);
          const w = 6.5 + rnd() * 2.6,
            dd = 6.5 + rnd() * 2.6;
          boxes.push(new THREE.Matrix4().compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, dd)));
          // a smaller block on top of some towers
          if (h > 24 && rnd() < 0.5) boxes.push(new THREE.Matrix4().compose(new THREE.Vector3(x, h + 2, z), new THREE.Quaternion(), new THREE.Vector3(w * 0.6, 4, dd * 0.6)));
        }
      }
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const m = windowsMaterial(life.style.build, "#ffd9a0", night, { lit: 0.38 });
    const inst = new THREE.InstancedMesh(geo, m, boxes.length);
    boxes.forEach((b, k) => inst.setMatrixAt(k, b));
    inst.castShadow = quality >= 3;
    inst.receiveShadow = quality >= 3;
    // trees on the free plots
    const n = Math.min(treeAt.length, [20, 50, 90, 140][quality]);
    const crown = new THREE.InstancedMesh(sphere(1, 10), mat("#24452a", { rough: 0.9 }), n);
    const t = new THREE.Matrix4();
    for (let k = 0; k < n; k++) {
      const p = treeAt[k];
      const s = 1.4 + rnd() * 1.2;
      crown.setMatrixAt(k, t.compose(new THREE.Vector3(p.x, 2.2 + s, p.z), new THREE.Quaternion(), new THREE.Vector3(s, s * 1.2, s)));
    }
    return { mesh: inst, m2: m, trees: crown };
  }, [life.style.key, life.style.build, life.style.height, night, quality]);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      m2.dispose();
      mesh.dispose();
      trees.dispose();
    },
    [mesh, m2, trees],
  );
  return (
    <>
      <primitive object={mesh} />
      <primitive object={trees} />
    </>
  );
}

// ---------- traffic: cars that drive the grid, with their lights on ----------
function Traffic({ count, night }: { count: number; night: number }) {
  const { body, heads, tails, cars } = useMemo(() => {
    const rnd = seeded("traffic" + count);
    const cols = ["#d8d8d8", "#1a1a1c", "#7a8590", "#8a1c1c", "#1c2c4a", "#e8e2d0", "#2f4a3a"];
    const body = new THREE.InstancedMesh(rbox(1.8, 1.1, 4.2, 0.3), new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.5 }), count);
    const heads = new THREE.InstancedMesh(rbox(1.5, 0.18, 0.1, 0.04), glow("#fff2d6", 2), count);
    const tails = new THREE.InstancedMesh(rbox(1.5, 0.16, 0.1, 0.04), glow("#ff2a20", 1.6), count);
    const c = new THREE.Color();
    for (let k = 0; k < count; k++) body.setColorAt(k, c.set(cols[k % cols.length]));
    const cars = Array.from({ length: count }, (_, k) => ({
      axis: k % 2,
      line: (Math.floor(rnd() * 9) - 4) * BLOCK + (rnd() < 0.5 ? 1.5 : -1.5),
      pos: (rnd() - 0.5) * SPAN,
      speed: (8 + rnd() * 8) * (rnd() < 0.5 ? 1 : -1),
    }));
    return { body, heads, tails, cars };
  }, [count]);
  useEffect(
    () => () => {
      body.dispose();
      (body.material as THREE.Material).dispose();
      heads.dispose();
      tails.dispose();
    },
    [body, heads, tails],
  );
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    cars.forEach((car, k) => {
      car.pos += car.speed * d;
      if (car.pos > SPAN / 2) car.pos = -SPAN / 2;
      if (car.pos < -SPAN / 2) car.pos = SPAN / 2;
      const dir = Math.sign(car.speed);
      const yaw = car.axis === 0 ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
      const x = car.axis === 0 ? car.line : car.pos,
        z = car.axis === 0 ? car.pos : car.line;
      body.setMatrixAt(k, m.compose(v.set(x, 0.75, z), q, one));
      const fx = Math.sin(yaw),
        fz = Math.cos(yaw);
      heads.setMatrixAt(k, m.compose(v.set(x + fx * 2.12, 0.7, z + fz * 2.12), q, one));
      tails.setMatrixAt(k, m.compose(v.set(x - fx * 2.12, 0.78, z - fz * 2.12), q, one));
    });
    body.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    tails.instanceMatrix.needsUpdate = true;
    heads.visible = tails.visible = night > 0.15;
  });
  return (
    <>
      <primitive object={body} />
      <primitive object={heads} />
      <primitive object={tails} />
    </>
  );
}

// ---------- rain and snow: one draw call, moved in the shader ----------
function Weather({ kind, quality }: { kind: WeatherKind; quality: number }) {
  const rain = kind === "rain" || kind === "storm";
  const snow = kind === "snow";
  const obj = useMemo(() => {
    if (!rain && !snow) return null;
    const n = [500, 1400, 2800, 4500][quality] * (kind === "storm" ? 1.4 : 1);
    const rnd = seeded("wx" + kind);
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(n * (rain ? 6 : 3));
    const seed = new Float32Array(n * (rain ? 2 : 1));
    for (let k = 0; k < n; k++) {
      const x = (rnd() - 0.5) * 160,
        y = rnd() * 70,
        z = (rnd() - 0.5) * 160,
        s = rnd();
      if (rain) {
        pos.set([x, y, z, x + 0.35, y - 1.6, z], k * 6);
        seed.set([s, s], k * 2);
      } else {
        pos.set([x, y, z], k * 3);
        seed[k] = s;
      }
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uT: { value: 0 }, uSpeed: { value: rain ? (kind === "storm" ? 52 : 40) : 3.5 } },
      vertexShader: `attribute float aSeed; uniform float uT; uniform float uSpeed; varying float vA;
        void main(){ vec3 p = position; p.y = mod(p.y - uT * uSpeed * (0.8 + aSeed * 0.4), 70.0);
          ${snow ? "p.x += sin(uT * 0.8 + aSeed * 30.0) * 1.2; p.z += cos(uT * 0.6 + aSeed * 20.0) * 1.2;" : "p.x += p.y * 0.05;"}
          vec4 mv = modelViewMatrix * vec4(p, 1.0); vA = smoothstep(0.0, 6.0, p.y) * smoothstep(70.0, 58.0, p.y);
          gl_Position = projectionMatrix * mv; gl_PointSize = ${snow ? "clamp(180.0 / -mv.z, 1.5, 6.0)" : "1.0"}; }`,
      fragmentShader: `varying float vA; void main(){ ${snow ? "vec2 c = gl_PointCoord - 0.5; if (dot(c, c) > 0.25) discard; gl_FragColor = vec4(1.0, 1.0, 1.0, 0.85 * vA);" : "gl_FragColor = vec4(0.72, 0.8, 0.92, 0.32 * vA);"} }`,
    });
    const o = rain ? new THREE.LineSegments(g, m) : new THREE.Points(g, m);
    o.frustumCulled = false;
    return o;
  }, [kind, quality, rain, snow]);
  useEffect(
    () => () => {
      if (!obj) return;
      obj.geometry.dispose();
      (obj.material as THREE.Material).dispose();
    },
    [obj],
  );
  useFrame(({ clock }) => {
    if (obj) (obj.material as THREE.ShaderMaterial).uniforms.uT.value = clock.elapsedTime;
  });
  return obj ? <primitive object={obj} /> : null;
}

// ---------- the places ----------
function Landmarks({
  life,
  night,
  light,
  hover,
  onHover,
  onPick,
  quality,
}: {
  life: Life;
  night: { value: number };
  light: Light;
  hover: PlaceId | null;
  onHover: (id: PlaceId | null) => void;
  onPick: (id: PlaceId) => void;
  quality: number;
}) {
  const groups = useMemo(() => {
    const own: THREE.Material[] = [];
    const wm = (base: string, lit: string, o?: Parameters<typeof windowsMaterial>[3]) => {
      const m = windowsMaterial(base, lit, night, o);
      own.push(m);
      return m;
    };
    const accent = life.style.accent;
    const out: Record<PlaceId, THREE.Group> = {
      stadium: stadium(accent, quality),
      training: trainingGround(wm),
      home: home(life.home.tier, wm, accent),
      mall: mall(life.places.mall, wm, accent),
      gym: gym(life.places.gym, accent),
      restaurant: restaurant(life.places.restaurant, accent),
      shops: shops(life.places.shops, wm),
    };
    for (const id of PLACE_IDS) {
      const s = SPOTS[id];
      out[id].position.set(s.x, 0, s.z);
      out[id].traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = quality >= 3;
          o.receiveShadow = quality >= 3;
        }
      });
    }
    return { out, own };
  }, [life.home.tier, life.places, life.style.accent, night, quality]);
  useEffect(() => () => groups.own.forEach((m) => m.dispose()), [groups]);
  const rings = useRef<Partial<Record<PlaceId, THREE.Mesh>>>({});
  useFrame(({ clock }) => {
    for (const id of PLACE_IDS) {
      const r = rings.current[id];
      if (!r) continue;
      const on = hover === id;
      const k = on ? 1 : 0.35 + Math.sin(clock.elapsedTime * 2 + SPOTS[id].x) * 0.12;
      (r.material as THREE.MeshBasicMaterial).opacity = k * 0.8;
      r.scale.setScalar(on ? 1.06 : 1);
    }
  });
  const ringMat = useMemo(
    () => PLACE_IDS.map(() => new THREE.MeshBasicMaterial({ color: life.style.accent, transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false })),
    [life.style.accent],
  );
  useEffect(() => () => ringMat.forEach((m) => m.dispose()), [ringMat]);
  return (
    <>
      {PLACE_IDS.map((id, k) => (
        <group
          key={id}
          onPointerOver={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            onHover(id);
          }}
          onPointerOut={() => onHover(null)}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            if (e.delta < 6) onPick(id);
          }}
        >
          <primitive object={groups.out[id]} />
          <mesh
            ref={(m: THREE.Mesh | null) => {
              if (m) rings.current[id] = m;
            }}
            rotation-x={-Math.PI / 2}
            position={[SPOTS[id].x, 0.06, SPOTS[id].z]}
            material={ringMat[k]}
          >
            <ringGeometry args={[SPOTS[id].r * 0.92 + 1, SPOTS[id].r * 0.92 + 1.5, 64]} />
          </mesh>
        </group>
      ))}
      {light.night > 0.3 && <pointLight position={[SPOTS.stadium.x, 26, SPOTS.stadium.z]} intensity={900 * light.night} distance={90} decay={1.8} color="#e8f0ff" />}
    </>
  );
}

type WM = (base: string, lit: string, o?: Parameters<typeof windowsMaterial>[3]) => THREE.Material;
const add = (g: THREE.Group, geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, ry = 0) => {
  const me = new THREE.Mesh(geo, m);
  me.position.set(x, y, z);
  me.rotation.y = ry;
  g.add(me);
  return me;
};
function sign(text: string, fg: string, bg: string, w: number, h: number) {
  const m = new THREE.MeshBasicMaterial({ map: signTexture(text, fg, bg, 512, 128), toneMapped: false, transparent: bg === "transparent" });
  return new THREE.Mesh(plane(w, h), m);
}

function stadium(accent: string, quality: number) {
  const g = new THREE.Group();
  // the bowl: a profile turned round the middle, then stretched into an oval
  const prof = [new THREE.Vector2(14, 0), new THREE.Vector2(14, 1.2), new THREE.Vector2(21, 11), new THREE.Vector2(22.4, 12.5), new THREE.Vector2(22.6, 0)];
  const seats = cachedTexture(
    "seats|" + accent,
    (x, w, h) => {
      x.fillStyle = "#30353b";
      x.fillRect(0, 0, w, h);
      for (let r = 0; r < 64; r++) {
        x.fillStyle = r % 2 ? "#3b4249" : "#2a2f35";
        x.fillRect(0, r * (h / 64), w, h / 64 - 1);
      }
      x.fillStyle = accent;
      x.globalAlpha = 0.5;
      for (let c = 0; c < 16; c++) x.fillRect(c * (w / 16), 0, 3, h);
    },
    256,
    512,
  );
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 72), new THREE.MeshStandardMaterial({ map: seats, roughness: 0.9, side: THREE.DoubleSide }));
  bowl.scale.set(1.25, 1, 1);
  g.add(bowl);
  const roof = new THREE.Mesh(
    new THREE.LatheGeometry([new THREE.Vector2(18.5, 15.5), new THREE.Vector2(23.4, 13.4), new THREE.Vector2(23.4, 13.0), new THREE.Vector2(18.5, 15.1)], 72),
    mat("#d9dde2", { rough: 0.4, metal: 0.6, side: THREE.DoubleSide }),
  );
  roof.scale.set(1.25, 1, 1);
  g.add(roof);
  const stripes = cachedTexture(
    "pitch-stripes",
    (x, w, h) => {
      for (let k = 0; k < 12; k++) {
        x.fillStyle = k % 2 ? "#2f7a33" : "#358a3a";
        x.fillRect((k * w) / 12, 0, w / 12, h);
      }
      x.strokeStyle = "rgba(255,255,255,0.85)";
      x.lineWidth = 3;
      x.strokeRect(10, 10, w - 20, h - 20);
      x.beginPath();
      x.moveTo(w / 2, 10);
      x.lineTo(w / 2, h - 10);
      x.stroke();
      x.beginPath();
      x.arc(w / 2, h / 2, h * 0.14, 0, Math.PI * 2);
      x.stroke();
    },
    512,
    320,
  );
  const pitch = new THREE.Mesh(plane(30, 19), new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.85, emissive: "#7ad06a", emissiveIntensity: 0.12, emissiveMap: stripes }));
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.y = 0.08;
  g.add(pitch);
  // four floodlight towers, their lamps and the cones of light
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    const x = sx * 25,
      z = sz * 17;
    add(g, cyl(0.35, 0.5, 26, 10), mat("#9aa0a6", { rough: 0.5, metal: 0.7 }), x, 13, z);
    const head = add(g, rbox(4, 2.2, 0.5, 0.1), glow("#f4f8ff", 2.4), x, 26.5, z);
    head.lookAt(0, 0, 0);
    if (quality >= 1) {
      const c = new THREE.Mesh(cone(9, 30), lightCone("#e8f0ff", 0.09));
      c.position.set(x * 0.5, 13, z * 0.5);
      c.lookAt(x, 26.5, z);
      c.rotateX(-Math.PI / 2);
      g.add(c);
    }
  }
  const s = sign("STADIUM", "#0b0d0c", accent, 10, 2.4);
  s.position.set(0, 9, 22.8 * 1);
  g.add(s);
  return g;
}

function trainingGround(wm: WM) {
  const g = new THREE.Group();
  const lines = cachedTexture(
    "train-pitch",
    (x, w, h) => {
      x.fillStyle = "#33803a";
      x.fillRect(0, 0, w, h);
      for (let k = 0; k < 10; k++) {
        x.fillStyle = k % 2 ? "#2f7634" : "#358638";
        x.fillRect((k * w) / 10, 0, w / 10, h);
      }
      x.strokeStyle = "rgba(255,255,255,0.8)";
      x.lineWidth = 3;
      x.strokeRect(8, 8, w - 16, h - 16);
      x.beginPath();
      x.moveTo(w / 2, 8);
      x.lineTo(w / 2, h - 8);
      x.stroke();
    },
    512,
    320,
  );
  const pm = new THREE.MeshStandardMaterial({ map: lines, roughness: 0.9 });
  for (const z of [-6, 7]) {
    const p = add(g, plane(24, 11), pm, 0, 0.06, z);
    p.rotation.x = -Math.PI / 2;
  }
  add(g, rbox(10, 5, 5, 0.2), wm("#cfc8b8", "#ffe2b0", { size: [2, 2.4], lit: 0.7 }), -16, 2.5, 0);
  const fence = mat("#1c2a22", { rough: 0.6, opacity: 0.85 });
  add(g, rbox(28, 2.4, 0.1, 0.02), fence, 0, 1.2, -13);
  add(g, rbox(28, 2.4, 0.1, 0.02), fence, 0, 1.2, 14);
  for (const [x, z] of [
    [-12, -12],
    [12, -12],
    [-12, 13],
    [12, 13],
  ]) {
    add(g, cyl(0.15, 0.2, 9, 8), mat("#8a9096", { metal: 0.6, rough: 0.4 }), x, 4.5, z);
    add(g, rbox(1.4, 0.5, 0.3, 0.05), glow("#f4f8ff", 1.6), x, 9, z);
  }
  for (let k = 0; k < 8; k++) add(g, cone(0.25, 0.5), mat("#ff8a2a", { rough: 0.6 }), -6 + k * 1.6, 0.3, -2);
  return g;
}

function home(tier: number, wm: WM, accent: string) {
  const g = new THREE.Group();
  if (tier <= 1) {
    add(g, rbox(12, 16, 11, 0.2), wm("#7c5544", "#ffd28a", { size: [1.7, 2.8], lit: 0.55 }), 0, 8, 0);
    add(g, rbox(12.6, 0.6, 11.6, 0.1), mat("#3a2d27"), 0, 16.2, 0);
  } else if (tier === 2) {
    add(g, rbox(11, 42, 11, 0.3), wm("#4a5260", "#ffe0a8", { size: [1.8, 3], lit: 0.5 }), 0, 21, 0);
    add(g, rbox(12, 1, 12, 0.2), mat("#2a2f36"), 0, 42.4, 0);
  } else if (tier === 3) {
    add(g, rbox(12, 62, 12, 0.4), wm("#1d2a3a", "#cfe6ff", { size: [1.5, 3.2], lit: 0.62, rough: 0.3 }), 0, 31, 0);
    add(g, rbox(12.4, 4, 12.4, 0.3), glass("#9fc4e8", 0.5), 0, 64, 0);
    add(g, cyl(6.6, 6.6, 0.4, 40, true), glow(accent, 1.8), 0, 66.2, 0);
  } else {
    // a villa or a mansion: low, white, a pool, a garden; the mansion sits on a rise and is twice the size
    const big = tier >= 5;
    const k = big ? 1.6 : 1;
    if (big) {
      const hill = add(g, sphere(16, 28), mat("#2c4a2c", { rough: 1 }), 0, -9, 0);
      hill.scale.set(1, 0.6, 1);
    }
    const y0 = big ? 0.8 : 0;
    const lawn = add(g, plane(24 * k, 20 * k), mat("#2f5a30", { rough: 1 }), 0, y0 + 0.07, 0);
    lawn.rotation.x = -Math.PI / 2;
    add(g, rbox(14 * k, 4, 8 * k, 0.15), wm("#ece8df", "#ffdca0", { size: [3, 3.2], lit: 0.8 }), -1, y0 + 2, -3);
    add(g, rbox(9 * k, 3.6, 6 * k, 0.15), wm("#e2ddd2", "#ffdca0", { size: [3, 3.2], lit: 0.8 }), 2, y0 + 5.8, -4);
    add(g, rbox(15 * k, 0.4, 9 * k, 0.1), mat("#2a2c2e"), -1, y0 + 4.2, -3);
    const pool = add(g, plane(8 * k, 4 * k), glow("#3fc6e8", 0.9), 2, y0 + 0.1, 5 * k);
    pool.rotation.x = -Math.PI / 2;
    for (let i = 0; i < (big ? 8 : 4); i++) {
      const tx = -10 * k + i * ((20 * k) / (big ? 7 : 3)),
        tz = 8.5 * k;
      add(g, cyl(0.2, 0.3, 5, 6), mat("#5a4632"), tx, y0 + 2.5, tz);
      add(g, sphere(1.6, 8), mat("#2b5a2c", { rough: 0.9 }), tx, y0 + 5.4, tz);
    }
  }
  return g;
}

function mall(name: string, wm: WM, accent: string) {
  const g = new THREE.Group();
  add(g, rbox(28, 12, 18, 0.4), wm("#d8d4cc", "#fff0d0", { size: [2.4, 4], lit: 0.75, rough: 0.5 }), 0, 6, 0);
  add(g, rbox(14, 9, 0.4, 0.1), glass("#bcd4e6", 0.55), 0, 4.6, 9.1);
  add(g, rbox(12, 7.6, 0.2, 0.05), glow("#fff1d6", 0.9), 0, 4, 8.9);
  add(g, rbox(16, 0.5, 4, 0.1), mat("#2a2c2e"), 0, 9.2, 10.8);
  const s = sign(name.toUpperCase(), "#0b0d0c", accent, 14, 2);
  s.position.set(0, 10.8, 9.25);
  g.add(s);
  return g;
}

function gym(name: string, accent: string) {
  const g = new THREE.Group();
  add(g, rbox(15, 9, 11, 0.3), mat("#1d2126", { rough: 0.6, metal: 0.2 }), 0, 4.5, 0);
  add(g, rbox(15.2, 0.35, 11.2, 0.05), glow(accent, 1.4), 0, 8.4, 0);
  add(g, rbox(10, 5, 0.3, 0.08), glow("#f0f6ff", 0.55), 0, 3.2, 5.6);
  const s = sign(name.toUpperCase(), accent, "#0b0d0c", 12, 1.6);
  s.position.set(0, 6.9, 5.62);
  g.add(s);
  return g;
}

function restaurant(name: string, accent: string) {
  const g = new THREE.Group();
  add(g, rbox(12, 6, 9, 0.2), mat("#5e4130", { rough: 0.8 }), 0, 3, 0);
  add(g, rbox(9, 3.2, 0.2, 0.05), glow("#ffc27a", 0.9), 0, 2.2, 4.55);
  const aw = add(g, rbox(12.4, 0.2, 2.6, 0.05), mat(accent, { rough: 0.9 }), 0, 4.2, 5.6);
  aw.rotation.x = 0.25;
  const bulbs = new THREE.InstancedMesh(sphere(0.12, 8), glow("#ffd89a", 2), 14);
  const m = new THREE.Matrix4();
  for (let k = 0; k < 14; k++) {
    const t = k / 13;
    bulbs.setMatrixAt(k, m.makeTranslation(-6 + t * 12, 4.9 - Math.sin(t * Math.PI) * 0.6, 6.8));
  }
  g.add(bulbs);
  const s = sign(name, "#ffe9c2", "#2a1d15", 8, 1.4);
  s.position.set(0, 5.3, 4.56);
  g.add(s);
  return g;
}

function shops(name: string, wm: WM) {
  const g = new THREE.Group();
  const names = ["ARDEN", "SOLENNE", "HALCYON", "CELESTOR"];
  const cols = ["#1c2230", "#2a1c24", "#1e2a24", "#2a2418"];
  names.forEach((n, k) => {
    const x = -13 + k * 6.5;
    add(g, rbox(6, 9, 7, 0.15), wm(cols[k] === "#1c2230" ? "#3a3e46" : "#4a4440", "#ffe4b8", { size: [2, 3], lit: 0.6 }), x, 4.5, -2);
    add(g, rbox(5, 3.6, 0.2, 0.05), glow("#ffeedd", 0.7), x, 2, 1.6);
    const s = sign(n, "#e8d9b0", cols[k], 4.6, 0.9);
    s.position.set(x, 4.6, 1.62);
    g.add(s);
  });
  // the car showroom on the corner, a car turning on a stand behind the glass
  add(g, rbox(10, 6, 9, 0.2), mat("#1a1c1f", { rough: 0.4, metal: 0.4 }), 13, 3, 0);
  add(g, rbox(9.6, 5, 0.2, 0.05), glass("#aac0d4", 0.35), 13, 2.8, 4.6);
  const car = makeCar({ body: "sports", colour: "#c8102e" });
  car.position.set(13, 0.2, 1.5);
  car.rotation.y = 0.8;
  car.name = "showcar";
  g.add(car);
  const s = sign(name.toUpperCase(), "#0b0d0c", "#e8d9b0", 9, 1.4);
  s.position.set(0, 10.2, 1.55);
  g.add(s);
  return g;
}

// ---------- the camera: orbit with a slow drift, flown in by the parent with GSAP ----------
export interface CamCtl {
  yaw: number;
  pitch: number;
  dist: number;
  tx: number;
  ty: number;
  tz: number;
  idle: number;
  drift: boolean;
}
export const camStart = (): CamCtl => ({ yaw: 0.72, pitch: 0.4, dist: 205, tx: 0, ty: 4, tz: -6, idle: 0, drift: true });
function CityCamera({ ctl }: { ctl: React.MutableRefObject<CamCtl> }) {
  useFrame(({ camera }, dt) => {
    const c = ctl.current;
    c.idle += dt;
    if (c.drift && c.idle > 4) c.yaw += dt * 0.025;
    const cp = Math.cos(c.pitch),
      sp = Math.sin(c.pitch);
    camera.position.set(c.tx + Math.sin(c.yaw) * cp * c.dist, c.ty + sp * c.dist, c.tz + Math.cos(c.yaw) * cp * c.dist);
    camera.lookAt(c.tx, c.ty, c.tz);
  });
  return null;
}

// ---------- labels: each place's name card follows its building on screen ----------
function Projector({ labelEls, life }: { labelEls: React.MutableRefObject<Map<string, HTMLElement>>; life: Life }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const id of PLACE_IDS) {
      const el = labelEls.current.get(id);
      if (!el) continue;
      const s = SPOTS[id];
      const top = id === "home" ? homeTop(life.home.tier) : s.top;
      v.set(s.x, top + 3, s.z).project(camera);
      const behind = v.z > 1;
      el.style.transform = `translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px) translate(-50%, -100%)`;
      el.style.opacity = behind ? "0" : "1";
    }
  });
  return null;
}
