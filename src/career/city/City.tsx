"use client";
/* eslint-disable react-hooks/immutability -- the world's controller is a plain object the screen moves on purpose (a jump from the map, the way out of a place) */
/**
 * The City tab: his city as an open world he walks, drives and rides the bus through (src/career/world), and
 * the places he walks into. Everything he does goes to the server and comes back as the new career state.
 * On the street: WASD to walk, Shift to run, drag to look round, E to use what is in front of him, F for his
 * car, M for the map. Inside: walk up to things; E uses them; Esc or the door goes back out.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import clsx from "clsx";
import { Sun, Moon, Cloud, CloudRain, CloudLightning, CloudFog, Snowflake, MapTrifold, DeviceMobile, SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";
import Interior, { type Hotspot, type WalkCtl } from "./Interior";
import ShopHud from "./ShopHud";
import { Environment, FrameGuard, DPR_CAP } from "../Stage";
import { OUTFITS, type Outfit } from "../body";
import { careerApi, type Saved } from "../api";
import type { CareerState, WorldPlace } from "../types";
import World, { worldStart, carSpec, type WorldCtl, type Prompt } from "../world/World";
import CityMap from "../world/CityMap";
import { makePlan, type PlaceSpot } from "../world/gen";
import { makeStreetSound } from "../world/audio";
import "../world/world.css";

const WEATHER: Record<string, string> = { clear: "Clear", cloud: "Cloudy", rain: "Rain", storm: "Storm", snow: "Snow", fog: "Fog", haze: "Hazy" };

type Run = <T>(fn: () => Promise<T>, after?: (r: T) => void) => Promise<void>;

// where he was in each city, so coming back to the tab carries on from there
const KEEP = new Map<string, WorldCtl>();
// the garage of a home is its own room: the home's place with "/garage" on the id
const garageOf = (p: WorldPlace): WorldPlace => ({ ...p, id: p.id.replace(/\/garage$/, "") + "/garage", name: "Garage" });
const clock = (h: number) => {
  const hh = Math.floor(h),
    mm = Math.floor((h - hh) * 60);
  return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
};

export default function City({
  state,
  saved,
  quality,
  setQuality,
  money,
  run,
  busy,
  onPhone,
  onWeek,
}: {
  state: CareerState;
  saved: Saved;
  quality: number;
  setQuality: (q: number) => void;
  money: (n: number, o?: { week?: boolean }) => string;
  run: Run;
  busy: boolean;
  onPhone: (app: string) => void;
  onWeek: () => void;
}) {
  const life = state.life;
  const world = life.world;
  const placesKey = world ? world.places.map((p) => p.id).join(",") : "";
  const plan = useMemo(
    () => (world ? makePlan(life.city, life.style, world.places, world.seed, world.tier) : null),
    // the plan only changes with the city and its places
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [life.city, life.style.key, world?.seed, world?.tier, placesKey],
  );
  // the world's controller: a plain object the street and the screen both read and move, kept per city
  const startHour = [10.5, 15, 19.6][state.round % 3];
  const ctlObj = useMemo(() => {
    if (!plan) return null;
    const c = KEEP.get(plan.key) || worldStart(plan, startHour, life.home.id);
    KEEP.set(plan.key, c);
    return c;
    // the start hour only matters the first time the city is built
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);
  const ctl = useMemo(() => ({ current: ctlObj }), [ctlObj]);
  // a hook for the browser checks: where he is and where the places are (nothing in the game reads it)
  useEffect(() => {
    if (!plan || !ctlObj) return;
    (window as unknown as { __pcCity?: unknown }).__pcCity = { ctl: () => ctlObj, places: () => plan.places, plan: () => plan };
  }, [plan, ctlObj]);
  const sound = useMemo(() => makeStreetSound(), []);
  useEffect(() => () => sound.dispose(), [sound]);
  const [muted, setMuted] = useState(() => sound.muted());
  const [inside, setInside] = useState<PlaceSpot | null>(null);
  // the room he is in, by id (the place, or "<home id>/garage"), read fresh from the latest state so what he
  // owns is always up to date inside
  const [roomId, setRoomId] = useState<string | null>(null);
  const room = useMemo<WorldPlace | null>(() => {
    if (!roomId) return null;
    const base = roomId.replace(/\/garage$/, "");
    const fresh = (world?.places || []).find((p) => p.id === base) || inside?.place || null;
    if (!fresh) return null;
    return roomId.endsWith("/garage") ? garageOf(fresh) : fresh;
  }, [roomId, world, inside]);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [bubble, setBubble] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [flash, setFlash] = useState(0);
  const [near, setNear] = useState<string | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [toast, setToast] = useState<{ text: string; n: number } | null>(null);
  const [fade, setFade] = useState(false);
  // a touch screen: a thumb stick and buttons for the keys
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(pointer: coarse)");
    const set = () => setTouch(m.matches);
    set();
    m.addEventListener("change", set);
    return () => m.removeEventListener("change", set);
  }, []);
  const press = (key: string) => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key }));
    window.dispatchEvent(new KeyboardEvent("keyup", { key }));
  };
  const [help, setHelp] = useState(() => {
    try {
      return localStorage.getItem("pc_city_help") !== "seen";
    } catch {
      return true;
    }
  });
  const labelEls = useRef(new Map<string, HTMLElement>());
  const walk = useRef<WalkCtl>({ yaw: 0, zoom: 1, use: -1 });
  const say = (text: string) => setToast({ text, n: Date.now() });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);
  // for the shop card: the reply comes back so the card can show what happened
  const actFor = useCallback(
    (p: string, action: string, arg?: string) => {
      let out: unknown = undefined;
      return run(
        () => careerApi.act(saved, p, action, arg),
        (r) => void (out = r),
      ).then(() => out);
    },
    [run, saved],
  );

  // ---------- the HUD reads the world every frame without re-rendering React ----------
  const timeEl = useRef<HTMLElement>(null);
  const arrowEl = useRef<HTMLElement>(null);
  const distEl = useRef<HTMLElement>(null);
  const speedEl = useRef<HTMLElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const c = ctlObj;
      if (c) {
        if (timeEl.current) timeEl.current.textContent = clock(c.hour);
        const ar = arrowEl.current,
          di = distEl.current;
        if (ar && di) {
          if (c.waypoint && !inside) {
            const dir = Math.atan2(c.waypoint.x - c.x, c.waypoint.z - c.z);
            let a = dir - (c.camYaw + Math.PI);
            a = Math.atan2(Math.sin(a), Math.cos(a));
            ar.style.transform = "rotate(" + (-a * 180) / Math.PI + "deg)";
            ar.parentElement!.style.opacity = "1";
            di.textContent = Math.round(Math.hypot(c.waypoint.x - c.x, c.waypoint.z - c.z)) + " m";
          } else ar.parentElement!.style.opacity = "0";
        }
        if (speedEl.current) speedEl.current.textContent = c.mode === "drive" ? Math.round(Math.abs(c.speed) * 3.6) + " km/h" : "";
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [inside, ctlObj]);

  // ---------- in and out of places ----------
  const enter = useCallback(
    (s: PlaceSpot) => {
      setFade(true);
      setTimeout(() => {
        setInside(s);
        setRoomId(s.place.id);
        setNear(null);
        setPrompt(null);
        setBubble(null);
        walk.current = { yaw: 0, zoom: 1, use: -1 };
        setFade(false);
      }, 280);
      if (!(life.visited || []).includes(s.place.id)) void run(() => careerApi.act(saved, s.place.id, "visit"));
    },
    // the visited list and the save are read when he walks in
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [life.visited, saved],
  );
  const leave = useCallback(
    (o?: { drive?: string }) => {
      const s = inside;
      setFade(true);
      setTimeout(() => {
        const c = ctlObj;
        if (c && s) {
          c.teleport = { x: s.door.x + s.face[0] * 1.6, z: s.door.z + s.face[1] * 1.6, ry: Math.atan2(s.face[0], s.face[1]) };
          // out of the garage: the car waits in the kerbside lane, pointing along the street
          if (o?.drive && plan) {
            const [fx, fz] = s.face;
            const tx = -fz,
              tz = fx;
            c.driveOut = { id: o.drive, x: s.door.x + fx * (plan.walk + 2.5) + tx * 4, z: s.door.z + fz * (plan.walk + 2.5) + tz * 4, ry: Math.atan2(tx, tz) };
          }
        }
        setInside(null);
        setRoomId(null);
        setNear(null);
        setHotspots([]);
        setFade(false);
      }, 280);
    },
    [inside, ctlObj, plan],
  );
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "Escape" && inside) leave();
      if (e.key.toLowerCase() === "m" && !inside && plan) setMapOpen((v) => !v);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [inside, leave, plan]);

  // ---------- inside: the shop card (ShopHud) handles E and every button; the door, the garage and driving
  // out come back here ----------
  const onUse = useCallback(() => {}, []);
  const onNear = useCallback((id: string | null) => setNear(id), []);
  const onHotspots = useCallback((h: Hotspot[]) => setHotspots(h), []);
  const onPrompt = useCallback((p: Prompt | null) => setPrompt(p), []);
  const onBubble = useCallback((t: string | null) => setBubble(t), []);
  const onPhoto = useCallback(() => {
    setFlash(Date.now());
    void run(
      () => careerApi.act(saved, "street", "fan", "photo"),
      (r) => say(r.text),
    );
  }, [run, saved]);

  // what he wears: his own clothes in the street, kit at the training ground, the gym and the stadium
  const co = life.cityOutfit;
  const street: Outfit = useMemo(() => (co ? { shirt: co.shirt, trim: co.trim, shorts: co.shorts, socks: co.socks } : OUTFITS.home), [co]);
  const outfit = room && (room.kind === "training" || room.kind === "gym" || room.kind === "stadium") ? OUTFITS.training : street;
  const night = ctlObj ? THREE.MathUtils.clamp((Math.abs(ctlObj.hour - 13) - 6) / 1.5, 0, 1) : 0;
  const Wx = { clear: night > 0.6 ? Moon : Sun, cloud: Cloud, rain: CloudRain, storm: CloudLightning, snow: Snowflake, fog: CloudFog, haze: CloudFog }[life.weather.kind] || Sun;
  const c = ctlObj;
  const carName = c && c.mode === "drive" && c.carId ? carSpec(state, c.carId)?.name : null;
  const ownedHomes = life.owned.filter((o) => o.city === life.city).map((o) => o.id);

  if (!plan || !c) {
    return (
      <div className="pc-world">
        <p className="pc-world-wait">Loading the city.</p>
      </div>
    );
  }

  return (
    <div className={clsx("pc-world", inside ? "is-inside" : "is-street")}>
      <div className="pc-world-canvas" onPointerDown={() => sound.start()}>
        <Canvas
          dpr={[1, DPR_CAP[quality]]}
          shadows={quality >= 1}
          gl={{ antialias: quality >= 1, powerPreference: "high-performance" }}
          camera={{ position: [c.x, 6, c.z + 8], fov: 55, near: 0.1, far: 1300 }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.0;
          }}
        >
          <Environment intensity={inside ? 0.55 : 0.22} />
          <World state={state} plan={plan} quality={quality} ctl={ctl as React.MutableRefObject<WorldCtl>} outfit={street} active={!inside} sound={sound} onEnter={enter} onPrompt={onPrompt} onBubble={onBubble} onPhoto={onPhoto} />
          {inside && room && <Interior key={room.id} place={room} state={state} quality={quality} night={night} outfit={outfit} ctl={walk} labelEls={labelEls} onNear={onNear} onUse={onUse} onHotspots={onHotspots} />}
          <FrameGuard quality={quality} onSlow={setQuality} />
        </Canvas>
        <div className={clsx("pc-city-fade", fade && "is-on")} aria-hidden="true" />
        <div className={clsx("pc-world-flash", flash && "is-on")} key={flash} aria-hidden="true" />
        {inside && (
          <div className="pc-city-labels">
            {hotspots.map((h, k) => (
              <button
                type="button"
                key={h.id}
                className={clsx("pc-spot-tag", near === h.id && "is-near")}
                ref={(el) => {
                  if (el) labelEls.current.set("hs:" + h.id, el);
                  else labelEls.current.delete("hs:" + h.id);
                }}
                onClick={() => (walk.current.use = k)}
              >
                {h.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* the corner: where, when, the weather, free time, money */}
      <div className="pc-world-hud">
        <p className="pc-kicker">{inside ? inside.place.name : life.city}</p>
        <div className="pc-world-chips">
          <span className="pc-chip">
            <b ref={timeEl}>{clock(c.hour)}</b>
          </span>
          <span className="pc-chip" title={WEATHER[life.weather.kind]}>
            <Wx size={15} weight="bold" aria-hidden="true" />
            {WEATHER[life.weather.kind]}, {life.weather.temp}°C
          </span>
          <span className="pc-chip" title="Free time left this week">
            Free time
            <span className="pc-pips" aria-label={life.time + " of " + life.freeTime}>
              {Array.from({ length: life.freeTime }, (_, i) => (
                <i key={i} className={clsx(i < life.time && "is-on")} />
              ))}
            </span>
          </span>
          <span className="pc-chip">{money(state.money.cash)}</span>
        </div>
      </div>
      <div className="pc-world-tools">
        {!inside && (
          <button type="button" className="k-btn k-btn-sm" onClick={() => setMapOpen(true)} title="The city map (M)">
            <MapTrifold size={15} weight="bold" aria-hidden="true" /> Map
          </button>
        )}
        <button type="button" className="k-btn k-btn-sm" onClick={() => onPhone("home")} title="Your phone">
          <DeviceMobile size={15} weight="bold" aria-hidden="true" /> Phone
        </button>
        <button
          type="button"
          className="k-btn k-btn-ghost k-btn-sm"
          aria-label={muted ? "Sound on" : "Sound off"}
          onClick={() => {
            sound.start();
            sound.setMuted(!muted);
            setMuted(!muted);
          }}
        >
          {muted ? <SpeakerSlash size={15} weight="bold" /> : <SpeakerHigh size={15} weight="bold" />}
        </button>
        <button type="button" className="k-btn k-btn-primary k-btn-sm" disabled={busy || state.seasonOver} onClick={onWeek}>
          {busy ? "Playing" : "Play the week"}
        </button>
      </div>

      {/* the waypoint: an arrow at the top that points the way */}
      {!inside && (
        <div className="pc-world-way" style={{ opacity: 0 }} aria-hidden="true">
          <i ref={arrowEl} />
          <span ref={distEl} />
        </div>
      )}
      {!inside && carName && (
        <div className="pc-world-speed">
          <b ref={speedEl} />
          <span>{carName}</span>
        </div>
      )}
      {!inside && bubble && (
        <p className="pc-world-bubble" role="status">
          {bubble}
        </p>
      )}
      {!inside && prompt && (
        <p className="pc-world-prompt">
          {prompt.key && <kbd>{prompt.key}</kbd>}
          {prompt.text}
        </p>
      )}
      {!inside && touch && ctlObj && <TouchStick ctl={ctlObj} onPress={press} driving={!!carName} />}
      {!inside && help && !touch && (
        <div className="pc-world-help">
          <p>
            <kbd>W A S D</kbd> walk, <kbd>Shift</kbd> run, drag to look round, <kbd>E</kbd> go in or talk, <kbd>F</kbd> your car, <kbd>M</kbd> the map
          </p>
          <button
            type="button"
            className="k-btn k-btn-ghost k-btn-sm"
            onClick={() => {
              setHelp(false);
              try {
                localStorage.setItem("pc_city_help", "seen");
              } catch {
                /* fine */
              }
            }}
          >
            Got it
          </button>
        </div>
      )}

      {/* inside a place: the way out, and the card for whatever he stands at */}
      {inside && (
        <button type="button" className="k-btn k-btn-sm pc-world-out" onClick={() => leave()}>
          Back to the street
        </button>
      )}
      {inside && room && (
        <ShopHud
          place={room}
          state={state}
          near={near}
          busy={busy}
          money={money}
          act={actFor}
          onLeave={(o) => {
            if (o.to && inside) {
              // home to garage and back: a new room, the same door
              setFade(true);
              setTimeout(() => {
                setRoomId(o.to === inside.place.id ? inside.place.id : inside.place.id + "/garage");
                setNear(null);
                setHotspots([]);
                walk.current = { yaw: 0, zoom: 1, use: -1 };
                setFade(false);
              }, 260);
            } else leave(o.drive ? { drive: o.drive } : undefined);
          }}
        />
      )}
      {mapOpen && (
        <CityMap
          plan={plan}
          ctl={ctl as React.MutableRefObject<WorldCtl>}
          visited={life.visited || []}
          homeId={life.home.id}
          ownedHomes={ownedHomes}
          onClose={() => setMapOpen(false)}
          onTravel={(s) => {
            const cc = ctlObj;
            cc.teleport = { x: s.door.x + s.face[0] * 1.6, z: s.door.z + s.face[1] * 1.6, ry: Math.atan2(s.face[0], s.face[1]) };
            cc.waypoint = null;
            setMapOpen(false);
          }}
        />
      )}
      {toast && (
        <p key={toast.n} className="pc-city-toast" role="status">
          {toast.text}
        </p>
      )}
    </div>
  );
}

