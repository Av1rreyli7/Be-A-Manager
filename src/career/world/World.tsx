"use client";
/* eslint-disable react-hooks/immutability -- three.js objects built in useMemo are moved every frame in useFrame, which is how React Three Fiber works */
/**
 * The open city. He walks it in third person as his own footballer (WASD, Shift to run, the mouse or a trackpad
 * glide to look round, see look.ts), drives his own cars (F to get in or out), or waits at a stop and rides the bus. The day
 * turns while he plays: the sun crosses the sky, the street lamps and windows come on at dusk. People walk the
 * pavements and stop to talk; fans ask for a photo once he is known. Doors glow; E goes in. The city streams
 * round him in chunks and everything repeated is instanced, so it stays smooth.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { makeBody, type Outfit } from "../body";
import { herDoor, newCompanion, stepTowards } from "./date";
import { cityClock } from "./clock";
import type { Look } from "../types";
import type { CareerState, CatalogCar, LifeCar } from "../types";
import { Grid, rng, type CityPlan, type PlaceSpot } from "./gen";
import { buildGround, buildBuildings, buildPlaces, buildStreetFurniture } from "./scene";
import { makePeople } from "./people";
import { makeTraffic, makeParked, makeBus, bodyGeometry, lightGreen, type Body } from "./vehicles";
import { driveStep, newDrive, type DriveState, type Feel } from "./drive";
import { worldMaterial } from "./mesher";
import type { StreetSound } from "./audio";

export interface WorldCtl {
  x: number;
  z: number;
  ry: number;
  mode: "walk" | "drive" | "bus";
  carId: string | null;
  parked: { id: string; x: number; z: number; ry: number } | null;
  speed: number;
  hour: number;
  waypoint: { x: number; z: number } | null;
  teleport: { x: number; z: number; ry: number } | null;
  /** out of a garage in this car, at the kerb of that home */
  driveOut: { id: string; x: number; z: number; ry: number } | null;
  busWait: number | null;
  busGetOff: boolean;
  camYaw: number;
  camPitch: number;
  camDist: number;
  /** when he last looked round (performance.now() in seconds): the car's camera eases back behind it after a pause */
  lookT: number;
  fps: number;
  /** the touch stick, x right and y down, each from -1 to 1 (null when no thumb is on it) */
  stick: { x: number; y: number } | null;
}
/** where he starts: on the pavement outside his own front door */
export function homeDoor(plan: CityPlan, homeId: string) {
  const s = plan.places.find((p) => p.place.kind === "home" && (p.place.homeId || p.place.id.replace("home:", "")) === homeId);
  return s ? { x: s.door.x + s.face[0] * 1.6, z: s.door.z + s.face[1] * 1.6, ry: Math.atan2(s.face[0], s.face[1]) } : plan.spawn;
}
export const worldStart = (plan: CityPlan, hour: number, homeId = ""): WorldCtl => ({
  ...(() => {
    const d = homeDoor(plan, homeId);
    return { x: d.x, z: d.z, ry: d.ry };
  })(),
  mode: "walk",
  carId: null,
  parked: null,
  speed: 0,
  hour,
  waypoint: null,
  teleport: null,
  driveOut: null,
  busWait: null,
  busGetOff: false,
  camYaw: homeDoor(plan, homeId).ry + Math.PI,
  camPitch: 0.32,
  camDist: 7.5,
  lookT: -9,
  fps: 60,
  stick: null,
});

/** the mouse or a glide turns the street camera (dx right, dy down, in pixels) */
export function lookStreet(c: WorldCtl, dx: number, dy: number, now: number) {
  c.camYaw -= dx * 0.0042;
  c.camPitch = Math.min(1.2, Math.max(0.05, c.camPitch + dy * 0.0032));
  c.lookT = now;
}
/** a gentle zoom: further out above 1, closer in below */
export function zoomStreet(c: WorldCtl, f: number) {
  c.camDist = Math.min(c.mode === "drive" ? 22 : 16, Math.max(3.2, c.camDist * f));
}

export interface Prompt {
  key: string;
  text: string;
  hint?: string;
}
const QUAL = {
  far: [260, 360, 480, 620],
  people: [40, 80, 130, 200],
  traffic: [12, 24, 36, 52],
  shadow: [0, 1024, 2048, 2048],
  shadowBox: [0, 60, 80, 110],
};
// a car from the old made up range has no feel: give it one from its body
const FEEL_OF: Record<string, Feel> = {
  scooter: { top: 24, accel: 5, grip: 0.8, mass: 140 },
  bike: { top: 80, accel: 14, grip: 0.95, mass: 200 },
  hatch: { top: 50, accel: 6, grip: 0.9, mass: 1150 },
  saloon: { top: 62, accel: 8, grip: 0.95, mass: 1500 },
  coupe: { top: 78, accel: 10.5, grip: 1.05, mass: 1600 },
  sports: { top: 88, accel: 12.5, grip: 1.12, mass: 1550 },
  suv: { top: 64, accel: 7.5, grip: 0.85, mass: 2400 },
  hyper: { top: 100, accel: 15, grip: 1.18, mass: 1500 },
  van: { top: 45, accel: 5, grip: 0.8, mass: 2600 },
};
export function carSpec(state: CareerState, id: string): { body: Body; colour: string; feel: Feel; name: string } | null {
  const cat = state.life.catalog?.cars.find((c: CatalogCar) => c.id === id);
  if (cat) return { body: cat.body as Body, colour: cat.colour, feel: cat.feel || FEEL_OF[cat.body] || FEEL_OF.saloon, name: cat.brand + " " + cat.model };
  const old = state.life.cars.find((c: LifeCar) => c.id === id);
  if (old) return { body: old.body as Body, colour: old.colour, feel: FEEL_OF[old.body] || FEEL_OF.saloon, name: old.brand + " " + old.model };
  return null;
}

function skyColours(hour: number, style: { sky: [string, string] }, grey: number) {
  // sun height from sunrise at 6 to sunset at 19.5
  const el = Math.sin(((hour - 6) / 13.5) * Math.PI);
  const day = THREE.MathUtils.clamp((el + 0.08) / 0.35, 0, 1);
  const dusk = THREE.MathUtils.clamp(1 - Math.abs(el) / 0.32, 0, 1) * (hour > 12 ? 1 : 0.7);
  const night = 1 - day;
  const top = new THREE.Color("#3f78c9").lerp(new THREE.Color(style.sky[0]), dusk * 0.8).lerp(new THREE.Color("#04060c"), night);
  const bottom = new THREE.Color("#a9cbe8").lerp(new THREE.Color(style.sky[1]), dusk).lerp(new THREE.Color("#121624"), night * 0.92);
  top.lerp(new THREE.Color("#59606b"), grey * 0.6 * day);
  bottom.lerp(new THREE.Color("#9097a0"), grey * 0.7 * day);
  return { el, day, dusk, night, top, bottom };
}

export default function World({
  state,
  plan,
  quality,
  ctl,
  outfit,
  active,
  sound,
  onEnter,
  onPrompt,
  onBubble,
  onPhoto,
  onPickup,
  onStreetDate,
}: {
  state: CareerState;
  plan: CityPlan;
  quality: number;
  ctl: React.MutableRefObject<WorldCtl>;
  outfit: Outfit;
  active: boolean;
  sound: StreetSound;
  onEnter: (s: PlaceSpot) => void;
  onPrompt: (p: Prompt | null) => void;
  onBubble: (text: string | null) => void;
  onPhoto: () => void;
  /** he is at her door for a date */
  onPickup?: () => void;
  /** a walk or a drive together has gone on long enough: the date's moments */
  onStreetDate?: () => void;
}) {
  const { scene, gl, camera } = useThree();
  const q = Math.max(0, Math.min(3, quality));
  const night = useMemo(() => ({ value: 0 }), []);
  const grid = useMemo(() => new Grid(plan.colliders), [plan]);
  const ground = useMemo(() => buildGround(plan, night), [plan, night]);
  const builds = useMemo(() => buildBuildings(plan, night, q), [plan, night, q]);
  const places = useMemo(() => buildPlaces(plan, night), [plan, night]);
  const furniture = useMemo(() => buildStreetFurniture(plan, night, q), [plan, night, q]);
  const people = useMemo(() => makePeople(plan, QUAL.people[q], night), [plan, night, q]);
  const traffic = useMemo(() => makeTraffic(plan, QUAL.traffic[q], night), [plan, night, q]);
  const parkedCars = useMemo(() => makeParked(plan, night), [plan, night]);
  const bus = useMemo(() => makeBus(plan, night), [plan, night]);
  useEffect(() => () => ground.dispose(), [ground]);
  useEffect(() => () => builds.dispose(), [builds]);
  useEffect(() => () => places.dispose(), [places]);
  useEffect(() => () => furniture.dispose(), [furniture]);
  useEffect(() => () => people.dispose(), [people]);
  useEffect(() => () => traffic.dispose(), [traffic]);
  useEffect(() => () => parkedCars.dispose(), [parkedCars]);
  useEffect(() => () => bus.dispose(), [bus]);

  // ---------- his own body ----------
  const lookKey = JSON.stringify(state.look) + JSON.stringify(outfit);
  const rig = useMemo(
    () => makeBody(state.look, state.person, outfit, Math.min(1, q)),
    // rebuilt only when what he looks like or wears changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lookKey, q],
  );
  useEffect(() => () => rig.dispose(), [rig]);

  // ---------- a date: her door, and her, from waiting outside to beside him ----------
  const dplan = state.social?.dating?.plan || null;
  const herWho = dplan ? dplan.who : null;
  const door = useMemo(() => (dplan && dplan.pickup && herWho ? herDoor(plan, herWho.seed) : null), [plan, dplan, herWho]);
  const herKey = herWho ? herWho.id + "|" + dplan!.venue : "";
  const herRig = useMemo(
    () => (herWho ? makeBody(herWho.look as Partial<Look>, { height: herWho.h, weight: herWho.w, pos: "CM" }, (dplan!.venue === "club" || dplan!.venue === "restaurant" ? herWho.night : herWho.outfit) as Outfit, Math.min(1, q), undefined, { seed: 4 }) : null),
    // rebuilt only for a different date
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [herKey, q],
  );
  useEffect(() => () => herRig?.dispose(), [herRig]);
  const comp = useRef(newCompanion(""));
  const datePlan = useRef(dplan);
  useEffect(() => {
    datePlan.current = dplan;
  }, [dplan]);
  const herMark = useMemo(() => {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial({ color: "#ff7aa8", toneMapped: false }));
    m.visible = false;
    return m;
  }, []);

  // ---------- his car, when he has one out ----------
  const carMat = useMemo(() => worldMaterial(night, { rough: 0.25, metal: 0.55 }), [night]);
  const carMesh = useMemo(() => new THREE.Mesh(new THREE.BufferGeometry(), carMat), [carMat]);
  const carKey = useRef("");
  const drive = useRef<DriveState | null>(null);
  const setCar = (id: string | null) => {
    const spec = id ? carSpec(state, id) : null;
    const k = id && spec ? id + spec.colour : "";
    if (k === carKey.current) return spec;
    carKey.current = k;
    carMesh.geometry.dispose();
    carMesh.geometry = spec ? bodyGeometry(spec.body, spec.colour) : new THREE.BufferGeometry();
    carMesh.castShadow = true;
    return spec;
  };
  useEffect(() => () => carMat.dispose(), [carMat]);

  // ---------- doors: glowing rings on the pavement ----------
  const doorRings = useMemo(() => {
    const geo = new THREE.RingGeometry(0.75, 0.95, 32).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: "#ffd35c", transparent: true, opacity: 0.6, toneMapped: false, depthWrite: false });
    const im = new THREE.InstancedMesh(geo, mat, plan.places.length);
    const m4 = new THREE.Matrix4();
    plan.places.forEach((s, k) => im.setMatrixAt(k, m4.makeTranslation(s.door.x, 0.17, s.door.z)));
    im.renderOrder = 3;
    return im;
  }, [plan]);
  useEffect(
    () => () => {
      doorRings.geometry.dispose();
      (doorRings.material as THREE.Material).dispose();
    },
    [doorRings],
  );
  // his home: a marker above the door
  const homeSpot = useMemo(() => plan.places.find((s) => s.place.kind === "home" && (s.place.homeId || s.place.id.replace("home:", "")) === state.life.home.id) || null, [plan, state.life.home.id]);
  const homeMark = useMemo(() => {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), new THREE.MeshBasicMaterial({ color: "#d0e85c", toneMapped: false }));
    return m;
  }, []);
  // the waypoint: a tall soft beam
  const beam = useMemo(() => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 160, 16, 1, true), new THREE.MeshBasicMaterial({ color: "#ffd35c", transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, blending: THREE.AdditiveBlending }));
    m.visible = false;
    return m;
  }, []);

  // ---------- sky, sun, weather ----------
  const kind = state.life.weather.kind;
  const grey = kind === "cloud" ? 0.4 : kind === "rain" || kind === "storm" || kind === "fog" ? 0.65 : kind === "snow" ? 0.5 : 0;
  const skyMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTop: { value: new THREE.Color() },
          uBottom: { value: new THREE.Color() },
          uNight: { value: 0 },
          uSun: { value: new THREE.Vector3(0, 1, 0) },
          uSunCol: { value: new THREE.Color("#ffd8a0") },
          uTime: { value: 0 },
          uCloud: { value: grey },
          uCloudCol: { value: new THREE.Color("#ffffff") },
        },
        vertexShader: `varying vec3 vP; void main(){ vP = position; vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.99999; }`,
        fragmentShader: `uniform vec3 uTop; uniform vec3 uBottom; uniform float uNight; uniform vec3 uSun; uniform vec3 uSunCol; uniform float uTime; uniform float uCloud; uniform vec3 uCloudCol; varying vec3 vP;
          float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
          float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
          float n2(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), u.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), u.x), u.y); }
          float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * n2(p); p *= 2.03; a *= 0.5; } return v; }
          void main(){
            vec3 d = normalize(vP);
            float t = smoothstep(-0.05, 0.6, d.y);
            vec3 c = mix(uBottom, uTop, t);
            float s = max(dot(d, normalize(uSun)), 0.0);
            c += uSunCol * (pow(s, 600.0) * 3.0 + pow(s, 12.0) * 0.28) * step(-0.05, uSun.y);
            vec3 q = floor(d * 420.0);
            c += vec3(step(0.9974, h(q)) * smoothstep(0.05, 0.4, d.y) * uNight * 0.9);
            // clouds on a flat layer high up, drifting slowly; a grey day fills the sky with them
            if (d.y > 0.01) {
              vec2 cp = d.xz / (d.y + 0.08) * 0.9 + vec2(uTime * 0.006, uTime * 0.002);
              float f = fbm(cp * 1.2);
              float cov = smoothstep(0.62 - uCloud * 0.3, 0.9 - uCloud * 0.15, f);
              float fade = smoothstep(0.01, 0.18, d.y);
              vec3 cc = uCloudCol * (0.82 + 0.18 * smoothstep(0.4, 0.9, f));
              c = mix(c, cc, cov * fade * 0.9);
            }
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    [grey],
  );
  useEffect(() => () => skyMat.dispose(), [skyMat]);
  const sky = useMemo(() => new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMat), [skyMat]);
  const sun = useMemo(() => {
    const l = new THREE.DirectionalLight("#fff1dc", 2.4);
    l.castShadow = QUAL.shadow[q] > 0;
    if (l.castShadow) {
      l.shadow.mapSize.set(QUAL.shadow[q], QUAL.shadow[q]);
      const b = QUAL.shadowBox[q];
      Object.assign(l.shadow.camera, { left: -b, right: b, top: b, bottom: -b, near: 1, far: 400 });
      l.shadow.bias = -0.0004;
      l.shadow.normalBias = 0.04;
    }
    return l;
  }, [q]);
  const hemi = useMemo(() => new THREE.HemisphereLight("#cfe2ff", "#6a5f52", 0.9), []);
  const fill = useMemo(() => new THREE.AmbientLight("#ffffff", 0.18), []);
  const precip = useMemo(() => {
    if (!(kind === "rain" || kind === "storm" || kind === "snow")) return null;
    const n = [500, 1200, 2200, 3200][q];
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3);
    const r = rng(plan.seed + 21);
    for (let i = 0; i < n; i++) {
      p[i * 3] = (r() - 0.5) * 70;
      p[i * 3 + 1] = r() * 40;
      p[i * 3 + 2] = (r() - 0.5) * 70;
    }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    const m = new THREE.PointsMaterial({ color: kind === "snow" ? "#ffffff" : "#aeb9c8", size: kind === "snow" ? 0.18 : 0.07, transparent: true, opacity: kind === "snow" ? 0.9 : 0.6, depthWrite: false });
    return new THREE.Points(g, m);
  }, [kind, q, plan.seed]);
  useEffect(
    () => () => {
      if (precip) {
        precip.geometry.dispose();
        (precip.material as THREE.Material).dispose();
      }
    },
    [precip],
  );

  // the root of everything in the street; hidden while he is inside a place
  const root = useMemo(() => new THREE.Group(), []);
  useEffect(() => {
    root.visible = active;
    if (active) {
      scene.fog = new THREE.Fog("#9fb2c8", 40, QUAL.far[q]);
      gl.shadowMap.enabled = QUAL.shadow[q] > 0;
      gl.shadowMap.type = THREE.PCFSoftShadowMap;
    } else scene.fog = null;
    return () => {
      scene.fog = null;
    };
  }, [active, scene, gl, q, root]);

  // ---------- input ----------
  const keys = useRef(new Set<string>());
  const pending = useRef<{ kind: "photo"; ped: unknown; until: number } | null>(null);
  const action = useRef<() => void>(() => {});
  const toggleCar = useRef<() => void>(() => {});
  useEffect(() => {
    if (!active) {
      keys.current.clear();
      return;
    }
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      sound.start();
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift", " "].includes(k)) {
        keys.current.add(k);
        if (k.startsWith("arrow") || k === " ") e.preventDefault();
      }
      if (k === "e" && !e.repeat) action.current();
      if (k === "f" && !e.repeat) toggleCar.current();
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    // looking round (the mouse, a trackpad glide, the wheel) is the screen's look controller: see look.ts
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [active, ctl, sound]);

  // ---------- the frame ----------
  const me = useMemo(() => ({ y: 0.15, walkSpeed: 0, vx: 0, vz: 0 }), []);
  const lastPrompt = useRef("");
  const lastBubble = useRef<number>(0);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const sunV = useMemo(() => new THREE.Vector3(), []);
  const moonV = useMemo(() => new THREE.Vector3(0.4, 0.8, 0.3).normalize(), []);
  const camTarget = useMemo(() => new THREE.Vector3(), []);
  const fpsAcc = useRef({ t: 0, n: 0 });
  const age = state.player.age;
  const fame = state.life.fame ?? 0;
  const myName = state.person.first;
  const prompt = (p: Prompt | null) => {
    const k = p ? p.key + "|" + p.text : "";
    if (k === lastPrompt.current) return;
    lastPrompt.current = k;
    onPrompt(p);
  };
  // the daily car waits by the kerb at home the first time he comes out
  useEffect(() => {
    const c = ctl.current;
    if (c.parked || c.mode === "drive" || !homeSpot || !state.life.car) return;
    const [fx, fz] = homeSpot.face;
    const tx = -fz,
      tz = fx;
    const x = homeSpot.door.x + fx * (plan.walk + 1.4) + tx * 6,
      z = homeSpot.door.z + fz * (plan.walk + 1.4) + tz * 6;
    c.parked = { id: state.life.car.id, x, z, ry: Math.atan2(tx, tz) };
  }, [homeSpot, plan, state.life.car, ctl]);

  useFrame(({ clock }, dt0) => {
    const dt = Math.min(dt0, 0.05);
    const c = ctl.current;
    const t = clock.elapsedTime;
    // frames per second, for the frame guard and the screen
    const fa = fpsAcc.current;
    fa.t += dt0;
    fa.n++;
    if (fa.t > 1) {
      c.fps = fa.n / fa.t;
      fa.t = 0;
      fa.n = 0;
    }
    if (!active) {
      sound.tick({ dt, walk: 0, driving: false, rpm: 0, throttle: 0, traffic: 0, night: night.value, rain: 0, inside: true });
      return;
    }
    // ---------- the time of day ----------
    c.hour = (c.hour + dt / 45) % 24;
    cityClock.hour = c.hour;
    const sk = skyColours(c.hour, state.life.style, grey);
    night.value = THREE.MathUtils.clamp(sk.night * 1.05 + grey * 0.15, 0, 1);
    skyMat.uniforms.uTop.value.copy(sk.top);
    skyMat.uniforms.uBottom.value.copy(sk.bottom);
    skyMat.uniforms.uNight.value = sk.night;
    skyMat.uniforms.uTime.value = t;
    // clouds: white by day, warm at dusk, a dark grey at night
    (skyMat.uniforms.uCloudCol.value as THREE.Color).set("#ffffff").lerp(new THREE.Color("#ffb08a"), sk.dusk * 0.5).lerp(new THREE.Color("#9aa2ad"), grey * 0.5).lerp(new THREE.Color("#1a1e28"), sk.night * 0.9);
    const az = ((c.hour - 6) / 13.5) * Math.PI;
    const sunDir = sunV.set(-Math.cos(az) * 0.8, Math.max(-0.3, sk.el), -0.45).normalize();
    skyMat.uniforms.uSun.value.copy(sunDir);
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(sk.bottom);
    gl.setClearColor(sk.bottom);
    // the sun by day, a dim blue moon by night
    const dayK = sk.day;
    sun.intensity = 0.55 + dayK * 3.4 * (1 - grey * 0.5);
    sun.color.set(dayK > 0.05 ? "#fff1dc" : "#8fa6d6").lerp(new THREE.Color("#ffb070"), sk.dusk * 0.6);
    hemi.intensity = 0.6 + dayK * 1.2;
    hemi.color.copy(sk.top).lerp(new THREE.Color("#ffffff"), 0.4);
    fill.intensity = 0.12 + dayK * 0.25;
    const lightDir = dayK > 0.05 ? sunDir : moonV;
    // ---------- a jump from the map ----------
    if (c.teleport) {
      if (c.mode === "drive" && c.carId) {
        c.parked = { id: c.carId, x: c.x, z: c.z, ry: c.ry };
        c.mode = "walk";
        c.carId = null;
        drive.current = null;
      }
      c.x = c.teleport.x;
      c.z = c.teleport.z;
      c.ry = c.teleport.ry;
      c.camYaw = c.ry + Math.PI;
      c.teleport = null;
      c.busWait = null;
    }
    // ---------- out of the garage in a car ----------
    if (c.driveOut) {
      const o = c.driveOut;
      const spec = carSpec(state, o.id);
      if (spec) {
        drive.current = newDrive(o.x, o.z, o.ry, spec.body);
        c.mode = "drive";
        c.carId = o.id;
        if (c.parked && c.parked.id === o.id) c.parked = null;
        c.camYaw = o.ry + Math.PI;
        c.camDist = 9;
      }
      c.driveOut = null;
    }
    const k = keys.current;
    let fwd = (k.has("w") || k.has("arrowup") ? 1 : 0) - (k.has("s") || k.has("arrowdown") ? 1 : 0);
    let side = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0);
    // the touch stick: push it far to run
    const st0 = c.stick;
    const stickRun = !!st0 && Math.hypot(st0.x, st0.y) > 0.85;
    if (st0 && Math.hypot(st0.x, st0.y) > 0.15) {
      fwd = -st0.y;
      side = st0.x;
    }
    let trafficNear = 0;
    for (const car of traffic.cars) {
      const d = Math.hypot(car.x - c.x, car.z - c.z);
      if (d < 40) trafficNear = Math.max(trafficNear, (1 - d / 40) * Math.min(1, car.speed / 8));
    }
    // ---------- moving: on foot, in the car, on the bus ----------
    if (c.mode === "drive" && c.carId) {
      const spec = setCar(c.carId);
      if (!drive.current || !spec) {
        c.mode = "walk";
      } else {
        const d = drive.current;
        const hit = driveStep(d, { throttle: fwd, steer: -side, handbrake: k.has(" ") }, spec.feel, dt, grid, traffic.cars);
        if (hit && d.bump > 0.2) sound.thud(d.bump);
        c.x = d.x;
        c.z = d.z;
        c.ry = d.ry;
        c.speed = d.speed;
        carMesh.position.set(d.x, me.y - 0.13, d.z);
        carMesh.rotation.set(0, d.ry, d.lean, "YXZ");
        carMesh.visible = true;
        rig.root.visible = false;
        sound.tick({ dt, walk: 0, driving: true, rpm: d.rpm, throttle: Math.max(0, fwd), traffic: trafficNear, night: night.value, rain: precip ? 1 : 0, inside: false });
      }
    } else if (c.mode === "bus") {
      const b = bus.state;
      c.x = b.x;
      c.z = b.z;
      c.ry = b.ry;
      rig.root.visible = false;
      if (b.dwell > 0 && c.busGetOff && b.stopIdx >= 0) {
        const st = plan.stops[b.stopIdx];
        c.mode = "walk";
        c.busGetOff = false;
        c.busWait = null;
        c.x = st.x;
        c.z = st.z;
        c.ry = st.ry;
        sound.chime();
      }
      sound.tick({ dt, walk: 0, driving: true, rpm: 0.2 + Math.min(1, b.speed / 11) * 0.5, throttle: 0.3, traffic: trafficNear, night: night.value, rain: precip ? 1 : 0, inside: false });
    } else {
      // on foot: the keys move him relative to where the camera looks
      const run = k.has("shift") || stickRun;
      const push = Math.min(1, Math.hypot(fwd, side));
      const spd = push > 0.05 ? (run ? 6.2 : 2.7) * (st0 ? Math.max(0.4, push) : 1) : 0;
      if (spd) {
        const yaw = c.camYaw + Math.PI;
        const mx = Math.sin(yaw) * fwd + Math.cos(yaw) * side * -1,
          mz = Math.cos(yaw) * fwd - Math.sin(yaw) * side * -1;
        const l = Math.hypot(mx, mz) || 1;
        me.vx += ((mx / l) * spd - me.vx) * Math.min(1, dt * 10);
        me.vz += ((mz / l) * spd - me.vz) * Math.min(1, dt * 10);
      } else {
        me.vx *= Math.max(0, 1 - dt * 12);
        me.vz *= Math.max(0, 1 - dt * 12);
      }
      const p = { x: c.x + me.vx * dt, z: c.z + me.vz * dt };
      grid.push(p, 0.38);
      // keep him out of the sea
      if (plan.coastZ !== null) p.z = Math.min(p.z, plan.coastZ + plan.pitch);
      c.x = p.x;
      c.z = p.z;
      const sp = Math.hypot(me.vx, me.vz);
      c.speed = sp;
      if (sp > 0.2) c.ry = Math.atan2(me.vx, me.vz);
      rig.root.visible = true;
      let dr = c.ry - rig.root.rotation.y;
      dr = Math.atan2(Math.sin(dr), Math.cos(dr));
      rig.tick(dt, rig.root.rotation.y + dr, sp);
      rig.root.position.set(c.x, me.y, c.z);
      // the car he left in the street
      if (c.parked) {
        const spec = setCar(c.parked.id);
        carMesh.visible = !!spec;
        carMesh.position.set(c.parked.x, 0.02, c.parked.z);
        carMesh.rotation.set(0, c.parked.ry, 0);
      } else carMesh.visible = false;
      sound.tick({ dt, walk: sp, driving: false, rpm: 0, throttle: 0, traffic: trafficNear, night: night.value, rain: precip ? 1 : 0, inside: false });
    }
    // the kerb: a step up onto the pavement
    const lx = ((((c.x + plan.half) % plan.pitch) + plan.pitch) % plan.pitch) - plan.pitch / 2,
      lz = ((((c.z + plan.half) % plan.pitch) + plan.pitch) % plan.pitch) - plan.pitch / 2;
    const onSlab = Math.abs(lx) < plan.pitch / 2 - plan.road / 2 && Math.abs(lz) < plan.pitch / 2 - plan.road / 2 && (plan.coastRow === null || c.z < plan.coastZ! + plan.walk + 1);
    me.y += ((onSlab ? 0.15 : 0) - me.y) * Math.min(1, dt * 14);

    // ---------- a date: her by her door, walking to the car, in it, or beside him ----------
    const dp = datePlan.current;
    if (herRig && dp) {
      const co = comp.current;
      if (co.id !== dp.id + dp.w) Object.assign(co, newCompanion(dp.id + dp.w));
      const driving = c.mode === "drive";
      if (dp.status === "set" && dp.pickup && door) {
        if (co.mode === "away") Object.assign(co, { mode: "wait", x: door.x, z: door.z, ry: door.ry + Math.PI });
        const d = Math.hypot(c.x - door.x, c.z - door.z);
        if (!co.asked && ((driving && d < 15 && Math.abs(c.speed) < 3) || (!driving && d < 2.8))) {
          co.asked = true;
          onPickup?.();
        }
        // facing him once he is close
        if (d < 25) co.ry = Math.atan2(c.x - co.x, c.z - co.z);
      } else if (dp.status === "together" || dp.status === "on") {
        if (co.mode === "away") Object.assign(co, { mode: driving ? "car" : "follow", x: c.x - Math.sin(c.ry) * 1.2, z: c.z - Math.cos(c.ry) * 1.2 });
        if (co.mode === "wait") co.mode = "walkout";
        const sx = Math.cos(c.ry),
          sz = -Math.sin(c.ry);
        if (co.mode === "walkout") {
          // to the nearer side of the car, or to his side on foot
          let tx = c.x,
            tz = c.z;
          if (driving) {
            const a = Math.hypot(c.x + sx * 1.3 - co.x, c.z + sz * 1.3 - co.z),
              b = Math.hypot(c.x - sx * 1.3 - co.x, c.z - sz * 1.3 - co.z);
            const k2 = a < b ? 1 : -1;
            tx = c.x + sx * 1.3 * k2;
            tz = c.z + sz * 1.3 * k2;
          }
          const left = stepTowards(co, tx, tz, dt, 1.6);
          const p2 = { x: co.x, z: co.z };
          grid.push(p2, 0.3);
          co.x = p2.x;
          co.z = p2.z;
          if (left < (driving ? 0.5 : 1.3)) co.mode = driving ? "car" : "follow";
        } else if (co.mode === "car") {
          co.x = c.x;
          co.z = c.z;
          co.ry = c.ry;
          // he got out: she gets out on her side
          if (!driving) Object.assign(co, { mode: "follow", x: c.x + sx * 1.4, z: c.z + sz * 1.4, speed: 0 });
        } else if (co.mode === "follow") {
          if (driving && Math.hypot(co.x - c.x, co.z - c.z) < 8) co.mode = "car";
          else {
            if (Math.hypot(co.x - c.x, co.z - c.z) > 18) Object.assign(co, { x: c.x - Math.sin(c.ry) * 1.2, z: c.z - Math.cos(c.ry) * 1.2 });
            // a step behind his shoulder
            const tx = c.x - Math.sin(c.ry) * 0.9 + sx * 0.75,
              tz = c.z - Math.cos(c.ry) * 0.9 + sz * 0.75;
            const left = stepTowards(co, tx, tz, dt, 6.5);
            const p2 = { x: co.x, z: co.z };
            grid.push(p2, 0.3);
            co.x = p2.x;
            co.z = p2.z;
            if (left < 0.3 && c.speed < 0.3) co.ry += Math.atan2(Math.sin(c.ry - co.ry), Math.cos(c.ry - co.ry)) * Math.min(1, dt * 3);
          }
        }
        // a walk or a drive: after a while together, the date's moments
        if (dp.status === "together" && !co.dated && ((dp.venue === "walk" && co.mode === "follow" && c.speed > 0.6) || (dp.venue === "drive" && co.mode === "car" && Math.abs(c.speed) > 3))) {
          co.together += dt;
          if (co.together > 35) {
            co.dated = true;
            onStreetDate?.();
          }
        }
      } else co.mode = "away";
      herRig.root.visible = (co.mode === "wait" || co.mode === "walkout" || co.mode === "follow") && Math.hypot(co.x - c.x, co.z - c.z) < 120;
      herRig.root.position.set(co.x, co.mode === "wait" ? 0.15 : me.y, co.z);
      herRig.tick(dt, co.ry, co.speed);
      herMark.visible = co.mode === "wait";
      if (herMark.visible) {
        herMark.position.set(door ? door.x : co.x, 3.4 + Math.sin(t * 2) * 0.15, door ? door.z : co.z);
        herMark.rotation.y = t * 1.5;
      }
    } else herMark.visible = false;

    // ---------- the city round him ----------
    const far = QUAL.far[q];
    builds.stream(camera.position.x, camera.position.z, far);
    places.stream(camera.position.x, camera.position.z, far);
    people.tick(dt, t, { x: c.x, z: c.z, car: c.mode === "drive", speed: c.speed }, Math.min(far, 200));
    traffic.tick(dt, t, { x: c.x, z: c.z, rad: c.mode === "drive" ? 1.2 : 0.4 }, Math.min(far, 260));
    bus.tick(dt);
    furniture.tick(t, night.value, (x, z, ax, tt) => lightGreen(plan, x, z, ax, tt));
    if (ground.water) (ground.water.userData.uT as { value: number }).value = t;
    (doorRings.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(t * 3) * 0.2;
    if (homeSpot) {
      homeMark.visible = true;
      homeMark.position.set(homeSpot.door.x, 4.2 + Math.sin(t * 2) * 0.25, homeSpot.door.z);
      homeMark.rotation.y = t;
    } else homeMark.visible = false;
    if (precip) {
      const pa = precip.geometry.getAttribute("position") as THREE.BufferAttribute;
      const fall = kind === "snow" ? 2 : 22;
      for (let i = 0; i < pa.count; i++) {
        let y = pa.getY(i) - fall * dt;
        if (y < 0) y += 40;
        pa.setY(i, y);
      }
      pa.needsUpdate = true;
      precip.position.set(camera.position.x, 0, camera.position.z);
    }

    // ---------- the camera: behind him, pulled in when a building is in the way ----------
    const tgtY = c.mode === "walk" ? me.y + 1.55 : c.mode === "bus" ? 3.4 : 1.4;
    if (c.mode !== "walk" && performance.now() / 1000 - c.lookT > 1.4) {
      // in a car or the bus the camera swings round behind on its own, once he has stopped looking round
      const behind = c.ry + Math.PI;
      let dy = behind - c.camYaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      c.camYaw += dy * Math.min(1, dt * (c.mode === "drive" ? 1.6 : 2.2));
      // and the height settles to a low chase angle
      if (c.mode === "drive") c.camPitch += (0.22 - c.camPitch) * Math.min(1, dt * 1.2);
    }
    const dist = c.mode === "bus" ? 14 : c.mode === "drive" ? Math.max(c.camDist, 7) : c.camDist;
    const cp = Math.cos(c.camPitch);
    const want = tmp.set(c.x + Math.sin(c.camYaw) * dist * cp, tgtY + Math.sin(c.camPitch) * dist, c.z + Math.cos(c.camYaw) * dist * cp);
    const free = grid.clear(c.x, c.z, want.x, want.z, 12);
    if (free < 1) want.set(c.x + (want.x - c.x) * Math.max(0.15, free - 0.06), want.y, c.z + (want.z - c.z) * Math.max(0.15, free - 0.06));
    // a slight chase in the car: the camera trails a touch behind when he speeds up or turns
    camera.position.lerp(want, Math.min(1, dt * (c.mode === "drive" ? 5 : 8)));
    camTarget.set(c.x, tgtY, c.z);
    camera.lookAt(camTarget);
    sky.position.copy(camera.position);
    // the sun's shadow box follows him
    sun.position.set(c.x + lightDir.x * 150, lightDir.y * 150, c.z + lightDir.z * 150);
    sun.target.position.set(c.x, 0, c.z);
    sun.target.updateMatrixWorld();

    // ---------- the waypoint ----------
    if (c.waypoint) {
      beam.visible = true;
      beam.position.set(c.waypoint.x, 80, c.waypoint.z);
      if (Math.hypot(c.waypoint.x - c.x, c.waypoint.z - c.z) < 8) c.waypoint = null;
    } else beam.visible = false;

    // ---------- what he can do here (one thing at a time, the closest first) ----------
    let p: Prompt | null = null;
    if (c.mode === "walk") {
      let door: PlaceSpot | null = null;
      let dd = 2.8;
      for (const s of plan.places) {
        const d = Math.hypot(s.door.x - c.x, s.door.z - c.z);
        if (d < dd) {
          dd = d;
          door = s;
        }
      }
      const ped = people.near();
      const stopI = plan.stops.findIndex((s) => Math.hypot(s.x - c.x, s.z - c.z) < 3.4);
      const carNear = c.parked && Math.hypot(c.parked.x - c.x, c.parked.z - c.z) < 3.4;
      if (door) {
        const pl = door.place;
        if (pl.minAge && age < pl.minAge) p = { key: "", text: pl.name + ": " + pl.minAge + " and over only. The doorman shakes his head." };
        else if (pl.kind === "home") {
          const id = pl.homeId || pl.id.replace("home:", "");
          const mine = state.life.home.id === id || state.life.owned.some((o) => o.id === id && o.city === state.life.city);
          p = { key: "E", text: mine ? "Go home" : "Look round the " + pl.name.toLowerCase() };
        } else p = { key: "E", text: "Go into " + pl.name };
        action.current = () => {
          if (pl.minAge && age < pl.minAge) return;
          sound.chime();
          onEnter(door!);
        };
      } else if (carNear) {
        const spec = carSpec(state, c.parked!.id);
        p = { key: "F", text: "Get in the " + (spec ? spec.name : "car") };
        action.current = () => toggleCar.current();
      } else if (stopI >= 0) {
        const st = plan.stops[stopI];
        if (c.busWait === stopI) p = { key: "", text: "Waiting at " + st.name + ". The bus is " + Math.round(Math.max(0, ((st.at - bus.state.at + plan.busLen) % plan.busLen) / 11)) + " s away." };
        else p = { key: "E", text: "Wait for the bus" };
        action.current = () => {
          c.busWait = stopI;
        };
      } else if (ped) {
        const pp = pending.current;
        if (pp && pp.ped === ped && pp.until > t) {
          p = { key: "E", text: "Take the photo" };
          action.current = () => {
            pending.current = null;
            sound.click();
            onPhoto();
          };
        } else {
          p = { key: "E", text: "Say hello" };
          action.current = () => {
            people.talkTo(ped);
            lastBubble.current = t;
            const known = fame >= 18 && Math.random() < Math.min(0.85, 0.25 + fame / 100);
            if (known) {
              onBubble(pick(["No way, " + myName + "? Can I get a photo?", "Bro, you're " + myName + "! Quick photo?", "My little brother will never believe this. A photo, please?"]));
              pending.current = { kind: "photo", ped, until: t + 6 };
            } else onBubble(pick(SMALL_TALK));
          };
        }
      } else action.current = () => {};
      // the bus came: on he gets
      if (c.busWait !== null) {
        const st = plan.stops[c.busWait];
        if (Math.hypot(st.x - c.x, st.z - c.z) > 6) c.busWait = null;
        else if (bus.state.dwell > 0 && bus.state.stopIdx === c.busWait) {
          c.mode = "bus";
          c.busGetOff = false;
          sound.chime();
        }
      }
    } else if (c.mode === "bus") {
      const b = bus.state;
      let next = -1,
        dist2 = 1e9;
      plan.stops.forEach((s, i) => {
        const d = (((s.at - b.at) % plan.busLen) + plan.busLen) % plan.busLen;
        if (d > 0.5 && d < dist2) {
          dist2 = d;
          next = i;
        }
      });
      const nm = next >= 0 ? plan.stops[next].name : "";
      p = c.busGetOff ? { key: "", text: "Getting off at " + nm } : { key: "E", text: "On the bus. Next stop: " + nm + ". Get off there" };
      action.current = () => {
        c.busGetOff = true;
      };
    } else {
      p = { key: "F", text: "Get out" };
      action.current = () => toggleCar.current();
    }
    if (lastBubble.current && t - lastBubble.current > 5) {
      lastBubble.current = 0;
      onBubble(null);
    }
    prompt(p);
  });

  // getting in and out of his car (set after each render, read by the key handler)
  useEffect(() => {
    toggleCar.current = () => {
      const c = ctl.current;
      if (c.mode === "drive" && drive.current && c.carId) {
        if (Math.abs(drive.current.speed) > 3) return;
        const d = drive.current;
        c.parked = { id: c.carId, x: d.x, z: d.z, ry: d.ry };
        c.mode = "walk";
        c.carId = null;
        // he steps out on the kerb side
        c.x = d.x - Math.cos(d.ry) * 1.6;
        c.z = d.z + Math.sin(d.ry) * 1.6;
        drive.current = null;
        sound.thud(0.3);
        return;
      }
      if (c.mode === "walk" && c.parked && Math.hypot(c.parked.x - c.x, c.parked.z - c.z) < 3.6) {
        const spec = carSpec(state, c.parked.id);
        if (!spec) return;
        drive.current = newDrive(c.parked.x, c.parked.z, c.parked.ry, spec.body);
        c.mode = "drive";
        c.carId = c.parked.id;
        c.parked = null;
        c.camDist = 9;
        sound.thud(0.3);
      }
    };
  });

  return (
    <primitive object={root}>
      <primitive object={sky} />
      <primitive object={sun} />
      <primitive object={sun.target} />
      <primitive object={hemi} />
      <primitive object={fill} />
      <primitive object={ground.group} />
      <primitive object={builds.group} />
      <primitive object={places.group} />
      <primitive object={furniture.group} />
      <primitive object={people.mesh} />
      <primitive object={people.blobs} />
      {traffic.meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
      {parkedCars.meshes.map((m, i) => (
        <primitive key={"p" + i} object={m} />
      ))}
      <primitive object={bus.mesh} />
      <primitive object={doorRings} />
      <primitive object={homeMark} />
      <primitive object={beam} />
      <primitive object={rig.root} />
      {herRig && <primitive object={herRig.root} />}
      <primitive object={herMark} />
      <primitive object={carMesh} />
      {precip && <primitive object={precip} />}
    </primitive>
  );
}

const SMALL_TALK = [
  "Lovely day for it, eh?",
  "You lost? The station's two streets that way.",
  "Mind the puddles, the drains here are a joke.",
  "Have you tried the coffee on the corner? Best in town.",
  "Big match this weekend. You going?",
  "Sorry, can't stop, late for work!",
  "Nice trainers. Where'd you get those?",
];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