/** the thumb stick for touch screens: drag it to walk (far to run) or drive; E and F as buttons */
function TouchStick({ ctl, onPress, driving }: { ctl: WorldCtl; onPress: (key: string) => void; driving: boolean }) {
  const knob = useRef<HTMLSpanElement>(null);
  const base = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    const b = base.current!.getBoundingClientRect();
    const r = b.width / 2;
    let x = (e.clientX - (b.left + r)) / r,
      y = (e.clientY - (b.top + r)) / r;
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    ctl.stick = { x, y };
    if (knob.current) knob.current.style.transform = "translate(" + x * r * 0.6 + "px," + y * r * 0.6 + "px)";
  };
  const end = () => {
    ctl.stick = null;
    if (knob.current) knob.current.style.transform = "";
  };
  return (
    <div className="pc-touch">
      <div
        ref={base}
        className="pc-touch-stick"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          move(e);
        }}
        onPointerMove={(e) => e.buttons && move(e)}
        onPointerUp={end}
        onPointerCancel={end}
        aria-label={driving ? "Steer and drive" : "Walk"}
      >
        <span ref={knob} />
      </div>
      <div className="pc-touch-btns">
        <button type="button" className="k-btn" onClick={() => onPress("e")}>
          E
        </button>
        <button type="button" className="k-btn" onClick={() => onPress("f")}>
          {driving ? "Out" : "Car"}
        </button>
      </div>
    </div>
  );
}
